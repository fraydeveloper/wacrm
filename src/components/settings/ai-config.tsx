'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, CheckCircle2, Trash2, Eye, EyeOff, Power } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsPanelHead } from './settings-panel-head';
import { AiKnowledgeCard } from './ai-knowledge';
import { AI_PROVIDER_DEFAULT_MODEL, DEFAULT_HANDOFF_MESSAGE } from '@/lib/ai/defaults';
import { AI_PROVIDERS, type AiChannel, type AiProvider } from '@/lib/ai/types';

const MASKED_KEY = '••••••••••••••••';

// Only channels with a real send path today (see src/lib/channels/router.ts).
// Instagram is still a reserved enum value with no working sender yet, so a
// toggle for it would be dead UI.
const TOGGLEABLE_CHANNELS: AiChannel[] = ['whatsapp', 'messenger', 'telegram'];

const CHANNEL_LABEL: Record<AiChannel, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
  telegram: 'Telegram',
};

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  deepseek: 'DeepSeek',
  zai: 'Z.ai (GLM)',
  gemini: 'Google Gemini',
};

const KEY_PLACEHOLDER: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  deepseek: 'sk-...',
  zai: '...',
  gemini: 'AIza...',
};

export function AiConfig({ onConfigSaved }: { onConfigSaved?: () => void } = {}) {
  const { accountId, accountRole, profileLoading } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState(AI_PROVIDER_DEFAULT_MODEL.openai);
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [embeddingsKeyEdited, setEmbeddingsKeyEdited] = useState(false);
  const [hasStoredEmbeddingsKey, setHasStoredEmbeddingsKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [maxPerConversation, setMaxPerConversation] = useState(3);
  const [channelsEnabled, setChannelsEnabled] = useState<AiChannel[]>(TOGGLEABLE_CHANNELS);
  const [handoffMessage, setHandoffMessage] = useState('');
  const [handoffNotifyNumber, setHandoffNotifyNumber] = useState('');

  // Guard keyed on the account (not a bare boolean) so an in-place
  // account switch — ownership transfer, multi-account membership —
  // refetches instead of showing the previous account's config. Mirrors
  // the loadedAccountIdRef pattern in whatsapp-config.tsx.
  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo cargar la configuración de IA');
        return;
      }
      if (data.configured) {
        setConfigured(true);
        setProvider(data.provider);
        setModel(data.model);
        setSystemPrompt(data.system_prompt ?? '');
        setIsActive(data.is_active);
        setAutoReplyEnabled(data.auto_reply_enabled);
        setMaxPerConversation(data.auto_reply_max_per_conversation ?? 3);
        setChannelsEnabled(
          Array.isArray(data.ai_channels_enabled)
            ? data.ai_channels_enabled
            : TOGGLEABLE_CHANNELS,
        );
        setHandoffMessage(data.handoff_message ?? '');
        setHandoffNotifyNumber(data.handoff_notify_number ?? '');
        setHasStoredKey(Boolean(data.has_key));
        setApiKey(data.has_key ? MASKED_KEY : '');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(Boolean(data.has_embeddings_key));
        setEmbeddingsKey(data.has_embeddings_key ? MASKED_KEY : '');
        setEmbeddingsKeyEdited(false);
      }
    } catch {
      toast.error('No se pudo cargar la configuración de IA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
  }, [accountId, fetchConfig]);

  // Swap the model default when the provider changes, unless the user
  // typed a custom model.
  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const isDefaultModel =
      model.trim() === '' ||
      Object.values(AI_PROVIDER_DEFAULT_MODEL).includes(model);
    if (isDefaultModel) setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
  };

  const toggleChannel = (channel: AiChannel, enabled: boolean) => {
    setChannelsEnabled((prev) =>
      enabled ? [...prev, channel] : prev.filter((c) => c !== channel),
    );
  };

  const keyPayload = () => (keyEdited ? apiKey.trim() : undefined);

  // undefined = leave unchanged; '' typed = null (clear); text = set.
  const embeddingsKeyPayload = () =>
    embeddingsKeyEdited ? embeddingsKey.trim() || null : undefined;

  const buildBody = () => ({
    provider,
    model: model.trim(),
    api_key: keyPayload(),
    embeddings_api_key: embeddingsKeyPayload(),
    system_prompt: systemPrompt.trim() || null,
    is_active: isActive,
    auto_reply_enabled: autoReplyEnabled,
    auto_reply_max_per_conversation: maxPerConversation,
    ai_channels_enabled: channelsEnabled,
    handoff_message: handoffMessage.trim() || null,
    handoff_notify_number: handoffNotifyNumber.trim() || null,
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          api_key: keyPayload(),
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success('La clave funciona — el proveedor respondió.');
      else toast.error(data.error ?? 'El proveedor rechazó la solicitud.');
    } catch {
      toast.error('No se pudo contactar al proveedor.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error('Ingresa el nombre de un modelo.');
      return;
    }
    if (!configured && !keyEdited) {
      toast.error('Ingresa tu clave de API.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Asistente de IA guardado.');
        await fetchConfig();
        onConfigSaved?.();
      } else {
        toast.error(data.error ?? 'No se pudo guardar.');
      }
    } catch {
      toast.error('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Configuración de IA eliminada.');
        setConfigured(false);
        setHasStoredKey(false);
        setApiKey('');
        setKeyEdited(false);
        setIsActive(false);
        setAutoReplyEnabled(false);
        setChannelsEnabled(TOGGLEABLE_CHANNELS);
        setSystemPrompt('');
        setHandoffMessage('');
        setHandoffNotifyNumber('');
        onConfigSaved?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'No se pudo eliminar.');
      }
    } catch {
      toast.error('No se pudo eliminar.');
    } finally {
      setRemoving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const disabled = !canEdit || saving;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <SettingsPanelHead
          title="Configuración del agente"
          description="Trae tu propia clave de OpenAI, Anthropic, DeepSeek, Gemini o Z.ai. wacrm llama directamente al proveedor con tu clave — sin cargos por asiento de IA, y tus datos se quedan contigo. Esto potencia las respuestas con IA en la bandeja de entrada, el bot de auto-respuesta y la Zona de pruebas."
        />
        {configured && (
          <div
            className={`flex items-center gap-1.5 shrink-0 mt-1 rounded-full px-3 py-1 text-xs font-semibold border ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-muted text-muted-foreground border-border'
            }`}
            title={isActive ? 'El asistente de IA está activo' : 'El asistente de IA está inactivo'}
          >
            <Power
              className={`h-3 w-3 ${
                isActive ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted-foreground'
              }`}
            />
            {isActive ? 'IA activa' : 'IA inactiva'}
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Solo los administradores y propietarios pueden cambiar la configuración de IA.
        </p>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Proveedor y clave
            </CardTitle>
            <CardDescription>
              Tu clave se cifra en reposo (AES-256-GCM) y nunca se vuelve a
              mostrar después de guardarla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => handleProviderChange(v as AiProvider)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ai-model">Modelo</Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Recomendado: <code className="font-mono">{AI_PROVIDER_DEFAULT_MODEL[provider]}</code>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-key">Clave de API</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ai-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyEdited(true);
                    }}
                    onFocus={() => {
                      if (!keyEdited && hasStoredKey) {
                        setApiKey('');
                        setKeyEdited(true);
                      }
                    }}
                    placeholder={KEY_PLACEHOLDER[provider]}
                    disabled={disabled}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={disabled || testing}
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Probar clave
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-embeddings-key">
                Clave de embeddings{' '}
                <span className="font-normal text-muted-foreground">
                  (opcional — habilita la búsqueda semántica en la base de conocimiento)
                </span>
              </Label>
              <Input
                id="ai-embeddings-key"
                type="password"
                value={embeddingsKey}
                onChange={(e) => {
                  setEmbeddingsKey(e.target.value);
                  setEmbeddingsKeyEdited(true);
                }}
                onFocus={() => {
                  if (!embeddingsKeyEdited && hasStoredEmbeddingsKey) {
                    setEmbeddingsKey('');
                    setEmbeddingsKeyEdited(true);
                  }
                }}
                placeholder="sk-... (OpenAI)"
                disabled={disabled}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Una clave de OpenAI usada solo para generar embeddings de tu base
                de conocimiento (text-embedding-3-small)
                {provider === 'openai' ? ' — puede ser la misma clave de arriba' : ''}.
                Déjala en blanco para usar búsqueda por palabras clave. Bórrala
                para desactivar la búsqueda semántica.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comportamiento</CardTitle>
            <CardDescription>
              Cuéntale al asistente sobre tu negocio — productos, tono, qué
              puede y qué no puede prometer. Este contexto alimenta tanto los
              borradores como las auto-respuestas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Contexto del negocio e instrucciones</Label>
              <Textarea
                id="ai-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="ej. Somos Acme, una tienda de equipos de café. Sé cálido y conciso. Nunca menciones precios ni fechas de entrega — deriva eso a un humano."
                rows={5}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Activar asistente de IA
                </p>
                <p className="text-xs text-muted-foreground">
                  Interruptor principal. Activa el botón &quot;Redactar con IA&quot; en
                  la bandeja de entrada.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Respuesta automática a mensajes entrantes
                </p>
                <p className="text-xs text-muted-foreground">
                  El bot responde automáticamente a los mensajes entrantes
                  nuevos (solo cuando ningún flujo los maneja y no hay un
                  agente asignado). Deriva a un humano cuando no puede ayudar.
                </p>
              </div>
              <Switch
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
                disabled={disabled || !isActive}
              />
            </div>

            {autoReplyEnabled && (
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  Canales con respuesta automática
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Pausa la respuesta automática en un canal sin apagarla en los
                  demás. El botón &quot;Redactar con IA&quot; sigue disponible en
                  todos los canales — esto solo controla si el bot contesta
                  solo.
                </p>
                <div className="space-y-2">
                  {TOGGLEABLE_CHANNELS.map((channel) => (
                    <div key={channel} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-foreground">
                        {CHANNEL_LABEL[channel]}
                      </span>
                      <Switch
                        checked={channelsEnabled.includes(channel)}
                        onCheckedChange={(checked) => toggleChannel(channel, checked)}
                        disabled={disabled}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ai-max">Máximo de auto-respuestas por conversación</Label>
                <p className="text-xs text-muted-foreground">
                  Después de esta cantidad de respuestas del bot en un mismo
                  hilo, el bot deja de responder.
                </p>
              </div>
              <Input
                id="ai-max"
                type="number"
                min={1}
                max={20}
                value={maxPerConversation}
                onChange={(e) =>
                  setMaxPerConversation(
                    Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                disabled={disabled || !autoReplyEnabled}
                className="w-20"
              />
            </div>

            {/* Human handoff — what the bot says + who it pings when it
                can't safely answer and hands the thread to a person. */}
            <div className="rounded-md border border-border p-3 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Derivación a un humano
                </p>
                <p className="text-xs text-muted-foreground">
                  Cuando la IA no puede responder con seguridad, envía este
                  mensaje al cliente, pausa el bot en ese chat (queda en
                  &quot;Modo humano&quot;) y avisa a tu equipo.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-handoff-msg">Mensaje para el cliente</Label>
                <Textarea
                  id="ai-handoff-msg"
                  value={handoffMessage}
                  onChange={(e) => setHandoffMessage(e.target.value)}
                  placeholder={DEFAULT_HANDOFF_MESSAGE}
                  rows={3}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo en blanco para usar el mensaje por defecto (menciona a
                  Max Patricio y su WhatsApp).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-handoff-notify">
                  Notificar a este WhatsApp{' '}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <Input
                  id="ai-handoff-notify"
                  value={handoffNotifyNumber}
                  onChange={(e) => setHandoffNotifyNumber(e.target.value)}
                  placeholder="+51 989 377 295"
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Se enviará un aviso por WhatsApp a este número para que un
                  humano atienda. Además, siempre aparece una notificación en la
                  campana para admins y propietarios. El aviso por WhatsApp solo
                  llega dentro de la ventana de 24&nbsp;h de sesión de Meta.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AiKnowledgeCard
          accountId={accountId}
          canEdit={canEdit}
          hasEmbeddingsKey={
            embeddingsKeyEdited
              ? embeddingsKey.trim().length > 0
              : hasStoredEmbeddingsKey
          }
        />

        <div className="flex items-center justify-between">
          {configured ? (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={!canEdit || removing}
              className="text-destructive hover:text-destructive"
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Quitar
            </Button>
          ) : (
            <span />
          )}

          <Button onClick={handleSave} disabled={disabled}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
