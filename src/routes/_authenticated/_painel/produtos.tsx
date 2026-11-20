import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Empty, Field, Icon, Modal, PageHead, Status } from "@/components/ezstock/ui";
import { errorMessage, formatPrice } from "@/lib/ezstock/data";
import { categoriesQuery, productsQuery, type Product } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/produtos")({
  head: () => ezHead("Produtos", "Cadastre produtos, consulte saldos e acompanhe itens com estoque baixo ou zerado."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]),
  component: Products,
});

const PAGE_SIZE = 10;

function Products() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { isAdmin } = useMe();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const q = search.toLowerCase();
  const visible = products.filter(
    (p) =>
      (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (!category || p.category_id === category) &&
      (filter === "Todos" ||
        (filter === "Baixo" && p.active && p.stock > 0 && p.stock <= p.min_stock) ||
        (filter === "Sem estoque" && p.active && p.stock === 0) ||
        (filter === "Inativos" && !p.active)),
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const usableCategories = categories.filter((c) => c.active || c.id === editing?.category_id);

  const close = () => {
    setEditing(undefined);
    setError("");
  };
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
    ]);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const fields = {
      name: String(data.get("name")).trim(),
      sku: String(data.get("sku")).trim().toUpperCase(),
      category_id: String(data.get("category")) || null,
      min_stock: Number(data.get("min")),
      price: Number(data.get("price")),
    };
    setBusy(true);
    const { error: err } = editing
      ? await supabase.from("products").update(fields).eq("id", editing.id)
      : await supabase.from("products").insert({ ...fields, stock: Number(data.get("stock")) || 0 });
    setBusy(false);
    if (err) return setError(err.code === "23505" ? "Já existe um produto com este código (SKU)." : errorMessage(err));
    await refresh();
    notify(editing ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    close();
  };

  const setActive = async (product: Product, active: boolean) => {
    setBusy(true);
    const { error: err } = await supabase.from("products").update({ active }).eq("id", product.id);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await refresh();
    notify(active ? "Produto reativado." : "Produto inativado. O histórico foi preservado.");
    close();
  };

  return (
    <>
      <PageHead title="Produtos" subtitle="Gerencie os produtos e acompanhe os níveis de estoque." action={isAdmin ? <Button icon="plus" onClick={() => setEditing(null)}>Novo produto</Button> : undefined} />
      <section className="card table-card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={18} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou código..." /></div>
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label="Filtrar por status">
            <option>Todos</option><option>Baixo</option><option>Sem estoque</option><option>Inativos</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="result-count">{visible.length} produtos</span>
        </div>
        {pageRows.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Preço</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id}>
                    <td><div className="product-cell"><div className="product-thumb">{p.name[0]}</div><div><strong>{p.name}</strong><span>{p.sku}</span></div></div></td>
                    <td>{p.category}</td>
                    <td><strong>{p.stock}</strong> un. <span className="min-stock">mín. {p.min_stock}</span></td>
                    <td>{formatPrice(p.price)}</td>
                    <td><Status stock={p.stock} min={p.min_stock} active={p.active} /></td>
                    <td>
                      {isAdmin ? (
                        <button className="icon-button" onClick={() => setEditing(p)} title="Editar" aria-label={`Editar ${p.name}`}><Icon name="edit" size={18} /></button>
                      ) : (
                        <span className="icon-button" title="Somente administradores editam produtos"><Icon name="eye" size={18} /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhum produto encontrado" text={products.length ? "Tente ajustar a busca ou os filtros selecionados." : "Cadastre o primeiro produto para começar."} />
        )}
        <div className="pagination">
          <span>Mostrando {visible.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{(current - 1) * PAGE_SIZE + pageRows.length} de {visible.length}</span>
          <div>
            <button disabled={current <= 1} onClick={() => setPage(current - 1)}>Anterior</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} className={n === current ? "active" : ""} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button disabled={current >= pages} onClick={() => setPage(current + 1)}>Próxima</button>
          </div>
        </div>
      </section>
      {editing !== undefined && (
        <Modal title={editing ? "Editar produto" : "Cadastrar produto"} subtitle="Preencha os dados para manter seu estoque organizado." onClose={close}>
          <form onSubmit={save} className="modal-form">
            <div className="form-grid">
              <Field label="Nome do produto"><input name="name" defaultValue={editing?.name} required maxLength={120} placeholder="Ex.: Shampoo Nutritivo 300ml" /></Field>
              <Field label="Código (SKU)"><input name="sku" defaultValue={editing?.sku} required maxLength={40} placeholder="PRO-0001" /></Field>
              <Field label="Categoria">
                <select name="category" defaultValue={editing?.category_id ?? usableCategories[0]?.id ?? ""}>
                  <option value="">Sem categoria</option>
                  {usableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Preço de venda"><input name="price" defaultValue={editing?.price} required type="number" min="0" step="0.01" placeholder="0,00" /></Field>
              <Field label="Estoque atual" hint={editing ? "Alterações de saldo devem ser feitas em Movimentações." : "Será registrado no histórico como estoque inicial."}>
                <input name="stock" defaultValue={editing?.stock ?? 0} readOnly={!!editing} type="number" min="0" step="1" />
              </Field>
              <Field label="Estoque mínimo"><input name="min" defaultValue={editing?.min_stock ?? 5} required type="number" min="0" step="1" /></Field>
            </div>
            {editing && <div className="info-strip"><Icon name="alert" />Produtos com histórico não são excluídos. Para removê-lo das operações, use “Inativar produto”.</div>}
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <footer>
              {editing && (
                <Button variant="danger-ghost" disabled={busy} onClick={() => setActive(editing, !editing.active)}>
                  {editing.active ? "Inativar produto" : "Reativar produto"}
                </Button>
              )}
              <span />
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar produto"}</Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
