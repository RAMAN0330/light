import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  chatApi,
  type ApprovalRequest,
  type Artifact,
  type Citation,
  type ChatMode,
  type Conversation,
  type Message,
  type Policy,
  type Project,
  type ProjectDocument,
  type Skill,
  type KnowledgeCollection,
  type IntelligenceAdapter,
  type Notification,
  type OrganizationMember,
  type Workspace,
  type WorkspaceNote,
  type WorkspaceTask,
  type WorkspaceSchedule,
} from "../api/chat";
import { cicdApi, type CiConnection, type CiTriggerResult, type PipelineRun } from "../api/cicd";
import { infraApi, type InfraAction, type InfraConnection, type InfraGatewayResult, type InfraResourceType } from "../api/infra";
import { AssistantMessage } from "./AssistantMessage";
import { GovernanceDialog } from "./GovernanceDialog";
import { InfraLogsViewer } from "./InfraLogsViewer";
import { KnowledgeDialog } from "./KnowledgeDialog";
import { MembersDialog } from "./MembersDialog";
import { OperationsDialog } from "./OperationsDialog";
// Lazy-loaded: pulls in parser.ts/acorn, reactflow, d3, highlight.js,
// framer-motion and jsrsasign — heavy, and only needed once someone actually
// opens the Repositories surface. Splits those into their own chunk instead
// of bloating the bundle every ChatApp load.
const RepositoryWorkspace = lazy(() => import("./RepositoryWorkspace").then((m) => ({ default: m.RepositoryWorkspace })));
import { ProjectsPage } from "./ProjectsPage";
import {
  OrbitalLauncher,
  type LauncherMode,
} from "./OrbitalLauncher";
import { SkillsDialog } from "./SkillsDialog";
import { VirtualMessageList } from "./VirtualMessageList";
import { WorkspaceDashboard } from "./WorkspaceDashboard";
import {
  WorkspaceSidebar,
  type WorkspaceSurface,
} from "./WorkspaceSidebar";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/field";
import { Dialog } from "./ui/dialog";
import {
  CheckCheck,
  Clock,
  History,
  MessageSquarePlus,
  PenLine,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type Api = typeof chatApi;
type ConversationState = {
  messages: Message[];
  loading: boolean;
  activeRunId: string;
  loaded: boolean;
};
const promptStarters = [
  { label: "Plan", prompt: "Help me turn this idea into a clear plan." },
  {
    label: "Explore",
    prompt: "Help me explore this topic from first principles.",
  },
  { label: "Write", prompt: "Help me write a clear first draft." },
];
const emptyStateHeadline = "Find a better way forward.";
const searchPrompts = [
  "Search conversations",
  "Find a past chat",
  "Look up a conversation",
];

export function ChatApp({
  accessToken,
  api = chatApi,
}: {
  accessToken: string;
  api?: Api;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceForm, setWorkspaceForm] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [importingSkills, setImportingSkills] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(
    [],
  );
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [adapterMessage, setAdapterMessage] = useState("");
  const [observationTitle, setObservationTitle] = useState("");
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activity, setActivity] = useState<{ id: string; action: string; resource_type: string }[]>([]);
  const [schedules, setSchedules] = useState<WorkspaceSchedule[]>([]);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleCron, setScheduleCron] = useState("0 9 * * 1-5");
  const [ciConnections, setCiConnections] = useState<CiConnection[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [ciExternalRef, setCiExternalRef] = useState("");
  const [ciConnectionId, setCiConnectionId] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [workflowRef, setWorkflowRef] = useState("");
  const [gitRef, setGitRef] = useState("main");
  const [ciTriggerResult, setCiTriggerResult] = useState<CiTriggerResult | null>(null);
  const [infraConnections, setInfraConnections] = useState<InfraConnection[]>([]);
  const [infraConnectionId, setInfraConnectionId] = useState("");
  const [infraConnectionName, setInfraConnectionName] = useState("");
  const [infraConnectionKind, setInfraConnectionKind] = useState<InfraConnection["kind"]>("docker_host");
  const [infraResourceType, setInfraResourceType] = useState<InfraResourceType>("container");
  const [infraResult, setInfraResult] = useState<InfraGatewayResult | null>(null);
  const [infraLogsOpen, setInfraLogsOpen] = useState(false);
  const [infraLogsTitle, setInfraLogsTitle] = useState("");
  const [infraLogsOutput, setInfraLogsOutput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [projectForm, setProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [conversationStates, setConversationStates] = useState<Record<string, ConversationState>>({});
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [search, setSearch] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [mode, setMode] = useState<ChatMode>("ask");
  const [surface, setSurface] = useState<WorkspaceSurface>("overview");
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherMode, setLauncherMode] = useState<LauncherMode>("query");
  const [copied, setCopied] = useState(-1);
  const [recentOpen, setRecentOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [typedHeadline, setTypedHeadline] = useState("");
  const [deletingHeadline, setDeletingHeadline] = useState(false);
  const [typedSearchPrompt, setTypedSearchPrompt] = useState(searchPrompts[0]);
  const [deletingSearchPrompt, setDeletingSearchPrompt] = useState(false);
  const [searchPromptIndex, setSearchPromptIndex] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeConversation = conversationStates[conversationId];
  const messages = activeConversation?.messages || [];
  const loading = activeConversation?.loading || false;
  const activeRunId = activeConversation?.activeRunId || "";

  useEffect(() => {
    void loadConversations();
  }, []);
  useEffect(() => {
    api
      .listWorkspaces(accessToken)
      .then((items) => {
        setWorkspaces(items);
        setWorkspaceId((current) => current || items[0]?.id || "");
      })
      .catch((loadError) => setError(`Could not load your workspaces: ${loadError instanceof Error ? loadError.message : "unknown error"}`));
  }, []);
  useEffect(() => {
    api
      .listProjects(accessToken)
      .then(setProjects)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (projectId)
      api
        .listProjectDocuments(accessToken, projectId)
        .then(setDocuments)
        .catch(() => {});
    else setDocuments([]);
  }, [projectId]);
  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      api.listTasks(accessToken, workspaceId),
      api.listNotes(accessToken, workspaceId),
      api.listNotifications(accessToken, workspaceId),
      api.listActivity(accessToken, workspaceId),
      api.listSchedules(accessToken, workspaceId),
      api.listApprovalRequests(accessToken, workspaceId),
      api.listArtifacts(accessToken, workspaceId),
      api.listSkills(accessToken, workspaceId),
    ])
      .then(([taskItems, noteItems, notificationItems, activityItems, scheduleItems, approvalItems, artifactItems, skillItems]) => {
        setTasks(taskItems);
        setNotes(noteItems);
        setNotifications(notificationItems);
        setActivity(activityItems);
        setSchedules(scheduleItems);
        setApprovalRequests(approvalItems);
        setArtifacts(artifactItems);
        setSkills(skillItems);
      })
      .catch(() => setError("Could not load the workspace overview."));
  }, [accessToken, api, workspaceId]);
  useEffect(() => {
    const organizationId = workspaces.find((workspace) => workspace.id === workspaceId)?.organization_id;
    if (!organizationId) { setMembers([]); return; }
    api
      .listMembers(accessToken, organizationId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [accessToken, api, workspaceId, workspaces]);
  useEffect(() => {
    if (conversationId && !conversationStates[conversationId]) void loadMessages(conversationId);
  }, [conversationId, conversationStates]);
  useEffect(() => {
    if (conversationId)
      setText(localStorage.getItem(`orbital-draft-${conversationId}`) || "");
  }, [conversationId]);
  useEffect(() => {
    if (conversationId)
      localStorage.setItem(`orbital-draft-${conversationId}`, text);
  }, [conversationId, text]);
  useEffect(() => {
    const focusComposer = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusComposer);
    return () => window.removeEventListener("keydown", focusComposer);
  }, []);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTypedHeadline(emptyStateHeadline);
      return;
    }
    const complete = typedHeadline === emptyStateHeadline;
    const empty = typedHeadline.length === 0;
    const delay =
      complete && !deletingHeadline
        ? 1500
        : empty && deletingHeadline
          ? 420
          : deletingHeadline
            ? 42
            : 74;
    const timer = window.setTimeout(() => {
      if (!deletingHeadline && complete) setDeletingHeadline(true);
      else if (deletingHeadline && empty) setDeletingHeadline(false);
      else
        setTypedHeadline((text) =>
          deletingHeadline
            ? text.slice(0, -1)
            : emptyStateHeadline.slice(0, text.length + 1),
        );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [typedHeadline, deletingHeadline]);
  useEffect(() => {
    if (
      search ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setTypedSearchPrompt(searchPrompts[0]);
      return;
    }
    const target = searchPrompts[searchPromptIndex];
    const complete = typedSearchPrompt === target;
    const empty = typedSearchPrompt.length === 0;
    const delay =
      complete && !deletingSearchPrompt
        ? 1600
        : empty && deletingSearchPrompt
          ? 360
          : deletingSearchPrompt
            ? 38
            : 68;
    const timer = window.setTimeout(() => {
      if (!deletingSearchPrompt && complete) setDeletingSearchPrompt(true);
      else if (deletingSearchPrompt && empty) {
        setDeletingSearchPrompt(false);
        setSearchPromptIndex((index) => (index + 1) % searchPrompts.length);
      } else
        setTypedSearchPrompt((text) =>
          deletingSearchPrompt
            ? text.slice(0, -1)
            : target.slice(0, text.length + 1),
        );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [search, typedSearchPrompt, deletingSearchPrompt, searchPromptIndex]);

  async function loadConversations() {
    try {
      const list = await api.listConversations(accessToken);
      setConversations(list);
      if (list[0]) setConversationId(list[0].id);
      else await newConversation();
    } catch {
      setError("Could not load your conversations.");
    }
  }
  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceName.trim()) return;
    try {
      const organization = await api.createOrganization(
        accessToken,
        workspaceName.trim(),
      );
      const workspace = { ...organization.workspace, role: "owner", organization_id: organization.id };
      setWorkspaces((items) => [...items, workspace]);
      setWorkspaceId(workspace.id);
      setWorkspaceName("");
      setWorkspaceForm(false);
    } catch {
      setError("Could not create your workspace.");
    }
  }
  async function openSkills() {
    if (!workspaceId) return;
    setSkillsOpen(true);
    try {
      setSkills(await api.listSkills(accessToken, workspaceId));
    } catch {
      setError("Could not load workspace skills.");
    }
  }
  async function importUpstreamSkills() {
    if (!workspaceId) return;
    setImportingSkills(true);
    try {
      await api.importUpstreamSkills(accessToken, workspaceId);
      setSkills(await api.listSkills(accessToken, workspaceId));
    } catch {
      setError("Could not import upstream skill processes.");
    } finally {
      setImportingSkills(false);
    }
  }
  async function openGovernance() {
    if (!workspaceId) return;
    setGovernanceOpen(true);
    try {
      const [policyItems, approvalItems] = await Promise.all([
        api.listPolicies(accessToken, workspaceId),
        api.listApprovalRequests(accessToken, workspaceId),
      ]);
      setPolicies(policyItems);
      setApprovalRequests(approvalItems);
    } catch {
      setError("Could not load workspace governance.");
    }
  }
  async function openKnowledge() {
    if (!workspaceId) return;
    setKnowledgeOpen(true);
    try {
      const [artifactItems, collectionItems] = await Promise.all([
        api.listArtifacts(accessToken, workspaceId),
        api.listCollections(accessToken, workspaceId),
      ]);
      setArtifacts(artifactItems);
      setCollections(collectionItems);
      setCollectionId(collectionItems[0]?.id || "");
    } catch {
      setError("Could not load workspace knowledge.");
    }
  }
  async function searchKnowledge(event: React.FormEvent) {
    event.preventDefault();
    if (!collectionId || !knowledgeQuery.trim()) return;
    try {
      setCitations(
        await api.queryCollection(
          accessToken,
          collectionId,
          knowledgeQuery.trim(),
        ),
      );
    } catch {
      setError("Could not search workspace knowledge.");
    }
  }
  async function createReport(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !reportTitle.trim() || !reportContent.trim()) return;
    try {
      await api.createResearchReport(
        accessToken,
        workspaceId,
        reportTitle.trim(),
        reportContent.trim(),
        [...new Set(citations.map((citation) => citation.artifact_id))],
      );
      setReportTitle("");
      setReportContent("");
    } catch {
      setError("Could not create the cited research report.");
    }
  }
  async function registerAdapter(name: IntelligenceAdapter) {
    if (!workspaceId) return;
    try {
      await api.registerAdapter(accessToken, workspaceId, name);
      setAdapterMessage(`${name} registered disabled.`);
    } catch {
      setError(`Could not register ${name}.`);
    }
  }
  async function createObservation(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !observationTitle.trim()) return;
    try {
      await api.createSkillObservation(
        accessToken,
        workspaceId,
        observationTitle.trim(),
      );
      setObservationTitle("");
    } catch {
      setError("Could not create the skill observation.");
    }
  }
  async function openOperations() {
    if (!workspaceId) return;
    setOperationsOpen(true);
    try {
      const [taskItems, noteItems, notificationItems, activityItems, scheduleItems, ciConnectionItems, pipelineRunItems, infraConnectionItems] = await Promise.all([
        api.listTasks(accessToken, workspaceId),
        api.listNotes(accessToken, workspaceId),
        api.listNotifications(accessToken, workspaceId),
        api.listActivity(accessToken, workspaceId),
        api.listSchedules(accessToken, workspaceId),
        cicdApi.listCiConnections(accessToken, workspaceId),
        cicdApi.listPipelineRuns(accessToken, workspaceId),
        infraApi.listInfraConnections(accessToken, workspaceId),
      ]);
      setTasks(taskItems);
      setNotes(noteItems);
      setNotifications(notificationItems);
      setActivity(activityItems); setSchedules(scheduleItems);
      setCiConnections(ciConnectionItems);
      setPipelineRuns(pipelineRunItems);
      setInfraConnections(infraConnectionItems);
      setInfraConnectionId((current) => current || infraConnectionItems[0]?.id || "");
      setCiConnectionId((current) => current || ciConnectionItems[0]?.id || "");
    } catch {
      setError("Could not load workspace operations.");
    }
  }
  async function createCiConnection(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !ciExternalRef.trim()) return;
    const connection = await cicdApi.createCiConnection(accessToken, workspaceId, ciExternalRef.trim());
    setCiConnections((items) => [connection, ...items]);
    setCiConnectionId((current) => current || connection.id);
    setCiExternalRef("");
  }
  async function registerCiCredential(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !ciConnectionId || !githubToken.trim()) return;
    await cicdApi.registerCiCredential(accessToken, workspaceId, ciConnectionId, githubToken.trim());
    setGithubToken("");
  }
  async function triggerPipeline(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !ciConnectionId || !workflowRef.trim()) return;
    try {
      const result = await cicdApi.triggerPipeline(accessToken, workspaceId, ciConnectionId, workflowRef.trim(), gitRef.trim() || "main");
      setCiTriggerResult(result);
      if (result.status === "completed") setPipelineRuns(await cicdApi.listPipelineRuns(accessToken, workspaceId));
    } catch {
      setCiTriggerResult({ status: "unavailable", reason: "Could not reach the CI provider." });
    }
  }
  async function createInfraConnection(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !infraConnectionName.trim()) return;
    const connection = await infraApi.createInfraConnection(accessToken, workspaceId, infraConnectionKind, infraConnectionName.trim());
    setInfraConnections((items) => [connection, ...items]);
    setInfraConnectionId((current) => current || connection.id);
    setInfraConnectionName("");
  }
  async function loadInfraResources(connectionId: string, resourceType: InfraResourceType) {
    if (!workspaceId || !connectionId) return;
    try {
      setInfraResult(await infraApi.listResources(accessToken, workspaceId, connectionId, resourceType));
    } catch {
      setInfraResult({ status: "unavailable", reason: "Could not reach the infra agent." });
    }
  }
  async function viewInfraLogs(resourceRef: string) {
    if (!workspaceId || !infraConnectionId) return;
    setInfraLogsTitle(`${infraResourceType} · ${resourceRef}`);
    setInfraLogsOpen(true);
    setInfraLogsOutput("Loading…");
    try {
      const result = await infraApi.resourceLogs(accessToken, workspaceId, infraConnectionId, infraResourceType as "container" | "pod", resourceRef);
      if (result.status === "completed") setInfraLogsOutput(result.output);
      else if (result.status === "approval_required") setInfraLogsOutput("This view requires workspace approval — check the Approval inbox.");
      else setInfraLogsOutput(result.reason);
    } catch {
      setInfraLogsOutput("Could not reach the infra agent.");
    }
  }
  useEffect(() => {
    if (operationsOpen && infraConnectionId) void loadInfraResources(infraConnectionId, infraResourceType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationsOpen, infraConnectionId, infraResourceType]);
  async function performInfraAction(resourceRef: string, action: InfraAction, replicas?: number) {
    if (!workspaceId || !infraConnectionId) return;
    try {
      const result = await infraApi.performAction(accessToken, workspaceId, infraConnectionId, infraResourceType, resourceRef, action, replicas);
      if (result.status === "approval_required") setError("This action requires workspace approval — check the Approval inbox.");
      else if (result.status === "denied") setError(result.reason);
      else if (result.status === "failed") setError(result.error);
      else if (result.status === "unavailable") setError(result.reason);
      else await loadInfraResources(infraConnectionId, infraResourceType);
    } catch {
      setError("Could not reach the infra agent.");
    }
  }
  async function createWorkspaceTask(event: React.FormEvent) { event.preventDefault(); if (!workspaceId || !taskTitle.trim()) return; const task = await api.createTask(accessToken, workspaceId, taskTitle.trim()); setTasks((items) => [task, ...items]); setTaskTitle(""); }
  async function createWorkspaceNote(event: React.FormEvent) { event.preventDefault(); if (!workspaceId || !noteTitle.trim() || !noteContent.trim()) return; const note = await api.createNote(accessToken, workspaceId, noteTitle.trim(), noteContent.trim()); setNotes((items) => [note, ...items]); setNoteTitle(""); setNoteContent(""); }
  async function createWorkspaceSchedule(event: React.FormEvent) { event.preventDefault(); if (!workspaceId || !scheduleTitle.trim()) return; const schedule = await api.createSchedule(accessToken, workspaceId, scheduleTitle.trim(), scheduleCron); setSchedules((items) => [schedule, ...items]); setScheduleTitle(""); }
  async function uploadKnowledge(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !workspaceId || !/\.(txt|md|markdown|csv|doc|docx|docm|odt|ods|odp|rtf|epub|pdf|ppt|pps|pot|pptx|pptm|ppsx|ppsm|xls|xlsx|xlsm|xlsb)$/i.test(file.name)) return;
    try {
      const artifact = await api.uploadArtifact(accessToken, workspaceId, file);
      await api.normalizeArtifact(accessToken, artifact.id);
      setArtifacts(await api.listArtifacts(accessToken, workspaceId));
    } catch {
      setError("Could not upload this workspace source.");
    }
    event.target.value = "";
  }
  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return;
    try {
      const project = await api.createProject(
        accessToken,
        projectName.trim(),
        projectInstructions.trim(),
      );
      setProjects((items) => [project, ...items]);
      setProjectId(project.id);
      setProjectForm(false);
      setProjectName("");
      setProjectInstructions("");
    } catch {
      setError("Could not create this project.");
    }
  }
  async function updateProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !projectName.trim()) return;
    try {
      const project = await api.updateProject(
        accessToken,
        projectId,
        projectName.trim(),
        projectInstructions.trim(),
      );
      setProjects((items) =>
        items.map((item) => (item.id === project.id ? project : item)),
      );
      setEditingProject(false);
    } catch {
      setError("Could not update this project.");
    }
  }
  function openProjectSettings() {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setProjectName(project.name);
    setProjectInstructions(project.instructions);
    setEditingProject(true);
  }
  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !inviteEmail.trim()) return;
    try {
      await api.inviteProjectMember(accessToken, projectId, inviteEmail.trim());
      setInviteEmail("");
    } catch {
      setError(
        "Could not invite this person. They must already have an account.",
      );
    }
  }
  async function uploadProjectDocument(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || !projectId || !/\.(txt|md)$/i.test(file.name)) return;
    try {
      await api.addProjectDocument(
        accessToken,
        projectId,
        file.name,
        await file.text(),
      );
      setDocuments(await api.listProjectDocuments(accessToken, projectId));
    } catch {
      setError("Could not add this reference file.");
    }
    event.target.value = "";
  }
  async function deleteProjectDocument(documentId: string) {
    if (!projectId) return;
    try {
      await api.deleteProjectDocument(accessToken, documentId);
      setDocuments((items) => items.filter((item) => item.id !== documentId));
    } catch {
      setError("Could not remove this reference file.");
    }
  }
  async function loadMessages(id: string) {
    setConversationStates((items) =>
      items[id]
        ? items
        : {
            ...items,
            [id]: { messages: [], loading: false, activeRunId: "", loaded: false },
          },
    );
    try {
      const loadedMessages = await api.listMessages(accessToken, id);
      setConversationStates((items) => {
        const current = items[id];
        if (current?.loaded) return items;
        return {
          ...items,
          [id]: { messages: loadedMessages, loading: false, activeRunId: "", loaded: true },
        };
      });
    } catch {
      setError("Could not load messages.");
    }
  }
  async function newConversation(projectOverride = projectId) {
    try {
      const conversation = await api.createConversation(
        accessToken,
        projectOverride,
        workspaceId,
      );
      setConversations((items) => [conversation, ...items]);
      setConversationId(conversation.id);
      setSurface("conversations");
      setConversationStates((items) => ({
        ...items,
        [conversation.id]: { messages: [], loading: false, activeRunId: "", loaded: true },
      }));
    } catch {
      setError("Could not create a conversation.");
    }
  }
  async function deleteConversation() {
    if (!deleteId || conversationStates[deleteId]?.loading) return;
    const deletedId = deleteId;
    try {
      setError("");
      await api.deleteConversation(accessToken, deletedId);
      const remaining = conversations.filter(
        (conversation) => conversation.id !== deletedId,
      );
      setConversations(remaining);
      setConversationStates((items) => {
        const { [deletedId]: _deleted, ...rest } = items;
        return rest;
      });
      setDeleteId("");
      if (conversationId === deletedId) {
        if (remaining[0]) setConversationId(remaining[0].id);
        else await newConversation();
      }
    } catch {
      setError("Could not delete this conversation.");
    }
  }
  async function archiveConversation(id: string) {
    try {
      await api.archiveConversation(accessToken, id);
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (conversationId === id)
        remaining[0]
          ? setConversationId(remaining[0].id)
          : await newConversation();
    } catch {
      setError("Could not archive this conversation.");
    }
  }
  async function renameConversation(event: React.FormEvent) {
    event.preventDefault();
    if (!conversationId || !renameTitle.trim()) return;
    try {
      await api.renameConversation(
        accessToken,
        conversationId,
        renameTitle.trim(),
      );
      setConversations((items) =>
        items.map((item) =>
          item.id === conversationId
            ? { ...item, title: renameTitle.trim() }
            : item,
        ),
      );
      setRenameTitle("");
    } catch {
      setError("Could not rename this conversation.");
    }
  }
  const visibleConversations = conversations.filter(
    (conversation) =>
      (!projectId || conversation.project_id === projectId) &&
      conversation.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  function selectProject(id: string) {
    setProjectId(id);
    const first = conversations.find(
      (conversation) => conversation.project_id === id,
    );
    if (first) setConversationId(first.id);
  }
  function clearProject() {
    setProjectId("");
    const first = conversations.find(
      (conversation) => !conversation.project_id,
    );
    if (first) setConversationId(first.id);
  }
  function exportConversation() {
    const title =
      conversations.find((conversation) => conversation.id === conversationId)
        ?.title || "orbital-conversation";
    const markdown = `# ${title}\n\n${messages.map((message) => `## ${message.role === "user" ? "You" : "Orbital"}\n\n${message.content}`).join("\n\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown" }),
    );
    link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async function copyMessage(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopied(index);
    window.setTimeout(() => setCopied(-1), 1500);
  }
  async function submitPrompt(content: string, requestMode: ChatMode) {
    if (!content.trim()) return;
    let targetConversationId = conversationId;
    if (!targetConversationId) {
      const conversation = await api.createConversation(accessToken, projectId, workspaceId);
      targetConversationId = conversation.id;
      setConversations((items) => [conversation, ...items]);
      setConversationId(conversation.id);
      setConversationStates((items) => ({
        ...items,
        [conversation.id]: { messages: [], loading: false, activeRunId: "", loaded: true },
      }));
    }
    if (conversationStates[targetConversationId]?.loading) return;
    const prompt = content.trim();
    setError("");
    setSurface("conversations");
    setLauncherOpen(false);
    setConversationStates((items) => {
      const current = items[targetConversationId] || { messages: [], loading: false, activeRunId: "", loaded: true };
      return {
        ...items,
        [targetConversationId]: {
          ...current,
          loaded: true,
          loading: true,
          messages: [...current.messages, { role: "user", content: prompt }, { role: "assistant", content: "" }],
        },
      };
    });
    let pendingChunks = "";
    let frameId = 0;
    const flushChunks = () => {
      frameId = 0;
      const chunk = pendingChunks;
      pendingChunks = "";
      if (!chunk) return;
      setConversationStates((items) => {
        const current = items[targetConversationId];
        if (!current) return items;
        return {
          ...items,
          [targetConversationId]: {
            ...current,
            messages: current.messages.map((message, index) =>
              index === current.messages.length - 1
                ? { ...message, content: message.content + chunk }
                : message,
            ),
          },
        };
      });
    };
    try {
      for await (const chunk of api.sendMessage(
        accessToken,
        targetConversationId,
        prompt,
        requestMode,
        (runId) => setConversationStates((items) => ({
          ...items,
          [targetConversationId]: { ...items[targetConversationId], activeRunId: runId },
        })),
      )) {
        pendingChunks += chunk;
        if (!frameId) frameId = window.requestAnimationFrame(flushChunks);
      }
      if (frameId) window.cancelAnimationFrame(frameId);
      flushChunks();
    } catch {
      if (frameId) window.cancelAnimationFrame(frameId);
      flushChunks();
      setConversationStates((items) => {
        const current = items[targetConversationId];
        if (!current) return items;
        return {
          ...items,
          [targetConversationId]: {
            ...current,
            messages: current.messages.filter(
              (message, index) => index !== current.messages.length - 1 || message.content,
            ),
          },
        };
      });
      setError("The assistant could not reply. Please try again.");
    } finally {
      setConversationStates((items) => {
        const current = items[targetConversationId];
        return current
          ? { ...items, [targetConversationId]: { ...current, loading: false, activeRunId: "" } }
          : items;
      });
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || loading) return;
    const content = text.trim();
    setText("");
    await submitPrompt(content, mode);
  }

  function openLauncher(nextMode: LauncherMode = "query") {
    setLauncherMode(nextMode);
    setLauncherOpen(true);
  }

  function launcherChatMode(selectedMode: LauncherMode): ChatMode {
    if (selectedMode === "query") return "ask";
    if (selectedMode === "automate" || selectedMode === "code") return "create";
    return "research";
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  function resizeComposer(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 220)}px`;
  }
  function usePromptStarter(prompt: string) {
    setText(prompt);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function cancelActiveRun() {
    if (!activeRunId) return;
    try {
      await api.cancelAgentRun(accessToken, activeRunId);
      setConversationStates((items) => ({
        ...items,
        [conversationId]: { ...items[conversationId], activeRunId: "" },
      }));
    } catch {
      setError("Could not cancel this agent run.");
    }
  }
  const composer = (
    <form className="composer composer-dock" onSubmit={send}>
      <div className="composer-surface">
        <label className="sr-only" htmlFor="message">
          Message
        </label>
        <Textarea
          ref={composerRef}
          id="message"
          aria-label="Message"
          maxLength={4000}
          value={text}
          onChange={resizeComposer}
          onKeyDown={handleComposerKeyDown}
          placeholder={
            mode === "research"
              ? "What should we investigate?"
              : mode === "create"
                ? "What should we make?"
                : "How can Orbital help you today?"
          }
        />
        <div className="composer-footer">
          <label className="composer-mode">
            <Sparkles aria-hidden="true" size={16} strokeWidth={1.9} />
            <Select
              aria-label="Response mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as ChatMode)}
            >
              <option value="ask">Ask Orbital</option>
              <option value="research">Research</option>
              <option value="create">Create</option>
            </Select>
          </label>
          <span className="composer-count">{text.length}/4000</span>
          {loading && activeRunId && (
            <Button
              type="button"
              variant="secondary"
              className="cancel-run"
              onClick={() => void cancelActiveRun()}
            >
              Cancel run
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            className="send-button"
            aria-label="Send"
            title="Send message"
            disabled={loading || !conversationId}
          >
            {loading ? (
              <span className="send-loading" />
            ) : (
              <SendHorizontal aria-hidden="true" size={20} strokeWidth={2.1} />
            )}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <main className={surface === "overview" ? "workspace-shell overview-active" : surface === "projects" ? "workspace-shell projects-active" : surface === "repositories" ? "workspace-shell repositories-active" : "workspace-shell conversations-active"}>
      <WorkspaceSidebar
        workspaces={workspaces}
        workspaceId={workspaceId}
        surface={surface}
        conversationCount={conversations.length}
        projectCount={projects.length}
        onWorkspaceChange={setWorkspaceId}
        onCreateWorkspace={() => setWorkspaceForm(true)}
        onOverview={() => setSurface("overview")}
        onConversations={() => setSurface("conversations")}
        onProjects={() => { if (!projectId && projects[0]) setProjectId(projects[0].id); setSurface("projects"); }}
        onRepositories={() => setSurface("repositories")}
        onNewConversation={() => void newConversation()}
        onOperations={() => void openOperations()}
        onKnowledge={() => void openKnowledge()}
        onLauncher={openLauncher}
      />
      <section className={surface === "overview" || surface === "projects" || surface === "repositories" ? "workspace-panel" : "chat-panel"}>
        {surface === "overview" ? (
          <WorkspaceDashboard
            workspace={workspaces.find((workspace) => workspace.id === workspaceId)}
            tasks={tasks}
            schedules={schedules}
            notifications={notifications}
            activity={activity}
            approvals={approvalRequests}
            artifacts={artifacts}
            skills={skills}
            projects={projects}
            onLauncher={openLauncher}
            onOperations={() => void openOperations()}
            onKnowledge={() => void openKnowledge()}
            onGovernance={() => void openGovernance()}
            onProjectCreate={() => setProjectForm(true)}
          />
        ) : surface === "projects" ? (
          <ProjectsPage
            projects={projects}
            selectedProjectId={projectId}
            conversations={conversations}
            documents={documents}
            artifacts={artifacts}
            members={members}
            onSelectProject={setProjectId}
            onCreateProject={() => setProjectForm(true)}
            onNewConversation={() => void newConversation(projectId || projects[0]?.id || "")}
            onEditProject={openProjectSettings}
            onInviteMember={inviteMember}
            onInviteEmailChange={setInviteEmail}
            inviteEmail={inviteEmail}
            onUploadDocument={uploadProjectDocument}
            onDeleteDocument={(id) => void deleteProjectDocument(id)}
            onViewAllConversations={() => setSurface("conversations")}
            onManageMembers={() => setMembersOpen(true)}
          />
        ) : surface === "repositories" ? (
          <Suspense fallback={<div className="repo-workspace-loading">Loading repository tools…</div>}>
            <RepositoryWorkspace accessToken={accessToken} workspaceId={workspaceId} />
          </Suspense>
        ) : (
          <>
        <header className="chat-topbar">
          {/* Left: Title + inline rename + search-expand */}
          <div className="chat-topbar-left">
            <button
              className="chat-title-btn"
              aria-label="Rename conversation"
              onClick={() =>
                setRenameTitle(
                  conversations.find(
                    (conversation) => conversation.id === conversationId,
                  )?.title || "",
                )
              }
            >
              <span className="chat-title-text">
                {conversations.find(
                  (conversation) => conversation.id === conversationId,
                )?.title || "New conversation"}
              </span>
              <PenLine className="chat-title-edit-icon" aria-hidden="true" size={13} />
            </button>

            {/* Inline search — expands on hover/focus */}
            <div className={search ? "topbar-search-wrap has-value" : "topbar-search-wrap"}>
              <button
                className="topbar-search-icon-btn"
                aria-label="Search conversations"
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search aria-hidden="true" size={15} />
              </button>
              <input
                ref={searchInputRef}
                className="topbar-search-input"
                aria-label="Search conversations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations…"
              />
              {search && (
                <button
                  className="topbar-search-clear"
                  aria-label="Clear search"
                  onClick={() => { setSearch(""); searchInputRef.current?.blur(); }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right: Recent conversations popup + New conversation icon-pill + Delete */}
          <div className="chat-topbar-right">
            {/* Recent conversations popup */}
            <div className="recent-conversations-wrap">
              <button
                className={recentOpen ? "topbar-icon-btn active" : "topbar-icon-btn"}
                aria-label="Recent conversations"
                aria-expanded={recentOpen}
                onClick={() => setRecentOpen((open) => !open)}
              >
                <History aria-hidden="true" size={17} />
                <span className="topbar-icon-label">Recent</span>
              </button>
              {recentOpen && (
                <div className="recent-popup" role="dialog" aria-label="Recent conversations">
                  <div className="recent-popup-header">
                    <span>Recent conversations</span>
                    <button
                      className="recent-popup-close"
                      aria-label="Close"
                      onClick={() => setRecentOpen(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <nav className="recent-popup-list" aria-label="Conversations">
                    {visibleConversations.length === 0 ? (
                      <p className="recent-popup-empty">No conversations yet.</p>
                    ) : (
                      visibleConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          className={conversation.id === conversationId ? "recent-popup-item active" : "recent-popup-item"}
                          onClick={() => { setConversationId(conversation.id); setRecentOpen(false); }}
                          title={conversation.title}
                        >
                          <Clock aria-hidden="true" size={14} />
                          <span>{conversation.title}</span>
                        </button>
                      ))
                    )}
                  </nav>
                </div>
              )}
            </div>

            {/* New conversation — icon pill that expands on hover */}
            <button
              className="new-chat-pill"
              aria-label="New conversation"
              onClick={() => void newConversation()}
            >
              <span className="new-chat-icon-wrap">
                <MessageSquarePlus aria-hidden="true" size={16} />
              </span>
              <span className="new-chat-label">New chat</span>
            </button>

            {/* Delete */}
            <button
              className="topbar-delete-btn"
              aria-label={`Delete ${conversations.find((c) => c.id === conversationId)?.title || "conversation"}`}
              onClick={() => setDeleteId(conversationId)}
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </header>
        {messages.length === 0 ? (
          <div
            className="messages messages-empty"
            aria-live="polite"
            aria-busy={loading}
          >
            <div className="default-stage">
              <div className="empty">
                <h2 className="typewriter" aria-label={emptyStateHeadline}>
                  {typedHeadline}
                </h2>
                <p>
                  Start with a thought. Orbital will help shape what comes next.
                </p>
                <div
                  className="prompt-starters"
                  aria-label="Prompt suggestions"
                >
                  {promptStarters.map((starter) => (
                    <Button
                      variant="ghost"
                      className="prompt-starter"
                      key={starter.label}
                      onClick={() => usePromptStarter(starter.prompt)}
                    >
                      <span>{starter.label}</span>
                      <small>{starter.prompt}</small>
                    </Button>
                  ))}
                </div>
              </div>
              {composer}
            </div>
          </div>
        ) : (
          <VirtualMessageList
            items={messages}
            itemKey={(_message, index) => index}
            followLatest={loading}
            renderItem={(message, index) => (
              <article className={message.role}>
                {message.role === "assistant" ? (
                  <>
                    <span className="message-label">Orbital</span>
                    <AssistantMessage
                      content={message.content || (loading ? "Thinking…" : "")}
                      isStreaming={loading && index === messages.length - 1}
                    />
                    {message.content && (
                      <button
                        className="copy-message"
                        onClick={() => void copyMessage(message.content, index)}
                      >
                        {copied === index ? "Copied" : "Copy"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="user-message-card">
                    <div className="user-message-body">
                      <div className="user-message-meta">
                        <strong>You</strong>
                        <span>Just now</span>
                      </div>
                      <p>{message.content}</p>
                    </div>
                    <CheckCheck
                      className="user-message-status"
                      aria-label="Delivered"
                      size={27}
                      strokeWidth={2}
                    />
                  </div>
                )}
              </article>
            )}
          />
        )}
          </>
        )}
        <Dialog
          open={Boolean(deleteId)}
          className="delete-backdrop"
          role="presentation"
        >
          <section
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <p className="dialog-kicker">Remove session</p>
            <h2 id="delete-title">Delete this conversation?</h2>
            <p>
              This will permanently remove the conversation and its messages.
            </p>
            <div>
              <Button
                variant="secondary"
                className="dialog-cancel"
                onClick={() => setDeleteId("")}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="dialog-delete"
                onClick={() => void deleteConversation()}
              >
                Delete conversation
              </Button>
            </div>
          </section>
        </Dialog>
        {renameTitle && (
          <div className="delete-backdrop" role="presentation">
            <form className="delete-dialog" onSubmit={renameConversation}>
              <p className="dialog-kicker">Rename session</p>
              <h2>Give this conversation a clear name</h2>
              <input
                aria-label="Conversation name"
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                autoFocus
              />
              <div>
                <button
                  className="dialog-cancel"
                  type="button"
                  onClick={() => setRenameTitle("")}
                >
                  Cancel
                </button>
                <button className="dialog-primary" type="submit">
                  Save name
                </button>
              </div>
            </form>
          </div>
        )}
        {workspaceForm && (
          <div className="delete-backdrop" role="presentation">
            <form
              className="delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-workspace-title"
              onSubmit={createWorkspace}
            >
              <p className="dialog-kicker">Orbital workspace</p>
              <h2 id="create-workspace-title">Create your first workspace</h2>
              <p>
                Workspaces scope your conversations, people, and future
                connectors.
              </p>
              <input
                aria-label="Workspace name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                autoFocus
              />
              <div>
                <button
                  className="dialog-cancel"
                  type="button"
                  onClick={() => setWorkspaceForm(false)}
                >
                  Cancel
                </button>
                <button className="dialog-primary" type="submit">
                  Create workspace
                </button>
              </div>
            </form>
          </div>
        )}
        <SkillsDialog open={skillsOpen} skills={skills} importing={importingSkills} onClose={() => setSkillsOpen(false)} onImportAll={() => void importUpstreamSkills()} />
        <MembersDialog open={membersOpen} members={members} onClose={() => setMembersOpen(false)} />
        <KnowledgeDialog
          open={knowledgeOpen}
          artifacts={artifacts}
          collections={collections}
          collectionId={collectionId}
          knowledgeQuery={knowledgeQuery}
          citations={citations}
          reportTitle={reportTitle}
          reportContent={reportContent}
          onClose={() => setKnowledgeOpen(false)}
          onUpload={uploadKnowledge}
          onCollectionChange={setCollectionId}
          onKnowledgeQueryChange={setKnowledgeQuery}
          onSearch={searchKnowledge}
          onReportTitleChange={setReportTitle}
          onReportContentChange={setReportContent}
          onCreateReport={createReport}
        />
        <OperationsDialog
          open={operationsOpen}
          tasks={tasks}
          notes={notes}
          notifications={notifications}
          activity={activity}
          schedules={schedules}
          taskTitle={taskTitle}
          noteTitle={noteTitle}
          noteContent={noteContent}
          scheduleTitle={scheduleTitle}
          scheduleCron={scheduleCron}
          onClose={() => setOperationsOpen(false)}
          onTaskTitleChange={setTaskTitle}
          onCreateTask={createWorkspaceTask}
          onTaskStatusChange={async (task, status) => {
            const updated = await api.updateTaskStatus(accessToken, task.id, status);
            setTasks((items) => items.map((item) => item.id === task.id ? updated : item));
          }}
          onNoteTitleChange={setNoteTitle}
          onNoteContentChange={setNoteContent}
          onCreateNote={createWorkspaceNote}
          onScheduleTitleChange={setScheduleTitle}
          onScheduleCronChange={setScheduleCron}
          onCreateSchedule={createWorkspaceSchedule}
          onScheduleEnabledChange={async (schedule) => {
            const updated = await api.setScheduleEnabled(accessToken, schedule.id, !schedule.enabled);
            setSchedules((items) => items.map((item) => item.id === schedule.id ? updated : item));
          }}
          ciConnections={ciConnections}
          pipelineRuns={pipelineRuns}
          ciExternalRef={ciExternalRef}
          onCiExternalRefChange={setCiExternalRef}
          onCreateCiConnection={createCiConnection}
          ciConnectionId={ciConnectionId}
          onCiConnectionChange={setCiConnectionId}
          githubToken={githubToken}
          onGithubTokenChange={setGithubToken}
          onRegisterCiCredential={registerCiCredential}
          workflowRef={workflowRef}
          onWorkflowRefChange={setWorkflowRef}
          gitRef={gitRef}
          onGitRefChange={setGitRef}
          onTriggerPipeline={triggerPipeline}
          ciTriggerResult={ciTriggerResult}
          infraConnections={infraConnections}
          infraConnectionId={infraConnectionId}
          onInfraConnectionChange={setInfraConnectionId}
          infraConnectionName={infraConnectionName}
          infraConnectionKind={infraConnectionKind}
          onInfraConnectionNameChange={setInfraConnectionName}
          onInfraConnectionKindChange={setInfraConnectionKind}
          onCreateInfraConnection={createInfraConnection}
          infraResourceType={infraResourceType}
          onInfraResourceTypeChange={setInfraResourceType}
          infraResult={infraResult}
          onViewInfraLogs={viewInfraLogs}
          onPerformInfraAction={performInfraAction}
        />
        <InfraLogsViewer
          open={infraLogsOpen}
          title={infraLogsTitle}
          output={infraLogsOutput}
          onClose={() => setInfraLogsOpen(false)}
        />
        <GovernanceDialog
          open={governanceOpen}
          policies={policies}
          approvalRequests={approvalRequests}
          adapterMessage={adapterMessage}
          observationTitle={observationTitle}
          onClose={() => setGovernanceOpen(false)}
          onRegisterAdapter={(name) => void registerAdapter(name)}
          onObservationTitleChange={setObservationTitle}
          onCreateObservation={createObservation}
        />
        {projectForm && (
          <div className="delete-backdrop" role="presentation">
            <form className="delete-dialog" onSubmit={createProject}>
              <p className="dialog-kicker">New project</p>
              <h2>Set the context once</h2>
              <p>Keep a brief, requirements, and conversations together.</p>
              <input
                aria-label="Project name"
                placeholder="Project name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                autoFocus
              />
              <textarea
                aria-label="Project instructions"
                placeholder="Instructions for Orbital (optional)"
                value={projectInstructions}
                onChange={(event) => setProjectInstructions(event.target.value)}
              />
              <div>
                <button
                  className="dialog-cancel"
                  type="button"
                  onClick={() => setProjectForm(false)}
                >
                  Cancel
                </button>
                <button className="dialog-primary" type="submit">
                  Create project
                </button>
              </div>
            </form>
          </div>
        )}
        {editingProject && (
          <div className="delete-backdrop" role="presentation">
            <section
              className="delete-dialog project-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-settings-title"
            >
              <form onSubmit={updateProject}>
                <p className="dialog-kicker">Project settings</p>
                <h2 id="project-settings-title">
                  Context that stays with every chat
                </h2>
                <input
                  aria-label="Project name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  autoFocus
                />
                <textarea
                  aria-label="Project instructions"
                  value={projectInstructions}
                  onChange={(event) =>
                    setProjectInstructions(event.target.value)
                  }
                />
                <div>
                  <button
                    className="dialog-cancel"
                    type="button"
                    onClick={() => setEditingProject(false)}
                  >
                    Cancel
                  </button>
                  <button className="dialog-primary" type="submit">
                    Save changes
                  </button>
                </div>
              </form>
              <form className="invite-form" onSubmit={inviteMember}>
                <p className="dialog-kicker">Invite collaborator</p>
                <p>Add an existing Orbital user as an editor.</p>
                <div className="invite-row">
                  <input
                    aria-label="Collaborator email"
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <button className="dialog-cancel" type="submit">
                    Invite
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {error && (
          <div className="error-toast" role="alert">
            <span>{error}</span>
            <button type="button" aria-label="Dismiss alert" onClick={() => setError("")}>×</button>
          </div>
        )}
        {surface === "conversations" && messages.length > 0 && composer}
      </section>
      <OrbitalLauncher
        open={launcherOpen}
        mode={launcherMode}
        loading={loading}
        onOpen={() => openLauncher("query")}
        onClose={() => setLauncherOpen(false)}
        onModeChange={setLauncherMode}
        onSubmit={(prompt, selectedMode) => submitPrompt(prompt, launcherChatMode(selectedMode))}
      />
    </main>
  );
}
