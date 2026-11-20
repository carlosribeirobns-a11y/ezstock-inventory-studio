import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Empty, Field, PageHead, RestrictedCard } from "@/components/ezstock/ui";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/relatorios")({
  head: () => ezHead("Relatórios", "Indicadores do estoque: valor em estoque, entradas, saídas, giro e distribuição por categoria."),
  component: Reports,
});

const weeks: [string, number, number][] = [["1ª sem", 52, 38], ["2ª sem", 72, 55], ["3ª sem", 46, 62], ["4ª sem", 84, 48]];
const categories: [string, number, number][] = [["Cabelos", 68, 100], ["Maquiagem", 52, 76], ["Unhas", 41, 60], ["Corpo e banho", 36, 53], ["Cuidados faciais", 29, 43]];

function Reports() {
  const { role, notify } = useEzStock();
  const [empty, setEmpty] = useState(false);
  if (role !== "Administrador") {
    return (
      <>
        <PageHead title="Relatórios" subtitle="Acompanhe indicadores e exporte dados do seu estoque." />
        <RestrictedCard text="Somente administradores podem visualizar e exportar relatórios." />
      </>
    );
  }
  return (
    <>
      <PageHead title="Relatórios" subtitle="Acompanhe indicadores e exporte dados do seu estoque." action={<Button icon="download" onClick={() => notify("Relatório exportado em PDF com sucesso.")}>Exportar relatório</Button>} />
      <div className="report-filters card">
        <Field label="Período">
          <select onChange={(e) => setEmpty(e.target.value === "custom")}>
            <option value="month">Este mês</option><option value="week">Últimos 7 dias</option><option value="custom">Período sem movimentações</option>
          </select>
        </Field>
        <Field label="Tipo de relatório">
          <select><option>Visão geral</option><option>Posição de estoque</option><option>Movimentações</option></select>
        </Field>
        <Button variant="secondary">Aplicar filtros</Button>
      </div>
      {empty ? (
        <section className="card"><Empty title="Nenhuma movimentação no período" text="Selecione outro período para visualizar os indicadores do estoque." /></section>
      ) : (
        <>
          <div className="metric-grid report-metrics">
            <article className="metric"><span>Valor em estoque</span><strong>R$ 38.420,80</strong><small><b>+4,2%</b> no período</small></article>
            <article className="metric"><span>Total de entradas</span><strong>186 un.</strong><small>R$ 7.842,50</small></article>
            <article className="metric"><span>Total de saídas</span><strong>142 un.</strong><small>R$ 6.293,20</small></article>
            <article className="metric"><span>Giro de estoque</span><strong>1,8x</strong><small>Média mensal</small></article>
          </div>
          <div className="reports-grid">
            <section className="card">
              <div className="card-head">
                <div><h2>Movimentações no período</h2><p>Entradas e saídas por semana</p></div>
                <div className="chart-legend"><span><i className="blue-dot" />Entradas</span><span><i className="orange-dot" />Saídas</span></div>
              </div>
              <div className="bar-chart">
                {weeks.map(([label, inPct, outPct]) => (
                  <div className="bar-group" key={label}>
                    <div><i className="bar in" style={{ height: `${inPct}%` }} /><i className="bar out" style={{ height: `${outPct}%` }} /></div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <div className="card-head"><div><h2>Estoque por categoria</h2><p>Distribuição dos produtos</p></div></div>
              <div className="category-bars">
                {categories.map(([name, count, pct]) => (
                  <div key={name}>
                    <span><b>{name}</b><small>{count} produtos</small></span>
                    <i><b style={{ width: `${pct}%` }} /></i>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
