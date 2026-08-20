"""Minimal, closed-surface Docker/Kubernetes read agent.

This is a separate, differently-privileged service from orbital-runners: it
legitimately needs Docker-socket or in-cluster Kubernetes credentials that
orbital-runners is deliberately never given. It exposes exactly the
operations Orbital needs — never arbitrary docker/kubectl commands — the
same closed-adapter philosophy as orbital_runners' CapabilityAdapter.

Phase 1 implemented read-only endpoints only (list + logs). Phase 2 adds a
small, closed set of mutation endpoints below — never arbitrary docker/kubectl
commands, still the same fixed-operation-surface philosophy as
CapabilityAdapter. Orbital's own policy/approval/audit gate (infra_gateway.py)
is what decides whether a call ever reaches this service; this agent has no
gating logic of its own beyond the shared token, by design — the token
authenticates *the Orbital backend*, not a specific action.
"""
from __future__ import annotations

import os
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Orbital Infra Agent")

ConnectionKind = Literal["docker_host", "k8s_cluster"]


class ConnectionRequest(BaseModel):
    kind: ConnectionKind
    manifest: dict = Field(default_factory=dict)


class LogsRequest(ConnectionRequest):
    resource_type: Literal["container", "pod"]
    resource_ref: str = Field(min_length=1, max_length=255)
    tail: int = Field(default=200, ge=1, le=5000)


class ContainerActionRequest(ConnectionRequest):
    resource_ref: str = Field(min_length=1, max_length=255)
    action: Literal["start", "stop", "restart", "delete"]


class PodActionRequest(ConnectionRequest):
    resource_ref: str = Field(min_length=1, max_length=255)
    action: Literal["delete"]


class DeploymentScaleRequest(ConnectionRequest):
    resource_ref: str = Field(min_length=1, max_length=255)
    action: Literal["scale"]
    replicas: int = Field(ge=0, le=1000)


def require_token(token: str | None) -> None:
    expected = os.getenv("ORBITAL_INFRA_AGENT_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Infra agent authentication failed")


def docker_client(manifest: dict):
    import docker

    base_url = manifest.get("host") or os.getenv("DOCKER_HOST", "unix://var/run/docker.sock")
    return docker.DockerClient(base_url=base_url, timeout=10)


def k8s_core_v1(manifest: dict):
    from kubernetes import client, config

    if manifest.get("kubeconfig_context"):
        config.load_kube_config(context=manifest["kubeconfig_context"])
    else:
        config.load_incluster_config()
    return client.CoreV1Api()


def k8s_apps_v1(manifest: dict):
    from kubernetes import client, config

    if manifest.get("kubeconfig_context"):
        config.load_kube_config(context=manifest["kubeconfig_context"])
    else:
        config.load_incluster_config()
    return client.AppsV1Api()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/containers")
def list_containers(body: ConnectionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "docker_host":
        return {"items": []}
    try:
        containers = docker_client(body.manifest).containers.list(all=True)
        return {"items": [{"id": c.short_id, "name": c.name, "image": (c.image.tags or [c.image.short_id])[0], "status": c.status} for c in containers]}
    except Exception as error:  # noqa: BLE001 - surfaced to the caller, never crashes the agent
        raise HTTPException(status_code=502, detail=f"Could not reach the Docker host: {error}") from error


@app.post("/images")
def list_images(body: ConnectionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "docker_host":
        return {"items": []}
    try:
        images = docker_client(body.manifest).images.list()
        return {"items": [{"id": i.short_id, "tags": i.tags, "size": i.attrs.get("Size")} for i in images]}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not reach the Docker host: {error}") from error


@app.post("/pods")
def list_pods(body: ConnectionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "k8s_cluster":
        return {"items": []}
    try:
        namespace = body.manifest.get("namespace")
        core_v1 = k8s_core_v1(body.manifest)
        pods = core_v1.list_namespaced_pod(namespace).items if namespace else core_v1.list_pod_for_all_namespaces().items
        return {"items": [{"name": p.metadata.name, "namespace": p.metadata.namespace, "phase": p.status.phase, "node": p.spec.node_name} for p in pods]}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not reach the Kubernetes cluster: {error}") from error


@app.post("/deployments")
def list_deployments(body: ConnectionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "k8s_cluster":
        return {"items": []}
    try:
        namespace = body.manifest.get("namespace")
        apps_v1 = k8s_apps_v1(body.manifest)
        deployments = apps_v1.list_namespaced_deployment(namespace).items if namespace else apps_v1.list_deployment_for_all_namespaces().items
        return {
            "items": [
                {"name": d.metadata.name, "namespace": d.metadata.namespace, "replicas": d.status.replicas, "ready_replicas": d.status.ready_replicas}
                for d in deployments
            ]
        }
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not reach the Kubernetes cluster: {error}") from error


@app.post("/logs")
def resource_logs(body: LogsRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    try:
        if body.kind == "docker_host" and body.resource_type == "container":
            output = docker_client(body.manifest).containers.get(body.resource_ref).logs(tail=body.tail).decode(errors="replace")
            return {"output": output}
        if body.kind == "k8s_cluster" and body.resource_type == "pod":
            namespace = body.manifest.get("namespace", "default")
            output = k8s_core_v1(body.manifest).read_namespaced_pod_log(body.resource_ref, namespace, tail_lines=body.tail)
            return {"output": output}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not fetch logs: {error}") from error
    raise HTTPException(status_code=422, detail="Unsupported connection kind / resource type combination")


@app.post("/containers/action")
def container_action(body: ContainerActionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "docker_host":
        raise HTTPException(status_code=422, detail="Container actions require a docker_host connection")
    try:
        container = docker_client(body.manifest).containers.get(body.resource_ref)
        {"start": container.start, "stop": container.stop, "restart": container.restart, "delete": container.remove}[body.action]()
        return {"status": "ok"}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not {body.action} container {body.resource_ref}: {error}") from error


@app.post("/pods/action")
def pod_action(body: PodActionRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "k8s_cluster":
        raise HTTPException(status_code=422, detail="Pod actions require a k8s_cluster connection")
    try:
        namespace = body.manifest.get("namespace", "default")
        k8s_core_v1(body.manifest).delete_namespaced_pod(body.resource_ref, namespace)
        return {"status": "ok"}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not delete pod {body.resource_ref}: {error}") from error


@app.post("/deployments/scale")
def deployment_scale(body: DeploymentScaleRequest, infra_token: str | None = Header(default=None, alias="X-Orbital-Infra-Token")):
    require_token(infra_token)
    if body.kind != "k8s_cluster":
        raise HTTPException(status_code=422, detail="Deployment scaling requires a k8s_cluster connection")
    try:
        namespace = body.manifest.get("namespace", "default")
        k8s_apps_v1(body.manifest).patch_namespaced_deployment_scale(body.resource_ref, namespace, {"spec": {"replicas": body.replicas}})
        return {"status": "ok"}
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not scale deployment {body.resource_ref}: {error}") from error
