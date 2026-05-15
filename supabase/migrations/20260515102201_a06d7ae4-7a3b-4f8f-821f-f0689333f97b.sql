
-- ============== ENUMS ==============
CREATE TYPE journal_type AS ENUM ('sales','purchases','cash','bank','misc');
CREATE TYPE account_class AS ENUM ('1','2','3','4','5','6','7','8');

-- ============== CHART OF ACCOUNTS ==============
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  class account_class NOT NULL,
  type text NOT NULL DEFAULT 'other', -- asset, liability, equity, income, expense, other
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
CREATE INDEX idx_accounts_company ON public.accounts(company_id);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read accounts" ON public.accounts FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Accountants manage accounts" ON public.accounts FOR ALL
  USING (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]))
  WITH CHECK (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]));

-- ============== JOURNALS ==============
CREATE TABLE public.journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type journal_type NOT NULL,
  default_account_id uuid REFERENCES public.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read journals" ON public.journals FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Accountants manage journals" ON public.journals FOR ALL
  USING (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]))
  WITH CHECK (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]));

-- ============== JOURNAL ENTRIES ==============
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES public.journals(id),
  reference text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  source_type text, -- 'sale', 'purchase', 'manual', 'expense'
  source_id uuid,
  posted boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_je_company_date ON public.journal_entries(company_id, entry_date DESC);
CREATE INDEX idx_je_source ON public.journal_entries(source_type, source_id);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read entries" ON public.journal_entries FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Accountants manage entries" ON public.journal_entries FOR ALL
  USING (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]))
  WITH CHECK (has_company_role(auth.uid(), company_id, ARRAY['owner','admin','accountant']::app_role[]));

-- ============== JOURNAL ENTRY LINES ==============
CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  label text,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jel_entry ON public.journal_entry_lines(entry_id);
CREATE INDEX idx_jel_account ON public.journal_entry_lines(account_id);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members access entry lines" ON public.journal_entry_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = entry_id AND is_company_member(auth.uid(), je.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = entry_id AND is_company_member(auth.uid(), je.company_id)));

-- ============== SEED FUNCTION (Plan comptable SYSCOHADA simplifié) ==============
CREATE OR REPLACE FUNCTION public.seed_syscohada_accounts(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.accounts (company_id, code, name, class, type) VALUES
  -- Classe 1 : Capitaux
  (_company_id, '101', 'Capital social', '1', 'equity'),
  (_company_id, '120', 'Résultat de l''exercice', '1', 'equity'),
  -- Classe 2 : Immobilisations
  (_company_id, '241', 'Matériel et mobilier', '2', 'asset'),
  -- Classe 3 : Stocks
  (_company_id, '311', 'Marchandises', '3', 'asset'),
  -- Classe 4 : Tiers
  (_company_id, '401', 'Fournisseurs', '4', 'liability'),
  (_company_id, '411', 'Clients', '4', 'asset'),
  (_company_id, '4431', 'TVA collectée', '4', 'liability'),
  (_company_id, '4452', 'TVA déductible', '4', 'asset'),
  -- Classe 5 : Trésorerie
  (_company_id, '521', 'Banque', '5', 'asset'),
  (_company_id, '571', 'Caisse', '5', 'asset'),
  (_company_id, '5511', 'Wave', '5', 'asset'),
  (_company_id, '5512', 'Orange Money', '5', 'asset'),
  (_company_id, '5513', 'Free Money', '5', 'asset'),
  -- Classe 6 : Charges
  (_company_id, '601', 'Achats de marchandises', '6', 'expense'),
  (_company_id, '605', 'Autres achats', '6', 'expense'),
  (_company_id, '622', 'Locations', '6', 'expense'),
  (_company_id, '627', 'Services bancaires', '6', 'expense'),
  (_company_id, '641', 'Salaires', '6', 'expense'),
  (_company_id, '658', 'Autres charges', '6', 'expense'),
  -- Classe 7 : Produits
  (_company_id, '701', 'Ventes de marchandises', '7', 'income'),
  (_company_id, '706', 'Services rendus', '7', 'income'),
  (_company_id, '758', 'Autres produits', '7', 'income');

  -- Journaux par défaut
  INSERT INTO public.journals (company_id, code, name, type, default_account_id) VALUES
    (_company_id, 'VTE', 'Journal des ventes', 'sales', (SELECT id FROM accounts WHERE company_id=_company_id AND code='411')),
    (_company_id, 'ACH', 'Journal des achats', 'purchases', (SELECT id FROM accounts WHERE company_id=_company_id AND code='401')),
    (_company_id, 'CAI', 'Caisse', 'cash', (SELECT id FROM accounts WHERE company_id=_company_id AND code='571')),
    (_company_id, 'BNK', 'Banque', 'bank', (SELECT id FROM accounts WHERE company_id=_company_id AND code='521')),
    (_company_id, 'OD',  'Opérations diverses', 'misc', NULL);
END;
$$;

-- Trigger sur création d'entreprise → seed automatique
CREATE OR REPLACE FUNCTION public.on_company_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_syscohada_accounts(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_company_seed_accounts
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.on_company_created();

-- Backfill pour les entreprises existantes
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE company_id = c.id) THEN
      PERFORM public.seed_syscohada_accounts(c.id);
    END IF;
  END LOOP;
END $$;

-- ============== AUTO-WRITE: Sale → Journal entry ==============
CREATE OR REPLACE FUNCTION public.create_entry_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_journal_id uuid;
  v_entry_id uuid;
  acc_client uuid; acc_cash uuid; acc_sales uuid; acc_tva uuid;
  v_cash_account_code text;
BEGIN
  SELECT id INTO v_journal_id FROM journals WHERE company_id=NEW.company_id AND code='VTE';
  IF v_journal_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO acc_client FROM accounts WHERE company_id=NEW.company_id AND code='411';
  SELECT id INTO acc_sales  FROM accounts WHERE company_id=NEW.company_id AND code='701';
  SELECT id INTO acc_tva    FROM accounts WHERE company_id=NEW.company_id AND code='4431';

  -- choix compte trésorerie selon mode paiement
  v_cash_account_code := CASE NEW.payment_method
    WHEN 'cash' THEN '571'
    WHEN 'wave' THEN '5511'
    WHEN 'orange_money' THEN '5512'
    WHEN 'free_money' THEN '5513'
    WHEN 'card' THEN '521'
    ELSE NULL
  END;
  IF v_cash_account_code IS NOT NULL THEN
    SELECT id INTO acc_cash FROM accounts WHERE company_id=NEW.company_id AND code=v_cash_account_code;
  END IF;

  INSERT INTO journal_entries (company_id, journal_id, reference, entry_date, description, source_type, source_id, created_by)
  VALUES (NEW.company_id, v_journal_id, NEW.reference, NEW.created_at::date, 'Vente '||NEW.reference, 'sale', NEW.id, NEW.user_id)
  RETURNING id INTO v_entry_id;

  -- Débit client (montant total) si crédit, sinon débit trésorerie
  IF NEW.payment_method = 'credit' OR NEW.amount_paid < NEW.total THEN
    INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
    VALUES (v_entry_id, acc_client, 'Client', NEW.total - COALESCE(NEW.amount_paid,0), 0);
  END IF;
  IF acc_cash IS NOT NULL AND COALESCE(NEW.amount_paid,0) > 0 THEN
    INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
    VALUES (v_entry_id, acc_cash, 'Encaissement', NEW.amount_paid, 0);
  END IF;
  -- Crédit ventes (HT)
  INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
  VALUES (v_entry_id, acc_sales, 'Vente HT', 0, NEW.subtotal - COALESCE(NEW.discount,0));
  -- Crédit TVA collectée
  IF COALESCE(NEW.tax_amount,0) > 0 THEN
    INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
    VALUES (v_entry_id, acc_tva, 'TVA collectée', 0, NEW.tax_amount);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sale_journal_entry
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.create_entry_for_sale();

-- ============== AUTO-WRITE: Purchase → Journal entry ==============
CREATE OR REPLACE FUNCTION public.create_entry_for_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_journal_id uuid; v_entry_id uuid;
  acc_supplier uuid; acc_purchases uuid; acc_tva uuid; acc_cash uuid;
  v_subtotal numeric; v_tva numeric;
BEGIN
  SELECT id INTO v_journal_id FROM journals WHERE company_id=NEW.company_id AND code='ACH';
  IF v_journal_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO acc_supplier  FROM accounts WHERE company_id=NEW.company_id AND code='401';
  SELECT id INTO acc_purchases FROM accounts WHERE company_id=NEW.company_id AND code='601';
  SELECT id INTO acc_tva       FROM accounts WHERE company_id=NEW.company_id AND code='4452';
  SELECT id INTO acc_cash      FROM accounts WHERE company_id=NEW.company_id AND code='571';

  -- Approximation TVA 18% (pas de subtotal explicite sur purchases)
  v_subtotal := ROUND(NEW.total / 1.18, 2);
  v_tva := NEW.total - v_subtotal;

  INSERT INTO journal_entries (company_id, journal_id, reference, entry_date, description, source_type, source_id, created_by)
  VALUES (NEW.company_id, v_journal_id, NEW.reference, NEW.created_at::date, 'Achat '||NEW.reference, 'purchase', NEW.id, NEW.user_id)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit) VALUES
    (v_entry_id, acc_purchases, 'Achats HT', v_subtotal, 0),
    (v_entry_id, acc_tva, 'TVA déductible', v_tva, 0);

  IF COALESCE(NEW.amount_paid,0) >= NEW.total THEN
    INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
    VALUES (v_entry_id, acc_cash, 'Paiement', 0, NEW.total);
  ELSE
    INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit)
    VALUES (v_entry_id, acc_supplier, 'Fournisseur', 0, NEW.total);
    IF COALESCE(NEW.amount_paid,0) > 0 THEN
      -- paiement partiel
      INSERT INTO journal_entry_lines (entry_id, account_id, label, debit, credit) VALUES
        (v_entry_id, acc_supplier, 'Paiement partiel', NEW.amount_paid, 0),
        (v_entry_id, acc_cash, 'Sortie caisse', 0, NEW.amount_paid);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_purchase_journal_entry
AFTER INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.create_entry_for_purchase();
