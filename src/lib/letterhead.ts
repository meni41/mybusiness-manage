import { supabase } from "@/integrations/supabase/client";

export async function fetchLetterheadDataUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from("letterheads").download(path);
    if (error || !data) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
}