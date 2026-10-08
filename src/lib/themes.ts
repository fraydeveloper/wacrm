/**
 * Single source of truth for the color-theme catalog.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `html[data-theme="..."]` blocks — that file is the one we paste
 * theme tokens into. This module only carries the metadata the UI
 * (settings picker, no-flash boot script) needs.
 *
 * Adding a new theme is a two-step change:
 *   1. Append the new `html[data-theme="<id>"]` block in globals.css
 *      with every token from an existing theme (use violet as the
 *      shape reference).
 *   2. Add an entry below. The order here drives the picker grid.
 */

export const THEME_IDS = [
  "brand",
  "ted",
  "gold",
  "violet",
  "emerald",
  "cobalt",
  "sky",
  "indigo",
  "amber",
  "rose",
  "slate",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Fallback accent when the device has no saved choice and the account
 *  has no brand color yet (with a brand color, "brand" wins — see the
 *  boot script in layout.tsx and BrandSync). */
export const DEFAULT_THEME: ThemeId = "ted";

export const STORAGE_KEY = "wacrm.theme";

/**
 * MODE — the light/dark dimension, orthogonal to the accent theme.
 *
 * The CSS variables live in `src/app/globals.css` under
 * `html[data-mode="..."]` blocks (neutral surfaces only). Applied
 * at runtime via `document.documentElement.dataset.mode`. Dark is
 * the historical default and stays the app's identity; light is the
 * opt-in eye-strain-friendly alternative.
 *
 * Persisted under its own localStorage key so it composes freely
 * with the accent choice (you can run Violet-light or Violet-dark).
 */
export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const DEFAULT_MODE: Mode = "dark";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static swatch color for the picker chip. Hard-coded so the boot
   * script / picker cards don't need a getComputedStyle round trip
   * before the page settles. Must mirror `--primary` of the same
   * theme in globals.css.
   */
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "brand",
    name: "Color de la empresa",
    tagline:
      "Usa el color configurado en Configuración → Empresa y marca. Se aplica a todo el equipo.",
    swatch: "var(--brand-primary, oklch(0.526 0.247 293))",
  },
  {
    id: "ted",
    name: "Verde TED",
    tagline: "El verde institucional de TED Innova — serio y confiable.",
    swatch: "#00745f",
  },
  {
    id: "gold",
    name: "Dorado",
    tagline: "El dorado del logo — cálido y llamativo.",
    swatch: "#f2b417",
  },
  {
    id: "violet",
    name: "Violeta",
    tagline: "Seguro y algo juguetón.",
    swatch: "oklch(0.526 0.247 293)",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    tagline: "Fresco y de crecimiento, sin copiar el verde de WhatsApp.",
    swatch: "oklch(0.62 0.16 162)",
  },
  {
    id: "cobalt",
    name: "Cobalto",
    tagline: "Azul limpio, tranquilo y profesional.",
    swatch: "oklch(0.585 0.2 254)",
  },
  {
    id: "sky",
    name: "Celeste",
    tagline: "Claro y luminoso — ideal para educación y salud.",
    swatch: "#0ea5e9",
  },
  {
    id: "indigo",
    name: "Índigo",
    tagline: "Azul profundo, corporativo y elegante.",
    swatch: "#4f46e5",
  },
  {
    id: "amber",
    name: "Ámbar",
    tagline: "Cálido y amigable — ideal para pequeños negocios.",
    swatch: "oklch(0.745 0.16 65)",
  },
  {
    id: "rose",
    name: "Rosa",
    tagline: "Audaz y moderno — moda, estilo de vida, creadores.",
    swatch: "oklch(0.645 0.22 16)",
  },
  {
    id: "slate",
    name: "Grafito",
    tagline: "Sobrio y neutro — deja que el contenido destaque.",
    swatch: "#475569",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}
