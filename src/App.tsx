import { ApolloProvider } from "@/components/ApolloProvider";
import { ServerStatus } from "@/components/ServerStatus";
import { PlaygroundLink } from "@/components/PlaygroundLink";
import { Dashboard } from "@/components/Dashboard";
import { UnitList } from "@/components/UnitList";
import { QueryTester } from "@/components/QueryTester";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Activity,
  Code2,
  BarChart3,
  Server,
  Zap,
  Database,
} from "lucide-react";
import "./App.css";
import { SubscriptionsPage } from "./components/SubscriptionPage";

function App() {
  return (
    <ApolloProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">
                    GraphQL Military Command
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Démonstration GraphQL vs REST pour systèmes de commandement
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ServerStatus />
                <PlaygroundLink />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-lg">
              <TabsTrigger value="dashboard" className="gap-2">
                <Activity className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="explorer" className="gap-2">
                <Database className="w-4 h-4" />
                Explorer
              </TabsTrigger>
              <TabsTrigger value="queries" className="gap-2">
                <Code2 className="w-4 h-4" />
                Requêtes
              </TabsTrigger>
              <TabsTrigger value="compare" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Comparer
              </TabsTrigger>
              <TabsTrigger value="subs" className="gap-2">
                <Zap className="w-4 h-4" />
                Subscriptions
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <Dashboard />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UnitList />
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Avantages GraphQL
                      </h3>
                      <div className="space-y-2">
                        {[
                          {
                            label: "Single Endpoint",
                            desc: "Toutes les requêtes via /graphql",
                          },
                          {
                            label: "Typage fort",
                            desc: "Validation compile-time du schéma",
                          },
                          {
                            label: "Introspection",
                            desc: "Documentation auto-générée",
                          },
                          {
                            label: "Relations imbriquées",
                            desc: "Résout le problème N+1",
                          },
                          {
                            label: "Sélection précise",
                            desc: "Demande exactement ce dont vous avez besoin",
                          },
                          {
                            label: "Subscriptions",
                            desc: "Temps réel via WebSocket",
                          },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-blue-400 font-medium">
                                {i + 1}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {item.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Explorer Tab */}
            <TabsContent value="explorer" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UnitList />
                <div className="space-y-6">
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Informations Serveur
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Endpoint GraphQL:
                          </span>
                          <code className="bg-muted px-2 py-0.5 rounded">
                            http://localhost:4000/graphql
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Introspection:
                          </span>
                          <Badge variant="default" className="bg-green-500">
                            Activée
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Playground:
                          </span>
                          <Badge variant="default" className="bg-blue-500">
                            Disponible
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            REST API:
                          </span>
                          <code className="bg-muted px-2 py-0.5 rounded">
                            http://localhost:4000/api
                          </code>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Queries Tab */}
            <TabsContent value="queries">
              <QueryTester />
            </TabsContent>

            {/* Compare Tab */}
            <TabsContent value="compare">
              <ComparisonPanel />
            </TabsContent>

            <TabsContent value="subs" className="space-y-6">
              <SubscriptionsPage />
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="border-t bg-card mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                <span>GraphQL Military Demo</span>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline">Apollo Server</Badge>
                <Badge variant="outline">React + TypeScript</Badge>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ApolloProvider>
  );
}

export default App;
