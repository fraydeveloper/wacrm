"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, ImageUp, Loader2, Palette, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  BRAND_COLOR_SUGGESTIONS,
  DEFAULT_BRAND_NAME,
  normalizeHexColor,
  readableForeground,
} from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

const MAX_NAME_LEN = 60;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// Raster only — SVG can carry script and the `avatars` bucket rejects it.
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Company & brand — white-label name, logo and colors for the whole
 * account (migration 037). Admin+ only: the `accounts_update` RLS
 * policy enforces it server-side; non-admins get a read-only view.
 */
export function BrandSettings() {
  const supabase = createClient();
  const { user, accountId, account, canEditSettings, profileLoading, refreshProfile } =
    useAuth();
  const { setTheme } = useTheme();

  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(account?.brand_name ?? "");
    setPrimary(account?.brand_color ?? "");
    setSecondary(account?.brand_color_secondary ?? "");
    setLogoUrl(account?.brand_logo_url ?? null);
    setPendingLogo(null);
  }, [account]);

  useEffect(() => {
    if (!pendingLogo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingLogo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingLogo]);

  const disabled = !canEditSettings || profileLoading || saving;
  const primaryHex = primary ? normalizeHexColor(primary) : null;
  const secondaryHex = secondary ? normalizeHexColor(secondary) : null;
  const shownLogo = previewUrl ?? logoUrl;
  const shownName = name.trim() || DEFAULT_BRAND_NAME;

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Usa una imagen PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("El logo no puede pesar más de 2 MB.");
      return;
    }
    setPendingLogo(file);
  }

  async function handleSave() {
    if (!accountId || !user) return;
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LEN) {
      toast.error(`El nombre admite hasta ${MAX_NAME_LEN} caracteres.`);
      return;
    }
    if (primary && !primaryHex) {
      toast.error("El color principal debe tener el formato #RRGGBB.");
      return;
    }
    if (secondary && !secondaryHex) {
      toast.error("El color secundario debe tener el formato #RRGGBB.");
      return;
    }

    setSaving(true);
    try {
      let nextLogo = logoUrl;
      if (pendingLogo) {
        const ext =
          pendingLogo.type === "image/png"
            ? "png"
            : pendingLogo.type === "image/webp"
              ? "webp"
              : "jpg";
        // Stored under the admin's own folder in the public `avatars`
        // bucket — the existing 008 policies already allow exactly that.
        const path = `${user.id}/brand-logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingLogo, {
            cacheControl: "3600",
            upsert: false,
            contentType: pendingLogo.type,
          });
        if (upErr) throw new Error(`No se pudo subir el logo: ${upErr.message}`);
        nextLogo = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase
        .from("accounts")
        .update({
          brand_name: trimmed || null,
          brand_logo_url: nextLogo || null,
          brand_color: primaryHex,
          brand_color_secondary: secondaryHex,
        })
        .eq("id", accountId);
      if (error) {
        if (error.code === "42703") {
          throw new Error(
            "Falta aplicar la migración 037_account_branding.sql en Supabase.",
          );
        }
        throw new Error(error.message);
      }

      await refreshProfile();
      if (primaryHex) setTheme("brand");
      toast.success("Marca actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la marca");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Empresa y marca"
        description="Nombre, logo y colores de tu negocio. Se muestran a todo el equipo en la barra lateral y en el tema “Color de la empresa”."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Building2 className="size-4 text-primary" />
              Identidad
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Si lo dejas vacío se usa “{DEFAULT_BRAND_NAME}”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:max-w-sm">
              <Label htmlFor="brand-name" className="text-muted-foreground">
                Nombre del negocio
              </Label>
              <Input
                id="brand-name"
                value={name}
                maxLength={MAX_NAME_LEN}
                onChange={(e) => setName(e.target.value)}
                placeholder={DEFAULT_BRAND_NAME}
                disabled={disabled}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                  {shownLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview of a local/blob or Storage URL.
                    <img src={shownLogo} alt="Logo" className="size-full object-contain" />
                  ) : (
                    <ImageUp className="size-5 text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => fileRef.current?.click()}
                  className="border-border"
                >
                  <ImageUp className="size-4" />
                  {shownLogo ? "Cambiar logo" : "Subir logo"}
                </Button>
                {shownLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => {
                      setPendingLogo(null);
                      setLogoUrl(null);
                    }}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="size-4" />
                    Quitar
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  onChange={pickLogo}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o WEBP, máximo 2 MB. Mejor cuadrado y con fondo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Palette className="size-4 text-primary" />
              Colores de la marca
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              El color principal pinta botones, menú activo y gráficos. Cada
              persona puede elegir otro tema en Apariencia, pero por defecto verá
              este.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ColorField
              id="brand-primary"
              label="Color principal"
              value={primary}
              onChange={setPrimary}
              disabled={disabled}
            />
            <ColorField
              id="brand-secondary"
              label="Color secundario (opcional)"
              value={secondary}
              onChange={setSecondary}
              disabled={disabled}
            />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Sugerencias — clic para usar como principal, Shift+clic como secundario
              </p>
              <div className="flex flex-wrap gap-2">
                {BRAND_COLOR_SUGGESTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    disabled={disabled}
                    title={`${c.name} ${c.hex}`}
                    aria-label={`Usar ${c.name}`}
                    onClick={(e) =>
                      e.shiftKey ? setSecondary(c.hex) : setPrimary(c.hex)
                    }
                    className="size-8 rounded-full ring-1 ring-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Live preview — independent of the active theme. */}
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Vista previa</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {shownLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview only.
                    <img src={shownLogo} alt="" className="size-8 rounded-lg object-contain" />
                  ) : (
                    <span
                      className="size-8 rounded-lg"
                      style={{ background: primaryHex ?? "var(--primary)" }}
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground">{shownName}</span>
                </div>
                <span
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={
                    primaryHex
                      ? { background: primaryHex, color: readableForeground(primaryHex) }
                      : undefined
                  }
                >
                  Botón principal
                </span>
                {secondaryHex && (
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      background: secondaryHex,
                      color: readableForeground(secondaryHex),
                    }}
                  >
                    Destacado
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {canEditSettings ? (
          <Button
            onClick={handleSave}
            disabled={disabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar marca"
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo los administradores de la cuenta pueden cambiar la marca.
          </p>
        )}
      </div>
    </section>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const hex = value ? normalizeHexColor(value) : null;
  const invalid = !!value && !hex;
  return (
    <div className="grid gap-2 sm:max-w-sm">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — selector`}
          value={hex ?? "#00745f"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#00745f"
          maxLength={7}
          disabled={disabled}
          className={cn("font-mono", invalid && "border-destructive")}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange("")}
            className="text-muted-foreground"
          >
            Quitar
          </Button>
        )}
      </div>
      {invalid && (
        <p className="text-xs text-destructive">Usa el formato #RRGGBB, p. ej. #00745f</p>
      )}
    </div>
  );
}
