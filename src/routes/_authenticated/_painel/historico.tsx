import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Empty, Icon, PageHead } from "@/components/ezstock/ui";
import { downloadCsv, formatMovementDate, formatSigned, localISODate, movementLabel, signedQuantity, startOfDay, type MovementType } from "@/lib/ezstock/data";
import { movementsQuery } from "@/lib/ezstock/queries";
import { ezHead } from "@/lib/ezstock/seo";

export const Route = createFileRoute("/_authenticated/_painel/historico")({
  head: () => ezHead("Histórico", "Consulte todas as entradas, saídas e ajustes de inventário registrados, com responsável e motivo."),
  loader: ({ context }) => context.queryClient.ensureQueryData(movementsQuery),
  component: History,
});

type Period = "30" | "today" | "7" | "all";

function History() {
  const { data: movements } = useSuspenseQuery(movementsQuery);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [period, setPeriod] = useState<Period>("30");

  const since =
    period === "all" ? 0 : period === "today" ? startOfDay().getTime() : startOfDay().getTime() - (Number(period) - 1) * 86_400_000;
  const q = query.toLowerCase();
  const filtered = movements.filter(
    (m) =>
      (m.product.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)) &&
      (!type || m.type === type) &&
      new Date(m.created_at).getTime() >= since,
  );

  const exportCsv = () =>
    downloadCsv(`ezstock-historico-${localISODate()}.csv`, [
      ["Data e hora", "Produto", "Código", "Tipo", "Quantidade", "Saldo anterior", "Novo saldo", "Motivo / observação", "Responsável"],
      ...filtered.map((m) => [
        formatMovementDate(m.created_at),
        m.product,
        m.sku,
        movementLabel[m.type],
        signedQuantity(m.type, m.quantity),
        m.previous_stock,
        m.new_stock,
        m.reason || m.note || "",
        m.user,
      ]),
    ]);

  return (
    <>
      <PageHead title="Histórico" subtitle="Consulte todas as movimentações realizadas no estoque." action={<Button variant="secondary" icon="download" onClick={exportCsv} disabled={!filtered.length}>Exportar</Button>} />
      <section className="card table-card">
        <div className="toolbar filters">
          <div className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto..." /></div>
          <select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as MovementType | "")}>
            <option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option><option value="ajuste">Ajustes</option>
          </select>
          <select aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="30">Últimos 30 dias</option><option value="today">Hoje</option><option value="7">Últimos 7 dias</option><option value="all">Todo o período</option>
          </select>
          <button className="link-button" onClick={() => { setQuery(""); setType(""); setPeriod("30"); }}>Limpar filtros</button>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Data e hora</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo</th><th>Responsável</th></tr></thead>
              <tbody>
                {filtered.map((m) => {
                  const signedQty = signedQuantity(m.type, m.quantity);
                  return (
                    <tr key={m.id}>
                      <td>{formatMovementDate(m.created_at)}</td>
                      <td><strong>{m.product}</strong><span className="stock-change">{m.previous_stock} → {m.new_stock} un.</span></td>
                      <td><span className={`type-badge ${m.type === "entrada" ? "in" : m.type === "saida" ? "out" : "adjust"}`}>{movementLabel[m.type]}</span></td>
                      <td><strong className={signedQty >= 0 ? "positive" : "negative"}>{formatSigned(signedQty)} un.</strong></td>
                      <td className="reason-cell">{m.reason || m.note || "—"}</td>
                      <td>{m.user}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhuma movimentação encontrada" text="Ajuste a busca ou os filtros para ver outros registros." />
        )}
      </section>
    </>
  );
}
