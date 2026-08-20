from typing import Literal, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: str
    content: str = Field(min_length=1, max_length=8000)
    mode: Literal["ask", "research", "create"] = "ask"


class ConversationRequest(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=120)
    project_id: Optional[str] = None
    workspace_id: Optional[str] = None


class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class OrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class OrganizationMemberRoleRequest(BaseModel):
    role: Literal["owner", "platform_admin", "workspace_admin", "member", "viewer", "auditor"]


class OrganizationMemberCreate(OrganizationMemberRoleRequest):
    user_id: str = Field(min_length=1, max_length=128)


class CustomRoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    permissions: list[str] = Field(min_length=1, max_length=50)


class CustomRoleAssignment(BaseModel):
    role_id: str = Field(min_length=1, max_length=128)


class ApprovalRequestCreate(BaseModel):
    action: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=500)


class PolicyDecisionRequest(ApprovalRequestCreate):
    pass


class PolicyCreate(BaseModel):
    action: str = Field(min_length=1, max_length=120)
    decision: Literal["allow", "require_approval", "deny"]


class ApprovalDecisionRequest(BaseModel):
    decision: Literal["approved", "denied"]


class ProviderCredentialCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    provider: Literal["openrouter"] = "openrouter"
    secret: str = Field(min_length=1, max_length=2000)
    model: str = Field(min_length=1, max_length=255)


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    version: str = Field(min_length=1, max_length=64)
    manifest: dict


class SkillStatusUpdate(BaseModel):
    status: Literal["in_review", "published", "retired"]


class ConnectorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    endpoint: str = Field(min_length=1, max_length=2048)
    manifest: dict


class ConnectorEnabledUpdate(BaseModel):
    enabled: bool


class AdapterCreate(BaseModel):
    name: Literal["graphify", "graft", "headroom", "agent_reach"]
    manifest: dict


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CollectionArtifactCreate(BaseModel):
    artifact_id: str = Field(min_length=1, max_length=128)


class CollectionQuery(BaseModel):
    query: str = Field(min_length=1, max_length=1000)


class ResearchReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=40000)
    citations: list[str] = Field(default_factory=list)


class SkillObservationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    manifest: dict


class WorkspaceTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)


class WorkspaceNoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=40000)


class WorkspaceTaskUpdate(BaseModel):
    status: Literal["open", "in_progress", "done", "cancelled"]


class ScheduleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    cron_expression: str = Field(min_length=5, max_length=120)


class ScheduleEnabledUpdate(BaseModel):
    enabled: bool


class DelegatedRunCreate(BaseModel):
    scope: str = Field(min_length=1, max_length=500)


class RetentionPolicyUpdate(BaseModel):
    retention_days: int = Field(ge=1, le=3650)
    legal_hold: bool = False


class ExternalConnectionCreate(BaseModel):
    """A consent request only; this endpoint never accepts a raw token or code.

    For github, the token itself is obtained separately via the OAuth
    authorize/callback round trip (github_oauth.py), never passed here.
    """

    provider: Literal["gmail", "outlook_email", "google_calendar", "outlook_calendar", "github"]
    scopes: list[str] = Field(min_length=1, max_length=10)


class CiConnectionCreate(BaseModel):
    provider: Literal["github_actions"] = "github_actions"
    external_ref: str = Field(min_length=1, max_length=255)
    manifest: dict = Field(default_factory=dict)


class InfraConnectionCreate(BaseModel):
    kind: Literal["docker_host", "k8s_cluster"]
    name: str = Field(min_length=1, max_length=120)
    manifest: dict = Field(default_factory=dict)


class InfraActionRequest(BaseModel):
    action: Literal["start", "stop", "restart", "delete", "scale"]
    replicas: Optional[int] = Field(default=None, ge=0, le=1000)


class CiCredentialCreate(BaseModel):
    token: str = Field(min_length=1, max_length=2000)


class CiTriggerRequest(BaseModel):
    workflow_ref: str = Field(min_length=1, max_length=255)
    git_ref: str = Field(default="main", min_length=1, max_length=255)


class DbConnectionCreate(BaseModel):
    kind: Literal["postgres", "mysql", "mongodb"]
    name: str = Field(min_length=1, max_length=120)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database_name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=2000)
    ssl: bool = False


class ProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    instructions: str = Field(default="", max_length=4000)

class ProjectDocumentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=40000)

class ProjectInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)

class ProjectMemberRoleRequest(BaseModel):
    role: Literal["editor", "viewer"]
