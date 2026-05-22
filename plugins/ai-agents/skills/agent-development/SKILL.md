---
name: agent-development
description: Comprehensive guide to building autonomous AI agents with architecture, tool integration, memory systems, and production-ready development workflows
---

# Agent Development

Comprehensive guide to building autonomous AI agents with best practices covering agent architecture, autonomous patterns, tool integration, and production-ready development workflows.

## When to Use This Skill

- Building autonomous AI agents that operate independently
- Designing multi-agent systems with coordination
- Implementing agent memory and state management
- Creating agents with tool use and decision-making capabilities
- Architecting robust agent frameworks for Claude Code plugins
- Developing agents with ReAct loops, planning strategies, and self-correction

## Quick Reference

**Core Agent Architecture:**
- Agents are FOR autonomous work, commands are FOR user-initiated actions
- Markdown file format with YAML frontmatter
- Triggering via description field with concrete examples
- System prompt defines agent behavior and responsibilities
- ReAct loop: Reason → Act → Observe → Repeat
- Plan-Execute pattern: Separate planning from execution

**Essential Components:**
- Tool registry with schema and examples
- Permission and approval systems
- Sandboxed execution environments
- Context management and checkpoint/resume
- Error handling and graceful degradation

---

## 1. Agent File Structure

### Complete Agent Format

```markdown
---
name: agent-identifier
description: Use this agent when [triggering conditions]. Examples:

<example>
Context: [Situation description]
user: "[User request]"
assistant: "[How assistant should respond and use this agent]"
<commentary>
[Why this agent should be triggered]
</commentary>
</example>

model: inherit
color: blue
tools: ["Read", "Write", "Grep"]
---

You are [agent role description]...

**Your Core Responsibilities:**
1. [Responsibility 1]
2. [Responsibility 2]

**Analysis Process:**
1. [Step one]
2. [Step two]

**Output Format:**
[What to return]
```

### Frontmatter Fields

**name (required):** Agent identifier, 3-50 chars, lowercase-hyphens only
- Good: `code-reviewer`, `test-generator`, `api-docs-writer`
- Bad: `helper` (too generic), `-agent-` (starts with hyphen), `my_agent` (underscores)

**description (required):** MOST CRITICAL FIELD - defines when Claude triggers this agent
- Must include triggering conditions ("Use this agent when...")
- Include 2-4 concrete `<example>` blocks showing usage
- Each example needs context, user request, assistant response, and `<commentary>`

**model (required):** Usually `inherit` (recommended), or `sonnet`, `opus`, `haiku`

**color (required):** Visual identifier - `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`
- Blue/cyan: Analysis, review
- Green: Success-oriented tasks
- Yellow: Caution, validation
- Red: Critical, security
- Magenta: Creative, generation

**tools (optional):** Restrict to specific tools (principle of least privilege)
- Read-only analysis: `["Read", "Grep", "Glob"]`
- Code generation: `["Read", "Write", "Grep"]`
- Testing: `["Read", "Bash", "Grep"]`

---

## 2. Core Agent Patterns

### ReAct Agent Loop

Alternating reasoning and action steps with observation feedback:

```python
class AgentLoop:
    def __init__(self, llm, tools, max_iterations=50):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.max_iterations = max_iterations
        self.history = []

    def run(self, task: str) -> str:
        self.history.append({"role": "user", "content": task})

        for i in range(self.max_iterations):
            # Think: Get LLM response with tool options
            response = self.llm.chat(
                messages=self.history,
                tools=self._format_tools(),
                tool_choice="auto"
            )

            # Decide: Check if agent wants to use a tool
            if response.tool_calls:
                for tool_call in response.tool_calls:
                    # Act: Execute the tool
                    result = self._execute_tool(tool_call)

                    # Observe: Add result to history
                    self.history.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": str(result)
                    })
            else:
                # No more tool calls = task complete
                return response.content

        return "Max iterations reached"
```

**Critical insight:** A 95% success rate per step drops to 60% by step 10 due to compounding errors. Keep agent loops short and focused.

### Plan-Execute Pattern

Separate planning phase from execution for complex tasks:

```python
class PlanExecuteAgent:
    def __init__(self, planner_model, executor_model):
        self.planner = planner_model  # Use fast model for planning
        self.executor = executor_model  # Use powerful model for execution

    def run(self, task: str):
        # Planning phase: decompose task into steps
        plan = self.planner.generate_plan(task)

        # Execution phase: execute each step
        results = []
        for step in plan.steps:
            result = self.executor.execute_step(step)
            results.append(result)

            # Replanning: adjust plan based on results
            if result.needs_replanning:
                plan = self.planner.replan(plan, results)

        return self.synthesize_results(results)
```

### Tool Registry Pattern

Dynamic tool discovery and management:

```python
class Tool:
    """Base class for agent tools"""

    @property
    def schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self._get_parameters(),
                "required": self._get_required()
            }
        }

    def execute(self, **kwargs) -> ToolResult:
        raise NotImplementedError
```

**Essential Agent Tools:**
- File operations: read_file, write_file, edit_file, list_directory
- Code understanding: search_code, get_definition, get_references
- Terminal: run_command, read_output, send_input
- Context: ask_user, search_web

---

## 3. System Prompt Design

The markdown body becomes the agent's system prompt. Write in second person, addressing the agent directly.

### Standard Template

```markdown
You are [role] specializing in [domain].

**Your Core Responsibilities:**
1. [Primary responsibility]
2. [Secondary responsibility]
3. [Additional responsibilities...]

**Analysis Process:**
1. [Step one - be specific]
2. [Step two - define outputs]
3. [Step three - handle edge cases]

**Quality Standards:**
- [Standard 1 - measurable criteria]
- [Standard 2 - error handling requirements]

**Output Format:**
Provide results in this format:
- [What to include]
- [How to structure]

**Edge Cases:**
Handle these situations:
- [Edge case 1]: [How to handle]
- [Edge case 2]: [How to handle]
```

### Best Practices

✅ **DO:**
- Write in second person ("You are...", "You will...")
- Be specific about responsibilities and success criteria
- Provide step-by-step process with clear outputs
- Define output format explicitly
- Include quality standards and validation steps
- Address edge cases and error handling
- Keep under 10,000 characters (optimal: 500-3,000)

❌ **DON'T:**
- Write in first person ("I am...", "I will...")
- Be vague or generic ("handle things appropriately")
- Omit process steps or skip error cases
- Leave output format undefined
- Grant unnecessary tool access

---

## 4. Permission & Safety Patterns

### Permission Levels

```python
class PermissionLevel(Enum):
    AUTO = "auto"           # Fully automatic - no approval needed
    ASK_ONCE = "ask_once"   # Ask once per session
    ASK_EACH = "ask_each"   # Ask every time
    NEVER = "never"         # Never allow

PERMISSION_CONFIG = {
    # Low risk - can auto-approve
    "read_file": PermissionLevel.AUTO,
    "list_directory": PermissionLevel.AUTO,
    "search_code": PermissionLevel.AUTO,

    # Medium risk - ask once
    "write_file": PermissionLevel.ASK_ONCE,
    "edit_file": PermissionLevel.ASK_ONCE,

    # High risk - ask each time
    "run_command": PermissionLevel.ASK_EACH,
    "delete_file": PermissionLevel.ASK_EACH,

    # Dangerous - never auto-approve
    "sudo_command": PermissionLevel.NEVER,
}
```

### Sandboxed Execution

```python
class SandboxedExecution:
    def __init__(self, workspace_dir: str):
        self.workspace = workspace_dir
        self.allowed_commands = ["npm", "python", "node", "git"]
        self.blocked_paths = ["/etc", "/usr", "/bin"]

    def validate_path(self, path: str) -> bool:
        """Ensure path is within workspace"""
        real_path = os.path.realpath(path)
        workspace_real = os.path.realpath(self.workspace)
        return real_path.startswith(workspace_real)

    def validate_command(self, command: str) -> bool:
        """Check if command is allowed"""
        cmd_parts = shlex.split(command)
        base_cmd = cmd_parts[0]
        return base_cmd in self.allowed_commands
```

---

## 5. Context Management

### Context Injection Pattern

```python
class ContextManager:
    """Manage context provided to the agent"""

    def add_file(self, path: str) -> None:
        """@file - Add file contents to context"""
        with open(path, 'r') as f:
            self.context.append({
                "type": "file",
                "path": path,
                "content": f.read()
            })

    def add_folder(self, path: str, max_files: int = 20) -> None:
        """@folder - Add all files in folder"""
        for root, dirs, files in os.walk(path):
            for file in files[:max_files]:
                self.add_file(os.path.join(root, file))

    def format_for_prompt(self) -> str:
        """Format all context for LLM prompt"""
        parts = []
        for item in self.context:
            if item["type"] == "file":
                parts.append(f"## File: {item['path']}\n```\n{item['content']}\n```")
        return "\n\n".join(parts)
```

### Checkpoint/Resume Pattern

```python
class CheckpointManager:
    """Save and restore agent state for long-running tasks"""

    def save_checkpoint(self, session_id: str, state: dict) -> str:
        checkpoint = {
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id,
            "history": state["history"],
            "context": state["context"],
            "metadata": state.get("metadata", {})
        }
        path = os.path.join(self.storage_dir, f"{session_id}.json")
        with open(path, 'w') as f:
            json.dump(checkpoint, f, indent=2)
        return path

    def restore_checkpoint(self, checkpoint_path: str) -> dict:
        with open(checkpoint_path, 'r') as f:
            checkpoint = json.load(f)
        return checkpoint
```

---

## Common Mistakes

- ❌ Unbounded autonomy without iteration limits - ALWAYS set max_iterations
- ❌ Trusting agent outputs without validation - validate against ground truth
- ❌ General-purpose autonomy instead of focused tasks - narrow scope wins
- ❌ Vague or incomplete tool descriptions - write complete tool specs
- ❌ Tool errors not surfaced to agent - explicit error handling required
- ❌ Storing everything in agent memory - selective memory only
- ❌ Agent has too many tools - curate tools per task (least privilege)
- ❌ Fragile parsing of agent outputs - use structured outputs
- ❌ Not logging or tracing agent internals - implement comprehensive logging
- ❌ Generic descriptions without examples - include 2-4 concrete examples
- ❌ Skipping testing - test triggering thoroughly

---

## Best Practices

- ✅ Start simple - build basic agent loops before adding complexity
- ✅ Implement robust error handling and recovery mechanisms
- ✅ Use structured outputs for agent decisions and tool calls
- ✅ Test agents in isolated environments before production
- ✅ Monitor agent behavior and add safety constraints
- ✅ Keep agent prompts clear, focused, and testable
- ✅ Version control agent configurations and prompts
- ✅ Implement timeouts and resource limits
- ✅ Reduce step count to minimize compounding errors
- ✅ Set hard cost limits to prevent runaway spending
- ✅ Build robust API clients with retries and fallbacks
- ✅ Apply principle of least privilege for tool access
- ✅ Track context usage to avoid token limit issues
- ✅ Use guardrails before adding capabilities
- ✅ For multi-step workflows that must survive crashes (edit→test→fix loops, long-running pipelines), consider [Temporal](https://github.com/temporalio/temporal) for durable execution — workflows resume exactly where they left off after restarts. Overkill for simple agent loops; valuable when agents run minutes/hours with many steps.

---

## Implementation Workflow

To create an agent for a plugin:

1. Define agent purpose and triggering conditions
2. Choose creation method (AI-assisted or manual)
3. Create `agents/agent-name.md` file
4. Write frontmatter with all required fields
5. Write system prompt following best practices
6. Include 2-4 triggering examples in description
7. Validate with validation script
8. Test triggering with real scenarios
9. Document agent in plugin README

Focus on clear triggering conditions and comprehensive system prompts for autonomous operation.

---

*Consolidated from: agent-development, autonomous-agents, autonomous-agent-patterns, ai-agents-architect*
*Word count: ~1850*
