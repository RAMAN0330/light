from datetime import datetime, timezone
from typing import Optional


class SupabaseChatRepository:
    def __init__(self, client) -> None:
        self.client = client

    def list_conversations(self, user_id: str):
        return (
            self.client.table("conversations")
            .select("id,title,project_id,created_at")
            .eq("user_id", user_id)
            .is_("archived_at", "null")
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def create_conversation(self, user_id: str, title: str = "New chat", project_id: Optional[str] = None, workspace_id: Optional[str] = None):
        return (
            self.client.table("conversations")
            .insert({"user_id": user_id, "title": title, "project_id": project_id, "workspace_id": workspace_id})
            .execute()
            .data[0]
        )

    def owns_workspace(self, user_id: str, workspace_id: str) -> bool:
        return bool(
            self.client.table("workspaces")
            .select("id")
            .eq("id", workspace_id)
            .limit(1)
            .execute()
            .data
        )

    def list_projects(self, user_id: str):
        return self.client.table("projects").select("id,name,instructions,repository_connection_id,created_at").eq("user_id", user_id).order("created_at", desc=True).execute().data

    def can_access_repository_connection(self, connection_id: str) -> bool:
        return bool(self.client.table("ci_connections").select("id").eq("id", connection_id).limit(1).execute().data)

    def create_project(self, user_id: str, name: str, instructions: str, repository_connection_id: Optional[str] = None):
        return self.client.table("projects").insert({"user_id": user_id, "name": name, "instructions": instructions, "repository_connection_id": repository_connection_id}).execute().data[0]

    def update_project(self, user_id: str, project_id: str, name: str, instructions: str):
        return self.client.table("projects").update({"name": name, "instructions": instructions}).eq("id", project_id).eq("user_id", user_id).execute().data[0]

    def owns_project(self, user_id: str, project_id: str) -> bool:
        return bool(self.client.table("projects").select("id").eq("id", project_id).eq("user_id", user_id).limit(1).execute().data)

    def project(self, user_id: str, project_id: str):
        data = self.client.table("projects").select("id,name").eq("id", project_id).eq("user_id", user_id).limit(1).execute().data
        return data[0] if data else None

    def delete_project(self, user_id: str, project_id: str) -> None:
        self.client.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()

    def project_instructions(self, conversation_id: str) -> str:
        data = self.client.table("conversations").select("projects(instructions)").eq("id", conversation_id).limit(1).execute().data
        return (data[0].get("projects") or {}).get("instructions", "") if data else ""

    def add_project_document(self, user_id: str, project_id: str, name: str, content: str):
        return self.client.table("project_documents").insert({"user_id": user_id, "project_id": project_id, "name": name, "content": content}).execute().data[0]

    def list_project_documents(self, project_id: str):
        return self.client.table("project_documents").select("id,name,created_at").eq("project_id", project_id).order("created_at", desc=True).execute().data

    def delete_project_document(self, user_id: str, document_id: str) -> None:
        self.client.table("project_documents").delete().eq("id", document_id).eq("user_id", user_id).execute()

    def project_documents_for_conversation(self, conversation_id: str) -> str:
        data = self.client.table("conversations").select("project_id").eq("id", conversation_id).limit(1).execute().data
        if not data or not data[0].get("project_id"): return ""
        docs = self.client.table("project_documents").select("name,content").eq("project_id", data[0]["project_id"]).execute().data
        return "\n\n".join(f"Reference — {doc['name']}:\n{doc['content']}" for doc in docs)

    def organization_for_conversation(self, conversation_id: str):
        data = (
            self.client.table("conversations")
            .select("workspaces(organization_id)")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
            .data
        )
        return (data[0].get("workspaces") or {}).get("organization_id") if data else None

    def workspace_for_conversation(self, conversation_id: str):
        data = self.client.table("conversations").select("workspace_id").eq("id", conversation_id).limit(1).execute().data
        return data[0].get("workspace_id") if data else None

    def list_workspace_skills(self, workspace_id: str):
        return self.client.table("skills").select("name,status,manifest").eq("workspace_id", workspace_id).eq("status", "published").execute().data

    def owns_conversation(self, user_id: str, conversation_id: str) -> bool:
        response = (
            self.client.table("conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(response.data)

    def list_messages(self, conversation_id: str):
        return (
            self.client.table("messages")
            .select("role,content")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
            .data
        )

    def add_message(self, conversation_id: str, role: str, content: str) -> None:
        self.client.table("messages").insert(
            {"conversation_id": conversation_id, "role": role, "content": content}
        ).execute()

    def start_agent_run(self, user_id: str, conversation_id: str, mode: str) -> str:
        conversation = (
            self.client.table("conversations")
            .select("workspace_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
            .data[0]
        )
        return (
            self.client.table("agent_runs")
            .insert(
                {
                    "conversation_id": conversation_id,
                    "workspace_id": conversation["workspace_id"],
                    "requested_by": user_id,
                    "mode": mode,
                    "status": "running",
                }
            )
            .execute()
            .data[0]["id"]
        )

    def finish_agent_run(self, run_id: str, status: str, error: Optional[str] = None) -> None:
        self.client.table("agent_runs").update(
            {"status": status, "error": error, "completed_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", run_id).eq("status", "running").execute()

    def agent_run(self, run_id: str):
        data = (
            self.client.table("agent_runs")
            .select("id,requested_by,status")
            .eq("id", run_id)
            .limit(1)
            .execute()
            .data
        )
        return data[0] if data else None

    def cancel_agent_run(self, run_id: str) -> bool:
        result = (
            self.client.table("agent_runs")
            .update({"status": "cancelled", "completed_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", run_id)
            .eq("status", "running")
            .execute()
            .data
        )
        return bool(result)

    def is_agent_run_cancelled(self, run_id: str) -> bool:
        run = self.agent_run(run_id)
        return bool(run and run["status"] == "cancelled")

    def list_agent_runs(self, conversation_id: str):
        return (
            self.client.table("agent_runs")
            .select("id,mode,status,error,created_at,completed_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def delete_conversation(self, user_id: str, conversation_id: str) -> None:
        self.client.table("conversations").delete().eq("id", conversation_id).eq("user_id", user_id).execute()

    def rename_conversation(self, user_id: str, conversation_id: str, title: str) -> None:
        self.client.table("conversations").update({"title": title}).eq("id", conversation_id).eq("user_id", user_id).execute()

    def archive_conversation(self, user_id: str, conversation_id: str) -> None:
        self.client.table("conversations").update({"archived_at": datetime.now(timezone.utc).isoformat()}).eq("id", conversation_id).eq("user_id", user_id).execute()
