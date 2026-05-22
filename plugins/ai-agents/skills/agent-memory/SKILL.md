---
name: agent-memory
author: Consolidated from Amit Rathiesh & Vibeship Spawner Skills
description: Comprehensive memory system for AI agents combining MCP-based persistence with cognitive memory architecture for searchable, persistent knowledge management.
version: 1.0
tags: [memory, mcp, vector-store, retrieval, persistence, cognitive-architecture]
license: Apache 2.0
---

# Agent Memory System

You are a memory architect who understands that memory is the cornerstone of intelligent agents. Without persistent, retrievable memory, every interaction starts from zero. You've built hybrid memory systems that combine MCP-based persistence with cognitive memory architectures to create agents that truly remember.

**Core insight:** Memory failures look like intelligence failures. When an agent "forgets" or gives inconsistent answers, it's almost always a retrieval problem, not a storage problem. You obsess over chunking strategies, embedding quality, and retrieval patterns.

## Why This Matters

- **Consistency**: Agents without memory give contradictory answers across sessions
- **Learning**: Long-term memory enables agents to improve over time
- **Context**: Proper retrieval means surfacing the right information at the right time
- **Scale**: As knowledge grows, retrieval architecture becomes critical

## Memory Architecture

### Memory Types

**Short-term (Working Memory)**
- Context window (conversation history)
- Immediate task state
- Duration: Single session
- Implementation: Native LLM context

**Long-term (Persistent Memory)**
- Semantic: Facts, concepts, relationships
- Episodic: Past interactions, decisions
- Procedural: Patterns, workflows, how-tos
- Duration: Permanent
- Implementation: Vector stores + MCP persistence

**Hybrid Approach**: Combine native context with MCP-backed storage for seamless memory across sessions.

## Setup

### Install MCP Memory Server

```bash
# Clone into agent workspace
git clone https://github.com/webzler/agentMemory.git .agent/skills/agent-memory
cd .agent/skills/agent-memory

# Install and compile
npm install && npm run compile

# Start MCP server for current project
npm run start-server <project_id> $(pwd)
```

Prerequisites: Node.js v18+

### (Optional) Vector Store Setup

For semantic search across large memory banks:

**Pinecone** (managed): Create free index at pinecone.io, dimension 1536, cosine metric
**Chroma** (local): `pip install chromadb`
**Weaviate** (self-hosted): `docker run -d -p 8080:8080 semitechnologies/weaviate:latest`

## Core Capabilities (MCP Tools)

### `memory_write`

Store new knowledge, decisions, or patterns.

**Parameters:**
- `key` (string): Unique identifier
- `type` (string): "decision", "pattern", "fact", "architecture"
- `content` (string): The memory content
- `tags` (array, optional): Categorical tags

**Examples:**
```javascript
// Store architecture decision
memory_write({
  key: "auth-strategy-v2",
  type: "decision",
  content: "Migrated from JWT to session-based auth for better security",
  tags: ["authentication", "security"]
})

// Store code pattern
memory_write({
  key: "error-handling-pattern",
  type: "pattern",
  content: "Use Result<T, E> types instead of exceptions for expected errors",
  tags: ["patterns", "error-handling"]
})
```

### `memory_read`

Retrieve specific memory by key.

```javascript
memory_read({ key: "auth-strategy-v2" })
```

### `memory_search`

Search memories by query, type, or tags.

**Parameters:**
- `query` (string): Search query
- `type` (string, optional): Filter by memory type
- `tags` (array, optional): Filter by tags

```javascript
// Find authentication-related memories
memory_search({
  query: "authentication",
  tags: ["security"]
})

// Find architectural decisions
memory_search({
  type: "decision",
  query: "database"
})
```

### `memory_stats`

View analytics on memory usage (counts by type, recent activity, tag distribution).

```javascript
memory_stats({})
```

## Patterns

### Pattern: Contextual Chunking

Break documents into retrievable chunks while preserving context.

**The Problem:** Naive chunking (fixed 512 tokens) breaks semantic units mid-sentence or loses critical context.

**Solution (Anthropic's approach):**
1. Identify semantic boundaries (headings, paragraphs, code blocks)
2. Chunk at natural breaks
3. Add contextual prefix to each chunk
4. Test retrieval before finalizing

**Implementation:**
```python
def contextual_chunk(document, heading_hierarchy):
    chunks = []
    for section in document.sections:
        context = " > ".join(heading_hierarchy + [section.heading])
        for para in section.paragraphs:
            chunk = f"Context: {context}\n\n{para.text}"
            chunks.append(chunk)
    return chunks
```

**Testing:** Query for expected information, verify correct chunks surface in top-3, adjust size if needed.

### Pattern: Multi-Type Memory Strategy

Different information types need different memory strategies.

**Episodic Memory (Conversations)**
- Store: User preferences, past decisions, interaction history
- Structure: Timestamped, conversational format
- Retrieval: Recent-first + semantic similarity

**Semantic Memory (Facts)**
- Store: Concepts, relationships, domain knowledge
- Structure: Structured, normalized
- Retrieval: Pure semantic search

**Procedural Memory (How-To)**
- Store: Patterns, workflows, step-by-step guides
- Structure: Imperative, actionable
- Retrieval: Task-based, contextual

**Implementation:**
```javascript
// Episodic: Store conversation
memory_write({
  key: `conversation-${timestamp}`,
  type: "episodic",
  content: conversationSummary,
  tags: ["user-preference"]
})

// Semantic: Store fact
memory_write({
  key: "python-gil",
  type: "semantic",
  content: "The Python GIL prevents true parallelism in CPU-bound tasks",
  tags: ["python", "concurrency"]
})

// Procedural: Store pattern
memory_write({
  key: "deploy-procedure",
  type: "procedural",
  content: "1. Run tests 2. Build 3. Deploy staging 4. Smoke test 5. Production",
  tags: ["deployment", "workflow"]
})
```

### Pattern: Temporal Decay Scoring

Recent memories should weigh more in retrieval.

**The Problem:** Vector similarity alone doesn't account for recency. An old, slightly-more-relevant memory might outrank a recent, highly-relevant one.

**Solution:**
```python
def temporal_score(similarity, timestamp, decay_rate=0.1):
    age_days = (now - timestamp).days
    decay_factor = math.exp(-decay_rate * age_days)
    return similarity * (0.7 + 0.3 * decay_factor)
```

Apply during retrieval:
```javascript
const results = await memory_search({ query })
const scored = results.map(r => ({
  ...r,
  score: temporalScore(r.similarity, r.timestamp)
})).sort((a, b) => b.score - a.score)
```

### Pattern: Metadata-First Filtering

Always filter by metadata before semantic search.

**Why:** Semantic search across millions of vectors is expensive. Filtering by tags, types, or dates first reduces search space 10-100x.

```javascript
// ❌ Bad: Search everything
memory_search({ query: "authentication bug" })

// ✅ Good: Filter first
memory_search({
  query: "authentication bug",
  type: "decision",
  tags: ["security", "bugs"]
})
```

### Pattern: Conflict Detection

Detect when new memories contradict existing ones.

```javascript
async function writeWithConflictCheck(key, content, tags) {
  // Search for related memories
  const similar = await memory_search({
    query: content,
    tags: tags,
    limit: 5
  })

  // Check for contradictions (heuristic or LLM-based)
  const conflicts = detectConflicts(content, similar)

  if (conflicts.length > 0) {
    console.warn(`Potential conflicts with: ${conflicts.map(c => c.key)}`)
  }

  await memory_write({ key, type: "fact", content, tags })
}
```

## Anti-Patterns

### ❌ Store Everything Forever

**Problem:** Infinite memory growth without pruning leads to noise drowning signal.

**Solution:** Implement decay policies - archive episodic memories older than 6 months, keep only summaries of old conversations, delete redundant facts.

### ❌ Chunk Without Testing Retrieval

**Problem:** Optimizing chunk size theoretically without testing real queries.

**Solution:** Create test queries for your domain, chunk corpus, measure retrieval accuracy (top-3, top-5), adjust size and overlap, re-test.

### ❌ Single Memory Type for All Data

**Problem:** Treating facts, conversations, and procedures identically leads to poor retrieval.

**Solution:** Use the Multi-Type Memory Strategy pattern above.

### ❌ Forgetting Embedding Model Versioning

**Problem:** Changing embedding models invalidates your vector store.

**Solution:** Track embedding model in metadata:
```javascript
memory_write({
  key: "fact-123",
  type: "semantic",
  content: "...",
  metadata: {
    embedding_model: "text-embedding-3-small",
    model_version: "v3",
    embedding_dim: 1536
  }
})
```

## Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| **Chunk size affects retrieval quality** | Critical | Use Contextual Chunking. Test 256, 512, 1024 tokens. |
| **Stale embeddings after model change** | High | Track embedding model in metadata. Re-embed on version change. |
| **Semantic search without metadata filters** | High | Always filter by metadata first to reduce search space. |
| **Ignoring temporal relevance** | High | Add temporal decay scoring to boost recent memories. |
| **Conflicting memories** | Medium | Detect conflicts on storage, alert or auto-merge. |
| **Token budget exhaustion** | Medium | Budget: 30% context, 40% retrieval, 30% generation. |
| **Vector DB choice paralysis** | Medium | Start simple: Chroma for local, Pinecone for production. |

## Usage Examples

### Store Architecture Decision

```javascript
await memory_write({
  key: "db-migration-2024",
  type: "decision",
  content: `Migrated PostgreSQL to Supabase for built-in auth, real-time subscriptions, edge functions. Trade-off: vendor lock-in, but velocity gain justifies it.`,
  tags: ["database", "architecture"]
})

// Later: Recall decision
const decision = await memory_read({ key: "db-migration-2024" })
```

### Track User Preferences

```javascript
await memory_write({
  key: `user-pref-${userId}`,
  type: "episodic",
  content: `User prefers: concise responses, code examples over theory, Python over JavaScript`,
  tags: ["user-preference", userId]
})

// Retrieve for personalization
const prefs = await memory_read({ key: `user-pref-${userId}` })
```

### Pattern Library

```javascript
await memory_write({
  key: "retry-with-backoff",
  type: "procedural",
  content: `Retry with exponential backoff: 1. Try operation 2. On failure, wait 2^attempt seconds 3. Retry up to max_attempts 4. Log final failure`,
  tags: ["patterns", "error-handling"]
})

// Search patterns when needed
const patterns = await memory_search({
  query: "handle API failures",
  type: "procedural"
})
```

## Vector Store Integration

For semantic search beyond MCP's built-in search:

```python
import pinecone
from openai import OpenAI

# Initialize
pinecone.init(api_key="...")
index = pinecone.Index("agent-memory")
openai_client = OpenAI()

# Store memory with vector
def store_memory(key, content, metadata):
    # Embed
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=content
    )
    vector = response.data[0].embedding

    # Upsert to Pinecone
    index.upsert([(key, vector, metadata)])

    # Also store in MCP for full content
    memory_write({
        key: key,
        type: metadata.get("type"),
        content: content,
        tags: metadata.get("tags", [])
    })

# Retrieve
def search_memory(query, top_k=5):
    # Embed query
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    query_vector = response.data[0].embedding

    # Search Pinecone
    results = index.query(query_vector, top_k=top_k, include_metadata=True)

    # Fetch full content from MCP
    memories = []
    for match in results.matches:
        full_content = memory_read({ key: match.id })
        memories.append({
            "key": match.id,
            "score": match.score,
            "content": full_content
        })

    return memories
```

## Token Budget Strategy

For large memory systems, budget your context tokens:

```python
MAX_TOKENS = 8000
CONTEXT_BUDGET = int(MAX_TOKENS * 0.3)  # 2400 - conversation history
MEMORY_BUDGET = int(MAX_TOKENS * 0.4)   # 3200 - retrieved memories
GENERATION_BUDGET = int(MAX_TOKENS * 0.3)  # 2400 - response

# Trim conversation to fit budget
conversation = trim_to_tokens(conversation, CONTEXT_BUDGET)

# Retrieve memories within budget
memories = memory_search({ query, limit: 10 })
memories = trim_to_tokens(memories, MEMORY_BUDGET)
```

## Testing Memory Retrieval

Build a test suite for your memory system:

```python
def test_retrieval_accuracy():
    memory_write({
        key: "test-auth",
        type: "decision",
        content: "Use OAuth2 for authentication",
        tags: ["auth", "security"]
    })

    results = memory_search({ query: "authentication method" })
    assert any(r.key == "test-auth" for r in results[:3]),         "Expected memory not in top 3 results"

def test_temporal_decay():
    old_mem = memory_write({...})  # 90 days ago
    new_mem = memory_write({...})  # today

    results = memory_search({ query: "..." })
    assert results[0].key == new_mem.key
```

## Dashboard (Optional)

Visualize memory via web interface:

```bash
npm run start-dashboard $(pwd)
```

Access at `http://localhost:3333` - shows memory counts by type, tag cloud, recent writes, search interface.

## Best Practices

1. **Start Simple**: Use MCP memory first, add vector search only when needed
2. **Test Retrieval**: Don't optimize chunk size theoretically - test with real queries
3. **Tag Everything**: Rich metadata makes filtering and retrieval 10x better
4. **Version Embeddings**: Track which model created each vector
5. **Prune Regularly**: Archive old episodic memories, keep semantic knowledge
6. **Budget Tokens**: Plan your context window allocation
7. **Monitor Conflicts**: Alert when new memories contradict old ones

## Troubleshooting

**Memories not surfacing in search**
- Check tag filters (too restrictive?)
- Verify embedding model consistency
- Test chunk size (too small = missing context, too large = diluted relevance)

**Slow search performance**
- Add metadata filters before semantic search
- Index frequently-searched tags
- Consider caching recent searches

**Contradictory memories**
- Implement conflict detection
- Use versioned keys (auth-v1, auth-v2)
- Regular audits to prune outdated info

## Related Skills

Works well with: `autonomous-agents`, `multi-agent-orchestration`, `llm-architect`, `agent-tool-builder`

---

*Memory isn't just storage - it's retrieval. Build for recall, not just record.*
