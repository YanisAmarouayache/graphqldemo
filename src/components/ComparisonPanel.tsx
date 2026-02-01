import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apolloClient } from '@/graphql/client';
import { gql } from 'graphql-tag';
import { Play, Zap, Database, Activity } from 'lucide-react';

type ComparisonKey = 'simple' | 'dashboard' | 'nplus1';

type ComparisonSpec = {
  name: string;
  graphqlQuery: string;
  restEndpoints: string[];
};

interface ComparisonResult {
  graphql: { duration: number; payloadSize: number; requestCount: number };
  rest: { duration: number; payloadSize: number; requestCount: number };
}

const COMPARISONS: Record<ComparisonKey, ComparisonSpec> = {
  simple: {
    name: 'Récupération Simple',
    graphqlQuery: `query GetUnit {
  unit(id: "UNT-0001") {
    id
    name
    status
    location { coordinates }
    soldiers { id name rank }
    equipment { id name type }
  }
}`,
    restEndpoints: ['/api/units/UNT-0001', '/api/units/UNT-0001/soldiers', '/api/units/UNT-0001/equipment'],
  },
  dashboard: {
    name: 'Dashboard Complet',
    graphqlQuery: `query GetDashboardFull {
  dashboardStats {
    totalUnits
    activeUnits
    totalSoldiers
    activeMissions
    equipmentStatus { operational maintenance deployed }
  }
  units(first: 5) {
    edges {
      node {
        id
        name
        status
        soldiers { id name }
      }
    }
  }
  missions(status: IN_PROGRESS) {
    id
    name
    units { id name }
  }
}`,
    restEndpoints: [
      '/api/dashboard/stats',
      '/api/units?limit=5',
      '/api/units/UNT-0001/soldiers',
      '/api/units/UNT-0002/soldiers',
      '/api/units/UNT-0003/soldiers',
      '/api/missions?status=IN_PROGRESS',
    ],
  },
  nplus1: {
    name: 'Problème N+1',
    graphqlQuery: `query GetUnitsWithRelations {
  units(first: 5) {
    edges {
      node {
        id
        name
        status
        soldiers {
          id
          name
          rank
          equipment { id name type }
        }
        equipment { id name type }
      }
    }
  }
}`,
    restEndpoints: [
      '/api/units?limit=5',
      '/api/units/UNT-0001/soldiers',
      '/api/units/UNT-0001/equipment',
      '/api/units/UNT-0002/soldiers',
      '/api/units/UNT-0002/equipment',
      '/api/units/UNT-0003/soldiers',
      '/api/units/UNT-0003/equipment',
      '/api/units/UNT-0004/soldiers',
      '/api/units/UNT-0004/equipment',
      '/api/units/UNT-0005/soldiers',
      '/api/units/UNT-0005/equipment',
    ],
  },
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const formatMs = (ms: number): string => {
  if (!Number.isFinite(ms)) return '-';
  return `${ms.toFixed(1)}ms`;
};

// Positive => GraphQL better (smaller/faster), negative => REST better
const percentDiff = (graphql: number, rest: number): number => {
  if (rest === 0 || !Number.isFinite(graphql) || !Number.isFinite(rest)) return 0;
  return Math.round(((rest - graphql) / rest) * 100);
};

const speedRatioLabel = (graphqlMs: number, restMs: number) => {
  if (graphqlMs <= 0 || restMs <= 0) return { label: '-', winner: null as 'graphql' | 'rest' | null };

  const ratio = restMs / graphqlMs;
  if (ratio >= 1) return { label: `GraphQL est ${ratio.toFixed(1)}x plus rapide`, winner: 'graphql' as const };
  return { label: `REST est ${(1 / ratio).toFixed(1)}x plus rapide`, winner: 'rest' as const };
};


const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Erreur inconnue';
};

export const ComparisonPanel = () => {
  const [activeTab, setActiveTab] = useState<ComparisonKey>('simple');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [runs, setRuns] = useState<number>(5); // tweak for stability (5–20)

  const comparison = useMemo(() => COMPARISONS[activeTab], [activeTab]);

  const runComparison = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const gqlDurations: number[] = [];
      const restDurations: number[] = [];
      let gqlPayloadSize = 0;
      let restPayloadSize = 0;

      for (let i = 0; i < runs; i++) {
        // GraphQL
        const gqlStart = performance.now();
        const gqlResponse = await apolloClient.query({
          query: gql(comparison.graphqlQuery),
        });
        const gqlEnd = performance.now();
        gqlDurations.push(gqlEnd - gqlStart);
        gqlPayloadSize = JSON.stringify(gqlResponse.data).length;

        // REST (sequential)
        const restStart = performance.now();
        let restPayload = 0;

        for (const endpoint of comparison.restEndpoints) {
          const response = await fetch(`http://localhost:4000${endpoint}`);
          if (!response.ok) throw new Error(`REST ${response.status} sur ${endpoint}`);
          const data: unknown = await response.json();
          restPayload += JSON.stringify(data).length;
        }

        const restEnd = performance.now();
        restDurations.push(restEnd - restStart);
        restPayloadSize = restPayload;
      }

      // Report average duration + last payload sizes (payload should be stable)
      setResult({
        graphql: {
          duration: mean(gqlDurations),
          payloadSize: gqlPayloadSize,
          requestCount: 1,
        },
        rest: {
          duration: mean(restDurations),
          payloadSize: restPayloadSize,
          requestCount: comparison.restEndpoints.length,
        },
      });

      // Optional: you can also console.log p95 for debugging
      // console.log({ gqlP95: p95(gqlDurations), restP95: p95(restDurations) });
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const speed = result ? speedRatioLabel(result.graphql.duration, result.rest.duration) : null;
  const timeDiff = result ? percentDiff(result.graphql.duration, result.rest.duration) : 0;
  const payloadDiff = result ? percentDiff(result.graphql.payloadSize, result.rest.payloadSize) : 0;
  const restAvgMs = result ? result.rest.duration / Math.max(1, result.rest.requestCount) : 0;

  // Progress: just a visual indicator (not scientific)
  const progressValue = result
    ? Math.max(0, Math.min(100, (result.rest.duration / Math.max(result.graphql.duration, 1e-6)) * 50))
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Comparaison GraphQL vs REST
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComparisonKey)}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="nplus1">N+1 Problem</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="p-3 bg-muted/50 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{comparison.name}</p>
            {speed?.winner && (
              <Badge
                variant="secondary"
                className={speed.winner === 'graphql' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}
              >
                Gagnant: {speed.winner === 'graphql' ? 'GraphQL' : 'REST'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Runs: {runs} | GraphQL: 1 requête | REST: {comparison.restEndpoints.length} requêtes (séquentielles)
          </p>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground">Runs</span>
            <Button variant="secondary" className="h-7 px-2" onClick={() => setRuns(3)} disabled={loading}>
              3
            </Button>
            <Button variant="secondary" className="h-7 px-2" onClick={() => setRuns(5)} disabled={loading}>
              5
            </Button>
            <Button variant="secondary" className="h-7 px-2" onClick={() => setRuns(10)} disabled={loading}>
              10
            </Button>
          </div>
        </div>

        <Button onClick={runComparison} disabled={loading} className="w-full gap-2">
          {loading ? <span className="animate-spin">⟳</span> : <Play className="w-4 h-4" />}
          Lancer la comparaison
        </Button>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-sm">{speed?.label}</div>
              <div className="text-xs text-muted-foreground mt-1">REST moyen par requête: {formatMs(restAvgMs)}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">GraphQL</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temps (moy)</span>
                    <span>{formatMs(result.graphql.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payload</span>
                    <span>{formatBytes(result.graphql.payloadSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requêtes</span>
                    <span>{result.graphql.requestCount}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">REST</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temps (moy)</span>
                    <span>{formatMs(result.rest.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payload</span>
                    <span>{formatBytes(result.rest.payloadSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requêtes</span>
                    <span>{result.rest.requestCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 rounded-lg border bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Diff temps (vs REST)</div>
                <Badge variant="secondary" className={timeDiff >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}>
                  {timeDiff >= 0 ? `-${timeDiff}%` : `+${Math.abs(timeDiff)}%`}
                </Badge>
              </div>
              <div className="text-center p-3 rounded-lg border bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Diff payload (vs REST)</div>
                <Badge variant="secondary" className={payloadDiff >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}>
                  {payloadDiff >= 0 ? `-${payloadDiff}%` : `+${Math.abs(payloadDiff)}%`}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avantage relatif</span>
                <span className={speed?.winner === 'graphql' ? 'text-blue-300' : 'text-red-300'}>
                  {speed?.winner === 'graphql' ? 'GraphQL devant' : 'REST devant'}
                </span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
