import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArchiveRestore, Trash2, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { statusLabel, type Task } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({ meta: [{ title: "ארכיון משימות — אטלס" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<Task | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("המשימה שוחזרה");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נמחקה לצמיתות");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">ארכיון משימות</h1>
          <p className="text-sm text-muted-foreground">סה"כ {tasks.length}</p>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rotate-180" /> חזרה למשימות
        </Link>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">הארכיון ריק.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{t.title}</h3>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>עדיפות: {statusLabel[t.priority]}</span>
                  {t.due_date && <span>יעד: {format(parseISO(t.due_date), "d MMM yyyy")}</span>}
                  {t.archived_at && (
                    <span>בארכיון מ‍־ {format(parseISO(t.archived_at), "d MMM yyyy")}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => restore.mutate(t.id)}>
                  <ArchiveRestore className="ms-1.5 h-4 w-4" /> שחזור
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        onConfirm={() => toDelete && purge.mutate(toDelete.id)}
        description={`המשימה "${toDelete?.title ?? ""}" תימחק לצמיתות.`}
      />
    </div>
  );
}