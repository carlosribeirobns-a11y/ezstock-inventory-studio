import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Icon, Modal, PageHead, useGo } from "@/components/ezstock/ui";
import { adjustmentError, adjustmentNeedsApproval, errorMessage, formatMovementDate, formatNow, formatSigned } from "@/lib/ezstock/data";
import { adjustmentRequestsQuery, movementsQuery, productsQuery, type AdjustmentRequest } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/ajustes")({
  head: () => ezHead("Ajuste de inventário", "Corrija divergências entre a contagem física e o saldo do sistema, com registro auditável."),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(movementsQuery),
      context.queryClient.ensureQueryData(adjustmentRequestsQuery),
    ]),
  component: InventoryAdjustment,
});

function InventoryAdjustment() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: movements } = useSuspenseQuery(movementsQuery);
  const { data: requests } = useSuspenseQuery(adjustmentRequestsQuery);
  const me = useMe();
  const needsApproval = adjustmentNeedsApproval(me.role);
  const [rejecting, setRejecting] = useState<AdjustmentRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const pending = requests.filter((r) => r.status === "pendente");
  const notify = useNotify();
  const go = useGo();
  const queryClient = useQueryClient();
  const activeProducts = products.filter((p) => p.active);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? "");
  const [countedStock, setCountedStock] = useState(activeProducts[0]?.stock ?? 0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const product = products.find((p) => p.id === productId);
  const difference = product ? countedStock - product.stock : 0;
  const recentAdjustments = movements.filter((m) => m.type === "ajuste").slice(0, 3);

  const selectProduct = (id: string) => {
    setProductId(id);
    setCountedStock(products.find((p) => p.id === id)?.stock ?? 0);
    setError("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!product) return setError("Selecione um produto ativo.");
    const problem = adjustmentError(countedStock, product.stock, reason);
    if (problem) return setError(problem);
    setConfirming(true);
  };

  const confirm = async () => {
    if (!product) return;
    setBusy(true);
    const args = { _product_id: product.id, _counted: countedStock, _reason: reason.trim() };
    const { error: err } = needsApproval
      ? await supabase.rpc("request_adjustment", args)
      : await supabase.rpc("adjust_inventory", args);
    setBusy(false);
    setConfirming(false);
    if (err) return setError(errorMessage(err));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["adjustment-requests"] }),
    ]);
    setReason("");
    notify(needsApproval ? "Solicitação enviada. Um administrador vai aprovar ou recusar o ajuste." : `Inventário ajustado. Novo saldo: ${countedStock} unidade(s).`);
  };

  const review = async (request: AdjustmentRequest, approve: boolean, note = "") => {
    setBusy(true);
    const { error: err } = await supabase.rpc("review_adjustment", { _request_id: request.id, _approve: approve, _note: note.trim() });
    setBusy(false);
    if (err) return notify(errorMessage(err), "error");
    setRejecting(null);
    setRejectNote("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["adjustment-requests"] }),
    ]);
    notify(approve ? `Ajuste aprovado. Novo saldo de ${request.product}: ${request.counted} un.` : "Solicitação recusada.");
  };

  const statusBadge = (r: AdjustmentRequest) =>
    r.status === "pendente" ? <span className="badge warning"><i />Pendente</span>
    : r.status === "aprovado" ? <span className="badge success"><i />Aprovado</span>
    : <span className="badge danger"><i />Recusado</span>;

  return (
    <>
      <PageHead title="Ajuste de inventário" subtitle="Corrija divergências entre a contagem física e o saldo registrado no sistema." action={<Button variant="secondary" icon="clock" onClick={() => go("historico")}>Ver histórico</Button>} />
      <div className="movement-layout">
        <section className="card movement-form-card">
          <div className="card-head">
            <div><h2>Novo ajuste</h2><p>Informe a quantidade encontrada na contagem física</p></div>
            <span className="audit-badge"><Icon name="check" size={14} />Operação auditável</span>
          </div>
          {activeProducts.length === 0 ? (
            <div className="mini-empty">Cadastre um produto ativo para ajustar o inventário.</div>
          ) : (
            <form onSubmit={submit} className="movement-form">
              <Field label="Produto">
                <select value={productId} onChange={(e) => selectProduct(e.target.value)}>
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
              <div className="audit-info"><Icon name="clock" /><div><strong>Registro automático</strong><span>{formatNow()} · {me.fullName}</span></div></div>
              {error && <div className="inline-error"><Icon name="alert" />{error}</div>}
              <Button type="submit">{needsApproval ? "Revisar e enviar solicitação" : "Revisar e confirmar ajuste"}</Button>
            </form>
          )}
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
                  <span className={m.quantity >= 0 ? "positive" : "negative"}>{formatSigned(m.quantity)}</span>
                  <div><strong>{m.product}</strong><small>{formatMovementDate(m.created_at)} · {m.user}</small></div>
                </div>
              ))
            ) : (
              <div className="mini-empty">Nenhum ajuste registrado ainda.</div>
            )}
          </section>
        </aside>
      </div>
      <section className="card table-card adjustment-requests">
        <div className="card-head">
          <div>
            <h2>{needsApproval ? "Minhas solicitações de ajuste" : "Solicitações de ajuste"}</h2>
            <p>{needsApproval ? "Acompanhe a análise dos ajustes que você enviou" : `${pending.length} ${pending.length === 1 ? "solicitação pendente" : "solicitações pendentes"} de colaboradores`}</p>
          </div>
        </div>
        {requests.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Produto</th><th>Saldo → Contagem</th><th>Motivo</th><th>Solicitante</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td><div className="product-cell"><div className="product-thumb">{r.product[0]}</div><div><strong>{r.product}</strong><span>{r.sku}</span></div></div></td>
                    <td>{r.system_stock} → <strong>{r.counted}</strong> un. <span className={r.counted - r.system_stock >= 0 ? "positive" : "negative"}>({formatSigned(r.counted - r.system_stock)})</span></td>
                    <td>{r.reason}{r.review_note && <small className="request-note">Análise: {r.review_note}</small>}</td>
                    <td>{r.requester}<small className="request-note">{formatMovementDate(r.created_at)}</small></td>
                    <td>{statusBadge(r)}{r.reviewer && <small className="request-note">por {r.reviewer}</small>}</td>
                    <td>
                      {!needsApproval && r.status === "pendente" && (
                        <div className="row-actions">
                          <button className="icon-button" disabled={busy} onClick={() => review(r, true)} title="Aprovar" aria-label={`Aprovar ajuste de ${r.product}`}><Icon name="check" size={18} /></button>
                          <button className="icon-button" disabled={busy} onClick={() => setRejecting(r)} title="Recusar" aria-label={`Recusar ajuste de ${r.product}`}><Icon name="trash" size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mini-empty">Nenhuma solicitação de ajuste registrada.</div>
        )}
      </section>
      {rejecting && (
        <Modal title="Recusar solicitação" subtitle={`${rejecting.product} · ${rejecting.requester}`} onClose={() => setRejecting(null)}>
          <div className="modal-form">
            <Field label="Motivo da recusa">
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} maxLength={240} placeholder="Ex.: Recontagem não confirmou a divergência." />
            </Field>
            <footer>
              <span />
              <Button variant="secondary" onClick={() => setRejecting(null)}>Voltar</Button>
              <Button variant="danger-ghost" disabled={busy || !rejectNote.trim()} onClick={() => review(rejecting, false, rejectNote)}>Recusar ajuste</Button>
            </footer>
          </div>
        </Modal>
      )}
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
              <div><dt>Responsável</dt><dd>{me.fullName}</dd></div>
              <div><dt>Data e hora</dt><dd>{formatNow()}</dd></div>
              <div><dt>Motivo</dt><dd>{reason}</dd></div>
            </dl>
            <div className="info-strip"><Icon name="alert" />{needsApproval ? "O estoque só será alterado depois que um administrador aprovar a solicitação." : "Esta ação atualizará o estoque e criará um registro permanente no histórico."}</div>
            <footer>
              <span />
              <Button variant="secondary" onClick={() => setConfirming(false)}>Voltar</Button>
              <Button onClick={confirm} disabled={busy}>{busy ? "Salvando..." : needsApproval ? "Enviar solicitação" : "Confirmar ajuste"}</Button>
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
}
