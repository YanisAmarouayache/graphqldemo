import { useState, useCallback, useEffect } from 'react';
import { apolloClient } from '@/graphql/client';
import { gql } from 'graphql-tag';
import type { DocumentNode } from 'graphql';

// Generic hook for executing queries
export const useQuery = (query: DocumentNode, options?: { variables?: Record<string, unknown>; skip?: boolean }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    if (options?.skip) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await apolloClient.query({
        query,
        variables: options?.variables,
      });
      setData(result.data as Record<string, unknown>);
      return result.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [query, options?.variables, options?.skip]);

  // Auto-execute on mount
  useEffect(() => {
    if (!options?.skip) {
      execute();
    }
  }, []);
  
  return { data, loading, error, refetch: execute };
};

// Hook for mutations
export const useMutation = (mutation: DocumentNode) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (variables?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apolloClient.mutate({
        mutation,
        variables,
      });
      return result.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutation]);

  return [execute, { loading, error }] as const;
};

// Pre-built hooks for common queries
export const useDashboardStats = () => {
  const query = gql`
    query GetDashboardStats {
      dashboardStats {
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
  
  return useQuery(query);
};

export const useUnits = (filter?: { status?: string; search?: string }, first: number = 10) => {
  const query = gql`
    query GetUnits($filter: UnitFilter, $first: Int, $after: String) {
      units(filter: $filter, first: $first, after: $after) {
        edges {
          node {
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
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
          totalCount
        }
      }
    }
  `;
  
  return useQuery(query, { variables: { filter, first } });
};

export const useUnit = (id: string) => {
  const query = gql`
    query GetUnit($id: ID!) {
      unit(id: $id) {
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
          status
          specialization
          equipment {
            id
            name
            type
            serialNumber
          }
        }
        equipment {
          id
          name
          type
          status
          serialNumber
        }
        commander {
          id
          name
          rank
        }
        createdAt
        updatedAt
      }
    }
  `;
  
  return useQuery(query, { variables: { id }, skip: !id });
};

export const useAllUnits = () => {
  const query = gql`
    query GetAllUnits {
      allUnits {
        id
        name
        status
        location {
          coordinates
        }
        soldiers {
          id
          name
        }
        equipment {
          id
          name
        }
      }
    }
  `;
  
  return useQuery(query);
};

export const useSoldiers = (unitId?: string) => {
  const query = gql`
    query GetSoldiers($unitId: ID) {
      soldiers(unitId: $unitId) {
        id
        name
        rank
        status
        unitId
        specialization
        equipment {
          id
          name
          type
        }
      }
    }
  `;
  
  return useQuery(query, { variables: { unitId }, skip: !unitId });
};

export const useSoldier = (id: string) => {
  const query = gql`
    query GetSoldier($id: ID!) {
      soldier(id: $id) {
        id
        name
        rank
        status
        unitId
        specialization
        equipment {
          id
          name
          type
          serialNumber
        }
      }
    }
  `;
  
  return useQuery(query, { variables: { id }, skip: !id });
};

export const useEquipment = (id: string) => {
  const query = gql`
    query GetEquipment($id: ID!) {
      equipment(id: $id) {
        id
        name
        type
        status
        serialNumber
        assignedTo
      }
    }
  `;
  
  return useQuery(query, { variables: { id }, skip: !id });
};

export const useAllEquipment = () => {
  const query = gql`
    query GetAllEquipment {
      allEquipment {
        id
        name
        type
        status
        serialNumber
        assignedTo
      }
    }
  `;
  
  return useQuery(query);
};

export const useMissions = (status?: string) => {
  const query = gql`
    query GetMissions($status: MissionStatus) {
      missions(status: $status) {
        id
        name
        status
        objective
        location {
          coordinates
        }
        units {
          id
          name
          status
        }
        startTime
        endTime
      }
    }
  `;
  
  return useQuery(query, { variables: { status } });
};

export const useMission = (id: string) => {
  const query = gql`
    query GetMission($id: ID!) {
      mission(id: $id) {
        id
        name
        status
        objective
        location {
          coordinates
        }
        units {
          id
          name
          status
          soldiers {
            id
            name
            rank
          }
        }
        startTime
        endTime
      }
    }
  `;
  
  return useQuery(query, { variables: { id }, skip: !id });
};

export const useTacticalEvents = (severity?: number) => {
  const query = gql`
    query GetTacticalEvents($severity: Int) {
      tacticalEvents(severity: $severity) {
        id
        type
        location {
          coordinates
        }
        timestamp
        severity
        description
        involvedUnits
      }
    }
  `;
  
  return useQuery(query, { variables: { severity } });
};

export const useTacticalEvent = (id: string) => {
  const query = gql`
    query GetTacticalEvent($id: ID!) {
      tacticalEvent(id: $id) {
        id
        type
        location {
          coordinates
        }
        timestamp
        severity
        description
        involvedUnits
      }
    }
  `;
  
  return useQuery(query, { variables: { id }, skip: !id });
};

// Mutations
export const useCreateUnit = () => {
  const mutation = gql`
    mutation CreateUnit($input: CreateUnitInput!) {
      createUnit(input: $input) {
        unit {
          id
          name
          status
          location {
            coordinates
          }
          createdAt
        }
      }
    }
  `;
  return useMutation(mutation);
};

export const useUpdateUnit = () => {
  const mutation = gql`
    mutation UpdateUnit($input: UpdateUnitInput!) {
      updateUnit(input: $input) {
        unit {
          id
          name
          status
          location {
            coordinates
          }
          updatedAt
        }
      }
    }
  `;
  return useMutation(mutation);
};

export const useUpdateUnitLocation = () => {
  const mutation = gql`
    mutation UpdateUnitLocation($id: ID!, $location: PointInput!) {
      updateUnitLocation(id: $id, location: $location) {
        id
        name
        location {
          coordinates
        }
        updatedAt
      }
    }
  `;
  return useMutation(mutation);
};

// Performance comparison hook
export const usePerformanceComparison = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    graphql: { requestCount: number; totalPayloadSize: number; totalTime: number };
    rest: { requestCount: number; totalPayloadSize: number; totalTime: number };
  } | null>(null);

  const compare = useCallback(async (graphqlQuery: string, restEndpoints: string[]) => {
    setIsLoading(true);

    try {
      // Execute GraphQL query
      const gqlStart = performance.now();
      const gqlResult = await apolloClient.query({
        query: gql(graphqlQuery),
      });
      const gqlEnd = performance.now();
      const gqlPayloadSize = JSON.stringify(gqlResult.data).length;

      // Execute REST requests
      const restStart = performance.now();
      let restPayloadSize = 0;
      
      for (const endpoint of restEndpoints) {
        try {
          const response = await fetch(`http://localhost:4000${endpoint}`);
          const data = await response.json();
          restPayloadSize += JSON.stringify(data).length;
        } catch (e) {
          console.error('REST request failed:', e);
        }
      }
      
      const restEnd = performance.now();

      setResult({
        graphql: {
          requestCount: 1,
          totalPayloadSize: gqlPayloadSize,
          totalTime: gqlEnd - gqlStart,
        },
        rest: {
          requestCount: restEndpoints.length,
          totalPayloadSize: restPayloadSize,
          totalTime: restEnd - restStart,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { compare, isLoading, result };
};
