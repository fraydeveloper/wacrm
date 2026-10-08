"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { applyBrandCssVars, cacheBrandColors, isHexColor } from "@/lib/brand";

/**
 * Headless: mirrors the account's brand colors (migration 037) onto
 * <html> as the `--brand-*` CSS variables the "brand" theme reads, and
 * caches them so the boot script paints them before hydration next time.
 *
 * When this device never picked an accent explicitly and the account
 * has a brand color, the brand theme becomes the default — every
 * member sees the company color without touching settings.
 */
export function BrandSync() {
  const { account, profileLoading } = useAuth();
  const { theme, setTheme, hasSavedTheme } = useTheme();

  const primary = account?.brand_color ?? null;
  const secondary = account?.brand_color_secondary ?? null;

  useEffect(() => {
    if (profileLoading || !account) return;
    const colors = { primary, secondary };
    applyBrandCssVars(colors);
    cacheBrandColors(colors);

    if (!hasSavedTheme() && isHexColor(primary) && theme !== "brand") {
      setTheme("brand", { persist: false });
    }
  }, [profileLoading, account, primary, secondary, theme, setTheme, hasSavedTheme]);

  return null;
}
