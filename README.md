# GraphQL Demo with PostgreSQL

This is a GraphQL demo application that showcases the performance benefits of GraphQL over traditional REST APIs, now with a real PostgreSQL database backend.

## Features

- **GraphQL API** with Apollo Server
- **WebSocket Subscriptions** for real-time updates
- **REST API** for comparison
- **PostgreSQL Database** for persistent storage
- **DataLoader** for efficient batching and deduplication
- **Military Management Domain** with Units, Soldiers, Equipment, Missions, and Tactical Events

## Quick Start

### 1. Start PostgreSQL

Using Docker Compose (recommended):

```bash
# Start PostgreSQL
docker-compose up -d

# Wait for the database to be ready, then seed it
npm install
npm run db:seed
```

Or use your own PostgreSQL instance and run the schema:

```bash
psql -U postgres -d graphqldemo -f server/database/schema.sql
npm run db:seed
```

### 2. Configure Environment

Copy the example environment file and adjust as needed:

```bash
cp .env.example .env
```

### 3. Start the Server

```bash
npm run server
```

The server will start on http://localhost:4000

### 4. Access the APIs

- **GraphQL Playground**: http://localhost:4000/graphql
- **GraphQL WebSocket**: ws://localhost:4000/subscriptions
- **REST API**: http://localhost:4000/api
- **Health Check**: http://localhost:4000/health

## API Endpoints

### GraphQL Queries

```graphql
# Get all units with pagination
query {
  units(first: 10) {
    edges {
      node {
        id
        name
        status
        location {
          coordinates
        }
        soldiers {
          id
          name
          rank
        }
        equipment {
          id
          name
          type
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
      totalCount
    }
  }
}

# Get dashboard stats
query {
  dashboardStats {
    totalUnits
    activeUnits
    totalSoldiers
    activeMissions
    recentEvents
    equipmentStatus {
      operational
      maintenance
      deployed
    }
  }
}
```

### REST Endpoints

- `GET /api/units` - List all units
- `GET /api/units/:id` - Get unit by ID
- `GET /api/units/:id/soldiers` - Get soldiers in a unit
- `GET /api/units/:id/equipment` - Get equipment in a unit
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/missions` - List all missions
- `GET /api/missions/:id` - Get mission by ID
- `GET /api/soldiers` - List all soldiers
- `GET /api/equipment` - List all equipment
- `GET /api/tactical-events` - List all tactical events
- `POST /api/demo/fire-alert` - Trigger a tactical event

## Database Schema

The database includes the following tables:

- **units** - Military units with location and status
- **soldiers** - Soldiers assigned to units
- **equipment** - Equipment assigned to soldiers
- **missions** - Missions with assigned units
- **tactical_events** - Tactical events with involved units

## Performance Comparison

The demo is designed to showcase GraphQL's performance advantages:

1. **N+1 Problem**: Disable DataLoader (`USE_DATALOADER=false`) to see the N+1 query problem in action
2. **Over-fetching**: Compare REST (fixed response structure) vs GraphQL (request only what you need)
3. **Batching**: DataLoader batches multiple requests into single database queries

### Example Performance Test

```bash
# Test REST endpoint (may require multiple requests)
curl http://localhost:4000/api/units/UNT-0001

# Test GraphQL (single request, nested data)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { unit(id: \"UNT-0001\") { id name soldiers { id name equipment { id name } } } }"}'
```

## Scripts

- `npm run server` - Start the GraphQL/REST server
- `npm run db:seed` - Seed the database with sample data
- `npm run db:setup` - Start PostgreSQL and seed (Docker)
- `npm run db:reset` - Reset PostgreSQL and re-seed (Docker)
- `npm run dev` - Start the Vite development server (frontend)
- `npm run start` - Start both server and frontend

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | graphqldemo | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `PORT` | 4000 | Server port |
| `USE_DATALOADER` | true | Enable DataLoader batching |
| `REST_LATENCY_MS` | 80 | Simulated REST latency |
| `DEMO_SPAM` | false | Auto-publish subscription events |

## Project Structure

```
server/
├── index.js           # Main server entry
├── schema.js          # GraphQL schema definitions
├── resolvers.js       # GraphQL resolvers
├── db.js              # Database connection
├── enums.js           # Enum definitions
├── repositories/      # Data access layer
│   ├── unitRepository.js
│   ├── soldierRepository.js
│   ├── equipmentRepository.js
│   ├── missionRepository.js
│   └── tacticalEventRepository.js
└── database/
    ├── schema.sql     # PostgreSQL schema
    └── seed.js        # Database seeding script
```

## License

MIT
