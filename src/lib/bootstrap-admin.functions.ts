import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// First-run setup: creates the very first administrator account. It is only
// callable while the database holds no admin role at all, so once setup is
// done this endpoint permanently refuses to do anything.

async function adminCount() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  return { exists: (await adminCount()) > 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if ((await adminCount()) > 0) {
      throw new Error("An administrator account already exists.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name ?? "Administrator" },
    });
    if (error || !created?.user) {
      throw new Error(error?.message || "Could not create the administrator account.");
    }

    const userId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, name: data.name ?? "Administrator" });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });
