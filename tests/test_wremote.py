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
    "hub": {"ip": "100.0.0.1", "user": "user", "pubkey": "ssh-ed25519 AAAAhub", "host_key": "ssh-ed25519 AAAAhkv"},
    "leaf1": {"ip": "100.0.0.2", "user": "user", "pubkey": "ssh-ed25519 AAAAleaf1", "host_key": "ssh-ed25519 AAAAhks"},
    "leaf2": {"ip": "100.0.0.3", "user": "user", "pubkey": "ssh-ed25519 AAAAleaf2", "host_key": "ssh-ed25519 AAAAhkw"},
}


class MeshRenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = load_wremote()

    def test_conf_lists_every_other_member_with_pinned_known_hosts(self):
        conf = self.w.render_conf("leaf2", STATE)
        self.assertIn("Host hub\n    HostName 100.0.0.1", conf)
        self.assertIn("Host leaf1\n", conf)
        self.assertNotIn("Host leaf2", conf)
        self.assertIn("UserKnownHostsFile ~/.ssh/known_hosts ~/.ssh/weft-mesh_known_hosts", conf)
        known = self.w.render_known_hosts("leaf2", STATE)
        self.assertEqual(known.splitlines(), ["hub,100.0.0.1 ssh-ed25519 AAAAhkv",
                                              "leaf1,100.0.0.2 ssh-ed25519 AAAAhks"])

    def test_member_without_ip_is_left_out(self):
        state = {**STATE, "laptop": {"user": "user"}}
        self.assertNotIn("laptop", self.w.render_conf("leaf2", state))


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
            (home / ".ssh" / "config").write_text("Host hub\n    HostName old.example\n")
            # A deliberately restricted line for leaf1's key must survive untouched.
            hand = 'command="gate" ssh-ed25519 AAAAleaf1 leaf1-gated'
            (home / ".ssh" / "authorized_keys").write_text(hand + "\n")
            payload = self.w.payload_for("leaf2", STATE)

            first = self.apply(home, payload)
            ak = (home / ".ssh" / "authorized_keys").read_text()
            self.assertTrue(ak.startswith(hand + "\n"))
            self.assertIn("ssh-ed25519 AAAAhub weft-mesh:hub", ak)
            self.assertNotIn("weft-mesh:leaf1", ak)
            self.assertTrue(any("leaf1:" in n for n in first["notes"]))
            cfg = (home / ".ssh" / "config").read_text()
            self.assertEqual(cfg.count(self.w.INCLUDE), 1)
            self.assertLess(cfg.index(self.w.INCLUDE), cfg.index("Host hub"))
            self.assertEqual(oct((home / ".ssh" / "authorized_keys").stat().st_mode & 0o777), "0o600")
            mesh = json.loads((home / ".config" / "agents" / "mesh.json").read_text())
            self.assertEqual(mesh["self"], "leaf2")

            second = self.apply(home, payload)
            self.assertEqual(second["changed"], [])

    def test_block_is_replaced_when_a_member_leaves(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.apply(home, self.w.payload_for("leaf2", STATE))
            smaller = {k: v for k, v in STATE.items() if k != "hub"}
            self.apply(home, self.w.payload_for("leaf2", smaller))
            ak = (home / ".ssh" / "authorized_keys").read_text()
            self.assertNotIn("AAAAhub", ak)
            self.assertEqual(ak.count(self.w.BEGIN), 1)


class RunQuotingTests(unittest.TestCase):
    def test_local_run_keeps_one_argument_as_a_shell_string(self):
        w = load_wremote()
        r = w.execute("local", w.PATH_PREFIX + "echo a | tr a b")
        self.assertEqual(r.stdout.strip(), "b")


if __name__ == "__main__":
    unittest.main()
