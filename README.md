<div align="center">

# Express API Starter with TypeScript

*A JSON:API-compliant REST starter with JWT auth, role-based access control, and Drizzle ORM — demonstrated through a manufacturing workflow: quote requests → quotes → contracts → production status.*

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square)
![JSON:API](https://img.shields.io/badge/JSON-API-000000?style=flat-square)

[Features](#features) • [Getting started](#getting-started) • [API reference](#api-reference) • [Configuration](#configuration) • [Testing](#testing)

</div>

A batteries-included Express 4 + TypeScript API: JWT authentication, three roles (`admin`, `customer`, `manufacturer`), JSON:API request/response and error envelopes, and a SQLite persistence layer via Drizzle ORM with versioned migrations. Rate limiting, Helmet, CORS, and compression are wired up out of the box, and every screen you'd expect in production — health check, Swagger UI, 404/error handling — is already mounted.

## Features

- JWT authentication with bcrypt password hashing, plus `GET /api/auth/profile`
- Role-based access control enforced per route (`admin`, `customer`, `manufacturer`)
- JSON:API-compliant envelopes for resources and errors
- SQLite via Drizzle ORM with generated, versioned migrations
- Swagger UI at `/api/docs` (shared schemas wired up, ready for `@openapi` annotations)
- Health check with database ping at `/health`
- Rate limiting, Helmet security headers, CORS, and compression
- Jest + Supertest suite (5 suites, 39 tests) with coverage reporting
- Docker and GitHub Actions pipeline

## Getting Started

**Prerequisites:** [Node.js](https://nodejs.org) 20 or later, and [Bun](https://bun.sh) 1.4+ for installs (a `bun.lock` is committed — plain `npm install` also works, but don't commit the resulting `package-lock.json`).

1. Install dependencies:

   ```bash
   bun install
   ```

   All `bun run x` / `npm run x` scripts below are interchangeable.

2. Create a `.env` file in the project root (copy [`.env.example`](.env.example)):

   ```env
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=change-me
   JWT_EXPIRES_IN=24h
   DATABASE_URL=file:./database.db
   CORS_ORIGIN=*
   ```

3. Create the database schema:

   ```bash
   npm run db:push
   ```

4. Start the development server (hot reload via nodemon):

   ```bash
   npm run dev
   ```

The API is now available at `http://localhost:3000`.

5. Log in with the seeded admin and use the token:

   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/vnd.api+json" \
     -d '{
       "data": {
         "type": "users",
         "attributes": { "email": "admin@example.com", "password": "admin123" }
       }
     }'
   ```

   ```json
   {
     "data": {
       "type": "users",
       "id": "3f1c…",
       "attributes": {
         "email": "admin@example.com",
         "role": "admin",
         "token": "eyJhbGciOiJIUzI1NiIs…"
       }
     }
   }
   ```

> [!IMPORTANT]
> On first start the server seeds a default admin account (`admin@example.com`) using `ADMIN_PASSWORD` (falls back to `admin123`). Set `JWT_SECRET` and `ADMIN_PASSWORD` before deploying — the defaults are not safe for production.

> [!NOTE]
> Request bodies must be sent with `Content-Type: application/vnd.api+json` — the JSON parser only accepts that media type. The login example above already does this.

## Scripts

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Start the server with hot reload                   |
| `npm start`             | Start the server via `ts-node`                     |
| `npm run build`         | Compile TypeScript to `dist/`                      |
| `npm run start:dist`    | Run the compiled build                             |
| `npm test`              | Run tests with coverage (writes `jest_output.json`)|
| `npm run typecheck`     | Type-check `src/` and `test/` without emitting     |
| `npm run lint`          | Lint and auto-fix `src/` and `test/`               |
| `npm run db:generate`   | Generate a migration from schema changes           |
| `npm run db:push`       | Push the schema directly to the database           |
| `npm run db:migrate`    | Apply pending migrations                           |
| `npm run db:studio`     | Browse the database in Drizzle Studio              |

## Project Structure

```
src/
├── config/          # App and database configuration
├── controllers/     # Request handlers
├── db/              # Drizzle schema and initialization/seed logic
├── middlewares/     # auth, rate limit, error handler
├── routes/          # Express routers
├── types/           # Shared TypeScript types
└── utils/           # Auth helpers, JSON:API formatters
```

See [Project_structure.md](Project_structure.md) for the full architecture and data-flow description.

## API Reference

All business routes are prefixed with `/api`. Protected routes require a bearer token:

```
Authorization: Bearer <token>
```

Request bodies use the JSON:API envelope (`data.type` + `data.attributes`), and list endpoints support `?page=`, `?page_size=`, `?status=`, and `?sort=-createdAt`.

### Authentication

| Method | Endpoint             | Access | Description                        |
| ------ | -------------------- | ------ | ---------------------------------- |
| POST   | `/api/auth/register` | Public | Register a **customer** account    |
| POST   | `/api/auth/login`    | Public | Log in and obtain a JWT            |
| GET    | `/api/auth/profile`  | Any role | Return the current user's profile |

Only customers can self-register; manufacturer and admin accounts are created by an administrator.

### Users

| Method | Endpoint         | Access                     |
| ------ | ---------------- | -------------------------- |
| GET    | `/api/users`     | Admin only                 |
| GET    | `/api/users/:id` | Admin or the user themself |
| PUT    | `/api/users/:id` | Admin or the user themself |
| DELETE | `/api/users/:id` | Admin only                 |

### Quote Requests

| Method | Endpoint                  | Access                   |
| ------ | ------------------------- | ------------------------ |
| POST   | `/api/quote-requests`     | Customers only           |
| GET    | `/api/quote-requests`     | Own records (admin: all) |
| GET    | `/api/quote-requests/:id` | Own record (admin: all)  |
| PUT    | `/api/quote-requests/:id` | Owner (admin: all)       |
| DELETE | `/api/quote-requests/:id` | Owner (admin: all)       |

Creating a quote request notifies all active manufacturers.

### Quotes

| Method | Endpoint          | Access                                                 |
| ------ | ----------------- | ------------------------------------------------------ |
| POST   | `/api/quotes`     | Manufacturers only (one per open request)              |
| GET    | `/api/quotes`     | Scoped to your requests / your quotes (admin: all)     |
| PUT    | `/api/quotes/:id` | Manufacturer edits own quote; customer accepts/rejects |
| DELETE | `/api/quotes/:id` | Own quote while still pending                          |

### Contracts

| Method | Endpoint          | Access                                                    |
| ------ | ----------------- | --------------------------------------------------------- |
| POST   | `/api/contracts`  | Manufacturers only, for accepted quotes                   |
| GET    | `/api/contracts`  | Scoped to your records (admin: all)                       |
| PUT    | `/api/contracts/:id` | Manufacturer updates documents; customer signs; admin sets status |
| DELETE | `/api/contracts/:id` | Own pending contract                                  |

### Production Status

| Method | Endpoint                    | Access                              |
| ------ | --------------------------- | ----------------------------------- |
| POST   | `/api/production-status`    | Manufacturers only (signed contract)|
| GET    | `/api/production-status`    | Scoped to your records (admin: all) |
| PUT    | `/api/production-status/:id`| Manufacturer, own records           |
| DELETE | `/api/production-status/:id`| Manufacturer, own records           |

### System

| Method | Endpoint        | Access | Description                                  |
| ------ | --------------- | ------ | -------------------------------------------- |
| GET    | `/health`       | Public | Uptime, timestamp, database check            |
| GET    | `/api/docs`     | Public | Swagger UI                                   |
| GET    | `/api/docs/json`| Public | Raw OpenAPI document (JSON)                  |

> [!NOTE]
> The OpenAPI document is generated by `swagger-jsdoc` and currently ships the shared schemas (error envelope, auth attributes, resources) but no path definitions yet — add `@openapi` JSDoc blocks to your routers to populate it. See [`src/routes/docs.ts`](src/routes/docs.ts).

### Errors

Errors follow the [JSON:API error format](https://jsonapi.org/format/#error-objects); unknown routes return `404` and rate limiting returns `429`:

```json
{
  "errors": [
    {
      "status": "404",
      "title": "Route not found: /api/missing",
      "detail": "Route not found: /api/missing"
    }
  ]
}
```

## Configuration

| Variable                  | Default             | Description                               |
| ------------------------- | ------------------- | ----------------------------------------- |
| `PORT`                    | `3000`              | HTTP port                                 |
| `NODE_ENV`                | `development`       | Environment name                          |
| `JWT_SECRET`              | —                   | Secret used to sign tokens (**required**) |
| `JWT_EXPIRES_IN`          | `24h`               | Token lifetime                            |
| `DATABASE_URL`            | `./database.db`     | SQLite file (a `file:` prefix is stripped)|
| `CORS_ORIGIN`             | `*`                 | Allowed CORS origin                       |
| `RATE_LIMIT_WINDOW_MS`    | `900000`            | Rate-limit window (15 min)                |
| `RATE_LIMIT_MAX_REQUESTS` | `100`               | Requests per window per IP                |
| `ADMIN_EMAIL`             | `admin@example.com` | Seeded admin login                        |
| `ADMIN_PASSWORD`          | `admin123`          | Seeded admin password                     |

## Testing

```bash
npm test           # full suite with coverage
npm run typecheck  # type-check src/ and test/ without emitting
```

Coverage reports are written to `coverage/`, and a machine-readable summary to `jest_output.json` (both gitignored).

> [!TIP]
> The Jest config pins `maxWorkers: 1` because all suites share a single SQLite file — keep that in mind if you add integration tests that seed data.

## Database

The schema lives in `src/db/schema.ts`; migrations are generated into `drizzle/`:

```bash
npm run db:generate  # diff schema changes into a new migration
npm run db:migrate   # apply migrations
npm run db:push      # push schema without a migration file (dev shortcut)
npm run db:studio    # visual database browser
```

## Docker

```bash
docker compose up --build
```

The `docker-compose.override.yml` mounts your working tree and runs `npm run dev` for local container development; data persists in the `sqlite-data` volume.

## Deployment

- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment guide (Docker, GitHub Actions, SSH deploy)
- [server_setup.md](server_setup.md) — server provisioning guide
