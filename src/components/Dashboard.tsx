import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useGraphQL';
import { 
  Users, 
  Shield, 
  Target, 
  AlertTriangle, 
  Wrench,
  Activity,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  totalUnits: number;
  activeUnits: number;
  totalSoldiers: number;
  activeMissions: number;
  recentEvents: number;
  equipmentStatus: {
    operational: number;
    maintenance: number;
    deployed: number;
  };
}

export const Dashboard = () => {
  const { data, loading, error } = useDashboardStats();
  const stats = data?.dashboardStats as unknown as DashboardStats | undefined;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Erreur de chargement: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      title: 'Unités Totales',
      value: stats?.totalUnits || 0,
      subValue: `${stats?.activeUnits || 0} actives`,
      icon: Shield,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Soldats',
      value: stats?.totalSoldiers || 0,
      subValue: 'Personnel',
      icon: Users,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Missions Actives',
      value: stats?.activeMissions || 0,
      subValue: 'En cours',
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Événements Récent',
      value: stats?.recentEvents || 0,
      subValue: '24h',
      icon: AlertTriangle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
                </div>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Equipment Status */}
      {stats?.equipmentStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Statut des Équipements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-muted-foreground">Opérationnel</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {stats.equipmentStatus.operational}
                </p>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-muted-foreground">Maintenance</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.equipmentStatus.maintenance}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-muted-foreground">Déployé</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {stats.equipmentStatus.deployed}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
