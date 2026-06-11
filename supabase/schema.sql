-- ==========================================
-- MandaPIX Database Schema & Multi-Tenancy Configuration
-- ==========================================

-- 1. Criação dos Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'tenant');
CREATE TYPE public.wallet_type AS ENUM ('PIX', 'PIX_AUTO', 'CREDIT_CARD', 'DEBIT_CARD');
CREATE TYPE public.pix_key_type AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');
CREATE TYPE public.product_type AS ENUM ('PRODUTO', 'SERVICO');
CREATE TYPE public.installment_status AS ENUM ('PENDENTE', 'PAGO');
CREATE TYPE public.order_status AS ENUM ('PENDENTE', 'APROVADO', 'PREPARACAO', 'A_CAMINHO', 'ENTREGUE', 'CANCELADO');

-- 2. Tabela de Planos de Assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  max_stores INTEGER NOT NULL,
  max_invoices_per_month INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed de planos de assinatura padrão
INSERT INTO public.subscription_plans (name, description, price, max_stores, max_invoices_per_month) VALUES
('Gratuito', 'Plano básico para começar a gerenciar seus recebimentos', 0.00, 1, 10),
('Profissional', 'Para profissionais autônomos e pequenas empresas em crescimento', 49.90, 3, 100),
('Empresarial', 'Sem limites para o seu negócio deslanchar', 149.90, 999, 999999)
ON CONFLICT (name) DO NOTHING;

-- 3. Tabela de Perfis de Usuário (vinculada ao auth.users do Supabase)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'tenant',
  subscription_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  subscription_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabelas de Negócio com tenant_id para isolamento multi-tenant

-- Carteiras (savedKeys)
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_type public.wallet_type NOT NULL,
  label TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- PIX opções
  type public.pix_key_type,
  key TEXT,
  name TEXT,
  city TEXT,
  
  -- Detalhes de Cartão
  card_provider TEXT,
  account_identifier TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lojas
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL, -- Ex: "from-blue-600 to-indigo-600"
  document TEXT,
  contact TEXT,
  email TEXT,
  legal_name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clientes (compradores nas lojas)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catálogos
CREATE TABLE public.catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produtos e Serviços
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.product_type NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Faturas / Cobranças
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_service_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  date_created DATE NOT NULL DEFAULT CURRENT_DATE,
  installments_count INTEGER NOT NULL DEFAULT 1,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  payment_method_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parcelas
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status public.installment_status NOT NULL DEFAULT 'PENDENTE',
  pix_payload TEXT,
  confirmed_date DATE,
  payment_method_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pedidos (Gerados pela loja / catálogo)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_document TEXT,
  items JSONB NOT NULL, -- Estrutura: [{productServiceId, name, quantity, price}]
  total_amount NUMERIC(10, 2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'PENDENTE',
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Função auxiliar SECURITY DEFINER para verificar se o usuário atual é administrador, evitando recursão infinita
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 1. Políticas para Perfis (profiles)
CREATE POLICY "Usuários visualizam o próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Apenas administradores alteram perfis"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- 2. Políticas para Planos de Assinatura (subscription_plans)
CREATE POLICY "Qualquer usuário autenticado visualiza planos"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas administradores gerenciam planos"
  ON public.subscription_plans FOR ALL
  USING (public.is_admin());

-- 3. Políticas para Lojas (stores)
CREATE POLICY "Tenants gerenciam suas próprias lojas"
  ON public.stores FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de lojas para clientes e simulação"
  ON public.stores FOR SELECT
  USING (true);

-- 4. Políticas para Carteiras (wallets)
CREATE POLICY "Tenants gerenciam suas carteiras"
  ON public.wallets FOR ALL
  USING (auth.uid() = tenant_id);

-- 5. Políticas para Clientes / Compradores (clients)
CREATE POLICY "Tenants gerenciam seus clientes"
  ON public.clients FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de clientes"
  ON public.clients FOR SELECT
  USING (true);

-- 6. Políticas para Catálogos (catalogs)
CREATE POLICY "Tenants gerenciam seus catálogos"
  ON public.catalogs FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de catálogos para simulação"
  ON public.catalogs FOR SELECT
  USING (true);

-- 7. Políticas para Produtos (products)
CREATE POLICY "Tenants gerenciam seus produtos"
  ON public.products FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de produtos para simulação"
  ON public.products FOR SELECT
  USING (true);

-- 8. Políticas para Faturas (invoices)
CREATE POLICY "Tenants gerenciam suas faturas"
  ON public.invoices FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de faturas para pagamento"
  ON public.invoices FOR SELECT
  USING (true);

-- 9. Políticas para Parcelas (installments)
CREATE POLICY "Tenants gerenciam suas parcelas"
  ON public.installments FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de parcelas para pagamento"
  ON public.installments FOR SELECT
  USING (true);

-- 10. Políticas para Pedidos (orders)
CREATE POLICY "Tenants gerenciam seus pedidos"
  ON public.orders FOR ALL
  USING (auth.uid() = tenant_id);

-- ==========================================
-- DATABASE TRIGGERS
-- ==========================================

-- Trigger para criar perfil automaticamente no esquema público após cadastro na tabela de Auth do Supabase
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_default_plan_id UUID;
BEGIN
  -- Tentar obter o ID do plano gratuito por padrão
  SELECT id INTO v_default_plan_id FROM public.subscription_plans WHERE name = 'Gratuito' LIMIT 1;

  INSERT INTO public.profiles (id, email, role, subscription_plan_id, subscription_status)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'tenant'::public.user_role),
    COALESCE((new.raw_user_meta_data->>'subscription_plan_id')::uuid, v_default_plan_id),
    COALESCE(new.raw_user_meta_data->>'subscription_status', 'active')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- STOREFRONT CHECKOUT SECURE RPC FUNCTION
-- ==========================================

-- Função que roda com permissões de administrador (SECURITY DEFINER) para criar pedidos sem login do cliente final
CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_store_id UUID,
  p_client_name TEXT,
  p_client_document TEXT,
  p_client_email TEXT,
  p_client_phone TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_wallet_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_schedule_slot_id UUID,
  p_schedule_calendar_id UUID,
  p_installments JSONB, -- array of { number, amount, due_date, status, pix_payload, routed_gateway, transaction_fee }
  p_routed_gateway TEXT,
  p_transaction_fee NUMERIC,
  p_total_amount NUMERIC
) RETURNS JSONB SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID;
  v_client_id UUID;
  v_invoice_id UUID;
  v_order_id UUID;
  v_invoice_num TEXT;
  v_response JSONB;
  v_inst RECORD;
BEGIN
  -- 1. Obter tenant_id da loja
  SELECT tenant_id INTO v_tenant_id FROM public.stores WHERE id = p_store_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  -- 2. Obter ou Criar o Cliente (evita misturar clientes com documentos vazios ou mockados se o nome for diferente)
  SELECT id INTO v_client_id FROM public.clients 
  WHERE store_id = p_store_id 
    AND document = p_client_document
    AND (
      (p_client_document <> 'NÃO INFORMADO' AND p_client_document <> '000.000.000-00' AND p_client_document <> '111.111.111-11')
      OR LOWER(name) = LOWER(p_client_name)
    );

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (tenant_id, store_id, name, document, email, phone)
    VALUES (v_tenant_id, p_store_id, p_client_name, p_client_document, p_client_email, p_client_phone)
    RETURNING id INTO v_client_id;
  END IF;

  -- 3. Gerar número de fatura
  SELECT COALESCE(MAX(invoice_number::INT) + 1, 1001)::TEXT INTO v_invoice_num 
  FROM public.invoices WHERE tenant_id = v_tenant_id;

  -- 4. Criar Fatura
  INSERT INTO public.invoices (
    tenant_id, store_id, invoice_number, client_id, description, 
    total_amount, installments_count, wallet_id, payment_method_used,
    routed_gateway, transaction_fee
  )
  VALUES (
    v_tenant_id, p_store_id, v_invoice_num, v_client_id, 'Pedido #' || v_invoice_num || ' via E-commerce', 
    p_total_amount, jsonb_array_length(p_installments), p_wallet_id, p_payment_method,
    p_routed_gateway, p_transaction_fee
  )
  RETURNING id INTO v_invoice_id;

  -- 5. Criar Parcelas
  FOR v_inst IN SELECT * FROM jsonb_to_recordset(p_installments) AS x(
    number INT, amount NUMERIC, due_date DATE, status TEXT, pix_payload TEXT, routed_gateway TEXT, transaction_fee NUMERIC
  ) LOOP
    INSERT INTO public.installments (
      tenant_id, invoice_id, number, amount, due_date, status, pix_payload, payment_method_used, routed_gateway, transaction_fee
    )
    VALUES (
      v_tenant_id, v_invoice_id, v_inst.number, v_inst.amount, v_inst.due_date, v_inst.status::public.installment_status, 
      v_inst.pix_payload, p_payment_method, v_inst.routed_gateway, v_inst.transaction_fee
    );
  END LOOP;

  -- 6. Criar Pedido
  INSERT INTO public.orders (
    tenant_id, store_id, order_number, client_name, client_phone, client_email, client_document, 
    items, total_amount, status, invoice_id, scheduled_at, schedule_slot_id, schedule_calendar_id
  )
  VALUES (
    v_tenant_id, p_store_id, v_invoice_num, p_client_name, p_client_phone, p_client_email, p_client_document, 
    p_items, p_total_amount, 'PENDENTE', v_invoice_id, p_scheduled_at, p_schedule_slot_id, p_schedule_calendar_id
  )
  RETURNING id INTO v_order_id;

  -- 7. Incrementar slot se agendado
  IF p_schedule_slot_id IS NOT NULL THEN
    UPDATE public.schedule_slots 
    SET current_bookings = current_bookings + 1 
    WHERE id = p_schedule_slot_id;
  END IF;

  -- 8. Construir Resposta
  v_response := jsonb_build_object(
    'orderNumber', v_invoice_num,
    'invoiceId', v_invoice_id,
    'orderId', v_order_id
  );

  RETURN v_response;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- SETTINGS & ROUTING CONFIGURATION
-- ==========================================

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de configurações"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Apenas administradores gerenciam configurações"
  ON public.settings FOR ALL
  USING (public.is_admin());

-- Seed inicial de taxas para PIX Automatizado (Asaas e Efí)
INSERT INTO public.settings (key, value) VALUES (
  'pix_routing',
  '{
    "threshold": 100.00,
    "below": {
      "asaas": { "fixed": 0.99, "percent": 0.0, "key": "asaas-abaixo@mandapix.com" },
      "efi": { "fixed": 0.0, "percent": 1.19, "key": "efi-abaixo@mandapix.com" }
    },
    "above": {
      "asaas": { "fixed": 0.99, "percent": 0.0, "key": "asaas-acima@mandapix.com" },
      "efi": { "fixed": 0.0, "percent": 1.19, "key": "efi-acima@mandapix.com" }
    }
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Seed inicial para desativar a página comercial por padrão
INSERT INTO public.settings (key, value) VALUES (
  'disable_landing_page',
  '{"disabled": true}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Adicionar colunas de controle de taxas e roteamento nas faturas e parcelas
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS routed_gateway TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transaction_fee NUMERIC(10, 2);

ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS routed_gateway TEXT;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS transaction_fee NUMERIC(10, 2);

-- ==========================================
-- SCHEDULING / AGENDAMENTO DE PEDIDOS
-- ==========================================

-- (Remove tabela antiga de config por loja, se existir)
DROP TABLE IF EXISTS public.store_schedule_configs CASCADE;

-- Calendários de agendamento (uma loja pode ter múltiplos calendários)
CREATE TABLE IF NOT EXISTS public.schedule_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  show_slots_to_client BOOLEAN NOT NULL DEFAULT false,
  require_scheduling BOOLEAN NOT NULL DEFAULT false,
  advance_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schedule_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants gerenciam seus calendários de agendamento"
  ON public.schedule_calendars FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de calendários de agendamento"
  ON public.schedule_calendars FOR SELECT
  USING (true);

-- Associação N:N entre calendários e catálogos
CREATE TABLE IF NOT EXISTS public.schedule_calendar_catalogs (
  calendar_id UUID NOT NULL REFERENCES public.schedule_calendars(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  PRIMARY KEY (calendar_id, catalog_id)
);

ALTER TABLE public.schedule_calendar_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública das associações calendário-catálogo"
  ON public.schedule_calendar_catalogs FOR SELECT
  USING (true);

CREATE POLICY "Tenants gerenciam associações calendário-catálogo"
  ON public.schedule_calendar_catalogs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_calendars sc
      WHERE sc.id = calendar_id AND sc.tenant_id = auth.uid()
    )
  );

-- Slots de horário disponíveis (vinculados a um calendário)
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.schedule_calendars(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 1,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_id, slot_date, slot_time)
);

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants gerenciam seus slots de agendamento"
  ON public.schedule_slots FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de slots para clientes"
  ON public.schedule_slots FOR SELECT
  USING (true);

-- Adicionar campos de agendamento na tabela de pedidos
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS schedule_slot_id UUID REFERENCES public.schedule_slots(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS schedule_calendar_id UUID REFERENCES public.schedule_calendars(id) ON DELETE SET NULL;

-- Configurações de E-commerce por Loja
CREATE TABLE IF NOT EXISTS public.ecommerce_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  catalog_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_methods JSONB NOT NULL DEFAULT '["PIX"]'::jsonb,
  payment_wallets JSONB NOT NULL DEFAULT '{}'::jsonb,
  down_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  down_payment_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  down_payment_type TEXT NOT NULL DEFAULT 'percentage',
  installments_enabled BOOLEAN NOT NULL DEFAULT false,
  max_installments INTEGER NOT NULL DEFAULT 1,
  business_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_schedule_calendar BOOLEAN NOT NULL DEFAULT true,
  checkout_fields JSONB NOT NULL DEFAULT '{
    "name": {"show": true, "required": true},
    "document": {"show": true, "required": true},
    "email": {"show": true, "required": true},
    "phone": {"show": true, "required": true},
    "address": {"show": false, "required": false}
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ecommerce_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants gerenciam suas configurações de e-commerce"
  ON public.ecommerce_settings FOR ALL
  USING (auth.uid() = tenant_id);

CREATE POLICY "Leitura pública de configurações de e-commerce"
  ON public.ecommerce_settings FOR SELECT
  USING (true);



