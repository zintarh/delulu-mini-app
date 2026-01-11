# Database Setup

## Prerequisites

- PostgreSQL 14+ installed and running
- Node.js 18+

## Quick Start

1. **Create a PostgreSQL database:**

```bash
createdb delulu
```

2. **Set up environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your `DATABASE_URL`:

```
DATABASE_URL="postgresql://username:password@localhost:5432/delulu?schema=public"
```

3. **Install dependencies:**

```bash
pnpm install
```

4. **Generate Prisma client:**

```bash
pnpm db:generate
```

5. **Push schema to database:**

```bash
pnpm db:push
```

6. **Optional: Seed the database:**

```bash
pnpm db:seed
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database (dev) |
| `pnpm db:migrate` | Create and apply migrations |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:seed` | Seed database with test data |

## Schema Overview

### User
- Stores wallet addresses and Farcaster user info
- Links to delulus, stakes, and claims

### Delulu
- Stores prediction/delulu data
- Caches aggregated stake totals for performance
- Supports gatekeeper (region restriction) config

### Stake
- Records user bets (believe/doubt)
- Links to user and delulu

### Claim
- Records reward claims
- Links to user and delulu

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/users` | Get/create users |
| GET/POST | `/api/delulus` | List/create delulus |
| GET/PATCH | `/api/delulus/[id]` | Get/update delulu |
| GET/POST | `/api/stakes` | Get stakes/create stake |
| GET/POST | `/api/claims` | Get claims/create claim |
| GET | `/api/stats?address=` | Get user stats |
