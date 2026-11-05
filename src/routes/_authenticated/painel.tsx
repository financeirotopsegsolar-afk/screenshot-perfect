import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, LogOut, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  compute, brl, itemCost, itemProfit, personLabel,
  type Item, type Expense, type Receipt, type Party, type Person, type PersonResult,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Financeiro TOPSeg Solar" },
      { name: "description", content: "Custos, equipamentos e divisão de lucros entre Eu e Hellios." },
      { property: "og:title", content: "Painel — Financeiro TOPSeg Solar" },
      { property: "og:description", content: "Custos, equipamentos e divisão de lucros entre Eu e Hellios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

type Table = "items" | "expenses" | "receipts";

function Painel() {
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [me, setMe] = useState("");
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from("items").select("*").order("created_at"),
      supabase.from("expenses").select("*").order("created_at"),
      supabase.from("receipts").select("*").order("created_at"),
    ]);
    if (a.data) setItems(a.data as Item[]);
    if (b.data) setExpenses(b.data as Expense[]);
    if (c.data) setReceipts(c.data as Receipt[]);
  }, []);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setMe((u?.user_metadata?.display_name as string) || u?.email || "");
    });
    const channel = supabase
      .channel(`painel-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts" }, load)
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const r = useMemo(() => compute(items, expenses, receipts), [items, expenses, receipts]);

  const update = async (table: Table, id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from(table).update({ ...patch, updated_by: me } as never).eq("id", id);
    if (error) toast.error("Não foi possível salvar");
    else load();
  };
  const insert = async (table: Table, row: Record<string, unknown>) => {
    const { error } = await supabase.from(table).insert({ ...row, updated_by: me } as never);
    if (error) toast.error("Não foi possível adicionar");
    else load();
  };
  const remove = async (table: Table, id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error("Não foi possível excluir");
    else load();
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-hero text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-navy-muted">TOPSeg Solar</p>
              <h1 className="text-xl font-semibold sm:text-2xl">Prestação de contas</h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden items-center gap-1.5 text-navy-muted sm:flex">
                <Radio className={live ? "size-4 text-success" : "size-4"} />
                {live ? "Ao vivo" : "Conectando…"}
              </span>
              <span className="hidden text-navy-muted md:inline">{me}</span>
              <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Sair" className="text-navy-foreground hover:bg-sidebar-accent hover:text-navy-foreground">
                <LogOut />
              </Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total recebido" value={r.totalReceived} />
            <Stat label="Total de custos" value={r.totalCosts} />
            <Stat label="Total de despesas" value={r.totalExpenses} />
            <Stat label="Lucro líquido" value={r.netProfit} strong />
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-16 max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <PersonCard title="Meu resultado" p={r.eu} />
          <PersonCard title="Resultado do Hellios" p={r.hellios} />
        </div>

        <Settlement r={r} />

        <Section
          title="Equipamentos e serviços"
          onAdd={() => insert("items", { quantity: 1, description: "", supplier: "EU", unit_cost: 0, sale_value: 0 })}
        >
          <div className="hidden grid-cols-[70px_1fr_150px_120px_110px_120px_110px_40px] gap-2 px-1 pb-1 text-xs font-medium text-muted-foreground lg:grid">
            <span>Qtd</span><span>Descrição</span><span>Fornecido por</span><span>Custo unit.</span><span>Custo total</span><span>Valor venda</span><span>Lucro</span><span />
          </div>
          {items.map((i) => (
            <div key={i.id} className="grid grid-cols-2 gap-2 border-t py-3 lg:grid-cols-[70px_1fr_150px_120px_110px_120px_110px_40px] lg:items-center lg:py-2">
              <Field label="Qtd"><NumIn value={i.quantity} onSave={(v) => update("items", i.id, { quantity: v ?? 0 })} /></Field>
              <Field label="Descrição" wide><TextIn value={i.description} onSave={(v) => update("items", i.id, { description: v })} /></Field>
              <Field label="Fornecido por"><PartySel value={i.supplier} onChange={(v) => update("items", i.id, { supplier: v })} /></Field>
              <Field label="Custo unit."><NumIn value={i.unit_cost} onSave={(v) => update("items", i.id, { unit_cost: v ?? 0 })} /></Field>
              <Field label="Custo total"><Out v={itemCost(i)} /></Field>
              <Field label="Valor venda"><NumIn value={i.sale_value} onSave={(v) => update("items", i.id, { sale_value: v ?? 0 })} /></Field>
              <Field label="Lucro"><Out v={itemProfit(i)} tone /></Field>
              <Del onClick={() => remove("items", i.id)} />
            </div>
          ))}
          {items.length === 0 && <Empty />}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title="Despesas adicionais"
            hint="Marque “Taxa do cartão” apenas para registrar — ela já saiu do valor recebido."
            onAdd={() => insert("expenses", { description: "", amount: 0, payer: "COMPARTILHADO" })}
          >
            {expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-2 gap-2 border-t py-3 sm:grid-cols-[1fr_110px_140px_40px] sm:items-center sm:py-2">
                <Field label="Descrição" wide>
                  <TextIn value={e.description} onSave={(v) => update("expenses", e.id, { description: v })} />
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={e.is_card_fee} onChange={(x) => update("expenses", e.id, { is_card_fee: x.target.checked })} className="accent-primary" />
                    Taxa do cartão
                  </label>
                </Field>
                <Field label="Valor"><NumIn value={e.amount} placeholder="a preencher" onSave={(v) => update("expenses", e.id, { amount: v })} /></Field>
                <Field label="Quem pagou"><PartySel value={e.payer} onChange={(v) => update("expenses", e.id, { payer: v })} /></Field>
                <Del onClick={() => remove("expenses", e.id)} />
              </div>
            ))}
            {expenses.length === 0 && <Empty />}
          </Section>

          <Section
            title="Recebimentos"
            hint="Reembolsos vão para quem pagou a despesa e não entram na mão de obra."
            onAdd={() => insert("receipts", { description: "", amount: 0, received_by: "EU" })}
          >
            {receipts.map((x) => (
              <div key={x.id} className="grid grid-cols-2 gap-2 border-t py-3 sm:grid-cols-[1fr_110px_120px_40px] sm:items-center sm:py-2">
                <Field label="Descrição" wide>
                  <TextIn value={x.description} onSave={(v) => update("receipts", x.id, { description: v })} />
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={x.is_refund} onChange={(c) => update("receipts", x.id, { is_refund: c.target.checked })} className="accent-primary" />
                    É reembolso
                  </label>
                </Field>
                <Field label="Valor"><NumIn value={x.amount} onSave={(v) => update("receipts", x.id, { amount: v ?? 0 })} /></Field>
                <Field label="Caiu na conta de">
                  <select value={x.received_by} onChange={(c) => update("receipts", x.id, { received_by: c.target.value })} className={inputCls}>
                    <option value="EU">Eu</option>
                    <option value="HELLIOS">Hellios</option>
                  </select>
                </Field>
                <Del onClick={() => remove("receipts", x.id)} />
              </div>
            ))}
            {receipts.length === 0 && <Empty />}
          </Section>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Mão de obra do projeto: <b className="tabular">{brl(r.laborTotal)}</b> (recebido do cliente − vendas de equipamentos), dividida 50% para cada.
          {r.cardFees > 0 && <> Taxas do cartão registradas: {brl(r.cardFees)} (já descontadas do recebido).</>}
        </p>
      </main>
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25";

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-navy-muted">{label}</p>
      <p className={`tabular font-display font-semibold ${strong ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl"}`}>{brl(value)}</p>
    </div>
  );
}

function PersonCard({ title, p }: { title: string; p: PersonResult }) {
  const rows: [string, number | string][] = [
    ["Equipamentos fornecidos", `${p.equipmentCount} ${p.equipmentCount === 1 ? "item" : "itens"}`],
    ["Total investido", p.invested],
    ["Receita atribuída", p.revenue],
    ["Parte da mão de obra", p.labor],
    ["Despesas assumidas", -p.expenses],
  ];
  if (p.refunds) rows.push(["Reembolsos recebidos", p.refunds]);
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <h2 className="text-base font-semibold">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular font-medium">{typeof v === "number" ? brl(v) : v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t pt-3">
        <span className="text-sm font-semibold">Lucro líquido</span>
        <span className={`tabular font-display text-2xl font-semibold ${p.netProfit < 0 ? "text-destructive" : "text-primary"}`}>{brl(p.netProfit)}</span>
      </div>
    </div>
  );
}

function Settlement({ r }: { r: ReturnType<typeof compute> }) {
  const row = (name: string, p: PersonResult) => (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-sm font-semibold">{name}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Cabe a receber</dt><dd className="tabular">{brl(p.entitled)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Já recebeu</dt><dd className="tabular">{brl(p.received)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Falta receber</dt><dd className={`tabular ${p.pending < 0 ? "text-destructive" : ""}`}>{brl(p.pending)}</dd></div>
      </dl>
    </div>
  );
  const t = r.transfer;
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <h2 className="text-base font-semibold">Acerto final</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {row("Eu", r.eu)}
        {row("Hellios", r.hellios)}
        <div className="flex flex-col justify-center rounded-xl bg-hero p-4 text-navy-foreground">
          <p className="text-xs uppercase tracking-wider text-navy-muted">Repasse</p>
          {t ? (
            <>
              <p className="tabular font-display text-2xl font-semibold">{brl(t.amount)}</p>
              <p className="text-sm text-navy-muted">{personLabel(t.from)} → {personLabel(t.to)}</p>
            </>
          ) : (
            <p className="font-display text-lg font-semibold">Contas zeradas</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, onAdd, children }: { title: string; hint?: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Button size="sm" onClick={onAdd}><Plus /> Adicionar</Button>
      </div>
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-1" : ""}>
      <span className="mb-1 block text-xs text-muted-foreground lg:hidden">{label}</span>
      {children}
    </div>
  );
}

function TextIn({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className={inputCls} value={v} placeholder="Descrição" onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />;
}

function NumIn({ value, onSave, placeholder }: { value: number | null; onSave: (v: number | null) => void; placeholder?: string }) {
  const fmt = (x: number | null) => (x === null || x === undefined ? "" : String(x).replace(".", ","));
  const [v, setV] = useState(fmt(value));
  useEffect(() => setV(fmt(value)), [value]);
  const commit = () => {
    const parsed = v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", "."));
    if (parsed !== null && Number.isNaN(parsed)) return setV(fmt(value));
    if (parsed !== value) onSave(parsed);
  };
  return <input inputMode="decimal" className={`${inputCls} tabular text-right`} value={v} placeholder={placeholder ?? "0"} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

function PartySel({ value, onChange }: { value: Party; onChange: (v: Party) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Party)} className={inputCls}>
      <option value="EU">Eu</option>
      <option value="HELLIOS">Hellios</option>
      <option value="COMPARTILHADO">Compartilhado</option>
    </select>
  );
}

function Out({ v, tone }: { v: number; tone?: boolean }) {
  return <div className={`tabular flex h-9 items-center justify-end px-1 text-sm font-medium ${tone ? (v < 0 ? "text-destructive" : "text-primary") : ""}`}>{brl(v)}</div>;
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <div className="col-span-2 flex justify-end sm:col-span-1">
      <Button variant="ghost" size="icon" onClick={onClick} aria-label="Excluir" className="text-muted-foreground hover:text-destructive">
        <Trash2 />
      </Button>
    </div>
  );
}

function Empty() {
  return <p className="border-t py-6 text-center text-sm text-muted-foreground">Nenhum lançamento ainda.</p>;
}

export type { Person };
