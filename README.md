# Express API Starter with TypeScript

A REST API built with Express.js and TypeScript, following the [JSON:API](https://jsonapi.org/) specification. It ships with JWT authentication, role-based access control, and a SQLite persistence layer via Drizzle ORM — demonstrated through a manufacturing workflow: quote requests → quotes → contracts → production status.

## Features

- JWT authentication with bcrypt password hashing
- Role-based access control: `admin`, `customer`, `manufacturer`
- JSON:API-compliant request/response and error envelopes
- SQLite database with Drizzle ORM and versioned migrations
- Rate limiting, Helmet security headers, CORS, and compression
- Health check endpoint with database ping
- Test suite with Jest and Supertest
- Docker and GitHub Actions CI/CD pipeline

## Prerequisites

- Node.js 20 or later
- npm (or [Bun](https://bun.sh) — a `bun.lock` is included)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root (see [`.env.example`](.env.example)):

   ```env
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=change-me
   JWT_EXPIRES_IN=24h
   DATABASE_URL=./database.db
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

> [!IMPORTANT]
> On first start the server seeds a default admin account (`admin@example.com`) using `ADMIN_PASSWORD` (falls back to `admin123`). Set `JWT_SECRET` and `ADMIN_PASSWORD` before deploying — the defaults are not safe for production.

## Scripts

| Command                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Start the server with hot reload                         |
| `npm start`             | Start the server via `ts-node`                           |
| `npm run build`         | Compile TypeScript to `dist/`                            |
| `npm run start:dist`    | Run the compiled build                                   |
| `npm test`              | Run tests with coverage (writes `jest_output.json`)      |
| `npm run typecheck`     | Type-check without emitting                             |
| `npm run lint`          | Lint and auto-fix `src/` and `test/`                     |
| `npm run db:generate`   | Generate migrations from schema changes                  |
| `npm run db:push`       | Push the schema directly to the database                 |
| `npm run db:migrate`    | Apply pending migrations                                 |
| `npm run db:studio`     | Browse the database in Drizzle Studio                    |

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

All routes are prefixed with `/api`. Protected routes require a bearer token:

```
Authorization: Bearer <token>
```

Request bodies use the JSON:API envelope (`data.type` + `data.attributes`).

### Authentication (public)

| Method | Endpoint                | Description                          |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/api/auth/register`    | Register a **customer** account      |
| POST   | `/api/auth/login`       | Log in and obtain a JWT              |

Only customers can self-register; manufacturer and admin accounts are created by an administrator.

### Users

| Method | Endpoint         | Access                       |
| ------ | ---------------- | ---------------------------- |
| GET    | `/api/users`     | Admin only                   |
| GET    | `/api/users/:id` | Admin or the user themself   |
| PUT    | `/api/users/:id` | Admin or the user themself   |
| DELETE | `/api/users/:id` | Admin only                   |

### Quote Requests

| Method | Endpoint                 | Access                    |
| ------ | ------------------------ | ------------------------- |
| POST   | `/api/quote-requests`    | Customers only            |
| GET    | `/api/quote-requests`    | Own records (admin: all)  |
| GET    | `/api/quote-requests/:id`| Own record (admin: all)   |
| PUT    | `/api/quote-requests/:id`| Owner (admin: all)        |
| DELETE | `/api/quote-requests/:id`| Owner (admin: all)        |

Creating a quote request notifies all active manufacturers.

### Quotes

| Method | Endpoint     | Access                                                     |
| ------ | ------------ | ---------------------------------------------------------- |
| POST   | `/api/quotes`| Manufacturers only (one per open request)                  |
| GET    | `/api/quotes`| Scoped to your requests / your quotes (admin: all)         |
| PUT    | `/api/quotes/:id` | Manufacturer edits own quote; customer accepts/rejects |
| DELETE | `/api/quotes/:id` | Own quote while still pending                          |

### Contracts

| Method | Endpoint          | Access                                              |
| ------ | ----------------- | --------------------------------------------------- |
| POST   | `/api/contracts`  | Manufacturers only, for accepted quotes             |
| GET    | `/api/contracts`  | Scoped to your records (admin: all)                 |
| PUT    | `/api/contracts/:id` | Manufacturer updates documents; customer signs; admin sets status |
| DELETE | `/api/contracts/:id` | Own pending contract                            |

List endpoint supports `?status=`, `?page=`, `?page_size=`, and `?sort=-createdAt`.

### Production Status

| Method | Endpoint                   | Access                              |
| ------ | -------------------------- | ----------------------------------- |
| POST   | `/api/production-status`   | Manufacturers only (signed contract)|
| GET    | `/api/production-status`   | Scoped to your records (admin: all) |
| PUT    | `/api/production-status/:id` | Manufacturer, own records         |
| DELETE | `/api/production-status/:id` | Manufacturer, own records         |

### System

| Method | Endpoint  | Access | Description                        |
| ------ | --------- | ------ | ---------------------------------- |
| GET    | `/health` | Public | Uptime, timestamp, database check  |

### Example: log in

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "users",
      "attributes": { "email": "customer@example.com", "password": "password123" }
    }
  }'
```

Successful responses return a resource under `data`, with the JWT in `data.attributes.token`:

```json
{
  "data": {
    "type": "users",
    "id": "3f1c…",
    "attributes": {
      "email": "customer@example.com",
      "role": "customer",
      "token": "eyJhbGciOiJIUzI1NiIs…"
    }
  }
}
```

### Errors

Errors follow the JSON:API error format; rate limiting returns `429`:

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

| Variable            | Default             | Description                              |
| ------------------- | ------------------- | ---------------------------------------- |
| `PORT`              | `3000`              | HTTP port                                |
| `NODE_ENV`          | `development`       | Environment name                         |
| `JWT_SECRET`        | —                   | Secret used to sign tokens (**required**)|
| `JWT_EXPIRES_IN`    | `24h`               | Token lifetime                           |
| `DATABASE_URL`      | `./database.db`     | SQLite file (a `file:` prefix is stripped)|
| `CORS_ORIGIN`       | `*`                 | Allowed CORS origin                      |
| `RATE_LIMIT_WINDOW_MS` | `900000`         | Rate-limit window (15 min)               |
| `RATE_LIMIT_MAX_REQUESTS` | `100`          | Requests per window per IP               |
| `ADMIN_EMAIL`       | `admin@example.com` | Seeded admin login                       |
| `ADMIN_PASSWORD`    | `admin123`          | Seeded admin password                    |

## Testing

```bash
npm test           # full suite with coverage
npm run typecheck  # type-check src/ and test/ without emitting
```

Coverage reports are written to `coverage/`, and a machine-readable summary to `jest_output.json` (both gitignored).

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
- [CHANGELOG.md](CHANGELOG.md) — release history
