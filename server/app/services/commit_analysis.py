"""Per-commit structural code analysis for connected repositories.

This is a lighter-weight, server-side reimplementation of the health/issue
metrics the browser-only engine in client/src/features/analysis/services
computes on demand (function counts, an import-based dependency graph,
circular-dependency + god-file detection, a 0-100 health score) — not a
line-for-line port of that 2000+-line client parser. It has to run headless
per commit, so it trades the client engine's full call-graph resolution for
import-statement parsing, which is enough to support the same issue/health
shape.

Two feeders will eventually write to ``commit_analyses`` the same way the two
``ci_ingestion`` feeders write to ``pipeline_runs``: for now only the poll
path (``sync_commit_analysis_for_connection`` / ``sync_all_commit_analyses``,
invoked by ``app/workers/commit_analysis_sync.py``) exists.
"""
from __future__ import annotations

import base64
import re

import httpx

CODE_EXTENSIONS = (
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".go", ".rb", ".java", ".php", ".rs", ".c", ".cpp", ".cc", ".h", ".hpp", ".cs",
)
MAX_FILES_PER_COMMIT = 300
MAX_FILE_BYTES = 200_000

_FUNCTION_PATTERNS = re.compile(
    r"^\s*(?:export\s+)?(?:async\s+)?function\s+\w+|"
    r"^\s*def\s+\w+|"
    r"^\s*func\s+\w+|"
    r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{",
    re.MULTILINE,
)

_IMPORT_PATTERNS = (
    re.compile(r"""import\s+(?:[\w*{}\s,]+\s+from\s+)?['"](\.{1,2}/[^'"]+)['"]"""),
    re.compile(r"""require\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)"""),
    re.compile(r"""^\s*from\s+(\.+[\w.]*)\s+import\b""", re.MULTILINE),
)


def is_code_path(path: str) -> bool:
    lower = path.lower()
    return any(lower.endswith(ext) for ext in CODE_EXTENSIONS)


def count_functions(content: str) -> int:
    return len(_FUNCTION_PATTERNS.findall(content))


def _resolve_relative_import(from_path: str, target: str, known_paths: set[str]) -> str | None:
    from_dir = from_path.rsplit("/", 1)[0] if "/" in from_path else ""
    parts = (from_dir.split("/") if from_dir else []) + target.split("/")
    resolved: list[str] = []
    for part in parts:
        if part in ("", "."):
            continue
        if part == "..":
            if resolved:
                resolved.pop()
            continue
        resolved.append(part)
    base = "/".join(resolved)
    candidates = [base, f"{base}.ts", f"{base}.tsx", f"{base}.js", f"{base}.jsx", f"{base}.py", f"{base}/index.ts", f"{base}/index.js"]
    for candidate in candidates:
        if candidate in known_paths:
            return candidate
    return None


def extract_imports(content: str, path: str, known_paths: set[str]) -> list[str]:
    targets: list[str] = []
    for pattern in _IMPORT_PATTERNS:
        for match in pattern.findall(content):
            resolved = _resolve_relative_import(path, match, known_paths)
            if resolved and resolved != path:
                targets.append(resolved)
    return targets


def analyze_files(files: list[dict]) -> dict:
    """``files`` is a list of ``{"path": str, "content": str}`` for one commit's tree."""
    code_files = [f for f in files if is_code_path(f["path"]) and f.get("content")][:MAX_FILES_PER_COMMIT]
    known_paths = {f["path"] for f in code_files}

    function_counts = {f["path"]: count_functions(f["content"]) for f in code_files}
    connections: list[tuple[str, str]] = []
    for f in code_files:
        for target in extract_imports(f["content"], f["path"], known_paths):
            connections.append((f["path"], target))

    issues = _detect_issues(code_files, function_counts, connections)
    stats = {
        "files": len(code_files),
        "functions": sum(function_counts.values()),
        "connections": len(connections),
    }
    return {"stats": stats, "issues": issues, **_calc_health(stats, issues)}


def _detect_issues(files: list[dict], function_counts: dict[str, int], connections: list[tuple[str, str]]) -> list[dict]:
    issues: list[dict] = []
    seen_pairs: set[str] = set()
    edge_set = set(connections)
    for source, target in connections:
        pair_key = "|".join(sorted((source, target)))
        if pair_key in seen_pairs:
            continue
        if (target, source) in edge_set:
            seen_pairs.add(pair_key)
            issues.append({
                "title": f"Circular dependency: {source} ↔ {target}",
                "detail": "These files depend on each other — consider extracting the shared piece.",
            })
    for path, count in function_counts.items():
        if count > 15:
            name = path.rsplit("/", 1)[-1]
            issues.append({
                "title": f"Large file: {name} ({count} functions)",
                "detail": "Consider splitting into smaller modules.",
            })
    return issues


def _calc_health(stats: dict, issues: list[dict]) -> dict:
    score = 100.0
    circular = sum(1 for i in issues if i["title"].startswith("Circular"))
    score -= min(20, circular * 5)
    god = sum(1 for i in issues if i["title"].startswith("Large file"))
    score -= min(15, god * 3)
    avg_coupling = stats["connections"] / stats["files"] if stats["files"] else 0
    score -= min(15, max(0, avg_coupling - 3) * 2)
    score = max(0, round(score))
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    elif score >= 60:
        grade = "D"
    else:
        grade = "F"
    return {"health_score": score, "grade": grade}


async def _fetch_json(client: httpx.AsyncClient, url: str, headers: dict, params: dict | None = None) -> object:
    response = await client.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()


async def analyze_commit(client: httpx.AsyncClient, github_api_url: str, headers: dict, external_ref: str, commit_sha: str) -> dict:
    tree = await _fetch_json(client, f"{github_api_url}/repos/{external_ref}/git/trees/{commit_sha}", headers, {"recursive": 1})
    blobs = [entry for entry in tree.get("tree", []) if entry.get("type") == "blob" and is_code_path(entry["path"])][:MAX_FILES_PER_COMMIT]
    files: list[dict] = []
    for entry in blobs:
        if entry.get("size") and entry["size"] > MAX_FILE_BYTES:
            continue
        blob = await _fetch_json(client, f"{github_api_url}/repos/{external_ref}/git/blobs/{entry['sha']}", headers)
        content = blob.get("content", "")
        try:
            decoded = base64.b64decode(content).decode("utf-8", errors="replace")
        except (ValueError, UnicodeDecodeError):
            continue
        files.append({"path": entry["path"], "content": decoded})
    return analyze_files(files)


async def sync_commit_analysis_for_connection(repository, connection: dict, github_token: str, github_api_url: str, client: httpx.AsyncClient, max_commits: int = 5) -> int:
    """Analyzes any commits on the connection's default branch not yet in ``commit_analyses``.
    Returns the number of commits analyzed."""
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    repo_info = await _fetch_json(client, f"{github_api_url}/repos/{connection['external_ref']}", headers)
    branch = repo_info.get("default_branch") or "main"
    commits = await _fetch_json(
        client, f"{github_api_url}/repos/{connection['external_ref']}/commits", headers, {"per_page": max_commits, "sha": branch}
    )
    already_analyzed = repository.analyzed_commit_shas(connection["id"], [c["sha"] for c in commits])
    analyzed = 0
    for commit in commits:
        sha = commit["sha"]
        if sha in already_analyzed:
            continue
        result = await analyze_commit(client, github_api_url, headers, connection["external_ref"], sha)
        repository.upsert_commit_analysis(connection["workspace_id"], connection["id"], sha, branch, result)
        analyzed += 1
    return analyzed


ZERO_SHA = "0" * 40


def token_for_connection(admin, cipher, ci_connection_id: str, poll_token: str) -> str | None:
    """Same credential lookup GitHubGateway._token_for uses: the connection's own
    stored token first, falling back to the deployment-wide poll token."""
    if admin and cipher:
        rows = (
            admin.table("ci_credentials")
            .select("encrypted_secret")
            .eq("ci_connection_id", ci_connection_id)
            .limit(1)
            .execute()
            .data
        )
        if rows:
            return cipher.decrypt(rows[0]["encrypted_secret"])
    return poll_token or None


async def ingest_github_push_event(repository, connection: dict, payload: dict, github_token: str, github_api_url: str, client: httpx.AsyncClient) -> dict | None:
    """Analyzes a push event's head commit. Ignores branch-delete pushes
    (``after`` is all zeros) and commits already analyzed."""
    sha = payload.get("after")
    if not sha or sha == ZERO_SHA:
        return None
    if repository.analyzed_commit_shas(connection["id"], [sha]):
        return None
    branch = (payload.get("ref") or "").removeprefix("refs/heads/") or None
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    result = await analyze_commit(client, github_api_url, headers, connection["external_ref"], sha)
    repository.upsert_commit_analysis(connection["workspace_id"], connection["id"], sha, branch, result)
    return result


async def sync_all_commit_analyses(repository, github_token: str, github_api_url: str) -> dict:
    connections = repository.list_enabled_ci_connections()
    counts = {"connections": 0, "commits": 0, "errors": 0}
    async with httpx.AsyncClient(timeout=30.0) as client:
        for connection in connections:
            if connection["provider"] != "github_actions":
                continue
            counts["connections"] += 1
            try:
                counts["commits"] += await sync_commit_analysis_for_connection(repository, connection, github_token, github_api_url, client)
            except httpx.HTTPStatusError as exc:
                counts["errors"] += 1
                if exc.response.status_code == 403 and "rate limit" in exc.response.text.lower():
                    # Shared token, so every remaining connection would fail the same way.
                    break
    return counts
