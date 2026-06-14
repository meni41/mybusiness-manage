function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export type QuoteData = {
  clientName: string;
  projectAddress: string;
  date: string;
  title: string;
  subtitle: string;
  description: string;
  meters: number;
  rate: number;
  total: number;
  notes: string;
  signatureLeft: string;
  signatureRight: string;
  letterheadUrl?: string | null;
};

export function buildQuoteHtml(d: QuoteData) {
  const meters = Number(d.meters) || 0;
  const rate = Number(d.rate) || 0;
  const total = Number(d.total) || meters * rate;
  const m1 = total * 0.35;
  const m2 = total * 0.35;
  const m3 = total * 0.30;

  const descHtml = escapeHtml(d.description)
    .split(/\n+/)
    .filter(Boolean)
    .map((l) => `<li>${l}</li>`)
    .join("");

  const notesHtml = escapeHtml(d.notes)
    .split(/\n+/)
    .filter(Boolean)
    .map((l) => `<li>${l}</li>`)
    .join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>הצעת מחיר - ${escapeHtml(d.clientName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Heebo', Arial, sans-serif; color: #111; background: #fff; }
  body { padding: 40px 48px; line-height: 1.6; font-size: 13px; }
  .letterhead { width: 100%; max-height: 140px; object-fit: contain; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; text-align: center; }
  h2 { font-size: 15px; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #111; }
  .sub { text-align: center; color: #555; margin-bottom: 18px; font-size: 12px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; background: #f6f6f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; }
  .meta div { font-size: 13px; }
  .meta b { display: block; color: #555; font-weight: 500; font-size: 11px; margin-bottom: 2px; }
  ol { padding-right: 20px; margin: 8px 0; }
  ol li { margin-bottom: 6px; }
  .fin { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 10px 0; }
  .fin .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .fin .label { color: #666; font-size: 11px; }
  .fin .val { font-size: 16px; font-weight: 700; margin-top: 4px; }
  .pay { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .pay .row { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #eee; }
  .pay .row:last-child { border-bottom: none; }
  .pay .row b { color: #111; }
  .notes { font-size: 11.5px; color: #333; background: #fafafa; border-right: 3px solid #111; padding: 10px 14px; }
  .notes ul { padding-right: 18px; margin: 6px 0; }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; }
  .sigs .sig { flex: 1; text-align: center; }
  .sigs .line { border-top: 1px solid #111; margin-top: 50px; padding-top: 6px; font-size: 12px; }
  .toolbar { position: fixed; top: 12px; left: 12px; right: 12px; display: flex; gap: 8px; justify-content: flex-start; }
  .toolbar button { background: #111; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-family: inherit; font-size: 13px; cursor: pointer; }
  .toolbar button.alt { background: #fff; color: #111; border: 1px solid #111; }
  @media print { .toolbar { display: none; } body { padding: 24px 32px; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">הורד / הדפס PDF</button>
    <button class="alt" onclick="window.close()">סגור</button>
  </div>

  ${d.letterheadUrl ? `<img class="letterhead" src="${d.letterheadUrl}" alt="letterhead" />` : ""}
  <h1>${escapeHtml(d.title)}</h1>
  <div class="sub">${escapeHtml(d.subtitle)}</div>

  <div class="meta">
    <div><b>שם הלקוח</b>${escapeHtml(d.clientName)}</div>
    <div><b>תאריך</b>${escapeHtml(d.date)}</div>
    <div><b>כתובת הפרויקט</b>${escapeHtml(d.projectAddress || "—")}</div>
  </div>

  <h2>פרוט ההצעה:</h2>
  <ol>${descHtml}</ol>

  <div class="fin">
    <div class="box"><div class="label">עלות למ"ר</div><div class="val">${formatILS(rate)}</div></div>
    <div class="box"><div class="label">שטח לתכנון</div><div class="val">${meters} מ"ר</div></div>
    <div class="box"><div class="label">סה"כ לתשלום</div><div class="val">${formatILS(total)}</div></div>
  </div>

  <h2>פריסת תשלומים:</h2>
  <div class="pay">
    <div class="row"><span>35% בעת חתימה על הסכם זה</span><b>${formatILS(m1)}</b></div>
    <div class="row"><span>35% בעת הגשת תוכנית אופציות</span><b>${formatILS(m2)}</b></div>
    <div class="row"><span>30% בעת הגשת סט תוכניות עבודה מלא</span><b>${formatILS(m3)}</b></div>
  </div>

  <h2>הערות:</h2>
  <div class="notes">
    <ul>${notesHtml}</ul>
  </div>

  <div class="sigs">
    <div class="sig"><div class="line">${escapeHtml(d.signatureRight)}</div></div>
    <div class="sig"><div class="line">${escapeHtml(d.signatureLeft)}</div></div>
  </div>

  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 600); });
  </script>
</body>
</html>`;
}

export function openQuotePdf(d: QuoteData) {
  const html = buildQuoteHtml(d);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}