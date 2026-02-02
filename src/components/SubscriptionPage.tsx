import { useEffect, useState } from "react";
import { apolloClient } from "@/graphql/client";
import { gql } from "graphql-tag";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Server,
  Zap,
  Info,
  RefreshCw,
  Send,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- DÉFINITIONS GRAPHQL ---
const UNIT_SUBS = gql`
  subscription {
    unitLocationUpdated {
      id
      name
      location {
        coordinates
      }
    }
  }
`;
const EVENT_SUBS = gql`
  subscription {
    tacticalEventCreated {
      id
      description
    }
  }
`;
const FIRE_MUT = gql`
  mutation Fire($s: Int!, $d: String!) {
    fireAlert(severity: $s, description: $d) {
      id
    }
  }
`;

// --- INTERFACES POUR LE TYPAGE ---
interface Unit {
  id: string;
  name: string;
  x: number;
  y: number;
}
interface UnitSubData {
  unitLocationUpdated: {
    id: string;
    name: string;
    location: { coordinates: number[] };
  };
}
interface EventSubData {
  tacticalEventCreated: { id: string; description: string };
}

export const SubscriptionsPage = () => {
  const [running, setRunning] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState("Signal détecté - Zone Alpha");
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  const handleIncoming = (data: any, type: "MOVE" | "EVENT") => {
    setLastPayload({ _type: type, ...data });
    setMsgCount((c) => c + 1);

    if (type === "MOVE") {
      const { id, name, location } = data;
      const newUnit = {
        id,
        name,
        x: Math.abs((location.coordinates[0] * 1337) % 80) + 10,
        y: Math.abs((location.coordinates[1] * 1337) % 80) + 10,
      };
      setUnits((prev) => {
        const filtered = prev.filter((u) => u.id !== id);
        return [...filtered, newUnit].slice(-5); // On ne garde que les 5 dernières
      });
    } else {
      setActiveAlert(data.description);
    }
  };

  useEffect(() => {
    if (!running) return;

    // Typage explicite des souscriptions pour corriger l'erreur 'unknown'
    const s1 = apolloClient
      .subscribe<UnitSubData>({ query: UNIT_SUBS })
      .subscribe({
        next: (v) =>
          v.data && handleIncoming(v.data.unitLocationUpdated, "MOVE"),
      });

    const s2 = apolloClient
      .subscribe<EventSubData>({ query: EVENT_SUBS })
      .subscribe({
        next: (v) =>
          v.data && handleIncoming(v.data.tacticalEventCreated, "EVENT"),
      });

    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
    };
  }, [running]);

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b pb-8">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-3 rounded-2xl text-white shadow-xl transition-all duration-500",
                running ? "bg-blue-600 shadow-blue-200" : "bg-slate-200"
              )}
            >
              <RefreshCw className={cn("w-6 h-6", running && "animate-spin")} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">
                GraphQL Subscriptions
              </h1>
              <p className="text-slate-500 text-sm font-medium italic underline decoration-blue-500/30 underline-offset-4">
                Démonstration de l'architecture "Push" Temps-Réel
              </p>
            </div>
          </div>
          <Button
            onClick={() => setRunning(!running)}
            className={cn(
              "h-11 px-8 rounded-xl font-bold uppercase tracking-widest text-xs transition-all",
              running
                ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {running ? "Fermer le WebSocket" : "Ouvrir la Connexion"}
          </Button>
        </header>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 italic">
                  ● Flux de données Réactif
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase border-slate-200 text-slate-400"
                >
                  Pas de polling (Zéro Refresh)
                </Badge>
              </div>
              <div
                className={cn(
                  "relative aspect-video rounded-[2.5rem] border-2 transition-all duration-500 flex items-center justify-center overflow-hidden bg-slate-50",
                  activeAlert
                    ? "border-red-500 bg-red-50/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]"
                    : "border-slate-100"
                )}
              >
                {running ? (
                  <>
                    <div
                      className="absolute inset-0 opacity-5"
                      style={{
                        backgroundImage:
                          "radial-gradient(#000 1px, transparent 1px)",
                        backgroundSize: "30px 30px",
                      }}
                    />
                    {units.map((u) => (
                      <div
                        key={u.id}
                        className="absolute transition-all duration-1000"
                        style={{ left: `${u.x}%`, top: `${u.y}%` }}
                      >
                        <div className="w-3 h-3 bg-blue-600 rounded-full shadow-lg ring-4 ring-blue-100 animate-in fade-in" />
                        <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-white border px-2 py-0.5 rounded shadow-sm whitespace-nowrap uppercase">
                          {u.name}
                        </span>
                      </div>
                    ))}

                    {activeAlert && (
                      <div className="absolute inset-0 bg-red-600/10 backdrop-blur-[2px] animate-in fade-in flex items-center justify-center p-6">
                        <div className="bg-red-600 text-white p-6 rounded-3xl shadow-2xl flex items-center gap-6 border-b-4 border-red-800 animate-in zoom-in duration-300 relative">
                          <AlertTriangle className="w-8 h-8 animate-pulse" />
                          <div>
                            <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">
                              Message reçu via Subscription
                            </p>
                            <p className="text-xl font-bold">{activeAlert}</p>
                          </div>
                          <button
                            onClick={() => setActiveAlert(null)}
                            className="ml-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center space-y-3 opacity-30 grayscale">
                    <Zap className="w-8 h-8 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">
                      Flux inactif
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Card className="border-none bg-slate-50/50 rounded-[2rem]">
              <CardContent className="p-6 flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">
                    Déclencher un événement (Mutation)
                  </p>
                  <Input
                    value={alertMsg}
                    onChange={(e) => setAlertMsg(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-blue-600 font-medium"
                    placeholder="Écrivez le message à pousser..."
                  />
                </div>
                <Button
                  onClick={() =>
                    apolloClient.mutate({
                      mutation: FIRE_MUT,
                      variables: { s: 5, d: alertMsg },
                    })
                  }
                  disabled={!running}
                  className="h-12 px-10 bg-slate-900 text-white font-bold rounded-xl uppercase text-[10px] tracking-widest transition-transform active:scale-95 shadow-lg shadow-slate-200"
                >
                  Publier
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-6 shadow-2xl border-t border-white/5 flex-1 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Inspection WebSocket
                </span>
                <Badge className="bg-blue-500/20 text-blue-400 border-none font-mono text-[10px] px-3">
                  {msgCount} événements
                </Badge>
              </div>

              <div className="bg-black/40 rounded-2xl p-6 border border-white/5 h-64 overflow-auto font-mono text-[11px] leading-relaxed text-blue-300/80 scrollbar-hide shadow-inner">
                {lastPayload ? (
                  <pre className="animate-in fade-in slide-in-from-bottom-2">
                    {JSON.stringify(lastPayload, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center opacity-30 italic">
                    Zéro paquet en transit...
                  </div>
                )}
              </div>

              <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wide italic">
                    La Puissance du Push
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    La <strong>Mutation</strong> modifie l'état côté serveur, et
                    la <strong>Subscription</strong> notifie immédiatement tous
                    les navigateurs abonnés via une connexion persistante.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};
