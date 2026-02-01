# GraphQL Military Command Demo

Application complète de démonstration GraphQL vs REST pour les systèmes de commandement militaire.

## Architecture

```
graphql-military-demo/
├── server/          # Backend Apollo Server (Node.js)
│   ├── index.js     # Point d'entrée du serveur
│   ├── schema.js    # Schéma GraphQL
│   ├── resolvers.js # Resolvers
│   ├── data.js      # Données mockées
│   └── enums.js     # Énumérations
├── src/             # Frontend React (Vite + TypeScript)
│   ├── components/  # Composants React
│   ├── hooks/       # Hooks personnalisés
│   ├── graphql/     # Configuration Apollo Client
│   └── ...
└── dist/            # Build de production
```

## Fonctionnalités

### Backend (Apollo Server)
- ✅ **Introspection activée** - Explorez le schéma via GraphQL Playground
- ✅ **GraphQL Playground** - Interface interactive à `http://localhost:4000/graphql`
- ✅ **REST API** - Endpoints REST pour comparaison
- ✅ **Subscriptions** - Temps réel via WebSocket
- ✅ **Pagination** - Cursor-based pagination
- ✅ **Filtres** - Recherche et filtrage dynamique

### Frontend (React + Apollo Client)
- ✅ **Dashboard** - Statistiques en temps réel
- ✅ **Explorateur d'unités** - Liste avec pagination
- ✅ **Testeur de requêtes** - Exécuter des requêtes GraphQL
- ✅ **Comparaison GraphQL vs REST** - Métriques de performance
- ✅ **Playground Link** - Accès direct au GraphQL Playground

## Démarrage

### 1. Démarrer le backend

```bash
npm run server
```

Le serveur démarre sur `http://localhost:4000`
- GraphQL Endpoint: `http://localhost:4000/graphql`
- Health Check: `http://localhost:4000/health`
- REST API: `http://localhost:4000/api`

### 2. Démarrer le frontend (dans un autre terminal)

```bash
npm run dev
```

Le frontend démarre sur `http://localhost:5173`

### 3. Ou démarrer les deux ensemble

```bash
npm start
```

## Données

- 50 unités militaires
- 500 soldats
- 100 équipements
- 20 missions
- 30 événements tactiques

## Exemples de requêtes GraphQL

### Récupérer une unité avec relations
```graphql
query GetUnit {
  unit(id: "UNT-0001") {
    id
    name
    status
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
```

### Dashboard stats
```graphql
query GetDashboard {
  dashboardStats {
    totalUnits
    activeUnits
    totalSoldiers
    equipmentStatus {
      operational
      maintenance
      deployed
    }
  }
}
```

### Pagination
```graphql
query GetUnits {
  units(first: 5) {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

## Introspection

L'introspection est activée. Vous pouvez explorer le schéma complet via le Playground ou avec cette requête:

```graphql
{
  __schema {
    types {
      name
      kind
    }
    queryType {
      name
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

## Comparaison GraphQL vs REST

| Métrique | GraphQL | REST | Gain |
|----------|---------|------|------|
| Requêtes | 1 | N+1 | -90% |
| Payload | Précis | Sur-fetch | -60% |
| Temps | ~50ms | ~500ms | -90% |

## Technologies

- **Backend**: Apollo Server 5, GraphQL, Node.js
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Client GraphQL**: Apollo Client 4
