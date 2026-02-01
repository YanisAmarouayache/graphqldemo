import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

const wsClient = createClient({
  url: 'ws://localhost:4000/subscriptions',
  lazy: false,                 // connect dès le départ
  retryAttempts: Infinity,     // reconnect si ça ferme
  shouldRetry: () => true,
  on: {
    opened: () => console.log('[ws] opened'),
    connected: () => console.log('[ws] connected'),
    closed: (e) => console.log('[ws] closed', e.code, e.reason),
  },
});


const wsLink = new GraphQLWsLink(wsClient);

const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    const isSub = def.kind === 'OperationDefinition' && def.operation === 'subscription';
    console.log('[apollo] route', isSub ? 'WS' : 'HTTP', def);
    return isSub;
  },
  wsLink,
  httpLink
);

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export { ApolloProvider };
export default apolloClient;
