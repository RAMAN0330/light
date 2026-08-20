"""Create the immutable Orbital-owned skill package snapshot from review sources."""
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.skills.catalog import SOURCES, UPSTREAM, build_catalog_from_sources


def main():
    package_root = Path(__file__).resolve().parents[1] / "app" / "skill_packages"
    target = package_root / "upstream_catalog.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(build_catalog_from_sources(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    packages = package_root / "packages"
    for source in SOURCES:
        source_root = UPSTREAM / source
        if not source_root.exists():
            continue
        source_target = packages / source
        source_target.mkdir(parents=True, exist_ok=True)
        for license_file in source_root.glob("LICENSE*"):
            shutil.copy2(license_file, source_target / license_file.name)
        for skill in source_root.rglob("SKILL.md"):
            relative = skill.parent.relative_to(source_root)
            destination = source_target / relative
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill, destination / "SKILL.md")
            for resource in ("references", "scripts", "assets", "templates"):
                origin = skill.parent / resource
                if origin.is_dir():
                    shutil.copytree(origin, destination / resource, dirs_exist_ok=True)
    print(target)


if __name__ == "__main__":
    main()
