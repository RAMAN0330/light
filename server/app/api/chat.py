import logging
import json
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.models.chat import ChatRequest, ConversationRenameRequest, ConversationRequest, ProjectDocumentRequest, ProjectInviteRequest, ProjectMemberRoleRequest, ProjectRequest
from app.services.chat import ChatService
from app.services.tool_calling import ToolGateway
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def current_user_from_token(app, access_token: str) -> str:
    try:
        response = app.state.supabase.auth.get_claims(access_token)
        claims = response.get("claims", response) if isinstance(response, dict) else response.claims if response else {}
        user_id = claims.get("sub")
    except Exception as error:
        logger.warning("Supabase token validation failed: %s", error)
        raise ValueError("Invalid access token") from error
    if not user_id:
        raise ValueError("Invalid access token")
    return user_id


def current_user(request: Request, authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        return current_user_from_token(request.app, authorization[7:])
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid access token") from error


def user_repository(request: Request, authorization: Optional[str]):
    current_user(request, authorization)
    return request.app.state.repository_for_token(authorization[7:])


def ai_for_conversation(app, repository, conversation_id: str):
    gateway = getattr(app.state, "provider_gateway", None)
    if not gateway:
        return app.state.ai
    organization_id = getattr(repository, "organization_for_conversation", lambda _id: None)(conversation_id)
    if not organization_id:
        return app.state.ai
    return gateway.ai_for_organization(organization_id)


def tool_gateway_for(app, access_token: str):
    if not settings.orbital_runner_url or not settings.orbital_runner_token or not hasattr(app.state, "organization_repository_for_token"):
        return None
    return ToolGateway(app.state.organization_repository_for_token(access_token), settings.orbital_runner_url, settings.orbital_runner_token)


@router.get("/conversations")
def list_conversations(request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    return user_repository(request, authorization).list_conversations(user_id)


@router.post("/conversations")
def create_conversation(
    body: ConversationRequest, request: Request, authorization: Optional[str] = Header(default=None)
):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if body.project_id and not repository.owns_project(user_id, body.project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    if body.workspace_id and not repository.owns_workspace(user_id, body.workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_conversation(user_id, body.title, body.project_id, body.workspace_id)

@router.get("/projects")
def list_projects(request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    return user_repository(request, authorization).list_projects(user_id)

@router.post("/projects")
def create_project(body: ProjectRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    return user_repository(request, authorization).create_project(user_id, body.name, body.instructions)

@router.patch("/projects/{project_id}")
def update_project(project_id: str, body: ProjectRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(user_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    return repository.update_project(user_id, project_id, body.name, body.instructions)

@router.post("/projects/{project_id}/invites", status_code=204)
def invite_project_member(project_id: str, body: ProjectInviteRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    owner_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(owner_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    admin = getattr(request.app.state, "admin_supabase", None)
    if not admin: raise HTTPException(status_code=503, detail="Invitations are not configured")
    user = next((item for item in admin.auth.admin.list_users(page=1, per_page=1000) if item.email and item.email.lower() == body.email.lower()), None)
    if not user: raise HTTPException(status_code=404, detail="Ask this person to create an account first")
    admin.table("project_members").upsert({"project_id": project_id, "user_id": user.id, "role": "editor"}).execute()

@router.get("/projects/{project_id}/members")
def list_project_members(project_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    owner_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(owner_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    admin = request.app.state.admin_supabase
    members = admin.table("project_members").select("user_id,role").eq("project_id", project_id).execute().data
    users = {user.id: user.email for user in admin.auth.admin.list_users(page=1, per_page=1000)}
    return [{**member, "email": users.get(member["user_id"], "Unknown user")} for member in members]

@router.patch("/project-members/{user_id}", status_code=204)
def update_project_member(user_id: str, body: ProjectMemberRoleRequest, project_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    owner_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(owner_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    request.app.state.admin_supabase.table("project_members").update({"role": body.role}).eq("project_id", project_id).eq("user_id", user_id).execute()

@router.delete("/project-members/{user_id}", status_code=204)
def remove_project_member(user_id: str, project_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    owner_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(owner_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    request.app.state.admin_supabase.table("project_members").delete().eq("project_id", project_id).eq("user_id", user_id).execute()

@router.post("/projects/{project_id}/documents")
def add_project_document(project_id: str, body: ProjectDocumentRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(user_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    return repository.add_project_document(user_id, project_id, body.name, body.content)

@router.get("/projects/{project_id}/documents")
def list_project_documents(project_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = user_repository(request, authorization)
    if not repository.owns_project(user_id, project_id): raise HTTPException(status_code=404, detail="Project not found")
    return repository.list_project_documents(project_id)

@router.delete("/project-documents/{document_id}", status_code=204)
def delete_project_document(document_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    user_repository(request, authorization).delete_project_document(user_id, document_id)


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if not repository.owns_conversation(user_id, conversation_id):
        raise HTTPException(status_code=403, detail="Conversation not found")
    return repository.list_messages(conversation_id)


@router.get("/conversations/{conversation_id}/runs")
def list_agent_runs(conversation_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if not repository.owns_conversation(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return repository.list_agent_runs(conversation_id)


@router.post("/agent-runs/{run_id}/cancel", status_code=204)
def cancel_agent_run(run_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    run = repository.agent_run(run_id)
    if not run or run["requested_by"] != user_id:
        raise HTTPException(status_code=404, detail="Agent run not found")
    if not repository.cancel_agent_run(run_id):
        raise HTTPException(status_code=409, detail="Agent run is no longer running")


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if not repository.owns_conversation(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    repository.delete_conversation(user_id, conversation_id)


@router.patch("/conversations/{conversation_id}", status_code=204)
def rename_conversation(conversation_id: str, body: ConversationRenameRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if not repository.owns_conversation(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    repository.rename_conversation(user_id, conversation_id, body.title.strip())


@router.post("/conversations/{conversation_id}/archive", status_code=204)
def archive_conversation(conversation_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    if not repository.owns_conversation(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    repository.archive_conversation(user_id, conversation_id)


@router.post("/chat")
async def chat(body: ChatRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = user_repository(request, authorization)
    service = ChatService(repository, ai_for_conversation(request.app, repository, body.conversation_id), tool_gateway_for(request.app, authorization[7:]))
    try:
        async def event_stream():
            announced_run = False
            try:
                async for text in service.reply(user_id, body.conversation_id, body.content, body.mode):
                    if service.run_id and not announced_run:
                        yield f"data: {json.dumps({'type': 'run', 'run_id': service.run_id})}\n\n"
                        announced_run = True
                    yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception:
                logger.exception("SSE chat failed")
                yield f"data: {json.dumps({'type': 'error', 'message': 'The assistant could not reply. Please try again.'})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail="Conversation not found") from error


@router.websocket("/ws/chat")
async def chat_websocket(socket: WebSocket):
    await socket.accept()
    try:
        payload = await socket.receive_json()
        access_token = payload.get("access_token", "")
        body = ChatRequest(**payload)
        user_id = current_user_from_token(socket.app, access_token)
        repository = socket.app.state.repository_for_token(access_token)
        service = ChatService(repository, ai_for_conversation(socket.app, repository, body.conversation_id), tool_gateway_for(socket.app, access_token))

        announced_run = False
        async for text in service.reply(user_id, body.conversation_id, body.content, body.mode):
            if service.run_id and not announced_run:
                await socket.send_json({"type": "run", "run_id": service.run_id})
                announced_run = True
            await socket.send_json({"type": "delta", "text": text})
        await socket.send_json({"type": "done"})
    except WebSocketDisconnect:
        return
    except (ValueError, PermissionError) as error:
        await socket.send_json({"type": "error", "message": str(error)})
    except Exception:
        logger.exception("WebSocket chat failed")
        await socket.send_json({"type": "error", "message": "The assistant could not reply. Please try again."})
    finally:
        try:
            await socket.close()
        except RuntimeError:
            pass
