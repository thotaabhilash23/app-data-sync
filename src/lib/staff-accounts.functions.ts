import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Account provisioning for the staff directory. Creating a login account
// requires the privileged auth admin API, so it lives on the server; every
// handler re-verifies the caller's admin role against the database rather
// than trusting anything the browser sends.

const credentialsSchema = z.object({
  staffId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Only an administrator can manage staff accounts.");
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => credentialsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name ?? data.email },
    });
    if (error || !created?.user) {
      throw new Error(error?.message || "Could not create the staff login account.");
    }

    const authUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: authUserId, email: data.email, name: data.name ?? data.email });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: authUserId, role: "staff" }, { onConflict: "user_id,role" });
    const { error: linkError } = await supabaseAdmin
      .from("staff")
      .update({ auth_user_id: authUserId, email: data.email })
      .eq("id", data.staffId);
    if (linkError) throw new Error(linkError.message);

    return { authUserId };
  });

export const setStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ staffId: z.string().min(1), password: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: staff, error } = await supabaseAdmin
      .from("staff")
      .select("auth_user_id")
      .eq("id", data.staffId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staff?.auth_user_id) throw new Error("This staff member has no portal account yet.");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      staff.auth_user_id,
      { password: data.password },
    );
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("auth_user_id")
      .eq("id", data.staffId)
      .maybeSingle();
    if (staff?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(staff.auth_user_id);
    }
    return { ok: true };
  });
