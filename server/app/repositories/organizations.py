from datetime import datetime, timezone


class SupabaseOrganizationRepository:
    def __init__(self, client) -> None:
        self.client = client

    def create_organization(self, user_id: str, name: str):
        organization = (
            self.client.table("organizations")
            .insert({"name": name, "created_by": user_id})
            .execute()
            .data[0]
        )
        self.client.table("organization_memberships").insert(
            {"organization_id": organization["id"], "user_id": user_id, "role": "owner"}
        ).execute()
        workspace = (
            self.client.table("workspaces")
            .insert({"organization_id": organization["id"], "name": name})
            .execute()
            .data[0]
        )
        return {"id": organization["id"], "name": organization["name"], "workspace": workspace}

    def list_workspaces(self, user_id: str):
        memberships = (
            self.client.table("organization_memberships")
            .select("organization_id,role")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        roles = {membership["organization_id"]: membership["role"] for membership in memberships}
        organization_workspaces = (
            self.client.table("workspaces")
            .select("id,name,organization_id")
            .in_("organization_id", list(roles) or ["00000000-0000-0000-0000-000000000000"])
            .order("created_at")
            .execute()
            .data
        )
        direct_workspace_ids = [membership["workspace_id"] for membership in self.client.table("workspace_memberships").select("workspace_id").eq("user_id", user_id).execute().data]
        direct_workspaces = self.client.table("workspaces").select("id,name,organization_id").in_("id", direct_workspace_ids or ["00000000-0000-0000-0000-000000000000"]).order("created_at").execute().data
        workspaces = {workspace["id"]: workspace for workspace in [*organization_workspaces, *direct_workspaces]}.values()
        return [
            {
                "id": workspace["id"],
                "name": workspace["name"],
                "role": roles.get(workspace["organization_id"], "member"),
                "organization_id": workspace["organization_id"],
            }
            for workspace in workspaces
        ]

    def workspace(self, workspace_id: str):
        data = self.client.table("workspaces").select("id,name").eq("id", workspace_id).limit(1).execute().data
        return data[0] if data else None

    def delete_workspace(self, workspace_id: str) -> None:
        self.client.table("workspaces").delete().eq("id", workspace_id).execute()

    def create_custom_role(self, user_id: str, organization_id: str, name: str, permissions: list[str]):
        return (
            self.client.table("custom_roles")
            .insert(
                {
                    "organization_id": organization_id,
                    "name": name,
                    "permissions": permissions,
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def owns_custom_role(self, organization_id: str, role_id: str) -> bool:
        return bool(
            self.client.table("custom_roles")
            .select("id")
            .eq("id", role_id)
            .eq("organization_id", organization_id)
            .limit(1)
            .execute()
            .data
        )

    def assign_custom_role(self, organization_id: str, user_id: str, role_id: str) -> None:
        self.client.table("custom_role_assignments").upsert(
            {"organization_id": organization_id, "user_id": user_id, "role_id": role_id},
            on_conflict="organization_id,user_id",
        ).execute()

    def owns_organization(self, user_id: str, organization_id: str) -> bool:
        return bool(
            self.client.table("organizations")
            .select("id")
            .eq("id", organization_id)
            .limit(1)
            .execute()
            .data
        )

    def is_organization_member(self, organization_id: str, user_id: str) -> bool:
        return bool(
            self.client.table("organization_memberships")
            .select("organization_id")
            .eq("organization_id", organization_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )

    def can_manage_organization(self, user_id: str, organization_id: str) -> bool:
        built_in = bool(
            self.client.table("organization_memberships")
            .select("organization_id")
            .eq("organization_id", organization_id)
            .eq("user_id", user_id)
            .in_("role", ["owner", "platform_admin"])
            .limit(1)
            .execute()
            .data
        )
        return built_in or "organization.manage" in self.custom_permissions(user_id, organization_id)

    def owns_workspace(self, user_id: str, workspace_id: str) -> bool:
        workspace = (
            self.client.table("workspaces")
            .select("organization_id")
            .eq("id", workspace_id)
            .limit(1)
            .execute()
            .data
        )
        if not workspace:
            return False
        is_org_member = bool(
            self.client.table("organization_memberships")
            .select("organization_id")
            .eq("organization_id", workspace[0]["organization_id"])
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
        if is_org_member:
            return True
        return bool(
            self.client.table("workspace_memberships")
            .select("workspace_id")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )

    def can_manage_workspace(self, user_id: str, workspace_id: str) -> bool:
        workspace = (
            self.client.table("workspaces")
            .select("organization_id")
            .eq("id", workspace_id)
            .limit(1)
            .execute()
            .data
        )
        built_in = bool(
            workspace
            and self.client.table("organization_memberships")
            .select("organization_id")
            .eq("organization_id", workspace[0]["organization_id"])
            .eq("user_id", user_id)
            .in_("role", ["owner", "platform_admin", "workspace_admin"])
            .limit(1)
            .execute()
            .data
        )
        if not workspace:
            return False
        permissions = self.custom_permissions(user_id, workspace[0]["organization_id"])
        return built_in or "organization.manage" in permissions or "workspace.manage" in permissions

    def custom_permissions(self, user_id: str, organization_id: str) -> set[str]:
        assignments = (
            self.client.table("custom_role_assignments")
            .select("custom_roles(permissions)")
            .eq("organization_id", organization_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return {
            permission
            for assignment in assignments
            for permission in (assignment.get("custom_roles") or {}).get("permissions", [])
        }

    def create_approval_request(self, user_id: str, workspace_id: str, action: str, summary: str):
        return (
            self.client.table("approval_requests")
            .insert({"workspace_id": workspace_id, "requested_by": user_id, "action": action, "summary": summary})
            .execute()
            .data[0]
        )

    def policy_decision(self, workspace_id: str, action: str) -> str:
        rules = (
            self.client.table("policies")
            .select("decision")
            .eq("workspace_id", workspace_id)
            .eq("action", action)
            .eq("enabled", True)
            .limit(1)
            .execute()
            .data
        )
        return rules[0]["decision"] if rules else "require_approval"

    def record_tool_event(self, user_id: str, workspace_id: str, action: str, details: dict):
        workspace = self.client.table("workspaces").select("organization_id").eq("id", workspace_id).limit(1).execute().data
        if workspace:
            self.client.table("audit_events").insert({"organization_id": workspace[0]["organization_id"], "workspace_id": workspace_id, "actor_id": user_id, "action": action, "resource_type": "tool_call", "details": details}).execute()

    def create_policy(self, user_id: str, workspace_id: str, action: str, decision: str):
        return (
            self.client.table("policies")
            .upsert(
                {
                    "workspace_id": workspace_id,
                    "action": action,
                    "decision": decision,
                    "enabled": True,
                    "created_by": user_id,
                },
                on_conflict="workspace_id,action",
            )
            .execute()
            .data[0]
        )

    def list_policies(self, workspace_id: str):
        return (
            self.client.table("policies")
            .select("id,action,decision,enabled,created_by,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def list_approval_requests(self, workspace_id: str):
        return (
            self.client.table("approval_requests")
            .select("id,requested_by,action,summary,status,decided_by,created_at,decided_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def approval_request(self, approval_id: str):
        data = (
            self.client.table("approval_requests")
            .select("id,workspace_id,status")
            .eq("id", approval_id)
            .limit(1)
            .execute()
            .data
        )
        return data[0] if data else None

    def decide_approval_request(self, user_id: str, approval_id: str, decision: str):
        return (
            self.client.table("approval_requests")
            .update({"status": decision, "decided_by": user_id, "decided_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", approval_id)
            .eq("status", "pending")
            .execute()
            .data
        )

    def list_audit_events(self, organization_id: str):
        return (
            self.client.table("audit_events")
            .select("id,workspace_id,actor_id,action,resource_type,resource_id,details,created_at")
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def list_provider_credentials(self, organization_id: str):
        return (
            self.client.table("provider_credentials")
            .select("id,label,provider,model,created_by,revoked_at,created_at")
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def create_skill(self, user_id: str, workspace_id: str, name: str, version: str, manifest: dict):
        return (
            self.client.table("skills")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "name": name,
                    "version": version,
                    "status": "draft",
                    "manifest": manifest,
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def skill_exists(self, workspace_id: str, name: str, version: str) -> bool:
        return bool(
            self.client.table("skills").select("id").eq("workspace_id", workspace_id).eq("name", name).eq("version", version).limit(1).execute().data
        )

    def create_imported_skill(self, user_id: str, workspace_id: str, package: dict):
        manifest = {
            **package["manifest"],
            "package_id": package["id"],
            "source": package["source"],
            "license": package["license"],
            "attribution": package["attribution"],
            "provenance": package["provenance"],
        }
        return (
            self.client.table("skills")
            .insert({"workspace_id": workspace_id, "name": package["name"], "version": package["version"], "status": "published", "manifest": manifest, "created_by": user_id})
            .execute()
            .data[0]
        )

    def list_skills(self, workspace_id: str):
        return (
            self.client.table("skills")
            .select("id,name,version,status,manifest,created_by,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def skill(self, skill_id: str):
        data = (
            self.client.table("skills")
            .select("id,workspace_id,status")
            .eq("id", skill_id)
            .limit(1)
            .execute()
            .data
        )
        return data[0] if data else None

    def set_skill_status(self, skill_id: str, status: str) -> None:
        self.client.table("skills").update({"status": status}).eq("id", skill_id).execute()

    def create_connector(self, user_id: str, workspace_id: str, name: str, endpoint: str, manifest: dict):
        return (
            self.client.table("connectors")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "name": name,
                    "transport": "mcp",
                    "endpoint": endpoint,
                    "manifest": manifest,
                    "enabled": False,
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def connector(self, connector_id: str):
        data = (
            self.client.table("connectors")
            .select("id,workspace_id")
            .eq("id", connector_id)
            .limit(1)
            .execute()
            .data
        )
        return data[0] if data else None

    def set_connector_enabled(self, connector_id: str, enabled: bool):
        self.client.table("connectors").update({"enabled": enabled}).eq("id", connector_id).execute()

    def list_artifacts(self, workspace_id: str):
        return self.client.table("artifacts").select("id,name,mime_type,status,created_at,normalized_artifact_id,failure_reason").eq("workspace_id", workspace_id).order("created_at", desc=True).execute().data

    def artifact(self, artifact_id: str):
        rows = self.client.table("artifacts").select("id,name,workspace_id,status,storage_key").eq("id", artifact_id).limit(1).execute().data
        return rows[0] if rows else None

    def set_artifact_normalized(self, artifact_id: str):
        self.client.table("artifacts").update({"status": "normalized", "failure_reason": None}).eq("id", artifact_id).execute()

    def replace_artifact_chunks(self, artifact_id: str, chunks: list[dict]):
        self.client.table("knowledge_chunks").delete().eq("artifact_id", artifact_id).execute()
        if chunks:
            self.client.table("knowledge_chunks").insert([{**chunk, "artifact_id": artifact_id} for chunk in chunks]).execute()

    def workspace_organization(self, workspace_id: str):
        rows = self.client.table("workspaces").select("organization_id").eq("id", workspace_id).limit(1).execute().data
        return rows[0]["organization_id"] if rows else None

    def create_artifact(self, user_id: str, workspace_id: str, name: str, mime_type: str, storage_key: str, content_hash: str):
        return self.client.table("artifacts").insert({"workspace_id": workspace_id, "name": name, "mime_type": mime_type, "storage_key": storage_key, "content_hash": content_hash, "created_by": user_id}).execute().data[0]

    def create_adapter(self, user_id: str, workspace_id: str, name: str, manifest: dict):
        return self.client.table("adapter_registrations").insert({"workspace_id": workspace_id, "name": name, "manifest": manifest, "enabled": False, "created_by": user_id}).execute().data[0]

    def create_collection(self, user_id: str, workspace_id: str, name: str):
        return self.client.table("knowledge_collections").insert({"workspace_id": workspace_id, "name": name, "created_by": user_id}).execute().data[0]

    def list_collections(self, workspace_id: str):
        return self.client.table("knowledge_collections").select("id,name,created_at").eq("workspace_id", workspace_id).order("created_at", desc=True).execute().data

    def collection(self, collection_id: str):
        rows = self.client.table("knowledge_collections").select("id,workspace_id").eq("id", collection_id).limit(1).execute().data
        return rows[0] if rows else None

    def add_collection_artifact(self, collection_id: str, artifact_id: str):
        self.client.table("collection_artifacts").upsert({"collection_id": collection_id, "artifact_id": artifact_id}).execute()

    def collection_chunks(self, collection_id: str):
        return self.client.table("collection_artifacts").select("artifacts(id,name,knowledge_chunks(content,start_offset,end_offset))").eq("collection_id", collection_id).execute().data

    def create_research_report(self, user_id: str, workspace_id: str, title: str, content: str, citations: list[str]):
        return self.client.table("research_reports").insert({"workspace_id": workspace_id, "title": title, "content": content, "citations": citations, "created_by": user_id}).execute().data[0]

    def observation(self, observation_id: str):
        rows = self.client.table("skill_observations").select("id,workspace_id,status,title,manifest").eq("id", observation_id).limit(1).execute().data
        return rows[0] if rows else None

    def accept_observation(self, observation_id: str):
        self.client.table("skill_observations").update({"status": "accepted"}).eq("id", observation_id).eq("status", "draft").execute()

    def create_observation(self, user_id: str, workspace_id: str, title: str, manifest: dict):
        return self.client.table("skill_observations").insert({"workspace_id": workspace_id, "title": title, "manifest": manifest, "created_by": user_id}).execute().data[0]

    def list_tasks(self, workspace_id: str):
        return self.client.table("workspace_tasks").select("id,title,description,status,assignee_id,created_at").eq("workspace_id", workspace_id).order("created_at", desc=True).execute().data

    def create_task(self, user_id: str, workspace_id: str, title: str, description: str):
        return self.client.table("workspace_tasks").insert({"workspace_id": workspace_id, "title": title, "description": description, "created_by": user_id}).execute().data[0]

    def list_notes(self, workspace_id: str):
        return self.client.table("workspace_notes").select("id,title,content,created_at").eq("workspace_id", workspace_id).order("created_at", desc=True).execute().data

    def create_note(self, user_id: str, workspace_id: str, title: str, content: str):
        return self.client.table("workspace_notes").insert({"workspace_id": workspace_id, "title": title, "content": content, "created_by": user_id}).execute().data[0]

    def task(self, task_id: str):
        rows = self.client.table("workspace_tasks").select("id,workspace_id").eq("id", task_id).limit(1).execute().data
        return rows[0] if rows else None

    def update_task_status(self, task_id: str, status: str):
        return self.client.table("workspace_tasks").update({"status": status}).eq("id", task_id).execute().data[0]

    def list_notifications(self, user_id: str, workspace_id: str):
        return self.client.table("in_app_notifications").select("id,title,body,read_at,created_at").eq("workspace_id", workspace_id).eq("user_id", user_id).order("created_at", desc=True).execute().data

    def mark_notification_read(self, user_id: str, notification_id: str):
        return self.client.table("in_app_notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("id", notification_id).eq("user_id", user_id).execute().data

    def workspace_activity(self, workspace_id: str):
        return self.client.table("audit_events").select("id,action,resource_type,created_at").eq("workspace_id", workspace_id).order("created_at", desc=True).limit(30).execute().data

    def list_schedules(self, workspace_id: str): return self.client.table("workspace_schedules").select("id,title,cron_expression,enabled,next_run_at,created_at").eq("workspace_id", workspace_id).order("created_at", desc=True).execute().data
    def create_schedule(self, user_id: str, workspace_id: str, title: str, cron_expression: str): return self.client.table("workspace_schedules").insert({"workspace_id": workspace_id, "title": title, "cron_expression": cron_expression, "created_by": user_id}).execute().data[0]
    def schedule(self, schedule_id: str):
        rows = self.client.table("workspace_schedules").select("id,workspace_id").eq("id", schedule_id).limit(1).execute().data
        return rows[0] if rows else None
    def set_schedule_enabled(self, schedule_id: str, enabled: bool): return self.client.table("workspace_schedules").update({"enabled": enabled}).eq("id", schedule_id).execute().data[0]

    def list_due_schedules(self, now):
        return self.client.table("workspace_schedules").select("id,workspace_id,title,cron_expression,created_by,next_run_at").eq("enabled", True).lte("next_run_at", now.isoformat()).execute().data

    def create_schedule_execution(self, schedule_id: str, workspace_id: str, scheduled_for: str, status: str):
        result = self.client.table("schedule_executions").upsert(
            {"schedule_id": schedule_id, "workspace_id": workspace_id, "scheduled_for": scheduled_for, "status": status},
            on_conflict="schedule_id,scheduled_for",
            ignore_duplicates=True,
        ).execute().data
        return result[0] if result else None

    def advance_schedule(self, schedule_id: str, next_run_at: str):
        self.client.table("workspace_schedules").update({"next_run_at": next_run_at}).eq("id", schedule_id).execute()

    def list_schedule_executions(self, schedule_id: str):
        return self.client.table("schedule_executions").select("id,scheduled_for,status,created_at").eq("schedule_id", schedule_id).order("created_at", desc=True).execute().data

    def agent_run_for_workspace(self, run_id: str):
        rows = self.client.table("agent_runs").select("id,workspace_id,conversation_id,mode").eq("id", run_id).limit(1).execute().data
        return rows[0] if rows else None

    def create_delegated_run(self, user_id: str, parent: dict, scope: str):
        return self.client.table("agent_runs").insert({
            "conversation_id": parent["conversation_id"], "workspace_id": parent["workspace_id"],
            "requested_by": user_id, "mode": parent["mode"], "status": "queued",
            "parent_run_id": parent["id"], "scope": scope,
        }).execute().data[0]

    def set_retention_policy(self, user_id: str, workspace_id: str, retention_days: int, legal_hold: bool):
        return self.client.table("workspace_retention_policies").upsert({
            "workspace_id": workspace_id, "retention_days": retention_days, "legal_hold": legal_hold, "updated_by": user_id,
        }, on_conflict="workspace_id").execute().data[0]

    def retention_policy(self, workspace_id: str):
        rows = self.client.table("workspace_retention_policies").select("workspace_id,retention_days,legal_hold,updated_at").eq("workspace_id", workspace_id).limit(1).execute().data
        return rows[0] if rows else None

    def usage_summary(self, workspace_id: str):
        runs = self.client.table("agent_runs").select("status").eq("workspace_id", workspace_id).execute().data
        events = self.client.table("usage_events").select("units").eq("workspace_id", workspace_id).execute().data
        return {
            "workspace_id": workspace_id,
            "agent_runs": len(runs),
            "completed_runs": sum(run["status"] == "succeeded" for run in runs),
            "usage_units": sum(event["units"] for event in events),
        }

    def create_external_connection(self, user_id: str, workspace_id: str, provider: str, scopes: list[str]):
        return (
            self.client.table("external_connections")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "provider": provider,
                    "scopes": scopes,
                    "status": "pending_authorization",
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def list_external_connections(self, workspace_id: str):
        return (
            self.client.table("external_connections")
            .select("id,provider,scopes,status,revoked_at,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def external_connection(self, connection_id: str):
        rows = (
            self.client.table("external_connections")
            .select("id,workspace_id,provider,status")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def revoke_external_connection(self, connection_id: str):
        return (
            self.client.table("external_connections")
            .update({"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", connection_id)
            .neq("status", "revoked")
            .execute()
            .data[0]
        )

    def create_ci_connection(self, user_id: str, workspace_id: str, provider: str, external_ref: str, manifest: dict):
        # Reconnecting the same repo (workspace_id, provider, external_ref)
        # is idempotent rather than a 500 — upsert on the same unique
        # constraint the table already enforces, instead of a plain insert.
        return (
            self.client.table("ci_connections")
            .upsert(
                {
                    "workspace_id": workspace_id,
                    "provider": provider,
                    "external_ref": external_ref,
                    "manifest": manifest,
                    # Connecting a repo is itself the opt-in — there is no
                    # separate enable step in the UI, so this must default to
                    # true or the connection is invisible to both the CI-run
                    # poller and the commit-analysis poller/webhook.
                    "enabled": True,
                    "created_by": user_id,
                },
                on_conflict="workspace_id,provider,external_ref",
            )
            .execute()
            .data[0]
        )

    def list_ci_connections(self, workspace_id: str):
        return (
            self.client.table("ci_connections")
            .select("id,provider,external_ref,manifest,enabled,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def ci_connection(self, connection_id: str):
        rows = (
            self.client.table("ci_connections")
            .select("id,workspace_id,provider,external_ref,manifest,enabled")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_enabled_ci_connections(self):
        return (
            self.client.table("ci_connections")
            .select("id,workspace_id,provider,external_ref,manifest")
            .eq("enabled", True)
            .execute()
            .data
        )

    def list_pipeline_runs(self, workspace_id: str):
        return (
            self.client.table("pipeline_runs")
            .select("id,ci_connection_id,pipeline_name,branch,commit_sha,status,triggered_by,created_at,completed_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
            .data
        )

    def upsert_pipeline_run(self, workspace_id: str, ci_connection_id: str, run: dict):
        return (
            self.client.table("pipeline_runs")
            .upsert(
                {
                    "workspace_id": workspace_id,
                    "ci_connection_id": ci_connection_id,
                    "external_run_id": run["external_run_id"],
                    "pipeline_name": run["pipeline_name"],
                    "branch": run.get("branch"),
                    "commit_sha": run.get("commit_sha"),
                    "status": run["status"],
                    "triggered_by": run.get("triggered_by"),
                    "details": run.get("details", {}),
                    "completed_at": run.get("completed_at"),
                },
                on_conflict="ci_connection_id,external_run_id",
            )
            .execute()
            .data
        )

    def analyzed_commit_shas(self, ci_connection_id, shas):
        if not shas:
            return set()
        rows = (
            self.client.table("commit_analyses")
            .select("commit_sha")
            .eq("ci_connection_id", ci_connection_id)
            .in_("commit_sha", shas)
            .execute()
            .data
        )
        return {row["commit_sha"] for row in rows}

    def upsert_commit_analysis(self, workspace_id, ci_connection_id, commit_sha, branch, result):
        return (
            self.client.table("commit_analyses")
            .upsert(
                {
                    "workspace_id": workspace_id,
                    "ci_connection_id": ci_connection_id,
                    "commit_sha": commit_sha,
                    "branch": branch,
                    "health_score": result["health_score"],
                    "grade": result["grade"],
                    "issues": result["issues"],
                    "stats": result["stats"],
                },
                on_conflict="ci_connection_id,commit_sha",
            )
            .execute()
            .data
        )

    def list_commit_analyses(self, workspace_id, ci_connection_id, limit=50):
        return (
            self.client.table("commit_analyses")
            .select("id,commit_sha,branch,health_score,grade,issues,stats,created_at")
            .eq("workspace_id", workspace_id)
            .eq("ci_connection_id", ci_connection_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data
        )

    def create_infra_connection(self, user_id: str, workspace_id: str, kind: str, name: str, manifest: dict):
        return (
            self.client.table("infra_connections")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "kind": kind,
                    "name": name,
                    "manifest": manifest,
                    "enabled": False,
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def list_infra_connections(self, workspace_id: str):
        return (
            self.client.table("infra_connections")
            .select("id,kind,name,manifest,enabled,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def infra_connection(self, connection_id: str):
        rows = (
            self.client.table("infra_connections")
            .select("id,workspace_id,kind,name,manifest,enabled")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def create_infra_action_run(self, user_id: str, workspace_id: str, infra_connection_id: str, action: str, resource_type: str, resource_ref: str, status: str, params: dict | None = None, approval_request_id: str | None = None):
        return (
            self.client.table("infra_action_runs")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "infra_connection_id": infra_connection_id,
                    "action": action,
                    "resource_type": resource_type,
                    "resource_ref": resource_ref,
                    "status": status,
                    "params": params or {},
                    "requested_by": user_id,
                    "approval_request_id": approval_request_id,
                }
            )
            .execute()
            .data[0]
        )

    def update_infra_action_run(self, action_run_id: str, status: str, error: str | None = None):
        payload = {"status": status, "error": error}
        if status in {"succeeded", "failed", "cancelled"}:
            payload["completed_at"] = datetime.now(timezone.utc).isoformat()
        return (
            self.client.table("infra_action_runs")
            .update(payload)
            .eq("id", action_run_id)
            .execute()
            .data
        )

    def infra_action_run(self, action_run_id: str):
        rows = (
            self.client.table("infra_action_runs")
            .select("id,workspace_id,infra_connection_id,action,resource_type,resource_ref,status,params,approval_request_id")
            .eq("id", action_run_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def infra_action_run_by_approval(self, approval_id: str):
        rows = (
            self.client.table("infra_action_runs")
            .select("id,workspace_id,infra_connection_id,action,resource_type,resource_ref,status,params,approval_request_id,requested_by")
            .eq("approval_request_id", approval_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_infra_action_runs(self, workspace_id: str):
        return (
            self.client.table("infra_action_runs")
            .select("id,infra_connection_id,action,resource_type,resource_ref,status,requested_by,error,created_at,completed_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
            .data
        )

    def create_ci_trigger_run(self, user_id: str, workspace_id: str, ci_connection_id: str, workflow_ref: str, git_ref: str, status: str, approval_request_id: str | None = None):
        return (
            self.client.table("ci_trigger_runs")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "ci_connection_id": ci_connection_id,
                    "workflow_ref": workflow_ref,
                    "git_ref": git_ref,
                    "status": status,
                    "requested_by": user_id,
                    "approval_request_id": approval_request_id,
                }
            )
            .execute()
            .data[0]
        )

    def update_ci_trigger_run(self, trigger_run_id: str, status: str, error: str | None = None):
        payload = {"status": status, "error": error}
        if status in {"succeeded", "failed", "cancelled"}:
            payload["completed_at"] = datetime.now(timezone.utc).isoformat()
        return (
            self.client.table("ci_trigger_runs")
            .update(payload)
            .eq("id", trigger_run_id)
            .execute()
            .data
        )

    def ci_trigger_run_by_approval(self, approval_id: str):
        rows = (
            self.client.table("ci_trigger_runs")
            .select("id,workspace_id,ci_connection_id,workflow_ref,git_ref,status,approval_request_id,requested_by")
            .eq("approval_request_id", approval_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def create_db_connection(self, user_id: str, workspace_id: str, kind: str, name: str, host: str, port: int, database_name: str, username: str, ssl: bool):
        return (
            self.client.table("db_connections")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "kind": kind,
                    "name": name,
                    "host": host,
                    "port": port,
                    "database_name": database_name,
                    "username": username,
                    "ssl": ssl,
                    "enabled": True,
                    "created_by": user_id,
                }
            )
            .execute()
            .data[0]
        )

    def list_db_connections(self, workspace_id: str):
        return (
            self.client.table("db_connections")
            .select("id,kind,name,host,port,database_name,username,ssl,enabled,created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def db_connection(self, connection_id: str):
        rows = (
            self.client.table("db_connections")
            .select("id,workspace_id,kind,name,host,port,database_name,username,ssl,enabled")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def list_ci_trigger_runs(self, workspace_id: str):
        return (
            self.client.table("ci_trigger_runs")
            .select("id,ci_connection_id,workflow_ref,git_ref,status,requested_by,error,created_at,completed_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
            .data
        )
