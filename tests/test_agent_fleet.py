from __future__ import annotations

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
        self.assertEqual(report["fabric_version"], "0.1.0")
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
        self.assertEqual(report["version"], "0.1.0")
        self.assertTrue(report["build"])


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
