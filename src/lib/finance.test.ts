import { describe, it, expect } from "vitest";
import { compute, type Item, type Expense, type Receipt } from "@/lib/finance";

const items: Item[] = [
  { id: "1", quantity: 2, description: "Painel", supplier: "EU", unit_cost: 100, sale_value: 300 },
  { id: "2", quantity: 1, description: "Inversor", supplier: "HELLIOS", unit_cost: 200, sale_value: 250 },
];
const expenses: Expense[] = [
  { id: "a", description: "Cabos", amount: 100, payer: "COMPARTILHADO", is_card_fee: false },
  { id: "b", description: "Canaletas", amount: 27, payer: "EU", is_card_fee: false },
  { id: "c", description: "Taxa", amount: 50, payer: "COMPARTILHADO", is_card_fee: true },
];
const receipts: Receipt[] = [
  { id: "x", description: "Cliente", amount: 1000, received_by: "EU", is_refund: false },
  { id: "y", description: "Reembolso canaletas", amount: 27, received_by: "EU", is_refund: true },
];

describe("divisão justa", () => {
  const r = compute(items, expenses, receipts);
  it("mão de obra = recebido líquido − vendas, 50/50, sem duplicar taxa", () => {
    expect(r.laborTotal).toBe(450);
    expect(r.eu.labor).toBe(225);
    expect(r.hellios.labor).toBe(225);
  });
  it("lucro de equipamento fica com quem forneceu", () => {
    expect(r.eu.equipmentProfit).toBe(100);
    expect(r.hellios.equipmentProfit).toBe(50);
  });
  it("reembolso não é contado duas vezes", () => {
    expect(r.eu.netProfit).toBe(100 + 225 - 50 - 27 + 27);
    expect(r.eu.netProfit + r.hellios.netProfit).toBeCloseTo(r.netProfit);
  });
  it("repasse entre os dois", () => {
    expect(r.transfer).toEqual({ from: "EU", to: "HELLIOS", amount: 475 });
  });
});
