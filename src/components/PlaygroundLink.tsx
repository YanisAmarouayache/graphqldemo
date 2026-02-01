import { Button } from '@/components/ui/button';
import { ExternalLink, Code2 } from 'lucide-react';

export const PlaygroundLink = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => window.open('http://localhost:4000/graphql', '_blank')}
    >
      <Code2 className="w-4 h-4" />
      Playground
      <ExternalLink className="w-3 h-3" />
    </Button>
  );
};
