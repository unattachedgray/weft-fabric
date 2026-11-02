"""The SKILL.md size ratchet in validate-skills.py."""
import importlib.util
import os
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
spec = importlib.util.spec_from_file_location("vs", os.path.join(ROOT, "validate-skills.py"))
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)

HEAD = "---\nname: x\ndescription: y\n---\n"


def skill(size: int) -> str:
    """Write a SKILL.md of exactly `size` bytes and return its path."""
    d = tempfile.mkdtemp()
    path = os.path.join(d, "SKILL.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(HEAD + "a" * (size - len(HEAD)))
    return path


class SizeRatchet(unittest.TestCase):
    def test_under_the_limit_passes(self):
        self.assertEqual(vs.size_problems(skill(vs.MAX_SKILL_BYTES - 1), "new/SKILL.md"), [])

    def test_at_the_limit_fails(self):
        self.assertTrue(vs.size_problems(skill(vs.MAX_SKILL_BYTES), "new/SKILL.md"))

    def test_baselined_skill_at_its_size_passes(self):
        vs.SIZE_BASELINE["old/SKILL.md"] = 25000
        self.assertEqual(vs.size_problems(skill(25000), "old/SKILL.md"), [])

    def test_baselined_skill_that_grows_fails(self):
        vs.SIZE_BASELINE["old/SKILL.md"] = 25000
        self.assertTrue(vs.size_problems(skill(25001), "old/SKILL.md"))

    def test_check_reports_the_problem(self):
        self.assertTrue(any("20000" in p for p in vs.check(skill(vs.MAX_SKILL_BYTES + 5))))

    def test_every_real_skill_passes(self):
        self.assertEqual(vs.main([]), 0)


if __name__ == "__main__":
    unittest.main()
