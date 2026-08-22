from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uuid
from .tasks import analyze_repo_task, get_task_status, set_task_status

app = FastAPI(title="CodeFlow Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepoAnalysisRequest(BaseModel):
    url: str
    token: Optional[str] = None
    branch: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "RepoScope Engine is running"}

@app.post("/api/analyze")
async def trigger_analysis(request: RepoAnalysisRequest):
    task_id = str(uuid.uuid4())
    try:
        set_task_status(task_id, {"status": "queued", "progress": 0})
        analyze_repo_task.delay(task_id, request.url, request.token, request.branch)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Task queue unavailable (Celery/Redis may be down): {e}"
        )
    return {"task_id": task_id, "status": "queued"}

@app.get("/api/tasks/{task_id}")
async def check_task(task_id: str):
    status = get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status
