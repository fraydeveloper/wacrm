'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { SECTION_META, type SettingsSection } from './settings-sections';
import { SettingsChip, StatusDot } from './settings-chip';
import { ROLE_META } from './role-meta';
import {
  CHANNELS,
  CHANNEL_STATE_META,
  type ChannelId,
  type ChannelState,
} from './channel-status';

interface OverviewCounts {
  members: number | null;
  pendingInvites: number | null;
  templates: number | null;
  templatesPending: number | null;
  tags: number | null;
  customFields: number | null;
}

/** Live-checked channels. Instagram is pinned to `coming_soon` in
 *  CHANNELS and never health-checked. */
type LiveChannelId = Extract<ChannelId, 'whatsapp' | 'messenger' | 'telegram'>;

/**
 * Collapse a config health-check response into a channel state. Both
 * /api/whatsapp/config and /api/messenger/config share this
 * `{ connected, reason }` shape, so one mapper covers both.
 */
function stateFromHealth(payload: {
  connected?: boolean;
  reason?: string;
}): ChannelState {
  if (payload.connected) return 'connected';
  if (payload.reason === 'no_config' || payload.reason === 'no_account') {
    return 'not_configured';
  }
  return 'disconnected';
}

export function SettingsOverview({
  onSelect,
}: {
  onSelect: (section: SettingsSection) => void;
}) {
  const { user, profile, accountId, accountRole, defaultCurrency, canManageMembers } =
    useAuth();
  const { mode, theme } = useTheme();

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  // Channel statuses are tracked separately: each health check decrypts a
  // token and pings Meta, which is far slower than the cheap count
  // queries. Gating them independently keeps a slow/flaky Meta round-trip
  // from blanking the rest of the landing. Instagram/Telegram aren't
  // health-checked — they render as "Próximamente" straight from CHANNELS.
  const [channels, setChannels] = useState<Record<LiveChannelId, ChannelState>>({
    whatsapp: 'loading',
    messenger: 'loading',
    telegram: 'loading',
  });

  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = user.id;

    // Cheap counts — resolve fast, render immediately.
    (async () => {
      setCountsLoading(true);
      const [membersRes, invitesRes, templatesTotal, templatesPending, tagsRes, fieldsRes] =
        await Promise.allSettled([
          fetch('/api/account/members', { cache: 'no-store' }).then((r) => r.json()),
          canManageMembers
            ? fetch('/api/account/invitations', { cache: 'no-store' }).then((r) =>
                r.json(),
              )
            : Promise.resolve(null),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'PENDING'),
          supabase
            .from('tags')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase.from('custom_fields').select('id', { count: 'exact', head: true }),
        ]);

      if (cancelled) return;

      const members =
        membersRes.status === 'fulfilled' && Array.isArray(membersRes.value?.members)
          ? membersRes.value.members.length
          : null;
      const pendingInvites =
        invitesRes.status === 'fulfilled' &&
        invitesRes.value &&
        Array.isArray(invitesRes.value.invitations)
          ? invitesRes.value.invitations.length
          : null;

      setCounts({
        members,
        pendingInvites,
        templates:
          templatesTotal.status === 'fulfilled'
            ? templatesTotal.value.count ?? null
            : null,
        templatesPending:
          templatesPending.status === 'fulfilled'
            ? templatesPending.value.count ?? null
            : null,
        tags: tagsRes.status === 'fulfilled' ? tagsRes.value.count ?? null : null,
        customFields:
          fieldsRes.status === 'fulfilled' ? fieldsRes.value.count ?? null : null,
      });
      setCountsLoading(false);
    })();

    // Channel connection status — slower, independent. Each health
    // endpoint returns `{ connected, reason }` and never throws, so a
    // failed check degrades to "Desconectado" rather than blanking.
    (async () => {
      setChannels({ whatsapp: 'loading', messenger: 'loading', telegram: 'loading' });
      const [wa, msgr, tg] = await Promise.allSettled([
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/messenger/config', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/telegram/config', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (cancelled) return;
      setChannels({
        whatsapp:
          wa.status === 'fulfilled' ? stateFromHealth(wa.value) : 'disconnected',
        messenger:
          msgr.status === 'fulfilled' ? stateFromHealth(msgr.value) : 'disconnected',
        telegram:
          tg.status === 'fulfilled' ? stateFromHealth(tg.value) : 'disconnected',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || 'Tu cuenta';
  const initial = (profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  const currencyLabel =
    CURRENCIES.find((c) => c.code === defaultCurrency)?.label ?? defaultCurrency;
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const modeLabel = mode === 'light' ? 'Claro' : 'Oscuro';

  // Per-tile loading + subtitle. `null` counts render as a graceful
  // fallback so a single failed query never blanks a tile.
  const tiles: {
    section: SettingsSection;
    loading: boolean;
    subtitle: ReactNode;
  }[] = [
    {
      section: 'members',
      loading: countsLoading,
      subtitle:
        counts?.members == null
          ? 'Ver miembros del equipo'
          : `${counts.members} miembro${counts.members === 1 ? '' : 's'}${
              counts.pendingInvites
                ? ` · ${counts.pendingInvites} invitación${
                    counts.pendingInvites === 1 ? '' : 'es'
                  } pendiente${counts.pendingInvites === 1 ? '' : 's'}`
                : ''
            }`,
    },
    {
      section: 'templates',
      loading: countsLoading,
      subtitle:
        counts?.templates == null
          ? 'Gestionar plantillas de mensajes'
          : `${counts.templates} plantilla${counts.templates === 1 ? '' : 's'}${
              counts.templatesPending
                ? ` · ${counts.templatesPending} pendiente${
                    counts.templatesPending === 1 ? '' : 's'
                  } de revisión`
                : ''
            }`,
    },
    {
      section: 'deals',
      loading: false,
      subtitle: `${defaultCurrency} — ${currencyLabel}`,
    },
    {
      section: 'fields',
      loading: countsLoading,
      subtitle:
        counts?.tags == null && counts?.customFields == null
          ? 'Etiquetas y campos personalizados'
          : `${counts?.tags ?? 0} etiqueta${counts?.tags === 1 ? '' : 's'} · ${
              counts?.customFields ?? 0
            } campo${counts?.customFields === 1 ? '' : 's'} personalizado${counts?.customFields === 1 ? '' : 's'}`,
    },
    {
      section: 'appearance',
      loading: false,
      subtitle: `Modo ${modeLabel} · Acento ${themeName}`,
    },
  ];

  return (
    <section className="animate-in fade-in-50 duration-200">
      {/* Identity */}
      <Card className="flex-row items-center gap-4 px-5 py-5">
        <Avatar size="lg" className="size-14">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xl text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-foreground">
            {displayName}
          </div>
          {profile?.email ? (
            <div className="truncate text-sm text-muted-foreground">
              {profile.email}
            </div>
          ) : null}
        </div>
        {roleMeta && RoleIcon ? (
          <SettingsChip variant={roleMeta.variant}>
            <RoleIcon />
            {roleMeta.label}
          </SettingsChip>
        ) : null}
      </Card>

      {/* Channels — connection status per messaging channel. WhatsApp +
          Messenger show a live state; Instagram/Telegram are reserved but
          not wired up yet, so they read "Próximamente". */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center gap-2 px-0.5">
          <h2 className="text-sm font-semibold text-foreground">Canales</h2>
          <span className="text-xs text-muted-foreground">
            Estado de conexión de cada red
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const state: ChannelState = ch.available
              ? channels[ch.id as LiveChannelId]
              : 'coming_soon';
            const loading = state === 'loading';
            const meta = loading ? null : CHANNEL_STATE_META[state];
            const clickable = ch.section != null && ch.available;
            return (
              <button
                key={ch.id}
                type="button"
                disabled={!clickable}
                onClick={() => ch.section && onSelect(ch.section)}
                className={cn(
                  'group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors',
                  clickable
                    ? 'hover:border-primary-soft-2 hover:bg-card-2'
                    : 'cursor-default opacity-90',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {ch.label}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {loading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" /> Cargando…
                      </>
                    ) : (
                      <>
                        {meta!.showDot ? <StatusDot tone={meta!.tone} /> : null}
                        {meta!.label}
                      </>
                    )}
                  </span>
                </span>
                {clickable ? (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ section, loading, subtitle }) => {
          const meta = SECTION_META[section];
          const Icon = meta.icon;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              className={cn(
                'group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors',
                'hover:border-primary-soft-2 hover:bg-card-2',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {meta.label}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {loading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Cargando…
                    </>
                  ) : (
                    subtitle
                  )}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
