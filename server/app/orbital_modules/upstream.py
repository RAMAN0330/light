"""Create the reproducible non-runner upstream source snapshot used by Orbital."""
from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
import shutil


MODULES = {
    "agent-workflows": ("agent",),
    "web-research": ("agent_reach",),
    "document-ingestion": ("python/anydoc",),
    "context-optimization": ("headroom",),
    "code-intelligence": ("graphify",),
    "code-context": ("src",),
    "skill-observation": (),
}

RUNNER_PATHS = {
    "agent-workflows": {
        "agent/conversation_loop.py", "agent/codex_runtime.py", "agent/oneshot.py",
        "agent/tool_executor.py", "agent/relay_runtime.py", "agent/relay_tools.py",
        "agent/process_bootstrap.py",
    },
    "web-research": {"agent_reach/cli.py", "agent_reach/integrations/mcp_server.py"},
    "context-optimization": {"headroom/cli.py", "headroom/cli", "headroom/dashboard", "headroom/install"},
    "code-intelligence": {"graphify/__main__.py", "graphify/cli.py", "graphify/serve.py", "graphify/watch.py", "graphify/install.py"},
    "code-context": {
        "src/cli.ts", "src/cli-epilogue.ts", "src/cli-meta.ts", "src/cli-picker.ts",
        "src/mcp", "src/viz/serve.ts", "src/upkeep-run.ts",
    },
    "document-ingestion": set(),
    "skill-observation": set(),
}


def _ignore(module: str):
    excluded = RUNNER_PATHS[module]

    def ignore(directory: str, names: list[str]) -> set[str]:
        base = Path(directory)
        skipped: set[str] = set()
        for name in names:
            relative = (base / name).as_posix()
            if any(relative.endswith(path) or relative.endswith(f"{path}/") for path in excluded):
                skipped.add(name)
        return skipped

    return ignore


def materialize(origins: Mapping[str, Path], destination: Path, *, modules: tuple[str, ...] = tuple(MODULES)) -> dict[str, int]:
    """Copy approved libraries and notices, never an upstream runner or AGPL source."""
    unknown = set(modules) - set(MODULES)
    if unknown:
        raise ValueError(f"Orbital module is not permitted for materialization: {', '.join(sorted(unknown))}")
    result: dict[str, int] = {}
    for module in modules:
        origin = origins.get(module)
        if origin is None:
            raise FileNotFoundError(f"Missing reviewed source for Orbital module: {module}")
        target = destination / module
        if not origin.exists():
            raise FileNotFoundError(origin)
        target.mkdir(parents=True, exist_ok=True)
        for notice in (*origin.glob("LICENSE*"), *origin.glob("NOTICE*")):
            if notice.is_file():
                shutil.copy2(notice, target / notice.name)
        copied = 0
        for relative in MODULES[module]:
            library = origin / relative
            if not library.exists():
                raise FileNotFoundError(library)
            output = target / relative
            shutil.copytree(library, output, dirs_exist_ok=True, ignore=_ignore(module))
            copied += sum(1 for path in output.rglob("*") if path.is_file())
        result[module] = copied
    return result
