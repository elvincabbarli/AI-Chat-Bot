# AI Chat Bot

AI Chat Bot is a full-stack AI workspace with authenticated conversations, real-time Gemini responses, text transformation tools, and editable structured notes.

The repository contains two separate applications:

- [`backend/`](./backend) - NestJS API, authentication verification, Gemini integration, streaming, persistence, and usage tracking.
- [`frontend/`](./frontend) - React/Vite client, authentication screens, chat UI, conversation management, and AI tools.

The frontend and backend are intentionally documented separately below so that their responsibilities remain clear.

## Features

- Supabase email/password authentication.
- Authenticated chat conversations with history.
- Streaming Gemini responses over Server-Sent Events (SSE).
- Conversation creation, selection, automatic titles, renaming, and deletion.
- Cancellation of an in-progress response.
- Summarization and rewriting of standalone text.
- Structured note generation with a title, summary, and editable key points.
- Thumbs-up/down ratings for assistant messages.
- Gemini prompt/completion token tracking.
- Ownership checks so users can access only their own conversations and messages.

## Architecture overview

```text
React + Vite frontend
        |
        | REST requests with Authorization: Bearer <Supabase access token>
        | SSE requests with ?access_token=<Supabase access token>
        v
NestJS backend
   |            |
   |            +--> Google Gemini (@google/genai)
   |
   +--> Prisma 7 + PostgreSQL (hosted by Supabase)
        |
        +--> users, conversations, messages, usage logs
```

Supabase Auth is responsible for user identity and sessions. The backend verifies the resulting access token, while Prisma stores application data in PostgreSQL. The frontend never sends a password to the backend.

## Backend

### Technology stack

| Technology                    | Purpose                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| NestJS 12                     | Modular HTTP API using controllers, services, modules, and dependency injection         |
| TypeScript                    | Type-safe backend implementation                                                        |
| `@google/genai`               | Google Gemini requests, streaming responses, structured JSON output, and usage metadata |
| Prisma 7                      | Type-safe PostgreSQL access and migrations                                              |
| `@prisma/adapter-pg` and `pg` | PostgreSQL driver adapter required by Prisma 7                                          |
| PostgreSQL                    | Persistent relational storage                                                           |
| Supabase JS                   | Verification of Supabase access tokens                                                  |
| RxJS                          | SSE observables used by the controller                                                  |
| Vitest and Supertest          | Unit and end-to-end testing                                                             |
| Oxlint and Prettier           | Linting and formatting                                                                  |

### Backend structure

```text
backend/
├── prisma/
│   ├── schema.prisma           # Database models and relations
│   └── migrations/             # Versioned database migrations
├── src/
│   ├── auth/auth.guard.ts      # Supabase token verification
│   ├── chat/
│   │   ├── chat.controller.ts  # Protected REST and SSE endpoints
│   │   ├── chat.service.ts     # Gemini, validation, persistence, and chat logic
│   │   └── stream-error.ts     # Safe user-facing stream error messages
│   ├── prisma/
│   │   ├── prisma.module.ts    # Prisma dependency-injection module
│   │   └── prisma.service.ts   # Prisma lifecycle and PostgreSQL adapter
│   ├── app.module.ts            # Root NestJS module
│   └── main.ts                  # Application bootstrap and CORS
└── test/                        # End-to-end tests
```

### Authentication and authorization

All `/chat/*` routes use `AuthGuard`.

1. The guard reads a bearer token from the `Authorization` header for regular HTTP requests.
2. It also accepts `access_token` in the query string because the browser's native `EventSource` API cannot set custom request headers.
3. Supabase validates the token through `supabase.auth.getUser(token)`.
4. The authenticated Supabase user ID and email are attached to the request.
5. Conversation, message, rename, delete, and rating operations are scoped to that user.

An inaccessible conversation or message is returned as not found rather than exposing another user's data. The backend also validates text length and allowed rating values before processing requests.

### Chat and Gemini logic

`ChatService` is the main backend business-logic layer:

- It loads at most the latest 20 messages in chronological order and sends them to Gemini with the new user prompt.
- It uses `generateContentStream` to yield response text as chunks arrive.
- It passes token usage from Gemini's `usageMetadata` back to the controller after the stream ends.
- It retries only the initial Gemini request, up to two times, for retryable failures. It does not restart a response after partial output has already been sent.
- It uses an `AbortController` so a disconnected client can cancel the Gemini request.
- It saves a completed exchange in a database transaction: user message, assistant message, usage log, conversation activity, and an initial automatic title.
- If the client cancels after partial output, the available reply is attempted to be saved with zero usage values.

The default model is `gemini-flash-latest`; it can be replaced with the `GEMINI_MODEL` environment variable.

### Backend functionality and endpoints

All endpoints below require a valid Supabase access token.

| Method   | Endpoint                           | Functionality                                                                |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `POST`   | `/chat/conversations`              | Creates a conversation and creates the local user record on first use        |
| `GET`    | `/chat/conversations`              | Lists the authenticated user's conversations, newest activity first          |
| `GET`    | `/chat/conversations/:id/messages` | Returns the message history for an owned conversation                        |
| `PATCH`  | `/chat/conversations/:id`          | Renames an owned conversation; title length is 1-100 characters              |
| `DELETE` | `/chat/conversations/:id`          | Deletes an owned conversation and cascaded messages/usage records            |
| `GET`    | `/chat/stream`                     | Streams a Gemini chat reply and persists the exchange                        |
| `GET`    | `/chat/transform`                  | Streams a standalone `summarize` or `rewrite` result without persistence     |
| `POST`   | `/chat/structured`                 | Returns a validated JSON note containing `title`, `summary`, and `keyPoints` |
| `POST`   | `/chat/messages/:id/rating`        | Stores `1` or `-1` for an owned assistant message                            |

The streaming controller emits:

- unnamed SSE messages for text chunks;
- `done` after successful generation and persistence;
- `failure` when generation or persistence fails.

### Database model

The Prisma schema contains four application models:

- **User** - mirrors a Supabase Auth user using the same user ID.
- **Conversation** - belongs to one user and contains messages.
- **Message** - stores `USER` or `ASSISTANT` content and an optional rating.
- **UsageLog** - stores prompt and completion token counts for assistant messages.

Conversation deletion cascades to its messages and usage logs. Prisma 7 is configured with the PostgreSQL driver adapter, and `DATABASE_URL` is used for the application connection and migrations.

### Backend environment variables

Create `backend/.env` locally. Do not commit real secrets.

```env
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
GOOGLE_API_KEY=<google-gemini-api-key>
GEMINI_MODEL=gemini-flash-latest
```

The Supabase database connection should use a session-mode pooler or another PostgreSQL connection that supports Prisma prepared statements.

## Frontend

### Technology stack

| Technology            | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| React 19              | Component-based application UI                                  |
| Vite                  | Development server and production build                         |
| TypeScript            | Type-safe UI, API, and state models                             |
| MUI (`@mui/material`) | Layout, forms, tabs, dialogs, alerts, lists, and loading states |
| MUI Icons             | Icons used throughout the application                           |
| Emotion               | MUI styling dependencies                                        |
| Supabase JS           | Login, signup, session persistence, and auth state changes      |
| EventSource           | Native SSE client for live AI responses                         |
| Oxlint                | Frontend linting                                                |

### Frontend structure

```text
frontend/src/
├── api/
│   ├── client.ts               # Authenticated REST request helpers
│   ├── chat.ts                 # Typed chat/conversation API functions
│   └── stream.ts               # Shared SSE connection and event handling
├── auth/
│   ├── supabaseClient.ts       # Shared Supabase client
│   ├── AuthContext.tsx         # Global session state and auth listener
│   └── useAuth.ts              # Hook for consuming auth state
├── components/
│   ├── chat/                   # Conversation list, chat window, messages, input
│   ├── layout/                 # Application shell and logout UI
│   ├── structured/             # Structured note form and key-point editor
│   └── transform/              # Summarize/rewrite panel
├── hooks/
│   ├── useConversations.ts     # Conversation loading and mutations
│   ├── useMessages.ts          # Message loading and abort handling
│   ├── useChatStream.ts        # Chat streaming state and cancellation
│   └── useTransformStream.ts   # Transform streaming state and cancellation
├── pages/                      # Login, signup, and chat pages
├── types/chat.ts               # Shared API/domain types
├── App.tsx                     # Auth gate and top-level tool navigation
└── main.tsx                    # React, MUI theme, and auth providers
```

### Authentication flow

1. `AuthProvider` loads the existing Supabase session on startup.
2. It subscribes to Supabase auth-state changes so login, logout, and token refreshes update the application.
3. `App` displays `LoginPage` when there is no session.
4. `LoginForm` and `SignUpForm` call Supabase directly with email/password credentials.
5. Once authenticated, API helpers retrieve the current access token and attach it to backend requests.

### API and streaming logic

The frontend has two communication paths:

- **REST:** `api/client.ts` provides typed `GET`, `POST`, `PATCH`, and `DELETE` helpers. It attaches `Authorization: Bearer <token>` and maps common HTTP failures to user-facing errors.
- **SSE:** `api/stream.ts` builds an `EventSource` URL with `access_token`, `conversationId`, `prompt`, or transform parameters. Text chunks are appended immediately, while `done`, `failure`, and connection errors close the stream explicitly.

`useChatStream` and `useTransformStream` prevent overlapping requests, accumulate streamed text, cancel streams when the user stops or leaves the page, and ignore late events from an older request. A completed chat refreshes messages and conversations because persistence has already happened on the backend.

### Frontend functionality

#### Chat workspace

`ChatPage` combines the conversation sidebar with `ChatWindow`.

- Create a new conversation.
- Select a conversation and load its history.
- Send prompts and see the assistant response appear progressively.
- Cancel an active response.
- Refresh history after cancellation or persistence delays.
- Rename conversations through a validated dialog.
- Delete conversations after confirmation.
- Rate saved assistant messages with thumbs up/down controls.

The user's prompt and the streaming assistant preview are shown immediately. After successful persistence, the preview is replaced with the saved message history.

#### Summarize / Rewrite

`TransformPanel` lets the user choose either `summarize` or `rewrite`, enter standalone text, and run or cancel an SSE request. These results are intentionally not added to chat history.

#### Structured Note

`StructuredNoteForm` sends text to the non-streaming structured endpoint. The returned JSON is displayed as editable title, summary, and key-point fields. This feature keeps edits in frontend state; it does not currently save them as a conversation or separate document.

## Setup and development

### Prerequisites

- Node.js with npm.
- A Supabase project with Auth enabled and a PostgreSQL database.
- A Google Gemini API key.

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure environment variables

Create `backend/.env` using the backend variables above and `frontend/.env` with:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
```

Only publishable Supabase values belong in the frontend. Keep database URLs and Gemini keys in the backend environment.

### 3. Apply database migrations

```bash
cd backend
npx prisma migrate deploy
```

For local schema development, use the repository's Prisma configuration and migration workflow.

### 4. Start the applications

In one terminal:

```bash
cd backend
npm run start:dev
```

In another terminal:

```bash
cd frontend
npm run dev
```

The default local addresses are `http://localhost:3000` for the backend and `http://localhost:5173` for the Vite frontend.

## Validation commands

Backend:

```bash
cd backend
npm run build
npm run lint
npm test
npm run test:e2e
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

## Important implementation notes

- CORS is enabled by the backend because the Vite development server and API run on different origins.
- Native browser `EventSource` cannot send custom headers, which is why streaming authentication uses the `access_token` query parameter.
- Chat exchanges are persisted only after the backend finishes generation, except for a best-effort partial save on client cancellation.
- Gemini retrying is deliberately limited to the initial request; retrying after chunks have reached the user could duplicate or confuse the response.
- Token usage is stored in the database for cost/usage analysis but is not currently displayed in the frontend.
- Structured notes are generated and editable in the UI, but are not persisted as independent documents.
