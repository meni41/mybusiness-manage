import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
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
import { openQuotePdf, type QuoteData } from "@/lib/quote-pdf";
import { fetchLetterheadDataUrl } from "@/lib/letterhead";
import type { Client } from "@/lib/db-types";

const DEFAULT_DESCRIPTION = [
  "אפיון צרכים – פגישה בשטח לתאום ציפיות, הבנת השטח, הלקוח ופרוגרמת הבנייה.",
  "הכנת 3 אופציות לתכנון ובניה של הדירה כולל חלוקה פנימית של הקירות, ריהוט ומידות.",
  "בחירה ועיבוד מותאם אישי לאופציה הנבחרת – תוכנית אדריכלות סופית לבניה.",
  'הכנת סט תוכניות עבודה מפורט לקבלן (תוכנית מצב קיים, ייצוגית, הריסה, בניה, חשמל, מאור, אינסטלציה).',
].join("\n");

const DEFAULT_NOTES = [
  "ההצעה כוללת תכנון בלבד ואינה כוללת אגרות, היתרים, יועצים חיצוניים או עבודות ביצוע.",
  "שינויים מהותיים בתכנון לאחר אישור האופציה הנבחרת יתומחרו בנפרד.",
  "ההצעה בתוקף ל-30 יום מיום הוצאתה.",
  'התשלומים אינם כוללים מע"מ אלא אם צוין אחרת.',
  "כל עיכוב בתשלום יגרור עיכוב מקביל בלוחות הזמנים של הפרויקט.",
].join("\n");

export function QuoteEditorDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
}) {
  const { user } = useAuth();
  const meters = Number(client.quote_meters) || 0;
  const rate = Number(client.quote_rate) || 80;
  const totalInit = Number(client.total_amount) || meters * rate;

  const [data, setData] = useState<QuoteData>(() => ({
    clientName: client.name,
    projectAddress: "",
    date: new Date().toLocaleDateString("he-IL"),
    title: "הצעת מחיר – הסכם עבודה",
    subtitle: "תכנון ועיצוב פנים",
    description: DEFAULT_DESCRIPTION,
    meters,
    rate,
    total: totalInit,
    notes: DEFAULT_NOTES,
    signatureRight: "חתימת האדריכלית",
    signatureLeft: "חתימת הלקוח",
  }));

  useEffect(() => {
    if (open) {
      setData((d) => ({
        ...d,
        clientName: client.name,
        meters,
        rate,
        total: Number(client.total_amount) || meters * rate,
        date: new Date().toLocaleDateString("he-IL"),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id]);

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const computedTotal = useMemo(
    () => (data.total > 0 ? data.total : data.meters * data.rate),
    [data.total, data.meters, data.rate],
  );

  const set = <K extends keyof QuoteData>(k: K, v: QuoteData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const generate = async () => {
    const letterheadUrl = await fetchLetterheadDataUrl(settings?.letterhead_url);
    openQuotePdf({ ...data, total: computedTotal, letterheadUrl });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto text-right sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>עריכת הצעת מחיר לפני ייצוא</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="כותרת המסמך" value={data.title} onChange={(v) => set("title", v)} />
            <Field label="כותרת משנה" value={data.subtitle} onChange={(v) => set("subtitle", v)} />
            <Field label="שם הלקוח" value={data.clientName} onChange={(v) => set("clientName", v)} />
            <Field label="תאריך" value={data.date} onChange={(v) => set("date", v)} />
            <Field
              label="כתובת הפרויקט"
              value={data.projectAddress}
              onChange={(v) => set("projectAddress", v)}
            />
          </div>

          <TextField
            label="פירוט ההצעה (שורה לכל סעיף)"
            value={data.description}
            onChange={(v) => set("description", v)}
            rows={5}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <NumField label='שטח (מ"ר)' value={data.meters} onChange={(v) => set("meters", v)} />
            <NumField label="תעריף למטר (₪)" value={data.rate} onChange={(v) => set("rate", v)} />
            <NumField
              label='סה"כ לתשלום (₪)'
              value={data.total}
              onChange={(v) => set("total", v)}
              hint={`מחושב: ${data.meters * data.rate || 0}`}
            />
          </div>

          <TextField
            label="הערות (שורה לכל סעיף)"
            value={data.notes}
            onChange={(v) => set("notes", v)}
            rows={5}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="חתימה ימין"
              value={data.signatureRight}
              onChange={(v) => set("signatureRight", v)}
            />
            <Field
              label="חתימה שמאל"
              value={data.signatureLeft}
              onChange={(v) => set("signatureLeft", v)}
            />
          </div>

          {!settings?.letterhead_url && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              ניתן להוסיף לוגו / נייר מכתבים מההגדרות – הוא יוצג בראש כל הצעת מחיר.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button type="button" onClick={generate}>
            <FileDown className="ms-2 h-4 w-4" /> הפק PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}