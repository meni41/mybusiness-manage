import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { statusLabel, type Task, type Client } from "@/lib/db-types";

const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
const priorityClass: Record<string, string> = {
  high: "bg-[#EF4444] text-white",
  medium: "bg-[#F59E0B] text-white",
  low: "bg-[#10B981] text-white",
};

export function UrgentTaskPopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  const { data } = useQuery({
    queryKey: ["urgent-task-popup"],
    queryFn: async () => {
      const [tasksRes, clientsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .neq("status", "done"),
        supabase.from("clients").select("id,name"),
      ]);
      const tasks = (tasksRes.data ?? []) as Task[];
      const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "name">[];
      const map = Object.fromEntries(clients.map((c) => [c.id, c.name]));
      const sorted = [...tasks].sort((a, b) => {
        const pa = priorityRank[a.priority] ?? 9;
        const pb = priorityRank[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      });
      return { task: sorted[0] ?? null, clientName: sorted[0]?.client_id ? map[sorted[0].client_id] ?? null : null };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (shown) return;
    if (data?.task) {
      setOpen(true);
      setShown(true);
    }
  }, [data, shown]);

  const task = data?.task;
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            משימה דחופה ממתינה
          </DialogTitle>
          <DialogDescription>
            המשימה הדחופה ביותר על סמך עדיפות ותאריך יעד.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-base font-semibold">{task.title}</h3>
          <div className="space-y-1.5 text-sm">
            {data?.clientName && (
              <p>
                <span className="text-muted-foreground">לקוח: </span>
                <span className="font-medium">{data.clientName}</span>
              </p>
            )}
            {task.due_date && (
              <p className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">תאריך יעד:</span>
                <span className="font-medium">{format(parseISO(task.due_date), "d MMM yyyy")}</span>
              </p>
            )}
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">עדיפות:</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${priorityClass[task.priority]}`}>
                {statusLabel[task.priority]}
              </span>
            </p>
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse sm:justify-start">
          <Button
            onClick={() => {
              setOpen(false);
              navigate({ to: "/tasks" });
            }}
          >
            עבור למשימה
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}