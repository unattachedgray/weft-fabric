# claude-skills

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code/skills) **plugin marketplace** (`unatt`) + a catalog of skills. Two distribution paths coexist:

- **Plugin marketplace** (recommended) — `plugins/` directory, declared in `.claude-plugin/marketplace.json`. First-class Claude Code support, auto-updates on every push, multi-plugin selectivity per machine.
- **Legacy flat skills** — the 76 top-level directories at the repo root. Installed by raw copy. Will be curated into concern-based plugins over time.

## Install (marketplace — recommended)

Add the marketplace once per machine:

```
/plugin marketplace add unattachedgray/claude-skills
```

Then install plugins selectively:

```
/plugin install skill-detectors@unatt
/plugin install catalog@unatt
```

Browse what's available:

```
/plugin marketplace browse unatt
```

…or, once `catalog` is installed, read `/catalog:browse-skills`. The catalog auto-regenerates on every push (commit-SHA versioning) so all machines see new entries at next session start.

### Available plugins

| Plugin | What it does |
|---|---|
| [`skill-detectors`](plugins/skill-detectors/) | Surfaces context-conditional skills automatically. SessionStart watches disk state and emits `SKILL_SIGNAL` markers (`offer` / `route` / `constrain`); UserPromptSubmit watches chat content and emits `SKILL_SIGNAL_CANDIDATE` markers when the user mentions something that may warrant a new detector. |
| [`catalog`](plugins/catalog/) | Index of every skill across every plugin in this marketplace. Installed on every machine even when other plugins aren't, so Claude knows what's available to suggest installing. |

## Skill detectors

The `skill-detectors` plugin is the highest-value entry. It addresses the *forgetting problem*: you install a categorically-better tool, you know it exists, and you still reach for the default every time because your habit fires faster than your memory. Two hooks invert that:

| Hook | Watches | Fires | Marker |
|---|---|---|---|
| `SessionStart` → `run-all.sh` → `detectors/*.sh` | Project state on disk (files, manifests, env) | Once per session | `SKILL_SIGNAL` |
| `UserPromptSubmit` → `run-prompt-detectors.sh` → `prompt-detectors/*.sh` | The user's prompt text | On every user message | `SKILL_SIGNAL_CANDIDATE` |

### Existing detectors

| Detector | Type | Fires when |
|---|---|---|
| `detectors/graphify.sh` | disk | Git repo with ≥30 source files and no `graphify-out/` — offers `/graphify .` |
| `detectors/pretext.sh` | disk | `package.json` declares `@chenglou/pretext` — constrains text-height work to pretext APIs |
| `detectors/ast-grep.sh` | disk | `ast-grep` on PATH in a code project — routes structural pattern queries to ast-grep |
| `prompt-detectors/github-url.sh` | chat | Prompt contains a GitHub repo reference — emits a candidate signal |

### Adding a detector

Drop a new `.sh` file under `plugins/skill-detectors/detectors/` (disk) or `plugins/skill-detectors/prompt-detectors/` (chat). Contract:

- Exit `0` with no output when no match. Emit one or more single-line JSON markers prefixed with `SKILL_SIGNAL ` (disk) or `SKILL_SIGNAL_CANDIDATE ` (chat) when something fires.
- Be cheap — target under 100ms (disk) or 50ms (chat).
- Self-contained. No shared state between detectors.

See `plugins/skill-detectors/skills/skill-detectors/SKILL.md` for the full marker schema and the three-criteria gate Claude uses to evaluate candidates. Once added, commit + push — every machine fetches the update at next session start.

### Catalog regeneration

When you add or modify plugins/skills, regenerate the catalog before pushing:

```
bash scripts/regen-catalog.sh
git add plugins/catalog/skills/browse-skills/SKILL.md && git commit -m "regen catalog"
```

(Optional but recommended — the catalog is what tells every machine what's possible.)

## Legacy flat-skill install

The 76 directories at the repo root are pre-marketplace skills, still installable via raw copy. They'll be migrated into concern-based plugins in a curation pass — drop unused, group kept ones, add detectors where description-based routing isn't reliable.

**All flat skills:**

```bash
git clone https://github.com/unattachedgray/claude-skills.git /tmp/cs
cp -r /tmp/cs/*/ ~/.claude/skills/
rm -rf /tmp/cs
```

**Single flat skill:**

```bash
SKILL=pretext-layout  # change to any skill name
mkdir -p ~/.claude/skills/$SKILL
curl -sL https://raw.githubusercontent.com/unattachedgray/claude-skills/main/$SKILL/SKILL.md \
  -o ~/.claude/skills/$SKILL/SKILL.md
```

## Skills (77 legacy + 2 plugins)

### Development Lifecycle

| Skill | Description |
|-------|-------------|
| [dev](dev/) | 7-phase development process (think/plan/build/review/test/ship/reflect) |
| [build](build/) | PRD-driven autonomous build loop with quality gates |
| [eval](eval/) | Test skills against predefined eval cases |
| [hats](hats/) | Switch into a focused persona: architect, reviewer, debugger, etc. |
| [writing-plans](writing-plans/) | Plan multi-step tasks from specs before touching code |
| [brainstorming](brainstorming/) | Explore intent, requirements, and design before implementation |
| [simplify](simplify/) | Review changed code for reuse, quality, and efficiency |

### Frontend & UI

| Skill | Description |
|-------|-------------|
| [pretext-layout](pretext-layout/) | Text-aware frontend design via canvas measureText() — zero-reflow text measurement |
| [browser](browser/) | Chrome automation: tabs, screenshots, forms, extraction, accessibility |
| [react-development](react-development/) | React hooks, TypeScript, Server Components, state management, routing |
| [nextjs-development](nextjs-development/) | Next.js App Router, Server Components, data fetching, Vercel deployment |
| [senior-frontend](senior-frontend/) | Modern web apps with React, Next.js, TypeScript, Tailwind CSS |
| [frontend-guidelines](frontend-guidelines/) | Frontend patterns, architecture, and best practices |
| [tailwind-patterns](tailwind-patterns/) | Tailwind CSS v4: CSS-first config, container queries, design tokens |
| [3d-web-designer](3d-web-designer/) | Three.js, React Three Fiber, WebGPU for 3D web experiences |
| [web-design-guidelines](web-design-guidelines/) | UI review for Web Interface Guidelines compliance |
| [ui-design](ui-design/) | Design systems, component libraries, design tokens, responsive design |
| [mobile-design](mobile-design/) | Mobile-first design for iOS and Android |
| [theme-factory](theme-factory/) | Apply pre-set or custom themes to any artifact |

### Backend & Architecture

| Skill | Description |
|-------|-------------|
| [backend-development](backend-development/) | Node.js/Express/TypeScript microservices with layered architecture |
| [senior-architect](senior-architect/) | System design with React, Next.js, Node, Go, Python, Postgres, GraphQL |
| [senior-fullstack](senior-fullstack/) | Full-stack apps with React, Next.js, Node.js, GraphQL, PostgreSQL |
| [database-design](database-design/) | Schema architecture, SQL/NoSQL, normalization, indexing, migrations |
| [api-integration](api-integration/) | Third-party API integration, OAuth, webhooks, rate limiting |
| [typescript-expert](typescript-expert/) | Type-level programming, performance, monorepos, migration strategies |
| [javascript-mastery](javascript-mastery/) | 33+ essential JS concepts from fundamentals to advanced patterns |
| [bun-development](bun-development/) | Bun runtime: package management, bundling, testing, Node.js migration |

### DevOps & Infrastructure

| Skill | Description |
|-------|-------------|
| [senior-devops](senior-devops/) | CI/CD, infrastructure automation, containerization, cloud platforms |
| [docker-expert](docker-expert/) | Multi-stage builds, image optimization, container security, Compose |
| [vercel-deployment](vercel-deployment/) | Deploying to Vercel with Next.js |
| [github-workflow-automation](github-workflow-automation/) | PR reviews, issue triage, CI/CD, Git operations |
| [linux-production-shell-scripts](linux-production-shell-scripts/) | Production shell script templates for system automation |
| [bash-linux](bash-linux/) | Bash/Linux terminal patterns, commands, scripting |
| [powershell-windows](powershell-windows/) | PowerShell Windows patterns, operator syntax, error handling |

### AI & Machine Learning

| Skill | Description |
|-------|-------------|
| [senior-ml-engineer](senior-ml-engineer/) | ML productionization, MLOps, model deployment, feature stores |
| [senior-data-scientist](senior-data-scientist/) | Statistical modeling, experimentation, causal inference, analytics |
| [senior-data-engineer](senior-data-engineer/) | Data pipelines, ETL/ELT, Spark, Airflow, dbt, Kafka |
| [long-context](long-context/) | Extend transformer context windows with RoPE, YaRN, ALiBi |
| [senior-computer-vision](senior-computer-vision/) | Image/video processing, object detection, segmentation, vision AI |
| [segment-anything-model](segment-anything-model/) | SAM for zero-shot image segmentation |
| [blip-2-vision-language](blip-2-vision-language/) | Vision-language: captioning, VQA, image-text retrieval |
| [stable-diffusion-image-generation](stable-diffusion-image-generation/) | Text-to-image generation with Stable Diffusion |
| [whisper](whisper/) | Speech recognition: transcription, translation, 99 languages |
| [audiocraft-audio-generation](audiocraft-audio-generation/) | Text-to-music (MusicGen) and text-to-sound (AudioGen) |
| [langchain](langchain/) | LLM apps with agents, chains, RAG, 500+ integrations |

### AI Agents

| Skill | Description |
|-------|-------------|
| [agent-development](agent-development/) | Building autonomous AI agents with tool integration and memory |
| [advanced-agents](advanced-agents/) | Computer-use agents, parallel systems, vision-based control |
| [agent-manager-skill](agent-manager-skill/) | Manage local CLI agents via tmux, cron scheduling |
| [agent-memory](agent-memory/) | Persistent memory systems for AI agents |
| [agent-md-refactor](agent-md-refactor/) | Refactor bloated AGENTS.md/CLAUDE.md into organized docs |

### Prompt Engineering & Claude

| Skill | Description |
|-------|-------------|
| [prompt-engineer](prompt-engineer/) | Prompt structure, context management, output formatting |
| [senior-prompt-engineer](senior-prompt-engineer/) | Advanced prompt patterns, structured outputs, AI product dev |
| [claude-api](claude-api/) | Build apps with Claude API, Anthropic SDK, Agent SDK |
| [mcp-development](mcp-development/) | Build and integrate MCP servers for Claude Code |
| [gemini](gemini/) | Run Gemini CLI for code review and big context (>200k) processing |

### Security

| Skill | Description |
|-------|-------------|
| [security-audit](security-audit/) | Audit secrets, permissions, ports, auth, DB integrity |
| [security-review](security-review/) | Auth, input validation, secrets management, vulnerability detection |
| [code-quality](code-quality/) | Code review, refactoring, coding standards, best practices |

### Content & Media

| Skill | Description |
|-------|-------------|
| [pdf](pdf/) | PDF manipulation: extract, create, merge, split, fill forms |
| [meme-factory](meme-factory/) | Generate memes via memegen.link API |
| [notebook](notebook/) | NotebookLM-style document-grounded analysis with source citations |
| [notebooklm](notebooklm/) | Query Google NotebookLM notebooks from Claude Code |

### Business & Strategy

| Skill | Description |
|-------|-------------|
| [ceo-advisor](ceo-advisor/) | Executive leadership, strategy, financial modeling, board governance |
| [marketing-ideas](marketing-ideas/) | Marketing strategies and growth ideas for SaaS products |
| [app-store-optimization](app-store-optimization/) | ASO toolkit for Apple App Store and Google Play |
| [ux-research](ux-research/) | User interviews, usability testing, personas, journey mapping |
| [email-systems](email-systems/) | Transactional email, marketing automation, deliverability |

### Workflow Automation

| Skill | Description |
|-------|-------------|
| [n8n-workflows](n8n-workflows/) | Manage n8n automations via MCP tools |
| [zapier-workflows](zapier-workflows/) | Orchestrate Zapier automations via MCP tools and webhooks |
| [jira](jira/) | Jira issue management, sprint status, workflow automation |
| [monitor](monitor/) | Metric watchers with alerts: URLs, shell commands, response times |
| [loop](loop/) | Run commands on a recurring interval |
| [schedule](schedule/) | Scheduled remote agents on cron |

### Platform-Specific

| Skill | Description |
|-------|-------------|
| [wordpress-development](wordpress-development/) | Block themes, plugins, REST API, Site Editor, wp.org compliance |
| [game-development](game-development/) | Game development orchestrator, routes to platform-specific skills |

### Skill Management

| Skill | Description |
|-------|-------------|
| [skill-detectors](plugins/skill-detectors/) | (Now a plugin in the `unatt` marketplace — install via `/plugin install skill-detectors@unatt`.) Surfaces context-conditional skills automatically at session start and on every prompt. See [Skill detectors](#skill-detectors) above. |
| [skill-enhance](skill-enhance/) | Propagate a technology across your skill library |
| [skill-development](skill-development/) | Full skill lifecycle: search, creation, testing, improvement |
| [skill-factory](skill-factory/) | Create new skills by researching and composing existing ones |
| [find-skills](find-skills/) | Discover and install skills from the ecosystem |


## How Skills Work

A skill is a markdown file at `~/.claude/skills/<name>/SKILL.md`. Claude Code loads skill metadata at startup and loads the full content when relevant.

**Triggering**: Type `/<skill-name>` in Claude Code, or Claude auto-loads the skill when your request matches its description.

**Writing skills**: See [Anthropic's skill authoring docs](https://docs.anthropic.com/en/docs/claude-code/skills). Use `/skill-enhance` to propagate new technologies across existing skills.

## Recent Changes

- **Converted to a Claude Code plugin marketplace** (`unatt`). Added `.claude-plugin/marketplace.json` and two initial plugins: `skill-detectors` (the framework) and `catalog` (auto-regenerated skill index). Legacy flat skills coexist at the repo root pending curation.
- Added `skill-detectors` framework as the first plugin: session-start hook surfaces disk-state signals, prompt-submit hook surfaces chat-mention candidates. See [Skill detectors](#skill-detectors).
- Added Temporal (durable execution) guidance to agent-development, advanced-agents, senior-devops, senior-data-engineer, and backend-development skills
- Pretext-layout text verification integrated across frontend skills

## License

MIT
