from __future__ import annotations

import argparse
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]


def load_script(name: str, path: Path):
    loader = importlib.machinery.SourceFileLoader(name, str(path))
    spec = importlib.util.spec_from_loader(name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agentsync = load_script("agentsync_under_test", ROOT / "scripts" / "agentsync")

    def test_current_manifest_is_valid(self):
        raw = json.loads((ROOT / "cli-targets.json").read_text())
        clis = self.agentsync.validate_manifest(raw)
        self.assertEqual([c["name"] for c in clis], ["claude", "codex", "gemini", "cursor", "dsh"])

    def test_release_metadata_is_valid_and_compatible(self):
        release = self.agentsync.validate_release(json.loads((ROOT / "fabric-release.json").read_text()))
        self.assertRegex(release["version"], r"^\d+\.\d+\.\d+$")
        self.assertLessEqual(release["minimum_fabric_protocol"], release["fabric_protocol"])

    def test_duplicate_cli_is_rejected_before_reconciliation(self):
        cli = {"name": "codex", "detect": ["true"], "instructions": "/tmp/x", "method": "symlink"}
        with self.assertRaisesRegex(ValueError, "duplicate CLI"):
            self.agentsync.validate_manifest({"clis": [cli, dict(cli)]})

    def test_opaque_post_command_is_rejected(self):
        cli = {"name": "cursor", "detect": ["true"], "post": ["write something"]}
        with self.assertRaisesRegex(ValueError, "require name, check, and apply"):
            self.agentsync.validate_manifest({"clis": [cli]})

    def test_compatibility_alias_is_relinked_to_canonical_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            canonical = root / "weft-fabric" / "item"
            canonical.parent.mkdir()
            canonical.write_text("shared")
            old_root = root / "claude-skills"
            old_root.symlink_to(canonical.parent)
            installed = root / "installed"
            installed.symlink_to(old_root / "item")
            self.agentsync.changed.clear()
            self.agentsync.link(canonical, installed, False)
            self.assertEqual(installed.readlink(), canonical)

    def test_plugin_skill_eligibility_is_manifest_driven(self):
        codex = {path.name for path in self.agentsync.plugin_skills_for("codex")}
        claude = {path.name for path in self.agentsync.plugin_skills_for("claude")}
        dsh = {path.name for path in self.agentsync.plugin_skills_for("dsh")}
        self.assertIn("security-review", codex)
        self.assertNotIn("security-review", claude)
        self.assertIn("security-review", dsh)
        self.assertIn("ste", claude)
        self.assertNotIn("ste", codex)


class ProtocolTests(unittest.TestCase):
    def test_check_json_is_live_and_machine_readable(self):
        run = subprocess.run(
            [str(ROOT / "scripts" / "agentsync"), "--check", "--json"],
            capture_output=True, text=True, timeout=30,
        )
        self.assertIn(run.returncode, (0, 2), run.stderr)
        report = json.loads(run.stdout)
        self.assertEqual(report["protocol"], 1)
        self.assertIn(report["state"], ("ok", "drifted"))
        self.assertIn("codex", report["detected_clis"])
        self.assertTrue(report["repo_fingerprint"])
        release = json.loads((ROOT / "fabric-release.json").read_text())
        self.assertEqual(report["fabric_version"], release["version"])
        self.assertGreaterEqual(report["fabric_protocol"], 1)

    def test_check_sensor_fires_on_real_missing_wiring(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, HOME=tmp)
            run = subprocess.run(
                [str(ROOT / "scripts" / "agentsync"), "--check", "--json"],
                env=env, capture_output=True, text=True, timeout=30,
            )
        self.assertEqual(run.returncode, 2, run.stderr)
        report = json.loads(run.stdout)
        self.assertEqual(report["state"], "drifted")
        self.assertTrue(report["changes"], "sensor returned drift without observable evidence")

    def test_wagent_is_the_single_front_door(self):
        run = subprocess.run([str(ROOT / "tools" / "wagent"), "doctor", "--json"],
                             capture_output=True, text=True, timeout=30)
        self.assertIn(run.returncode, (0, 2), run.stderr)
        self.assertEqual(json.loads(run.stdout)["protocol"], 1)

    def test_wagent_version_reports_version_protocol_and_build(self):
        run = subprocess.run([str(ROOT / "tools" / "wagent"), "version", "--json"],
                             capture_output=True, text=True, timeout=30)
        self.assertEqual(run.returncode, 0, run.stderr)
        report = json.loads(run.stdout)
        release = json.loads((ROOT / "fabric-release.json").read_text())
        self.assertEqual(report["version"], release["version"])
        self.assertTrue(report["build"])

    def test_setup_inspection_uses_live_sensor_without_writes(self):
        run = subprocess.run([str(ROOT / "tools" / "wsetup"), "--inspect"],
                             capture_output=True, text=True, timeout=30)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("Detected", run.stdout)
        self.assertIn("Agent CLIs:", run.stdout)
        self.assertIn("Inspection only; nothing changed.", run.stdout)

    def test_setup_refuses_an_implicit_yes_without_a_terminal(self):
        run = subprocess.run([str(ROOT / "tools" / "wsetup"), "--no-timer"],
                             input="", capture_output=True, text=True, timeout=30)
        self.assertEqual(run.returncode, 2)
        self.assertIn("confirmation requires a terminal", run.stderr)

    def test_preclone_install_inspection_changes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fabric"
            env = dict(os.environ, REPO_DIR=str(target))
            run = subprocess.run([str(ROOT / "install.sh"), "--inspect"], env=env,
                                 capture_output=True, text=True, timeout=30)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn("inspection only; nothing changed", run.stdout)
            self.assertFalse(target.exists())


class SecretProvisioningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wsecret = load_script("wsecret_under_test", ROOT / "tools" / "wsecret")

    def test_remote_provisioner_merges_atomically_and_reports_no_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, HOME=tmp)
            payload = {"replace": False, "credentials": {
                "OPENAI_API_KEY": {"scope": "llm", "value": "super-secret-value"},
            }}
            run = subprocess.run(
                ["python3", "-c", self.wsecret.REMOTE_PROVISIONER], input=json.dumps(payload),
                env=env, capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            report = json.loads(run.stdout)
            self.assertEqual(report["names"], ["OPENAI_API_KEY"])
            self.assertNotIn("super-secret-value", run.stdout + run.stderr)
            secret_file = Path(tmp) / ".config/weft/secrets/llm.env"
            self.assertEqual(secret_file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(secret_file.read_text(), "OPENAI_API_KEY=super-secret-value\n")

            conflict = subprocess.run(
                ["python3", "-c", self.wsecret.REMOTE_PROVISIONER], input=json.dumps(payload),
                env=env, capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(conflict.returncode, 3)
            self.assertEqual(json.loads(conflict.stdout)["conflicts"], ["OPENAI_API_KEY"])

    def test_transport_keeps_values_out_of_ssh_arguments(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "secrets"
            root.mkdir(parents=True)
            (root / "llm.env").write_text("OPENAI_API_KEY=never-in-argv\n")
            (root / "manifest.json").write_text(json.dumps({"OPENAI_API_KEY": {"scope": "llm"}}))
            response = subprocess.CompletedProcess(
                [], 0, json.dumps({"ok": True, "names": ["OPENAI_API_KEY"],
                                   "modes": {"llm.env": "0o600", "manifest.json": "0o600"}}), "",
            )
            args = argparse.Namespace(host="laptop", keys="OPENAI_API_KEY", all=False, replace=False)
            with mock.patch.object(self.wsecret, "ROOT", root), mock.patch.object(
                self.wsecret.subprocess, "run", return_value=response,
            ) as run:
                self.assertEqual(self.wsecret.cmd_provision(args), 0)
            command = run.call_args.args[0]
            self.assertNotIn("never-in-argv", " ".join(command))
            self.assertIn("never-in-argv", run.call_args.kwargs["input"])


class FleetRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wfleet = load_script("wfleet_under_test", ROOT / "tools" / "wfleet")
        cls.wmachine = load_script("wmachine_under_test", ROOT / "tools" / "wmachine")

    def test_fleet_registry_overrides_legacy_without_losing_legacy_hosts(self):
        with tempfile.TemporaryDirectory() as tmp:
            fleet = Path(tmp) / "fleet.json"
            legacy = Path(tmp) / "vault.json"
            fleet.write_text(json.dumps({"version": 1, "machines": {"plain": {"host": "plain-host"}}}))
            legacy.write_text(json.dumps({"vaulted": {"host": "vault-host"}, "plain": {"host": "old"}}))
            with mock.patch.object(self.wfleet, "REGISTRY", fleet), mock.patch.object(self.wfleet, "LEGACY_REGISTRY", legacy):
                self.assertEqual(self.wfleet.registry(), {"vaulted": "vault-host", "plain": "plain-host"})

    def test_no_vault_machine_is_recorded_atomically(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "fleet.json"
            with mock.patch.object(self.wmachine, "FLEET", target):
                self.wmachine.register_machine("laptop", "lap", False)
            data = json.loads(target.read_text())
            self.assertEqual(data["machines"]["laptop"], {"host": "lap", "vault": "not-requested"})
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_enrollment_journal_retains_bounded_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            journals = Path(tmp) / "journals"
            with mock.patch.object(self.wmachine, "JOURNALS", journals):
                self.wmachine.record_enrollment("laptop", "lap", "start", "running")
                self.wmachine.record_enrollment("laptop", "lap", "verified", "complete")
            data = json.loads((journals / "laptop.json").read_text())
            self.assertEqual(data["last_step"], "verified")
            self.assertEqual(data["state"], "complete")
            self.assertEqual([row["step"] for row in data["history"]], ["start", "verified"])
            with mock.patch.object(self.wmachine, "JOURNALS", journals):
                self.assertEqual(self.wmachine.previous_enrollment("laptop")["last_step"], "verified")

    def test_machine_name_cannot_escape_journal_directory(self):
        with mock.patch.object(self.wmachine, "check_host", return_value=True):
            self.assertEqual(self.wmachine.cmd_enroll("safe-host", "../../escape", False, 30), 2)



if __name__ == "__main__":
    unittest.main()
