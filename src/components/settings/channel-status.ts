import {
  MessageCircle,
  Send,
  Camera,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

import type { StatusTone } from './settings-chip';
import type { SettingsSection } from './settings-sections';

/**
 * Connection state for a messaging channel, surfaced in the settings
 * Overview and (as a hint) in the rail.
 *
 *   connected      → credentials saved AND a live health check passed
 *   disconnected   → configured but the health check failed / status off
 *                    (needs the user to reconnect)
 *   not_configured → no config saved yet
 *   coming_soon    → the channel exists in the data model but has no
 *                    working connection/sender yet (Instagram, Telegram).
 *                    Shown honestly rather than pretending it's set up.
 *   loading        → health check in flight
 */
export type ChannelState =
  | 'connected'
  | 'disconnected'
  | 'not_configured'
  | 'coming_soon'
  | 'loading';

export interface ChannelStateMeta {
  label: string;
  tone: StatusTone;
  /** Whether to render a live status dot before the label. */
  showDot: boolean;
}

export const CHANNEL_STATE_META: Record<
  Exclude<ChannelState, 'loading'>,
  ChannelStateMeta
> = {
  connected: { label: 'Conectado', tone: 'ok', showDot: true },
  disconnected: { label: 'Desconectado', tone: 'danger', showDot: true },
  not_configured: { label: 'No configurado', tone: 'muted', showDot: true },
  coming_soon: { label: 'Próximamente', tone: 'muted', showDot: false },
};

export type ChannelId = 'whatsapp' | 'messenger' | 'instagram' | 'telegram';

export interface ChannelMeta {
  id: ChannelId;
  label: string;
  icon: LucideIcon;
  /** Settings section to open when the card is clicked, or null when the
   *  channel has no configuration screen yet (coming soon). */
  section: SettingsSection | null;
  /** Channels with no working integration yet are pinned to
   *  `coming_soon` — the Overview never runs a health check for them. */
  available: boolean;
}

/**
 * The messaging channels shown in the Overview, in display order.
 * WhatsApp, Messenger and Telegram are live (health-checked); Instagram
 * is reserved in the data model (migration 031) but not wired up, so it
 * renders as "Próximamente".
 */
export const CHANNELS: ChannelMeta[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, section: 'whatsapp', available: true },
  { id: 'messenger', label: 'Messenger', icon: MessageSquare, section: 'messenger', available: true },
  { id: 'telegram', label: 'Telegram', icon: Send, section: 'telegram', available: true },
  { id: 'instagram', label: 'Instagram', icon: Camera, section: null, available: false },
];

/**
 * Collapse a health-check response (`{ connected, reason }` from
 * /api/whatsapp/config or /api/messenger/config) plus whether a config
 * row exists into a single channel state.
 */
export function deriveChannelState(args: {
  configured: boolean;
  connected: boolean;
}): ChannelState {
  if (!args.configured) return 'not_configured';
  return args.connected ? 'connected' : 'disconnected';
}
