import re
from pathlib import PurePath


def normalize_text(content: str, chunk_size: int = 1200) -> list[dict]:
    """Split normalized text on word boundaries while retaining source offsets."""
    text = content.strip()
    if not text:
        return []
    chunks = []
    start = 0
    ordinal = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            boundary = text.rfind(" ", start, end + 1)
            end = boundary if boundary > start else end
        value = text[start:end]
        chunks.append({"content": value, "start_offset": start, "end_offset": end, "ordinal": ordinal})
        start = end + 1 if end < len(text) and text[end] == " " else end
        ordinal += 1
    return chunks


def artifact_storage_key(organization_id: str, workspace_id: str, artifact_id: str, name: str) -> str:
    return f"{organization_id}/{workspace_id}/{artifact_id}/{PurePath(name).name}"


def convert_document(content: bytes, name: str) -> str:
    """Return local Markdown, using anydoc only for supported non-text files."""
    suffix = PurePath(name).suffix.lower().lstrip(".")
    if suffix in {"txt", "md", "markdown", "csv"}:
        return content.decode("utf-8")
    if suffix not in {"doc", "docx", "docm", "odt", "ods", "odp", "rtf", "epub", "pdf", "ppt", "pps", "pot", "pptx", "pptm", "ppsx", "ppsm", "xls", "xlsx", "xlsm", "xlsb"}:
        raise ValueError(f"Unsupported document type: .{suffix or 'unknown'}")
    import anydoc

    return anydoc.to_markdown_bytes(content, suffix)


def search_chunks(query: str, chunks: list[dict], limit: int = 8) -> list[dict]:
    terms = set(re.findall(r"[a-z0-9]+", query.lower()))
    results = []
    for chunk in chunks:
        score = len(terms & set(re.findall(r"[a-z0-9]+", chunk["content"].lower())))
        if score:
            results.append({"artifact_id": chunk["artifact_id"], "artifact_name": chunk["artifact_name"], "excerpt": chunk["content"], "start_offset": chunk["start_offset"], "end_offset": chunk["end_offset"], "score": score})
    return sorted(results, key=lambda item: (-item["score"], item["artifact_id"], item["start_offset"]))[:limit]
