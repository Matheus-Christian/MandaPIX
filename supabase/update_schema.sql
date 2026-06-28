-- ====================================================================
-- MandaPIX - Migração: Arquitetura de Fluxo Dinâmico (Ramos de Atuação)
-- Executar este script no Editor SQL do Supabase
-- ====================================================================

-- 1. Criação da tabela de Ramos de Atuação
CREATE TABLE IF NOT EXISTS public.business_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  initial_trigger TEXT NOT NULL,
  focus TEXT NOT NULL,
  order_status_flow JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilita RLS na nova tabela
ALTER TABLE public.business_branches ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS) para business_branches
DROP POLICY IF EXISTS "Leitura pública de ramos" ON public.business_branches;
CREATE POLICY "Leitura pública de ramos"
  ON public.business_branches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Apenas administradores gerenciam ramos" ON public.business_branches;
CREATE POLICY "Apenas administradores gerenciam ramos"
  ON public.business_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Seed de Ramos de Atuação Padrão
INSERT INTO public.business_branches (key, name, initial_trigger, focus, order_status_flow, config) VALUES
(
  'varejo', 
  'Varejo / Conveniência / Loja Física', 
  'Produto / Código de Barras', 
  'Velocidade de fechamento no caixa e controle de estoque', 
  '["REGISTRO_ITENS", "PAGAMENTO_PIX", "VENDA_CONCLUIDA"]'::jsonb,
  '{"hide_agenda": true, "hide_kitchen": true, "main_screen": "pdv"}'::jsonb
),
(
  'servicos', 
  'Serviços / Salão de Beleza / Clínicas / Estética', 
  'Tempo / Horário (Agenda)', 
  'Gestão de horários, ocupação de profissionais e comissões/repasses', 
  '["PENDENTE", "AGENDADO", "EM_ATENDIMENTO", "PAGAMENTO"]'::jsonb,
  '{"hide_delivery": true, "hide_kitchen": true, "main_screen": "schedule"}'::jsonb
),
(
  'alimentacao', 
  'Alimentação / Lanches / Delivery / Restaurantes', 
  'Pedido (Cardápio Digital ou Balcão)', 
  'Comunicação entre recepção, produção (cozinha) e entrega', 
  '["ENTRADA_PEDIDO", "CONFIRMACAO_PAGAMENTO", "PRODUCAO_COZINHA", "LOGISTICA_ENVIO", "PEDIDO_ENTREGUE"]'::jsonb,
  '{"hide_agenda": true, "main_screen": "orders"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  initial_trigger = EXCLUDED.initial_trigger,
  focus = EXCLUDED.focus,
  order_status_flow = EXCLUDED.order_status_flow,
  config = EXCLUDED.config;

-- 2. Adição da coluna ramo_empresa na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ramo_empresa TEXT DEFAULT 'varejo';

-- 3. Alteração do tipo da coluna status de public.orders para TEXT
ALTER TABLE public.orders ALTER COLUMN status TYPE TEXT;

-- 4. Adição de campos adicionais em public.products para estoque e comissão
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 50.00;

-- 5. Adição de campo para comissão dividida em public.orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_split JSONB;

-- 6. Atualização da trigger function handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_default_plan_id UUID;
BEGIN
  -- Tentar obter o ID do plano gratuito por padrão
  SELECT id INTO v_default_plan_id FROM public.subscription_plans WHERE name = 'Gratuito' LIMIT 1;

  INSERT INTO public.profiles (id, email, role, subscription_plan_id, subscription_status, ramo_empresa)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'tenant'::public.user_role),
    COALESCE((new.raw_user_meta_data->>'subscription_plan_id')::uuid, v_default_plan_id),
    COALESCE(new.raw_user_meta_data->>'subscription_status', 'active'),
    COALESCE(new.raw_user_meta_data->>'ramo_empresa', 'varejo')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar tabela de funcionários (employees) se não existir
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VENDEDOR', -- 'GERENTE', 'VENDEDOR', 'ATENDENTE'
  access_code TEXT NOT NULL, -- PIN ou Código de Acesso
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Evitar erros se políticas já existirem
DROP POLICY IF EXISTS "Tenants gerenciam seus funcionários" ON public.employees;
CREATE POLICY "Tenants gerenciam seus funcionários"
  ON public.employees FOR ALL
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Leitura pública de funcionários para login" ON public.employees;
CREATE POLICY "Leitura pública de funcionários para login"
  ON public.employees FOR SELECT
  USING (true);

-- ====================================================================
-- MandaPIX - Migração: Controle de Acesso e Autenticação de Funcionários
-- ====================================================================

-- 1. Adicionar coluna allow_wallets na tabela employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS allow_wallets BOOLEAN NOT NULL DEFAULT false;

-- 2. Criar ou atualizar a função auxiliar para verificar se o usuário atual é funcionário de um tenant
CREATE OR REPLACE FUNCTION public.is_employee_of(p_tenant_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE tenant_id = p_tenant_id AND email = auth.email()
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar políticas de RLS para incluir acesso a funcionários

-- Lojas (stores)
DROP POLICY IF EXISTS "Tenants gerenciam suas lojas" ON public.stores;
CREATE POLICY "Tenants gerenciam suas lojas"
  ON public.stores FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Clientes (clients)
DROP POLICY IF EXISTS "Tenants gerenciam seus clientes" ON public.clients;
CREATE POLICY "Tenants gerenciam seus clientes"
  ON public.clients FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Catálogos (catalogs)
DROP POLICY IF EXISTS "Tenants gerenciam seus catálogos" ON public.catalogs;
CREATE POLICY "Tenants gerenciam seus catálogos"
  ON public.catalogs FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Produtos (products)
DROP POLICY IF EXISTS "Tenants gerenciam seus produtos" ON public.products;
CREATE POLICY "Tenants gerenciam seus produtos"
  ON public.products FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Faturas (invoices)
DROP POLICY IF EXISTS "Tenants gerenciam suas faturas" ON public.invoices;
CREATE POLICY "Tenants gerenciam suas faturas"
  ON public.invoices FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Parcelas (installments)
DROP POLICY IF EXISTS "Tenants gerenciam suas parcelas" ON public.installments;
CREATE POLICY "Tenants gerenciam suas parcelas"
  ON public.installments FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Pedidos (orders)
DROP POLICY IF EXISTS "Tenants gerenciam seus pedidos" ON public.orders;
CREATE POLICY "Tenants gerenciam seus pedidos"
  ON public.orders FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Carteiras (wallets)
DROP POLICY IF EXISTS "Tenants gerenciam suas carteiras" ON public.wallets;
CREATE POLICY "Tenants gerenciam suas carteiras"
  ON public.wallets FOR ALL
  USING (
    auth.uid() = tenant_id OR 
    (public.is_employee_of(tenant_id) AND EXISTS (
      SELECT 1 FROM public.employees 
      WHERE tenant_id = wallets.tenant_id AND email = auth.email() AND allow_wallets = true
    ))
  );

-- Calendários (schedule_calendars)
DROP POLICY IF EXISTS "Tenants gerenciam seus calendários de agendamento" ON public.schedule_calendars;
CREATE POLICY "Tenants gerenciam seus calendários de agendamento"
  ON public.schedule_calendars FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Associações Calendário-Catálogo (schedule_calendar_catalogs)
DROP POLICY IF EXISTS "Tenants gerenciam associações calendário-catálogo" ON public.schedule_calendar_catalogs;
CREATE POLICY "Tenants gerenciam associações calendário-catálogo"
  ON public.schedule_calendar_catalogs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_calendars sc
      WHERE sc.id = calendar_id AND (sc.tenant_id = auth.uid() OR public.is_employee_of(sc.tenant_id))
    )
  );

-- Slots (schedule_slots)
DROP POLICY IF EXISTS "Tenants gerenciam seus slots de agendamento" ON public.schedule_slots;
CREATE POLICY "Tenants gerenciam seus slots de agendamento"
  ON public.schedule_slots FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Configurações E-commerce (ecommerce_settings)
DROP POLICY IF EXISTS "Tenants gerenciam suas configurações de e-commerce" ON public.ecommerce_settings;
CREATE POLICY "Tenants gerenciam suas configurações de e-commerce"
  ON public.ecommerce_settings FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- 4. Função e trigger para definir automaticamente o tenant_id de novas linhas baseando-se no empregador do funcionário
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.employees WHERE email = auth.email()) THEN
    NEW.tenant_id := (SELECT tenant_id FROM public.employees WHERE email = auth.email() LIMIT 1);
  ELSE
    NEW.tenant_id := COALESCE(NEW.tenant_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar o trigger de definição de tenant_id antes do insert
DROP TRIGGER IF EXISTS set_tenant_id_orders ON public.orders;
CREATE TRIGGER set_tenant_id_orders BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_invoices ON public.invoices;
CREATE TRIGGER set_tenant_id_invoices BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_installments ON public.installments;
CREATE TRIGGER set_tenant_id_installments BEFORE INSERT ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_clients ON public.clients;
CREATE TRIGGER set_tenant_id_clients BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_catalogs ON public.catalogs;
CREATE TRIGGER set_tenant_id_catalogs BEFORE INSERT ON public.catalogs FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_products ON public.products;
CREATE TRIGGER set_tenant_id_products BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_wallets ON public.wallets;
CREATE TRIGGER set_tenant_id_wallets BEFORE INSERT ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_stores ON public.stores;
CREATE TRIGGER set_tenant_id_stores BEFORE INSERT ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Permitir que funcionários visualizem o perfil de seu respectivo tenant (necessário para ler o ramo_empresa)
DROP POLICY IF EXISTS "Funcionários visualizam perfil do tenant" ON public.profiles;
CREATE POLICY "Funcionários visualizam perfil do tenant"
  ON public.profiles FOR SELECT
  USING (public.is_employee_of(id));

-- ====================================================================
-- MandaPIX - Migração: Clínica Médica e Tabelas LGPD
-- ====================================================================

-- 1. Inserir Ramo Clínica se não existir
INSERT INTO public.business_branches (key, name, initial_trigger, focus, order_status_flow, config) VALUES
(
  'clinica', 
  'Clínicas Médicas / Consultórios', 
  'Consulta / Agendamento', 
  'Gestão de prontuários, consultas, atestados médicos e agendamentos', 
  '["PENDENTE", "CONFIRMADO", "EM_ATENDIMENTO", "ATENDIDO", "CANCELADO"]'::jsonb,
  '{"hide_delivery": true, "hide_kitchen": true, "main_screen": "schedule"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2. Tabela de Prontuários (medical_records)
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  prescription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants e funcionários gerenciam prontuários" ON public.medical_records;
CREATE POLICY "Tenants e funcionários gerenciam prontuários"
  ON public.medical_records FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Trigger de tenant_id
DROP TRIGGER IF EXISTS set_tenant_id_medical_records ON public.medical_records;
CREATE TRIGGER set_tenant_id_medical_records BEFORE INSERT ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 3. Tabela de Atestados Médicos (medical_certificates)
CREATE TABLE IF NOT EXISTS public.medical_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  doctor_crm TEXT NOT NULL,
  days_off INTEGER NOT NULL,
  cid_code TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants e funcionários gerenciam atestados" ON public.medical_certificates;
CREATE POLICY "Tenants e funcionários gerenciam atestados"
  ON public.medical_certificates FOR ALL
  USING (auth.uid() = tenant_id OR public.is_employee_of(tenant_id));

-- Trigger de tenant_id
DROP TRIGGER IF EXISTS set_tenant_id_medical_certificates ON public.medical_certificates;
CREATE TRIGGER set_tenant_id_medical_certificates BEFORE INSERT ON public.medical_certificates FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

