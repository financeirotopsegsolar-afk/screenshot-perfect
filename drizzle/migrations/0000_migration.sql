CREATE TYPE public.party AS ENUM ('EU','HELLIOS','COMPARTILHADO');

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity numeric NOT NULL DEFAULT 1,
  description text NOT NULL DEFAULT '',
  supplier public.party NOT NULL DEFAULT 'COMPARTILHADO',
  unit_cost numeric NOT NULL DEFAULT 0,
  sale_value numeric NOT NULL DEFAULT 0,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL DEFAULT '',
  amount numeric,
  payer public.party NOT NULL DEFAULT 'COMPARTILHADO',
  is_card_fee boolean NOT NULL DEFAULT false,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  received_by text NOT NULL DEFAULT 'EU' CHECK (received_by IN ('EU','HELLIOS')),
  is_refund boolean NOT NULL DEFAULT false,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items, public.expenses, public.receipts TO authenticated;
GRANT ALL ON public.items, public.expenses, public.receipts TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all items" ON public.items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all receipts" ON public.receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.items, public.expenses, public.receipts;

INSERT INTO public.items (quantity, description, supplier, unit_cost, sale_value) VALUES
 (1, 'Rack 1U (venda adicional)', 'COMPARTILHADO', 0, 130);

INSERT INTO public.expenses (description, amount, payer, is_card_fee) VALUES
 ('Canaletas', 27, 'EU', false),
 ('20 metros de cabo de rede', NULL, 'COMPARTILHADO', false),
 ('Cabos adicionais', 100, 'COMPARTILHADO', false),
 ('Taxas do cartão', 0, 'COMPARTILHADO', true);

INSERT INTO public.receipts (description, amount, received_by, is_refund) VALUES
 ('Valor recebido na conta', 2754.09, 'EU', false),
 ('Venda adicional do rack 1U', 130, 'EU', false),
 ('Reembolso das canaletas', 27, 'EU', true);