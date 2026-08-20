import unittest
from io import StringIO
from types import ModuleType
from unittest.mock import patch


openai = ModuleType("openai")
openai.OpenAI = lambda **kwargs: None
with patch.dict("sys.modules", {"openai": openai}):
    import chat


class Delta:
    content = "There"


class Choice:
    delta = Delta()


class Chunk:
    choices = [Choice()]


class ConsumeStreamTests(unittest.TestCase):
    def test_handles_chunk_without_reasoning_details(self):
        with patch("sys.stdout", new_callable=StringIO) as output:
            content, reasoning_details = chat.consume_stream([Chunk()])

        self.assertEqual(content, "There")
        self.assertEqual(reasoning_details, [])
        self.assertEqual(output.getvalue(), "There")


if __name__ == "__main__":
    unittest.main()
