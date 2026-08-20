import type { FormEvent } from "react";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { InfraAction, InfraConnection, InfraGatewayResult, InfraResourceType } from "../api/infra";
import { Input, Select } from "./ui/field";
import { Plus, ScrollText, Server } from "lucide-react";
import { SPRING_SNAPPY } from "../lib/motion";

type InfraResourcesPanelProps = {
  connections: InfraConnection[];
  connectionId: string;
  onConnectionChange: (id: string) => void;
  connectionName: string;
  connectionKind: InfraConnection["kind"];
  onConnectionNameChange: (value: string) => void;
  onConnectionKindChange: (kind: InfraConnection["kind"]) => void;
  onCreateConnection: (event: FormEvent) => void;
  resourceType: InfraResourceType;
  onResourceTypeChange: (type: InfraResourceType) => void;
  result: InfraGatewayResult | null;
  onViewLogs: (resourceRef: string) => void;
  onPerformAction: (resourceRef: string, action: InfraAction, replicas?: number) => void;
};

const RESOURCE_TABS: { type: InfraResourceType; label: string }[] = [
  { type: "container", label: "Containers" },
  { type: "image", label: "Images" },
  { type: "pod", label: "Pods" },
  { type: "deployment", label: "Deployments" },
];

export function InfraResourcesPanel({
  connections,
  connectionId,
  onConnectionChange,
  connectionName,
  connectionKind,
  onConnectionNameChange,
  onConnectionKindChange,
  onCreateConnection,
  resourceType,
  onResourceTypeChange,
  result,
  onViewLogs,
  onPerformAction,
}: InfraResourcesPanelProps) {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [replicaInputs, setReplicaInputs] = useState<Record<string, string>>({});
  const reduceMotion = useReducedMotion();

  function confirmDestructive(action: InfraAction, ref: string) {
    return window.confirm(`${action === "delete" ? "Delete" : "Restart"} ${resourceType} "${ref}"? This cannot be undone from here.`);
  }

  return (
    <section className="operation-card operation-card-infra">
      <div className="operation-card-copy">
        <div className="operation-card-heading">
          <span className="operation-icon">
            <Server size={20} />
          </span>
          <div>
            <h3>Infrastructure</h3>
            <p>Live containers, images, pods and deployments. Destructive actions require workspace approval by default.</p>
          </div>
        </div>

        {connections.length === 0 ? (
          <p className="project-empty">No infrastructure connections yet.</p>
        ) : (
          <>
            <Select aria-label="Infrastructure connection" value={connectionId} onChange={(event) => onConnectionChange(event.target.value)}>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name} ({connection.kind === "docker_host" ? "Docker" : "Kubernetes"})
                </option>
              ))}
            </Select>
            <div className="infra-resource-tabs">
              {RESOURCE_TABS.map((tab) => {
                const active = tab.type === resourceType;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    className={active ? "infra-tab active" : "infra-tab"}
                    onClick={() => onResourceTypeChange(tab.type)}
                  >
                    {active && (
                      <motion.span
                        layoutId="infra-tab-active"
                        className="infra-tab-active-indicator"
                        transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                      />
                    )}
                    <span className="infra-tab-content">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {result?.status === "denied" && <p className="project-empty">{result.reason}</p>}
            {result?.status === "unavailable" && <p className="project-empty">{result.reason}</p>}
            {result?.status === "approval_required" && <p className="project-empty">This view requires workspace approval — check the Approval inbox.</p>}
            {result?.status === "completed" &&
              (result.items.length ? (
                result.items.map((item, index) => {
                  const ref = (item.id as string) || (item.name as string) || String(index);
                  return (
                    <article className="operation-row infra-resource-row" key={ref}>
                      <span>
                        <strong>{(item.name as string) || ref}</strong>
                        <small>{(item.status as string) || (item.phase as string) || ""}</small>
                      </span>
                      <span className="infra-resource-actions">
                        {(resourceType === "container" || resourceType === "pod") && (
                          <button type="button" className="dialog-cancel" onClick={() => onViewLogs(ref)}>
                            <ScrollText size={14} /> Logs
                          </button>
                        )}
                        {resourceType === "container" && (
                          <>
                            <button type="button" className="dialog-cancel" onClick={() => onPerformAction(ref, "start")}>
                              Start
                            </button>
                            <button type="button" className="dialog-cancel" onClick={() => onPerformAction(ref, "stop")}>
                              Stop
                            </button>
                            <button type="button" className="dialog-cancel" onClick={() => confirmDestructive("restart", ref) && onPerformAction(ref, "restart")}>
                              Restart
                            </button>
                            <button type="button" className="dialog-cancel infra-action-danger" onClick={() => confirmDestructive("delete", ref) && onPerformAction(ref, "delete")}>
                              Delete
                            </button>
                          </>
                        )}
                        {resourceType === "pod" && (
                          <button type="button" className="dialog-cancel infra-action-danger" onClick={() => confirmDestructive("delete", ref) && onPerformAction(ref, "delete")}>
                            Delete
                          </button>
                        )}
                        {resourceType === "deployment" && (
                          <>
                            <Input
                              aria-label={`Replica count for ${ref}`}
                              className="infra-scale-input"
                              type="number"
                              min={0}
                              max={1000}
                              value={replicaInputs[ref] ?? ""}
                              onChange={(event) => setReplicaInputs((values) => ({ ...values, [ref]: event.target.value }))}
                              placeholder={String(item.ready_replicas ?? item.replicas ?? "")}
                            />
                            <button
                              type="button"
                              className="dialog-cancel"
                              onClick={() => {
                                const replicas = Number(replicaInputs[ref]);
                                if (Number.isInteger(replicas) && replicas >= 0) onPerformAction(ref, "scale", replicas);
                              }}
                            >
                              Scale
                            </button>
                          </>
                        )}
                      </span>
                    </article>
                  );
                })
              ) : (
                <p className="project-empty">No {resourceType}s found.</p>
              ))}
          </>
        )}

        <button type="button" className="infra-toggle-link" onClick={() => setShowRegisterForm((open) => !open)}>
          {showRegisterForm ? "Cancel" : "Register a connection"}
        </button>
        {showRegisterForm && (
          <form onSubmit={onCreateConnection}>
            <Input aria-label="Connection name" value={connectionName} onChange={(event) => onConnectionNameChange(event.target.value)} placeholder="prod-cluster" />
            <Select aria-label="Connection kind" value={connectionKind} onChange={(event) => onConnectionKindChange(event.target.value as InfraConnection["kind"])}>
              <option value="docker_host">Docker host</option>
              <option value="k8s_cluster">Kubernetes cluster</option>
            </Select>
            <button className="dialog-primary" type="submit">
              <Plus size={18} /> Register connection
            </button>
          </form>
        )}
      </div>
      <div className="operation-art art-infra">
        <Server size={74} />
      </div>
    </section>
  );
}
