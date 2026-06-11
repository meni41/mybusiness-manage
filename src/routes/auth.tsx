import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "כניסה — אטלס" }] }),
  component: AuthPage,
});

const OWNER_EMAIL = "owner@atlas.local";
const OWNER_PASSWORD = "atlas-owner-5555-secret";
const GATE_PASSWORD = (import.meta.env.VITE_GATE_PASSWORD as string | undefined) ?? "5555";

async function signInOrCreate() {
  const { error } = await supabase.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (!error) return;
  const { error: signUpError } = await supabase.auth.signUp({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (signUpError) throw signUpError;
  const { error: retryError } = await supabase.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (retryError) throw retryError;
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== GATE_PASSWORD) {
      toast.error("סיסמה שגויה");
      return;
    }
    setBusy(true);
    try {
      await signInOrCreate();
      toast.success("ברוכים השבים");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הכניסה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--color-accent),_transparent_60%)] opacity-60" />
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">סביבה פרטית</CardTitle>
          <CardDescription>הזינו את סיסמת הכניסה כדי להמשיך.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "אנא המתינו…" : "כניסה"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}