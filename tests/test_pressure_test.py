"""pressure-test against a stub gateway: verdicts, the routing declaration, and silence."""
import http.server, json, os, subprocess, tempfile, threading, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SCRIPT = os.path.join(ROOT, "plugins/skill-management/skills/skill-audit/scripts/pressure-test")
SCENARIO = "---\nexpect: verify\nviolate: ship it\n---\nWhat do you do?\n"
seen = []


class Stub(http.server.BaseHTTPRequestHandler):
    with_skill = without_skill = ""

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        seen.append(body)
        has = any(m["role"] == "system" for m in body["messages"])
        reply = Stub.with_skill if has else Stub.without_skill
        out = json.dumps({"choices": [{"message": {"content": reply}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


class Runner(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Stub)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def run_tool(self, without, with_):
        Stub.without_skill, Stub.with_skill = without, with_
        d = tempfile.mkdtemp()
        os.mkdir(os.path.join(d, "pressure"))
        open(os.path.join(d, "SKILL.md"), "w").write("the rule")
        open(os.path.join(d, "pressure", "a.md"), "w").write(SCENARIO)
        env = dict(os.environ, API_KEY="k", PRESSURE_LEDGER=os.path.join(d, "l.jsonl"),
                   PRESSURE_URL=f"http://127.0.0.1:{self.srv.server_port}/")
        return subprocess.run([SCRIPT, d, "--runs", "2"], env=env, capture_output=True, text=True), d

    def test_proven(self):
        r, d = self.run_tool("I ship it", "I verify first")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("PROVEN", r.stdout)
        row = json.loads(open(os.path.join(d, "l.jsonl")).read())
        self.assertEqual((row["baseline"], row["treated"]), (0, 2))

    def test_no_delta(self):
        r, _ = self.run_tool("I verify first", "I verify first")
        self.assertEqual(r.returncode, 2)
        self.assertIn("NO-DELTA", r.stdout)

    def test_leaks(self):
        r, _ = self.run_tool("I ship it", "I verify, then ship it")
        self.assertEqual(r.returncode, 1)
        self.assertIn("LEAKS", r.stdout)

    def test_empty_reply_is_invalid_and_leaves_no_row(self):
        r, d = self.run_tool("", "")
        self.assertEqual(r.returncode, 3)
        self.assertIn("INVALID", r.stderr)
        self.assertFalse(os.path.exists(os.path.join(d, "l.jsonl")))

    def test_each_run_defeats_the_gateway_cache(self):
        seen.clear()
        self.run_tool("I ship it", "I verify")
        users = [m["content"] for b in seen for m in b["messages"] if m["role"] == "user"]
        self.assertEqual(len(set(users)), len(users))

    def test_declares_economy_with_no_escalation(self):
        self.run_tool("I ship it", "I verify")
        routing = seen[-1]["routing"]
        self.assertEqual((routing["strength"], routing["allow_escalation"]), ("economy", False))


if __name__ == "__main__":
    unittest.main()
