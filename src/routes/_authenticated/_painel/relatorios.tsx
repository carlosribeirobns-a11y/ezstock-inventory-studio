import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Empty, Field, PageHead, RestrictedCard } from "@/components/ezstock/ui";
import { downloadCsv, formatMovementDate, formatPrice, localISODate, movementLabel, signedQuantity } from "@/lib/ezstock/data";
import { movementsQuery, productsQuery } from "@/lib/ezstock/queries";
import { movementBuckets, movementTotals, periodLabel, periodStart, stockValue, turnover, type ReportPeriod } from "@/lib/ezstock/reports";
import { ezHead } from "@/lib/ezstock/seo";
import { useNotify } from "@/lib/ezstock/store";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/relatorios")({
  head: () => ezHead("Relatórios", "Indicadores do estoque: valor em estoque, entradas, saídas, giro e distribuição por categoria."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(movementsQuery)]),
  component: Reports,
});

type ReportKind = "geral" | "posicao" | "movimentacoes";

function Reports() {
  const me = useMe();
  if (!me.isAdmin) {
    return (
      <>
        <PageHead title="Relatórios" subtitle="Acompanhe indicadores e exporte dados do seu estoque." />
        <RestrictedCard text="Somente administradores podem visualizar e exportar relatórios." />
      </>
    );
  }
  return <ReportsView />;
}

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function ReportsView() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: movements } = useSuspenseQuery(movementsQuery);
  const notify = useNotify();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [kind, setKind] = useState<ReportKind>("geral");

  const start = periodStart(period);
  const inPeriod = movements.filter((m) => new Date(m.created_at).getTime() >= start.getTime());
  const totals = movementTotals(inPeriod);
  const value = stockValue(products);
  const turn = turnover(totals.outUnits, products);
  const buckets = movementBuckets(inPeriod, start);
  const maxBar = Math.max(1, ...buckets.flatMap((b) => [b.entradas, b.saidas]));
  const activeProducts = products.filter((p) => p.active);
  const byCategory = Object.entries(
    activeProducts.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c[1]));

  const exportReport = () => {
    const stamp = localISODate();
    if (kind === "posicao") {
      downloadCsv(`ezstock-posicao-estoque-${stamp}.csv`, [
        ["Produto", "Código", "Categoria", "Estoque", "Estoque mínimo", "Preço", "Valor em estoque", "Status"],
        ...products.map((p) => [p.name, p.sku, p.category, p.stock, p.min_stock, p.price.toFixed(2).replace(".", ","), (p.stock * p.price).toFixed(2).replace(".", ","), p.active ? "Ativo" : "Inativo"]),
      ]);
    } else if (kind === "movimentacoes") {
      downloadCsv(`ezstock-movimentacoes-${stamp}.csv`, [
        ["Data e hora", "Produto", "Código", "Tipo", "Quantidade", "Responsável", "Motivo / observação"],
        ...inPeriod.map((m) => [formatMovementDate(m.created_at), m.product, m.sku, movementLabel[m.type], signedQuantity(m.type, m.quantity), m.user, m.reason || m.note || ""]),
      ]);
    } else {
      downloadCsv(`ezstock-visao-geral-${stamp}.csv`, [
        ["Indicador", periodLabel[period]],
        ["Valor em estoque", formatPrice(value)],
        ["Total de entradas (un.)", totals.inUnits],
        ["Valor das entradas", formatPrice(totals.inValue)],
        ["Total de saídas (un.)", totals.outUnits],
        ["Valor das saídas", formatPrice(totals.outValue)],
        ["Giro de estoque", `${n(turn)}x`],
      ]);
    }
    notify("Relatório exportado em planilha (CSV).");
  };

  return (
    <>
      <PageHead title="Relatórios" subtitle="Acompanhe indicadores e exporte dados do seu estoque." action={<Button icon="download" onClick={exportReport}>Exportar relatório</Button>} />
      <div className="report-filters card">
        <Field label="Período">
          <select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)}>
            {(Object.keys(periodLabel) as ReportPeriod[]).map((p) => <option key={p} value={p}>{periodLabel[p]}</option>)}
          </select>
        </Field>
        <Field label="Tipo de relatório (exportação)">
          <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
            <option value="geral">Visão geral</option><option value="posicao">Posição de estoque</option><option value="movimentacoes">Movimentações</option>
          </select>
        </Field>
      </div>
      <div className="metric-grid report-metrics">
        <article className="metric"><span>Valor em estoque</span><strong>{formatPrice(value)}</strong><small>{activeProducts.length} produtos ativos</small></article>
        <article className="metric"><span>Total de entradas</span><strong>{totals.inUnits} un.</strong><small>{formatPrice(totals.inValue)}</small></article>
        <article className="metric"><span>Total de saídas</span><strong>{totals.outUnits} un.</strong><small>{formatPrice(totals.outValue)}</small></article>
        <article className="metric"><span>Giro de estoque</span><strong>{n(turn)}x</strong><small>Saídas ÷ estoque atual</small></article>
      </div>
      <div className="reports-grid">
        <section className="card">
          <div className="card-head">
            <div><h2>Movimentações no período</h2><p>Entradas e saídas · {periodLabel[period].toLowerCase()}</p></div>
            <div className="chart-legend"><span><i className="blue-dot" />Entradas</span><span><i className="orange-dot" />Saídas</span></div>
          </div>
          {inPeriod.some((m) => m.type !== "ajuste") ? (
            <div className="bar-chart">
              {buckets.map((b) => (
                <div className="bar-group" key={b.label}>
                  <div>
                    <i className="bar in" style={{ height: `${(b.entradas / maxBar) * 100}%` }} title={`${b.entradas} un.`} />
                    <i className="bar out" style={{ height: `${(b.saidas / maxBar) * 100}%` }} title={`${b.saidas} un.`} />
                  </div>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Nenhuma movimentação no período" text="Selecione outro período para visualizar as entradas e saídas." />
          )}
        </section>
        <section className="card">
          <div className="card-head"><div><h2>Estoque por categoria</h2><p>Distribuição dos produtos ativos</p></div></div>
          <div className="category-bars">
            {byCategory.map(([name, count]) => (
              <div key={name}>
                <span><b>{name}</b><small>{count} {count === 1 ? "produto" : "produtos"}</small></span>
                <i><b style={{ width: `${(count / maxCat) * 100}%` }} /></i>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
