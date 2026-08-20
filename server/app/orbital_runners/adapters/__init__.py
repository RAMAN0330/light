"""Orbital-owned capability adapters for vendored upstream libraries."""
from .code_context import ADAPTER as CODE_CONTEXT
from .code_intelligence import ADAPTER as CODE_INTELLIGENCE
from .context_optimization import ADAPTER as CONTEXT_OPTIMIZATION
from .document_ingestion import ADAPTER as DOCUMENT_INGESTION
from .web_research import ADAPTER as WEB_RESEARCH

_ADAPTERS = {
    "anydoc": DOCUMENT_INGESTION,
    "headroom": CONTEXT_OPTIMIZATION,
    "agent-reach": WEB_RESEARCH,
    "graphify": CODE_INTELLIGENCE,
    "graft": CODE_CONTEXT,
}


def adapter_for(plugin_id: str):
    return _ADAPTERS.get(plugin_id)
