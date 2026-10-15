# Backend Documentation

## Stack

| Tool | Used for | Why |
|---|---|---|
| NestJS | API framework | Modular structure (modules/controllers/services), good fit for organizing streaming + auth + persistence cleanly |
| PostgreSQL (hosted on Supabase) | Database | Relational data (users, conversations, messages) fits well, and it's the same project as Supabase Auth |
| Prisma 7 | ORM | Type-safe database access, migrations |
| Supabase Auth | Authentication | Email/password auth, access-token verification, no need to build our own auth system |
| `@google/genai` | LLM provider SDK | Official SDK for Google Gemini, supports streaming and structured JSON output |

## Folder structure

```
backend/src/
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts   # wraps PrismaClient, connects/disconnects with Nest's lifecycle
├── auth/
│   └── auth.guard.ts        # verifies Supabase access tokens on every request
└── chat/
    ├── chat.module.ts
    ├── chat.service.ts      # all business logic: Gemini calls, DB reads/writes
    └── chat.controller.ts   # HTTP/SSE routes
```

## Database schema (`prisma/schema.prisma`)

- **User** — mirrors a Supabase `auth.users` row. Same `id` as the Supabase user, so the two systems stay linked without extra lookup tables.
- **Conversation** — belongs to a `User`, holds a list of `Message`s.
- **Message** — `role` (`USER` / `ASSISTANT`), `content`, and a nullable `rating` (`1` / `-1`) used for quality tracking.
- **UsageLog** — one row per assistant `Message`, storing `promptTokens` / `completionTokens` for cost tracking.

## Two Prisma 7 quirks worth knowing

1. **Driver adapter is mandatory.** Prisma 7's generated `PrismaClient` no longer reads `DATABASE_URL` on its own — it must be constructed with a driver adapter (`@prisma/adapter-pg` here). This is wired up in `prisma.service.ts`.
2. **Use the session-mode pooler, not the transaction-mode one.** Supabase's transaction pooler (port 6543) doesn't support prepared statements, which Prisma migrations need — it throws `prepared statement "s1" already exists`. The session-mode pooler (port 5432) works for both migrations and normal queries, so `DATABASE_URL` points there.

## Auth (`src/auth/auth.guard.ts`)

Every route on `ChatController` is wrapped with `@UseGuards(AuthGuard)`. The guard:
1. Reads the Supabase access token either from the `Authorization: Bearer <token>` header (normal requests) **or** from an `access_token` query parameter.
2. The query-param fallback exists because the browser's `EventSource` API (used for streaming) cannot send custom headers — the token has to travel in the URL for those requests.
3. Verifies the token via `supabase.auth.getUser(token)` and attaches `{ id, email }` to `request.user`.

GPT update: conversation reads, writes, ratings, renames and deletions are scoped to the authenticated user. Inaccessible resources return 404. The stream checks ownership before calling Gemini.

## Streaming design (`ChatService.streamReply`)

- It's an **async generator**: it `yield`s each text chunk as it arrives from Gemini, so the controller can forward it to the client immediately.
- When the generator finishes, its `return` value carries the token usage (`promptTokens` / `completionTokens`) pulled from Gemini's `usageMetadata` — this is how the controller gets both the streamed text and the final usage from one object.
- **Retry**: only the *first* request to Gemini (before any chunk has been sent) is retried up to 2 times. Retrying mid-stream was avoided — resending a prompt after partial output was already shown to the user would be confusing.
- **Cancellation**: an `AbortController` is created per request. Its `signal` is passed into the Gemini call. When the client disconnects (closes the `EventSource`), NestJS tears down the underlying `Observable`, which calls `abortController.abort()`.
- **Terminal events (updated by GPT)**: successful persistence sends `done`; model or persistence failures send `failure`. The frontend closes the connection for either event. Cancellation closes the client connection immediately; the backend attempts to save any partial reply.

## Endpoints (`/chat/*`, all require a valid Supabase token)

| Method & path | Purpose |
|---|---|
| `POST /chat/conversations` | Creates a new conversation for the authenticated user (and creates the `User` row on first use) |
| `GET /chat/conversations` | Lists the user's conversations, most recently updated first |
| `GET /chat/conversations/:id/messages` | Returns the full message history of one conversation |
| `PATCH /chat/conversations/:id` | Renames an owned conversation; title must contain 1–100 characters |
| `DELETE /chat/conversations/:id` | Deletes an owned conversation and cascades to its messages and usage records |
| `GET /chat/stream` | SSE endpoint — streams a Gemini reply for a given `prompt` + `conversationId`, then saves both the user message and the assistant reply (with usage) to the database |
| `GET /chat/transform` | SSE endpoint — same streaming mechanism, used for "Summarize" and "Rewrite" (prompt is built from `mode` + `text`). Not persisted to the database since it isn't part of a conversation |
| `POST /chat/structured` | Non-streaming — asks Gemini for a JSON object (`title`, `summary`, `keyPoints`) using `responseSchema`, so the frontend can render it as separate editable fields |
| `POST /chat/messages/:id/rating` | Sets a `1` (👍) or `-1` (👎) rating on an assistant message — basic quality tracking |

## How this maps to the original feature list

| Feature | Implementation |
|---|---|
| Streaming Chat Interface | `GET /chat/stream` (SSE + Gemini streaming) |
| Summarization and Rewriting | `GET /chat/transform` |
| Structured, Editable Outputs | `POST /chat/structured` (JSON schema response) |
| Conversation History | `GET /chat/conversations`, `GET /chat/conversations/:id/messages` |
| Cancellation, Retry, and Error Handling | `AbortController` + retry loop in `ChatService`, described above |
| Basic Quality and Cost Tracking | `UsageLog` (tokens) + `Message.rating` (thumbs up/down) |

## GPT update: history and persistence

The model receives the latest 20 messages in chronological order, plus the current prompt. Saving an exchange uses one transaction: check ownership, update activity, fill a null title from the first prompt, and create both messages with token usage. Manual titles are preserved. See [GPT_CHANGES.md](../GPT_CHANGES.md) for the Azerbaijani explanation and checks.
