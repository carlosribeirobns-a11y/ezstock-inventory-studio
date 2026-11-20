import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Field, Icon, PageHead, Status } from "@/components/ezstock/ui";
import { formatNow, movementError } from "@/lib/ezstock/data";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/movimentacoes")({
  head: () => ezHead("Movimentações", "Registre entradas e saídas de produtos e mantenha os saldos do estoque sempre atualizados."),
  component: Movements,
});

function Movements() {
  const { products, setProducts, movements, setMovements, currentUser, notify } = useEzStock();
  const [type, setType] = useState<"Entrada" | "Saída">("Entrada");
  const [productId, setProductId] = useState(() => products.find((p) => p.active)?.id ?? products[0]?.id ?? 0);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const product = products.find((p) => p.id === productId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const problem = movementError(type, qty, product.stock);
    if (problem) return setError(problem);
    setProducts(products.map((p) => (p.id === productId ? { ...p, stock: type === "Entrada" ? p.stock + qty : p.stock - qty } : p)));
    setMovements([{ id: Date.now(), product: product.name, type, qty, date: formatNow(), user: currentUser }, ...movements]);
    setError("");
    notify(`${type} de ${qty} unidade(s) registrada com sucesso.`);
  };

  return (
    <>
      <PageHead title="Movimentações" subtitle="Registre entradas e saídas para manter os saldos atualizados." />
      <div className="movement-layout">
        <section className="card movement-form-card">
          <div className="card-head"><div><h2>Nova movimentação</h2><p>Preencha os dados da operação</p></div></div>
          <form onSubmit={submit} className="movement-form">
            <Field label="Tipo de movimentação">
              <div className="segmented">
                <button type="button" className={type === "Entrada" ? "active in" : ""} onClick={() => { setType("Entrada"); setError(""); }}><Icon name="plus" />Entrada</button>
                <button type="button" className={type === "Saída" ? "active out" : ""} onClick={() => setType("Saída")}><Icon name="swap" />Saída</button>
              </div>
            </Field>
            <Field label="Produto">
              <select value={productId} onChange={(e) => { setProductId(Number(e.target.value)); setError(""); }}>
                {products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </select>
            </Field>
            {product && (
              <div className="stock-preview">
                <div className="product-thumb">{product.name[0]}</div>
                <div><span>Estoque disponível</span><strong>{product.stock} unidades</strong></div>
                <Status stock={product.stock} min={product.min} />
              </div>
            )}
            <div className="form-grid">
              <Field label="Quantidade"><input type="number" min="1" value={qty} onChange={(e) => { setQty(Number(e.target.value)); setError(""); }} /></Field>
              <Field label="Data"><input type="date" defaultValue="2025-06-20" /></Field>
            </div>
            <Field label="Observação (opcional)"><input placeholder="Ex.: Venda no balcão, reposição do fornecedor..." /></Field>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <Button type="submit" disabled={type === "Saída" && product?.stock === 0}>Confirmar {type.toLowerCase()}</Button>
          </form>
        </section>
        <aside className="side-stack">
          <section className="card rule-card">
            <div className="metric-icon blue"><Icon name="alert" /></div>
            <h3>Regras de segurança</h3>
            <ul><li>O saldo nunca ficará negativo.</li><li>Saídas maiores que o estoque são bloqueadas.</li><li>Toda alteração fica registrada no histórico.</li></ul>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Últimos registros</h2></div></div>
            {movements.slice(0, 3).map((m) => (
              <div className="mini-movement" key={m.id}>
                <span className={m.type === "Entrada" ? "positive" : "negative"}>{m.type === "Entrada" ? "+" : "−"}{m.qty}</span>
                <div><strong>{m.product}</strong><small>{m.date}</small></div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
