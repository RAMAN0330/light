# Orbital capability modules

This directory is a reproducible local copy of reusable source from Hermes Agent, Agent Reach, anydoc, Headroom, Graphify, Graft, and Task Observer. It exists so Orbital can remove `third_party/upstream` after release preparation.

Each source has its original license/notice file beside its copied code. Orbital does **not** copy or run upstream UIs, CLIs, daemons, MCP servers, proxies, gateways, installers, or agent loops. Those execution boundaries belong to Orbital's API, policy engine, and plugin worker.

| Directory | Capability |
| --- | --- |
| `agent-workflows/` | Agent orchestration, memory, approvals, delegation, and schedules |
| `web-research/` | Read-only public web and social research |
| `document-ingestion/` | Document conversion and knowledge ingestion |
| `context-optimization/` | Context compression, provenance, and token accounting |
| `code-intelligence/` | Repository/document graph extraction and impact analysis |
| `code-context/` | Local code-context graph and code maps |
| `skill-observation/` | Skill observation and review workflows |

To refresh a module, pass an explicit reviewed capability-to-directory mapping:

```sh
cd server
ORBITAL_MODULE_SOURCES_JSON='{"web-research":"/reviewed/source"}' .venv311/bin/python scripts/materialize_orbital_modules.py
```

Odysseus is deliberately excluded because it is AGPL-licensed.
