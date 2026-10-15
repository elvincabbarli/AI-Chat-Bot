# Frontend Documentation

This document covers **functionality** — what each part of the code does and why. UI/visual design is not covered here.

## Stack

| Tool | Used for | Why |
|---|---|---|
| React + Vite + TypeScript | App framework/build tool | Fast dev server, standard React + TS setup |
| MUI (`@mui/material`) | Component library | Ready-made components (forms, lists, tabs) instead of building them from scratch |
| `@supabase/supabase-js` | Auth client | Talks directly to Supabase for login/signup/session — the backend never handles passwords |

## Folder structure and responsibilities

```
frontend/src/
├── api/
│   ├── client.ts     # generic GET/POST helpers that attach the Supabase auth token
│   ├── chat.ts        # one function per REST endpoint (createConversation, listConversations, ...)
│   └── stream.ts      # EventSource (SSE) wrapper used for both chat and transform streaming
├── auth/
│   ├── supabaseClient.ts  # the single Supabase client instance
│   ├── AuthContext.tsx    # holds the current session, listens for login/logout
│   └── useAuth.ts         # hook to read the session from any component
├── hooks/
│   ├── useConversations.ts   # fetches + creates conversations
│   ├── useMessages.ts        # fetches a conversation's message history
│   ├── useChatStream.ts      # manages a live chat reply (streaming + cancel)
│   └── useTransformStream.ts # same streaming pattern for the standalone Summarize/Rewrite tool
├── components/
│   ├── chat/          # ConversationList, ChatWindow, MessageBubble, MessageInput
│   ├── transform/     # TransformPanel (Summarize/Rewrite)
│   ├── structured/    # StructuredNoteForm, KeyPointsEditor
│   └── layout/        # AppLayout (top bar, logout)
├── pages/             # LoginPage/LoginForm/SignUpForm, ChatPage
└── types/chat.ts      # shared TypeScript types matching the backend's API shapes
```

## Auth flow

1. `AuthProvider` (wraps the whole app in `main.tsx`) calls `supabase.auth.getSession()` once on load, and subscribes to `onAuthStateChange` so login/logout anywhere updates the whole app.
2. `App.tsx` reads the session via `useAuth()`: no session → `LoginPage`; otherwise → the main app.
3. `LoginForm` / `SignUpForm` call `supabase.auth.signInWithPassword` / `supabase.auth.signUp` **directly** — the backend is not involved in login itself, only in verifying the resulting token afterwards.

## Talking to the backend

- **Regular requests** (`api/client.ts`): every `apiGet`/`apiPost`/`apiPatch`/`apiDelete` call fetches the current Supabase access token and sends it as `Authorization: Bearer <token>`.
- **Streaming requests** (`api/stream.ts`): the browser's native `EventSource` API can't set custom headers, so the token is appended to the URL as `?access_token=...` instead. The backend's `AuthGuard` accepts both forms.
- `stream.ts` listens for four event types from the server:
  - unnamed (`message`) events → text chunks, appended to the UI as they arrive
  - a custom `done` event → the reply finished; the code closes the `EventSource` itself (otherwise the browser would try to auto-reconnect and re-trigger the same request)
  - a custom `failure` event → model or persistence errors; closes the stream and shows an error
  - `error` events → network and connection failures; also closes the stream

## Streaming hooks

`useChatStream` and `useTransformStream` follow the same pattern:
- `run`/`sendPrompt` opens an SSE connection and accumulates incoming chunks into state, so the UI shows the reply being "typed" live.
- `cancel` closes the `EventSource` from the client side — this is what triggers the backend's `AbortController` to stop the Gemini request (see backend docs).
- `useChatStream` additionally calls a `refresh` callback once the stream reports `done`, since by that point the backend has already saved the exchange to the database and the conversation view needs the persisted messages.

## Feature → code mapping

| Feature | Where it lives |
|---|---|
| Streaming Chat Interface | `ChatPage` → `ChatWindow` → `useChatStream` → `api/stream.ts` (`streamChat`) |
| Summarization and Rewriting | `TransformPanel` → `useTransformStream` → `api/stream.ts` (`streamTransform`) |
| Structured, Editable Outputs | `StructuredNoteForm` — a plain POST (`api/chat.ts` → `generateStructuredNote`) since the result is a full JSON object, not a stream; the returned fields are kept in local state so the user can edit them before use |
| Conversation History | `useConversations` (list) + `useMessages` (per-conversation history), shown in `ConversationList` / `ChatWindow` |
| Cancellation, Retry, and Error Handling | `cancel()` in `useChatStream`/`useTransformStream`; retry itself happens on the backend, the frontend just reflects loading/error state |
| Basic Quality and Cost Tracking | Thumbs up/down buttons in `MessageBubble` call `api/chat.ts` → `rateMessage`; token cost tracking is backend-only (not shown in the UI yet) |

## GPT update: conversation controls and async state

`ConversationList` now has rename and delete dialogs. Delete requires confirmation, and the selected conversation is cleared after deletion. The sidebar refreshes after a completed reply to show its title and latest activity.

`ChatWindow` is keyed by conversation id. Leaving it closes the stream; request cancellation and generation checks ignore late responses. The user prompt appears immediately as a temporary message. Successful persistence replaces previews with the saved history. Cancellation retains the preview and offers a history refresh before sending another message. Loading states are released on failures, and errors are displayed in alerts.

See [GPT_CHANGES.md](../GPT_CHANGES.md) for the Azerbaijani explanation and manual checks.
