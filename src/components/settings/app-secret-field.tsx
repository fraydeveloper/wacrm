'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Optional "own Meta app" App Secret, shared by the WhatsApp and
 * Messenger settings forms. Blank keeps whatever is stored; the
 * "use the platform app" button clears it (back to META_APP_SECRET).
 * The stored value is never sent back to the browser in clear text.
 */
export function AppSecretField({
  value,
  onChange,
  hasStoredSecret,
  clearRequested,
  onClearRequestedChange,
}: {
  value: string;
  onChange: (value: string) => void;
  hasStoredSecret: boolean;
  clearRequested: boolean;
  onClearRequestedChange: (clear: boolean) => void;
}) {
  const usingOwnApp = hasStoredSecret && !clearRequested;

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">
        App Secret de tu propia app de Meta
        <span className="ml-1 text-muted-foreground">(opcional)</span>
      </Label>
      <Input
        type="password"
        autoComplete="off"
        placeholder={
          usingOwnApp
            ? 'Guardado — déjalo vacío para mantenerlo'
            : '32 caracteres de Meta → Configuración de la app → Básica'
        }
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value) onClearRequestedChange(false);
        }}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-mono"
      />
      <p className="text-xs text-muted-foreground leading-relaxed">
        {usingOwnApp
          ? 'Esta cuenta usa su propia app de Meta: los webhooks se verifican con este App Secret.'
          : clearRequested
            ? 'Al guardar se quitará el App Secret propio y se usará la app de Meta de la plataforma.'
            : 'Déjalo vacío si conectaste el número o la Página a la app de Meta de la plataforma. Complétalo solo si usas tu propia app de Meta y apuntaste su webhook a esta URL.'}
      </p>
      {hasStoredSecret && !clearRequested && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onChange('');
            onClearRequestedChange(true);
          }}
        >
          Usar la app de Meta de la plataforma
        </Button>
      )}
    </div>
  );
}

/** Payload fields for POST /api/{whatsapp,messenger}/config. */
export function appSecretPayload(value: string, clearRequested: boolean) {
  if (clearRequested) return { clear_app_secret: true };
  return value.trim() ? { app_secret: value.trim() } : {};
}
