"""Materialize Orbital modules from an explicit, reviewed capability-to-source map."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.orbital_modules.upstream import materialize


def main():
    raw_sources = os.getenv("ORBITAL_MODULE_SOURCES_JSON", "")
    if not raw_sources:
        raise SystemExit("Set ORBITAL_MODULE_SOURCES_JSON to a reviewed capability-to-directory JSON map.")
    root = Path(__file__).resolve().parents[2]
    origins = {module: Path(directory) for module, directory in json.loads(raw_sources).items()}
    result = materialize(origins, root / "server" / "orbital_modules" / "upstream")
    print(result)


if __name__ == "__main__":
    main()
