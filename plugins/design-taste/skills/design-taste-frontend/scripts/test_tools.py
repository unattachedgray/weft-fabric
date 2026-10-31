#!/usr/bin/python3
"""Each check must fire on a real sample, a clean page must stay silent, and deals must rotate."""
import json, os, subprocess, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
BAD = '''<!doctype html><html><head><style>body{background:#faf7f1;color:#ccc}p{font-size:10px}
.k{text-transform:uppercase;font-size:11px;letter-spacing:.2em}
.c{border-radius:12px;border:1px solid #ddd;box-shadow:0 20px 40px #0002;width:200px;height:90px}</style></head>
<body><section><div class=k>One</div><h2>A</h2><div class=k>Two</div><h2>B</h2><img src=nope.png></section></body></html>'''
GOOD = '''<!doctype html><html lang=en><head><style>body{margin:0 auto;max-width:60ch;padding:2rem;background:#fbfbfd;
color:#1a1d21;font:16px/1.6 "Noto Sans",sans-serif}h1{font-size:40px}a{color:#0b5cad}</style></head>
<body><h1>Tide tables for the harbour</h1><p>High water today falls at 06:12 and again at 18:40, so the morning boats leave early today.</p>
<a href="#more">See all berths</a></body></html>'''


def page(text):
    handle = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False)
    handle.write(text)
    handle.close()
    return handle.name


class Tools(unittest.TestCase):
    def setUp(self):
        self.state = tempfile.mkdtemp()
        self.env = {**os.environ, 'XDG_STATE_HOME': self.state}

    def render(self, text):
        run = subprocess.run(['node', str(HERE / 'render-check.mjs'), page(text), '--json', '--widths', '1280'], capture_output=True, text=True, env=self.env)
        return run.returncode, {(f['group'], f['rule']) for f in json.loads(run.stdout)['widths'][0]['findings']}

    def deal(self, *args):
        return subprocess.run([str(HERE / 'deal'), *args], capture_output=True, text=True, env=self.env).stdout

    def test_render_catches_and_stays_quiet(self):
        code, found = self.render(BAD)
        self.assertEqual(code, 2)
        for rule in ('low-contrast', 'broken-image', 'kicker-above-heading', 'cream-palette'):
            self.assertIn(rule, {r for _, r in found})
        self.assertEqual({f for f in self.render(GOOD)[1] if f[0] != 'polish'}, set())

    def test_static_rule_and_empty_target(self):
        run = subprocess.run([str(HERE / 'taste-check'), page(BAD)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 2)
        self.assertIn('cream-palette', run.stdout)
        self.assertEqual(subprocess.run([str(HERE / 'taste-check'), '/nonexistent'], capture_output=True).returncode, 1)

    def test_remote_needs_consent(self):
        run = subprocess.run(['node', str(HERE / 'render-check.mjs'), 'https://example.com'], capture_output=True, text=True)
        self.assertEqual(run.returncode, 1)
        self.assertIn('Refusing', run.stderr)

    def test_history_compares_renders(self):
        self.render(GOOD)
        run = subprocess.run(['node', str(HERE / 'render-check.mjs'), page(GOOD), '--json', '--widths', '1280'], capture_output=True, text=True, env=self.env)
        self.assertGreater(json.loads(run.stdout)['nearest']['score'], 0.9)

    def ids(self, text):
        return [line.split(':')[0] for line in text.splitlines() if line and not line.startswith((' ', 'NOTE'))]

    def test_deals_rotate_and_obey_verdicts(self):
        first = self.ids(self.deal('clinic dashboard', '--mode', 'operate', '--seed', 'a'))
        second = self.ids(self.deal('clinic dashboard', '--mode', 'operate', '--seed', 'a'))
        self.assertEqual(len(first), 3)
        self.assertFalse(set(first) & set(second))
        self.deal('reject', first[0])
        for seed in 'bcdefg':
            self.assertNotIn(first[0], self.ids(self.deal('clinic dashboard', '--mode', 'operate', '--seed', seed)))

    def test_roll_never_picks_the_first(self):
        for seed in range(30):
            self.assertNotIn('candidate 1 ', self.deal('--roll', '4', '--seed', str(seed)))


if __name__ == '__main__':
    unittest.main()
