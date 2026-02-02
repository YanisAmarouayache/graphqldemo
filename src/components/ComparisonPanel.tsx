import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apolloClient } from "@/graphql/client";
import { gql } from "graphql-tag";
import {
  Play,
  Zap,
  Activity,
  Settings2,
  Loader2,
  Scale,
  Code2,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowRightLeft,
  Timer,
} from "lucide-react";

type ComparisonKey = "simple" | "dashboard" | "nplus1";

interface ComparisonSpec {
  name: string;
  description: string;
  goal: string;
  metricToWatch: string;
  graphqlQuery: string;
  getRestEndpoints: (limit: number) => string[];
}

interface ComparisonResult {
  graphql: {
    duration: number;
    payloadSize: number;
    requestCount: number;
    raw: any;
  };
  rest: {
    duration: number;
    payloadSize: number;
    requestCount: number;
    raw: any;
  };
  payloadSavings: number;
  speedFactor: number;
}

const COMPARISONS: Record<ComparisonKey, ComparisonSpec> = {
  simple: {
    name: "Récupération Simple",
    description:
      "Charge une unité, ses soldats et ses équipements via des endpoints séparés.",
    goal: "Démontrer l'overhead réseau (Handshake) même sur de petits volumes.",
    metricToWatch: "Nombre de requêtes (1 vs 3)",
    graphqlQuery: `query GetUnit {
      unit(id: "UNT-0001") {
        id name status
        location { coordinates }
        soldiers { id name rank }
        equipment { id name type }
      }
    }`,
    getRestEndpoints: () => [
      "/api/units/UNT-0001",
      "/api/units/UNT-0001/soldiers",
      "/api/units/UNT-0001/equipment",
    ],
  },
  dashboard: {
    name: "Dashboard Complet",
    description:
      "Agrégation de données hétérogènes : stats, unités et missions actives.",
    goal: "Démontrer la puissance de l'agrégation côté serveur (Single Pipe).",
    metricToWatch: "Temps de réponse cumulé (Waterfall)",
    graphqlQuery: `query GetDashboardFull($limit: Int!) {
      dashboardStats { totalUnits activeUnits totalSoldiers activeMissions }
      units(first: $limit) { edges { node { id name status } } }
      missions(status: IN_PROGRESS) { id name }
    }`,
    getRestEndpoints: (limit: number) => [
      "/api/dashboard/stats",
      `/api/units?limit=${limit}`,
      "/api/missions?status=IN_PROGRESS",
    ],
  },
  nplus1: {
    name: "Stress Test N+1",
    description:
      "Récupération profonde (unités -> soldats -> équipements) pour une liste entière.",
    goal: "Démontrer la résolution du problème N+1 via les DataLoaders.",
    metricToWatch: "Scalabilité (Linéaire vs Exponentiel)",
    graphqlQuery: `query GetDeepRelations($limit: Int!) {
      units(first: $limit) {
        edges {
          node {
            id name
            soldiers { id name equipment { id name } }
            equipment { id name type }
          }
        }
      }
    }`,
    getRestEndpoints: (limit: number) => [
      `/api/units?limit=${limit}`,
      ...Array.from({ length: limit }, (_, i) => [
        `/api/units/UNT-000${i + 1}/soldiers`,
        `/api/units/UNT-000${i + 1}/equipment`,
      ]).flat(),
    ],
  },
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + ["B", "KB", "MB"][i];
};

export const ComparisonPanel = () => {
  const [activeTab, setActiveTab] = useState<ComparisonKey>("simple");
  const [unitLimit, setUnitLimit] = useState<number>(10);
  const [runs, setRuns] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const comparison = COMPARISONS[activeTab];

  const runComparison = async () => {
    setLoading(true);
    setResult(null);
    try {
      let gqlDurations: number[] = [],
        restDurations: number[] = [];
      let lastGqlRaw,
        lastRestRaw,
        gqlSize = 0,
        restSize = 0;

      for (let i = 0; i < runs; i++) {
        const gStart = performance.now();
        const gRes = await apolloClient.query({
          query: gql(comparison.graphqlQuery),
          variables: { limit: unitLimit },
          fetchPolicy: "network-only",
        });
        gqlDurations.push(performance.now() - gStart);
        lastGqlRaw = gRes.data;
        gqlSize = JSON.stringify(gRes.data).length;

        const endpoints = comparison.getRestEndpoints(unitLimit);
        const rStart = performance.now();
        let rPayload = [];
        for (const url of endpoints) {
          const res = await fetch(`http://localhost:4000${url}`);
          const data = await res.json();
          rPayload.push(data);
        }
        restDurations.push(performance.now() - rStart);
        lastRestRaw = rPayload;
        restSize = JSON.stringify(rPayload).length;
      }

      const avgGql = gqlDurations.reduce((a, b) => a + b) / runs;
      const avgRest = restDurations.reduce((a, b) => a + b) / runs;

      setResult({
        graphql: {
          duration: avgGql,
          payloadSize: gqlSize,
          requestCount: 1,
          raw: lastGqlRaw,
        },
        rest: {
          duration: avgRest,
          payloadSize: restSize,
          requestCount: comparison.getRestEndpoints(unitLimit).length,
          raw: lastRestRaw,
        },
        payloadSavings: Math.round(((restSize - gqlSize) / restSize) * 100),
        speedFactor: Number((avgRest / avgGql).toFixed(1)),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-2xl border-t-4 border-t-primary overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <Activity className="w-6 h-6 text-primary" />
            CENTRE D'ANALYSE TACTIQUE
          </CardTitle>
          <Badge variant="destructive" className="animate-pulse">
            LIVE BENCHMARK
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-10">
        {/* Scénarios */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            <Target className="w-4 h-4 text-primary" /> 1. Objectif de la
            mission
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ComparisonKey)}
          >
            <TabsList className="grid grid-cols-3 w-full h-14 bg-muted/50 p-1">
              <TabsTrigger value="simple" className="font-bold">
                SIMPLE
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="font-bold">
                DASHBOARD
              </TabsTrigger>
              <TabsTrigger value="nplus1" className="font-bold">
                STRESS N+1
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="p-4 bg-primary/5 border-l-4 border-primary rounded-r-lg">
            <h3 className="text-sm font-black uppercase text-primary mb-1">
              {comparison.goal}
            </h3>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {comparison.description}
            </p>
          </div>
        </div>

        {/* Paramètres */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-muted/20 rounded-2xl border">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Charge de données (N)
            </label>
            <Input
              type="number"
              value={unitLimit}
              onChange={(e) => setUnitLimit(Number(e.target.value))}
              className="h-10 text-lg font-mono font-bold"
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-black uppercase">
              Nombre d'itérations
            </label>
            <div className="flex gap-2">
              {[1, 3, 5].map((n) => (
                <Button
                  key={n}
                  variant={runs === n ? "default" : "outline"}
                  className="flex-1 h-10 font-bold"
                  onClick={() => setRuns(n)}
                >
                  {n} Cycles
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={runComparison}
          disabled={loading}
          className="w-full h-16 text-xl font-black shadow-lg hover:shadow-primary/20 transition-all gap-3 uppercase"
        >
          {loading ? (
            <Loader2 className="animate-spin w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 fill-current" />
          )}
          Lancer le Benchmark de Combat
        </Button>

        {result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center space-y-2 border-b-8 border-blue-900">
                <Zap className="w-10 h-10 fill-current text-yellow-300 animate-pulse" />
                <div className="text-5xl font-black italic tracking-tighter">
                  {result.speedFactor}x
                </div>
                <div className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80">
                  Plus Rapide que REST
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center space-y-2 border-b-8 border-emerald-900">
                <Scale className="w-10 h-10 text-white" />
                <div className="text-5xl font-black italic tracking-tighter">
                  {result.payloadSavings}%
                </div>
                <div className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80">
                  De Données Économisées
                </div>
              </div>
            </div>

            {/* VISUALISATION DES ÉCHANGES (ROUND-TRIPS) */}

            <div className="bg-muted/40 p-8 rounded-3xl border-2 border-dashed border-muted-foreground/20">
              <h4 className="text-xs font-black uppercase mb-8 flex items-center gap-2 tracking-widest">
                <ArrowRightLeft className="w-4 h-4 text-primary" /> Analyse des
                Round-Trips (Allers-Retours)
              </h4>
              <div className="space-y-12">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <Badge className="bg-blue-600 px-4 py-1">GRAPHQL</Badge>
                    <span className="text-xs font-black font-mono text-blue-600 tracking-tighter uppercase">
                      1 Seul Voyage Réseau
                    </span>
                  </div>
                  <div className="h-6 w-full bg-muted rounded-full overflow-hidden relative border shadow-inner">
                    <div className="absolute h-full w-8 bg-blue-500 animate-[shimmer_2s_infinite] shadow-[0_0_20px_rgba(59,130,246,1)]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <Badge variant="destructive" className="px-4 py-1">
                      REST API
                    </Badge>
                    <span className="text-xs font-black font-mono text-red-600 tracking-tighter uppercase">
                      {result.rest.requestCount} Voyages Successifs
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-6 w-full">
                    {Array.from({
                      length: Math.min(result.rest.requestCount, 40),
                    }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-red-600 animate-bounce rounded-t-sm rounded-b-sm"
                        style={{
                          animationDelay: `${i * 0.05}s`,
                          animationIterationCount: 1,
                          animationDuration: "0.5s",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* GRID DES MÉTRIQUES TEMPS & POIDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
                  <Timer className="w-4 h-4" /> Efficacité Temporelle
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <MetricLine
                    label="GraphQL"
                    value={`${result.graphql.duration.toFixed(1)}ms`}
                    color="blue"
                  />
                  <MetricLine
                    label="REST (Cumulé)"
                    value={`${result.rest.duration.toFixed(1)}ms`}
                    color="red"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
                  <Scale className="w-4 h-4" /> Volume de Transfert
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <MetricLine
                    label="GraphQL"
                    value={formatBytes(result.graphql.payloadSize)}
                    color="blue"
                  />
                  <MetricLine
                    label="REST"
                    value={formatBytes(result.rest.payloadSize)}
                    color="red"
                  />
                </div>
              </div>
            </div>

            {/* RAW DATA INSPECTOR */}
            <div className="border-2 rounded-2xl overflow-hidden bg-black shadow-2xl">
              <Button
                variant="ghost"
                className="w-full justify-between rounded-none h-14 bg-white/5 hover:bg-white/10 text-white"
                onClick={() => setShowRaw(!showRaw)}
              >
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                  <Code2 className="w-5 h-5 text-yellow-400" /> Inspection des
                  Payloads Bruts (JSON)
                </span>
                {showRaw ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
              {showRaw && (
                <div className="grid grid-cols-2 divide-x divide-white/10 h-80 font-mono text-[10px] overflow-auto">
                  <div className="p-6 text-blue-400">
                    <div className="sticky top-0 bg-black/90 pb-3 mb-3 border-b border-blue-900/50 font-black uppercase text-blue-500">
                      GraphQL (Optimisé)
                    </div>
                    <pre>{JSON.stringify(result.graphql.raw, null, 2)}</pre>
                  </div>
                  <div className="p-6 text-red-400">
                    <div className="sticky top-0 bg-black/90 pb-3 mb-3 border-b border-red-900/50 font-black uppercase text-red-500">
                      REST (Over-fetched)
                    </div>
                    <pre>{JSON.stringify(result.rest.raw, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MetricLine = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "red";
}) => (
  <div
    className={`flex justify-between items-center p-4 rounded-xl border-2 ${
      color === "blue"
        ? "border-blue-500/20 bg-blue-500/5"
        : "border-red-500/20 bg-red-500/5"
    }`}
  >
    <span
      className={`text-[10px] font-black uppercase ${
        color === "blue" ? "text-blue-600" : "text-red-600"
      }`}
    >
      {label}
    </span>
    <span className="text-xl font-mono font-bold tracking-tighter">
      {value}
    </span>
  </div>
);
