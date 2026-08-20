from pathlib import Path
import sys

import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


def orbital_module_paths() -> tuple[str, ...]:
    root = Path(__file__).resolve().parents[2] / "orbital_modules" / "upstream"
    return tuple(
        str(root / path)
        for path in ("document-ingestion/anydoc/python", "context-optimization", "web-research", "code-intelligence", "agent-workflows")
        if (root / path).exists()
    )


for module_path in reversed(orbital_module_paths()):
    if module_path not in sys.path:
        sys.path.insert(0, module_path)


from app.orbital_runners.runner import PluginExecutionError, execute


class PluginRequest(BaseModel):
    plugin: str = Field(min_length=1, max_length=80)
    arguments: list[str] = Field(default_factory=list, max_length=32)


app = FastAPI(title="Orbital Plugin Worker")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/execute")
def execute_plugin(body: PluginRequest, runner_token: str | None = Header(default=None, alias="X-Orbital-Runner-Token")):
    expected = os.getenv("ORBITAL_RUNNER_TOKEN", "")
    if not expected or runner_token != expected:
        raise HTTPException(status_code=401, detail="Runner authentication failed")
    try:
        return {"output": execute(body.plugin, body.arguments, "/workspace")}
    except PluginExecutionError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
