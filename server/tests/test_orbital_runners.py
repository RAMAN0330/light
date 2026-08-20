import pytest
from pathlib import Path

from app.orbital_runners.registry import plugin
from app.orbital_runners.runner import PluginExecutionError, build_command, worker_environment


def test_registry_declares_pinned_non_runner_capabilities():
    assert plugin("anydoc").command == ("anydoc",)
    assert plugin("agent-reach").network_mode == "approved_egress"
    assert plugin("hermes-process").command == ()


def test_plugin_command_rejects_unapproved_arguments():
    assert build_command("graphify", ["index", "/workspace/repo"]) == ["graphify", "index", "/workspace/repo"]
    with pytest.raises(PluginExecutionError):
        build_command("graphify", ["index", "; rm -rf /"])


def test_plugin_image_uses_orbital_module_sources():
    dockerfile = (Path(__file__).resolve().parents[1] / "orbital_runners.Dockerfile").read_text(encoding="utf-8")

    assert "COPY server/orbital_modules/upstream /orbital/modules/upstream" in dockerfile
    assert "/orbital/modules/upstream/context-optimization" in dockerfile
    assert "-r requirements.txt" in dockerfile
    assert "plugin-requirements.txt" not in dockerfile


def test_plugin_worker_exposes_orbital_module_paths():
    from app.orbital_runners.main import orbital_module_paths

    paths = orbital_module_paths()
    assert any(path.endswith("orbital_modules/upstream/context-optimization") for path in paths)
    assert any(path.endswith("orbital_modules/upstream/web-research") for path in paths)


def test_plugin_subprocess_gets_orbital_module_source_paths():
    environment = worker_environment()

    assert "orbital/modules/upstream/context-optimization" in environment["PYTHONPATH"] or "orbital_modules/upstream/context-optimization" in environment["PYTHONPATH"]
    assert "/orbital-runner-worker/node_modules/.bin" in environment["PATH"]


def test_orbital_capability_adapters_own_plugin_command_selection():
    from app.orbital_runners.adapters import adapter_for

    assert adapter_for("agent-reach").capability == "web-research"
    assert adapter_for("headroom").capability == "context-optimization"
    assert adapter_for("graphify").command(["index", "/workspace/repo"]) == ["graphify", "index", "/workspace/repo"]
    assert adapter_for("hermes-process") is None
