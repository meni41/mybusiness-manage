import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { fetchLetterheadDataUrl } from "@/lib/letterhead";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות — אטלס" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      const url = await fetchLetterheadDataUrl(settings?.letterhead_url);
      if (!cancel) setPreview(url);
    })();
    return () => {
      cancel = true;
    };
  }, [settings?.letterhead_url]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("לא מחובר");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/letterhead-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("letterheads")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // remove old file
      if (settings?.letterhead_url && settings.letterhead_url !== path) {
        await supabase.storage.from("letterheads").remove([settings.letterhead_url]);
      }
      const { error } = await supabase
        .from("app_settings")
        .upsert({ user_id: user.id, letterhead_url: path });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נייר המכתבים עודכן");
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה"),
  });

  const removeLetterhead = useMutation({
    mutationFn: async () => {
      if (!user || !settings?.letterhead_url) return;
      await supabase.storage.from("letterheads").remove([settings.letterhead_url]);
      const { error } = await supabase
        .from("app_settings")
        .upsert({ user_id: user.id, letterhead_url: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נמחק");
      setConfirmDel(false);
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">הגדרות</h1>
        <p className="text-sm text-muted-foreground">העדפות חשבון ומסמכים.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">נייר מכתבים / לוגו להצעות מחיר</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            התמונה תוצג כראש עמוד בכל הצעת מחיר ש‍תופק כקובץ PDF.
          </p>

          {preview ? (
            <div className="rounded-md border bg-muted/20 p-4">
              <img
                src={preview}
                alt="נייר מכתבים"
                className="mx-auto max-h-40 object-contain"
              />
            </div>
          ) : (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              לא הועלה נייר מכתבים עדיין.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Label
              htmlFor="letterhead-file"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              {settings?.letterhead_url ? "החלפת הקובץ" : "העלאת תמונה"}
            </Label>
            <Input
              id="letterhead-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            {settings?.letterhead_url && (
              <Button variant="ghost" onClick={() => setConfirmDel(true)}>
                <Trash2 className="ms-2 h-4 w-4 text-destructive" />
                הסרה
              </Button>
            )}
            {upload.isPending && (
              <span className="text-xs text-muted-foreground">מעלה…</span>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        onConfirm={() => removeLetterhead.mutate()}
      />
    </div>
  );
}