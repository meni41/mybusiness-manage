import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckSquare, AlertCircle, Calendar } from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { statusLabel } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "לוח בקרה — אטלס" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [clients, tasks, folders] = await Promise.all([
        supabase.from("clients").select("id,status"),
        supabase
          .from("tasks")
          .select("id,title,status,priority,due_date,client_id")
          .is("archived_at", null),
        supabase.from("folders").select("id"),
      ]);
      return {
        clients: clients.data ?? [],
        tasks: tasks.data ?? [],
        folders: folders.data ?? [],
      };
    },
  });

  const clients = data?.clients ?? [];
  const tasks = data?.tasks ?? [];
  const folders = data?.folders ?? [];

  const activeClients = clients.filter((c) => c.status === "in_progress").length;
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;

  const urgent = tasks
    .filter((t) => t.status !== "done")
    .filter(
      (t) =>
        t.priority === "high" ||
        (t.due_date && (isToday(parseISO(t.due_date)) || isPast(parseISO(t.due_date)))),
    )
    .slice(0, 8);

  const stats = [
    { label: "לקוחות בתהליך", value: activeClients, icon: Users, tint: "text-info" },
    { label: "משימות פתוחות", value: pendingTasks, icon: CheckSquare, tint: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      {/* Logo Banner */}
      <div className="flex items-center justify-between rounded-xl border border-[#B8960C]/20 bg-gradient-to-l from-[#6B1515]/5 to-[#B8960C]/5 px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#6B1515]">לוח בקרה</h1>
          <p className="text-sm text-muted-foreground">מבט מהיר על היום.</p>
        </div>
        <img
          src="/logo-rect.png"
          alt="Eizenstein"
          className="h-16 object-contain opacity-90"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{s.value}</p>
                </div>
                <s.icon className={`h-5 w-5 ${s.tint}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-warning" />
            דחוף להיום
          </CardTitle>
        </CardHeader>
        <CardContent>
          {urgent.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין משימות דחופות. כל הכבוד!</p>
          ) : (
            <ul className="divide-y divide-border">
              {urgent.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    {t.due_date && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(t.due_date), "d MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge p={t.priority} />
                    <Badge variant="secondary">{statusLabel[t.status]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link to="/tasks" className="text-sm font-medium text-primary hover:underline">
              לצפייה בכל המשימות ←
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/10 text-warning-foreground border-warning/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${map[p] ?? map.low}`}>
      {statusLabel[p]}
    </span>
  );
}