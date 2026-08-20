"""Select bounded published skill guidance for an Orbital run."""
import re


def resolve_published_skills(skills: list[dict], query: str = "", maximum: int = 3) -> str:
    terms = set(re.findall(r"[a-z0-9]+", query.lower()))
    selected = [item for item in skills if item.get("status") == "published"]
    if terms:
        selected = [item for item in selected if terms & set(re.findall(r"[a-z0-9]+", f"{item.get('name', '')} {(item.get('manifest') or {}).get('instructions', '')}".lower()))]
    sections = []
    for skill in selected[:maximum]:
        manifest = skill.get("manifest") or {}
        instructions = manifest.get("instructions", "")
        if isinstance(instructions, str):
            sections.append(f"## Skill: {skill.get('name', 'Unnamed')}\nDeclared tools: {', '.join(manifest.get('tools') or []) or 'none'}\nDeclared data access: {', '.join(manifest.get('data_access') or []) or 'none'}\n{instructions}")
    return "\n\n".join(["Orbital skill policy: use only declared tools and data access. Undeclared tools, secrets, network destinations, and side effects are forbidden.", *sections]) if sections else ""
