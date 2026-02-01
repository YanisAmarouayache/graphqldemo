import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export const ServerStatus = () => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:4000/health', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          setStatus('online');
        } else {
          setStatus('offline');
        }
      } catch {
        setStatus('offline');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Activity className="w-4 h-4" />
      <span className="text-sm text-muted-foreground">Serveur:</span>
      {status === 'checking' && (
        <span className="text-xs text-muted-foreground animate-pulse">Vérification...</span>
      )}
      {status === 'online' && (
        <span className="text-xs text-green-400 flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          En ligne
        </span>
      )}
      {status === 'offline' && (
        <span className="text-xs text-red-400 flex items-center gap-1">
          <WifiOff className="w-3 h-3" />
          Hors ligne
        </span>
      )}
    </div>
  );
};
