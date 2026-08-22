import os
import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
import redis
from git import Repo
from .worker import celery_app

_redis = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
TASK_TTL = 3600  # 1 hour
GRAPHIFY_MAX_NODES = 10_000
GRAPHIFY_MAX_LINKS = 30_000
logger = logging.getLogger(__name__)


def set_task_status(task_id: str, data: dict):
    try:
        _redis.setex(f"cf:task:{task_id}", TASK_TTL, json.dumps(data))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Redis _set failed for task %s: %s", task_id, e)


def get_task_status(task_id: str):
    try:
        raw = _redis.get(f"cf:task:{task_id}")
        return json.loads(raw) if raw else None
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Redis get_task_status failed for task %s: %s", task_id, e)
        return None


def load_graphify_output(graph_path, max_nodes=GRAPHIFY_MAX_NODES, max_links=GRAPHIFY_MAX_LINKS):
    with Path(graph_path).open("r", encoding="utf-8") as graph_file:
        raw = json.load(graph_file)
    if not isinstance(raw, dict):
        raise ValueError("Graphify output must be a JSON object")

    nodes = []
    node_ids = set()
    for node in raw.get("nodes", []):
        if not isinstance(node, dict) or not isinstance(node.get("id"), str) or not node["id"]:
            continue
        if node["id"] in node_ids:
            continue
        nodes.append(node)
        node_ids.add(node["id"])
        if len(nodes) >= max_nodes:
            break

    links = []
    for link in raw.get("links", []):
        if not isinstance(link, dict):
            continue
        if link.get("source") not in node_ids or link.get("target") not in node_ids:
            continue
        links.append(link)
        if len(links) >= max_links:
            break

    graph_meta = raw.get("graph") if isinstance(raw.get("graph"), dict) else {}
    return {
        "nodes": nodes,
        "links": links,
        "hyperedges": [edge for edge in raw.get("hyperedges", []) if isinstance(edge, dict)][:max_links],
        "built_at_commit": raw.get("built_at_commit") or graph_meta.get("built_at_commit"),
    }


def run_graphify(repo_path):
    subprocess.run(
        ["graphify", "extract", str(repo_path), "--code-only", "--out", str(repo_path)],
        cwd=repo_path,
        check=True,
        capture_output=True,
        text=True,
        timeout=int(os.getenv("GRAPHIFY_TIMEOUT_SECONDS", "900")),
    )
    return load_graphify_output(Path(repo_path) / "graphify-out" / "graph.json")


def perform_analysis(path):
    analysis = perform_introspection(path)
    try:
        analysis["graphify"] = run_graphify(path)
    except Exception as exc:
        logger.warning("Graphify extraction failed; using browser graph fallback: %s", exc)
    return analysis


@celery_app.task(name="analyze_repo_task")
def analyze_repo_task(task_id, repo_url, token=None, branch="main"):
    set_task_status(task_id, {"status": "processing", "progress": 0})

    tmp_dir = tempfile.mkdtemp()
    try:
        auth_url = repo_url
        if token:
            auth_url = repo_url.replace("https://", f"https://{token}@")

        set_task_status(task_id, {"status": "processing", "progress": 20})
        clone_options = {"branch": branch} if branch else {}
        Repo.clone_from(auth_url, tmp_dir, **clone_options)

        set_task_status(task_id, {"status": "processing", "progress": 50})
        analysis = perform_analysis(tmp_dir)

        set_task_status(task_id, {"status": "completed", "progress": 100, "result": analysis})
    except Exception as e:
        set_task_status(task_id, {"status": "failed", "error": str(e)})
    finally:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

import ast

def perform_introspection(path):
    results = {
        "models": [],
        "views": [],
        "urls": [],
        "relationships": [],
        "stats": {
            "files": 0,
            "loc": 0
        }
    }
    
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith(".py"):
                results["stats"]["files"] += 1
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, path)
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        lines = content.splitlines()
                        results["stats"]["loc"] += len(lines)
                        
                        tree = ast.parse(content)
                        
                        # Introspect Django models
                        if file == "models.py" or "/models/" in rel_path:
                            for node in ast.walk(tree):
                                if isinstance(node, ast.ClassDef):
                                    model_info = {
                                        "name": node.name,
                                        "file": rel_path,
                                        "fields": []
                                    }
                                    for item in node.body:
                                        if isinstance(item, ast.Assign) and isinstance(item.targets[0], ast.Name):
                                            field_name = item.targets[0].id
                                            if isinstance(item.value, ast.Call):
                                                # Check for Django fields
                                                func = item.value.func
                                                field_type = ""
                                                if isinstance(func, ast.Attribute):
                                                    field_type = func.attr
                                                elif isinstance(func, ast.Name):
                                                    field_type = func.id
                                                
                                                if "Field" in field_type or field_type in ["ForeignKey", "OneToOneField", "ManyToManyField"]:
                                                    model_info["fields"].append({
                                                        "name": field_name,
                                                        "type": field_type
                                                    })
                                                    
                                                    # Track relationships
                                                    if field_type in ["ForeignKey", "OneToOneField", "ManyToManyField"]:
                                                        target = ""
                                                        if item.value.args:
                                                            arg = item.value.args[0]
                                                            if isinstance(arg, ast.Constant):
                                                                target = arg.value
                                                            elif isinstance(arg, ast.Name):
                                                                target = arg.id
                                                        
                                                        results["relationships"].append({
                                                            "source": node.name,
                                                            "target": target,
                                                            "type": field_type,
                                                            "field": field_name
                                                        })
                                    results["models"].append(model_info)
                        
                        elif file == "views.py":
                            results["views"].append(rel_path)
                        elif file == "urls.py":
                            results["urls"].append(rel_path)
                except:
                    continue
                    
    return results
