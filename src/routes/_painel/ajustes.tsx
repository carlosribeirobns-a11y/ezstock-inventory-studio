import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Field, Icon, Modal, PageHead, useGo } from "@/components/ezstock/ui";
import { adjustmentError, formatNow, type Movement } from "@/lib/ezstock/data";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/ajustes")({
  head: () => ezHead("Ajuste de inventário", "Corrija divergências entre a contagem física e o saldo do sistema, com registro auditável."),
  component: InventoryAdjustment,
});

function InventoryAdjustment() {
  const { products, setProducts, movements, setMovements, currentUser, notify } = useEzStock();
  const go = useGo();
  const activeProducts = products.filter((p) => p.active);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? 0);
  const [countedStock, setCountedStock] = useState(activeProducts[0]?.stock ?? 0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const product = products.find((p) => p.id === productId);
  const difference = product ? countedStock - product.stock : 0;
  const recentAdjustments = movements.filter((m) => m.type === "Ajuste").slice(0, 3);

  const selectProduct = (id: number) => {
    const selected = products.find((p) => p.id === id);
    setProductId(id);
    setCountedStock(selected?.stock ?? 0);
    setError("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!product) return setError("Selecione um produto ativo.");
    const problem = adjustmentError(countedStock, product.stock, reason);
    if (problem) return setError(problem);
    setConfirming(true);
  };

  const confirm = () => {
    if (!product) return;
    const record: Movement = {
      id: Date.now(),
      product: product.name,
      type: "Ajuste",
      qty: difference,
      date: formatNow(),
      user: currentUser,
      reason: reason.trim(),
      previousStock: product.stock,
      newStock: countedStock,
    };
    setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: countedStock } : p)));
    setMovements([record, ...movements]);
    setConfirming(false);
    setReason("");
    notify(`Inventário ajustado. Novo saldo: ${countedStock} unidade(s).`);
  };

  return (
    <>
      <PageHead title="Ajuste de inventário" subtitle="Corrija divergências entre a contagem física e o saldo registrado no sistema." action={<Button variant="secondary" icon="clock" onClick={() => go("historico")}>Ver histórico</Button>} />
      <div className="movement-layout">
        <section className="card movement-form-card">
          <div className="card-head">
            <div><h2>Novo ajuste</h2><p>Informe a quantidade encontrada na contagem física</p></div>
            <span className="audit-badge"><Icon name="check" size={14} />Operação auditável</span>
          </div>
          <form onSubmit={submit} className="movement-form">
            <Field label="Produto">
              <select value={productId} onChange={(e) => selectProduct(Number(e.target.value))}>
                {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </select>
            </Field>
            {product && (
              <div className="stock-comparison">
                <div><span>Saldo no sistema</span><strong>{product.stock} un.</strong></div>
                <Icon name="arrow" />
                <div><span>Contagem física</span><strong className={difference !== 0 ? "blue-text" : ""}>{countedStock} un.</strong></div>
                <span className={`difference-pill ${difference > 0 ? "positive-diff" : difference < 0 ? "negative-diff" : ""}`}>{difference > 0 ? "+" : ""}{difference} un.</span>
              </div>
            )}
            <Field label="Quantidade física encontrada" hint="Informe o total contado, não apenas a diferença.">
              <input type="number" min="0" step="1" value={countedStock} onChange={(e) => { setCountedStock(Number(e.target.value)); setError(""); }} />
            </Field>
            <Field label="Motivo do ajuste">
              <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="Ex.: Divergência identificada no inventário mensal, avaria ou perda..." maxLength={240} required />
              <small className="char-count">{reason.length}/240</small>
            </Field>
            <div className="audit-info"><Icon name="clock" /><div><strong>Registro automático</strong><span>{formatNow()} · {currentUser}</span></div></div>
            {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
            <Button type="submit">Revisar e confirmar ajuste</Button>
          </form>
        </section>
        <aside className="side-stack">
          <section className="card rule-card">
            <div className="metric-icon blue"><Icon name="alert" /></div>
            <h3>Antes de confirmar</h3>
            <ul><li>Confira se o produto selecionado está correto.</li><li>Informe o total contado fisicamente.</li><li>O saldo anterior será preservado no histórico.</li><li>O ajuste não pode ser excluído após o registro.</li></ul>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Ajustes recentes</h2><p>Últimas correções registradas</p></div></div>
            {recentAdjustments.length ? (
              recentAdjustments.map((m) => (
                <div className="mini-movement" key={m.id}>
                  <span className={m.qty >= 0 ? "positive" : "negative"}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
                  <div><strong>{m.product}</strong><small>{m.date} · {m.user}</small></div>
                </div>
              ))
            ) : (
              <div className="mini-empty">Nenhum ajuste registrado nesta sessão.</div>
            )}
          </section>
        </aside>
      </div>
      {confirming && product && (
        <Modal title="Confirmar ajuste de inventário" subtitle="Revise os dados antes de atualizar o saldo." onClose={() => setConfirming(false)}>
          <div className="adjustment-review">
            <div className="review-product"><div className="product-thumb">{product.name[0]}</div><div><strong>{product.name}</strong><span>{product.sku}</span></div></div>
            <div className="review-values">
              <div><span>Saldo anterior</span><strong>{product.stock} un.</strong></div>
              <Icon name="arrow" />
              <div><span>Novo saldo</span><strong>{countedStock} un.</strong></div>
            </div>
            <dl>
              <div><dt>Diferença</dt><dd className={difference > 0 ? "positive" : "negative"}>{difference > 0 ? "+" : ""}{difference} unidades</dd></div>
              <div><dt>Responsável</dt><dd>{currentUser}</dd></div>
              <div><dt>Data e hora</dt><dd>{formatNow()}</dd></div>
              <div><dt>Motivo</dt><dd>{reason}</dd></div>
            </dl>
            <div className="info-strip"><Icon name="alert" />Esta ação atualizará o estoque e criará um registro permanente no histórico.</div>
            <footer>
              <span />
              <Button variant="secondary" onClick={() => setConfirming(false)}>Voltar</Button>
              <Button onClick={confirm}>Confirmar ajuste</Button>
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
}
