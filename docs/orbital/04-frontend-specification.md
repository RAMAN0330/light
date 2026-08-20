# Orbital Frontend Specification

## Product shell

Orbital extends the existing React application into an authenticated, responsive workspace. The shell always displays the active organization and workspace, global run state and accessible navigation. A user who lacks access to a module sees neither its data nor a misleading disabled action; policy-restricted actions are visible only when explaining an actionable approval path is useful.

## Information architecture

| Area | Primary views | Primary users |
|---|---|---|
| Work | Home, Conversations, Runs, Artifacts, Knowledge, Research | Members, viewers |
| Build | Skills, Connectors, Code Graphs | Members, workspace admins |
| Operate | Projects, Tasks, Schedules, Notes, Notifications | Members |
| Govern | Approvals, Policies, Audit, Usage, Retention | Auditors, workspace/platform admins |
| Admin | Organization, People, Roles, SSO/SCIM, Secrets, Deployment | Owners, platform admins |

The sidebar groups these areas and collapses on small screens. A workspace switcher remains visible in the header. Route guards use server-provided grants and refresh them when the active workspace changes.

## Key screens and behavior

### Conversation and run workspace

- Conversation sidebar: searchable, paginated history scoped to the active workspace; new conversation; readable title and last activity.
- Main transcript: user, assistant, tool, approval, error and system-status events render as distinct accessible blocks. Citations open a source drawer without navigating away.
- Composer: attach approved files, select a published skill/model route if granted, show enabled tools and their approval class before submission.
- Run inspector: live status, progress timeline, provider/model metadata, sources, tools, artifacts, cost/usage and cancellation control.
- Approval interruption: when a run needs approval, it pauses with a precise action summary, resource/egress target, data classification, expiry and allow/deny controls. The requester cannot self-approve unless policy explicitly grants it.

### Knowledge and research

- Upload queue: show scan, conversion, indexing and failure state. Never show extracted content before a scan/policy decision permits it.
- Collection view: members, sources, classification, retention and connector/egress policy.
- Research report: generated report, source panel, uncited-claim label, connector activity and export action. An unavailable/denied source must remain visibly distinct from an absent source.
- Graph view: large visual graph is progressive and keyboard-accessible through an equivalent searchable list/path view; graph visualization is not the sole means to understand results.

### Skills and connectors

- Catalog cards identify publisher, version, status, requested capabilities, data classes, approval class and provenance.
- Detail pages compare versions and show review comments, audit history and rollback target. Publish, enable and rollback require an explicit confirmation reflecting the consequence.
- Connector setup separates configuration, credentials, scope, test connection and activation. Test results must redact secrets and show actual reachable destinations.

### Governance and administration

- Approval inbox defaults to current actionable items, with actor, time, workspace, risk, requested action and expiration.
- Policy editor uses a structured rule builder plus read-only policy JSON/YAML preview; a simulation panel shows allow/deny/approval outcomes before publish.
- Audit explorer filters by organization, workspace, actor, run, connector, resource, outcome and date. Exports are asynchronous artifacts with access and audit controls.
- Admin pages use clear destructive-action confirmation, session revocation feedback and SCIM sync state/error visibility.

## States and error model

| State | UI requirement |
|---|---|
| Loading | Skeleton preserves layout; never imply a permission decision while grants are loading. |
| Streaming | Incremental content is announced politely to assistive technology; cancel remains available. |
| Awaiting approval | Explain exactly why the run paused and when the request expires. |
| Denied | State policy reason and allowed remediation without exposing sensitive policy internals. |
| Failed | Preserve partial non-sensitive run timeline, retry eligibility and support correlation ID. |
| Empty | Explain the first permitted action for the role/workspace. |
| Offline/reconnecting | Preserve drafts; distinguish transport interruption from a run failure. |

## Design system

- Use semantic tokens: `surface`, `surface-raised`, `text`, `text-muted`, `border`, `brand`, `success`, `warning`, `danger`, `focus-ring` and `risk-*`; never encode status only by color.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px. Body text is at least 16 px; code/tool payloads use a readable monospace face.
- Use compact cards only for independently actionable information; avoid nesting cards inside cards in the transcript and admin console.
- Support desktop-first workspaces, tablet two-pane behavior and mobile single-pane navigation. Maintain full functionality at 320 px width.
- Meet WCAG 2.2 AA: keyboard traversal, visible focus, target size, color contrast, labels, live-region restraint, reduced motion and non-visual graph alternatives.

## Client contracts

- Generate typed API clients from the versioned OpenAPI contract; never infer authorization from client state alone.
- Consume SSE run events with `event_id`, `run_id`, `step_id`, `sequence`, `type`, `payload` and `correlation_id`; reconnect with `Last-Event-ID` and render deduplicated events.
- Store access tokens only through the approved auth client. Provider keys, connector secrets and unredacted audit exports never enter browser state.
- Feature flags are evaluated server-side by organization/workspace/deployment mode and returned as grants/capabilities.
