import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Icon, PageHead, Status, useGo } from "@/components/ezstock/ui";
import { firstName, formatMovementDate, formatSigned, movementLabel, signedQuantity, startOfDay } from "@/lib/ezstock/data";
import { movementsQuery, productsQuery } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";
import { useMe } from "@/lib/ezstock/use-me";

export const Route = createFileRoute("/_authenticated/_painel/dashboard")({
  head: () => ezHead("Dashboard", "Visão geral do estoque: totais, produtos em falta, alertas de reposição e movimentações recentes."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(movementsQuery)]),
  component: Dashboard,
});

function Dashboard() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: movements } = useSuspenseQuery(movementsQuery);
  const me = useMe();
  const go = useGo();
  const active = products.filter((p) => p.active);
  const low = active.filter((p) => p.stock > 0 && p.stock <= p.min_stock);
  const out = active.filter((p) => p.stock === 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const newThisMonth = products.filter((p) => new Date(p.created_at).getTime() >= monthStart).length;
  const today = startOfDay(now).getTime();
  const yesterday = today - 86_400_000;
  const todayCount = movements.filter((m) => new Date(m.created_at).getTime() >= today).length;
  const yesterdayCount = movements.filter((m) => {
    const t = new Date(m.created_at).getTime();
    return t >= yesterday && t < today;
  }).length;
  const diff = todayCount - yesterdayCount;
  const admin = me.isAdmin;

  return (
    <>
      <PageHead title={`Olá, ${firstName(me.fullName)}!`} subtitle="Veja como está o estoque da Ponto da Beleza hoje." action={<Button icon="plus" onClick={() => go("movimentacoes")}>Nova movimentação</Button>} />
      <div className="metric-grid">
        <article className="metric"><div className="metric-icon blue"><Icon name="box" /></div><span>Total de produtos</span><strong>{active.length}</strong><small><b>+{newThisMonth}</b> este mês</small></article>
        <article className="metric"><div className="metric-icon amber"><Icon name="alert" /></div><span>Estoque baixo</span><strong>{low.length}</strong><small className="amber-text">Precisam de atenção</small></article>
        <article className="metric"><div className="metric-icon red"><Icon name="box" /></div><span>Sem estoque</span><strong>{out.length}</strong><small className="red-text">Reposição necessária</small></article>
        <article className="metric"><div className="metric-icon green"><Icon name="swap" /></div><span>Movimentações hoje</span><strong>{todayCount}</strong><small><b>{formatSigned(diff) || "0"}</b> vs. ontem</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div><h2>Movimentações recentes</h2><p>Últimas entradas e saídas registradas</p></div>
            <button className="text-action" onClick={() => go("historico")}>Ver histórico <Icon name="arrow" size={16} /></button>
          </div>
          <div className="activity-list">
            {movements.length === 0 && <div className="mini-empty">Nenhuma movimentação registrada ainda.</div>}
            {movements.slice(0, 4).map((m) => {
              const q = signedQuantity(m.type, m.quantity);
              return (
                <div className="activity" key={m.id}>
                  <div className={`movement-icon ${q >= 0 ? "in" : "out"}`}><Icon name={m.type === "entrada" ? "plus" : m.type === "ajuste" ? "edit" : "swap"} /></div>
                  <div><strong>{m.product}</strong><span>{movementLabel[m.type]} por {m.user}</span></div>
                  <div className="activity-value">
                    <strong className={q >= 0 ? "positive" : "negative"}>{formatSigned(q)} un.</strong>
                    <span>{formatMovementDate(m.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><div><h2>Atenção necessária</h2><p>Produtos que precisam de reposição</p></div><span className="count-badge">{low.length + out.length}</span></div>
          <div className="attention-list">
            {low.length + out.length === 0 && <div className="mini-empty">Tudo certo! Nenhum produto abaixo do mínimo.</div>}
            {[...out, ...low].map((p) => (
              <button key={p.id} onClick={() => go("produtos")}>
                <div className="product-thumb">{p.name.slice(0, 1)}</div>
                <div><strong>{p.name}</strong><span>{p.sku} · Mín. {p.min_stock} un.</span></div>
                <Status stock={p.stock} min={p.min_stock} />
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
          <button className="full-link" onClick={() => go("produtos")}>Ver todos os produtos</button>
        </section>
      </div>
      <section className="card quick-card">
        <div><h2>Ações rápidas</h2><p>Atalhos para tarefas frequentes</p></div>
        <div className="quick-actions">
          <button onClick={() => go("produtos")}><Icon name={admin ? "plus" : "search"} /><span><strong>{admin ? "Novo produto" : "Consultar produtos"}</strong><small>{admin ? "Cadastre um item" : "Confira os saldos"}</small></span></button>
          <button onClick={() => go("movimentacoes")}><Icon name="swap" /><span><strong>Registrar entrada</strong><small>Atualize o estoque</small></span></button>
          <button onClick={() => go(admin ? "relatorios" : "ajustes")}><Icon name={admin ? "chart" : "edit"} /><span><strong>{admin ? "Gerar relatório" : "Ajustar inventário"}</strong><small>{admin ? "Analise resultados" : "Corrija divergências"}</small></span></button>
        </div>
      </section>
    </>
  );
}
