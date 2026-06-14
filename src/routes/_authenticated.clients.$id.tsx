import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  FolderPlus,
  Folder,
  StickyNote,
  Link as LinkIcon,
  Plus,
  Trash2,
  Mail,
  Phone,
  Building2,
  Pencil,
  FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { QuoteEditorDialog } from "@/components/quote-editor-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { statusLabel, type Client, type Folder as FolderT, type FolderItem } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "לקוח — אטלס" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [folderDialog, setFolderDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; folderId?: string; kind?: "note" | "link" }>({ open: false });
  const [editClient, setEditClient] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderT | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FolderItem | null>(null);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Client;
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FolderT[];
    },
  });

  const currentFolderId = activeFolder ?? folders[0]?.id ?? null;

  const { data: items = [] } = useQuery({
    queryKey: ["folder_items", currentFolderId],
    queryFn: async () => {
      if (!currentFolderId) return [] as FolderItem[];
      const { data, error } = await supabase
        .from("folder_items")
        .select("*")
        .eq("folder_id", currentFolderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FolderItem[];
    },
    enabled: !!currentFolderId,
  });

  const createFolder = useMutation({
    mutationFn: async (vals: { name: string; description: string }) => {
      const schema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(500) });
      const p = schema.safeParse(vals);
      if (!p.success) throw new Error(p.error.issues[0].message);
      const { error } = await supabase
        .from("folders")
        .insert({ name: p.data.name, description: p.data.description || null, client_id: id, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("התיקייה נוצרה");
      qc.invalidateQueries({ queryKey: ["folders", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setFolderDialog(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const deleteFolder = useMutation({
    mutationFn: async (fid: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", fid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("התיקייה נמחקה");
      qc.invalidateQueries({ queryKey: ["folders", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setActiveFolder(null);
    },
  });

  const createItem = useMutation({
    mutationFn: async (vals: { title: string; content: string; url: string; kind: "note" | "link"; folderId: string }) => {
      const schema = z.object({
        title: z.string().trim().min(1).max(120),
        content: z.string().trim().max(5000),
        url: z.string().trim().max(1000),
      });
      const p = schema.safeParse(vals);
      if (!p.success) throw new Error(p.error.issues[0].message);
      if (vals.kind === "link") {
        try {
          new URL(p.data.url);
        } catch {
          throw new Error("יש להזין כתובת URL תקינה");
        }
      }
      const { error } = await supabase.from("folder_items").insert({
        folder_id: vals.folderId,
        user_id: user!.id,
        kind: vals.kind,
        title: p.data.title,
        content: vals.kind === "note" ? p.data.content || null : null,
        url: vals.kind === "link" ? p.data.url : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נוסף בהצלחה");
      qc.invalidateQueries({ queryKey: ["folder_items", currentFolderId] });
      setItemDialog({ open: false });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const deleteItem = useMutation({
    mutationFn: async (iid: string) => {
      const { error } = await supabase.from("folder_items").delete().eq("id", iid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder_items", currentFolderId] }),
  });

  if (!client) {
    return <p className="text-sm text-muted-foreground">טוען…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rotate-180" /> חזרה ללקוחות
        </Link>
        <Button variant="outline" onClick={() => setEditClient(true)}>
          <Pencil className="ms-2 h-4 w-4" /> עריכת לקוח
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-6 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-2xl font-semibold text-primary-foreground">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.company && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {client.company}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant="outline">{statusLabel[client.status]}</Badge>
        </CardContent>
        {client.notes && (
          <CardContent className="border-t pt-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {client.notes}
          </CardContent>
        )}
      </Card>

      {client.status === "quote" && (
        <div className="flex justify-end">
          <Button onClick={() => setQuoteDialog(true)}>
            <FileDown className="ms-2 h-4 w-4" /> הנפק הצעת מחיר
          </Button>
        </div>
      )}

      <FinanceSection client={client} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">פרויקטים / תיקיות</CardTitle>
          <Button size="sm" onClick={() => setFolderDialog(true)}>
            <FolderPlus className="ms-2 h-4 w-4" /> תיקייה חדשה
          </Button>
        </CardHeader>
        <CardContent>
          {folders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              אין תיקיות עדיין. צרו תיקייה כדי לארגן הערות וקישורים.
            </p>
          ) : (
            <Tabs
              value={currentFolderId ?? undefined}
              onValueChange={(v) => setActiveFolder(v)}
              className="w-full"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                {folders.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="gap-1.5">
                    <Folder className="h-3.5 w-3.5" />
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {folders.map((f) => (
                <TabsContent key={f.id} value={f.id} className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {f.description && (
                        <p className="text-sm text-muted-foreground">{f.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setItemDialog({ open: true, folderId: f.id, kind: "note" })}
                      >
                        <StickyNote className="ms-1.5 h-4 w-4" /> הערה
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setItemDialog({ open: true, folderId: f.id, kind: "link" })}
                      >
                        <LinkIcon className="ms-1.5 h-4 w-4" /> קישור
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFolderToDelete(f)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                      ריק. הוסיפו הערה או קישור.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((it) => (
                        <li
                          key={it.id}
                          className="group flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {it.kind === "note" ? (
                                <StickyNote className="h-4 w-4 text-warning" />
                              ) : (
                                <LinkIcon className="h-4 w-4 text-info" />
                              )}
                              <span className="font-medium">{it.title}</span>
                            </div>
                            {it.kind === "note" && it.content && (
                              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                                {it.content}
                              </p>
                            )}
                            {it.kind === "link" && it.url && (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 block truncate text-sm text-primary hover:underline"
                              >
                                {it.url}
                              </a>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="opacity-0 transition group-hover:opacity-100"
                            onClick={() => setItemToDelete(it)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <FolderDialog
        open={folderDialog}
        onOpenChange={setFolderDialog}
        onSubmit={(v) => createFolder.mutate(v)}
        busy={createFolder.isPending}
      />

      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(v) => setItemDialog({ open: v })}
        kind={itemDialog.kind ?? "note"}
        onSubmit={(v) =>
          itemDialog.folderId &&
          createItem.mutate({ ...v, folderId: itemDialog.folderId, kind: itemDialog.kind ?? "note" })
        }
        busy={createItem.isPending}
      />

      <ClientFormDialog open={editClient} onOpenChange={setEditClient} client={client} />

      <QuoteEditorDialog open={quoteDialog} onOpenChange={setQuoteDialog} client={client} />

      <ConfirmDialog
        open={!!folderToDelete}
        onOpenChange={(v) => !v && setFolderToDelete(null)}
        onConfirm={() => {
          if (folderToDelete) {
            deleteFolder.mutate(folderToDelete.id);
            setFolderToDelete(null);
          }
        }}
        description={`התיקייה "${folderToDelete?.name ?? ""}" וכל הפריטים שבתוכה יימחקו.`}
      />

      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(v) => !v && setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteItem.mutate(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        description={`"${itemToDelete?.title ?? ""}" יימחק.`}
      />
    </div>
  );
}

function FolderDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { name: string; description: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName("");
          setDescription("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>תיקייה חדשה</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, description });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="fname">שם *</Label>
            <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fdesc">תיאור</Label>
            <Textarea id="fdesc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "שומר…" : "יצירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function FinanceSection({ client }: { client: Client }) {
  const qc = useQueryClient();
  const [total, setTotal] = useState<string>(String(client.total_amount ?? 0));
  const [paid, setPaid] = useState<string>(String(client.amount_paid ?? 0));
  const [meters, setMeters] = useState<string>(
    client.quote_meters != null ? String(client.quote_meters) : "",
  );
  const [rate, setRate] = useState<string>(String(client.quote_rate ?? 80));

  useEffect(() => {
    setTotal(String(client.total_amount ?? 0));
    setPaid(String(client.amount_paid ?? 0));
    setMeters(client.quote_meters != null ? String(client.quote_meters) : "");
    setRate(String(client.quote_rate ?? 80));
  }, [client.id, client.total_amount, client.amount_paid, client.quote_meters, client.quote_rate]);

  const totalNum = Number(total) || 0;
  const paidNum = Number(paid) || 0;
  const remaining = Math.max(0, totalNum - paidNum);

  const metersNum = Number(meters) || 0;
  const rateNum = Number(rate) || 0;
  const quoteTotal = useMemo(() => metersNum * rateNum, [metersNum, rateNum]);

  const m1 = totalNum * 0.35;
  const m2 = totalNum * 0.35;
  const m3 = totalNum * 0.30;

  const save = useMutation({
    mutationFn: async (payload: Partial<Client>) => {
      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נשמר");
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">מעקב כספי ללקוח</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {client.status === "quote" && (
          <div className="space-y-4 rounded-lg border border-dashed p-4">
            <div>
              <h3 className="text-sm font-semibold">מחשבון הצעת מחיר</h3>
              <p className="text-xs text-muted-foreground">
                מחושב לפי מספר מטרים × תעריף למטר.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="meters">מספר מטרים</Label>
                <Input
                  id="meters"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={meters}
                  onChange={(e) => setMeters(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">תעריף למטר (₪)</Label>
                <Input
                  id="rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>סה״כ לתשלום</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
                  {formatILS(quoteTotal)}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  save.mutate({
                    quote_meters: metersNum,
                    quote_rate: rateNum,
                  })
                }
                disabled={save.isPending}
              >
                שמירת חישוב
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setTotal(String(quoteTotal));
                  save.mutate({
                    quote_meters: metersNum,
                    quote_rate: rateNum,
                    total_amount: quoteTotal,
                  });
                }}
                disabled={save.isPending || quoteTotal <= 0}
              >
                החל כסכום לתשלום
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="total">סכום לתשלום (₪)</Label>
            <Input
              id="total"
              type="number"
              inputMode="decimal"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid">כמה שולם (₪)</Label>
            <Input
              id="paid"
              type="number"
              inputMode="decimal"
              min={0}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>יתרת תשלום</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
              {formatILS(remaining)}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() =>
              save.mutate({ total_amount: totalNum, amount_paid: paidNum })
            }
            disabled={save.isPending}
          >
            שמירת סכומים
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">חלוקה לתשלומים</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <MilestoneCard label="תשלום ראשון (35%)" value={m1} />
            <MilestoneCard label="תשלום שני (35%)" value={m2} />
            <MilestoneCard label="תשלום שלישי (30%)" value={m3} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MilestoneCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatILS(value)}</p>
    </div>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  kind,
  onSubmit,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "note" | "link";
  onSubmit: (v: { title: string; content: string; url: string }) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setTitle("");
          setContent("");
          setUrl("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "note" ? "הערה חדשה" : "קישור חדש"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ title, content, url });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="ititle">כותרת *</Label>
            <Input id="ititle" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          {kind === "note" ? (
            <div className="space-y-2">
              <Label htmlFor="icontent">תוכן</Label>
              <Textarea id="icontent" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="iurl">כתובת URL *</Label>
              <Input
                id="iurl"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "שומר…" : "הוספה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}