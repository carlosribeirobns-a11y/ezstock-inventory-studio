import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Empty, Field, Icon, Modal, PageHead, Status } from "@/components/ezstock/ui";
import { formatPrice, type Product } from "@/lib/ezstock/data";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/produtos")({
  head: () => ezHead("Produtos", "Cadastre produtos, consulte saldos e acompanhe itens com estoque baixo ou zerado."),
  component: Products,
});

function Products() {
  const { products, setProducts, role, notify } = useEzStock();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const admin = role === "Administrador";
  const visible = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "Todos" ||
        (filter === "Baixo" && p.stock > 0 && p.stock <= p.min) ||
        (filter === "Sem estoque" && p.stock === 0) ||
        (filter === "Inativos" && !p.active)),
  );

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const item: Product = {
      id: editing?.id || Date.now(),
      name: String(data.get("name")),
      sku: String(data.get("sku")),
      category: String(data.get("category")),
      stock: Number(data.get("stock")),
      min: Number(data.get("min")),
      price: Number(data.get("price")),
      active: editing?.active ?? true,
    };
    setProducts(editing ? products.map((p) => (p.id === editing.id ? item : p)) : [item, ...products]);
    setEditing(undefined);
    notify(editing ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
  };

  return (
    <>
      <PageHead title="Produtos" subtitle="Gerencie os produtos e acompanhe os níveis de estoque." action={admin ? <Button icon="plus" onClick={() => setEditing(null)}>Novo produto</Button> : undefined} />
      <section className="card table-card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." /></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por status">
            <option>Todos</option><option>Baixo</option><option>Sem estoque</option><option>Inativos</option>
          </select>
          <button className="filter-button">Categoria <Icon name="chevron" size={15} /></button>
          <span className="result-count">{visible.length} produtos</span>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Preço</th><th>Status</th><th /></tr></thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td><div className="product-cell"><div className="product-thumb">{p.name[0]}</div><div><strong>{p.name}</strong><span>{p.sku}</span></div></div></td>
                    <td>{p.category}</td>
                    <td><strong>{p.stock}</strong> un. <span className="min-stock">mín. {p.min}</span></td>
                    <td>{formatPrice(p.price)}</td>
                    <td><Status stock={p.stock} min={p.min} active={p.active} /></td>
                    <td>
                      <button className="icon-button" onClick={() => admin && setEditing(p)} title={admin ? "Editar" : "Sem permissão"} aria-label={admin ? `Editar ${p.name}` : "Sem permissão"}>
                        <Icon name={admin ? "edit" : "eye"} size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhum produto encontrado" text="Tente ajustar a busca ou os filtros selecionados." />
        )}
        <div className="pagination">
          <span>Mostrando 1–{visible.length} de {visible.length}</span>
          <div><button disabled>Anterior</button><button className="active">1</button><button>Próxima</button></div>
        </div>
      </section>
      {editing !== undefined && (
        <Modal title={editing ? "Editar produto" : "Cadastrar produto"} subtitle="Preencha os dados para manter seu estoque organizado." onClose={() => setEditing(undefined)}>
          <form onSubmit={save} className="modal-form">
            <div className="form-grid">
              <Field label="Nome do produto"><input name="name" defaultValue={editing?.name} required placeholder="Ex.: Shampoo Nutritivo 300ml" /></Field>
              <Field label="Código (SKU)"><input name="sku" defaultValue={editing?.sku} required placeholder="PRO-0001" /></Field>
              <Field label="Categoria">
                <select name="category" defaultValue={editing?.category || "Cabelos"}>
                  <option>Cabelos</option><option>Maquiagem</option><option>Unhas</option><option>Corpo e banho</option><option>Acessórios</option>
                </select>
              </Field>
              <Field label="Preço de venda"><input name="price" defaultValue={editing?.price} required type="number" step="0.01" placeholder="0,00" /></Field>
              <Field label="Estoque atual" hint={editing ? "Alterações de saldo devem ser feitas em Movimentações." : undefined}>
                <input name="stock" defaultValue={editing?.stock || 0} readOnly={!!editing} type="number" min="0" />
              </Field>
              <Field label="Estoque mínimo"><input name="min" defaultValue={editing?.min || 5} required type="number" min="0" /></Field>
            </div>
            {editing && <div className="info-strip"><Icon name="alert" />Este produto possui histórico. Para removê-lo das operações, use “Inativar produto”.</div>}
            <footer>
              {editing?.active && (
                <Button
                  variant="danger-ghost"
                  onClick={() => {
                    setProducts(products.map((p) => (p.id === editing.id ? { ...p, active: false } : p)));
                    setEditing(undefined);
                    notify("Produto inativado. O histórico foi preservado.");
                  }}
                >
                  Inativar produto
                </Button>
              )}
              <span />
              <Button variant="secondary" onClick={() => setEditing(undefined)}>Cancelar</Button>
              <Button type="submit">Salvar produto</Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
