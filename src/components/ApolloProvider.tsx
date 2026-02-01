import type { ReactNode } from 'react';
import { ApolloProvider as Provider, apolloClient } from '@/graphql/client';

interface ApolloProviderProps {
  children: ReactNode;
}

export const ApolloProvider = ({ children }: ApolloProviderProps) => {
  return <Provider client={apolloClient}>{children}</Provider>;
};
