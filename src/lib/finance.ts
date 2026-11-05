export type Party = "EU" | "HELLIOS" | "COMPARTILHADO";
export type Person = "EU" | "HELLIOS";

export interface Item { id: string; quantity: number; description: string; supplier: Party; unit_cost: number; sale_value: number }
export interface Expense { id: string; description: string; amount: number | null; payer: Party; is_card_fee: boolean }
export interface Receipt { id: string; description: string; amount: number; received_by: Person; is_refund: boolean }

export interface PersonResult {
  equipmentCount: number;
  invested: number;
  revenue: number;
  equipmentProfit: number;
  labor: number;
  expenses: number;
  refunds: number;
  netProfit: number;
  entitled: number;
  received: number;
  pending: number;
}

const n = (v: unknown) => Number(v) || 0;
const share = (party: Party, p: Person) => (party === "COMPARTILHADO" ? 0.5 : party === p ? 1 : 0);

export const itemCost = (i: Item) => n(i.quantity) * n(i.unit_cost);
export const itemProfit = (i: Item) => n(i.sale_value) - itemCost(i);

/**
 * Regras:
 * - Cada um fica com a receita/lucro e custo dos equipamentos que forneceu (compartilhado = 50/50).
 * - Mão de obra = recebimentos do cliente − vendas de equipamentos − taxas do cartão, sempre 50/50.
 * - Despesas individuais ficam com quem pagou; compartilhadas são divididas igualmente.
 * - Reembolsos não entram na mão de obra: vão direto para quem recebeu, compensando a despesa.
 */
export function compute(items: Item[], expenses: Expense[], receipts: Receipt[]) {
  const clientReceived = receipts.filter((r) => !r.is_refund).reduce((s, r) => s + n(r.amount), 0);
  const refundsTotal = receipts.filter((r) => r.is_refund).reduce((s, r) => s + n(r.amount), 0);
  const totalReceived = clientReceived + refundsTotal;
  const totalSales = items.reduce((s, i) => s + n(i.sale_value), 0);
  const totalCosts = items.reduce((s, i) => s + itemCost(i), 0);
  const cardFees = expenses.filter((e) => e.is_card_fee).reduce((s, e) => s + n(e.amount), 0);
  const otherExpenses = expenses.filter((e) => !e.is_card_fee).reduce((s, e) => s + n(e.amount), 0);
  const totalExpenses = cardFees + otherExpenses;
  const laborTotal = clientReceived - totalSales - cardFees;
  const netProfit = totalReceived - totalCosts - totalExpenses;

  const person = (p: Person): PersonResult => {
    const mine = items.filter((i) => share(i.supplier, p) > 0);
    const invested = items.reduce((s, i) => s + itemCost(i) * share(i.supplier, p), 0);
    const revenue = items.reduce((s, i) => s + n(i.sale_value) * share(i.supplier, p), 0);
    const exp = expenses.filter((e) => !e.is_card_fee).reduce((s, e) => s + n(e.amount) * share(e.payer, p), 0);
    const refunds = receipts.filter((r) => r.is_refund && r.received_by === p).reduce((s, r) => s + n(r.amount), 0);
    const labor = laborTotal / 2;
    const equipmentProfit = revenue - invested;
    const netProfit = equipmentProfit + labor - exp + refunds;
    // Quanto cabe do dinheiro recebido: receita dos equipamentos (devolve custo + lucro) + mão de obra + reembolsos
    const entitled = revenue + labor + refunds;
    const received = receipts.filter((r) => r.received_by === p).reduce((s, r) => s + n(r.amount), 0);
    return { equipmentCount: mine.length, invested, revenue, equipmentProfit, labor, expenses: exp, refunds, netProfit, entitled, received, pending: entitled - received };
  };

  const eu = person("EU");
  const hellios = person("HELLIOS");
  let transfer: { from: Person; to: Person; amount: number } | null = null;
  if (Math.abs(eu.pending) > 0.004) {
    transfer = eu.pending < 0 ? { from: "EU", to: "HELLIOS", amount: -eu.pending } : { from: "HELLIOS", to: "EU", amount: eu.pending };
  }
  return { totalReceived, totalCosts, totalExpenses, cardFees, laborTotal, netProfit, eu, hellios, transfer };
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const personLabel = (p: Party) => (p === "EU" ? "Eu" : p === "HELLIOS" ? "Hellios" : "Compartilhado");
