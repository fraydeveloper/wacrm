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
  manual: 'Pasted',
  file: 'File',
  google_sheet: 'Sheet',
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
      else toast.error(data.error ?? 'Failed to load knowledge base');
    } catch {
      toast.error('Failed to load knowledge base');
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
        toast.error(data.error ?? 'Failed to open document');
        return;
      }
      setEditing(id);
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
    } catch {
      toast.error('Failed to open document');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setContent('');
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required.');
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
        else toast.success(isNew ? 'Document added.' : 'Document updated.');
        cancelEdit();
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document removed.');
        setDocs((d) => d.filter((x) => x.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to remove.');
      }
    } catch {
      toast.error('Failed to remove.');
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/ai/knowledge/reindex', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Reindexed ${data.reindexed} document(s).`);
      } else {
        toast.error(data.error ?? 'Reindex failed.');
      }
    } catch {
      toast.error('Reindex failed.');
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
        else toast.success(`"${data.title ?? file.name}" added.`);
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Upload failed.');
      }
    } catch {
      toast.error('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const saveGoogleConfig = async () => {
    if (!googleJson.trim()) {
      toast.error('Paste the Service Account JSON key.');
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
        toast.success('Google Sheets connected.');
        setGoogleConnected(true);
        setGoogleEmail(data.service_account_email ?? null);
        setGoogleJson('');
        setGoogleFormOpen(false);
      } else {
        toast.error(data.error ?? 'Failed to connect.');
      }
    } catch {
      toast.error('Failed to connect.');
    } finally {
      setSavingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm('Disconnect Google Sheets? Already-synced documents keep their content until you sync again.')) {
      return;
    }
    try {
      const res = await fetch('/api/ai/google-sheets/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Google Sheets disconnected.');
        setGoogleConnected(false);
        setGoogleEmail(null);
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to disconnect.');
      }
    } catch {
      toast.error('Failed to disconnect.');
    }
  };

  const addFromSheet = async () => {
    if (!sheetUrl.trim() || !sheetTitle.trim()) {
      toast.error('Spreadsheet URL/ID and title are required.');
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
        else toast.success('Sheet added.');
        setSheetFormOpen(false);
        setSheetUrl('');
        setSheetRange('Sheet1');
        setSheetTitle('');
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Failed to add sheet.');
      }
    } catch {
      toast.error('Failed to add sheet.');
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
        else toast.success('Synced.');
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Sync failed.');
      }
    } catch {
      toast.error('Sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" /> Knowledge base
        </CardTitle>
        <CardDescription>
          Add FAQs, policies, or product details. The assistant retrieves the
          relevant pieces when drafting and auto-replying, so it can answer
          instead of handing off.
          {hasEmbeddingsKey
            ? ' Semantic search is on (embeddings key set).'
            : ' Using keyword search — add an embeddings key above for semantic search.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center py-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
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
                      <Unlink className="mr-2 h-4 w-4" /> Disconnect
                    </Button>
                  )
                ) : (
                  canEdit &&
                  !googleFormOpen && (
                    <Button variant="outline" size="sm" onClick={() => setGoogleFormOpen(true)}>
                      <Link2 className="mr-2 h-4 w-4" /> Connect
                    </Button>
                  )
                )}
              </div>
              {googleConnected ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Connected as <code className="text-foreground">{googleEmail}</code>. Share any
                  sheet you want indexed with this email, like a collaborator.
                </p>
              ) : googleFormOpen ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste the Service Account JSON key from Google Cloud Console (IAM &amp;
                    Admin → Service Accounts → Keys).
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
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void saveGoogleConfig()} disabled={savingGoogle}>
                      {savingGoogle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Connect
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not connected. Connect a Service Account to pull spreadsheet data into the
                  knowledge base.
                </p>
              )}
            </div>

            {docs.length === 0 && editing === null && (
              <p className="text-sm text-muted-foreground">
                No documents yet.
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
                          synced {new Date(doc.last_synced_at).toLocaleString()}
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
                            title="Sync now"
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
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => void remove(doc.id)}
                          title="Delete"
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
                  <Label htmlFor="kb-title">Title</Label>
                  <Input
                    id="kb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Returns & refunds policy"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-content">Content</Label>
                  <Textarea
                    id="kb-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the FAQ answer, policy text, or product details…"
                    rows={8}
                    disabled={saving}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save document
                  </Button>
                </div>
              </div>
            ) : sheetFormOpen ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-title">Title</Label>
                  <Input
                    id="kb-sheet-title"
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    placeholder="e.g. Product catalog"
                    disabled={addingSheet}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-url">Spreadsheet URL or ID</Label>
                  <Input
                    id="kb-sheet-url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    disabled={addingSheet}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-sheet-range">Sheet / range</Label>
                  <Input
                    id="kb-sheet-range"
                    value={sheetRange}
                    onChange={(e) => setSheetRange(e.target.value)}
                    placeholder="Sheet1"
                    disabled={addingSheet}
                  />
                  <p className="text-xs text-muted-foreground">
                    The tab name (e.g. &quot;Sheet1&quot;) or a range like &quot;Sheet1!A:D&quot;.
                    The first row is treated as column headers.
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
                    Cancel
                  </Button>
                  <Button onClick={() => void addFromSheet()} disabled={addingSheet || !googleConnected}>
                    {addingSheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add sheet
                  </Button>
                </div>
                {!googleConnected && (
                  <p className="text-xs text-amber-500">
                    Connect Google Sheets above first.
                  </p>
                )}
              </div>
            ) : (
              canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" /> Add document
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
                      Upload file
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSheetFormOpen(true)}>
                      <Table2 className="mr-2 h-4 w-4" /> Add from Google Sheet
                    </Button>
                  </div>
                  {hasEmbeddingsKey && docs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reindex}
                      disabled={reindexing}
                      title="Re-embed all documents (e.g. after adding an embeddings key)"
                    >
                      {reindexing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reindex
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
