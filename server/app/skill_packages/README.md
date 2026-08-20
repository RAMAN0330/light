# Vendored upstream skill packages

`upstream_catalog.json` and `packages/` are Orbital-owned, immutable snapshots used
at runtime. They contain each permitted `SKILL.md`, referenced package resources,
source revision, license, and attribution. They exclude Odysseus and all upstream
UI/runner code.

Package directory names describe their Orbital capability, while individual
package manifests retain upstream provenance and attribution:

| Directory | Capability |
| --- | --- |
| `agent-workflows/` | Agent orchestration, memory, approvals, delegation, and scheduled-work processes |
| `web-research/` | Read-only public web and social research processes |
| `document-ingestion/` | Document conversion and knowledge-ingestion processes |
| `context-optimization/` | Context compression, provenance, token accounting, and handoff processes |
| `code-intelligence/` | Repository/document graph extraction and impact-analysis processes |
| `code-context/` | Local code-context graph and code-map processes |
| `skill-observation/` | Approval-based skill observation and review processes |

Refresh it only after reviewing source and license changes:

```bash
cd server
.venv311/bin/python scripts/export_upstream_skill_catalog.py
```
