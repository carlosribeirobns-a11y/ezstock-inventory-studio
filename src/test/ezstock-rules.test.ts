import { describe, expect, it } from "vitest";
import { adjustmentError, movementError, roleForEmail, stockStatus } from "@/lib/ezstock/data";

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
    expect(movementError("Saída", 5, 4)).toBe("Saída não permitida. O estoque disponível é de 4 unidades.");
    expect(movementError("Saída", 4, 4)).toBeNull();
  });

  it("requires a quantity greater than zero", () => {
    expect(movementError("Entrada", 0, 10)).toBe("Informe uma quantidade maior que zero.");
  });

  it("requires a reason and a real difference for inventory adjustments", () => {
    expect(adjustmentError(3, 5, "  ")).toBe("Informe o motivo do ajuste para manter a rastreabilidade.");
    expect(adjustmentError(5, 5, "Contagem mensal")).toBe(
      "A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.",
    );
    expect(adjustmentError(2.5, 5, "Contagem mensal")).toBe(
      "Informe uma quantidade física válida, sem casas decimais.",
    );
    expect(adjustmentError(3, 5, "Avaria")).toBeNull();
  });

  it("gives the admin view only to the admin demo e-mail", () => {
    expect(roleForEmail(" Admin@PontoDaBeleza.com.br ")).toBe("Administrador");
    expect(roleForEmail("lucas@pontodabeleza.com.br")).toBe("Colaborador");
  });
});
