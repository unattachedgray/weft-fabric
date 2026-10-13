from __future__ import annotations

import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load_wremote():
    loader = importlib.machinery.SourceFileLoader("wremote_under_test", str(ROOT / "tools" / "wremote"))
    spec = importlib.util.spec_from_loader("wremote_under_test", loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


STATE = {
    "venge": {"ip": "100.0.0.1", "user": "julian", "pubkey": "ssh-ed25519 AAAAvenge", "host_key": "ssh-ed25519 AAAAhkv"},
    "sd": {"ip": "100.0.0.2", "user": "julian", "pubkey": "ssh-ed25519 AAAAsd", "host_key": "ssh-ed25519 AAAAhks"},
    "work": {"ip": "100.0.0.3", "user": "julian", "pubkey": "ssh-ed25519 AAAAwork", "host_key": "ssh-ed25519 AAAAhkw"},
}


class MeshRenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = load_wremote()

    def test_conf_lists_every_other_member_with_pinned_known_hosts(self):
        conf = self.w.render_conf("work", STATE)
        self.assertIn("Host venge\n    HostName 100.0.0.1", conf)
        self.assertIn("Host sd\n", conf)
        self.assertNotIn("Host work", conf)
        self.assertIn("UserKnownHostsFile ~/.ssh/known_hosts ~/.ssh/weft-mesh_known_hosts", conf)
        known = self.w.render_known_hosts("work", STATE)
        self.assertEqual(known.splitlines(), ["sd,100.0.0.2 ssh-ed25519 AAAAhks",
                                              "venge,100.0.0.1 ssh-ed25519 AAAAhkv"])

    def test_member_without_ip_is_left_out(self):
        state = {**STATE, "laptop": {"user": "julian"}}
        self.assertNotIn("laptop", self.w.render_conf("work", state))


class MeshApplyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = load_wremote()

    def apply(self, home: Path, payload: dict) -> dict:
        r = subprocess.run([sys.executable, "-c", self.w.APPLY, json.dumps(payload)],
                           capture_output=True, text=True, env={**os.environ, "HOME": str(home)})
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def test_apply_is_idempotent_and_respects_hand_placed_lines(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / ".ssh").mkdir()
            (home / ".ssh" / "config").write_text("Host venge\n    HostName old.example\n")
            # A deliberately restricted line for sd's key must survive untouched.
            hand = 'command="gate" ssh-ed25519 AAAAsd sd-gated'
            (home / ".ssh" / "authorized_keys").write_text(hand + "\n")
            payload = self.w.payload_for("work", STATE)

            first = self.apply(home, payload)
            ak = (home / ".ssh" / "authorized_keys").read_text()
            self.assertTrue(ak.startswith(hand + "\n"))
            self.assertIn("ssh-ed25519 AAAAvenge weft-mesh:venge", ak)
            self.assertNotIn("weft-mesh:sd", ak)
            self.assertTrue(any("sd:" in n for n in first["notes"]))
            cfg = (home / ".ssh" / "config").read_text()
            self.assertEqual(cfg.count(self.w.INCLUDE), 1)
            self.assertLess(cfg.index(self.w.INCLUDE), cfg.index("Host venge"))
            self.assertEqual(oct((home / ".ssh" / "authorized_keys").stat().st_mode & 0o777), "0o600")
            mesh = json.loads((home / ".config" / "agents" / "mesh.json").read_text())
            self.assertEqual(mesh["self"], "work")

            second = self.apply(home, payload)
            self.assertEqual(second["changed"], [])

    def test_block_is_replaced_when_a_member_leaves(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.apply(home, self.w.payload_for("work", STATE))
            smaller = {k: v for k, v in STATE.items() if k != "venge"}
            self.apply(home, self.w.payload_for("work", smaller))
            ak = (home / ".ssh" / "authorized_keys").read_text()
            self.assertNotIn("AAAAvenge", ak)
            self.assertEqual(ak.count(self.w.BEGIN), 1)


class RunQuotingTests(unittest.TestCase):
    def test_local_run_keeps_one_argument_as_a_shell_string(self):
        w = load_wremote()
        r = w.execute("local", w.PATH_PREFIX + "echo a | tr a b")
        self.assertEqual(r.stdout.strip(), "b")


if __name__ == "__main__":
    unittest.main()
