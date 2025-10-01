# Secure Overlay Chat Protocol – Group 29 Implementation

This repository contains the reference implementation of the Secure Overlay Chat Protocol (SOCP) v1.3 for Group 29. It
combines a Fastify-based backend (HTTP + WebSocket) with a Next.js front-end, Prisma ORM, and SQLite storage to deliver
an end-to-end encrypted messaging experience that conforms to the cohort specification.

---

## Contact Points:

For any issues on running the code, please reach out to:

- Son Tung Hoang: a1984077@adelaide.edu.au. Phone number: 0461269613

## Group Members:

- Son Tung Hoang
- Varuna Lingam Pavalla Maharudramurthy
- Mustafa Tufan Keser
- Souvik Sarker
- Zhong Hong Su

## Key Features

- **SOCP-compliant transport** – WebSocket framing, deterministic routing, presence gossip, acknowledgements, and health
  checks.
- **End-to-end encryption** – Direct messages and public-channel payloads use RSA-4096 + RSA-OAEP and RSASSA-PSS
  signatures as mandated by the protocol.
- **Public channel support** – Deterministic group-key handling for development plus scaffolding for wrapped key
  distribution.
- **Fastify plugin architecture** – Autoloaded plugins/routes keep the server modular, with protocol handlers in
  `handlers/`.
- **Next.js client** – React 19 app with state stores, websockets, and crypto helpers that mirror the backend contract.
- **Prisma ORM** – SQLite database (`prisma/dev.db`) tracks client registrations, keys, and session activity.
- **Testing harness** – Node Test Runner suites under `test/` exercise routes and plugins.

---

## Repository Layout

```
├── app.js                  # Fastify bootstrapper (autoloads plugins/routes)
├── handlers/               # Opcode handlers (MSG_DIRECT, MSG_PUBLIC_CHANNEL, etc.)
├── plugins/                # Fastify plugins (CORS, security helpers, etc.)
├── routes/                 # HTTP and WebSocket routes (e.g., /chat)
├── utilities/              # Shared backend utilities (crypto helpers, registry)
├── prisma/
│   ├── schema.prisma       # Prisma schema (SQLite)
│   ├── migrations/         # Database migrations
│   └── dev.db              # Default SQLite database (generated)
├── generated/              # Prisma client output (do not edit)
├── frontend/               # Next.js 15 application (app router)
│   ├── src/app/            # Pages and layout
│   ├── src/contexts/       # React context providers (network, chat, auth)
│   ├── src/lib/            # Front-end crypto + protocol helpers
│   └── package.json        # Front-end dependencies/scripts
├── test/                   # Node --test suites
└── README.md               # This guide
```

---

## Prerequisites

- **Node.js** ≥ 22 (Fastify 5 and Next.js 15 require modern runtime features).
- **yarn** as the package manager
- **SQLite 3** (bundled with macOS/Linux; Windows users can install from <https://www.sqlite.org/download.html>).

When using a Node version manager (e.g., `nvm`), ensure `corepack enable` has been run if you prefer pnpm/yarn.

> PLEASE TAKE NOTE: Node.js 22+ is required to run this project. If you have an older version installed, please upgrade
> to meet this requirement.

---

## Environment Configuration

The backend expects an `.env` file in the repository root (already provided):

```env
DATABASE_URL="file:./dev.db"
FASTIFY_IGNORE_WATCH='prisma frontend node_modules'
```

Prisma resolves SQLite paths relative to the schema file, so `file:./dev.db` ultimately refers to `prisma/dev.db`. You
normally do **not** need to change this, but if you move the project ensure the DB path still points inside `prisma/`.

For non-development deployments replace the SQLite DSN with a production database connection string and supply
additional secrets via environment variables (JWT signing keys, CORS allow-lists, etc.).

---

## Backend Setup & Commands

```bash
# 1. Install dependencies (Fastify, Prisma, etc.)
yarn install

# 2. Apply migrations & generate Prisma client
yarn prisma reset
yarn prisma migrate dev

# 3. Create private keys for backend server
yarn generate:key

# 4. Run the Fastify dev server (port 3000)
yarn dev

# If you need start another server (test server-server)
yarn dev --port 3002

# 3. Inspect database records with Prisma Studio
yarn studio
```

---

## Front-end Setup & Commands

```bash
cd frontend

# Install Next.js dependencies
yarn install

# Run the development server (http://localhost:3001)
yarn dev

```

The client connects to the backend WebSocket endpoint at `http://localhost:3000/chat` when `NODE_ENV !== "production"`.
Update `frontend/src/constants/endpoint.ts` if your backend lives elsewhere.

Run both dev servers simultaneously (two terminal windows/tabs) to interact with the full stack:

1. **Backend:** `yarn dev` in the repository root.
2. **Frontend:** `cd frontend && yarn dev` (opens on port 3001).

---

## Typical Development Flow

1. Start both dev servers as described above.
2. Visit <http://localhost:3001/login>. Each login generates a fresh RSA-4096 key pair client-side and registers the
   user via `USER_HELLO`.
3. Open a second browser profile/incognito window to simulate another user.
4. Use chat slash-commands:
    - `/list` – enumerate active users and last-seen timestamps.
    - `/tell <user> <message>` – send a direct E2EE message.
    - `/all <message>` – broadcast to the public channel (group-key encrypted).
5. Observe backend logs for presence gossip, deliveries, and heartbeat status.

Logout via the UI or closing the tab triggers cleanup and marks the user inactive in the database.

---

## Protocol Coverage Snapshot

| Area               | Implementation Notes                                                                                                                                 |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Transport          | WebSocket RFC 6455; JSON envelope per SOCP §7 with `type`, `from`, `to`, `ts`, `payload`, `sig`.                                                     |
| Server ↔ Server    | Introducer/bootstrap scaffolding (`SERVER_HELLO_JOIN`, `SERVER_ANNOUNCE`, heartbeat) included; multi-server routing stubs ready for extension.       |
| User ↔ Server      | `USER_HELLO`, `MSG_DIRECT`, `MSG_PUBLIC_CHANNEL`, heartbeat ACK/ERROR frames implemented. Duplicate user detection and activity tracking via Prisma. |
| Cryptography       | RSA-4096 with RSA-OAEP (SHA-256) for confidentiality; RSASSA-PSS for signatures. Front-end uses WebCrypto; backend validates with Node `crypto`.     |
| Presence & Routing | `connectionRegistry` maps sockets ↔ user IDs; handler enforces SOCP routing algorithm (deliver locally, else TODO for remote forwarding).            |
| Public Channel     | Deterministic AES-GCM group key for local development plus placeholder support for wrapped-key distribution (SOCP §9.3).                             |
| Files              | Opcode placeholders (`FILE_START`, etc.) ready for future implementation.                                                                            |

Refer to `handlers/` for opcode specifics and `utilities/` for helper logic.

---

## Testing & Quality

- **Unit/Integration Tests:** `npm test` runs Node’s built-in test runner across `test/**/*.test.js`.
- **ESLint/Prettier:** Front-end lint via `npm run lint`; backend formatting follows Prettier defaults (2 spaces,
  semicolons). Run Prettier before committing.
- **Manual Exercises:** Use two browser sessions to confirm direct message signatures, public channel decryption, and
  heartbeat disconnect handling.

Add new tests under `test/routes/` or `test/plugins/`, reusing fixtures from `test/helper.js` to ensure sockets/Prisma
shutdown cleanly.

---

## Troubleshooting

- **`Timed out waiting for expected message after 5000ms`** – Backend likely failed to ACK `USER_HELLO`. Confirm the
  Fastify server is running, the database contains the `Client` table (`sqlite3 prisma/dev.db '.schema'`), and
  migrations were applied.
- **`ERR_REQUIRE_ESM` from `base64url-universal`** – Make sure you’re on the latest commit; `utilities/crypto.js` now
  implements native base64url decoding for CommonJS compatibility.
- **`OperationError` when unwrapping group key** – Occurs if the server sends a placeholder wrapped key. Current build
  falls back to a deterministic AES key; refresh after both users have joined to regenerate keys.
- **`EADDRINUSE: address already in use ::1:3000`** – A previous Fastify watcher is still running. Kill stray processes
  with `lsof -ti :3000 | xargs kill` before restarting.
- **Prisma `P2021` (table does not exist)** – Delete `prisma/dev.db`, re-run
  `npx prisma migrate dev --schema prisma/schema.prisma`, or apply the SQL migration manually.

---

## Contributing

1. Fork/clone and create a feature branch.
2. Follow the existing commit style (`Add`, `Fix`, `Refine`, ≤ 72 chars).
3. Run formatter, linters, and tests before submitting PRs.
4. Document protocol or schema changes in the PR description and include reproduction steps/screenshots where
   applicable.

For significant SOCP deviations, update this README and coordinate with peers to maintain interoperability.

---

## License

This project inherits the license specified in `package.json` (ISC). Review before redistribution.

---

## Appendix: Useful Commands

```bash
# Reset the dev database
sqlite3 prisma/dev.db "DELETE FROM Client;"

# Clear connection registry without restarting server
npx node -e "require('./utilities/connection-registry').clearAll()"

# Inspect WebSocket frames (requires wscat)
npx wscat -c ws://localhost:3000/chat

# Run Next.js in production mode locally
cd frontend && npm run build && npm run start
```

Happy hacking and see you on the overlay! 🚀
