# LexiAssist — AI Legal Advisor

LexiAssist is an AI-native legal intake and matching platform. A client
describes their legal issue (optionally uploading supporting documents) in
a conversational interface. An asynchronous, tool-calling AI agent extracts
a structured case chronology, assesses risk and estimated case value,
redlines uploaded contracts, and routes the case to a verified lawyer
matching the client's jurisdiction, budget, and legal domain. Matched
lawyers and clients then collaborate through in-app messaging and a WebRTC
video consultation room.

Built by **Mayur, Gurashish, and Praveen**.

---

## How it works

Every client message is handled asynchronously rather than as a single
blocking LLM call:

```
Client message
   │
   ▼
POST /api/agent/init  ──────────────►  (has PDF attachment?)
   │                                        │
   │ no                                     │ yes
   ▼                                        ▼
QStash queue                          /api/agent/parse-pdf
   │                                  (native text-layer extraction,
   │                                   falls back to Gemini vision OCR
   │                                   for scanned documents)
   ▼                                        │
/api/agent/loop  ◄─────────────────────────┘
   │
   │  Gemini reasons over the conversation and either:
   │   • responds directly, or
   │   • calls one or more tools
   ▼
/api/agent/execute-tool
   │
   │  extractCaseChronology · generatePreBriefRisk ·
   │  generateDocumentRedlines · matchVerifyLawyer
   ▼
back to /api/agent/loop (repeat, up to a circuit-breaker step limit of 5)
   │
   ▼
Result pushed to the client in real time via Pusher
```

Every step in that loop is a signed QStash webhook (verified server-side,
not a user-facing endpoint), which means a single client turn can survive
serverless timeouts, retry automatically on transient failures, and run
tool calls without holding an open HTTP connection to the browser.

## Features

- **Conversational intake** with real-time agent progress over Pusher
- **Automated case chronology extraction** — structures a messy client narrative into a verified timeline
- **AI risk assessment** — estimated case value, statute-of-limitations warnings, key legal risks, surfaced to the lawyer dashboard before they ever open the case
- **Document redlining** — side-by-side contract comparison with flagged clauses, risk severity, and suggested rewrites
- **Lawyer matching** — routes cases by jurisdiction, legal domain, and budget against verified, available lawyer profiles
- **PDF ingestion** — native text-layer extraction with a Gemini vision OCR fallback for scanned documents
- **In-app messaging** and a **WebRTC video consultation room** once a case is matched
- **Role-based dashboards** for clients and lawyers

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, React Compiler |
| Database | PostgreSQL via Prisma 7 |
| Auth | NextAuth (credentials, bcrypt-hashed passwords, JWT sessions) |
| Agent orchestration | Vercel AI SDK + Google Gemini 2.5 Flash, queued via Upstash QStash |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Realtime | Pusher (agent progress, chat, WebRTC signaling) |
| File storage | UploadThing |
| Video | WebRTC (signaling relayed over Pusher) |
| Error observability | Sentry |
| Security headers | Strict CSP, HSTS, X-Frame-Options: DENY, etc. (see `next.config.ts`) |
| Testing | Vitest (unit) + standalone integration scripts against a running server |

## Getting started

```bash
git clone <repo-url>
cd lexiassist
npm install
cp .env.example .env      # fill in real values — see below
npx prisma migrate deploy
npm run dev
```

### Environment variables

`.env.example` lists every variable with inline comments on where to get
it. At minimum you'll need:

- `DATABASE_URL` — a PostgreSQL connection string
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — generate the secret with `openssl rand -base64 32`
- `GOOGLE_GENERATIVE_AI_API_KEY` — for Gemini
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` — from your Upstash QStash console
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — from an Upstash Redis database (used for rate limiting)
- `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` — for realtime updates
- `UPLOADTHING_TOKEN` — for document uploads
- `NEXT_PUBLIC_APP_URL` — used to build absolute callback URLs for QStash; in local dev this needs to be a publicly reachable tunnel (e.g. `ngrok http 3000`), since QStash calls your webhooks from the outside
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` — optional, for error observability

### Running tests

```bash
npx vitest run
```

Unit test coverage currently focuses on `src/lib/auth-helpers.ts` — the
shared authorization layer every route and server action routes through
(session checks, case-ownership checks, role checks). See the test file
itself for the IDOR scenarios it specifically guards against.

Separately, there are standalone integration scripts that exercise the
full agent pipeline against a live dev server:

```bash
node test-01-pdf-text-layer.js       # text-layer PDF extraction
node test-02-pdf-scanned-vision.js   # vision OCR fallback for scans
node test-03-chronology.js           # chronology extraction tool
node test-04-document-redlines.js    # redlining tool
```

These need a running server plus live Upstash/Pusher/Gemini credentials —
copy `test-config.js` and fill in a real `TEXT_LAYER_PDF_URL` /
`SCANNED_PDF_URL` before running 01/02. `run-intake-test.js` is a similar
one-off E2E smoke test that posts directly to `/api/agent/init` and
listens on Pusher for the result — update the hardcoded `NGROK_TUNNEL_URL`
at the top before using it.

### One-time migration

If your database has any user accounts created before password hashing was
added, run:

```bash
npx tsx scripts/rehash-legacy-passwords.ts
```

It scans for passwords that don't match the bcrypt hash shape and re-hashes
them in place.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── agent/          # init, loop, execute-tool, parse-pdf, sessions, status
│   │   ├── auth/            # NextAuth route
│   │   ├── uploadthing/
│   │   └── webrtc/signal/
│   ├── actions/            # server actions: cases, documents, messaging, lawyers, consultations
│   ├── dashboard/          # client + lawyer dashboards, chat, chronology/redline/pre-brief viewers, onboarding
│   ├── case/[caseId]/      # shareable single-case view
│   ├── attorney/join/      # lawyer onboarding
│   └── login/              # login page + register modal
├── lib/
│   ├── auth-helpers.ts     # shared session/role/ownership checks — read this first
│   ├── auth.config.ts       # NextAuth provider + JWT/session callbacks
│   ├── rate-limit.ts        # general / agent-init / login / registration limiters
│   ├── limits.ts             # non-rate-limit abuse guards (open-case cap)
│   ├── constants/jurisdictions.ts   # jurisdiction allow-list
│   ├── schemas/tools/legal-schemas.ts  # Zod schemas + legal domain allow-list for every agent tool
│   ├── tools/actions/         # the tool implementations the agent loop invokes
│   └── ai/prompts/agent-prompt.ts  # the agent's system prompt
└── hooks/useAgentSession.ts  # realtime status hook shared by the chat UI
prisma/schema.prisma          # data model
```

## Security notes

A few things worth knowing if you're extending this codebase:

- **Every route and server action that touches a case, session, or
  document goes through `lib/auth-helpers.ts`.** If you're adding a new
  one, use `requireUser` / `requireRole` / `requireCaseAccess` /
  `requireSessionAccess` / `requireAssignedLawyerOrAdmin` rather than
  writing a new inline session check — these guards check ownership
  (client owner, assigned lawyer, or admin), not just role, which is what
  actually prevents one client from reading another client's case by ID.
- **`middleware.ts`** provides a coarse "is this user logged in at all"
  gate on `/dashboard/*` and `/case/*`. It does not replace the
  fine-grained ownership checks above, which still require a database
  lookup per-request.
- **`jurisdiction` / `legalDomain` are validated against fixed enums**
  before ever reaching the LLM, closing off a class of prompt-injection
  via those fields.
- **Agent webhook routes** (`init`, `loop`, `execute-tool`, `parse-pdf`)
  verify the QStash request signature before trusting the payload.
- **Security headers and a strict CSP** are set globally in
  `next.config.ts` — update the `connect-src`/`img-src`/`frame-src` allow-lists
  there if you add a new third-party domain.
- Rate limits, allow-lists (jurisdiction/legal domain), and the open-case
  cap are tuned to reasonable starting guesses, not measured production
  traffic — revisit the numbers in `lib/rate-limit.ts` and `lib/limits.ts`
  once you have real usage data.

## Known gaps / not yet done

- Tool-action business logic (`lib/tools/actions/*`) has integration
  coverage via the `test-0X-*.js` scripts but no isolated unit tests yet.
- The "must call this tool" instruction in the loop route's runtime system
  prompt is a soft nudge, not a hard constraint — worth revisiting with the
  AI SDK's structured tool-choice forcing.

## License

MIT — see [`LICENSE`](./LICENSE).
