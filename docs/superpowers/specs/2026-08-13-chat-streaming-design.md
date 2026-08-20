# Chat streaming

## Scope

Enable streamed output for both OpenRouter chat-completion calls in `chat.py`.

## Design

- Pass `stream=True` to each completion request.
- Iterate through each stream and print non-empty content deltas immediately.
- Accumulate the first response's content and any reasoning details into an assistant message, preserving the existing follow-up request.
- Keep the model, prompts, and reasoning option unchanged.

## Error handling and verification

The SDK's existing stream errors propagate normally. Verify syntax with `python -m py_compile chat.py`; no network call or API key is required.
