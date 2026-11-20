import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAssignRole } from "./team-rules";

const roleSchema = z.enum(["admin", "colaborador", "super_admin"]);
const newUserSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(255),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

function friendlyAuthError(message: string) {
  if (/already been registered|already exists/i.test(message)) return "Já existe uma conta com este e-mail.";
  if (/pwned|weak|compromised/i.test(message))
    return "Esta senha é muito fraca ou já apareceu em vazamentos. Escolha outra.";
  return message;
}

/** Creates the first administrator. Only works while the store has no administrator yet. */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => newUserSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "super_admin"]);
    if (countError) throw new Error("Não foi possível verificar a configuração inicial.");
    if ((count ?? 0) > 0) throw new Error("O administrador já foi criado. Entre com sua conta.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(friendlyAuthError(error?.message ?? "Não foi possível criar a conta."));
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Não foi possível concluir a configuração. Tente novamente.");
    }
    return { ok: true };
  });


/** Admin creates a team member with a temporary password. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newUserSchema.extend({ role: roleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Somente administradores podem gerenciar usuários.");
    const { data: authority, error: authorityError } = await context.supabase.from("user_roles").select("role, is_primary_superadmin").eq("user_id", context.userId);
    if (authorityError) throw new Error("Não foi possível verificar suas permissões.");
    const actor = { id: context.userId, role: "admin" as const, isPrimary: (authority ?? []).some((r) => r.is_primary_superadmin) };
    if (!canAssignRole(actor, data.role)) throw new Error("Somente o Superadministrador titular pode criar Superadministradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(friendlyAuthError(error?.message ?? "Não foi possível criar a conta."));
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Não foi possível definir o perfil de acesso.");
    }
    return { id: created.user.id };
  });

/** Admin changes a member's role; the store always keeps at least one administrator. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema, fullName: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("manage_team_account", { _user_id: data.userId, _action: "edit", _role: data.role, _full_name: data.fullName });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), action: z.enum(["deactivate", "reactivate", "delete"]) }).parse(input))
  .handler(async ({ data, context }) => {
    // This atomic function authorizes the actor and tombstones deleted accounts
    // before touching Auth, preventing a concurrent promotion from bypassing rules.
    const { error } = await context.supabase.rpc("manage_team_account", { _user_id: data.userId, _action: data.action });
    if (error) throw new Error(error.message);
    if (data.action === "delete") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId, true);
      if (deleteError) {
        await supabaseAdmin.from("profiles").update({ deleted_at: null }).eq("id", data.userId);
        throw new Error("A conta foi inativada, mas a exclusão não foi concluída. Tente excluir novamente.");
      }
    }
    return { ok: true };
  });
