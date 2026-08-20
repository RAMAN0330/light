from pathlib import Path


def test_orbital_modules_snapshot_copies_core_sources_and_preserves_notices(tmp_path: Path):
    from app.orbital_modules.upstream import materialize

    source = tmp_path / "reviewed-source"
    (source / "agent_reach").mkdir(parents=True)
    (source / "LICENSE").write_text("MIT", encoding="utf-8")
    (source / "agent_reach" / "core.py").write_text("core", encoding="utf-8")
    (source / "agent_reach" / "cli.py").write_text("runner", encoding="utf-8")
    target = tmp_path / "orbital_modules"

    result = materialize({"web-research": source}, target, modules=("web-research",))

    assert result["web-research"] == 1
    assert (target / "web-research" / "LICENSE").read_text(encoding="utf-8") == "MIT"
    assert (target / "web-research" / "agent_reach" / "core.py").exists()
    assert not (target / "web-research" / "agent_reach" / "cli.py").exists()


def test_orbital_modules_snapshot_rejects_agpl_source(tmp_path: Path):
    from app.orbital_modules.upstream import materialize

    try:
        materialize({}, tmp_path / "orbital_modules", modules=("odysseus",))
    except ValueError as error:
        assert "not permitted" in str(error)
    else:
        raise AssertionError("Odysseus must never be copied into Orbital modules")


def test_orbital_modules_snapshot_excludes_real_upstream_runners():
    root = Path(__file__).resolve().parents[1] / "orbital_modules" / "upstream"

    assert not (root / "web-research" / "agent_reach" / "cli.py").exists()
    assert not (root / "code-intelligence" / "graphify" / "cli.py").exists()
    assert not (root / "context-optimization" / "headroom" / "cli").exists()
    assert not (root / "agent-workflows" / "agent" / "conversation_loop.py").exists()
    assert not (root / "code-context" / "src" / "cli.ts").exists()
