# bytebound-server

NestJS API for Bytebound. REST for players, heroes, levels and stats; a
Socket.IO gateway (`/games` namespace) runs the game sessions.

- **Database:** Postgres (Neon in production). The schema lives in
  `src/db/migrations`; `npm run db:setup` applies migrations and seeds the game
  content (heroes, enemies, levels, questions) into empty tables.
- **Auth:** Clerk session tokens, verified against the Clerk instance's JWKS.

## Local development

```bash
npm install
cp .env.example .env   # then fill in JWT_ISSUER
```

You need a Postgres database. Either paste a Neon connection string into
`DATABASE_URL` (and remove `DB_SSL=false`), or run a throwaway local one with
PGlite, which matches the default `.env.example`:

```bash
npx @electric-sql/pglite-socket --db=./.pgdata --port=5433 --extensions=pgcrypto --max-connections=10
```

Then:

```bash
npm run build
npm run db:setup     # migrations + seed
npm run start:dev
```

### Environment

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (or use `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME`) |
| `DB_SSL` | `false` for local databases without TLS; on by default |
| `JWT_ISSUER` | Clerk Frontend API URL, e.g. `https://your-app.clerk.accounts.dev` |
| `CORS_ORIGINS` | Comma-separated frontend origins. Also used to check Clerk's `azp` claim |
| `JWKS_URI`, `JWT_AUDIENCE`, `JWT_ALGORITHMS` | Optional overrides; default to Clerk's (`<issuer>/.well-known/jwks.json`, none, `RS256`) |

### Schema changes

Change the entities, then generate a migration against a database that has
the current schema:

```bash
npm run build
npm run migration:generate -- src/db/migrations/DescribeTheChange
```

## Tests

```bash
npm test
```

## Deployment (Render)

1. On [Render](https://render.com): **New > Blueprint**, pick this repo. It
   reads `render.yaml` (free web service).
2. Fill in the secrets it asks for:
   - `DATABASE_URL`: from Neon (**Connect** > connection string).
   - `JWT_ISSUER`: the Clerk Frontend API URL.
   - `CORS_ORIGINS`: the frontend URL, e.g. `https://bytebound.pages.dev`.
3. Every push to `main` redeploys; each start runs `db:setup` first.

The free instance sleeps after ~15 minutes without traffic; the first request
after that takes up to a minute.
