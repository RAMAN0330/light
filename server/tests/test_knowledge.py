from app.services.knowledge import normalize_text, search_chunks
from app.services.knowledge import artifact_storage_key


def test_normalize_text_preserves_chunk_offsets():
    chunks = normalize_text("alpha beta gamma", chunk_size=10)
    assert chunks == [
        {"content": "alpha beta", "start_offset": 0, "end_offset": 10, "ordinal": 0},
        {"content": "gamma", "start_offset": 11, "end_offset": 16, "ordinal": 1},
    ]


def test_search_chunks_returns_workspace_source_citations():
    results = search_chunks("security review", [
        {"artifact_id": "artifact-1", "artifact_name": "brief.md", "content": "Security review is required.", "start_offset": 4, "end_offset": 32},
        {"artifact_id": "artifact-2", "artifact_name": "notes.md", "content": "Marketing plan", "start_offset": 0, "end_offset": 14},
    ])
    assert results == [{"artifact_id": "artifact-1", "artifact_name": "brief.md", "excerpt": "Security review is required.", "start_offset": 4, "end_offset": 32, "score": 2}]


def test_artifact_storage_key_is_server_generated_and_workspace_scoped():
    assert artifact_storage_key("org-1", "workspace-1", "artifact-1", "brief.md") == "org-1/workspace-1/artifact-1/brief.md"
import sys
from types import SimpleNamespace

from app.services.knowledge import convert_document


def test_convert_document_uses_anydoc_for_office_bytes(monkeypatch):
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "anydoc",
        SimpleNamespace(to_markdown_bytes=lambda content, format_name: calls.append((content, format_name)) or "# Converted"),
    )

    assert convert_document(b"document bytes", "brief.docx") == "# Converted"
    assert calls == [(b"document bytes", "docx")]


def test_convert_document_keeps_plain_text_local():
    assert convert_document(b"# Brief", "brief.md") == "# Brief"
