'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { TelegramConfig as TelegramConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

/**
 * Telegram connection panel. Simpler than Messenger/WhatsApp: there's no
 * manual webhook step — saving the bot token calls Telegram's setWebhook
 * for you (see /api/telegram/config). The only field is the @BotFather
 * token.
 */
export function TelegramConfig() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<TelegramConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [needsReset, setNeedsReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const loadedAccountIdRef = useRef<string | null>(null);

  const [botToken, setBotToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const fetchConfig = useCallback(
    async (acctId: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('telegram_config')
          .select('*')
          .eq('account_id', acctId)
          .maybeSingle();

        if (error) console.error('Failed to load telegram config row:', error);

        if (data) {
          setConfig(data);
          setBotUsername(data.bot_username ?? null);
          setBotToken(MASKED_TOKEN);
          setTokenEdited(false);
        } else {
          setConfig(null);
          setBotUsername(null);
          setBotToken('');
          setTokenEdited(false);
        }

        if (data) {
          try {
            const res = await fetch('/api/telegram/config', { method: 'GET' });
            const payload = await res.json();
            if (payload.connected) {
              setConnectionStatus('connected');
              setNeedsReset(false);
              setStatusMessage('');
              if (payload.bot_info?.username) setBotUsername(payload.bot_info.username);
            } else {
              setConnectionStatus('disconnected');
              setNeedsReset(Boolean(payload.needs_reset));
              setStatusMessage(payload.message || '');
            }
          } catch (err) {
            console.error('Health check failed:', err);
            setConnectionStatus('disconnected');
          }
        } else {
          setConnectionStatus('disconnected');
          setNeedsReset(false);
          setStatusMessage('');
        }
      } catch (err) {
        console.error('fetchConfig error:', err);
        toast.error('No se pudo cargar la configuración de Telegram');
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfig]);

  async function handleSave() {
    if (!config && (!botToken.trim() || !tokenEdited)) {
      toast.error('Pega el token de tu bot para conectarlo');
      return;
    }
    if (config && !tokenEdited) {
      toast.error('Vuelve a ingresar el token del bot para actualizar la configuración');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo guardar la configuración');
        return;
      }
      toast.success(
        data.bot_info?.username
          ? `Conectado — @${data.bot_info.username} ya recibe mensajes.`
          : 'Telegram conectado. El webhook quedó registrado automáticamente.',
      );
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/telegram/config', { method: 'GET' });
      const payload = await res.json();
      if (payload.connected) {
        setConnectionStatus('connected');
        setNeedsReset(false);
        setStatusMessage('');
        if (payload.bot_info?.username) setBotUsername(payload.bot_info.username);
        toast.success(
          payload.bot_info?.username
            ? `Conectado a @${payload.bot_info.username}`
            : 'Conexión con Telegram exitosa',
        );
      } else {
        setConnectionStatus('disconnected');
        setNeedsReset(Boolean(payload.needs_reset));
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'Falló la conexión con Telegram');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Falló la prueba de conexión. Verifica la red e intenta de nuevo.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('Esto desconectará el bot (borra el webhook y la configuración). ¿Continuar?')) {
      return;
    }
    try {
      setResetting(true);
      const res = await fetch('/api/telegram/config', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo restablecer la configuración');
        return;
      }
      toast.success('Configuración eliminada. Ya puedes conectar otro bot.');
      setConfig(null);
      setBotToken('');
      setBotUsername(null);
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setNeedsReset(false);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('No se pudo restablecer la configuración');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Conexión de Telegram"
          description="Conecta un bot de Telegram con solo su token de @BotFather."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Conexión de Telegram"
        description="Conecta un bot de Telegram con solo su token de @BotFather. Reutiliza la misma base de conocimiento de IA y bandeja de entrada que WhatsApp — sin App Review de Meta."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {needsReset && (
            <Alert className="bg-amber-950/40 border-amber-600/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <AlertTitle className="text-amber-200 mb-1">
                    El token guardado no se puede descifrar
                  </AlertTitle>
                  <AlertDescription className="text-amber-100/80 text-sm">
                    {statusMessage}
                  </AlertDescription>
                  <Button
                    onClick={handleReset}
                    disabled={resetting}
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Restableciendo...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-4" /> Restablecer configuración
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <Alert className="bg-card border-border">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <XCircle className="size-4 text-red-500" />
              )}
              <AlertTitle className="text-foreground mb-0">
                {connectionStatus === 'connected'
                  ? botUsername
                    ? `Conectado — @${botUsername}`
                    : 'Conectado'
                  : 'No conectado'}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground">
              {connectionStatus === 'connected'
                ? 'Tu bot está activo y el webhook quedó registrado. Escríbele a tu bot en Telegram para probarlo — la conversación aparecerá en la bandeja de entrada con la etiqueta TG.'
                : statusMessage ||
                  'Pega el token de tu bot abajo para conectar Telegram.'}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Token del bot</CardTitle>
              <CardDescription className="text-muted-foreground">
                Desde @BotFather en Telegram → /newbot (o /token para uno existente).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Bot Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="123456789:ABCdef..."
                    value={botToken}
                    onChange={(e) => {
                      setBotToken(e.target.value);
                      setTokenEdited(true);
                    }}
                    onFocus={() => {
                      if (botToken === MASKED_TOKEN) {
                        setBotToken('');
                        setTokenEdited(true);
                      }
                    }}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config && !tokenEdited && (
                  <p className="text-xs text-muted-foreground">
                    El token está oculto por seguridad. Vuelve a ingresarlo para actualizar la configuración.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Al guardar, registramos el webhook automáticamente. Requiere que la
                  app esté desplegada en una URL pública HTTPS (define{' '}
                  <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> si aún no lo hiciste).
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Guardando...
                </>
              ) : (
                'Guardar y conectar'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Probando...
                </>
              ) : (
                <>
                  <Zap className="size-4" /> Probar conexión
                </>
              )}
            </Button>
            {config && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
              >
                {resetting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Restableciendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" /> Desconectar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base">Cómo conectar</CardTitle>
              <CardDescription className="text-muted-foreground">
                Tres pasos y sin revisión de Meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                      Crea el bot
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Abre <strong className="text-foreground">@BotFather</strong> en Telegram</li>
                      <li>Envía <code className="font-mono">/newbot</code> y sigue los pasos</li>
                      <li>Copia el <strong className="text-foreground">token</strong> que te da</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      Pega el token y guarda
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Pega el token en el campo de la izquierda</li>
                      <li>Haz clic en <strong className="text-foreground">Guardar y conectar</strong></li>
                      <li>Registramos el webhook por ti — sin pasos manuales</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                      Pruébalo
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Busca tu bot por su @usuario en Telegram</li>
                      <li>Envíale un mensaje</li>
                      <li>Aparecerá en la bandeja con la etiqueta <strong className="text-foreground">TG</strong> y la IA responderá</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 pt-4 border-t border-border">
                <a
                  href="https://core.telegram.org/bots#how-do-i-create-a-bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Documentación de Telegram Bots
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
