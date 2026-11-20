import { createFileRoute } from "@tanstack/react-router";
import { Button, Icon, PageHead, Status, useGo } from "@/components/ezstock/ui";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/dashboard")({
  head: () => ezHead("Dashboard", "Visão geral do estoque: totais, produtos em falta, alertas de reposição e movimentações recentes."),
  component: Dashboard,
});

function Dashboard() {
  const { products, movements, role } = useEzStock();
  const go = useGo();
  const low = products.filter((p) => p.stock > 0 && p.stock <= p.min && p.active);
  const out = products.filter((p) => p.stock === 0 && p.active);
  const admin = role === "Administrador";
  return (
    <>
      <PageHead title="Olá, Marina!" subtitle="Veja como está o estoque da Ponto da Beleza hoje." action={<Button icon="plus" onClick={() => go("movimentacoes")}>Nova movimentação</Button>} />
      <div className="metric-grid">
        <article className="metric"><div className="metric-icon blue"><Icon name="box" /></div><span>Total de produtos</span><strong>248</strong><small><b>+12</b> este mês</small></article>
        <article className="metric"><div className="metric-icon amber"><Icon name="alert" /></div><span>Estoque baixo</span><strong>{low.length + 10}</strong><small className="amber-text">Precisam de atenção</small></article>
        <article className="metric"><div className="metric-icon red"><Icon name="box" /></div><span>Sem estoque</span><strong>{out.length + 5}</strong><small className="red-text">Reposição necessária</small></article>
        <article className="metric"><div className="metric-icon green"><Icon name="swap" /></div><span>Movimentações hoje</span><strong>34</strong><small><b>+8%</b> vs. ontem</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div><h2>Movimentações recentes</h2><p>Últimas entradas e saídas registradas</p></div>
            <button className="text-action" onClick={() => go("historico")}>Ver histórico <Icon name="arrow" size={16} /></button>
          </div>
          <div className="activity-list">
            {movements.slice(0, 4).map((m) => (
              <div className="activity" key={m.id}>
                <div className={`movement-icon ${m.type === "Entrada" ? "in" : "out"}`}><Icon name={m.type === "Entrada" ? "plus" : "swap"} /></div>
                <div><strong>{m.product}</strong><span>{m.type} por {m.user}</span></div>
                <div className="activity-value">
                  <strong className={m.type === "Entrada" ? "positive" : "negative"}>{m.type === "Entrada" ? "+" : "−"}{m.qty} un.</strong>
                  <span>{m.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><div><h2>Atenção necessária</h2><p>Produtos que precisam de reposição</p></div><span className="count-badge">{low.length + out.length}</span></div>
          <div className="attention-list">
            {[...out, ...low].map((p) => (
              <button key={p.id} onClick={() => go("produtos")}>
                <div className="product-thumb">{p.name.slice(0, 1)}</div>
                <div><strong>{p.name}</strong><span>{p.sku} · Mín. {p.min} un.</span></div>
                <Status stock={p.stock} min={p.min} />
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
