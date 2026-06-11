import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;
export type Folder = Tables<"folders">;
export type FolderItem = Tables<"folder_items">;
export type Task = Tables<"tasks">;
export type TaskInsert = TablesInsert<"tasks">;

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const CLIENT_STATUSES = ["active", "lead", "inactive", "archived"] as const;

export const statusLabel: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  done: "הושלם",
  active: "פעיל",
  lead: "ליד",
  inactive: "לא פעיל",
  archived: "בארכיון",
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
};