'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles, Settings2, Power } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiConfig } from '@/components/settings/ai-config';

type Tab = 'playground' | 'setup';

interface AiStatus {
  configured: boolean;
  is_active?: boolean;
  provider?: string;
}

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      setAiStatus(data);
      setTab(data?.configured ? 'playground' : 'setup');
    } catch {
      setTab('setup');
    } finally {
      setDecided(true);
    }
  };

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadStatus();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = aiStatus?.configured && aiStatus?.is_active;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Agentes de IA
          </h1>
        </div>

        {/* Estado de la IA — visible siempre que esté configurada */}
        {aiStatus?.configured && (
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
              }`}
            />
            <Power className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-500 dark:text-emerald-400' : ''}`} />
            {isActive ? 'IA encendida' : 'IA apagada'}
          </div>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Tu agente de IA con tu propia clave — configúralo y luego pruébalo en
        la zona de pruebas antes de que responda a los clientes en la bandeja de entrada.
      </p>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> Zona de pruebas
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={() => setTab('setup')} />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiConfig onConfigSaved={loadStatus} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
