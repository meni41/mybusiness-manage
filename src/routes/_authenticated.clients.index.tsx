import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { CLIENT_STATUSES, statusLabel, type Client } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "לקוחות — אטלס" }] }),
  component: ClientsPage,
});

const statusColor: Record<string, string> = {
  quote: "bg-info/15 text-info border-info/30",
  in_progress: "bg-success/15 text-success border-success/30",
  archived: "bg-secondary text-secondary-foreground border-border",
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dialog, setDialog] = useState<{ open: boolean; client?: Client | null }>({ open: false });
  const [toDelete, setToDelete] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return [c.name, c.email, c.company, c.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [clients, search, status]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הלקוח נמחק");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToDelete(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">לקוחות</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} מתוך {clients.length}
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, client: null })}>
          <Plus className="ms-2 h-4 w-4" /> לקוח חדש
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, דוא&quot;ל, חברה…"
            className="pe-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {CLIENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {clients.length === 0 ? "אין לקוחות עדיין. הוסיפו את הראשון." : "לא נמצאו תוצאות."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="group relative overflow-hidden p-5 transition hover:border-primary/40 hover:shadow-md"
            >
              <Link
                to="/clients/$id"
                params={{ id: c.id }}
                className="absolute inset-0"
                aria-label={`פתיחת ${c.name}`}
              />
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{c.name}</h3>
                  {c.company && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {c.company}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={statusColor[c.status]}>
                  {statusLabel[c.status]}
                </Badge>
              </div>
              <div className="relative mt-4 space-y-1 text-xs text-muted-foreground">
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3" /> {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </p>
                )}
              </div>
              <div className="relative mt-4 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setDialog({ open: true, client: c });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setToDelete(c);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ClientFormDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog({ open: v, client: v ? dialog.client : null })}
        client={dialog.client}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הלקוח ואת כל התיקיות, הפריטים והמשימות שלו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete.id)}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}