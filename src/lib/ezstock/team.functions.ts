import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAssignRole, canResetPassword } from "./team-rules";

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


const passwordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72);
const redirectSchema = z.string().url().max(500);
const createMemberSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("invite"), fullName: newUserSchema.shape.fullName, email: newUserSchema.shape.email, role: roleSchema, redirectTo: redirectSchema }),
  z.object({ mode: z.literal("password"), fullName: newUserSchema.shape.fullName, email: newUserSchema.shape.email, role: roleSchema, password: passwordSchema, mustChange: z.boolean() }),
]);

/** Admin creates a team member: email invite with activation link, or a temporary/fixed password. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Somente administradores podem gerenciar usuários.");
    const { data: authority, error: authorityError } = await context.supabase.from("user_roles").select("role, is_primary_superadmin").eq("user_id", context.userId);
    if (authorityError) throw new Error("Não foi possível verificar suas permissões.");
    const actor = { id: context.userId, role: "admin" as const, isPrimary: (authority ?? []).some((r) => r.is_primary_superadmin) };
    if (!canAssignRole(actor, data.role)) throw new Error("Somente o Superadministrador titular pode criar Superadministradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result =
      data.mode === "invite"
        ? await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.fullName }, redirectTo: new URL("/reset-password", data.redirectTo).toString() })
        : await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { full_name: data.fullName },
            app_metadata: { must_change_password: data.mustChange },
          });
    const created = result.data;
    if (result.error || !created.user) throw new Error(friendlyAuthError(result.error?.message ?? "Não foi possível criar a conta."));
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Não foi possível definir o perfil de acesso.");
    }
    return { id: created.user.id };
  });

/** Superadministrator resets a member's password: email link, temporary (must change) or fixed password. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("email"), userId: z.string().uuid(), redirectTo: redirectSchema }),
      z.object({ mode: z.enum(["temporary", "fixed"]), userId: z.string().uuid(), password: passwordSchema }),
    ]).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ data: mine }, { data: theirs }] = await Promise.all([
      context.supabase.from("user_roles").select("role, is_primary_superadmin").eq("user_id", context.userId),
      context.supabase.from("user_roles").select("role, is_primary_superadmin").eq("user_id", data.userId),
    ]);
    const pick = (rows: { role: string; is_primary_superadmin: boolean }[] | null, id: string) => {
      const roles = (rows ?? []).map((r) => r.role);
      const role = roles.includes("super_admin") ? "super_admin" : roles.includes("admin") ? "admin" : roles.includes("colaborador") ? "colaborador" : null;
      return { id, role: role as "super_admin" | "admin" | "colaborador" | null, isPrimary: (rows ?? []).some((r) => r.is_primary_superadmin) };
    };
    if (!canResetPassword(pick(mine, context.userId), pick(theirs, data.userId)))
      throw new Error("Você não tem permissão para redefinir a senha desta conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.mode === "email") {
      const { data: target, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      if (error || !target.user?.email) throw new Error("Conta não encontrada.");
      const { error: sendError } = await supabaseAdmin.auth.resetPasswordForEmail(target.user.email, { redirectTo: new URL("/reset-password", data.redirectTo).toString() });
      if (sendError) throw new Error("Não foi possível enviar o e-mail de redefinição.");
      return { ok: true };
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      app_metadata: { must_change_password: data.mode === "temporary" },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return { ok: true };
  });

/** Signed-in member replaces a temporary password and clears the forced-change flag. */
export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ password: passwordSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
      app_metadata: { must_change_password: false },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return { ok: true };
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
