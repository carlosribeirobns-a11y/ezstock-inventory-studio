import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Empty, Field, Icon, Modal, PageHead } from "@/components/ezstock/ui";
import { errorMessage } from "@/lib/ezstock/data";
import { suppliersQuery, type Supplier } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/fornecedores")({
  head: () => ezHead("Fornecedores", "Contatos dos fornecedores e parceiros comerciais da sua loja."),
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersQuery),
  component: Suppliers,
});

function Suppliers() {
  const { data: suppliers } = useSuspenseQuery(suppliersQuery);
  const { isAdmin } = useMe();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = suppliers.filter((s) => [s.name, s.phone, s.email].join(" ").toLowerCase().includes(query.toLowerCase()));

  const close = () => { setEditing(undefined); setError(""); };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const fields = {
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      phone: String(data.get("phone")).trim(),
    };
    setBusy(true);
    const { error: err } = editing
      ? await supabase.from("suppliers").update(fields).eq("id", editing.id)
      : await supabase.from("suppliers").insert(fields);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refresh();
    notify(editing ? "Fornecedor atualizado com sucesso." : "Fornecedor cadastrado com sucesso.");
    close();
  };
  const remove = async (s: Supplier) => {
    if (!window.confirm(`Excluir o fornecedor “${s.name}”?`)) return;
    setBusy(true);
    const { error: err } = await supabase.from("suppliers").delete().eq("id", s.id);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refresh();
    notify("Fornecedor excluído.");
    close();
  };

  return (
    <>
      <PageHead title="Fornecedores" subtitle="Mantenha os dados de contato dos seus parceiros comerciais." action={isAdmin ? <Button icon="plus" onClick={() => setEditing(null)}>Novo fornecedor</Button> : undefined} />
      <section className="card table-card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar fornecedores..." /></div>
          <span className="result-count">{rows.length} registros</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fornecedor</th><th>Telefone</th><th>E-mail</th><th /></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.email || "—"}</td>
                    <td>{isAdmin && <button className="icon-button" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}><Icon name="edit" size={18} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhum fornecedor encontrado" text="Tente outra busca ou cadastre um novo fornecedor." />
        )}
      </section>
      {editing !== undefined && (
        <Modal title={editing ? "Editar fornecedor" : "Cadastrar fornecedor"} subtitle="Informe os dados de contato do fornecedor." onClose={close}>
          <form className="modal-form" onSubmit={save}>
            <div className="form-grid">
              <Field label="Nome"><input name="name" defaultValue={editing?.name} required maxLength={120} placeholder="Nome do fornecedor" /></Field>
              <Field label="E-mail"><input name="email" defaultValue={editing?.email} type="email" maxLength={255} placeholder="contato@empresa.com.br" /></Field>
              <Field label="Telefone"><input name="phone" defaultValue={editing?.phone} maxLength={30} placeholder="(00) 00000-0000" /></Field>
            </div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer>
              {editing && <Button variant="danger-ghost" disabled={busy} onClick={() => remove(editing)}>Excluir fornecedor</Button>}
              <span />
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
