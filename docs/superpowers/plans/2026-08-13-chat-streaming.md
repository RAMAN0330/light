# Chat Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream both chat completions to stdout while preserving the first streamed response for the follow-up request.

**Architecture:** Keep this as one script. Add a small helper that consumes an OpenAI completion stream, prints content deltas, and returns the accumulated content plus reasoning details needed to construct the second request.

**Tech Stack:** Python, OpenAI Python SDK, pytest, OpenRouter-compatible API.

## Global Constraints

- Do not add dependencies.
- Keep the model, prompts, and `extra_body={"reasoning": {"enabled": True}}` unchanged.
- Stream both completion calls with `stream=True`.

---

### Task 1: Stream completion output

**Files:**
- Create: `test_chat.py`
- Modify: `chat.py`

**Interfaces:**
- Produces: `consume_stream(stream) -> tuple[str, list]`, where the tuple is accumulated content and reasoning details.

- [ ] **Step 1: Write the failing test**

```python
import chat


class Delta:
    content = "Hi"
    reasoning_details = ["reasoning"]


class Choice:
    delta = Delta()


class Chunk:
    choices = [Choice()]


def test_consume_stream_prints_and_collects_content_and_reasoning(capsys):
    content, reasoning_details = chat.consume_stream([Chunk()])

    assert content == "Hi"
    assert reasoning_details == ["reasoning"]
    assert capsys.readouterr().out == "Hi"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest test_chat.py::test_consume_stream_prints_and_collects_content_and_reasoning -v`

Expected: FAIL because `consume_stream` does not exist.

- [ ] **Step 3: Write minimal implementation**

```python
def consume_stream(stream):
    content = ""
    reasoning_details = []
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            print(delta.content, end="", flush=True)
            content += delta.content
        if delta.reasoning_details:
            reasoning_details = delta.reasoning_details
    return content, reasoning_details
```

Use the helper to consume each response. Replace the first response message object with a dictionary constructed from its collected content and reasoning details.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest test_chat.py::test_consume_stream_prints_and_collects_content_and_reasoning -v`

Expected: PASS.

- [ ] **Step 5: Verify script syntax**

Run: `python -m py_compile chat.py`

Expected: exit code 0.

- [ ] **Step 6: Commit**

Skip: this workspace has no Git repository.
