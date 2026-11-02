import os
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(
    HERE, os.pardir, "principles", "skills", "diagnostic-loop", "find-polluter"
)


class TestFindPolluter(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.watch = os.path.join(self.tmp.name, "artifact")

    def run_script(self, argv):
        return subprocess.run(
            [SCRIPT] + argv, capture_output=True, text=True, cwd=self.tmp.name
        )

    def write_test(self, name, body):
        path = os.path.join(self.tmp.name, name)
        with open(path, "w") as f:
            f.write("#!/usr/bin/env bash\n" + body + "\n")
        return path

    def test_too_few_args(self):
        r = self.run_script([self.watch])
        self.assertEqual(r.returncode, 2)
        self.assertIn("usage", r.stderr)

    def test_already_present(self):
        t1 = self.write_test("t1.sh", "exit 0")
        t2 = self.write_test("t2.sh", "exit 0")
        with open(self.watch, "w") as f:
            f.write("x")
        r = self.run_script([self.watch, "bash {}", t1, t2])
        self.assertEqual(r.returncode, 2)
        self.assertIn("already present", r.stderr)
        self.assertEqual(r.stdout, "")

    def test_polluter_found(self):
        t1 = self.write_test("t1.sh", "exit 0")
        t2 = self.write_test("t2.sh", 'echo hi > "%s"' % self.watch)
        t3 = self.write_test("t3.sh", "exit 0")
        r = self.run_script([self.watch, "bash {}", t1, t2, t3])
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout, "polluter: %s\n" % t2)
        self.assertEqual(r.stderr, "")

    def test_clean_run(self):
        t1 = self.write_test("t1.sh", "exit 1")
        t2 = self.write_test("t2.sh", "echo noisy >&2")
        t3 = self.write_test("t3.sh", "exit 0")
        r = self.run_script([self.watch, "bash {}", t1, t2, t3])
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "clean: 3 tests\n")
        self.assertEqual(r.stderr, "")


if __name__ == "__main__":
    unittest.main()
