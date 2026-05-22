---
name: agent-manager-skill
description: Use when managing multiple local CLI agents via tmux sessions, scheduling recurring agent work with cron, or monitoring parallel agent execution. Specific to the agent-manager-skill toolkit for orchestrating agent teams.
---

# Agent Manager Skill

## Overview

Manage multiple local CLI agents in parallel using tmux sessions with cron-friendly scheduling. This skill is specific to the `agent-manager-skill` toolkit for orchestrating agent teams via command-line interface.

## When to Use

Use this skill when you need to:
- Run multiple local CLI agents in parallel (separate tmux sessions)
- Start/stop agents and tail their logs
- Assign tasks to agents and monitor output
- Schedule recurring agent work (cron)

**When NOT to use:**
- For general multi-agent coordination (use team spawning features)
- For web-based agent orchestration
- For single-agent tasks

## Prerequisites

Install `agent-manager-skill` in your workspace:

```bash
git clone https://github.com/fractalmind-ai/agent-manager-skill.git
```

**Requirements:**
- `tmux` installed
- `python3` installed
- Agents configured under `agents/` directory (see repo for examples)

## Quick Reference

| Command | Purpose |
|---------|---------|
| `python3 agent-manager/scripts/main.py doctor` | Check system health and dependencies |
| `python3 agent-manager/scripts/main.py list` | List all configured agents |
| `python3 agent-manager/scripts/main.py start EMP_0001` | Start specific agent in tmux session |
| `python3 agent-manager/scripts/main.py monitor EMP_0001 --follow` | Monitor agent logs in real-time |
| `python3 agent-manager/scripts/main.py assign EMP_0002 <<'EOF'` | Assign task to agent with heredoc |

## Implementation

### Starting an Agent

```bash
python3 agent-manager/scripts/main.py start EMP_0001
```

Starts the agent `EMP_0001` in a detached tmux session.

### Monitoring Output

```bash
python3 agent-manager/scripts/main.py monitor EMP_0001 --follow
```

Tails the log file for `EMP_0001`. Use `--follow` for real-time updates.

### Assigning Tasks

```bash
python3 agent-manager/scripts/main.py assign EMP_0002 <<'EOF'
Follow teams/fractalmind-ai-maintenance.md Workflow
EOF
```

Sends task to agent via heredoc for multi-line instructions.

### Scheduling with Cron

Add to crontab for recurring tasks:

```bash
0 9 * * 1 python3 /path/to/agent-manager/scripts/main.py assign EMP_0001 "Weekly maintenance task"
```

Runs every Monday at 9 AM.

## Configuration

Agents are configured in `agents/` directory. Each agent requires:
- Agent ID (e.g., `EMP_0001`)
- Configuration file defining capabilities
- Working directory

See the `agent-manager-skill` repository for configuration examples.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Starting agent without tmux installed | Run `apt install tmux` or `brew install tmux` |
| Agent ID not found | Check `agent-manager/scripts/main.py list` for valid IDs |
| Logs not appearing | Verify log directory exists and agent has write permissions |
| Cron job fails silently | Use absolute paths in crontab, check cron logs |
| Multiple agents conflict | Use unique agent IDs and separate working directories |

## Architecture Notes

- Each agent runs in isolated tmux session
- Logs written to dedicated files per agent
- Task assignment via file-based queue or direct stdin
- Supports both interactive and non-interactive (cron) modes

## Troubleshooting

**Agent won't start:**
```bash
python3 agent-manager/scripts/main.py doctor
```

**Can't find tmux session:**
```bash
tmux ls
```

**Logs not updating:**
Check permissions on log directory and verify agent is actually running in tmux session.

## The Bottom Line

`agent-manager-skill` is a CLI toolkit for orchestrating multiple local agents via tmux. Use it for parallel agent execution, scheduled work, and monitoring distributed agent teams from the command line.
