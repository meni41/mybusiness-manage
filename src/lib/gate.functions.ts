import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ password: z.string().min(1).max(200) });

export const verifyGate = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const GATE_PASSWORD = process.env.GATE_PASSWORD ?? "5555";
    const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@atlas.local";
    const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "atlas-owner-5555-secret";

    if (data.password !== GATE_PASSWORD) {
      throw new Error("INVALID_PASSWORD");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

    // Ensure the owner account exists (idempotent).
    const signInClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    let signIn = await signInClient.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });

    if (signIn.error) {
      // Create the owner user via admin (bypasses disabled public signups).
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
        email_confirm: true,
      });
      if (createError && !/already.*registered|exists/i.test(createError.message)) {
        throw new Error("OWNER_PROVISION_FAILED");
      }
      signIn = await signInClient.auth.signInWithPassword({
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
      });
      if (signIn.error || !signIn.data.session) {
        throw new Error("OWNER_SIGNIN_FAILED");
      }
    }

    const session = signIn.data.session!;
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  });