import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Icon, PageHead } from "@/components/ezstock/ui";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/_painel/historico")({
  head: () => ezHead("Histórico", "Consulte todas as entradas, saídas e ajustes de inventário registrados, com responsável e motivo."),
  component: History,
});

function History() {
  const { movements } = useEzStock();
  const [query, setQuery] = useState("");
  const filtered = movements.filter((m) => m.product.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHead title="Histórico" subtitle="Consulte todas as movimentações realizadas no estoque." action={<Button variant="secondary" icon="download">Exportar</Button>} />
      <section className="card table-card">
        <div className="toolbar filters">
          <div className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto..." /></div>
          <select aria-label="Tipo"><option>Todos os tipos</option><option>Entradas</option><option>Saídas</option></select>
          <select aria-label="Período"><option>Últimos 30 dias</option><option>Hoje</option><option>Últimos 7 dias</option></select>
          <button className="link-button">Limpar filtros</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Data e hora</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo</th><th>Responsável</th></tr></thead>
            <tbody>
              {filtered.map((m) => {
                const signedQty = m.type === "Saída" ? -m.qty : m.qty;
                return (
                  <tr key={m.id}>
                    <td>{m.date}</td>
                    <td><strong>{m.product}</strong>{m.type === "Ajuste" && <span className="stock-change">{m.previousStock} → {m.newStock} un.</span>}</td>
                    <td><span className={`type-badge ${m.type === "Entrada" ? "in" : m.type === "Saída" ? "out" : "adjust"}`}>{m.type}</span></td>
                    <td><strong className={signedQty >= 0 ? "positive" : "negative"}>{signedQty > 0 ? "+" : signedQty < 0 ? "−" : ""}{Math.abs(signedQty)} un.</strong></td>
                    <td className="reason-cell">{m.reason || "—"}</td>
                    <td>{m.user}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
