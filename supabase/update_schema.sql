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
CREATE POLICY "Leitura pública de ramos"
  ON public.business_branches FOR SELECT
  USING (true);

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
  '["AGENDAMENTO", "CHECK_IN", "CHECKOUT", "PAGAMENTO", "DIVISAO_COMISSAO"]'::jsonb,
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
