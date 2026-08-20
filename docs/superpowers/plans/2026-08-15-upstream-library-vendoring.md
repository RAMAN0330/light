# Upstream Library Vendoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Orbital independent of review clones by copying permitted reusable upstream libraries into attributable Orbital capability modules while retaining Orbital-owned execution.

**Architecture:** A declarative vendor manifest selects core library directories from each permitted upstream source. A materializer copies those directories and legal notices into `server/vendor/upstream`, omitting known upstream runner entrypoints. The existing Orbital plugin worker is the only process that executes tools.

**Tech Stack:** Python standard library (`pathlib`, `shutil`), pytest.

## Global Constraints

- Never vendor Odysseus or AGPL code.
- Preserve original license and notice files per source.
- Exclude upstream UI, CLI, daemon, MCP server, proxy, gateway, installer, and agent-loop runners.
- No runtime installer or direct upstream process is allowed in the API service.

---

### Task 1: Reproducible vendor snapshot

**Files:**
- Create: `server/app/orbital_modules/upstream.py`
- Create: `server/scripts/materialize_orbital_modules.py`
- Create: `server/orbital_modules/upstream/README.md`
- Modify: `server/plugins.Dockerfile`
- Test: `server/tests/test_upstream_vendor.py`

**Interfaces:**
- Produces: `materialize(source_root: Path, destination: Path, *, sources: tuple[str, ...]) -> dict[str, int]`.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement the materializer**
- [x] **Step 4: Run test and generate the snapshot**
- [x] **Step 5: Verify the complete server suite**
