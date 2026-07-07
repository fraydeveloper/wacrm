'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  BookOpen,
  Upload,
  Table2,
  Link2,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

type DocSourceType = 'manual' | 'file' | 'google_sheet';

interface DocSummary {
  id: string;
  title: string;
  updated_at: string;
  source_type: DocSourceType;
  last_synced_at: string | null;
}

const SOURCE_LABEL: Record<DocSourceType, string> = {
  manual: 'Pegado',
  file: 'Archivo',
  google_sheet: 'Hoja',
};

/** Editor target: 'new' when creating, a doc id when editing, null when closed. */
type EditTarget = 'new' | string | null;

export function AiKnowledgeCard({
  accountId,
  canEdit,
  hasEmbeddingsKey,
}: {
  accountId: string | null;
  canEdit: boolean;
  hasEmbeddingsKey: boolean;
}) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedAccountIdRef = useRef<string | null>(null);

  // Google Sheets — Service Account connection state.
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleFormOpen, setGoogleFormOpen] = useState(false);
  const [googleJson, setGoogleJson] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);

  // "Add from Google Sheet" form.
  const [sheetFormOpen, setSheetFormOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetRange, setSheetRange] = useState('Sheet1');
  const [sheetTitle, setSheetTitle] = useState('');
  const [addingSheet, setAddingSheet] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/knowledge');
      const data = await res.json();
      if (res.ok) setDocs(data.documents ?? []);
      else toast.error(data.error ?? 'No se pudo cargar la base de conocimiento');
    } catch {
      toast.error('No se pudo cargar la base de conocimiento');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGoogleConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/google-sheets/config');
      const data = await res.json();
      setGoogleConnected(Boolean(data.connected));
      setGoogleEmail(data.service_account_email ?? null);
    } catch {
      // Non-fatal — the "Add from Google Sheet" action will surface the
      // real error if the account truly isn't connected.
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchDocs();
    void fetchGoogleConfig();
  }, [accountId, fetchDocs, fetchGoogleConfig]);

  const openNew = () => {
    setEditing('new');
    setTitle('');
    setContent('');
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo abrir el documento');
        return;
      }
      setEditing(id);
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
    } catch {
      toast.error('No se pudo abrir el documento');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setContent('');
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('El título y el contenido son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(
        isNew ? '/api/ai/knowledge' : `/api/ai/knowledge/${editing}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim() }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        // A 200 with `warning` means saved but indexing degraded.
        if (data.warning) toast.warning(data.warning);
        else toast.success(isNew ? 'Documento agregado.' : 'Documento actualizado.');
        cancelEdit();
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'No se pudo guardar.');
      }
    } catch {
      toast.error('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Documento eliminado.');
        setDocs((d) => d.filter((x) => x.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'No se pudo eliminar.');
      }
    } catch {
      toast.error('No se pudo eliminar.');
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/ai/knowledge/reindex', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Se reindexaron ${data.reindexed} documento(s).`);
      } else {
        toast.error(data.error ?? 'Falló la reindexación.');
      }
    } catch {
      toast.error('Falló la reindexación.');
    } finally {
      setReindexing(false);
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ai/knowledge/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) toast.warning(data.warning);
        else toast.success(`"${data.title ?? file.name}" agregado.`);
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Falló la subida.');
      }
    } catch {
      toast.error('Falló la subida.');
    } finally {
      setUploading(false);
    }
  };

  const saveGoogleConfig = async () => {
    if (!googleJson.trim()) {
      toast.error('Pega la clave JSON de la cuenta de servicio.');
      return;
    }
    setSavingGoogle(true);
    try {
      const res = await fetch('/api/ai/google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_account_json: googleJson.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Google Sheets conectado.');
        setGoogleConnected(true);
        setGoogleEmail(data.service_account_email ?? null);
        setGoogleJson('');
        setGoogleFormOpen(false);
      } else {
        toast.error(data.error ?? 'No se pudo conectar.');
      }
    } catch {
      toast.error('No se pudo conectar.');
    } finally {
      setSavingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm('¿Desconectar Google Sheets? Los documentos ya sincronizados conservan su contenido hasta que vuelvas a sincronizar.')) {
      return;
    }
    try {
      const res = await fetch('/api/ai/google-sheets/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Google Sheets desconectado.');
        setGoogleConnected(false);
        setGoogleEmail(null);
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'No se pudo desconectar.');
      }
    } catch {
      toast.error('No se pudo desconectar.');
    }
  };

  const addFromSheet = async () => {
    if (!sheetUrl.trim() || !sheetTitle.trim()) {
      toast.error('La URL/ID de la hoja de cálculo y el título son obligatorios.');
      return;
    }
    setAddingSheet(true);
    try {
      const res = await fetch('/api/ai/knowledge/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_id_or_url: sheetUrl.trim(),
          sheet_range: sheetRange.trim() || 'Sheet1',
          title: sheetTitle.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) toast.warning(data.warning);
        else toast.success('Hoja agregada.');
        setSheetFormOpen(false);
        setSheetUrl('');
        setSheetRange('Sheet1');
        setSheetTitle('');
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'No se pudo agregar la hoja.');
      }
    } catch {
      toast.error('No se pudo agregar la hoja.');
    } finally {
      setAddingSheet(false);
    }
  };

  const syncSheet = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/ai/knowledge/${id}/sync-sheet`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) toast.warning(data.warning);
        else toast.success('Sincronizado.');
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Falló la sincronización.');
      }
    } catch {
      toast.error('Falló la sincronización.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" /> Base de conocimiento
        </CardTitle>
        <CardDescription>
          Agrega preguntas frecuentes, políticas o detalles de productos. El
          asistente recupera las partes relevantes al redactar y
          auto-responder, para poder contestar en lugar de derivar.
          {hasEmbeddingsKey
            ? ' La búsqueda semántica está activada (clave de embeddings configurada).'
            : ' Usando búsqueda por palabras clave — agrega una clave de embeddings arriba para búsqueda semántica.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center py-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            {/* Google Sheets — Service Account connection */}
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Table2 className="h-4 w-4 text-primary" />
                  Google Sheets
                </div>
                {googleConnected ? (
                  canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => void disconnectGoogle()}>
                      <Unlink className="mr-2 h-4 w-4" /> Desconectar
                    </Button>
                  )
                ) : (
                  canEdit &&
                  !googleFormOpen && (
                    <Button variant="outline" size="sm" onClick={() => setGoogleFormOpen(true)}>
                      <Link2 className="mr-2 h-4 w-4" /> Conectar
                    </Button>
                  )
                )}
              </div>
              {googleConnected ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Conectado como <code className="text-foreground">{googleEmail}</code>. Comparte
                  cualquier hoja que quieras indexar con este correo, como si fuera un colaborador.
                </p>
              ) : googleFormOpen ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Pega la clave JSON de la cuenta de servicio desde Google Cloud Console (IAM &amp;
                    Admin → Cuentas de servicio → Claves).
                  </p>
                  <Textarea
                    value={googleJson}
                    onChange={(e) => setGoogleJson(e.target.value)}
                    placeholder='{ "client_email": "...", "private_key": "..." }'
                    rows={4}
                    disabled={savingGoogle}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setGoogleFormOpen(false);
                        setGoogleJson('');
                      }}
                      disabled={savingGoogle}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void saveGoogleConfig()} disabled={savingGoogle}>
                      {savingGoogle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Conectar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  No conectado. Conecta una cuenta de servicio para traer datos de la hoja de
                  cálculo a la base de conocimiento.
                </p>
              )}
            </div>

            {docs.length === 0 && editing === null && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay documentos.
              </p>
            )}

            {docs.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {SOURCE_LABEL[doc.source_type]}
                      </span>
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {doc.title}
                      </span>
                      {doc.source_type === 'google_sheet' && doc.last_synced_at && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          sincronizado {new Date(doc.last_synced_at).toLocaleString()}
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <span className="flex shrink-0 gap-1">
                        {doc.source_type === 'google_sheet' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => void syncSheet(doc.id)}
                            disabled={syncingId === doc.id}
                            title="Sincronizar ahora"
                          >
                            {syncingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => void openEdit(doc.id)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => void remove(doc.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,.pdf"
              className="hidden"
              onChange={(e) => void handleFileChosen(e)}
            />

            {editing !== null ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label htmlFor="kb-title">Título</Label>
                  <Input
                    id="kb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ej. Política de cambios y devoluciones"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-content">Contenido</Label>
                  <Textarea
                    id="kb-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Pega la respuesta de la FAQ, el texto de la política o los detalles del producto…"
                    rows={8}
                    disabled={saving}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar documento
                  </Button>
                </div>
              </div>
            ) : sheetFormOpen ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-title">Título</Label>
                  <Input
                    id="kb-sheet-title"
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    placeholder="ej. Catálogo de productos"
                    disabled={addingSheet}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-url">URL o ID de la hoja de cálculo</Label>
                  <Input
                    id="kb-sheet-url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    disabled={addingSheet}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-range">Hoja / rango</Label>
                  <Input
                    id="kb-sheet-range"
                    value={sheetRange}
                    onChange={(e) => setSheetRange(e.target.value)}
                    placeholder="Sheet1"
                    disabled={addingSheet}
                  />
                  <p className="text-xs text-muted-foreground">
                    El nombre de la pestaña (ej. &quot;Sheet1&quot;) o un rango como &quot;Sheet1!A:D&quot;.
                    La primera fila se trata como encabezados de columna.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSheetFormOpen(false);
                      setSheetUrl('');
                      setSheetRange('Sheet1');
                      setSheetTitle('');
                    }}
                    disabled={addingSheet}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={() => void addFromSheet()} disabled={addingSheet || !googleConnected}>
                    {addingSheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Agregar hoja
                  </Button>
                </div>
                {!googleConnected && (
                  <p className="text-xs text-amber-500">
                    Primero conecta Google Sheets arriba.
                  </p>
                )}
              </div>
            ) : (
              canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" /> Agregar documento
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Subir archivo
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSheetFormOpen(true)}>
                      <Table2 className="mr-2 h-4 w-4" /> Agregar desde Google Sheet
                    </Button>
                  </div>
                  {hasEmbeddingsKey && docs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reindex}
                      disabled={reindexing}
                      title="Regenera los embeddings de todos los documentos (ej. después de agregar una clave de embeddings)"
                    >
                      {reindexing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reindexar
                    </Button>
                  )}
                </div>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
