// ============================================================================
// FILE: src/Pages/Database/index.tsx
// Database page - Shows Drizzle Studio instructions in development mode
// ============================================================================

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useToolbarContext } from '@credopass/lib/hooks';

const isDev = import.meta.env.DEV;

export default function DatabasePage() {
  const navigate = useNavigate();

  // Database page: no search, no secondary action
  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  useEffect(() => {
    if (isDev) {
      // Show toast with Drizzle Studio instructions
      toast.info('Database Studio', {
        description: 'Run "drizzle-kit studio" in your terminal to open Drizzle Studio for database management.',
        duration: 8000,
        action: {
          label: 'Got it',
          onClick: () => {},
        },
      });
    }

    // Navigate back to events after showing toast
    const timer = setTimeout(() => {
      navigate({ to: '/events' });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  // Show a simple loading state while redirecting
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Database Studio</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isDev 
              ? 'Use Drizzle Studio for database management. Redirecting...' 
              : 'Database management is only available in development mode.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
