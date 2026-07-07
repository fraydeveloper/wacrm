'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
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
import type { MessengerConfig as MessengerConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

/**
 * Mirrors src/components/settings/whatsapp-config.tsx, trimmed down for
 * Messenger: there's no 2FA-PIN /register step here — subscribing the
 * Page's webhook fields in the Meta App Dashboard is enough for Meta to
 * start delivering events, so there's no separate "is it actually live?"
 * probe to run.
 */
export function MessengerConfig() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<MessengerConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [needsReset, setNeedsReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const loadedAccountIdRef = useRef<string | null>(null);

  const [pageId, setPageId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/meta-omni`
      : '';

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messenger_config')
        .select('*')
        .eq('account_id', acctId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setPageId(data.page_id || '');
        setPageAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setTokenEdited(false);
      } else {
        setConfig(null);
        setPageId('');
        setPageAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
      }

      if (data) {
        try {
          const res = await fetch('/api/messenger/config', { method: 'GET' });
          const payload = await res.json();
          if (payload.connected) {
            setConnectionStatus('connected');
            setNeedsReset(false);
            setStatusMessage('');
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
      toast.error('No se pudo cargar la configuración de Messenger');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
    if (!pageId.trim()) {
      toast.error('El Page ID es obligatorio');
      return;
    }
    if (!config && (!pageAccessToken.trim() || !tokenEdited)) {
      toast.error('El Page Access Token es obligatorio para la configuración inicial');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        page_id: pageId.trim(),
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && pageAccessToken !== MASKED_TOKEN && pageAccessToken.trim()) {
        payload.page_access_token = pageAccessToken.trim();
      } else if (config) {
        toast.error('Vuelve a ingresar el Page Access Token para guardar los cambios');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/messenger/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'No se pudo guardar la configuración');
        setSaving(false);
        return;
      }

      toast.success(
        data.page_info?.name
          ? `Conectado — ${data.page_info.name} ya puede recibir eventos.`
          : 'Messenger conectado. Los eventos comenzarán a llegar una vez que el webhook esté suscrito en Meta.',
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
      const res = await fetch('/api/messenger/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setNeedsReset(false);
        setStatusMessage('');
        toast.success(
          payload.page_info?.name
            ? `Conectado a ${payload.page_info.name}`
            : 'Conexión con la API exitosa',
        );
      } else {
        setConnectionStatus('disconnected');
        setNeedsReset(Boolean(payload.needs_reset));
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'Falló la conexión con la API');
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
    if (!confirm('Esto eliminará la configuración actual de Messenger para que puedas volver a ingresarla. ¿Continuar?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/messenger/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'No se pudo restablecer la configuración');
        return;
      }

      toast.success('Configuración eliminada. Ya puedes volver a ingresar tus credenciales.');
      setConfig(null);
      setPageId('');
      setPageAccessToken('');
      setVerifyToken('');
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

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL del webhook copiada al portapapeles');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Conexión de Messenger"
          description="Conecta una página de Facebook a través de la Meta Messenger Platform."
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
        title="Conexión de Messenger"
        description="Conecta una página de Facebook a través de la Meta Messenger Platform. Reutiliza la misma base de conocimiento de IA y bandeja de entrada que WhatsApp."
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
                        <Loader2 className="size-4 animate-spin" />
                        Restableciendo...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-4" />
                        Restablecer configuración
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
                {connectionStatus === 'connected' ? 'Credenciales válidas' : 'No conectado'}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground">
              {connectionStatus === 'connected'
                ? 'Tu Page Access Token se autentica con Meta. Asegúrate de que el webhook de abajo esté suscrito en el Meta App Dashboard para que los eventos realmente lleguen.'
                : statusMessage ||
                  'Configura las credenciales de tu página de Facebook abajo para conectar Messenger.'}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Credenciales de la página</CardTitle>
              <CardDescription className="text-muted-foreground">
                Desde Meta for Developers → tu App → Messenger → Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Page ID</Label>
                <Input
                  placeholder="ej. 102938475610234"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Page Access Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Ingresa tu Page Access Token"
                    value={pageAccessToken}
                    onChange={(e) => {
                      setPageAccessToken(e.target.value);
                      setTokenEdited(true);
                    }}
                    onFocus={() => {
                      if (pageAccessToken === MASKED_TOKEN) {
                        setPageAccessToken('');
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
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Webhook Verify Token</Label>
                <Input
                  placeholder="Crea un token de verificación personalizado"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Una cadena personalizada que tú creas. Debe coincidir con el token que configures en los ajustes de webhook de Meta.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Configuración del webhook</CardTitle>
              <CardDescription className="text-muted-foreground">
                Usa esta URL como el callback de Messenger en el Meta App Dashboard. Instagram
                Direct reutilizará esta misma URL una vez que esté conectado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Webhook Callback URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted border-border text-muted-foreground font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
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
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar configuración'
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
                  <Loader2 className="size-4 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Probar conexión con la API
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
                    <Loader2 className="size-4 animate-spin" />
                    Restableciendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Restablecer configuración
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base">Instrucciones de configuración</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sigue estos pasos para conectar una página de Facebook.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                      Agrega el producto Messenger
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>En el panel de tu Meta App, haz clic en &quot;Add Product&quot;</li>
                      <li>Busca &quot;Messenger&quot; y haz clic en &quot;Set Up&quot;</li>
                      <li>En Access Tokens, genera un token para tu página</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      Obtén tu Page ID
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Ve a tu página de Facebook &gt; Información</li>
                      <li>Copia el <strong className="text-foreground">Page ID</strong></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                      Configura el webhook
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>En Messenger &gt; Settings, haz clic en &quot;Add Callback URL&quot;</li>
                      <li>Pega la <strong className="text-foreground">Webhook Callback URL</strong> de arriba</li>
                      <li>Ingresa el mismo <strong className="text-foreground">Verify Token</strong> que configuraste aquí</li>
                      <li>Suscríbete al campo de webhook &quot;messages&quot;</li>
                      <li>Suscribe tu página a la app</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 pt-4 border-t border-border">
                <a
                  href="https://developers.facebook.com/docs/messenger-platform/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Documentación de la plataforma Meta Messenger
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
