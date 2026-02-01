import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUnits } from '@/hooks/useGraphQL';
import { 
  Shield, 
  MapPin, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Loader2
} from 'lucide-react';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-500',
  MAINTENANCE: 'bg-yellow-500',
  DEPLOYED: 'bg-blue-500',
};

interface Unit {
  id: string;
  name: string;
  status: string;
  location: {
    coordinates: [number, number];
  };
  soldiers: Array<{ id: string; name: string }>;
  equipment: Array<{ id: string; name: string }>;
}

interface UnitEdge {
  node: Unit;
  cursor: string;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string;
  totalCount: number;
}

interface UnitsData {
  units: {
    edges: UnitEdge[];
    pageInfo: PageInfo;
  };
}

interface UnitListProps {
  onSelectUnit?: (unitId: string) => void;
}

export const UnitList = ({ onSelectUnit }: UnitListProps) => {
  const [search, setSearch] = useState('');
  const { data, loading, error } = useUnits(
    search ? { search } : undefined,
    5
  );

  const unitsData = data as unknown as UnitsData | undefined;
  const units = unitsData?.units?.edges || [];
  const pageInfo = unitsData?.units?.pageInfo;

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="pt-6">
          <div className="text-red-400">Erreur: {error.message}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Unités Militaires
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            {pageInfo?.totalCount || 0} total
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une unité..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {units.map(({ node: unit }: UnitEdge) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => onSelectUnit?.(unit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${statusColors[unit.status] || 'bg-gray-500'}`} />
                    <div>
                      <p className="font-medium text-sm">{unit.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {unit.location.coordinates[0].toFixed(2)}, {unit.location.coordinates[1].toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {unit.soldiers?.length || 0} soldats
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 bg-background rounded border">
                    {unit.status}
                  </div>
                </div>
              ))}
            </div>

            {units.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune unité trouvée
              </div>
            )}

            {pageInfo && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pageInfo.hasNextPage}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Suivant
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page 1
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={true}
                >
                  Précédent
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
