import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button, Field, Icon, Modal, PageHead, RestrictedCard } from "@/components/ezstock/ui";
import { roleLabel, type AppRole } from "@/lib/ezstock/data";
import { teamQuery, type TeamMember } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { createTeamMember, setMemberRole } from "@/lib/ezstock/team.functions";
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
  return <TeamManager myId={me.id} />;
}

function TeamManager({ myId }: { myId: string }) {
  const { data: team = [], isLoading } = useQuery(teamQuery);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const createMember = useServerFn(createTeamMember);
  const updateRole = useServerFn(setMemberRole);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TeamMember | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = team.filter((m) => [m.fullName, m.email].join(" ").toLowerCase().includes(query.toLowerCase()));

  const close = () => { setEditing(undefined); setError(""); };
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
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th /></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.fullName}</strong>{m.id === myId && <span className="min-stock">(você)</span>}</td>
                    <td>{m.email}</td>
                    <td><span className={`role-badge ${m.role === "admin" ? "admin" : ""}`}>{m.role ? roleLabel[m.role] : "Sem acesso"}</span></td>
                    <td><button className="icon-button" onClick={() => setEditing(m)} aria-label={`Editar ${m.fullName}`}><Icon name="edit" size={18} /></button></td>
                  </tr>
                ))}
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
                <select name="role" defaultValue={editing?.role ?? "colaborador"}>
                  <option value="colaborador">Colaborador</option><option value="admin">Administrador</option>
                </select>
              </Field>
            </div>
            <div className="info-strip"><Icon name="alert" />Colaboradores podem consultar produtos e registrar movimentações, mas não gerenciam cadastros.</div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer><span /><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></footer>
          </form>
        </Modal>
      )}
    </>
  );
}
