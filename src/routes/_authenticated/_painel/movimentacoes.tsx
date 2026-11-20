import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Icon, PageHead, Status } from "@/components/ezstock/ui";
import { errorMessage, formatMovementDate, formatSigned, localISODate, movementError, signedQuantity } from "@/lib/ezstock/data";
import { movementsQuery, productsQuery } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_authenticated/_painel/movimentacoes")({
  head: () => ezHead("Movimentações", "Registre entradas e saídas de produtos e mantenha os saldos do estoque sempre atualizados."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(movementsQuery)]),
  component: Movements,
});

function Movements() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: movements } = useSuspenseQuery(movementsQuery);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const activeProducts = products.filter((p) => p.active);
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(() => localISODate());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const product = products.find((p) => p.id === productId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return setError("Selecione um produto ativo.");
    const problem = movementError(type, qty, product.stock);
    if (problem) return setError(problem);
    setBusy(true);
    const { error: err } = await supabase.rpc("register_movement", {
      _product_id: product.id,
      _type: type,
      _quantity: qty,
      _note: note,
      _movement_date: date,
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
    ]);
    setError("");
    setNote("");
    notify(`${type === "entrada" ? "Entrada" : "Saída"} de ${qty} unidade(s) registrada com sucesso.`);
  };

  return (
    <>
      <PageHead title="Movimentações" subtitle="Registre entradas e saídas para manter os saldos atualizados." />
      <div className="movement-layout">
        <section className="card movement-form-card">
          <div className="card-head"><div><h2>Nova movimentação</h2><p>Preencha os dados da operação</p></div></div>
          {activeProducts.length === 0 ? (
            <div className="mini-empty">Cadastre um produto ativo para registrar movimentações.</div>
          ) : (
            <form onSubmit={submit} className="movement-form">
              <Field label="Tipo de movimentação">
                <div className="segmented">
                  <button type="button" className={type === "entrada" ? "active in" : ""} onClick={() => { setType("entrada"); setError(""); }}><Icon name="plus" />Entrada</button>
                  <button type="button" className={type === "saida" ? "active out" : ""} onClick={() => { setType("saida"); setError(""); }}><Icon name="swap" />Saída</button>
                </div>
              </Field>
              <Field label="Produto">
                <select value={productId} onChange={(e) => { setProductId(e.target.value); setError(""); }}>
                  {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                </select>
              </Field>
              {product && (
                <div className="stock-preview">
                  <div className="product-thumb">{product.name[0]}</div>
                  <div><span>Estoque disponível</span><strong>{product.stock} unidades</strong></div>
                  <Status stock={product.stock} min={product.min_stock} />
                </div>
              )}
              <div className="form-grid">
                <Field label="Quantidade"><input type="number" min="1" step="1" value={qty} onChange={(e) => { setQty(Number(e.target.value)); setError(""); }} /></Field>
                <Field label="Data"><input type="date" value={date} max={localISODate()} onChange={(e) => setDate(e.target.value)} required /></Field>
              </div>
              <Field label="Observação (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Ex.: Venda no balcão, reposição do fornecedor..." /></Field>
              {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
              <Button type="submit" disabled={busy || (type === "saida" && product?.stock === 0)}>{busy ? "Registrando..." : `Confirmar ${type === "entrada" ? "entrada" : "saída"}`}</Button>
            </form>
          )}
        </section>
        <aside className="side-stack">
          <section className="card rule-card">
            <div className="metric-icon blue"><Icon name="alert" /></div>
            <h3>Regras de segurança</h3>
            <ul><li>O saldo nunca ficará negativo.</li><li>Saídas maiores que o estoque são bloqueadas.</li><li>Toda alteração fica registrada no histórico.</li></ul>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Últimos registros</h2></div></div>
            {movements.length === 0 && <div className="mini-empty">Nenhum registro ainda.</div>}
            {movements.slice(0, 3).map((m) => {
              const q = signedQuantity(m.type, m.quantity);
              return (
                <div className="mini-movement" key={m.id}>
                  <span className={q >= 0 ? "positive" : "negative"}>{formatSigned(q)}</span>
                  <div><strong>{m.product}</strong><small>{formatMovementDate(m.created_at)} · {m.user}</small></div>
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </>
  );
}
