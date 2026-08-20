# Full-stack chatbot

## Goal

Build a web chatbot with a React frontend, a FastAPI backend, Supabase authentication and persistent chat history, and streamed OpenRouter completions.

## Architecture

- The client is a Vite React application written in TypeScript.
- Supabase Auth provides email-and-password registration and login.
- The FastAPI API receives chat requests with the user's Supabase access token.
- The API validates the token, persists user and assistant messages in Supabase PostgreSQL, and proxies a streamed OpenRouter completion back to the client.
- `OPENROUTER_API_KEY` exists only in the FastAPI environment; it is never sent to the browser.

## Data model

`conversations` contains an id, owner user id, title, and created timestamp.

`messages` contains an id, conversation id, role (`user` or `assistant`), content, and created timestamp.

Row-level security limits conversations and their messages to the owning authenticated user.

## Client

- Login and sign-up screen when there is no authenticated session.
- Conversation sidebar that creates and selects conversations.
- Chat panel that loads saved messages and streams the assistant reply as it arrives.
- Send input, disabled while a reply is generating, plus readable loading and error states.

## API

- `GET /health` confirms the server is running.
- `GET /conversations` returns the current user's conversations.
- `GET /conversations/{id}/messages` returns messages for an owned conversation.
- `POST /chat` accepts a conversation id and user text, persists the user message, and streams the OpenRouter response. It persists the completed assistant message.

## Boundaries

- Route handlers handle HTTP validation and responses only.
- `ChatService` owns the chat workflow.
- `OpenRouterService` owns provider calls and streaming.
- repositories contain Supabase database access.
- The first version excludes files, RAG, tool use, voice, moderation dashboards, and social/chat-to-chat messaging.

## Error handling and tests

- Invalid or missing access tokens return `401`.
- Users cannot access another user's conversation.
- Provider failures return a useful error and do not save a partial assistant message.
- Backend tests cover service behavior and request authentication. Frontend tests cover authenticated rendering and message submission.
