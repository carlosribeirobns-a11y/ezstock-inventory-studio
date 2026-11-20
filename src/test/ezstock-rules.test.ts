import { describe, expect, it } from "vitest";
import { adjustmentError, movementError, signedQuantity, stockStatus } from "@/lib/ezstock/data";
import { movementBuckets, movementTotals, stockValue, turnover } from "@/lib/ezstock/reports";

describe("EzStock stock rules", () => {
  it("marks a product with zero units as out of stock", () => {
    expect(stockStatus(0, 5)).toBe("Sem estoque");
  });

  it("marks stock at or below the minimum as low", () => {
    expect(stockStatus(6, 6)).toBe("Estoque baixo");
    expect(stockStatus(7, 6)).toBe("Em estoque");
  });

  it("shows inactive products as inactive regardless of stock", () => {
    expect(stockStatus(0, 5, false)).toBe("Inativo");
  });

  it("blocks an exit larger than the available stock so the balance never goes negative", () => {
    expect(movementError("saida", 5, 4)).toBe("Saída não permitida. O estoque disponível é de 4 unidades.");
    expect(movementError("saida", 4, 4)).toBeNull();
  });

  it("requires a whole quantity greater than zero", () => {
    expect(movementError("entrada", 0, 10)).toBe("Informe uma quantidade maior que zero.");
    expect(movementError("entrada", 1.5, 10)).toBe("Informe uma quantidade maior que zero.");
  });

  it("requires a reason and a real difference for inventory adjustments", () => {
    expect(adjustmentError(3, 5, "  ")).toBe("Informe o motivo do ajuste para manter a rastreabilidade.");
    expect(adjustmentError(5, 5, "Contagem mensal")).toBe("A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.");
    expect(adjustmentError(2.5, 5, "Contagem mensal")).toBe("Informe uma quantidade física válida, sem casas decimais.");
    expect(adjustmentError(3, 5, "Avaria")).toBeNull();
  });

  it("shows exits as negative and adjustments with their own sign", () => {
    expect(signedQuantity("saida", 4)).toBe(-4);
    expect(signedQuantity("entrada", 4)).toBe(4);
    expect(signedQuantity("ajuste", -5)).toBe(-5);
  });
});

describe("EzStock reports", () => {
  const products = [
    { stock: 10, price: 2.5, active: true },
    { stock: 4, price: 10, active: true },
    { stock: 100, price: 1, active: false },
  ];

  it("values stock as quantity times price of active products only", () => {
    expect(stockValue(products)).toBe(65);
  });

  it("totals entries and exits in units and value, ignoring adjustments", () => {
    const totals = movementTotals([
      { type: "entrada", quantity: 3, price: 10, created_at: "2026-11-02T10:00:00" },
      { type: "saida", quantity: 2, price: 5, created_at: "2026-11-03T10:00:00" },
      { type: "ajuste", quantity: -1, price: 5, created_at: "2026-11-03T11:00:00" },
    ]);
    expect(totals).toEqual({ inUnits: 3, inValue: 30, outUnits: 2, outValue: 10 });
  });

  it("computes turnover as units out divided by active units in stock", () => {
    expect(turnover(7, products)).toBe(0.5);
    expect(turnover(3, [])).toBe(0);
  });

  it("groups a month into weekly buckets", () => {
    const buckets = movementBuckets(
      [
        { type: "entrada", quantity: 5, price: 1, created_at: "2026-11-01T09:00:00" },
        { type: "saida", quantity: 2, price: 1, created_at: "2026-11-09T09:00:00" },
      ],
      new Date(2026, 10, 1),
      new Date(2026, 10, 20, 12),
    );
    expect(buckets.map((b) => b.label)).toEqual(["1ª sem", "2ª sem", "3ª sem"]);
    expect(buckets[0]?.entradas).toBe(5);
    expect(buckets[1]?.saidas).toBe(2);
  });
});
