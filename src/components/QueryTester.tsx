import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apolloClient } from '@/graphql/client';
import { gql } from 'graphql-tag';
import { 
  Play, 
  Copy, 
  Check, 
  Clock, 
  Database, 
  Zap 
} from 'lucide-react';

const EXAMPLE_QUERIES: Record<string, string> = {
  simple: `query GetUnit {
  unit(id: "UNT-0001") {
    id
    name
    status
  }
}`,
  nested: `query GetUnitWithRelations {
  unit(id: "UNT-0001") {
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
}`,
  dashboard: `query GetDashboard {
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
}`,
  pagination: `query GetUnitsPaginated {
  units(first: 5) {
    edges {
      node {
        id
        name
        status
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
      totalCount
    }
  }
}`,
};

export const QueryTester = () => {
  const [query, setQuery] = useState(EXAMPLE_QUERIES.simple);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [metrics, setMetrics] = useState<{ duration: number; payloadSize: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    setError('');
    setResult('');
    setMetrics(null);

    const startTime = performance.now();

    try {
      const response = await apolloClient.query({
        query: gql(query),
      });

      const endTime = performance.now();
      const payloadSize = JSON.stringify(response.data).length;

      setResult(JSON.stringify(response.data, null, 2));
      setMetrics({
        duration: endTime - startTime,
        payloadSize,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadExample = (key: string) => {
    setQuery(EXAMPLE_QUERIES[key]);
    setResult('');
    setError('');
    setMetrics(null);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Testeur de Requêtes GraphQL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="simple" onClick={() => loadExample('simple')}>
              Simple
            </TabsTrigger>
            <TabsTrigger value="nested" onClick={() => loadExample('nested')}>
              Imbriquée
            </TabsTrigger>
            <TabsTrigger value="dashboard" onClick={() => loadExample('dashboard')}>
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="pagination" onClick={() => loadExample('pagination')}>
              Pagination
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <textarea
            value={query}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[200px] resize-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Entrez votre requête GraphQL..."
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={executeQuery}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Play className="w-4 h-4" />
            )}
            Exécuter
          </Button>

          {metrics && (
            <div className="flex items-center gap-4 ml-4">
              <Badge variant="secondary" className="gap-1">
                <Clock className="w-3 h-3" />
                {metrics.duration.toFixed(1)}ms
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Database className="w-3 h-3" />
                {(metrics.payloadSize / 1024).toFixed(2)}KB
              </Badge>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm font-mono">{error}</p>
          </div>
        )}

        {result && (
          <div className="relative">
            <div className="absolute top-2 right-2 text-xs text-muted-foreground">
              Résultat
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[300px] text-sm font-mono">
              {result}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
