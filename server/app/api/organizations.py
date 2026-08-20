import csv
import hashlib
import ipaddress
import io
import json
import logging
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import Response

from app.api.chat import current_user
from app.core.config import settings
from app.repositories.organizations import SupabaseOrganizationRepository
from app.services import github_oauth
from app.services.ci_gateway import CiGateway
from app.services.db_gateway import DbGateway
from app.services.db_gateway import _safe_host as safe_db_host
from app.services.ci_ingestion import ingest_github_webhook_event, verify_github_webhook_signature
from app.services.github_gateway import GitHubGateway
from app.services.infra_gateway import InfraGateway, InfraGatewayError
from app.services.knowledge import artifact_storage_key, convert_document, normalize_text, search_chunks
from app.services.upstream_skills import catalog
from app.models.chat import (
    ApprovalDecisionRequest,
    AdapterCreate,
    CiConnectionCreate,
    CiCredentialCreate,
    CiTriggerRequest,
    CollectionArtifactCreate,
    DbConnectionCreate,
    CollectionCreate,
    CollectionQuery,
    InfraActionRequest,
    InfraConnectionCreate,
    ResearchReportCreate,
    SkillObservationCreate,
    WorkspaceNoteCreate,
    WorkspaceTaskCreate,
    WorkspaceTaskUpdate,
    ScheduleCreate,
    ScheduleEnabledUpdate,
    DelegatedRunCreate,
    RetentionPolicyUpdate,
    ExternalConnectionCreate,
    ApprovalRequestCreate,
    ConnectorCreate,
    ConnectorEnabledUpdate,
    CustomRoleCreate,
    CustomRoleAssignment,
    OrganizationMemberRoleRequest,
    OrganizationMemberCreate,
    OrganizationRequest,
    ProviderCredentialCreate,
    PolicyDecisionRequest,
    PolicyCreate,
    SkillCreate,
    SkillStatusUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def organization_repository(request: Request, authorization: Optional[str]):
    current_user(request, authorization)
    return request.app.state.organization_repository_for_token(authorization[7:])


def organization_bootstrap_repository(request: Request, authorization: Optional[str]):
    """Create the initial organization with the server client after JWT validation.

    A brand-new user has no membership yet, so RLS cannot reliably authorize the
    three dependent inserts (organization, owner membership, workspace).
    """
    current_user(request, authorization)
    admin = getattr(request.app.state, "admin_supabase", None)
    return SupabaseOrganizationRepository(admin) if admin else organization_repository(request, authorization)


@router.post("/agent-runs/{run_id}/delegations", status_code=201)
def create_delegated_run(
    run_id: str,
    body: DelegatedRunCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    parent = repository.agent_run_for_workspace(run_id)
    if not parent or not repository.can_manage_workspace(user_id, parent["workspace_id"]):
        raise HTTPException(status_code=404, detail="Agent run not found")
    return repository.create_delegated_run(user_id, parent, body.scope)


@router.put("/workspaces/{workspace_id}/retention")
def set_retention_policy(
    workspace_id: str,
    body: RetentionPolicyUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.set_retention_policy(user_id, workspace_id, body.retention_days, body.legal_hold)


@router.get("/workspaces/{workspace_id}/retention")
def workspace_retention_policy(
    workspace_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.retention_policy(workspace_id) or {"workspace_id": workspace_id, "retention_days": None, "legal_hold": False}


@router.get("/workspaces/{workspace_id}/usage")
def workspace_usage(
    workspace_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.usage_summary(workspace_id)


@router.post("/organizations", status_code=201)
def create_organization(
    body: OrganizationRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    try:
        return organization_bootstrap_repository(request, authorization).create_organization(user_id, body.name.strip())
    except Exception as error:
        logger.exception("Failed to bootstrap organization for user %s", user_id)
        raise HTTPException(status_code=500, detail="Unexpected server error") from error


@router.get("/workspaces")
def list_workspaces(
    request: Request, authorization: Optional[str] = Header(default=None)
):
    user_id = current_user(request, authorization)
    return organization_repository(request, authorization).list_workspaces(user_id)


@router.get("/organizations/{organization_id}/audit-events")
def list_audit_events(
    organization_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return repository.list_audit_events(organization_id)


@router.get("/organizations/{organization_id}/audit-events/export")
def export_audit_events(
    organization_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    output = io.StringIO()
    columns = ("id", "organization_id", "workspace_id", "actor_id", "action", "resource_type", "resource_id", "details", "created_at")
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for event in repository.list_audit_events(organization_id):
        writer.writerow({**event, "details": json.dumps(event.get("details", {}), sort_keys=True)})
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="orbital-audit-{organization_id}.csv"'},
    )


@router.get("/organizations/{organization_id}/provider-credentials")
def list_provider_credentials(
    organization_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return (
        organization_admin(request)
        .table("provider_credentials")
        .select("id,label,provider,model,created_by,revoked_at,created_at")
        .eq("organization_id", organization_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def organization_admin(request: Request):
    admin = getattr(request.app.state, "admin_supabase", None)
    if not admin:
        raise HTTPException(status_code=503, detail="Organization administration is not configured")
    return admin


def credential_cipher(request: Request):
    cipher = getattr(request.app.state, "credential_cipher", None)
    if not cipher:
        raise HTTPException(status_code=503, detail="Credential vault is not configured")
    return cipher


def safe_connector_endpoint(endpoint: str) -> bool:
    """Reject endpoints that would let a connector target local services."""
    parsed = urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.hostname.lower() == "localhost":
        return False
    try:
        return ipaddress.ip_address(parsed.hostname).is_global
    except ValueError:
        return True


@router.post("/organizations/{organization_id}/provider-credentials", status_code=201)
def create_provider_credential(
    organization_id: str,
    body: ProviderCredentialCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    credential = (
        organization_admin(request)
        .table("provider_credentials")
        .insert(
            {
                "organization_id": organization_id,
                "label": body.label,
                "provider": body.provider,
                "encrypted_secret": credential_cipher(request).encrypt(body.secret),
                "model": body.model,
                "created_by": user_id,
            }
        )
        .execute()
        .data[0]
    )
    return {
        key: credential[key]
        for key in ("id", "label", "provider", "model", "created_by", "revoked_at", "created_at")
    }


@router.get("/organizations/{organization_id}/members")
def list_members(
    organization_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return (
        organization_admin(request)
        .table("organization_memberships")
        .select("user_id,role,created_at")
        .eq("organization_id", organization_id)
        .order("created_at")
        .execute()
        .data
    )


@router.post("/organizations/{organization_id}/members", status_code=204)
def create_member(
    organization_id: str,
    body: OrganizationMemberCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    organization_admin(request).table("organization_memberships").upsert(
        {"organization_id": organization_id, "user_id": body.user_id, "role": body.role}
    ).execute()


@router.post("/organizations/{organization_id}/custom-roles", status_code=201)
def create_custom_role(
    organization_id: str,
    body: CustomRoleCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return repository.create_custom_role(user_id, organization_id, body.name, body.permissions)


@router.put("/organizations/{organization_id}/members/{member_id}/custom-role", status_code=204)
def assign_custom_role(
    organization_id: str,
    member_id: str,
    body: CustomRoleAssignment,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    if not repository.owns_custom_role(organization_id, body.role_id):
        raise HTTPException(status_code=404, detail="Custom role not found")
    if not repository.is_organization_member(organization_id, member_id):
        raise HTTPException(status_code=404, detail="Member not found")
    repository.assign_custom_role(organization_id, member_id, body.role_id)


@router.patch("/organizations/{organization_id}/members/{member_id}", status_code=204)
def update_member_role(
    organization_id: str,
    member_id: str,
    body: OrganizationMemberRoleRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_organization(user_id, organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    admin = organization_admin(request)
    existing = (
        admin.table("organization_memberships")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", member_id)
        .limit(1)
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    if existing[0]["role"] == "owner" and body.role != "owner":
        owners = (
            admin.table("organization_memberships")
            .select("user_id")
            .eq("organization_id", organization_id)
            .eq("role", "owner")
            .execute()
            .data
        )
        if len(owners) == 1:
            raise HTTPException(status_code=422, detail="An organization must retain an owner")
    admin.table("organization_memberships").update({"role": body.role}).eq(
        "organization_id", organization_id
    ).eq("user_id", member_id).execute()


@router.get("/workspaces/{workspace_id}/approval-requests")
def list_approval_requests(
    workspace_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_approval_requests(workspace_id)


@router.post("/workspaces/{workspace_id}/approval-requests", status_code=201)
def create_approval_request(
    workspace_id: str,
    body: ApprovalRequestCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_approval_request(user_id, workspace_id, body.action, body.summary)


@router.post("/workspaces/{workspace_id}/policy-decisions")
def decide_policy(
    workspace_id: str,
    body: PolicyDecisionRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    decision = repository.policy_decision(workspace_id, body.action)
    if decision == "require_approval":
        return {
            "decision": decision,
            "approval": repository.create_approval_request(user_id, workspace_id, body.action, body.summary),
        }
    return {"decision": decision}


@router.post("/workspaces/{workspace_id}/policies", status_code=201)
def create_policy(
    workspace_id: str,
    body: PolicyCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_policy(user_id, workspace_id, body.action, body.decision)


@router.get("/workspaces/{workspace_id}/policies")
def list_policies(
    workspace_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_policies(workspace_id)


@router.post("/workspaces/{workspace_id}/skills", status_code=201)
def create_skill(
    workspace_id: str,
    body: SkillCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not isinstance(body.manifest.get("tools"), list) or not isinstance(
        body.manifest.get("data_access"), list
    ):
        raise HTTPException(
            status_code=422,
            detail="Skill manifest must declare tools and data_access lists",
        )
    return repository.create_skill(user_id, workspace_id, body.name, body.version, body.manifest)


@router.get("/upstream-skills")
def list_upstream_skills():
    return catalog()


@router.post("/workspaces/{workspace_id}/upstream-skills/import", status_code=201)
def import_upstream_skills(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    imported = skipped = 0
    for package in catalog():
        name = f"{package['source']}: {package['name']}"[:120]
        if repository.skill_exists(workspace_id, name, package["version"]):
            skipped += 1
            continue
        repository.create_imported_skill(user_id, workspace_id, {**package, "name": name})
        imported += 1
    return {"imported": imported, "skipped": skipped}


@router.get("/workspaces/{workspace_id}/skills")
def list_skills(
    workspace_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_skills(workspace_id)


@router.get("/workspaces/{workspace_id}/artifacts")
def list_artifacts(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_artifacts(workspace_id)


@router.post("/workspaces/{workspace_id}/artifacts", status_code=201)
async def upload_artifact(workspace_id: str, name: str, mime_type: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    content = await request.body()
    allowed_extensions = {".txt", ".md", ".markdown", ".csv", ".doc", ".docx", ".docm", ".odt", ".ods", ".odp", ".rtf", ".epub", ".pdf", ".ppt", ".pps", ".pot", ".pptx", ".pptm", ".ppsx", ".ppsm", ".xls", ".xlsx", ".xlsm", ".xlsb"}
    if not content or len(content) > 5_000_000 or not any(name.lower().endswith(extension) for extension in allowed_extensions): raise HTTPException(status_code=422, detail="Only supported documents up to 5 MB are accepted")
    organization_id = repository.workspace_organization(workspace_id)
    storage_key = artifact_storage_key(organization_id, workspace_id, str(uuid4()), name)
    organization_admin(request).storage.from_("orbital-artifacts").upload(storage_key, content, {"content-type": mime_type})
    return repository.create_artifact(user_id, workspace_id, name, mime_type, storage_key, hashlib.sha256(content).hexdigest())


@router.post("/artifacts/{artifact_id}/normalize", status_code=204)
def normalize_artifact(artifact_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); artifact = repository.artifact(artifact_id)
    if not artifact or not repository.owns_workspace(user_id, artifact["workspace_id"]): raise HTTPException(status_code=404, detail="Artifact not found")
    try:
        data = organization_admin(request).storage.from_("orbital-artifacts").download(artifact["storage_key"])
        repository.replace_artifact_chunks(artifact_id, normalize_text(convert_document(data, artifact.get("name", artifact["storage_key"]))))
    except (UnicodeDecodeError, AttributeError, ImportError, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Artifact cannot be normalized: {error}")
    repository.set_artifact_normalized(artifact_id)


@router.get("/artifacts/{artifact_id}/download")
def download_artifact(artifact_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); artifact = repository.artifact(artifact_id)
    if not artifact or not repository.owns_workspace(user_id, artifact["workspace_id"]): raise HTTPException(status_code=404, detail="Artifact not found")
    admin = organization_admin(request)
    signed = admin.storage.from_("orbital-artifacts").create_signed_url(artifact["storage_key"], 300)
    return {"url": signed.get("signedURL") or signed.get("signed_url")}


@router.post("/workspaces/{workspace_id}/adapters", status_code=201)
def create_adapter(workspace_id: str, body: AdapterCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_adapter(user_id, workspace_id, body.name, body.manifest)


@router.post("/workspaces/{workspace_id}/collections", status_code=201)
def create_collection(workspace_id: str, body: CollectionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_collection(user_id, workspace_id, body.name)


@router.get("/workspaces/{workspace_id}/collections")
def list_collections(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_collections(workspace_id)


@router.post("/collections/{collection_id}/artifacts", status_code=204)
def add_collection_artifact(collection_id: str, body: CollectionArtifactCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); collection = repository.collection(collection_id)
    if not collection or not repository.owns_workspace(user_id, collection["workspace_id"]): raise HTTPException(status_code=404, detail="Collection not found")
    repository.add_collection_artifact(collection_id, body.artifact_id)


@router.post("/collections/{collection_id}/query")
def query_collection(collection_id: str, body: CollectionQuery, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); collection = repository.collection(collection_id)
    if not collection or not repository.owns_workspace(user_id, collection["workspace_id"]): raise HTTPException(status_code=404, detail="Collection not found")
    chunks = [{"artifact_id": row["artifacts"]["id"], "artifact_name": row["artifacts"]["name"], **chunk} for row in repository.collection_chunks(collection_id) for chunk in (row.get("artifacts") or {}).get("knowledge_chunks", [])]
    return search_chunks(body.query, chunks)


@router.post("/workspaces/{workspace_id}/research-reports", status_code=201)
def create_research_report(workspace_id: str, body: ResearchReportCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_research_report(user_id, workspace_id, body.title, body.content, body.citations)


@router.post("/workspaces/{workspace_id}/skill-observations", status_code=201)
def create_skill_observation(workspace_id: str, body: SkillObservationCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    if not isinstance(body.manifest.get("tools"), list) or not isinstance(body.manifest.get("data_access"), list): raise HTTPException(status_code=422, detail="Observation manifest must declare tools and data_access lists")
    return repository.create_observation(user_id, workspace_id, body.title, body.manifest)


@router.get("/workspaces/{workspace_id}/tasks")
def list_tasks(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_tasks(workspace_id)


@router.post("/workspaces/{workspace_id}/tasks", status_code=201)
def create_task(workspace_id: str, body: WorkspaceTaskCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_task(user_id, workspace_id, body.title, body.description)


@router.get("/workspaces/{workspace_id}/notes")
def list_notes(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_notes(workspace_id)


@router.post("/workspaces/{workspace_id}/notes", status_code=201)
def create_note(workspace_id: str, body: WorkspaceNoteCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_note(user_id, workspace_id, body.title, body.content)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, body: WorkspaceTaskUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); task = repository.task(task_id)
    if not task or not repository.owns_workspace(user_id, task["workspace_id"]): raise HTTPException(status_code=404, detail="Task not found")
    return repository.update_task_status(task_id, body.status)


@router.get("/workspaces/{workspace_id}/notifications")
def list_notifications(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_notifications(user_id, workspace_id)


@router.post("/notifications/{notification_id}/read", status_code=204)
def read_notification(notification_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    organization_repository(request, authorization).mark_notification_read(user_id, notification_id)


@router.get("/workspaces/{workspace_id}/activity")
def workspace_activity(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.workspace_activity(workspace_id)


@router.get("/workspaces/{workspace_id}/schedules")
def list_schedules(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_schedules(workspace_id)


@router.post("/workspaces/{workspace_id}/schedules", status_code=201)
def create_schedule(workspace_id: str, body: ScheduleCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id): raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_schedule(user_id, workspace_id, body.title, body.cron_expression)


@router.patch("/schedules/{schedule_id}")
def update_schedule(schedule_id: str, body: ScheduleEnabledUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); schedule = repository.schedule(schedule_id)
    if not schedule or not repository.can_manage_workspace(user_id, schedule["workspace_id"]): raise HTTPException(status_code=404, detail="Schedule not found")
    return repository.set_schedule_enabled(schedule_id, body.enabled)


@router.get("/schedules/{schedule_id}/executions")
def list_schedule_executions(schedule_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); schedule = repository.schedule(schedule_id)
    if not schedule or not repository.owns_workspace(user_id, schedule["workspace_id"]):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return repository.list_schedule_executions(schedule_id)


EXTERNAL_CONNECTION_SCOPES = {
    "gmail": {"gmail.readonly", "gmail.send"},
    "outlook_email": {"mail.read", "mail.send"},
    "google_calendar": {"calendar.events.readonly", "calendar.events"},
    "outlook_calendar": {"calendars.read", "calendars.readwrite"},
    "github": {"repo"},
}


@router.get("/workspaces/{workspace_id}/external-connections")
def list_external_connections(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_external_connections(workspace_id)


@router.post("/workspaces/{workspace_id}/external-connections", status_code=201)
def create_external_connection(workspace_id: str, body: ExternalConnectionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    allowed_scopes = EXTERNAL_CONNECTION_SCOPES[body.provider]
    if not set(body.scopes).issubset(allowed_scopes):
        raise HTTPException(status_code=422, detail="Requested scopes are not allowed for this provider")
    decision = repository.policy_decision(workspace_id, "external_connection.authorize")
    if decision == "deny":
        raise HTTPException(status_code=403, detail="External connection authorization is denied by policy")
    if decision == "require_approval":
        return Response(
            content=json.dumps({"decision": decision, "approval": repository.create_approval_request(user_id, workspace_id, "external_connection.authorize", f"Authorize {body.provider} with {', '.join(body.scopes)}")}),
            media_type="application/json",
            status_code=202,
        )
    return repository.create_external_connection(user_id, workspace_id, body.provider, body.scopes)


@router.post("/external-connections/{connection_id}/revoke")
def revoke_external_connection(connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.external_connection(connection_id)
    if not connection or not repository.can_manage_workspace(user_id, connection["workspace_id"]):
        raise HTTPException(status_code=404, detail="External connection not found")
    if connection["status"] == "revoked":
        raise HTTPException(status_code=409, detail="External connection is already revoked")
    return repository.revoke_external_connection(connection_id)


@router.get("/workspaces/{workspace_id}/external-connections/{connection_id}/github/authorize")
def github_connection_authorize_url(workspace_id: str, connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.external_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or connection["provider"] != "github" or not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="External connection not found")
    if connection["status"] != "pending_authorization":
        raise HTTPException(status_code=409, detail="This connection has already been authorized or revoked")
    if not settings.github_oauth_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured")
    return {"authorize_url": github_oauth.authorize_url(settings.github_oauth_client_id, settings.github_oauth_redirect_uri, connection_id)}


@router.get("/auth/github/callback")
async def github_oauth_callback(code: str, state: str, request: Request):
    """No Bearer auth: this is the browser redirect GitHub sends back after
    the user approves access, so it necessarily arrives unauthenticated from
    Orbital's point of view. `state` is the external_connections row id —
    already an opaque, single-use (checked via status) identifier."""
    if not request.app.state.admin_supabase:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured")
    admin_repository = SupabaseOrganizationRepository(request.app.state.admin_supabase)
    connection = admin_repository.external_connection(state)
    if not connection or connection["provider"] != "github" or connection["status"] != "pending_authorization":
        raise HTTPException(status_code=404, detail="This authorization link is invalid or has expired")
    try:
        token = await github_oauth.exchange_code(settings.github_oauth_client_id, settings.github_oauth_client_secret, settings.github_oauth_redirect_uri, code)
    except (github_oauth.GitHubOAuthError, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail=f"Could not complete GitHub authorization: {error}") from error
    request.app.state.admin_supabase.table("external_connection_credentials").upsert(
        {"external_connection_id": state, "encrypted_secret": credential_cipher(request).encrypt(token)},
        on_conflict="external_connection_id",
    ).execute()
    request.app.state.admin_supabase.table("external_connections").update({"status": "active"}).eq("id", state).execute()
    return Response(
        content="<html><body><p>GitHub connected. You can close this tab.</p>"
        "<script>window.opener && window.opener.postMessage({ type: 'orbital-github-connected' }, '*'); window.close();</script>"
        "</body></html>",
        media_type="text/html",
    )


@router.get("/workspaces/{workspace_id}/external-connections/{connection_id}/github/repos")
async def github_connection_repos(workspace_id: str, connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.external_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or connection["provider"] != "github" or not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="External connection not found")
    action = "github_connection.repos.read"
    decision = repository.policy_decision(workspace_id, action)
    if decision == "deny":
        return {"status": "denied", "reason": "Workspace policy denied this action."}
    if decision == "require_approval":
        approval = repository.create_approval_request(user_id, workspace_id, action, "List repositories from the linked GitHub account")
        return {"status": "approval_required", "approval_id": approval["id"]}
    admin = getattr(request.app.state, "admin_supabase", None)
    if not admin or connection["status"] != "active":
        return {"status": "unavailable", "reason": "This GitHub connection is not active yet."}
    rows = admin.table("external_connection_credentials").select("encrypted_secret").eq("external_connection_id", connection_id).limit(1).execute().data
    if not rows:
        return {"status": "unavailable", "reason": "This GitHub connection is not active yet."}
    token = credential_cipher(request).decrypt(rows[0]["encrypted_secret"])
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"},
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        return {"status": "failed", "error": str(error)}
    return {"status": "completed", "data": response.json()}


def infra_gateway_for(request: Request, authorization: Optional[str]) -> InfraGateway:
    repository = organization_repository(request, authorization)
    return InfraGateway(repository, settings.orbital_infra_agent_url, settings.orbital_infra_agent_token)


@router.get("/workspaces/{workspace_id}/ci-connections")
def list_ci_connections(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_ci_connections(workspace_id)


@router.post("/workspaces/{workspace_id}/ci-connections", status_code=201)
def create_ci_connection(workspace_id: str, body: CiConnectionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_ci_connection(user_id, workspace_id, body.provider, body.external_ref, body.manifest)


@router.post("/workspaces/{workspace_id}/ci-connections/{connection_id}/webhook", status_code=204)
async def receive_ci_webhook(workspace_id: str, connection_id: str, request: Request):
    """No user auth: authenticity comes from the provider's HMAC signature."""
    body = await request.body()
    if not verify_github_webhook_signature(settings.github_webhook_secret, body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    if not request.app.state.admin_supabase:
        raise HTTPException(status_code=503, detail="Webhook ingestion is not configured")
    admin_repository = SupabaseOrganizationRepository(request.app.state.admin_supabase)
    connection = admin_repository.ci_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not connection["enabled"]:
        raise HTTPException(status_code=404, detail="CI connection not found")
    ingest_github_webhook_event(admin_repository, connection, json.loads(body))


@router.get("/workspaces/{workspace_id}/pipeline-runs")
def list_pipeline_runs(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_pipeline_runs(workspace_id)


@router.get("/workspaces/{workspace_id}/infra-connections")
def list_infra_connections(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_infra_connections(workspace_id)


@router.post("/workspaces/{workspace_id}/infra-connections", status_code=201)
def create_infra_connection(workspace_id: str, body: InfraConnectionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.create_infra_connection(user_id, workspace_id, body.kind, body.name, body.manifest)


@router.get("/workspaces/{workspace_id}/infra/{connection_id}/{resource_type}")
async def list_infra_resources(workspace_id: str, connection_id: str, resource_type: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.infra_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Infra connection not found")
    gateway = infra_gateway_for(request, authorization)
    try:
        return await gateway.list_resources(user_id, workspace_id, connection, resource_type)
    except InfraGatewayError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/workspaces/{workspace_id}/infra/{connection_id}/{resource_type}/{resource_ref}/logs")
async def infra_resource_logs(workspace_id: str, connection_id: str, resource_type: str, resource_ref: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.infra_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Infra connection not found")
    gateway = infra_gateway_for(request, authorization)
    try:
        return await gateway.logs(user_id, workspace_id, connection, resource_type, resource_ref)
    except InfraGatewayError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/workspaces/{workspace_id}/infra/{connection_id}/{resource_type}/{resource_ref}/actions")
async def infra_resource_action(workspace_id: str, connection_id: str, resource_type: str, resource_ref: str, body: InfraActionRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.infra_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Infra connection not found")
    gateway = infra_gateway_for(request, authorization)
    params = {"replicas": body.replicas} if body.action == "scale" and body.replicas is not None else {}
    try:
        return await gateway.execute_action(user_id, workspace_id, connection, resource_type, resource_ref, body.action, params)
    except InfraGatewayError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/workspaces/{workspace_id}/infra-action-runs")
def list_infra_action_runs(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_infra_action_runs(workspace_id)


def ci_gateway_for(request: Request, authorization: Optional[str]) -> CiGateway:
    repository = organization_repository(request, authorization)
    return CiGateway(repository, getattr(request.app.state, "admin_supabase", None), getattr(request.app.state, "credential_cipher", None), settings.github_api_url)


def github_gateway_for(request: Request, authorization: Optional[str]) -> GitHubGateway:
    repository = organization_repository(request, authorization)
    return GitHubGateway(
        repository,
        getattr(request.app.state, "admin_supabase", None),
        getattr(request.app.state, "credential_cipher", None),
        settings.github_api_url,
        settings.github_poll_token,
    )


def _repo_connection_or_404(repository, user_id: str, workspace_id: str, connection_id: str) -> dict:
    connection = repository.ci_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Repository connection not found")
    return connection


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}")
async def repository_info(workspace_id: str, connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).repo_info(user_id, workspace_id, connection)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/tree")
async def repository_tree(workspace_id: str, connection_id: str, request: Request, ref: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    gateway = github_gateway_for(request, authorization)
    branch = ref or await gateway.default_branch(user_id, workspace_id, connection)
    return await gateway.tree(user_id, workspace_id, connection, branch)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/file")
async def repository_file(workspace_id: str, connection_id: str, path: str, request: Request, ref: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).file_content(user_id, workspace_id, connection, path, ref)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/commits")
async def repository_commits(workspace_id: str, connection_id: str, request: Request, path: Optional[str] = None, ref: Optional[str] = None, limit: int = 30, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).commits(user_id, workspace_id, connection, path, ref, limit)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/branches")
async def repository_branches(workspace_id: str, connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).branches(user_id, workspace_id, connection)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/pulls")
async def repository_pull_requests(workspace_id: str, connection_id: str, request: Request, state: str = "open", authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).pull_requests(user_id, workspace_id, connection, state)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/pulls/{number}")
async def repository_pull_request(workspace_id: str, connection_id: str, number: int, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).pull_request(user_id, workspace_id, connection, number)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/compare")
async def repository_compare(workspace_id: str, connection_id: str, base: str, head: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).compare(user_id, workspace_id, connection, base, head)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/contributors")
async def repository_contributors(workspace_id: str, connection_id: str, request: Request, limit: int = 20, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).contributors(user_id, workspace_id, connection, limit)


@router.get("/workspaces/{workspace_id}/repositories/{connection_id}/tags")
async def repository_tags(workspace_id: str, connection_id: str, request: Request, limit: int = 10, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = _repo_connection_or_404(repository, user_id, workspace_id, connection_id)
    return await github_gateway_for(request, authorization).tags(user_id, workspace_id, connection, limit)


@router.post("/workspaces/{workspace_id}/ci-connections/{connection_id}/credential", status_code=204)
def register_ci_credential(workspace_id: str, connection_id: str, body: CiCredentialCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Stores a write-scope GitHub token (``workflow`` scope) needed to trigger runs.

    Never read back by this API: mirrors provider_credentials.encrypted_secret,
    only ever decrypted at dispatch time in CiGateway.
    """
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.ci_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="CI connection not found")
    organization_admin(request).table("ci_credentials").upsert(
        {
            "ci_connection_id": connection_id,
            "encrypted_secret": credential_cipher(request).encrypt(body.token),
            "created_by": user_id,
        },
        on_conflict="ci_connection_id",
    ).execute()


@router.post("/workspaces/{workspace_id}/ci-connections/{connection_id}/trigger")
async def trigger_ci_pipeline(workspace_id: str, connection_id: str, body: CiTriggerRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.ci_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="CI connection not found")
    gateway = ci_gateway_for(request, authorization)
    return await gateway.trigger_run(user_id, workspace_id, connection, body.workflow_ref, body.git_ref)


@router.get("/workspaces/{workspace_id}/ci-trigger-runs")
def list_ci_trigger_runs(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_ci_trigger_runs(workspace_id)


def db_gateway_for(request: Request, authorization: Optional[str]) -> DbGateway:
    repository = organization_repository(request, authorization)
    return DbGateway(repository, getattr(request.app.state, "admin_supabase", None), getattr(request.app.state, "credential_cipher", None))


@router.get("/workspaces/{workspace_id}/db-connections")
def list_db_connections(workspace_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    return repository.list_db_connections(workspace_id)


@router.post("/workspaces/{workspace_id}/db-connections", status_code=201)
def create_db_connection(workspace_id: str, body: DbConnectionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not safe_db_host(body.host):
        raise HTTPException(status_code=422, detail="This host is not a valid external database target")
    connection = repository.create_db_connection(user_id, workspace_id, body.kind, body.name, body.host, body.port, body.database_name, body.username, body.ssl)
    admin = getattr(request.app.state, "admin_supabase", None)
    if admin:
        admin.table("db_connection_credentials").upsert(
            {"db_connection_id": connection["id"], "encrypted_secret": credential_cipher(request).encrypt(body.password)},
            on_conflict="db_connection_id",
        ).execute()
    return connection


@router.get("/workspaces/{workspace_id}/db-connections/{connection_id}/schema")
async def db_connection_schema(workspace_id: str, connection_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connection = repository.db_connection(connection_id)
    if not connection or connection["workspace_id"] != workspace_id or not repository.owns_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Database connection not found")
    return await db_gateway_for(request, authorization).introspect(user_id, workspace_id, connection)


@router.post("/skill-observations/{observation_id}/accept", status_code=201)
def accept_skill_observation(observation_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user_id = current_user(request, authorization); repository = organization_repository(request, authorization); observation = repository.observation(observation_id)
    if not observation or observation["status"] != "draft" or not repository.can_manage_workspace(user_id, observation["workspace_id"]): raise HTTPException(status_code=404, detail="Skill observation not found")
    manifest = observation["manifest"]
    if not isinstance(manifest.get("tools"), list) or not isinstance(manifest.get("data_access"), list): raise HTTPException(status_code=422, detail="Observation manifest must declare tools and data_access lists")
    skill = repository.create_skill(user_id, observation["workspace_id"], observation["title"], "1.0.0", manifest)
    repository.accept_observation(observation_id)
    return skill


@router.post("/skills/{skill_id}/status", status_code=204)
def update_skill_status(
    skill_id: str,
    body: SkillStatusUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    skill = repository.skill(skill_id)
    if not skill or not repository.can_manage_workspace(user_id, skill["workspace_id"]):
        raise HTTPException(status_code=404, detail="Skill not found")
    allowed = {"draft": "in_review", "in_review": "published", "published": "retired"}
    if allowed.get(skill["status"]) != body.status:
        raise HTTPException(status_code=409, detail="Invalid skill lifecycle transition")
    repository.set_skill_status(skill_id, body.status)


@router.post("/workspaces/{workspace_id}/connectors", status_code=201)
def create_connector(
    workspace_id: str,
    body: ConnectorCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    if not repository.can_manage_workspace(user_id, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not safe_connector_endpoint(body.endpoint):
        raise HTTPException(status_code=422, detail="Connector endpoint must be a public HTTP(S) URL without credentials")
    if not isinstance(body.manifest.get("tools"), list) or not body.manifest.get("approval_class"):
        raise HTTPException(status_code=422, detail="Connector manifest must declare tools and approval_class")
    return repository.create_connector(user_id, workspace_id, body.name, body.endpoint, body.manifest)


@router.patch("/connectors/{connector_id}", status_code=204)
def update_connector_enabled(
    connector_id: str,
    body: ConnectorEnabledUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    connector = repository.connector(connector_id)
    if not connector or not repository.can_manage_workspace(user_id, connector["workspace_id"]):
        raise HTTPException(status_code=404, detail="Connector not found")
    repository.set_connector_enabled(connector_id, body.enabled)


@router.post("/approval-requests/{approval_id}/decision", status_code=204)
async def decide_approval_request(
    approval_id: str,
    body: ApprovalDecisionRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id = current_user(request, authorization)
    repository = organization_repository(request, authorization)
    approval = repository.approval_request(approval_id)
    if not approval or not repository.can_manage_workspace(user_id, approval["workspace_id"]):
        raise HTTPException(status_code=404, detail="Approval request not found")
    if approval["status"] != "pending":
        raise HTTPException(status_code=409, detail="Approval request has already been decided")
    if not repository.decide_approval_request(user_id, approval_id, body.decision):
        raise HTTPException(status_code=409, detail="Approval request has already been decided")
    # If this approval gated an infra action, carry the decision through:
    # approved dispatches it now (never on the initial request path), denied
    # marks it cancelled. Any other approval kind (tool calls, schedules,
    # external connections) has no matching row and this is a no-op.
    action_run = repository.infra_action_run_by_approval(approval_id)
    if action_run:
        if body.decision == "denied":
            repository.update_infra_action_run(action_run["id"], "cancelled")
        else:
            connection = repository.infra_connection(action_run["infra_connection_id"])
            if connection:
                gateway = infra_gateway_for(request, authorization)
                await gateway.dispatch_after_approval(action_run["requested_by"], action_run["workspace_id"], action_run, connection)
    # Same carry-through for a gated CI pipeline trigger.
    trigger_run = repository.ci_trigger_run_by_approval(approval_id)
    if trigger_run:
        if body.decision == "denied":
            repository.update_ci_trigger_run(trigger_run["id"], "cancelled")
        else:
            connection = repository.ci_connection(trigger_run["ci_connection_id"])
            if connection:
                ci_gateway = ci_gateway_for(request, authorization)
                await ci_gateway.dispatch_after_approval(trigger_run["requested_by"], trigger_run["workspace_id"], trigger_run, connection)
