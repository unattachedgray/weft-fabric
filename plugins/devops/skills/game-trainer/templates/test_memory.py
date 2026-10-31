#!/usr/bin/python3
"""Exercises the real /proc paths against a live stand-in process, not mocks."""
import os, shutil, subprocess, sys, tempfile, time, unittest
from pathlib import Path
import memory


def writable_region(pid):
    for row in Path(f'/proc/{pid}/maps').read_text().splitlines():
        fields = row.split()
        if fields[1].startswith('rw') and len(fields) == 5:
            return int(fields[0].split('-')[0], 16)
    raise AssertionError('No writable region')


class Live(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.exe = Path(self.dir, 'standin')
        shutil.copy2(os.path.realpath(sys.executable), self.exe)
        digest = memory.hashlib.sha256(self.exe.read_bytes()).hexdigest()
        self.saved = dict(memory.CONFIG)
        memory.CONFIG.update(executable=str(self.exe), sha256=digest)
        self.children = []

    def tearDown(self):
        for child in self.children:
            child.kill()
            child.wait()
        memory.CONFIG.clear()
        memory.CONFIG.update(self.saved)
        shutil.rmtree(self.dir)

    def spawn(self):
        child = subprocess.Popen([str(self.exe), '-S', '-c', 'import time; time.sleep(30)'])
        self.children.append(child)
        time.sleep(0.2)
        return child

    def test_connects_and_reads(self):
        child = self.spawn()
        game = memory.Game()
        self.assertEqual(game.pid, child.pid)
        base = next(int(r.split('-')[0], 16) for r in Path(f'/proc/{child.pid}/maps').read_text().splitlines())
        self.assertEqual(game.read(base, 4), b'\x7fELF')
        game.close()

    def test_refuses_no_process(self):
        with self.assertRaisesRegex(RuntimeError, 'exactly one'):
            memory.Game()

    def test_refuses_two_copies(self):
        self.spawn()
        self.spawn()
        with self.assertRaisesRegex(RuntimeError, 'exactly one'):
            memory.Game()

    def test_refuses_other_build(self):
        self.spawn()
        memory.CONFIG['sha256'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'Unsupported'):
            memory.Game()

    def test_write_is_guarded_and_read_back(self):
        child = self.spawn()
        game = memory.Game()
        address = writable_region(child.pid)
        original = game.read(address, 4)
        changed = bytes(b ^ 0xff for b in original)
        game.write(address, original, changed)
        self.assertEqual(game.read(address, 4), changed)
        with self.assertRaisesRegex(RuntimeError, 'refusing'):
            game.write(address, original, changed)
        self.assertEqual(game.read(address, 4), changed)
        game.write(address, changed, original)
        game.close()

    def test_detects_exit(self):
        child = self.spawn()
        game = memory.Game()
        self.assertTrue(game.alive())
        child.kill()
        child.wait()
        self.assertFalse(game.alive())
        with self.assertRaisesRegex(RuntimeError, 'exited'):
            game.read(0, 1)
        game.close()


if __name__ == '__main__':
    unittest.main()
