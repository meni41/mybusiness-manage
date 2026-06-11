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
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  active: "Active",
  lead: "Lead",
  inactive: "Inactive",
  archived: "Archived",
  low: "Low",
  medium: "Medium",
  high: "High",
};