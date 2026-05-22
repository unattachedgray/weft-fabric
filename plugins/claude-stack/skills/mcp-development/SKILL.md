---
name: MCP Development
description: Build and integrate MCP servers for Claude Code. Use when creating MCP servers (Python/TypeScript), designing tools, configuring integrations, or setting up external service connections. Covers server development, tool design, testing, and deployment.
version: 1.0.1
---

# MCP Development

## Overview

Build Model Context Protocol (MCP) servers that enable Claude to interact with external services through well-designed tools.

**Use this skill when:**
- Building MCP servers in Python or TypeScript
- Designing tools for AI agent workflows
- Integrating MCP servers into Claude Code
- Configuring authentication and security
- Testing and validating implementations

**Core capabilities:**
- Server development (Python FastMCP, TypeScript SDK)
- Agent-centric tool design
- Configuration and deployment
- Authentication patterns (OAuth, tokens, environment variables)
- Performance optimization and security

---

## Server Development

### Design Principles

**Build for Workflows, Not API Endpoints:**
- Design tools for complete tasks, not just API wrappers
- Consolidate related operations (e.g., `schedule_event` checks availability + creates event)
- Focus on what agents actually need to accomplish

**Optimize for Limited Context:**
- Agents have constrained context windows - make every token count
- Return high-signal information, not exhaustive dumps
- Provide "concise" vs "detailed" response options
- Use human-readable names over technical IDs

**Design Actionable Error Messages:**
- Guide agents toward correct usage: "Try using filter='active_only' to reduce results"
- Make errors educational, not just diagnostic
- Suggest specific next steps

**Follow Natural Task Subdivisions:**
- Tool names reflect how humans think about tasks
- Group related tools with consistent prefixes
- Design around workflows, not just API structure

**Use Evaluation-Driven Development:**
- Create realistic evaluation scenarios early
- Let agent feedback drive improvements
- Prototype quickly, iterate based on performance

### Tool Design

**Input Schema:**
- Use Pydantic (Python) or Zod (TypeScript) for validation
- Include proper constraints (min/max length, ranges, patterns)
- Provide clear field descriptions with examples
- Make required vs optional parameters obvious

**Documentation:**
- One-line summary of tool purpose
- Detailed explanation of functionality
- Explicit parameter types with examples
- Complete return type schema
- Usage examples (when to use, when not to use)
- Error handling guidance

**Implementation:**
- Use async/await for all I/O operations
- Implement proper error handling
- Support multiple response formats (JSON, Markdown)
- Respect pagination parameters
- Enforce character limits and truncate appropriately
- Share common logic across tools (DRY principle)

**Annotations:**
- `readOnlyHint: true` for read-only operations
- `destructiveHint: false` for non-destructive operations
- `idempotentHint: true` if repeated calls have same effect
- `openWorldHint: true` for external system interactions

### Python Implementation

**Setup:**
```python
from mcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("my-server")
```

**Define Input Models:**
```python
class SearchInput(BaseModel):
    query: str = Field(description="Search query", min_length=1)
    limit: int = Field(default=10, ge=1, le=100)
    format: str = Field(default="json", pattern="^(json|markdown)$")
```

**Register Tools:**
```python
@mcp.tool(
    name="search_items",
    description="Search for items matching query",
    readOnlyHint=True
)
async def search_items(query: str, limit: int = 10) -> str:
    """Search for items matching the query.
    
    Args:
        query: Search query string
        limit: Maximum results (1-100)
    
    Returns:
        JSON string with results
    """
    # Implementation
    pass
```

**Best Practices:**
- Pydantic v2 with `model_config`
- Type hints throughout
- Module-level constants (CHARACTER_LIMIT, API_BASE_URL)
- Shared utility functions
- Proper error handling with try/except

### TypeScript Implementation

**Setup:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

const server = new Server({
  name: "my-server",
  version: "1.0.0"
});
```

**Define Schemas:**
```typescript
const SearchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
  format: z.enum(["json", "markdown"]).default("json")
}).strict();

type SearchInput = z.infer<typeof SearchInputSchema>;
```

**Register Tools:**
```typescript
server.registerTool({
  name: "search_items",
  description: "Search for items matching query",
  inputSchema: SearchInputSchema,
  readOnlyHint: true,
  handler: async (input: SearchInput): Promise<string> => {
    // Implementation
  }
});
```

**Best Practices:**
- Use `.strict()` on Zod schemas
- TypeScript strict mode enabled
- No `any` types - use proper types
- Explicit `Promise<T>` return types
- Build process configured

### Testing and Validation

**Important:** MCP servers are long-running processes. Running them directly will hang your process.

**Safe Testing:**
1. Use evaluation harness (recommended)
2. Run in tmux/screen
3. Use timeout: `timeout 5s python server.py`

**Python Validation:**
```bash
python -m py_compile server.py  # Verify syntax
```

**TypeScript Validation:**
```bash
npm run build  # Build and verify
ls dist/index.js  # Check output exists
```

**Quality Checklist:**
- [ ] Comprehensive docstrings for all tools
- [ ] Input validation using Pydantic/Zod
- [ ] Error handling on all external calls
- [ ] Consistent response formats
- [ ] Character limits enforced
- [ ] Pagination implemented
- [ ] Full type coverage
- [ ] No code duplication
- [ ] Tool annotations set correctly

---

## Server Integration

### Configuration Methods

**Method 1: Dedicated .mcp.json (Recommended)**

Create `.mcp.json` at plugin root:

```json
{
  "database-tools": {
    "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
    "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
    "env": {
      "DB_URL": "${DB_URL}"
    }
  }
}
```

Benefits: Clear separation, easier maintenance, better for multiple servers

**Method 2: Inline in plugin.json**

Add `mcpServers` field:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server"
    }
  }
}
```

Benefits: Single configuration file, good for simple plugins

### Server Types

**stdio (Local Process)**

Execute local MCP servers as child processes.

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  }
}
```

Use cases: File system access, local database connections, custom servers, NPM packages

**SSE (Server-Sent Events)**

Connect to hosted MCP servers with OAuth support.

```json
{
  "asana": {
    "type": "sse",
    "url": "https://mcp.asana.com/sse"
  }
}
```

Use cases: Official hosted servers, cloud services, OAuth authentication, no local installation

**HTTP (REST API)**

Connect to RESTful MCP servers with token authentication.

```json
{
  "api-service": {
    "type": "http",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}"
    }
  }
}
```

Use cases: REST API-based servers, token auth, custom backends, stateless interactions

**WebSocket (Real-time)**

Connect for real-time bidirectional communication.

```json
{
  "realtime-service": {
    "type": "ws",
    "url": "wss://mcp.example.com/ws",
    "headers": {
      "Authorization": "Bearer ${TOKEN}"
    }
  }
}
```

Use cases: Real-time streaming, persistent connections, push notifications, low-latency

### Authentication Patterns

**OAuth (SSE/HTTP)**

Handled automatically by Claude Code. User authenticates in browser on first use.

**Token-Based (Headers)**

Static or environment variable tokens:

```json
{
  "type": "http",
  "url": "https://api.example.com",
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

Document required environment variables in README.

**Environment Variables (stdio)**

Pass configuration to server:

```json
{
  "command": "python",
  "args": ["-m", "my_mcp_server"],
  "env": {
    "DATABASE_URL": "${DB_URL}",
    "API_KEY": "${API_KEY}"
  }
}
```

### Environment Variable Expansion

**${CLAUDE_PLUGIN_ROOT}** - Always use for portable paths:

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/servers/my-server"
}
```

**User environment variables** - From user's shell:

```json
{
  "env": {
    "API_KEY": "${MY_API_KEY}"
  }
}
```

Best practice: Document all required environment variables in README.

### Tool Naming

MCP tools are automatically prefixed:

**Format:** `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`

**Example:**
- Plugin: `asana`, Server: `asana`, Tool: `create_task`
- Full name: `mcp__plugin_asana_asana__asana_create_task`

**Pre-allow specific tools:**

```markdown
---
allowed-tools: [
  "mcp__plugin_asana_asana__asana_create_task"
]
---
```

Best practice: Pre-allow specific tools, not wildcards, for security.

### Lifecycle Management

**Automatic startup:**
1. Plugin loads
2. MCP configuration parsed
3. Server process started or connection established
4. Tools discovered and registered
5. Tools available as `mcp__plugin_...__...`

Restart required for configuration changes.

**Viewing servers:** Use `/mcp` command to see all servers.

---

## Best Practices

### Security

**Use HTTPS/WSS:**

```json
✅ "url": "https://mcp.example.com/sse"
❌ "url": "http://mcp.example.com/sse"
```

**Token Management:**

DO:
- ✅ Use environment variables for tokens
- ✅ Document required env vars
- ✅ Let OAuth flow handle authentication

DON'T:
- ❌ Hardcode tokens
- ❌ Commit tokens to git
- ❌ Share tokens in docs

**Permission Scoping:**

```markdown
✅ allowed-tools: ["mcp__plugin_api_server__read_data"]
❌ allowed-tools: ["mcp__plugin_api_server__*"]
```

**Data Validation:**
- Validate all inputs with Pydantic/Zod
- Sanitize user-provided data
- Use parameterized queries
- Apply rate limiting

### Performance

**Lazy Loading:**
- Servers connect on-demand
- First tool use triggers connection

**Batching:**

```python
# Good: Single query with filters
tasks = search_tasks(project="X", limit=50)

# Avoid: Many individual queries
for id in task_ids:
    task = get_task(id)
```

**Caching:**
- Cache frequently-accessed data
- Implement appropriate TTLs
- Clear cache on mutations

**Response Size:**
- Enforce character limits (e.g., 25,000 tokens)
- Provide pagination
- Offer concise vs detailed modes
- Truncate with clear indicators

### Error Handling

**Connection Failures:**
- Provide fallback behavior
- Inform user of issues
- Implement retry logic with exponential backoff

**Tool Call Errors:**
- Validate inputs before calling
- Provide clear, actionable error messages
- Check rate limiting and quotas

**Error Message Guidelines:**
```python
# Good: Actionable guidance
"Invalid date format. Use ISO 8601 (YYYY-MM-DD). Example: 2024-01-31"

# Bad: Generic error
"Invalid date"
```

---

## Development Workflow

1. **Research:**
   - Study MCP protocol: https://modelcontextprotocol.io/llms-full.txt
   - Review target API documentation
   - Identify key workflows
   - Plan tool selection

2. **Design:**
   - Design tool interfaces
   - Plan input/output formats
   - Design error handling
   - Create evaluation questions

3. **Implementation:**
   - Set up project structure
   - Implement shared utilities
   - Build tools systematically
   - Follow language best practices

4. **Testing:**
   - Validate syntax and builds
   - Create evaluation scenarios
   - Test with real workflows
   - Iterate based on feedback

5. **Integration:**
   - Create MCP configuration
   - Set up authentication
   - Test in Claude Code
   - Document setup

6. **Deployment:**
   - Package for distribution
   - Publish documentation
   - Monitor usage and errors
   - Iterate based on feedback

---

## Quick Reference

### Server Types

| Type | Transport | Best For | Auth |
|------|-----------|----------|------|
| stdio | Process | Local tools, custom servers | Env vars |
| SSE | HTTP | Hosted services, cloud APIs | OAuth |
| HTTP | REST | API backends, token auth | Tokens |
| ws | WebSocket | Real-time, streaming | Tokens |

### Configuration Checklist

- [ ] Server type specified
- [ ] Type-specific fields complete
- [ ] Authentication configured
- [ ] Environment variables documented
- [ ] HTTPS/WSS used
- [ ] ${CLAUDE_PLUGIN_ROOT} used for paths

### Implementation Checklist

- [ ] Tools designed for complete workflows
- [ ] Input validation with Pydantic/Zod
- [ ] Async/await for all I/O
- [ ] Error messages are actionable
- [ ] Response formats configurable
- [ ] Character limits enforced
- [ ] Pagination implemented
- [ ] Tool annotations set
- [ ] Comprehensive documentation
- [ ] Evaluation scenarios created

---

## Resources

**Official Documentation:**
- MCP Protocol: https://modelcontextprotocol.io/
- Python SDK: https://github.com/modelcontextprotocol/python-sdk
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude Code MCP: https://docs.claude.com/en/docs/claude-code/mcp

**Development Tools:**
- Use `claude --debug` for debugging
- Use `/mcp` command to view servers
- Test with evaluation harness
- Monitor logs for issues
