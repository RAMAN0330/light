"""Read-only catalog for audited upstream skill-process packages."""
from functools import lru_cache
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
UPSTREAM = ROOT / "third_party" / "upstream"
VENDORED_CATALOG = ROOT / "server" / "app" / "skill_packages" / "upstream_catalog.json"
VENDORED_PACKAGES = ROOT / "server" / "app" / "skill_packages" / "packages"
SOURCES = {
    "hermes-agent": {"license": "MIT", "attribution": "Nous Research / Hermes Agent"},
    "agent-reach": {"license": "MIT", "attribution": "Agent Reach contributors"},
    "task-observer": {"license": "CC BY 4.0", "attribution": "rebelytics / one-skill-to-rule-them-all"},
    "anydoc": {"license": "MIT", "attribution": "Firecrawl / anydoc"},
    "headroom": {"license": "Apache-2.0", "attribution": "Headroom Labs"},
    "graphify": {"license": "Apache-2.0/MIT", "attribution": "Graphify Labs"},
    "graft": {"license": "MIT", "attribution": "NanoNets / Graft"},
}
PROCESS_PACKAGES = {
    "headroom": ("Context management", "Compress and retrieve context with provenance; keep original workspace sources available."),
    "graphify": ("Code graph analysis", "Build local code graphs and answer impact-analysis queries only through declared graph tools."),
    "graft": ("Developer context graph", "Use a user-controlled local code map for symbol and impact analysis; never edit developer configuration."),
}
SOURCE_PLUGIN = {
    "hermes-agent": "hermes-process",
    "agent-reach": "agent-reach",
    "task-observer": "task-observer",
    "anydoc": "anydoc",
    "headroom": "headroom",
    "graphify": "graphify",
    "graft": "graft",
}


def _frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    _, block, body = text.split("---\n", 2)
    return ({match.group(1): match.group(2).strip() for line in block.splitlines() if (match := re.match(r"^([\w-]+):\s*[\"']?(.*?)[\"']?$", line))}, body.strip())


def _revision(path: Path) -> str:
    try:
        return subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unavailable"


def _package(source: str, path: Path, title: str, description: str, body: str) -> dict:
    relative = path.relative_to(UPSTREAM / source).as_posix() if path.exists() else "PROCESS.md"
    revision = _revision(UPSTREAM / source)
    plugin = SOURCE_PLUGIN[source]
    return {"id": re.sub(r"[^a-z0-9]+", "-", f"{source}-{relative}").strip("-")[:180], "name": title[:120], "version": revision[:12], "source": source, "license": SOURCES[source]["license"], "attribution": SOURCES[source]["attribution"], "description": description[:1000], "manifest": {"plugin": plugin, "tools": [f"plugin.{plugin}.invoke"], "data_access": ["workspace.knowledge.read"], "network_mode": "approved_egress" if source == "agent-reach" else "none", "approval_class": "automatic", "instructions": body, "dependency_manifest": {"build_time": [plugin], "runtime": []}}, "provenance": {"source_path": relative, "revision": revision}}


def build_catalog_from_sources() -> tuple[dict, ...]:
    packages = []
    for source in SOURCES:
        directory = UPSTREAM / source
        if not directory.exists():
            continue
        for skill_path in directory.rglob("SKILL.md"):
            metadata, body = _frontmatter(skill_path.read_text(encoding="utf-8", errors="replace"))
            packages.append(_package(source, skill_path, metadata.get("name", skill_path.parent.name), metadata.get("description", "Upstream process package"), body))
        if source in PROCESS_PACKAGES:
            packages.append(_package(source, directory / "PROCESS.md", *PROCESS_PACKAGES[source], PROCESS_PACKAGES[source][1]))
    return tuple(sorted(packages, key=lambda item: (item["source"], item["name"], item["id"])))


@lru_cache(maxsize=1)
def catalog() -> tuple[dict, ...]:
    if VENDORED_CATALOG.exists():
        return tuple(json.loads(VENDORED_CATALOG.read_text(encoding="utf-8")))
    return build_catalog_from_sources()
