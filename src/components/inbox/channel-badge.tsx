import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

/**
 * Shared channel → (label, color) mapping. Text pills rather than
 * brand icons — avoids depending on lucide-react shipping WhatsApp/
 * Messenger/Telegram brand glyphs, which isn't guaranteed across
 * versions.
 */
export const CHANNEL_META: Record<Channel, { label: string; short: string; className: string }> = {
  whatsapp: { label: "WhatsApp", short: "WA", className: "bg-emerald-500/15 text-emerald-500" },
  messenger: { label: "Messenger", short: "FB", className: "bg-blue-500/15 text-blue-500" },
  instagram: { label: "Instagram", short: "IG", className: "bg-pink-500/15 text-pink-500" },
  telegram: { label: "Telegram", short: "TG", className: "bg-sky-500/15 text-sky-500" },
};

export function ChannelBadge({
  channel,
  className,
}: {
  channel: Channel;
  className?: string;
}) {
  const meta = CHANNEL_META[channel] ?? CHANNEL_META.whatsapp;
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex h-4 shrink-0 items-center justify-center rounded px-1 text-[9px] font-semibold leading-none",
        meta.className,
        className,
      )}
    >
      {meta.short}
    </span>
  );
}
