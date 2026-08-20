from app.services.skills import catalog as catalog_module
from app.services.upstream_skills import catalog, resolve_published_skills


def test_catalog_exposes_permitted_sources_and_excludes_odysseus():
    packages = catalog()

    assert any(item["source"] == "hermes-agent" for item in packages)
    assert any(item["source"] == "agent-reach" for item in packages)
    assert any(item["source"] == "headroom" for item in packages)
    assert all(item["source"] != "odysseus" for item in packages)
    assert all(item["provenance"]["revision"] for item in packages)
    assert next(item for item in packages if item["source"] == "agent-reach")["manifest"]["plugin"] == "agent-reach"


def test_catalog_works_without_the_third_party_source_directory(monkeypatch):
    assert catalog_module.VENDORED_CATALOG.exists()
    monkeypatch.setattr(catalog_module, "UPSTREAM", catalog_module.ROOT / "missing-upstream")
    catalog_module.catalog.cache_clear()


def test_vendored_skill_files_match_the_catalog_and_exclude_odysseus():
    skill_files = list((catalog_module.VENDORED_PACKAGES).rglob("SKILL.md"))
    assert len(skill_files) == len(catalog()) - 3
    assert all("odysseus" not in path.parts for path in skill_files)
    assert catalog_module.catalog()
    catalog_module.catalog.cache_clear()


def test_resolver_uses_only_published_skills_and_declared_permissions():
    guidance = resolve_published_skills(
        [
            {"name": "Research", "status": "published", "manifest": {"instructions": "Collect sources.", "tools": ["web.search"], "data_access": ["workspace.knowledge.read"]}},
            {"name": "Draft", "status": "draft", "manifest": {"instructions": "Do not include.", "tools": [], "data_access": []}},
        ]
    )

    assert "Collect sources." in guidance
    assert "Do not include." not in guidance
    assert "web.search" in guidance
    assert "Undeclared tools" in guidance


def test_resolver_limits_published_skill_context_to_matching_processes():
    skills = [
        {"name": "Research workflow", "status": "published", "manifest": {"instructions": "Research.", "tools": [], "data_access": []}},
        {"name": "Spreadsheet workflow", "status": "published", "manifest": {"instructions": "Spreadsheets.", "tools": [], "data_access": []}},
    ]

    guidance = resolve_published_skills(skills, "research a topic")

    assert "Research." in guidance
    assert "Spreadsheets." not in guidance
