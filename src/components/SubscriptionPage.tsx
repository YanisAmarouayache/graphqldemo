import { useEffect, useRef, useState } from 'react';
import { apolloClient } from '@/graphql/client';
import { gql } from 'graphql-tag';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Radio, AlertTriangle, Volume2, VolumeX } from 'lucide-react';

type Msg = { ts: number; label: string; payload: unknown };

type TacticalEventCreatedData = {
  tacticalEventCreated: {
    id: string;
    type: string;
    severity: number;
    description: string;
    timestamp: string;
  };
};

type UnitLocationUpdatedData = {
  unitLocationUpdated: {
    id: string;
    name: string;
    location: { coordinates: number[] };
    updatedAt: string;
  };
};

type DashboardStatsUpdatedData = {
  dashboardStatsUpdated: {
    totalUnits: number;
    activeUnits: number;
    totalSoldiers: number;
    activeMissions: number;
    recentEvents: number;
    equipmentStatus: { operational: number; maintenance: number; deployed: number };
  };
};

const SUB_UNIT_LOCATION_UPDATED = gql`
  subscription UnitLocationUpdated {
    unitLocationUpdated {
      id
      name
      location {
        coordinates
      }
      updatedAt
    }
  }
`;

const SUB_TACTICAL_EVENT_CREATED = gql`
  subscription TacticalEventCreated {
    tacticalEventCreated {
      id
      type
      severity
      description
      timestamp
    }
  }
`;

const SUB_DASHBOARD_STATS_UPDATED = gql`
  subscription DashboardStatsUpdated {
    dashboardStatsUpdated {
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
`;

export const SubscriptionsPage = () => {
  const [running, setRunning] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [overlay, setOverlay] = useState<null | { ev: TacticalEventCreatedData['tacticalEventCreated']; until: number }>(
    null
  );
  const [soundOn, setSoundOn] = useState(true);

  const [now, setNow] = useState(() => Date.now());

  // stable tab id for debugging multi-tab behavior
  const tabIdRef = useRef<string>(crypto.randomUUID());

  const beepRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    beepRef.current = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
    );
  }, []);

  const pushMsg = (label: string, payload: unknown) => {
    setMsgs((m) => [{ ts: Date.now(), label, payload }, ...m].slice(0, 50));
  };

  const status: 'idle' | 'connecting' | 'live' | 'error' =
    !running ? 'idle' : error ? 'error' : msgs.length > 0 ? 'live' : 'connecting';

  useEffect(() => {
    if (!running) return;

    setError(null);

    console.log('[ui] SUBSCRIBING tab=', tabIdRef.current);
    pushMsg('SUBSCRIBING', { tab: tabIdRef.current, at: new Date().toISOString() });

    const handleErr = (e: unknown) => {
      console.error('[sub error] tab=', tabIdRef.current, e);
      setError(e instanceof Error ? e.message : String(e));
      pushMsg('SUB_ERROR', { tab: tabIdRef.current, err: e instanceof Error ? e.message : String(e) });
    };

    const sub1 = apolloClient.subscribe<UnitLocationUpdatedData>({ query: SUB_UNIT_LOCATION_UPDATED }).subscribe({
      next: (v) => pushMsg('unitLocationUpdated', { tab: tabIdRef.current, data: v.data?.unitLocationUpdated }),
      error: handleErr,
    });

    const sub2 = apolloClient.subscribe<TacticalEventCreatedData>({ query: SUB_TACTICAL_EVENT_CREATED }).subscribe({
      next: (v) => {
        console.log('[sub tacticalEventCreated] tab=', tabIdRef.current, v);
        pushMsg('tacticalEventCreated:RAW', { tab: tabIdRef.current, data: v.data });

        const ev = v.data?.tacticalEventCreated;
        if (!ev) return;

        // Option: ne garder que les events manuels (si ton serveur met "(manual)" dans description)
        // if (!ev.description?.includes('(manual)')) return;

        pushMsg('tacticalEventCreated', { tab: tabIdRef.current, ev });

        // overlay WOW only for high severity (change threshold if needed)
        if (ev.severity >= 4) {
          setOverlay({ ev, until: Date.now() + 8000 });
          if (soundOn) beepRef.current?.play().catch(() => {});
        }
      },
      error: handleErr,
    });

    const sub3 = apolloClient.subscribe<DashboardStatsUpdatedData>({ query: SUB_DASHBOARD_STATS_UPDATED }).subscribe({
      next: (v) => pushMsg('dashboardStatsUpdated', { tab: tabIdRef.current, data: v.data?.dashboardStatsUpdated }),
      error: handleErr,
    });

    pushMsg('SUBSCRIBED', { tab: tabIdRef.current, at: new Date().toISOString() });
    console.log('[ui] SUBSCRIBED tab=', tabIdRef.current);

    return () => {
      console.log('[ui] UNSUBSCRIBED tab=', tabIdRef.current);
      pushMsg('UNSUBSCRIBED', { tab: tabIdRef.current, at: new Date().toISOString() });
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    };
  }, [running, soundOn]);

  useEffect(() => {
    if (!overlay) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    if (now >= overlay.until) setOverlay(null);
  }, [now, overlay]);

  const fireAlert = async (severity = 5) => {
    setError(null);
    console.log('[fireAlert] tab=', tabIdRef.current, 'sending', { severity });

    const res = await fetch('http://localhost:4000/api/demo/fire-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity }),
    });

    const json = await res.json().catch(() => null);
    console.log('[fireAlert] tab=', tabIdRef.current, 'response', { ok: res.ok, json });

    if (!res.ok) {
      const txt = (json && JSON.stringify(json)) || (await res.text());
      throw new Error(txt || 'Cannot fire alert');
    }

    pushMsg(`fireAlert:HTTP_OK(sev=${severity})`, { tab: tabIdRef.current, json });
  };

  const statusBadge = () => {
    if (status === 'live') return <Badge className="bg-green-500/20 text-green-300">LIVE</Badge>;
    if (status === 'connecting') return <Badge className="bg-yellow-500/20 text-yellow-300">CONNECTING</Badge>;
    if (status === 'error') return <Badge className="bg-red-500/20 text-red-300">ERROR</Badge>;
    return <Badge variant="outline">IDLE</Badge>;
  };

  const remaining = overlay ? Math.max(0, Math.ceil((overlay.until - now) / 1000)) : 0;

  return (
    <div className="space-y-6">
      {overlay && (
        <div className="fixed inset-x-0 top-0 z-50">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive text-destructive-foreground shadow-lg">
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 mt-1 text-destructive-foreground" />
                  <div className="text-left">
                    <div className="text-xs/5 opacity-90">ALERTE TEMPS RÉEL</div>
                    <div className="text-lg font-semibold">
                      {overlay.ev.type} — severity {overlay.ev.severity}
                    </div>
                    <div className="text-sm opacity-90">{overlay.ev.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-destructive-foreground/15 text-destructive-foreground">
                    auto-close: {remaining}s
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive-foreground/30 bg-transparent text-destructive-foreground hover:bg-destructive-foreground/10"
                    onClick={() => setOverlay(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Subscriptions (effet waou)
            </span>
            {statusBadge()}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setError(null);
                setMsgs([]);
                setRunning(true);
              }}
              disabled={running}
            >
              Start
            </Button>

            <Button variant="outline" onClick={() => setRunning(false)} disabled={!running}>
              Stop
            </Button>

            <Button variant="secondary" onClick={() => setSoundOn((s) => !s)} title="Son d'alerte">
              {soundOn ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
              Sound
            </Button>

            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => fireAlert(5).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
              disabled={!running}
              title="Envoie un event au serveur, broadcast à tous les clients"
            >
              FIRE ALERT
            </Button>

            <Button
              variant="outline"
              onClick={() => fireAlert(3).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
              disabled={!running}
            >
              Send severity 3
            </Button>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="text-left">
                <div className="font-medium">WebSocket / REST error</div>
                <div className="text-xs opacity-90">{error}</div>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Ouvre 2 onglets → Start sur les 2 → clique “FIRE ALERT” → l’autre onglet doit afficher l’overlay instantanément.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Flux d’événements (dernier 50) — tab {tabIdRef.current}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {msgs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">Aucun événement reçu (Start puis FIRE ALERT)</div>
          ) : (
            <div className="space-y-2">
              {msgs.map((m, i) => (
                <div key={`${m.ts}-${i}`} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.ts).toLocaleTimeString()}</div>
                  </div>
                  <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(m.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
