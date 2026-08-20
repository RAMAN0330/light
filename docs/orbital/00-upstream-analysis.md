# Orbital Upstream Capability Analysis

> Research snapshot: 2026-08-14. This document is an architecture input, not legal advice. Reconfirm licenses, releases, security advisories, and integration contracts before implementation.

## Decision

Orbital will be built as an independent product. Upstream projects are reference implementations or optional, tenant-controlled adapters. Orbital will not fork or copy their product code, user interface, prompts, or bundled skill content. Every integration must be disabled by default, isolated by tenant, authorized by policy, and represented by an Orbital-owned connector contract.

## Capability and licensing matrix

| Project | Useful capabilities | Skill/plugin shape and how it works | Orbital decision | License / notable risk |
|---|---|---|---|---|
| [Odysseus](https://github.com/odysseus-dev/odysseus) | Reference for a self-hosted workspace: chat, agents, research, documents, email, notes, tasks, calendar, model workflows, 2FA, uploads and themes. | Provides Codex/Claude-oriented workspace skills; its application combines many first-party modules. | Product-reference only. Recreate desired workflows behind Orbital services. Never embed its code. | AGPL-3.0-or-later. Copyleft/network-use obligations make source reuse out of scope. Powerful local tools also require strict exposure controls. |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Agent loop, provider switching, toolsets, memory, cross-session search, scheduled tasks, delegated subagents, isolated terminals and messaging gateways. | Agent Skills-compatible `SKILL.md` packages are procedural memory; toolsets gate available tools. MCP expands tools. Cron delivers scheduled runs. | Use as behavioral reference and optionally interoperate through approved MCP/HTTP boundaries only. Orbital owns its agent-run protocol, policy layer and UI. | MIT. Terminal, messaging and autonomous execution require isolation, approval and account-pairing controls. |
| [Agent Reach](https://github.com/Panniantong/Agent-Reach) | Internet, GitHub, RSS, video, social and community research through a CLI with diagnostics and provider fallbacks. | Its skill teaches agents to install/configure the CLI and select a platform-specific route. `doctor` reports readiness. Some connectors use local browser sessions/cookies. | Adapter only: wrap approved read-only capabilities in a research connector. Do not automate login or extract browser cookies. | MIT. Social-platform terms, credential/cookie exposure, scraping blocks, proxy abuse and prompt-injection risk are high. |
| [Task Observer](https://github.com/rebelytics/one-skill-to-rule-them-all) | Finds repeated workflows, user corrections and skill gaps; creates reviewable improvement recommendations. | A meta-skill records structured observations, proposes skill updates and asks for periodic review. It explicitly does not directly edit skills. | Implement an Orbital Skill Observations module with the same human-review principle; never run unreviewed skill mutations. | CC BY 4.0; attribution is required for any adapted content. Observation logs can capture sensitive user context. |
| [anydoc](https://github.com/firecrawl/anydoc) | Fast local conversion of Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV and text PDFs into Markdown with structural metadata and embedded assets. | Ships an Agent Skill that directs an agent to invoke its CLI; also offers Rust, Python, Node and WASM APIs. | Preferred ingestion adapter. Run conversion in an isolated worker; preserve original file, normalized Markdown, extraction version and provenance. | MIT. No OCR for scanned documents locally; treat documents and embedded assets as untrusted input. |
| [Headroom](https://github.com/headroomlabs-ai/headroom) | Context compression library, proxy and MCP server; retrieval, cross-agent memory, output shaping and usage statistics. | `headroom_compress`, `headroom_retrieve` and `headroom_stats` are exposed through MCP. Wrappers route supported coding agents through a local proxy. | Optional per-tenant optimization connector, disabled by default. Orbital must retain the uncompressed source and show compression provenance. | Apache-2.0. A proxy processes highly sensitive prompts/tool outputs; require explicit enablement, data-boundary disclosure and bypass support. |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Deterministic AST graph for code plus optional semantic extraction for docs, PDFs, images and video; graph queries, impact analysis and interactive visualization. | Installs a `/graphify` skill and can expose MCP tools such as graph queries, nodes, neighbors and paths. Graph outputs are portable files. | Preferred workspace knowledge/code graph adapter. Use local AST-only mode by default; require consent and a configured model for semantic extraction. | Apache-2.0/MIT. Graphs can expose source, schema and relationship metadata; HTTP MCP must use authentication and non-public binding. |
| [Graft](https://github.com/NanoNets/Graft) | Local code-context graph, code map, symbol wiring, impact/caller analysis and optional LLM-enriched summaries. | CLI builds local graph files; MCP exposes map/grep/query tools and selected-agent wiring adds contextual instructions/hooks. | Developer-local optional integration, not a shared production dependency. Use its output as a user-controlled artifact only. | MIT. Hooks/config writes and source summaries require user approval; do not auto-edit developer agent configuration. |

## Normalized Orbital integration contract

Every external integration is a `Connector` with a versioned manifest:

```json
{
  "id": "graphify",
  "kind": "mcp | cli | library | http",
  "capabilities": ["knowledge.graph.query"],
  "data_classes": ["source_code", "documents"],
  "network_mode": "none | approved_egress",
  "approval_class": "automatic | user | admin",
  "credential_scope": "none | workspace | organization",
  "execution_boundary": "browser | worker | sandbox | external",
  "audit_events": ["connector.invoke", "connector.denied"]
}
```

The control plane validates manifests, maps capabilities to policy checks, injects only scoped credentials, captures provenance, and prevents connectors from acquiring undeclared permissions. A connector receives an opaque workspace/run identity rather than direct database access.

## Recommended adoption order

1. Use anydoc for local, deterministic document normalization.
2. Add Graphify AST-only extraction for code/workspace graphing.
3. Add a governed MCP registry and approval system before any broad tool connector.
4. Offer Headroom as opt-in optimization only after prompt-data controls exist.
5. Add Agent Reach as read-only, allowlisted research integration after browser, egress and citation protections exist.
6. Add Graft as a developer-local workflow integration; do not centralize its hooks.
7. Build Task Observer-style recommendations after skill governance exists.
8. Use Odysseus and Hermes as product/architecture references throughout, but maintain independent implementation and UX.

## Integration acceptance gate

An adapter is eligible for production only when it has: a pinned version and SBOM entry; license review; data-flow diagram; threat model; scoped secret handling; default-deny network access; tool approval mapping; rate and cost limits; structured audit events; failure behavior; and a tested disable/rollback path.
