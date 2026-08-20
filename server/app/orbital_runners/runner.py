"""Subprocess boundary for plugins; never invokes a shell."""
from pathlib import Path
import os
import re
import shutil
import subprocess

from app.orbital_runners.registry import plugin
from app.orbital_runners.adapters import adapter_for


class PluginExecutionError(RuntimeError):
    pass


def worker_environment() -> dict[str, str]:
    """Minimal child environment with Orbital module sources before packages."""
    modules = Path(__file__).resolve().parents[2] / "orbital_modules" / "upstream"
    python_paths = [modules / path for path in ("document-ingestion/anydoc/python", "context-optimization", "web-research", "code-intelligence", "agent-workflows")]
    return {
        "PATH": "/orbital-runner-worker/node_modules/.bin:/usr/local/bin:/usr/bin:/bin",
        "PYTHONPATH": os.pathsep.join(str(path) for path in python_paths if path.exists()),
        "NODE_PATH": f"{modules / 'code-context'}:/orbital-runner-worker/node_modules",
    }


def build_command(plugin_id: str, arguments: list[str]) -> list[str]:
    spec = plugin(plugin_id)
    adapter = adapter_for(plugin_id)
    if not spec.command or not adapter:
        raise PluginExecutionError(f"{plugin_id} is a process-only plugin with no external runner")
    if any(not isinstance(argument, str) or len(argument) > 1024 or re.search(r"[;&|`$<>\x00]", argument) for argument in arguments):
        raise PluginExecutionError("Plugin arguments contain unsupported characters")
    return adapter.command(arguments)


def execute(plugin_id: str, arguments: list[str], cwd: str, timeout: int = 60) -> str:
    command = build_command(plugin_id, arguments)
    if not shutil.which(command[0]):
        raise PluginExecutionError(f"Plugin binary is unavailable: {command[0]}")
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=True, env=worker_environment())
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise PluginExecutionError(f"Plugin execution failed: {error}") from error
    return result.stdout
