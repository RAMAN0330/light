from dataclasses import dataclass


@dataclass(frozen=True)
class PluginSpec:
    id: str
    command: tuple[str, ...]
    network_mode: str
    capabilities: tuple[str, ...]


PLUGINS = {
    "anydoc": PluginSpec("anydoc", ("anydoc",), "none", ("knowledge.document.normalize",)),
    "headroom": PluginSpec("headroom", ("headroom",), "none", ("context.compress", "context.retrieve")),
    "agent-reach": PluginSpec("agent-reach", ("agent-reach",), "approved_egress", ("research.search", "research.read")),
    "graphify": PluginSpec("graphify", ("graphify",), "none", ("knowledge.graph.build", "knowledge.graph.query")),
    "graft": PluginSpec("graft", ("graft",), "none", ("code.context.map", "code.context.query")),
    "hermes-process": PluginSpec("hermes-process", (), "none", ("agent.orchestrate", "agent.delegate")),
    "task-observer": PluginSpec("task-observer", (), "none", ("skill.observe",)),
}


def plugin(plugin_id: str) -> PluginSpec:
    try:
        return PLUGINS[plugin_id]
    except KeyError as error:
        raise ValueError(f"Unknown Orbital plugin: {plugin_id}") from error
