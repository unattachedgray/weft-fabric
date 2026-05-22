---
name: Zapier Workflows
description: Manage and orchestrate Zapier automations via MCP tools and webhook-triggered Zaps. Use when user mentions workflows, automations, running processes, research, data tracking, or specific Zapier actions. Handles both individual Zapier MCP tools and complex multi-step Zaps.
version: 1.0.0
---

# Zapier Workflows

## Overview

Zapier provides access to 8,000+ automation tools, but without context, Claude doesn't know which tools to use or when. This skill provides persistent memory for Zapier workflows, enabling smart orchestration and automation.

**Two types of Zapier automation:**

1. **MCP Tools** - Individual Zapier actions (add row, send email, etc.) available via Zapier MCP
2. **Multi-Step Zaps** - Complex workflows triggered via webhooks

**What this skill solves:**

- Remembers your MCP tool preferences
- Knows when/why to use each tool
- Triggers multi-step Zaps via webhooks
- Self-learning capability
- Cross-session persistence

---

## Setup

### Zapier MCP Configuration

Connect Zapier MCP tools to Claude Code:

1. Visit https://mcp.zapier.com/mcp/servers
2. Login to Zapier account
3. Click "New MCP Server"
4. Select "Claude Code" in MCP Client dropdown
5. Name your server (e.g., "My Zapier Tools")
6. Click "Add tools" and select Zapier actions
7. Click "Connect" and copy the command
8. Run command in terminal:
   ```bash
   claude mcp add zapier https://mcp.zapier.com/api/mcp/mcp -t http -H "Authorization: Bearer [token]"
   ```
9. Restart Claude Code

**Available tools appear as:** `mcp__zapier__[action_name]`

### Webhook-Triggered Zaps

For pre-built, optimized multi-step workflows:

1. In Zapier dashboard, create new Zap
2. Choose "Webhooks by Zapier" as trigger
3. Select "Catch Hook"
4. Copy webhook URL provided
5. Build your workflow (add actions)
6. Test and optimize
7. Document webhook URL and trigger phrases with Claude

**Webhook vs MCP:**
- **Webhooks:** Pre-built, multi-step, optimized workflows
- **MCP Tools:** Flexible, on-the-fly automation

---

## Decision Logic

### When to Use Webhooks

Use webhook-triggered Zaps when:
- Task is complex and multi-step
- User mentions specific Zap name
- Deterministic execution is critical
- Task involves 5+ API calls
- Cost/time efficiency matters

### When to Use MCP Tools

Use MCP tools when:
- Task is simple (1-3 actions)
- Flexibility needed (parameters change)
- Testing new workflow pattern
- User explicitly requests specific tools

---

## Execution Pattern

**Standard workflow:**

1. **Listen for triggers** - Workflow names, "run", "trigger", "search", "research"
2. **Check references** - Read reference files for details
3. **Check prerequisites:**
   - If MCP tools needed but unavailable, provide setup instructions
   - If tools available but undocumented, trigger discovery protocol
   - If webhook needed but missing, provide extraction instructions
4. **Execute:**
   - For webhooks: POST to webhook URL with curl
   - For MCP tools: Call appropriate Zapier MCP tool
5. **Confirm** - Tell user what happened
6. **Learn** - If corrected, update skill files
7. **Suggest saving** - Offer to save successful patterns

---

## Self-Learning Protocol

**This skill can edit itself to learn from feedback.**

When user teaches something new:

1. **Identify what to update:**
   - New Zap → Update references
   - MCP tool preference → Update patterns
   - New workflow → Update patterns

2. **Make the edit:**
   - Read file with Read tool
   - Update with Edit tool
   - Confirm change to user

3. **Example:**
   ```
   User: "Use Apollo instead of Clearbit for company data"
   Claude: [reads patterns file]
           [edits to update preference]
           "Updated! I'll use Apollo for company enrichment from now on."
   ```

**What to capture:**
- Tool preferences
- Workflow sequences
- Error handling approaches
- Data formatting requirements
- New Zaps and details

**What NOT to capture:**
- One-off requests
- Temporary context

---

## Pattern Detection & Saving

**After successful tool use, proactively suggest saving patterns.**

### When to Suggest

Look for:
- Multi-step tool sequences that worked
- Specific parameter combinations user liked
- Repeated workflows or use cases
- Tool preferences expressed during task
- Successful solutions

Suggest if:
- Used 2+ MCP tools in sequence
- User expressed satisfaction
- Seems repeatable
- User gave specific preferences

### How to Suggest

After successful completion:

```
"That worked well! I noticed I [describe workflow].

Would you like me to save this as a pattern? Tell me:
- What trigger words to listen for
- When/why to use this workflow
- Any preferences or variations

I'll remember it and do this automatically next time!"
```

### Document the Pattern

If user says yes:
1. Read patterns file
2. Edit to add new pattern with:
   - Pattern name
   - Trigger phrases
   - When/why to use
   - Step-by-step workflow
   - Parameters/preferences
   - Example
3. Confirm: "Saved! Next time you [trigger], I'll [workflow]."

**Examples worth saving:**
- Research and document (Perplexity → summarize → Google Sheets)
- Expense tracking (extract → format → add to sheet)
- Competitive analysis (search → analyze → save)
- Daily briefing (searches → synthesize → deliver)

**Don't save:**
- One-off requests
- Highly specific situations
- Simple single-tool uses (unless requested)

---

## Tool Discovery Protocol

When Zapier MCP is connected but tools aren't documented:

1. **List available tools**
2. **Prompt for documentation:**
   ```
   "I see you have these Zapier MCP tools:
   - mcp__zapier__google_sheets_create_row
   - mcp__zapier__perplexity_chat
   - [etc.]

   To use them effectively, I need to know:

   For each tool:
   1. WHEN should I use it?
      - Trigger words/phrases
      - Situations/contexts
      - Request types

   2. WHY use it vs alternatives?
      - What's it best for?
      - When NOT to use?

   3. HOW should I use it?
      - Parameters/preferences
      - Default values
      - Specifics (sheet names, formats)

   4. PATTERNS involving this tool?
      - Multi-step sequences
      - Common combinations

   The more detail, the better I can serve you!"
   ```

3. **Document in skill:**
   - Read patterns file
   - Edit to add comprehensive docs
   - Confirm to user

**Trigger discovery when:**
- First mention of Zapier/workflows after setup
- User asks "what tools do I have?"
- New tools detected but not documented

---

## Setup Detection

### If Zapier MCP Not Connected

When user requests MCP functionality but Zapier MCP unavailable:

```
"I don't see Zapier MCP connected. Setup steps:

1. Go to https://mcp.zapier.com/mcp/servers
2. Login to Zapier
3. Click 'New MCP Server'
4. Select 'Claude Code' as client
5. Name it (e.g., 'My Zapier Tools')
6. Click 'Add tools', select actions
7. Click 'Connect', copy command
8. Run in terminal:
   claude mcp add zapier https://mcp.zapier.com/api/mcp/mcp -t http -H "Authorization: Bearer [token]"
9. Restart Claude Code

Once setup, I can use those actions!"
```

### If User Wants Webhook Zap

When user wants to add webhook-triggered Zap:

```
"To get your webhook URL:

1. Go to Zap in Zapier dashboard
2. Ensure trigger is 'Webhooks by Zapier'
3. Select 'Catch Hook' as trigger event
4. Go to 'Test' tab
5. Copy 'Webhook URL'
6. Give me that URL and tell me:
   - What the Zap does (step-by-step)
   - Trigger phrases you want
   - Other details (timing, cost)

I'll add it so you can trigger anytime!"
```

---

## Usage Examples

### Triggering a Zap

```
User: "Run my daily digest"
Claude: [reads zaps reference file]
        [uses Bash to POST to webhook]
        "Started your Daily AI Digest. You'll get the email
         in ~3 minutes with SMS alerts for high-priority items."
```

### Using MCP Orchestration

```
User: "Research quantum computing"
Claude: [reads patterns file]
        [calls Perplexity MCP tool]
        [analyzes, identifies gaps]
        [calls Perplexity again for depth]
        "Here's what I found... [summary]"
```

### Learning and Updating

```
User: "Use 'Personal Budget' sheet, not 'Expenses'"
Claude: [reads patterns file]
        [edits Google Sheets section]
        "Updated! I'll use 'Personal Budget' for expense
         tracking from now on."
```

---

## Security Warning

**Webhook URLs contain authentication tokens.**

If someone has your webhook URL, they can trigger your Zaps.

**Best practices:**
- Install globally at `~/.claude/skills/` (not in project repos)
- Add `.claude/` to `.gitignore` if in project
- Never commit webhook URLs to public repos
- Regenerate URLs if exposed
- Use Zapier's webhook authentication when available

**Sharing this skill:**
- Remove real webhook URLs first
- Replace with placeholder examples
- Or use separate URLs for sharing/testing

---

## Troubleshooting

### Zapier MCP Not Detected

**Check if connected:**
- Look for `mcp__zapier__*` tools
- Ask: "What Zapier tools do I have?"

**If not showing:**
1. Verify connection command was run
2. Restart Claude Code completely
3. Check Claude Code MCP settings
4. Verify authorization token

### Claude Not Suggesting Patterns

**Triggers when:**
- Using 2+ MCP tools in sequence
- Task completes successfully
- Seems repeatable

**Explicitly ask:**
- "Can you save this as a pattern?"
- "Remember this workflow"

### Webhook Not Triggering

**Common issues:**
1. Wrong URL - check you copied full URL from Test tab
2. Zap not enabled - turn on in dashboard
3. Wrong trigger - must be "Webhooks by Zapier" → "Catch Hook"
4. Network/firewall - test curl from terminal first

**Test manually:**
```bash
curl -X POST https://hooks.zapier.com/hooks/catch/[your-url]
```

### Claude Keeps Asking About Documented Tools

**Likely causes:**
- Tools documented but file not saved
- Different Claude Code instance
- Skill installed at project level, not global

**Fix:**
1. Check patterns file has your tools
2. Verify location: `~/.claude/skills/` (global) vs `./.claude/skills/` (project)
3. Copy to global for cross-project persistence

### How to Know Skill is Working

**Signs:**
1. Claude mentions checking references
2. Claude asks detailed WHEN/WHY/HOW questions
3. Suggests saving patterns after tool use
4. Successfully triggers webhooks

**Quick test:**
1. Ask: "What Zapier tools do I have?"
2. Add fake webhook, tell Claude
3. Check if added to references file

### Skill Files Too Large

**If references grow too large:**
- Remove outdated/unused patterns
- Consolidate similar workflows
- Keep only actively-used tools
- Consider splitting by domain

**Performance tips:**
- Keep trigger phrases concise
- Avoid documenting one-offs
- Use pattern categories

### Reset to Template

**Start fresh:**
1. Backup current files (if keeping anything)
2. Delete skill directory
3. Re-clone from source
4. Copy to `~/.claude/skills/`

### Use Without Zapier MCP

**Yes!** Works with:
- Only webhooks (trigger Zaps without MCP)
- Only MCP tools (document usage without webhooks)
- Both (full functionality)

Each mode is independent and valuable.

### Security: Accidentally Committed URLs

**Immediate actions:**
1. Remove from git history (git rebase, BFG)
2. Regenerate URLs in Zapier:
   - Edit Zap
   - Delete and re-add webhook trigger
   - Get new URL
3. Update skill files
4. Add `.claude/` to `.gitignore`

**Prevention:**
- Install globally (`~/.claude/skills/`)
- Never commit `.claude/` in projects
- Use placeholders in shared examples

---

## Quick Reference

**Installation:**
- Global: `~/.claude/skills/zapier-workflows/`
- Project: `./.claude/skills/zapier-workflows/`

**Tools Used:**
- Read - View reference files
- Edit - Update skill with new patterns
- Bash - Trigger webhooks with curl
- MCP Tools - Call Zapier actions

**Reference Files:**
- `references/zaps.md` - Webhook-triggered Zaps
- `references/mcp-patterns.md` - MCP tool patterns and preferences

**Key Behaviors:**
1. Always read references before executing
2. Suggest saving successful patterns
3. Proactively ask for tool documentation
4. Update skill files when learning
5. Provide setup instructions when needed

---

## Important Notes

- Webhooks don't need payloads - Zaps get data from Zapier Tables
- Always read reference files before executing
- Update skill files when learning - don't just remember for this conversation
- Document new tools thoroughly (WHEN/WHY/HOW)
- Suggest pattern saving after successful multi-tool workflows
