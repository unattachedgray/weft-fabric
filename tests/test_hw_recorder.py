import importlib.machinery
import importlib.util
import os
import pathlib
import tempfile
import unittest

TOOL = pathlib.Path(__file__).resolve().parent.parent / "tools" / "hw-recorder"
loader = importlib.machinery.SourceFileLoader("hw_recorder", str(TOOL))
spec = importlib.util.spec_from_loader("hw_recorder", loader)
hw = importlib.util.module_from_spec(spec)
loader.exec_module(hw)


class KernelAlert(unittest.TestCase):
    def test_real_fault_alerts(self):
        self.assertTrue(hw.kernel_alert("kernel: mce: [Hardware Error]: CPU 12: Machine Check"))

    def test_bluetooth_firmware_error_does_not(self):
        self.assertFalse(hw.kernel_alert("kernel: Bluetooth: hci0: Hardware error 0x0c"))


class Spell(unittest.TestCase):
    def test_one_alert_per_spell_with_peak(self):
        spell = hw.HotSpell(hold_s=0)
        self.assertIsNone(spell.update("t0", 0, {"cpu": 80.0}))
        self.assertIn("HOT start", spell.update("t1", 1, {"cpu": 96.0}))
        for mono, value in ((2, 100.0), (3, 92.0), (4, 97.0)):
            self.assertIsNone(spell.update("t", mono, {"cpu": value}))
        end = spell.update("t5", 5, {"cpu": 85.0})
        self.assertIn("HOT end", end)
        self.assertIn("cpu=100.0", end)
        self.assertIn("seconds=4", end)
        self.assertIsNone(spell.update("t6", 6, {"cpu": 85.0}))

    def test_brief_dip_does_not_split_a_spell(self):
        spell = hw.HotSpell(hold_s=300)
        self.assertIn("HOT start", spell.update("t", 0, {"cpu": 100.0}))
        self.assertIsNone(spell.update("t", 10, {"cpu": 85.0}))
        self.assertIsNone(spell.update("t", 20, {"cpu": 99.0}))
        self.assertIsNone(spell.update("t", 30, {"cpu": 85.0}))
        self.assertIsNone(spell.update("t", 329, {"cpu": 85.0}))
        self.assertIn("HOT end", spell.update("t", 330, {"cpu": 85.0}))

    def test_no_sensors_is_no_event(self):
        self.assertIsNone(hw.HotSpell().update("t", 0, {}))


class Prune(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = pathlib.Path(self.tmp.name)

    def boot(self, name, age, size=100):
        for prefix, suffix in (("telemetry", "jsonl"), ("kernel", "log")):
            path = self.dir / f"{prefix}-{name}.{suffix}"
            path.write_bytes(b"x" * size)
            os.utime(path, (1000 - age, 1000 - age))

    def test_oldest_goes_first_and_whole(self):
        self.boot("a", 300)
        self.boot("b", 200)
        self.boot("c", 100)
        self.boot("now", 0)
        self.assertEqual(hw.prune(self.dir, "now", max_bytes=650), ["a"])
        self.assertFalse(list(self.dir.glob("*-a.*")))
        self.assertEqual(len(list(self.dir.iterdir())), 6)

    def test_current_and_previous_boot_survive_over_cap(self):
        self.boot("a", 300)
        self.boot("b", 200)
        self.boot("now", 0)
        self.assertEqual(hw.prune(self.dir, "now", max_bytes=1), ["a"])
        names = {path.name for path in self.dir.iterdir()}
        self.assertIn("telemetry-b.jsonl", names)
        self.assertIn("telemetry-now.jsonl", names)

    def test_foreign_file_is_never_touched(self):
        (self.dir / "notes.txt").write_bytes(b"x" * 1000)
        self.boot("a", 300)
        self.boot("b", 200)
        self.boot("now", 0)
        hw.prune(self.dir, "now", max_bytes=1)
        self.assertTrue((self.dir / "notes.txt").exists())

    def test_under_cap_removes_nothing(self):
        self.boot("a", 300)
        self.boot("now", 0)
        self.assertEqual(hw.prune(self.dir, "now", max_bytes=10_000), [])


if __name__ == "__main__":
    unittest.main()
