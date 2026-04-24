<div align="center">

# 🌌 CollabDocs

### Enterprise-Grade Real-Time Multi-User Document Collaboration Platform

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-6366f1?style=for-the-badge)](https://real-time-collab-frontend-black.vercel.app)
[![Backend](https://img.shields.io/badge/⚙️_Backend-Render-22c55e?style=for-the-badge)](https://real-time-collab-rhvs.onrender.com/health)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/pvtsonicbaka/real-time-collab/actions)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> A production-ready Google Docs alternative built with Yjs CRDT, Socket.io, React 19, and Node.js 22.  
> Supports simultaneous editing, live cursors, threaded comments, version history, and granular RBAC.

**LogicVeda Industry Project · March 2026**

---

![CollabDocs Banner](https://real-time-collab-frontend-black.vercel.app/favicon.svg)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🐳 Docker](#-docker)
- [☸️ Kubernetes](#️-kubernetes)
- [⚙️ CI/CD](#️-cicd)
- [🔐 Security](#-security)
- [📡 API Reference](#-api-reference)
- [🌐 Deployment](#-deployment)
- [📁 Project Structure](#-project-structure)

---

## ✨ Features

| ID | Feature | Description |
|---|---|---|
| F-01 | **Authentication** | Email/password + JWT access & refresh tokens, guest login, Redis token blacklisting |
| F-02 | **Document CRUD** | Create, list, read, update, delete — owner-only delete with full-text search |
| F-03 | **Real-time Editing** | Yjs CRDT conflict-free simultaneous editing — no lost characters |
| F-04 | **User Presence** | Live cursors with name badges and unique colors per user |
| F-05 | **Threaded Comments** | Range-anchored inline comments, replies, resolve/reopen |
| F-06 | **Version History** | Auto-snapshots every 30s + manual save points, preview & restore any version |
| F-07 | **RBAC** | Owner / Editor / Viewer roles, invite via email link, approve/deny access requests |
| F-08 | **Notifications** | Real-time Socket.io events + async email queue via BullMQ + Nodemailer |
| F-09 | **Search** | Full-text search with MongoDB text indexes (title weighted 10x over content) |
| F-10 | **Offline Awareness** | Visual banner + auto-reconnect every 5s via Socket.io |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Vercel)                       │
│   React 19 + Vite + Tiptap + Yjs + Socket.io-client         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────┐
│                      BACKEND (Render)                        │
│   Node.js 22 + Express + Socket.io + JWT Auth               │
│                                                              │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │  REST API   │  │  Socket.io   │  │   BullMQ Worker  │  │
│   │  /api/auth  │  │  Yjs CRDT    │  │   Email Queue    │  │
│   │  /api/docs  │  │  Cursors     │  │   Nodemailer     │  │
│   └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │
└──────────┼────────────────┼───────────────────┼────────────┘
           │                │                   │
    ┌──────▼──────┐  ┌──────▼──────┐   ┌───────▼──────┐
    │  MongoDB    │  │    Redis    │   │   Upstash    │
    │  Atlas      │  │  Pub/Sub   │   │   Redis TLS  │
    │  Documents  │  │  Adapter   │   │   BullMQ     │
    │  Users      │  │  Sessions  │   │   Queues     │
    └─────────────┘  └─────────────┘   └──────────────┘
```

### Data Models

```
User          Document          Comment           Version
────────      ────────────      ───────────       ────────────
_id           _id               _id               _id
name          title             documentId        documentId
email         content           authorId          content
password      owner ──────┐     body              savedBy
cursorColor   collaborators│    anchorText         label
isGuest       createdAt    │    replies[]          isManual
expiresAt     updatedAt    │    resolved           createdAt
              └── userId   │    resolvedBy
                  role     └──► User
```

---

## 🛠️ Tech Stack

| Category | Technology | Why |
|---|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 | Fast HMR, modern React features |
| Rich Text | Tiptap (ProseMirror) | Best-in-class Yjs collaboration extension |
| Real-time | Socket.io v4.8 + Yjs CRDT | WebSocket + HTTP fallback, conflict-free merging |
| State | Zustand | Minimal, no boilerplate |
| Backend | Node.js 22 + Express 5 + TypeScript | LTS, async/await, familiar ecosystem |
| Auth | JWT (access 15m + refresh 7d) + bcryptjs | Stateless, secure, Redis blacklisting |
| Database | MongoDB 8 + Mongoose 9 | Flexible schema, text indexes |
| Cache/Queue | Redis 7 (Upstash) + BullMQ | Pub/Sub adapter, email job queue |
| Email | Nodemailer + Gmail SMTP | Transactional emails |
| Containers | Docker 27 multi-stage | Minimal image size, non-root user |
| Orchestration | Kubernetes (Deployment + HPA + Ingress) | Auto-scaling, production-grade |
| CI/CD | GitHub Actions matrix | Lint → Build → Test → Docker push |
| Deployment | Vercel + Render | Free tier, auto-deploy on push |
| Docs | Swagger / OpenAPI 3.0 | `/api-docs` endpoint |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- MongoDB (Atlas or local)
- Redis (local or Upstash)

### 1. Clone & Install

```bash
git clone https://github.com/pvtsonicbaka/real-time-collab.git
cd real-time-collab
pnpm install
```

### 2. Configure Environment

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/collabdocs
JWT_SECRET=your_super_secret_min_32_chars
JWT_REFRESH_SECRET=another_secret_min_32_chars
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
GMAIL_USER=your@gmail.com
GMAIL_PASS=your_app_password
EMAIL_FROM=CollabDocs <your@gmail.com>
```

Create `apps/frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### 3. Run

```bash
# Terminal 1 — Backend
cd apps/backend && pnpm dev

# Terminal 2 — Frontend
cd apps/frontend && pnpm dev
```

Open **http://localhost:5173** 🎉

---

## 🐳 Docker

### Development

```bash
docker compose up --build
```

### Production

```bash
# Copy and fill in your values
cp apps/backend/.env.example .env

docker compose -f docker-compose.prod.yml --env-file .env up --build
```

Frontend → **http://localhost**  
Backend → **http://localhost:5000**

### Multi-stage Build Details

```dockerfile
# Backend: 3 stages
deps    → install all dependencies (cached layer)
builder → compile TypeScript
runner  → prod deps only + non-root user + HEALTHCHECK

# Frontend: 3 stages  
deps    → install dependencies
builder → vite build (VITE_API_URL injected as build arg)
runner  → nginx:1.27-alpine + SPA routing + gzip + security headers
```

---

## ☸️ Kubernetes

### Local Validation (minikube)

```bash
# One-shot setup
chmod +x k8s/deploy-minikube.sh
./k8s/deploy-minikube.sh

# Add to /etc/hosts
echo "$(minikube ip)  collabdocs.local" | sudo tee -a /etc/hosts

# Open
open http://collabdocs.local
```

### Manifests

| File | Description |
|---|---|
| `k8s/namespace.yaml` | Isolates all resources in `collabdocs` namespace |
| `k8s/secret.yaml` | All sensitive env vars as Kubernetes Secret |
| `k8s/redis.yaml` | Redis Deployment + ClusterIP Service |
| `k8s/backend.yaml` | Backend Deployment + Service + **HPA** (2–6 pods, CPU 60%) |
| `k8s/frontend.yaml` | Frontend Deployment + Service + **HPA** (2–4 pods) |
| `k8s/ingress.yaml` | nginx Ingress — routes `/api`, `/socket.io` → backend, `/` → frontend |

### Apply to cluster

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## ⚙️ CI/CD

GitHub Actions pipeline on every push to `main` / PR:

```
push to main
    │
    ├── Lint (backend + frontend) ──── parallel
    │         ↓
    ├── Build (backend + frontend) ─── parallel
    │         ↓
    ├── Test (backend + frontend) ──── parallel
    │         ↓
    └── Docker build & push ─────────── only on main
              ↓
        ghcr.io/pvtsonicbaka/collabdocs-backend:latest
        ghcr.io/pvtsonicbaka/collabdocs-frontend:latest
```

Workflow file: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

---

## 🔐 Security

| Measure | Implementation |
|---|---|
| **Helmet** | Security headers on all responses |
| **CORS** | Strict origin allowlist via `CLIENT_URL` env var |
| **JWT** | httpOnly cookies, `secure: true` in production, `sameSite: none` for cross-domain |
| **Refresh token blacklisting** | Redis TTL-based blacklist on logout |
| **Input sanitization** | `sanitize-html` — strips all HTML from text fields, allowlist for rich content |
| **Socket auth** | JWT verified on every socket handshake |
| **Role enforcement** | Viewer cannot push Yjs updates; kick-user requires owner role |
| **Guest isolation** | Guest accounts auto-deleted after 2h via MongoDB TTL index |
| **No secrets in repo** | `.env` in `.gitignore`, Render/Vercel env vars for production |
| **OWASP Top 10** | XSS (sanitization), CSRF (sameSite cookies), injection (Mongoose), broken auth (JWT + bcrypt) |

---

## 📡 API Reference

Full Swagger docs available at: **https://real-time-collab-rhvs.onrender.com/api-docs**

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT cookies |
| POST | `/api/auth/logout` | Logout, blacklist refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/guest` | Create temporary guest session |
| PUT | `/api/auth/profile` | Update name / cursor color |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/documents` | List documents (paginated + search) |
| POST | `/api/documents` | Create document |
| GET | `/api/documents/:id` | Get document by ID |
| PUT | `/api/documents/:id` | Update content |
| DELETE | `/api/documents/:id` | Delete (owner only) |
| POST | `/api/documents/:id/invite` | Send email invite |
| POST | `/api/documents/invite/accept` | Accept invite token |
| POST | `/api/documents/:id/collaborator` | Add collaborator |
| PATCH | `/api/documents/:id/collaborator/:userId` | Change role |
| DELETE | `/api/documents/:id/collaborator/:userId` | Remove collaborator |

### Versions & Comments
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/documents/:id/versions` | List versions |
| POST | `/api/documents/:id/versions` | Manual save point |
| POST | `/api/documents/:id/versions/:vId/restore` | Restore version |
| GET | `/api/documents/:id/comments` | List comments |
| POST | `/api/documents/:id/comments` | Add comment |
| POST | `/api/documents/:id/comments/:cId/reply` | Reply to comment |
| PATCH | `/api/documents/:id/comments/:cId/resolve` | Resolve comment |
| DELETE | `/api/documents/:id/comments/:cId` | Delete comment |

### Health & Metrics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service health check |
| GET | `/metrics` | Memory, uptime, DB/Redis status (auth required) |

---

## 🌐 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://real-time-collab-frontend-black.vercel.app |
| Backend | Render (free) | https://real-time-collab-rhvs.onrender.com |
| Database | MongoDB Atlas | Cluster0 (M0 free) |
| Redis | Upstash | TLS-enabled, free tier |

> ⚠️ **Note:** Render free tier spins down after 15 min of inactivity. First request may take ~30s to wake up. Visit `/health` first to warm it up before the demo.

---

## 📁 Project Structure

```
real-time-collab/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/          # DB, Redis, Swagger
│   │   │   ├── middleware/       # auth, ownership
│   │   │   ├── models/          # User, Document, Comment, Version
│   │   │   ├── queues/          # BullMQ email queue
│   │   │   ├── routes/          # auth, document, comment, version
│   │   │   ├── sockets/         # Socket.io setup + Yjs handlers
│   │   │   ├── utils/           # sanitize, emailTemplates
│   │   │   ├── workers/         # email worker
│   │   │   └── index.ts         # Express app entry
│   │   ├── Dockerfile           # Multi-stage build
│   │   └── .env.example
│   └── frontend/
│       ├── src/
│       │   ├── components/      # Editor, CommentsPanel, VersionHistory, CollaboratorsPanel
│       │   ├── hooks/           # useDocuments
│       │   ├── pages/           # Login, Register, Dashboard, EditorPage, InvitePage
│       │   ├── store/           # authStore, themeStore (Zustand)
│       │   └── utils/           # api.ts, color.ts
│       ├── Dockerfile           # Multi-stage + nginx
│       ├── nginx.conf           # SPA routing + gzip + security headers
│       └── vercel.json          # SPA rewrite rules
├── k8s/                         # Kubernetes manifests
│   ├── namespace.yaml
│   ├── secret.yaml
│   ├── redis.yaml
│   ├── backend.yaml             # Deployment + Service + HPA
│   ├── frontend.yaml            # Deployment + Service + HPA
│   ├── ingress.yaml             # nginx Ingress + WebSocket support
│   └── deploy-minikube.sh       # One-shot local validation script
├── .github/
│   └── workflows/
│       └── ci.yml               # Lint → Build → Test → Docker push
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production
└── pnpm-workspace.yaml          # Monorepo config
```

---

## 🎯 LogicVeda Submission

- **Project Code:** lv1-2026-03-01
- **Live Demo:** https://real-time-collab-frontend-black.vercel.app
- **GitHub:** https://github.com/pvtsonicbaka/real-time-collab
- **Swagger API Docs:** https://real-time-collab-rhvs.onrender.com/api-docs

### Demo Instructions

1. Open the live demo — click **"Continue as Guest"** (no signup needed)
2. Create a document
3. Copy the URL and open in a second tab/browser
4. Both users can edit simultaneously — watch the live cursors
5. Try adding a comment by selecting text
6. Check version history via the 🕐 button

---

<div align="center">

Built with ❤️ for LogicVeda Web Development Domain · March 2026

</div>
