import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STAGES,
  statusLabel,
  type Client,
  type Task,
} from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "משימות — אטלס" }] }),
  component: TasksPage,
});

const columnTint: Record<string, string> = {
  todo: "border-t-info",
  in_progress: "border-t-warning",
  done: "border-t-success",
};

const priorityBadge: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning-foreground border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const priorityCardClass: Record<string, string> = {
  high: "border-r-4 border-r-[#EF4444] bg-[#EF4444]/5",
  medium: "border-r-4 border-r-[#F59E0B] bg-[#F59E0B]/5",
  low: "border-r-4 border-r-[#10B981] bg-[#10B981]/5",
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  due_date: string;
  priority: (typeof TASK_PRIORITIES)[number];
  status: (typeof TASK_STATUSES)[number];
  client_id: string;
  stage: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  due_date: "",
  priority: "medium",
  status: "todo",
  client_id: "none",
  stage: "none",
};

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toArchive, setToArchive] = useState<Task | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name");
      if (error) throw error;
      return data as Pick<Client, "id" | "name">[];
    },
  });

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const schema = z.object({
        title: z.string().trim().min(1, "Title required").max(160),
        description: z.string().trim().max(2000),
      });
      const p = schema.safeParse({ title: f.title, description: f.description });
      if (!p.success) throw new Error(p.error.issues[0].message);
      const payload = {
        title: p.data.title,
        description: p.data.description || null,
        due_date: f.due_date || null,
        priority: f.priority,
        status: f.status,
        client_id: f.client_id === "none" ? null : f.client_id,
        stage: f.stage === "none" ? null : f.stage,
      };
      if (f.id) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("המשימה נשמרה");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDialog(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: (typeof TASK_STATUSES)[number] }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("המשימה הועברה לארכיון");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks", "archived"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToArchive(null);
    },
  });

  const openNew = () => {
    setForm(emptyForm);
    setDialog(true);
  };

  const openEdit = (t: Task) => {
    setForm({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      due_date: t.due_date ?? "",
      priority: t.priority,
      status: t.status,
      client_id: t.client_id ?? "none",
      stage: (t as Task & { stage: string | null }).stage ?? "none",
    });
    setDialog(true);
  };

  const filteredTasks = useMemo(() => {
    if (stageFilter === "all") return tasks;
    if (stageFilter === "none")
      return tasks.filter((t) => !(t as Task & { stage: string | null }).stage);
    return tasks.filter(
      (t) => (t as Task & { stage: string | null }).stage === stageFilter,
    );
  }, [tasks, stageFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">משימות</h1>
          <p className="text-sm text-muted-foreground">סה"כ {tasks.length}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="ms-2 h-4 w-4" /> משימה חדשה
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">סינון לפי שלב:</Label>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 w-[260px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השלבים</SelectItem>
            <SelectItem value="none">ללא שלב</SelectItem>
            {TASK_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TASK_STATUSES.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col);
          return (
            <Card key={col} className={`border-t-4 ${columnTint[col]} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {statusLabel[col]}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                    ריק
                  </p>
                ) : (
                  colTasks.map((t) => {
                    const overdue =
                      t.due_date && t.status !== "done" && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
                    const today = t.due_date && isToday(parseISO(t.due_date));
                    return (
                      <div
                        key={t.id}
                        className={`group rounded-lg border border-border bg-card p-3 transition hover:shadow-sm ${priorityCardClass[t.priority] ?? ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium leading-snug">{t.title}</h3>
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge[t.priority]}`}
                          >
                            {statusLabel[t.priority]}
                          </span>
                        </div>
                        {t.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                        {(t as Task & { stage: string | null }).stage && (
                          <div className="mt-2 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {(t as Task & { stage: string | null }).stage}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {t.client_id && clientMap[t.client_id] && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                              {clientMap[t.client_id]}
                            </span>
                          )}
                          {t.due_date && (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                overdue ? "text-destructive" : today ? "text-warning" : ""
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(t.due_date), "d MMM")}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Select
                            value={t.status}
                            onValueChange={(v) =>
                              updateStatus.mutate({ id: t.id, status: v as (typeof TASK_STATUSES)[number] })
                            }
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {statusLabel[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex opacity-0 transition group-hover:opacity-100">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setToArchive(t)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <TaskDialog
        open={dialog}
        onOpenChange={setDialog}
        form={form}
        setForm={setForm}
        clients={clients}
        onSave={() => save.mutate(form)}
        busy={save.isPending}
      />

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(v) => !v && setToArchive(null)}
        onConfirm={() => toArchive && del.mutate(toArchive.id)}
        description={`"${toArchive?.title ?? ""}" יועבר ל‍ארכיון משימות. ניתן לשחזר משם בכל עת.`}
      />
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  form,
  setForm,
  clients,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormState;
  setForm: (f: FormState) => void;
  clients: Pick<Client, "id" | "name">[];
  onSave: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    /* noop: form managed by parent */
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="ttitle">כותרת *</Label>
            <Input
              id="ttitle"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tdesc">תיאור</Label>
            <Textarea
              id="tdesc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tdue">תאריך יעד</Label>
              <Input
                id="tdue"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>עדיפות</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {statusLabel[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => setForm({ ...form, client_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא לקוח</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "שומר…" : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}