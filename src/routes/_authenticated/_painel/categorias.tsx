import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Empty, Field, Icon, Modal, PageHead } from "@/components/ezstock/ui";
import { errorMessage } from "@/lib/ezstock/data";
import { categoriesQuery, type Category } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/categorias")({
  head: () => ezHead("Categorias", "Organize os produtos da loja em categorias para facilitar a gestão do estoque."),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery),
  component: Categories,
});

function Categories() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { isAdmin } = useMe();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const close = () => { setEditing(undefined); setError(""); };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const fields = { name: String(data.get("name")).trim(), active: data.get("active") !== "inativa" };
    setBusy(true);
    const { error: err } = editing
      ? await supabase.from("categories").update(fields).eq("id", editing.id)
      : await supabase.from("categories").insert(fields);
    setBusy(false);
    if (err) return setError(err.code === "23505" ? "Já existe uma categoria com este nome." : errorMessage(err));
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["categories"] }), queryClient.invalidateQueries({ queryKey: ["products"] })]);
    notify(editing ? "Categoria atualizada com sucesso." : "Categoria cadastrada com sucesso.");
    close();
  };

  return (
    <>
      <PageHead title="Categorias" subtitle="Organize os produtos em categorias para facilitar a gestão." action={isAdmin ? <Button icon="plus" onClick={() => setEditing(null)}>Nova categoria</Button> : undefined} />
      <section className="card table-card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar categorias..." /></div>
          <span className="result-count">{rows.length} registros</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Categoria</th><th>Produtos vinculados</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.productCount} {c.productCount === 1 ? "produto" : "produtos"}</td>
                    <td><span className={`badge ${c.active ? "success" : "neutral"}`}><i />{c.active ? "Ativa" : "Inativa"}</span></td>
                    <td>{isAdmin && <button className="icon-button" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}><Icon name="edit" size={18} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhuma categoria encontrada" text="Tente outra busca ou cadastre uma nova categoria." />
        )}
      </section>
      {editing !== undefined && (
        <Modal title={editing ? "Editar categoria" : "Cadastrar categoria"} subtitle="Informe os dados da categoria." onClose={close}>
          <form className="modal-form" onSubmit={save}>
            <div className="form-grid">
              <Field label="Nome"><input name="name" defaultValue={editing?.name} required maxLength={80} placeholder="Nome da categoria" /></Field>
              <Field label="Status">
                <select name="active" defaultValue={editing && !editing.active ? "inativa" : "ativa"}>
                  <option value="ativa">Ativa</option><option value="inativa">Inativa</option>
                </select>
              </Field>
            </div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer><span /><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></footer>
          </form>
        </Modal>
      )}
    </>
  );
}
