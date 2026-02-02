import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/hooks/useGraphQL";
import {
  Shield,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500",
  INACTIVE: "bg-gray-500",
  MAINTENANCE: "bg-yellow-500",
  DEPLOYED: "bg-blue-500",
};

// --- Interfaces ---

interface Unit {
  id: string;
  name: string;
  status: string;
  location: {
    coordinates: [number, number];
  };
  soldiers: Array<{ id: string; name: string }>;
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

// --- Component ---

export const UnitList = ({ onSelectUnit }: UnitListProps) => {
  // cursorHistory tracks the "after" values we've used.
  // [undefined] represents the first page.
  const [history, setHistory] = useState<(string | undefined)[]>([undefined]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data, loading, error, refetch } = useUnits(undefined, 5);

  const unitsData = data as unknown as UnitsData | undefined;
  const units = unitsData?.units?.edges || [];
  const pageInfo = unitsData?.units?.pageInfo;

  // Navigation Handlers
  const handleNext = () => {
    if (pageInfo?.hasNextPage && pageInfo.endCursor) {
      const nextCursor = pageInfo.endCursor;

      // If we are moving forward for the first time from this position, add to history
      if (currentIndex === history.length - 1) {
        setHistory((prev) => [...prev, nextCursor]);
      }
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="pt-6 flex flex-col items-center gap-3">
          <div className="text-red-400 text-sm font-medium">
            Erreur de synchronisation: {error.message}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3 mr-2" /> Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Unités Militaires
          </CardTitle>
          <div className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold text-muted-foreground uppercase">
            {pageInfo?.totalCount || 0} Total
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            <p className="text-xs text-muted-foreground animate-pulse">
              Chargement tactique...
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {units.map(({ node: unit }: UnitEdge) => (
                <div
                  key={unit.id}
                  className="group flex items-center justify-between p-3 bg-muted/30 border border-transparent rounded-lg hover:border-primary/20 hover:bg-muted/60 cursor-pointer transition-all"
                  onClick={() => onSelectUnit?.(unit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full shadow-sm ${
                        statusColors[unit.status] || "bg-gray-500"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sm leading-none">
                        {unit.name}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 opacity-70" />
                          {unit.location.coordinates[0].toFixed(3)},{" "}
                          {unit.location.coordinates[1].toFixed(3)}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3 opacity-70" />
                          {unit.soldiers?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold px-2 py-1 bg-background rounded border uppercase tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">
                    {unit.status}
                  </div>
                </div>
              ))}
            </div>

            {units.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm italic">
                Aucune unité détectée dans ce secteur.
              </div>
            )}

            {/* Pagination UI */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-muted">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={currentIndex === 0 || loading}
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Précédent
              </Button>

              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                Page {currentIndex + 1}
              </span>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={!pageInfo?.hasNextPage || loading}
                onClick={handleNext}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
