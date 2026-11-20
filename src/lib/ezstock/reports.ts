import { startOfDay, type MovementType } from "./data";

export type ReportPeriod = "month" | "week" | "30days";

export const periodLabel: Record<ReportPeriod, string> = {
  month: "Este mês",
  week: "Últimos 7 dias",
  "30days": "Últimos 30 dias",
};

export function periodStart(period: ReportPeriod, now = new Date()) {
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const s = startOfDay(now);
  s.setDate(s.getDate() - (period === "week" ? 6 : 29));
  return s;
}

type ProductLike = { stock: number; price: number; active: boolean };
type MovementLike = { type: MovementType; quantity: number; created_at: string; price: number };

/** Value of what is on the shelf: stock × price of active products. */
export function stockValue(products: ProductLike[]) {
  return products.filter((p) => p.active).reduce((sum, p) => sum + p.stock * p.price, 0);
}

export function movementTotals(movements: MovementLike[]) {
  let inUnits = 0, inValue = 0, outUnits = 0, outValue = 0;
  for (const m of movements) {
    if (m.type === "entrada") {
      inUnits += m.quantity;
      inValue += m.quantity * m.price;
    } else if (m.type === "saida") {
      outUnits += m.quantity;
      outValue += m.quantity * m.price;
    }
  }
  return { inUnits, inValue, outUnits, outValue };
}

/** Stock turnover in the period: units that left divided by units currently in stock. */
export function turnover(outUnits: number, products: ProductLike[]) {
  const units = products.filter((p) => p.active).reduce((s, p) => s + p.stock, 0);
  return units === 0 ? 0 : outUnits / units;
}

export type Bucket = { label: string; entradas: number; saidas: number };

/** Daily buckets for up to 7 days, otherwise 7-day buckets, from start to now. */
export function movementBuckets(movements: MovementLike[], start: Date, now = new Date()): Bucket[] {
  const days = Math.max(1, Math.round((startOfDay(now).getTime() - startOfDay(start).getTime()) / 86_400_000) + 1);
  const size = days <= 7 ? 1 : 7;
  const count = Math.ceil(days / size);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(startOfDay(start));
    d.setDate(d.getDate() + i * size);
    return {
      label: size === 1 ? `${weekday.format(d).replace(".", "")} ${d.getDate()}` : `${i + 1}ª sem`,
      entradas: 0,
      saidas: 0,
    };
  });
  for (const m of movements) {
    const idx = Math.floor((startOfDay(new Date(m.created_at)).getTime() - startOfDay(start).getTime()) / 86_400_000 / size);
    const b = buckets[idx];
    if (!b) continue;
    if (m.type === "entrada") b.entradas += m.quantity;
    if (m.type === "saida") b.saidas += m.quantity;
  }
  return buckets;
}
