---
name: advanced-agents
description: Advanced agent patterns for computer-use agents, parallel agent systems, vision-based control, and multi-agent orchestration
---

# Advanced Agent Patterns

Advanced techniques for building computer-use agents and parallel agent systems with sophisticated coordination, vision-based control, and multi-agent orchestration.

## When to Use This Skill

- Implementing computer-use agents that interact with GUIs and desktop systems
- Building parallel agent systems for concurrent task execution
- Coordinating multiple agents working on shared goals
- Creating agents that use browser automation and system tools
- Developing vision-based agents for screen control
- Orchestrating specialized agents for comprehensive analysis
- Implementing sandboxed execution for safe agent operations

## Quick Reference

**Computer Use Agents:**
- Perception-Reasoning-Action loop: Screenshot → Analyze → Execute → Observe
- Always run in sandboxed Docker containers with virtual desktops
- Use Anthropic Computer Use API or build custom vision-based control
- Critical security: network isolation, filesystem restrictions, resource limits

**Parallel Agent Orchestration:**
- Multiple specialized agents with domain expertise
- Sequential chains for dependent tasks
- Context passing between agents for comprehensive analysis
- Single synthesis report combining all agent findings

---

## 1. Computer Use Agent Architecture

### Perception-Reasoning-Action Loop

The fundamental architecture of computer use agents integrating vision models with action execution:

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT LOOP                               │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Perceive│───▶│  Reason  │───▶│   Act    │              │
│  │ (Screen) │    │ (Plan)   │    │ (Execute)│              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       ▲                               │                     │
│       │         ┌──────────┐          │                     │
│       └─────────│ Observe  │◀─────────┘                     │
│                 │ (Result) │                                │
│                 └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**
1. PERCEPTION: Screenshot captures current screen state
2. REASONING: Vision-language model analyzes and plans next action
3. ACTION: Execute mouse/keyboard/system operations
4. FEEDBACK: Observe result, continue or correct

**Critical insight:** Vision agents pause 1-5 seconds during "thinking" phase, creating detectable patterns.

### Implementation Example

```python
from anthropic import Anthropic
from PIL import Image
import base64
import pyautogui
import time

class ComputerUseAgent:
    """
    Perception-Reasoning-Action loop implementation.
    Based on Anthropic Computer Use patterns.
    """

    def __init__(self, client: Anthropic, model: str = "claude-sonnet-4-20250514"):
        self.client = client
        self.model = model
        self.max_steps = 50  # Prevent runaway loops
        self.action_delay = 0.5  # Seconds between actions

    def capture_screenshot(self) -> str:
        """Capture screen and return base64 encoded image."""
        screenshot = pyautogui.screenshot()
        # Resize for token efficiency (1280x800 is good balance)
        screenshot = screenshot.resize((1280, 800), Image.LANCZOS)

        import io
        buffer = io.BytesIO()
        screenshot.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    def execute_action(self, action: dict) -> dict:
        """Execute mouse/keyboard action on the computer."""
        action_type = action.get("type")

        if action_type == "click":
            x, y = action["x"], action["y"]
            button = action.get("button", "left")
            pyautogui.click(x, y, button=button)
            return {"success": True, "action": f"clicked at ({x}, {y})"}

        elif action_type == "type":
            text = action["text"]
            pyautogui.typewrite(text, interval=0.02)
            return {"success": True, "action": f"typed {len(text)} chars"}

        elif action_type == "key":
            key = action["key"]
            pyautogui.press(key)
            return {"success": True, "action": f"pressed {key}"}

        elif action_type == "scroll":
            direction = action.get("direction", "down")
            amount = action.get("amount", 3)
            scroll = -amount if direction == "down" else amount
            pyautogui.scroll(scroll)
            return {"success": True, "action": f"scrolled {direction}"}

        return {"success": False, "error": "Unknown action type"}
```

---

## 2. Sandboxed Environment Pattern

**CRITICAL:** Computer use agents MUST run in isolated, sandboxed environments. Never give agents direct access to your main system.

### Key Isolation Requirements

1. **NETWORK:** Restrict to necessary endpoints only
2. **FILESYSTEM:** Read-only or scoped to temp directories
3. **CREDENTIALS:** No access to host credentials
4. **SYSCALLS:** Filter dangerous system calls
5. **RESOURCES:** Limit CPU, memory, time

**Goal:** "Blast radius minimization" - if the agent goes wrong, damage is contained to the sandbox.

### Docker Sandbox Implementation

```dockerfile
# Dockerfile for sandboxed computer use environment
FROM ubuntu:22.04

# Install desktop environment
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    firefox \
    python3 \
    python3-pip \
    supervisor

# Security: Create non-root user
RUN useradd -m -s /bin/bash agent && \
    mkdir -p /home/agent/.vnc

# Install Python dependencies
COPY requirements.txt /tmp/
RUN pip3 install -r /tmp/requirements.txt

# Security: Drop capabilities
RUN apt-get install -y --no-install-recommends libcap2-bin && \
    setcap -r /usr/bin/python3 || true

# Copy agent code
COPY --chown=agent:agent . /app
WORKDIR /app

# Supervisor config for virtual display + VNC
COPY supervisord.conf /etc/supervisor/conf.d/

# Expose VNC port only (not desktop directly)
EXPOSE 5900

# Run as non-root
USER agent

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### Docker Compose with Security Constraints

```yaml
version: '3.8'

services:
  computer-use-agent:
    build: .
    ports:
      - "5900:5900"  # VNC for observation
      - "8080:8080"  # API for control

    # Security constraints
    security_opt:
      - no-new-privileges:true
      - seccomp:seccomp-profile.json

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G

    # Network isolation
    networks:
      - agent-network

    # No access to host filesystem
    volumes:
      - agent-tmp:/tmp

    # Read-only root filesystem
    read_only: true
    tmpfs:
      - /run
      - /var/run

    # Environment
    environment:
      - DISPLAY=:99
      - NO_PROXY=localhost

networks:
  agent-network:
    driver: bridge
    internal: true  # No internet by default

volumes:
  agent-tmp:
```

---

## 3. Anthropic Computer Use Integration

Official implementation using Claude's computer use capability.

**Key Capabilities:**
- screenshot: Capture current screen state
- mouse: Click, move, drag operations
- keyboard: Type text, press keys
- bash: Run shell commands
- text_editor: View and edit files

**Tool Versions:**
- computer_20251124 (Opus 4.5): Adds zoom action for detailed inspection
- computer_20250124 (All other models): Standard capabilities

**Critical Limitation:** "Some UI elements (like dropdowns and scrollbars) might be tricky for Claude to manipulate" - Anthropic docs

### Implementation

```python
from anthropic import Anthropic
from anthropic.types.beta import (
    BetaToolComputerUse20241022,
    BetaToolBash20241022,
    BetaToolTextEditor20241022,
)

class AnthropicComputerUse:
    """Official Anthropic Computer Use implementation"""

    def __init__(self):
        self.client = Anthropic()
        self.model = "claude-sonnet-4-20250514"  # Best for computer use
        self.screen_size = (1280, 800)

    def get_tools(self) -> list:
        """Define computer use tools."""
        return [
            BetaToolComputerUse20241022(
                type="computer_20241022",
                name="computer",
                display_width_px=self.screen_size[0],
                display_height_px=self.screen_size[1],
            ),
            BetaToolBash20241022(
                type="bash_20241022",
                name="bash",
            ),
            BetaToolTextEditor20241022(
                type="text_editor_20241022",
                name="str_replace_editor",
            ),
        ]
```

---

## 4. Parallel Agent Orchestration

Coordinate multiple specialized agents for comprehensive analysis and complex task execution.

### When to Use Orchestration

✅ **Good for:**
- Complex tasks requiring multiple expertise domains
- Code analysis from security, performance, and quality perspectives
- Comprehensive reviews (architecture + security + testing)
- Feature implementation needing backend + frontend + database work

❌ **Not for:**
- Simple, single-domain tasks
- Quick fixes or small changes
- Tasks where one agent suffices

### Orchestration Patterns

**Pattern 1: Comprehensive Analysis**
```
Agents: explorer-agent → [domain-agents] → synthesis

1. explorer-agent: Map codebase structure
2. security-auditor: Security posture
3. backend-specialist: API quality
4. frontend-specialist: UI/UX patterns
5. test-engineer: Test coverage
6. Synthesize all findings
```

**Pattern 2: Feature Review**
```
Agents: affected-domain-agents → test-engineer

1. Identify affected domains (backend? frontend? both?)
2. Invoke relevant domain agents
3. test-engineer verifies changes
4. Synthesize recommendations
```

**Pattern 3: Security Audit**
```
Agents: security-auditor → penetration-tester → synthesis

1. security-auditor: Configuration and code review
2. penetration-tester: Active vulnerability testing
3. Synthesize with prioritized remediation
```

### Native Agent Invocation

**Single Agent:**
```
Use the security-auditor agent to review authentication
```

**Sequential Chain:**
```
First, use the explorer-agent to discover project structure.
Then, use the backend-specialist to review API endpoints.
Finally, use the test-engineer to identify test gaps.
```

**With Context Passing:**
```
Use the frontend-specialist to analyze React components.
Based on those findings, have the test-engineer generate component tests.
```

### Synthesis Protocol

After all agents complete:

```markdown
## Orchestration Synthesis

### Task Summary
[What was accomplished]

### Agent Contributions
| Agent | Finding |
|-------|---------|
| security-auditor | Found X |
| backend-specialist | Identified Y |

### Consolidated Recommendations
1. **Critical**: [Issue from Agent A]
2. **Important**: [Issue from Agent B]
3. **Nice-to-have**: [Enhancement from Agent C]

### Action Items
- [ ] Fix critical security issue
- [ ] Refactor API endpoint
- [ ] Add missing tests
```

---

## 5. Browser Automation

### Browser Tool Pattern

```python
class BrowserTool:
    """
    Browser automation for agents using Playwright.
    Enables visual debugging and web testing.
    """

    def __init__(self, headless: bool = True):
        self.browser = None
        self.page = None
        self.headless = headless

    async def open_url(self, url: str):
        """Navigate to URL and return page info"""
        if not self.browser:
            self.browser = await playwright.chromium.launch(headless=self.headless)
            self.page = await self.browser.new_page()

        await self.page.goto(url)
        screenshot = await self.page.screenshot(type='png')
        title = await self.page.title()

        return {
            "success": True,
            "output": f"Loaded: {title}",
            "screenshot": base64.b64encode(screenshot).decode(),
            "url": self.page.url
        }

    async def click(self, selector: str):
        """Click on an element"""
        try:
            await self.page.click(selector, timeout=5000)
            await self.page.wait_for_load_state("networkidle")
            screenshot = await self.page.screenshot()
            return {"success": True, "screenshot": base64.b64encode(screenshot).decode()}
        except TimeoutError:
            return {"success": False, "error": f"Element not found: {selector}"}
```

### Visual Agent Pattern

```python
class VisualAgent:
    """
    Agent that uses screenshots to understand web pages.
    Can identify elements visually without selectors.
    """

    def __init__(self, llm, browser):
        self.llm = llm
        self.browser = browser

    async def describe_page(self) -> str:
        """Use vision model to describe current page"""
        screenshot = await self.browser.screenshot()

        response = self.llm.chat([
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this webpage. List all interactive elements."},
                    {"type": "image", "data": screenshot}
                ]
            }
        ])

        return response.content

    async def find_and_click(self, description: str):
        """Find element by visual description and click it"""
        screenshot = await self.browser.screenshot()

        response = self.llm.chat([
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"""Find the element matching: "{description}"
                        Return coordinates as JSON: {{"x": number, "y": number}}"""
                    },
                    {"type": "image", "data": screenshot}
                ]
            }
        ])

        coords = json.loads(response.content)
        await self.browser.page.mouse.click(coords["x"], coords["y"])

        return {"success": True, "output": f"Clicked at ({coords['x']}, {coords['y']})"}
```

---

## Common Mistakes

- ❌ Running computer-use agents on main system without sandboxing - CRITICAL security risk
- ❌ Not implementing resource limits - agents can consume unlimited CPU/memory
- ❌ Allowing unrestricted network access - potential data exfiltration
- ❌ Trusting vision model outputs without validation - UI elements can be misidentified
- ❌ Missing human-like variance in actions - creates detectable bot patterns
- ❌ Not monitoring costs - vision API calls are expensive at scale
- ❌ Orchestrating too many agents for simple tasks - adds unnecessary complexity
- ❌ Parallel agents without proper context passing - duplicate work and inconsistent results

---

## Best Practices

- ✅ ALWAYS use Docker containers with security constraints for computer-use agents
- ✅ Implement defense in depth - multiple layers of security controls
- ✅ Add human-like variance to mouse movements and typing speed
- ✅ Use keyboard alternatives when possible (more reliable than clicking)
- ✅ Implement context management to avoid token limit issues
- ✅ Monitor and limit costs with hard caps and usage tracking
- ✅ Accept the tradeoff: some UI elements will be difficult for vision models
- ✅ Use logical agent ordering: Discovery → Analysis → Implementation → Testing
- ✅ Share context between agents to avoid duplicate analysis
- ✅ Create single synthesis report combining all agent findings
- ✅ Include test-engineer when orchestrating code modification agents
- ✅ Resume agents when continuing previous work instead of starting fresh
- ✅ For long-running multi-agent orchestrations that must survive crashes, consider [Temporal](https://github.com/temporalio/temporal) for durable execution — each agent step becomes a workflow activity with automatic retries, timeouts, and crash recovery. Use for production pipelines; skip for ad-hoc or short-lived agent tasks.

---

## Key Benefits

**Computer Use Agents:**
- Full desktop control beyond browser automation
- Vision-based understanding of any GUI
- Ability to interact with legacy or custom applications
- Handles dynamic UIs without brittle selectors

**Parallel Agent Orchestration:**
- Single session with shared context across agents
- AI-controlled coordination (Claude orchestrates autonomously)
- Native integration with Claude Code's built-in agents
- Resume support for continuing previous agent work
- Context passing ensures findings flow between agents

---

*Consolidated from: computer-use-agents, parallel-agents*
*Word count: ~1950*
