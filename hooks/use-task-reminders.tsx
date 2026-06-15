import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { differenceInDays, isToday, isPast, parseISO } from "date-fns";
import type { Task } from "@/lib/db-types";
import { statusLabel } from "@/lib/db-types";

const STORAGE_KEY = "task-reminders-shown";
const SESSION_KEY = "task-reminders-session";

function getShownIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markShown(id: string) {
  const ids = getShownIds();
  ids.add(id);
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
  } catch {}
}

const priorityIcon: Record<string, string> = {
  high: "🔴",
  medium: "🟠",
  low: "🟢",
};

export function useTaskReminders(tasks: Task[]) {
  const firedRef = useRef(false);

  useEffect(() => {
    // Run once per session after tasks load
    if (firedRef.current || tasks.length === 0) return;
    firedRef.current = true;

    const shownIds = getShownIds();

    const pending = tasks.filter(
      (t) => t.status !== "done" && t.due_date && !shownIds.has(t.id),
    );

    const overdue = pending.filter(
      (t) =>
        t.due_date &&
        isPast(parseISO(t.due_date)) &&
        !isToday(parseISO(t.due_date)),
    );

    const dueToday = pending.filter(
      (t) => t.due_date && isToday(parseISO(t.due_date)),
    );

    const dueSoon = pending.filter((t) => {
      if (!t.due_date) return false;
      const days = differenceInDays(parseISO(t.due_date), new Date());
      return days > 0 && days <= 2;
    });

    // Small delay so the page renders first
    const timers: ReturnType<typeof setTimeout>[] = [];

    overdue.slice(0, 3).forEach((t, i) => {
      const timer = setTimeout(() => {
        toast.error(
          <div dir="rtl" className="text-right">
            <p className="font-semibold">{priorityIcon[t.priority]} משימה באיחור</p>
            <p className="text-sm">{t.title}</p>
            <p className="text-xs opacity-70">
              עדיפות {statusLabel[t.priority]} · פג תאריך היעד
            </p>
          </div>,
          { duration: 8000, id: `reminder-${t.id}` },
        );
        markShown(t.id);
      }, 800 + i * 400);
      timers.push(timer);
    });

    dueToday.slice(0, 3).forEach((t, i) => {
      const timer = setTimeout(() => {
        toast.warning(
          <div dir="rtl" className="text-right">
            <p className="font-semibold">{priorityIcon[t.priority]} משימה להיום</p>
            <p className="text-sm">{t.title}</p>
            <p className="text-xs opacity-70">
              עדיפות {statusLabel[t.priority]} · יעד: היום
            </p>
          </div>,
          { duration: 7000, id: `reminder-${t.id}` },
        );
        markShown(t.id);
      }, 800 + (overdue.length + i) * 400);
      timers.push(timer);
    });

    dueSoon.slice(0, 2).forEach((t, i) => {
      const days = differenceInDays(parseISO(t.due_date!), new Date());
      const timer = setTimeout(() => {
        toast.info(
          <div dir="rtl" className="text-right">
            <p className="font-semibold">{priorityIcon[t.priority]} משימה מתקרבת</p>
            <p className="text-sm">{t.title}</p>
            <p className="text-xs opacity-70">
              עדיפות {statusLabel[t.priority]} · עוד {days} {days === 1 ? "יום" : "ימים"}
            </p>
          </div>,
          { duration: 6000, id: `reminder-${t.id}` },
        );
        markShown(t.id);
      }, 800 + (overdue.length + dueToday.length + i) * 400);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [tasks]);
}
