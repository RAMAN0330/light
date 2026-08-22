import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.tasks import load_graphify_output, perform_analysis, run_graphify


class GraphifyOutputTests(unittest.TestCase):
    def test_load_graphify_output_prunes_invalid_nodes_dangling_links_and_limits(self):
        payload = {
            "nodes": [
                {"id": "a", "label": "A", "community": 1},
                {"id": "b", "label": "B", "community": 2},
                {"id": "", "label": "invalid"},
                {"id": "c", "label": "over limit"},
            ],
            "links": [
                {"source": "a", "target": "b", "relation": "calls"},
                {"source": "a", "target": "missing", "relation": "calls"},
            ],
            "hyperedges": [{"id": "h1"}],
            "built_at_commit": "abc123",
        }
        with tempfile.TemporaryDirectory() as directory:
            graph_path = Path(directory) / "graph.json"
            graph_path.write_text(json.dumps(payload), encoding="utf-8")

            result = load_graphify_output(graph_path, max_nodes=2, max_links=5)

        self.assertEqual([node["id"] for node in result["nodes"]], ["a", "b"])
        self.assertEqual([(link["source"], link["target"]) for link in result["links"]], [("a", "b")])
        self.assertEqual(result["hyperedges"], [{"id": "h1"}])
        self.assertEqual(result["built_at_commit"], "abc123")

    @patch("app.tasks.subprocess.run")
    def test_run_graphify_uses_code_only_extraction_and_loads_output(self, run):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "graphify-out"
            output.mkdir()
            (output / "graph.json").write_text('{"nodes": [{"id": "a"}], "links": []}', encoding="utf-8")

            result = run_graphify(directory)

        self.assertEqual(result["nodes"], [{"id": "a"}])
        command = run.call_args.args[0]
        self.assertEqual(command[:2], ["graphify", "extract"])
        self.assertIn("--code-only", command)
        self.assertIn("--out", command)

    @patch("app.tasks.run_graphify", side_effect=RuntimeError("extract failed"))
    @patch("app.tasks.perform_introspection", return_value={"models": [], "stats": {}})
    def test_perform_analysis_keeps_introspection_when_graphify_fails(self, introspection, graphify):
        self.assertEqual(perform_analysis("/repo"), {"models": [], "stats": {}})


if __name__ == "__main__":
    unittest.main()
