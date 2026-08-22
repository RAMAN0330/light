"""Clones a connected GitHub repository and runs graphify's structural
extraction over it in-process.

Reuses the same vendored ``graphify`` skill already exposed to chat via
``orbital_runners`` (see ``services/tool_calling.py``), but runs it directly
in the API process instead of through the sandboxed orbital-runner: graphify
only does static, read-only tree-sitter parsing of already-cloned source
(no execution of repo code), and the clone itself needs the network access
the runner deliberately doesn't have (``PluginSpec("graphify", ...,
"none", ...)`` in orbital_runners/registry.py).
"""
from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

from git import Repo

_GRAPHIFY_ROOT = Path(__file__).resolve().parents[2] / "orbital_modules" / "upstream" / "code-intelligence"


def _ensure_graphify_importable() -> None:
    path = str(_GRAPHIFY_ROOT)
    if _GRAPHIFY_ROOT.exists() and path not in sys.path:
        sys.path.insert(0, path)


def clone_and_extract(clone_url: str, branch: str, max_nodes: int = 10_000, max_edges: int = 30_000) -> dict:
    """Clones ``clone_url`` at ``branch`` into a temp dir and returns a bounded
    node/edge graph. Raises on clone failure or extraction error; the caller
    is expected to catch and report a "failed" status like GitHubGateway does
    for HTTP errors."""
    _ensure_graphify_importable()
    from graphify.extract import collect_files, extract

    tmp_dir = Path(tempfile.mkdtemp(prefix="repo-analysis-"))
    try:
        Repo.clone_from(clone_url, tmp_dir, branch=branch, depth=1)
        files = collect_files(tmp_dir, root=tmp_dir)
        result = extract(files, root=tmp_dir)
        nodes = [n for n in result.get("nodes", []) if isinstance(n, dict)][:max_nodes]
        node_ids = {n.get("id") for n in nodes}
        edges = [
            e for e in result.get("edges", [])
            if isinstance(e, dict) and e.get("source") in node_ids and e.get("target") in node_ids
        ][:max_edges]
        return {"nodes": nodes, "edges": edges, "stats": {"files": len(files), "nodes": len(nodes), "edges": len(edges)}}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def authenticated_clone_url(external_ref: str, token: str | None) -> str:
    if token:
        return f"https://{token}@github.com/{external_ref}.git"
    return f"https://github.com/{external_ref}.git"
