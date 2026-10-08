/**
 * Per-account branding (migration 037): the business name, logo and
 * brand colors shown in the app chrome.
 *
 * Colors are stored as strict `#RRGGBB` (DB CHECK) and re-validated
 * here before they ever reach a CSS custom property, so a tampered
 * value can't inject CSS.
 */

/** Shown when the account has no brand name configured. */
export const DEFAULT_BRAND_NAME = "Agente TED";

/** localStorage cache so the boot script can paint brand colors before hydration. */
export const BRAND_STORAGE_KEY = "wacrm.brand";

/** CSS custom properties the `brand` theme reads (see globals.css). */
export const BRAND_CSS_VARS = {
  primary: "--brand-primary",
  primaryFg: "--brand-primary-fg",
  secondary: "--brand-secondary",
} as const;

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/** Normalize user input like "00745f" / "#00745F " → "#00745f", or null. */
export function normalizeHexColor(value: string): string | null {
  const v = value.trim().replace(/^#?/, "#").toLowerCase();
  return isHexColor(v) ? v : null;
}

/** WCAG relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** Pick black or white text — whichever contrasts more with `hex`. */
export function readableForeground(hex: string): string {
  const l = relativeLuminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastBlack = (l + 0.05) / 0.05;
  return contrastBlack >= contrastWhite ? "#111111" : "#ffffff";
}

/**
 * Write (or clear) the brand CSS variables on <html>. Only validated
 * hex strings are ever written.
 */
export function applyBrandCssVars(colors: BrandColors): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (isHexColor(colors.primary)) {
    style.setProperty(BRAND_CSS_VARS.primary, colors.primary);
    style.setProperty(BRAND_CSS_VARS.primaryFg, readableForeground(colors.primary));
  } else {
    style.removeProperty(BRAND_CSS_VARS.primary);
    style.removeProperty(BRAND_CSS_VARS.primaryFg);
  }
  if (isHexColor(colors.secondary)) {
    style.setProperty(BRAND_CSS_VARS.secondary, colors.secondary);
  } else {
    style.removeProperty(BRAND_CSS_VARS.secondary);
  }
}

export function cacheBrandColors(colors: BrandColors): void {
  try {
    if (!isHexColor(colors.primary) && !isHexColor(colors.secondary)) {
      localStorage.removeItem(BRAND_STORAGE_KEY);
    } else {
      localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(colors));
    }
  } catch {
    // Private browsing / blocked storage — colors still apply this session.
  }
}

/** Suggested palette for the brand picker (TED Innova first). */
export const BRAND_COLOR_SUGGESTIONS: { name: string; hex: string }[] = [
  { name: "Verde TED", hex: "#00745f" },
  { name: "Dorado TED", hex: "#f2b417" },
  { name: "Azul marino", hex: "#1e3a8a" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Turquesa", hex: "#0891b2" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Naranja", hex: "#ea580c" },
  { name: "Rojo", hex: "#dc2626" },
  { name: "Fucsia", hex: "#c026d3" },
  { name: "Morado", hex: "#7c3aed" },
  { name: "Grafito", hex: "#334155" },
  { name: "Café", hex: "#92400e" },
];
