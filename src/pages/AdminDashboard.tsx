import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  CreditCard, 
  Plus, 
  Trash2, 
  LogOut, 
  DollarSign, 
  Activity, 
  ShieldAlert, 
  CheckCircle,
  X,
  Edit,
  Mail,
  Lock,
  Layers
} from 'lucide-react';

// Criamos um cliente secundário para registrar usuários sem interferir na sessão do Admin logado
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';

const tempSupabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : (null as any);

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  max_stores: number;
  max_invoices_per_month: number;
}

interface TenantProfile {
  id: string;
  email: string;
  role: 'admin' | 'tenant';
  subscription_status: string;
  created_at: string;
  subscription_plans?: Plan;
}

export const AdminDashboard: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Estados locais
  const [activeTab, setActiveTab] = useState<'tenants' | 'plans' | 'routing'>('tenants');
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  // Modais
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  // Form Novo Tenant
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [tenantError, setTenantError] = useState('');
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // Form Novo Plano
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planMaxStores, setPlanMaxStores] = useState('3');
  const [planMaxInvoices, setPlanMaxInvoices] = useState('100');
  const [planError, setPlanError] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Form values for Routing
  const [routingSettings, setRoutingSettings] = useState<any>(null);
  const [loadingRouting, setLoadingRouting] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);

  const [threshold, setThreshold] = useState('100.00');
  
  const [asaasBelowFixed, setAsaasBelowFixed] = useState('0.99');
  const [asaasBelowPercent, setAsaasBelowPercent] = useState('0.00');
  const [asaasBelowKey, setAsaasBelowKey] = useState('');
  
  const [efiBelowFixed, setEfiBelowFixed] = useState('0.00');
  const [efiBelowPercent, setEfiBelowPercent] = useState('1.19');
  const [efiBelowKey, setEfiBelowKey] = useState('');
  
  const [asaasAboveFixed, setAsaasAboveFixed] = useState('0.99');
  const [asaasAbovePercent, setAsaasAbovePercent] = useState('0.00');
  const [asaasAboveKey, setAsaasAboveKey] = useState('');
  
  const [efiAboveFixed, setEfiAboveFixed] = useState('0.00');
  const [efiAbovePercent, setEfiAbovePercent] = useState('1.19');
  const [efiAboveKey, setEfiAboveKey] = useState('');

  // Proteção de Rota
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
      } else if (profile && profile.role !== 'admin') {
        navigate('/app');
      }
    }
  }, [user, profile, loading, navigate]);

  const loadRoutingSettings = async () => {
    setLoadingRouting(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'pix_routing')
        .single();
      
      if (error) {
        // Fallback default
        setRoutingSettings({
          threshold: 100,
          below: {
            asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' },
            efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' }
          },
          above: {
            asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' },
            efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' }
          }
        });
      } else {
        setRoutingSettings(data.value);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRouting(false);
    }
  };

  useEffect(() => {
    if (routingSettings) {
      setThreshold(String(routingSettings.threshold ?? 100));
      
      setAsaasBelowFixed(String(routingSettings.below?.asaas?.fixed ?? 0.99));
      setAsaasBelowPercent(String(routingSettings.below?.asaas?.percent ?? 0));
      setAsaasBelowKey(routingSettings.below?.asaas?.key || '');
      
      setEfiBelowFixed(String(routingSettings.below?.efi?.fixed ?? 0));
      setEfiBelowPercent(String(routingSettings.below?.efi?.percent ?? 1.19));
      setEfiBelowKey(routingSettings.below?.efi?.key || '');
      
      setAsaasAboveFixed(String(routingSettings.above?.asaas?.fixed ?? 0.99));
      setAsaasAbovePercent(String(routingSettings.above?.asaas?.percent ?? 0));
      setAsaasAboveKey(routingSettings.above?.asaas?.key || '');
      
      setEfiAboveFixed(String(routingSettings.above?.efi?.fixed ?? 0));
      setEfiAbovePercent(String(routingSettings.above?.efi?.percent ?? 1.19));
      setEfiAboveKey(routingSettings.above?.efi?.key || '');
    }
  }, [routingSettings]);

  const handleSaveRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRouting(true);
    try {
      const updatedValue = {
        threshold: parseFloat(threshold) || 100,
        below: {
          asaas: { fixed: parseFloat(asaasBelowFixed) || 0, percent: parseFloat(asaasBelowPercent) || 0, key: asaasBelowKey.trim() },
          efi: { fixed: parseFloat(efiBelowFixed) || 0, percent: parseFloat(efiBelowPercent) || 0, key: efiBelowKey.trim() }
        },
        above: {
          asaas: { fixed: parseFloat(asaasAboveFixed) || 0, percent: parseFloat(asaasAbovePercent) || 0, key: asaasAboveKey.trim() },
          efi: { fixed: parseFloat(efiAboveFixed) || 0, percent: parseFloat(efiAbovePercent) || 0, key: efiAboveKey.trim() }
        }
      };

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'pix_routing',
          value: updatedValue,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      alert('Configurações de roteamento PIX salvas com sucesso!');
      await loadRoutingSettings();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSavingRouting(false);
    }
  };

  // Carregar dados
  const loadData = async () => {
    try {
      // 1. Carregar planos
      const { data: plansData, error: plansErr } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });
      if (plansErr) throw plansErr;
      setPlans(plansData || []);

      // 2. Carregar perfis com planos associados
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select(`
          id, email, role, subscription_status, created_at,
          subscription_plans(id, name, price)
        `)
        .eq('role', 'tenant')
        .order('created_at', { ascending: false });
      if (profilesErr) throw profilesErr;

      // Cast para o tipo correto para calar o TypeScript
      const formattedProfiles = (profilesData || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        role: p.role,
        subscription_status: p.subscription_status,
        created_at: p.created_at,
        subscription_plans: p.subscription_plans ? p.subscription_plans : undefined
      }));

      setTenants(formattedProfiles);
    } catch (err) {
      console.error('Erro ao carregar dados administrativos:', err);
    }
  };

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      loadData();
      loadRoutingSettings();
    }
  }, [user, profile]);

  // Criação de Tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantError('');
    setIsCreatingTenant(true);

    try {
      if (!tenantEmail || !tenantPassword || !selectedPlanId) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      // Criar o usuário no Supabase Auth usando o cliente temporário para não perder a sessão do Admin
      const { error: signUpError } = await tempSupabase.auth.signUp({
        email: tenantEmail,
        password: tenantPassword,
        options: {
          data: {
            role: 'tenant',
            subscription_plan_id: selectedPlanId,
            subscription_status: 'active'
          }
        }
      });

      if (signUpError) throw signUpError;

      // Fechar modal, limpar inputs e atualizar lista
      setIsTenantModalOpen(false);
      setTenantEmail('');
      setTenantPassword('');
      setSelectedPlanId('');
      alert('Tenant/Usuário criado com sucesso!');
      loadData();
    } catch (err: any) {
      setTenantError(err.message || 'Erro ao criar usuário.');
    } finally {
      setIsCreatingTenant(false);
    }
  };

  // Deletar Tenant (Apenas deleta o Profile, no Supabase Auth precisaria da Service Key, então avisamos)
  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('Deseja realmente remover o acesso deste Tenant? O perfil será removido do banco.')) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', tenantId);
      
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Erro ao excluir tenant: ' + err.message);
    }
  };

  // Salvar Plano (Criação/Edição)
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanError('');
    setIsSavingPlan(true);

    try {
      if (!planName || !planPrice || !planMaxStores || !planMaxInvoices) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      const payload = {
        name: planName,
        description: planDescription,
        price: parseFloat(planPrice),
        max_stores: parseInt(planMaxStores),
        max_invoices_per_month: parseInt(planMaxInvoices)
      };

      if (planId) {
        // Atualizar
        const { error } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', planId);
        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from('subscription_plans')
          .insert([payload]);
        if (error) throw error;
      }

      setIsPlanModalOpen(false);
      resetPlanForm();
      loadData();
    } catch (err: any) {
      setPlanError(err.message || 'Erro ao salvar plano.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setPlanId(plan.id);
    setPlanName(plan.name);
    setPlanDescription(plan.description);
    setPlanPrice(String(plan.price));
    setPlanMaxStores(String(plan.max_stores));
    setPlanMaxInvoices(String(plan.max_invoices_per_month));
    setIsPlanModalOpen(true);
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Deseja excluir este plano de assinatura?')) return;
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Erro ao excluir plano: ' + err.message);
    }
  };

  const resetPlanForm = () => {
    setPlanId(null);
    setPlanName('');
    setPlanDescription('');
    setPlanPrice('');
    setPlanMaxStores('3');
    setPlanMaxInvoices('100');
    setPlanError('');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Cálculo de Métricas Administrativas
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.subscription_status === 'active').length;
  const monthlyRevenue = tenants
    .filter(t => t.subscription_status === 'active' && t.subscription_plans)
    .reduce((sum, t) => sum + Number(t.subscription_plans?.price || 0), 0);

  if (loading || !profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verificando Credenciais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header do Admin */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-xl text-white">
            <svg viewBox="0 0 135 135" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
              <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
              <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
            </svg>
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white leading-none">MandaPIX Admin</h1>
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Console Central</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-300">{profile.email}</p>
            <p className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Super Administrador</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-slate-400 transition-all active:scale-95"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Grid de Métricas Principais */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Tenants */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clientes (Tenants)</span>
              <h3 className="text-3xl font-black text-white">{totalTenants}</h3>
              <p className="text-xs text-slate-500 font-semibold">{activeTenants} ativos no sistema</p>
            </div>
            <div className="p-4 bg-teal-500/10 text-teal-400 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Faturamento Mensal (MRR) */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento Estimado (MRR)</span>
              <h3 className="text-3xl font-black text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyRevenue)}
              </h3>
              <p className="text-xs text-slate-500 font-semibold">Projeção recorrente mensal</p>
            </div>
            <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Status da Plataforma */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Geral</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-xl font-bold text-white">Operacional</span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">Supabase RLS & Auth integrado</p>
            </div>
            <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Abas e Listagem */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-3xl shadow-xl overflow-hidden">
          {/* Menu de Abas */}
          <div className="border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/40">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('tenants')}
                className={`py-4 px-2 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                  activeTab === 'tenants' 
                    ? 'border-teal-500 text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Usuários (Tenants)
              </button>
              <button 
                onClick={() => setActiveTab('plans')}
                className={`py-4 px-2 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                  activeTab === 'plans' 
                    ? 'border-teal-500 text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Planos de Assinatura
              </button>
              <button 
                onClick={() => setActiveTab('routing')}
                className={`py-4 px-2 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                  activeTab === 'routing' 
                    ? 'border-teal-500 text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Roteamento PIX
              </button>
            </div>

            {/* Ação da Aba */}
            <div>
              {activeTab === 'tenants' && (
                <button 
                  onClick={() => setIsTenantModalOpen(true)}
                  className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-500/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Tenant</span>
                </button>
              )}
              {activeTab === 'plans' && (
                <button 
                  onClick={() => { resetPlanForm(); setIsPlanModalOpen(true); }}
                  className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-500/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Plano</span>
                </button>
              )}
            </div>
          </div>

          {/* Conteúdo da Aba 1: Tenants */}
          {activeTab === 'tenants' && (
            <div className="p-6">
              {tenants.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhum Tenant registrado</p>
                  <p className="text-xs text-slate-600">Cadastre um usuário acima para começar a usar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3">E-mail do Tenant</th>
                        <th className="pb-3">Plano Associado</th>
                        <th className="pb-3">Data de Registro</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tenants.map(t => (
                        <tr key={t.id} className="hover:bg-slate-800/20 text-slate-300">
                          <td className="py-3.5 font-semibold">{t.email}</td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg font-bold text-[10px] uppercase border border-slate-700/60">
                              {t.subscription_plans?.name || 'Sem Plano'}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-[11px]">
                            {new Date(t.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              t.subscription_status === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              <CheckCircle className="w-3 h-3" />
                              {t.subscription_status === 'active' ? 'Ativo' : 'Suspenso'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteTenant(t.id)}
                              className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-slate-500 transition-colors"
                              title="Remover Perfil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Conteúdo da Aba 2: Planos */}
          {activeTab === 'plans' && (
            <div className="p-6">
              {plans.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <CreditCard className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhum plano cadastrado</p>
                  <p className="text-xs text-slate-600">Crie planos para cobrar de seus tenants.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map(p => (
                    <div 
                      key={p.id} 
                      className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between hover:border-teal-500/30 transition-all group relative"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-base text-white">{p.name}</h4>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditPlan(p)}
                              className="p-1 bg-slate-800 hover:bg-teal-500/20 hover:text-teal-400 rounded text-slate-400"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeletePlan(p.id)}
                              className="p-1 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded text-slate-400"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed min-h-[40px]">{p.description || 'Sem descrição.'}</p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-850">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">/ mês</span>
                        </div>

                        <ul className="space-y-2 text-[11px] text-slate-400 font-medium">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                            <span>Máx. Lojas: <strong className="text-slate-200">{p.max_stores}</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                            <span>Cobranças/Mês: <strong className="text-slate-200">{p.max_invoices_per_month}</strong></span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conteúdo da Aba 3: Roteamento PIX */}
          {activeTab === 'routing' && (
            <div className="p-6">
              {loadingRouting ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-bold uppercase tracking-wider">Carregando taxas...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveRouting} className="space-y-6 max-w-4xl mx-auto">
                  
                  {/* Threshold Settings Card */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></div>
                      <h4 className="font-extrabold text-sm text-white uppercase tracking-wider">Limite de Divisão de Compras (Threshold)</h4>
                    </div>
                    <p className="text-xs text-slate-405 leading-relaxed">
                      Defina o valor limite (R$) que o sistema utilizará para separar as compras. O sistema irá aplicar a taxa abaixo ou acima desse valor, encaminhando sempre o pagamento para o gateway de melhor custo-benefício.
                    </p>
                    <div className="max-w-[200px] space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Valor Limite X (BRL)</label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {/* Dual Grid: Below vs Above X */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Column 1: Below X (Menor que X) */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-5">
                      <h5 className="font-black text-sm text-amber-500 border-b border-slate-800 pb-2.5 uppercase tracking-wide">
                        Compras ABAIXO de R$ {parseFloat(threshold || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h5>
                      
                      {/* Asaas Rate Card */}
                      <div className="space-y-3.5 bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-850/50 pb-1">Gateway Asaas</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-450 uppercase">Taxa Fixa (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={asaasBelowFixed}
                              onChange={(e) => setAsaasBelowFixed(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Perc (%)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={asaasBelowPercent}
                              onChange={(e) => setAsaasBelowPercent(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-455 uppercase">Chave PIX Recebedor (Asaas)</label>
                          <input 
                            type="text"
                            required
                            placeholder="Chave PIX Asaas central"
                            value={asaasBelowKey}
                            onChange={(e) => setAsaasBelowKey(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                      {/* Efi Rate Card */}
                      <div className="space-y-3.5 bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-850/50 pb-1">Gateway Efí (Gerencianet)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Fixa (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={efiBelowFixed}
                              onChange={(e) => setEfiBelowFixed(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Perc (%)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={efiBelowPercent}
                              onChange={(e) => setEfiBelowPercent(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-455 uppercase">Chave PIX Recebedor (Efí)</label>
                          <input 
                            type="text"
                            required
                            placeholder="Chave PIX Efí central"
                            value={efiBelowKey}
                            onChange={(e) => setEfiBelowKey(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Above X (Maior ou Igual a X) */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-5">
                      <h5 className="font-black text-sm text-teal-400 border-b border-slate-800 pb-2.5 uppercase tracking-wide">
                        Compras ACIMA/IGUAL de R$ {parseFloat(threshold || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h5>
                      
                      {/* Asaas Rate Card */}
                      <div className="space-y-3.5 bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-850/50 pb-1">Gateway Asaas</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Fixa (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={asaasAboveFixed}
                              onChange={(e) => setAsaasAboveFixed(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Perc (%)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={asaasAbovePercent}
                              onChange={(e) => setAsaasAbovePercent(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-455 uppercase">Chave PIX Recebedor (Asaas)</label>
                          <input 
                            type="text"
                            required
                            placeholder="Chave PIX Asaas central"
                            value={asaasAboveKey}
                            onChange={(e) => setAsaasAboveKey(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                      {/* Efi Rate Card */}
                      <div className="space-y-3.5 bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-850/50 pb-1">Gateway Efí (Gerencianet)</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Fixa (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={efiAboveFixed}
                              onChange={(e) => setEfiAboveFixed(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-455 uppercase">Taxa Perc (%)</label>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              value={efiAbovePercent}
                              onChange={(e) => setEfiAbovePercent(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-455 uppercase">Chave PIX Recebedor (Efí)</label>
                          <input 
                            type="text"
                            required
                            placeholder="Chave PIX Efí central"
                            value={efiAboveKey}
                            onChange={(e) => setEfiAboveKey(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={savingRouting}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-black py-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-55 shadow-lg shadow-teal-500/10"
                  >
                    {savingRouting ? (
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Salvar Tarifas de Roteamento</span>
                    )}
                  </button>

                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Cadastro de Tenant */}
      {isTenantModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 relative animate-slide-up">
            <button 
              onClick={() => setIsTenantModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-white">Novo Tenant/Usuário</h3>
            </div>

            {tenantError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold leading-relaxed">
                {tenantError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">E-mail do Tenant</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="email"
                    required
                    placeholder="tenant@empresa.com"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 pl-10 pr-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Senha Inicial</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={tenantPassword}
                    onChange={(e) => setTenantPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 pl-10 pr-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Plano de Assinatura</label>
                <select
                  required
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                >
                  <option value="">Selecione um plano...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - R$ {p.price}/mês</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isCreatingTenant}
                className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-55 mt-2"
              >
                {isCreatingTenant ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Criar Acesso Tenant</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criação/Edição de Plano */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 relative animate-slide-up">
            <button 
              onClick={() => setIsPlanModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-white">{planId ? 'Editar Plano' : 'Novo Plano de Assinatura'}</h3>
            </div>

            {planError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold leading-relaxed">
                {planError}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nome do Plano</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Start, PRO, Unlimited"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição</label>
                <textarea 
                  placeholder="Resumo dos benefícios incluídos"
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Preço (BRL)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Máx. Lojas</label>
                  <input 
                    type="number"
                    required
                    value={planMaxStores}
                    onChange={(e) => setPlanMaxStores(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cobranças Permitidas por Mês</label>
                <input 
                  type="number"
                  required
                  value={planMaxInvoices}
                  onChange={(e) => setPlanMaxInvoices(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-3 px-4 text-xs font-medium focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingPlan}
                className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-55 mt-2"
              >
                {isSavingPlan ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{planId ? 'Atualizar Plano' : 'Salvar Plano'}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
