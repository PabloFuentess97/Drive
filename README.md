# PersonalDrive

Self-hosted personal Drive SaaS built with **Next.js 14 (App Router)**, **PostgreSQL + Prisma**, **Tailwind CSS** and a real **PWA** with offline support.
Designed to run on a single VPS with Docker — no third-party storage, no SaaS dependencies.

> Each user gets their own isolated tree of folders and files, a per-user storage quota, image thumbnails, range-based video streaming, password-protected share links and an installable, offline-capable web app.

---

## Features

| Area              | Capabilities                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Auth              | Email + password (bcrypt), JWT in `httpOnly` cookies, edge middleware route guards, optional admins. |
| Files             | Drag & drop upload (with progress), rename, move, delete, image/video/audio/PDF preview.             |
| Folders           | Create / rename / move / recursive delete with descendant safety checks.                             |
| Storage           | Streaming uploads to disk, SHA-256 checksums, automatic image thumbnails (sharp).                    |
| Sharing           | Tokenized public links, optional password, expiration and download caps.                             |
| Quotas            | Per-user byte quota, enforced server-side at upload and on quota recheck after persistence.          |
| Streaming         | HTTP `Range` support → seekable video / large download playback.                                     |
| PWA               | `manifest.json`, install prompt, dedicated offline page.                                             |
| Offline           | Service Worker (network-first / cache-first), IndexedDB store for pinned files & queued uploads.    |
| Sync              | Queued uploads automatically replay when the browser comes back online.                              |
| Admin             | `ADMIN_EMAILS` env var auto-promotes accounts on first registration.                                 |

---

## Tech stack

- **Next.js 14** (App Router, server actions ready, standalone output)
- **PostgreSQL 16** via **Prisma 5**
- **Tailwind CSS 3**
- **bcryptjs** + **jose** (Edge-compatible JWT)
- **sharp** for thumbnails / image metadata
- **Service Worker + IndexedDB** for offline
- **Docker** (multi-stage) + **docker-compose**

---

## Project layout

```
.
├── prisma/schema.prisma          # User, Session, Folder, File, Share
├── public/
│   ├── manifest.json
│   ├── sw.js                     # Service Worker (offline cache)
│   ├── offline.html              # Fallback shell when offline
│   └── icons/                    # PWA icons (replace with your own)
├── src/
│   ├── middleware.ts             # Edge auth guard
│   ├── app/
│   │   ├── layout.tsx            # Root layout (mounts SW + offline UI)
│   │   ├── page.tsx              # Public landing
│   │   ├── (auth)/login          # /login
│   │   ├── (auth)/register       # /register
│   │   ├── (dashboard)/layout    # Authenticated shell (sidebar + header)
│   │   ├── (dashboard)/drive     # File browser (root)
│   │   ├── (dashboard)/drive/[id]# File browser (folder)
│   │   ├── (dashboard)/recent    # Recent files
│   │   ├── (dashboard)/shared    # Active shared links
│   │   ├── (dashboard)/account   # Profile / quota dashboard
│   │   ├── share/[token]/page    # Public download page
│   │   └── api/
│   │       ├── auth/             # register · login · logout · me
│   │       ├── files/            # list · upload · rename · delete · download (range)
│   │       ├── folders/          # CRUD + breadcrumb + recursive delete
│   │       ├── share/            # create · revoke · download (with password/expiry)
│   │       └── stats/            # quota & recent activity
│   ├── components/               # Sidebar, Header, FileBrowser, FilePreview, ShareDialog…
│   └── lib/                      # prisma · auth · jwt · storage · env · offline-db · utils
├── scripts/
│   ├── entrypoint.sh             # Runs migrations then starts the server
│   └── init-vps.sh               # One-shot bootstrap for a Linux VPS
├── deploy/
│   ├── Caddyfile.example
│   └── nginx.conf.example
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Local development

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# - point DATABASE_URL at your Postgres
# - set a strong JWT_SECRET (openssl rand -base64 64)
# - pick a STORAGE_DIR you can write to

# 3. Initialize the database
npx prisma migrate dev --name init   # or: npx prisma db push

# 4. Run the dev server
npm run dev
# → http://localhost:3000
```

A spare Postgres for development:

```bash
docker run --rm -d --name drive-pg -e POSTGRES_PASSWORD=drive -e POSTGRES_USER=drive -e POSTGRES_DB=drive -p 5432:5432 postgres:16-alpine
```

---

## Production with Docker

```bash
cp .env.example .env
# Required: set JWT_SECRET (long random string), POSTGRES_PASSWORD, NEXT_PUBLIC_APP_URL.

docker compose up -d --build
```

The app exposes port `3000`. Files are persisted in the `storage` Docker volume (mounted at `/data/uploads`); the database in `db-data`. Migrations run automatically on container start (`scripts/entrypoint.sh`).

### One-shot script for a fresh VPS

```bash
git clone <your repo> personal-drive
cd personal-drive
sudo bash scripts/init-vps.sh
```

It installs Docker (if missing), seeds `.env` with a strong `JWT_SECRET` and runs `docker compose up -d --build`.

### Reverse proxy / TLS

The Node server should always sit behind a reverse proxy that terminates TLS and enforces the upload limit:

- `deploy/Caddyfile.example` — easiest path, fully automatic HTTPS via Caddy.
- `deploy/nginx.conf.example` — drop-in for an existing Nginx + Certbot setup.

Make sure `client_max_body_size` (Nginx) or `request_body max_size` (Caddy) is at least equal to `MAX_UPLOAD_BYTES`.

### Backups

Two things to back up:

1. **Database** — `docker compose exec db pg_dump -U drive drive | gzip > drive-$(date +%F).sql.gz`
2. **File storage** — back up the `storage` volume (or the host path you mount over `/data/uploads`).

Restore by piping the SQL into `psql` and putting the volume contents back.

---

## Environment variables

| Var                    | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection string.                                                              |
| `JWT_SECRET`           | Long random string used to sign session JWTs (`openssl rand -base64 64`).                |
| `JWT_EXPIRES_IN`       | JWT/cookie lifetime (default `7d`).                                                      |
| `STORAGE_DIR`          | Absolute path where blobs are persisted on disk.                                         |
| `DEFAULT_QUOTA_BYTES`  | Default per-user quota in bytes (default 10 GB).                                         |
| `MAX_UPLOAD_BYTES`     | Single-file upload cap (default 2 GB).                                                   |
| `ADMIN_EMAILS`         | Comma-separated emails that get the `ADMIN` role on registration.                        |
| `NEXT_PUBLIC_APP_NAME` | Brand name shown in the UI / PWA manifest title.                                         |
| `NEXT_PUBLIC_APP_URL`  | Public URL (used for share links, PWA scope).                                            |

---

## Architecture notes

### Authentication

- Passwords hashed with `bcrypt` (cost 12).
- Sessions are JWTs (HS256) signed with `JWT_SECRET` and stored in an `httpOnly`, `SameSite=Lax`, `Secure` cookie.
- A `Session` row is also persisted in Postgres so that you can audit / forcibly revoke sessions.
- `src/middleware.ts` runs at the Edge and short-circuits unauthenticated traffic to the dashboard.

### Storage

- Files are written to `STORAGE_DIR/<userId>/files/<fileId>` (no user-controlled segments → no path traversal).
- Uploads are streamed directly from the request body to disk, with SHA-256 computed on the fly. RAM use is constant regardless of file size.
- `sharp` produces a 512×512 WebP thumbnail for images.
- `src/lib/storage.ts:objectPath` validates that the resolved path stays inside the user's directory.

### Quotas & integrity

- Quota is enforced before opening the stream (using `request.size`) **and again** once the actual size is known on disk; if a client lies, the file is removed and the request fails with `413`.
- Deleting files / folders adjusts `User.usedBytes` inside a transaction with the deletion itself.
- Folder deletion is recursive and decrements bytes for every nested file.

### Streaming

- `/api/files/[id]/download` understands the `Range` header, allowing browsers to seek inside videos and resume large downloads.
- Public share endpoints support the same.

### PWA & offline

- `public/manifest.json` makes the app installable.
- `public/sw.js` implements per-route strategies:
  - `/_next/static`, `/icons` → cache-first.
  - File listings (`/api/files…`) → network-first with a cache fallback so the file grid still renders offline.
  - Navigations → network-first with `/offline.html` fallback.
- `src/lib/offline-db.ts` exposes an IndexedDB-backed store with two object stores:
  - `files` — blobs the user explicitly pinned (button "Offline" on each file card).
  - `uploadQueue` — uploads attempted while offline; `syncQueuedUploads()` replays them as soon as `online` fires.
- The `OfflineIndicator` and `PWAInstaller` components surface state / install prompt to the user.

### Sharing

- A `Share` row stores a base64url token, optional bcrypt password hash, optional expiration and optional download cap.
- Public download endpoint validates everything before opening a stream and increments a counter.
- Owners can list & revoke their links from `/shared`.

---

## Roadmap / nice-to-haves

The repo is intentionally focused — it covers everything the brief asked for plus the optional extras (quotas, image compression, video streaming, password / expiring share links). Possible next steps:

- WebAuthn / passkeys instead of passwords.
- Folder sharing (currently shares are per-file).
- Background uploads via the Background Sync API + a service worker upload queue (currently the page replays the queue when online).
- Per-folder access tokens for IoT / programmatic uploads.
- Trash / restore.
- Image transformations on the fly (`sharp` already in the stack).

---

## License

MIT — do whatever you like with it.
