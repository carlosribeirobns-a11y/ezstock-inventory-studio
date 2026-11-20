import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button, Field, Icon, Modal, PageHead, RestrictedCard } from "@/components/ezstock/ui";
import { roleLabel, type AppRole } from "@/lib/ezstock/data";
import { teamQuery, type TeamMember } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { changeAccountStatus, createTeamMember, setMemberRole } from "@/lib/ezstock/team.functions";
import { canAssignRole, canManageAccount, canRemoveAccount } from "@/lib/ezstock/team-rules";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/usuarios")({
  head: () => ezHead("Usuários", "Gerencie os acessos e permissões da equipe no EzStock."),
  component: Users,
});

function Users() {
  const me = useMe();
  if (!me.isAdmin) {
    return (
      <>
        <PageHead title="Usuários" subtitle="Gerencie acessos e permissões da equipe." />
        <RestrictedCard text="Somente administradores podem visualizar e gerenciar usuários e permissões." />
      </>
    );
  }
  return <TeamManager me={me} />;
}

function TeamManager({ me }: { me: { id: string; role: AppRole; isPrimary: boolean } }) {
  const myId = me.id;
  const { data: team = [], isLoading } = useQuery(teamQuery);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const createMember = useServerFn(createTeamMember);
  const updateRole = useServerFn(setMemberRole);
  const updateStatus = useServerFn(changeAccountStatus);
  const [confirming, setConfirming] = useState<{ member: TeamMember; action: "deactivate" | "reactivate" | "delete" } | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TeamMember | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = team.filter((m) => [m.fullName, m.email].join(" ").toLowerCase().includes(query.toLowerCase()));

  const close = () => { setEditing(undefined); setConfirming(null); setError(""); };
  const confirmStatus = async () => {
    if (!confirming) return;
    setBusy(true); setError("");
    try {
      await updateStatus({ data: { userId: confirming.member.id, action: confirming.action } });
      await queryClient.invalidateQueries({ queryKey: ["team"] });
      notify(confirming.action === "delete" ? "Conta excluída com sucesso." : confirming.action === "deactivate" ? "Conta inativada com sucesso." : "Conta reativada com sucesso.");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a conta.");
    } finally { setBusy(false); }
  };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const fullName = String(data.get("name")).trim();
    const role = String(data.get("role")) as AppRole;
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await updateRole({ data: { userId: editing.id, role, fullName } });
      } else {
        await createMember({ data: { fullName, email: String(data.get("email")), password: String(data.get("password")), role } });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]);
      notify(editing ? "Usuário atualizado com sucesso." : "Usuário cadastrado. Envie o e-mail e a senha temporária para a pessoa.");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Usuários" subtitle="Gerencie acessos e permissões da equipe." action={<Button icon="plus" onClick={() => setEditing(null)}>Novo usuário</Button>} />
      <section className="card table-card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuários..." /></div>
          <span className="result-count">{rows.length} registros</span>
        </div>
        {isLoading ? (
          <div className="query-error">Carregando equipe...</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead>
              <tbody>
                {rows.map((m) => {
                  const manage = canManageAccount(me, m);
                  const remove = canRemoveAccount(me, m);
                  return (
                  <tr key={m.id}>
                    <td><strong>{m.fullName}</strong>{m.id === myId && <span className="min-stock">(você)</span>}</td>
                    <td>{m.email}</td>
                    <td><span className={`role-badge ${m.role === "admin" || m.role === "super_admin" ? "admin" : ""}`}>{m.role ? roleLabel[m.role] : "Sem acesso"}{m.isPrimary ? " titular" : ""}</span></td>
                    <td><span className={`badge ${m.active ? "success" : "neutral"}`}><i />{m.active ? "Ativa" : "Inativa"}</span></td>
                    <td>
                      {manage && <Button variant="icon" onClick={() => setEditing(m)} ariaLabel={`Editar ${m.fullName}`} icon="edit" />}
                      {remove && <Button variant="icon" onClick={() => setConfirming({ member: m, action: m.active ? "deactivate" : "reactivate" })} ariaLabel={`${m.active ? "Inativar" : "Reativar"} ${m.fullName}`} icon={m.active ? "pause" : "check"} />}
                      {remove && <Button variant="icon" onClick={() => setConfirming({ member: m, action: "delete" })} ariaLabel={`Excluir ${m.fullName}`} icon="trash" />}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <Modal title={editing ? "Editar usuário" : "Cadastrar usuário"} subtitle={editing ? editing.email : "Crie o acesso de um novo membro da equipe."} onClose={close}>
          <form className="modal-form" onSubmit={save}>
            <div className="form-grid">
              <Field label="Nome"><input name="name" defaultValue={editing?.fullName} required minLength={2} maxLength={120} placeholder="Nome completo" /></Field>
              {!editing && <Field label="E-mail"><input name="email" required type="email" maxLength={255} placeholder="nome@empresa.com.br" /></Field>}
              {!editing && <Field label="Senha temporária" hint="Mínimo de 8 caracteres. A pessoa pode trocá-la em “Esqueci minha senha”."><input name="password" required minLength={8} maxLength={72} type="text" autoComplete="off" /></Field>}
              <Field label="Perfil de acesso">
                <select name="role" defaultValue={editing?.role ?? "colaborador"} disabled={editing?.isPrimary}>
                  <option value="colaborador">Colaborador</option>
                  {canAssignRole(me, "admin") && <option value="admin">Administrador</option>}
                  {(canAssignRole(me, "super_admin") || editing?.role === "super_admin") && <option value="super_admin">Superadministrador</option>}
                </select>
                {editing?.isPrimary && <input type="hidden" name="role" value="super_admin" />}
              </Field>
            </div>
            <div className="info-strip"><Icon name="alert" />Administradores gerenciam colaboradores. Somente o Superadministrador titular gerencia administradores e cria Superadministradores.</div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer><span /><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></footer>
          </form>
        </Modal>
      )}
      {confirming && (
        <Modal title={confirming.action === "delete" ? "Excluir conta" : confirming.action === "deactivate" ? "Inativar conta" : "Reativar conta"} subtitle={confirming.member.email} onClose={close}>
          <div className="modal-form">
            <div className="info-strip"><Icon name="alert" />{confirming.action === "delete" ? "A pessoa perderá o acesso definitivamente. O histórico de estoque será preservado." : confirming.action === "deactivate" ? "A pessoa não poderá acessar o EzStock até a conta ser reativada." : "A pessoa poderá acessar o EzStock novamente."}</div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer><span /><Button variant="secondary" onClick={close}>Cancelar</Button><Button variant={confirming.action === "reactivate" ? "primary" : "danger-ghost"} onClick={confirmStatus} disabled={busy}>{busy ? "Salvando..." : "Confirmar"}</Button></footer>
          </div>
        </Modal>
      )}
    </>
  );
}
