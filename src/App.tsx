import React, { useState, useEffect } from 'react';
import { 
  Home, 
  History, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  FolderOpen, 
  DollarSign, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Menu, 
  X, 
  AlertCircle, 
  ShoppingBag, 
  ShoppingCart, 
  Wallet as WalletIcon,
  LogOut,
  CalendarClock,
  Globe,
  Barcode,
  UserCheck,
  Package,
  Landmark,
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate 
} from 'react-router-dom';

import { 
  formatBRL
} from './utils/pix';
import type { SavedPixKey, Client, Employee, ProductService, Invoice, Catalog, Store, Order, ScheduleSlot, ScheduleCalendar, EcommerceSettings } from './utils/pix';
import { DEFAULT_EMPLOYEES } from './utils/pix';

import { VirtualCard } from './components/VirtualCard';
import { ClientManager } from './components/ClientManager';
import { CatalogManager } from './components/CatalogManager';
import { InvoiceManager } from './components/InvoiceManager';
import { SavedKeys } from './components/SavedKeys';
import { StoreSettings } from './components/StoreSettings';
import { OrderManager } from './components/OrderManager';
import { EcommerceManager } from './components/EcommerceManager';
import { ScheduleManager } from './components/ScheduleManager';
import { BillingSettingsManager } from './components/BillingSettingsManager';
import { EmployeeManager } from './components/EmployeeManager';
import { PublicStorefront } from './pages/PublicStorefront';
import { StockManager } from './components/StockManager';
import { CashFlowManager } from './components/CashFlowManager';
import { FiscalManager } from './components/FiscalManager';

import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { QuickPOS } from './components/QuickPOS';
import { LandingPage } from './pages/LandingPage';
import { supabase, isSupabaseConfigured } from './utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { SupabaseSetupScreen } from './components/SupabaseSetupScreen';

// Protetor de rotas privadas
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Componente que decide se exibe a LandingPage ou se redireciona para o Login
const LandingOrRedirect = () => {
  const [loading, setLoading] = useState(true);
  const [disableLanding, setDisableLanding] = useState(true);

  useEffect(() => {
    const checkSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'disable_landing_page')
          .single();
        if (!error && data) {
          setDisableLanding(!!data.value?.disabled);
        } else {
          setDisableLanding(true);
        }
      } catch (err) {
        console.error(err);
        setDisableLanding(true);
      } finally {
        setLoading(false);
      }
    };
    checkSetting();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (disableLanding) {
    return <Navigate to="/login" replace />;
  }

  return <LandingPage />;
};

// Componente principal do Tenant Workspace
function MandaPixApp() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const getFirstName = () => {
    if (profile?.trade_name) {
      return profile.trade_name.trim().split(' ')[0];
    }
    if (!user) return 'Usuário';
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.first_name;
    if (fullName) {
      return fullName.split(' ')[0];
    }
    if (user.email) {
      const emailName = user.email.split('@')[0];
      const firstPart = emailName.split(/[\._-]/)[0];
      return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    }
    return 'Usuário';
  };

  const firstName = getFirstName();

  const [activeBranch, setActiveBranch] = useState<any>(null);
  const isClinica = activeBranch?.key === 'clinica';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stores' | 'wallets'>(() => {
    const saved = localStorage.getItem('mandapix_active_tab');
    return (saved as any) || 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // States de Dados
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'pdv' | 'orders' | 'invoices' | 'clients' | 'catalogs' | 'schedule' | 'employees' | 'ecommerce' | 'cobranças' | 'stock' | 'cashflow' | 'fiscal' | 'store_settings'>(() => {
    const saved = localStorage.getItem('mandapix_active_subtab');
    return (saved as any) || 'orders';
  });
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('mandapix_expanded_modules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      vendas_catalogo: true,
      clientes_agenda: false,
      financeiro_fiscal: false,
      gestao_loja: false
    };
  });

  // Schedule states
  const [scheduleCalendars, setScheduleCalendars] = useState<ScheduleCalendar[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const currentTenantId = activeEmployee?.tenantId || user?.id;
  const isDirectEmployee = !!(activeEmployee && user && activeEmployee.email === user.email);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [selectedEmployeeIdForPin, setSelectedEmployeeIdForPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [routingSettings, setRoutingSettings] = useState<any>(null);
  const [ecommerceSettings, setEcommerceSettings] = useState<EcommerceSettings | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-module')) {
        setOpenDropdown(null);
        setIsLocked(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadEcommerceSettings = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from('ecommerce_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) throw error;
      setEcommerceSettings(data as EcommerceSettings || null);
    } catch (err) {
      console.error('Erro ao carregar configurações de cobrança:', err);
    }
  };

  useEffect(() => {
    if (activeStoreId) {
      loadEcommerceSettings(activeStoreId);
    } else {
      setEcommerceSettings(null);
    }
  }, [activeStoreId]);

  useEffect(() => {
    localStorage.setItem('mandapix_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mandapix_active_subtab', activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    localStorage.setItem('mandapix_expanded_modules', JSON.stringify(expandedModules));
  }, [expandedModules]);

  // Estados de Carregamento
  const [loadingData, setLoadingData] = useState(true);

  // Filtros de Dashboard
  const [periodFilter, setPeriodFilter] = useState<'30_DAYS' | '90_DAYS' | 'THIS_MONTH' | 'ALL'>('ALL');
  const [dashboardStoreFilter, setDashboardStoreFilter] = useState<string>('ALL');

  // Carregar todos os dados do Supabase baseando-se nas políticas de RLS (tenant_id)
  const loadAllData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      await Promise.all([
        loadStores(),
        loadClients(),
        loadEmployees(),
        loadCatalogs(),
        loadProducts(),
        loadWallets(),
        loadInvoices(),
        loadOrders(),
        loadRoutingSettings(),
        loadScheduleData(),
        loadExpenses()
      ]);
    } catch (err) {
      console.error('Erro ao carregar dados do Supabase:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadActiveBranch = async (tenantId = currentTenantId) => {
    let ramo = profile?.ramo_empresa || 'varejo';

    if (activeEmployee && tenantId && tenantId !== user?.id) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('ramo_empresa')
          .eq('id', tenantId)
          .maybeSingle();
        if (!error && data?.ramo_empresa) {
          ramo = data.ramo_empresa;
        } else {
          const localRamo = localStorage.getItem(`MANDAPIX_LOCAL_BRANCH_${tenantId}`);
          if (localRamo) ramo = localRamo;
        }
      } catch (err) {
        console.warn('Erro ao buscar ramo do tenant:', err);
        const localRamo = localStorage.getItem(`MANDAPIX_LOCAL_BRANCH_${tenantId}`);
        if (localRamo) ramo = localRamo;
      }
    } else if (!activeEmployee && user) {
      if (profile?.ramo_empresa) {
        localStorage.setItem(`MANDAPIX_LOCAL_BRANCH_${user.id}`, profile.ramo_empresa);
      }
    }

    try {
      const { data, error } = await supabase
        .from('business_branches')
        .select('*')
        .eq('key', ramo)
        .maybeSingle();
      
      if (!error && data) {
        if (data.key === 'servicos' && data.order_status_flow && data.order_status_flow.includes('AGENDAMENTO')) {
          const newFlow = ['PENDENTE', 'AGENDADO', 'EM_ATENDIMENTO', 'PAGAMENTO'];
          await supabase
            .from('business_branches')
            .update({ order_status_flow: newFlow })
            .eq('key', 'servicos');
          data.order_status_flow = newFlow;
        }
        setActiveBranch(data);
      } else {
        const fallbacks: Record<string, any> = {
          varejo: { key: 'varejo', name: 'Varejo / Conveniência / Loja Física', order_status_flow: ['REGISTRO_ITENS', 'PAGAMENTO_PIX', 'VENDA_CONCLUIDA'], config: { hide_agenda: true, hide_kitchen: true, main_screen: 'pdv' } },
          servicos: { key: 'servicos', name: 'Serviços / Salão de Beleza / Clínicas / Estética', order_status_flow: ['PENDENTE', 'AGENDADO', 'EM_ATENDIMENTO', 'PAGAMENTO'], config: { hide_delivery: true, hide_kitchen: true, main_screen: 'schedule' } },
          alimentacao: { key: 'alimentacao', name: 'Alimentação / Lanches / Delivery / Restaurantes', order_status_flow: ['ENTRADA_PEDIDO', 'CONFIRMACAO_PAGAMENTO', 'PRODUCAO_COZINHA', 'LOGISTICA_ENVIO', 'PEDIDO_ENTREGUE'], config: { hide_agenda: true, main_screen: 'orders' } },
          clinica: { key: 'clinica', name: 'Clínicas Médicas / Consultórios', order_status_flow: ['PENDENTE', 'CONFIRMADO', 'EM_ATENDIMENTO', 'ATENDIDO', 'CANCELADO'], config: { hide_delivery: true, hide_kitchen: true, main_screen: 'schedule' } }
        };
        setActiveBranch(fallbacks[ramo] || fallbacks.varejo);
      }
    } catch (err) {
      console.error('Erro ao buscar ramo ativo:', err);
    }
  };

  useEffect(() => {
    if (profile || activeEmployee) {
      loadActiveBranch(activeEmployee?.tenantId || user?.id);
    }
  }, [profile, activeEmployee, user]);

  useEffect(() => {
    if (activeBranch?.config?.main_screen) {
      const targetTab = activeBranch.config.main_screen;
      let allowed = true;
      if (activeEmployee) {
        if (activeEmployee.role === 'GERENTE') {
          if (targetTab === 'ecommerce' || targetTab === 'cobranças') allowed = false;
        } else if (activeEmployee.role === 'VENDEDOR') {
          if (!['pdv', 'orders', 'schedule'].includes(targetTab)) allowed = false;
        } else if (activeEmployee.role === 'ATENDENTE') {
          if (!['orders', 'invoices', 'clients', 'catalogs', 'schedule'].includes(targetTab)) allowed = false;
        }
      }
      if (allowed) {
        setActiveSubTab(targetTab as any);
      } else {
        setActiveSubTab('orders');
      }
    }
  }, [activeBranch, activeEmployee]);

  const loadScheduleData = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    try {
      const [calsRes, catLinksRes, slotsRes] = await Promise.all([
        supabase.from('schedule_calendars').select('*').eq('tenant_id', tenantId).order('created_at'),
        supabase.from('schedule_calendar_catalogs').select('*'),
        supabase.from('schedule_slots').select('*').eq('tenant_id', tenantId).order('slot_date').order('slot_time')
      ]);
      if (calsRes.data) {
        const catLinks: any[] = catLinksRes.data || [];
        setScheduleCalendars(calsRes.data.map((d: any) => ({
          id: d.id,
          storeId: d.store_id,
          name: d.name,
          catalogIds: catLinks.filter(l => l.calendar_id === d.id).map((l: any) => l.catalog_id),
          isEnabled: d.is_enabled,
          showSlotsToClient: d.show_slots_to_client,
          requireScheduling: d.require_scheduling,
          advanceDays: d.advance_days,
        })));
      }
      if (slotsRes.data) {
        setScheduleSlots(slotsRes.data.map((d: any) => ({
          id: d.id,
          calendarId: d.calendar_id,
          storeId: d.store_id,
          slotDate: d.slot_date,
          slotTime: d.slot_time.substring(0, 5),
          maxCapacity: d.max_capacity,
          currentBookings: d.current_bookings,
          isEnabled: d.is_enabled,
        })));
      }
    } catch (err) {
      console.warn('Schedule tables may not exist yet:', err);
    }
  };

  const loadRoutingSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'pix_routing')
        .single();
      if (error) {
        console.warn('Erro ao carregar configurações de roteamento, usando padrões:', error);
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
      console.error('Erro ao carregar roteamento:', err);
    }
  };

  const loadStores = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    if (!data || data.length === 0) {
      // Auto-create a default store
      const defaultStore = {
        name: 'Minha Loja',
        description: 'Loja padrão pré-configurada.',
        color: 'from-slate-600 to-blue-700',
        legal_name: '',
        document: '',
        email: '',
        contact: '',
        address: '',
        tenant_id: tenantId
      };
      
      const { data: insertedData, error: insertError } = await supabase
        .from('stores')
        .insert([defaultStore])
        .select('*');
        
      if (insertError) {
        console.error('Erro ao criar loja padrão:', insertError);
        setStores([]);
      } else if (insertedData && insertedData.length > 0) {
        setStores(insertedData);
        setActiveStoreId(insertedData[0].id);
      }
    } else {
      setStores(data);
      if (data.length > 0) {
        setActiveStoreId(data[0].id);
      }
    }
  };
  const loadClients = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw error;
    setClients((data || []).map((d: any) => ({
      id: d.id,
      storeId: d.store_id,
      name: d.name,
      document: d.document,
      email: d.email,
      phone: d.phone
    })));
  };

  const loadEmployees = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });
      if (error) throw error;
      setEmployees((data || []).map((d: any) => ({
        id: d.id,
        tenantId: d.tenant_id,
        storeId: d.store_id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        role: d.role as any,
        accessCode: d.access_code,
        allowWallets: d.allow_wallets,
        commission_rate: d.commission_rate !== undefined ? Number(d.commission_rate) : 30
      })));
    } catch (err) {
      console.warn('Erro ao carregar funcionários do Supabase. Usando dados locais:', err);
      const local = localStorage.getItem(`MANDAPIX_LOCAL_EMPLOYEES_${tenantId}`);
      if (local) {
        setEmployees(JSON.parse(local));
      } else {
        const withStoreIds = DEFAULT_EMPLOYEES.map(emp => ({ ...emp, storeId: activeStoreId || 'store-1' }));
        setEmployees(withStoreIds);
        localStorage.setItem(`MANDAPIX_LOCAL_EMPLOYEES_${tenantId}`, JSON.stringify(withStoreIds));
      }
    }
  };

  const loadCatalogs = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    setCatalogs((data || []).map((d: any) => ({
      id: d.id,
      storeId: d.store_id,
      name: d.name,
      description: d.description
    })));
  };

  const loadProducts = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw error;
    setProducts((data || []).map((d: any) => ({
      id: d.id,
      catalogId: d.catalog_id,
      name: d.name,
      type: d.type,
      price: Number(d.price),
      description: d.description,
      image: d.image,
      stock_quantity: d.stock_quantity !== undefined ? Number(d.stock_quantity) : 10,
      commission_rate: d.commission_rate !== undefined ? Number(d.commission_rate) : 50,
      insumos: d.insumos || []
    })));
  };

  const loadWallets = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false });
    if (error) throw error;
    setSavedKeys((data || []).map((d: any) => ({
      id: d.id,
      walletType: d.wallet_type,
      label: d.label,
      bankName: d.bank_name,
      isPrimary: d.is_primary,
      type: d.type,
      key: d.key,
      name: d.name,
      city: d.city,
      cardProvider: d.card_provider,
      accountIdentifier: d.account_identifier
    })));
  };

  const loadInvoices = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('invoices')
      .select('*, installments(*)')
      .eq('tenant_id', tenantId)
      .order('date_created', { ascending: false });
    if (error) throw error;
    setInvoices((data || []).map((d: any) => ({
      id: d.id,
      storeId: d.store_id,
      invoiceNumber: d.invoice_number,
      clientId: d.client_id,
      productServiceId: d.product_service_id,
      description: d.description,
      totalAmount: Number(d.total_amount),
      dateCreated: d.date_created,
      installmentsCount: d.installments_count,
      walletId: d.wallet_id,
      pixKeyId: d.wallet_id,
      paymentMethodUsed: d.payment_method_used,
      routedGateway: d.routed_gateway,
      transactionFee: d.transaction_fee ? Number(d.transaction_fee) : undefined,
      installments: (d.installments || []).map((inst: any) => ({
        id: inst.id,
        number: inst.number,
        amount: Number(inst.amount),
        dueDate: inst.due_date,
        status: inst.status,
        pixPayload: inst.pix_payload,
        confirmedDate: inst.confirmed_date,
        paymentMethodUsed: inst.payment_method_used,
        routedGateway: inst.routed_gateway,
        transactionFee: inst.transaction_fee ? Number(inst.transaction_fee) : undefined
      })).sort((a: any, b: any) => a.number - b.number)
    })));
  };

  const loadOrders = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_created', { ascending: false });
    if (error) throw error;
    setOrders((data || []).map((d: any) => ({
      id: d.id,
      storeId: d.store_id,
      orderNumber: d.order_number,
      clientName: d.client_name,
      clientPhone: d.client_phone,
      clientEmail: d.client_email,
      clientDocument: d.client_document,
      items: d.items,
      totalAmount: Number(d.total_amount),
      status: d.status,
      dateCreated: d.date_created,
      invoiceId: d.invoice_id,
      scheduledAt: d.scheduled_at || undefined,
      scheduleSlotId: d.schedule_slot_id || undefined,
      commission_split: d.commission_split
    })));
  };

  // ==========================================
  // SCHEDULE CALENDAR HANDLERS
  // ==========================================

  const handleCreateScheduleCalendar = async ({ name, catalogIds }: { name: string; catalogIds: string[] }) => {
    try {
      const { data, error } = await supabase
        .from('schedule_calendars')
        .insert([{
          store_id: activeStoreId,
          name,
          is_enabled: false,
          show_slots_to_client: false,
          require_scheduling: false,
          advance_days: 7,
        }])
        .select()
        .single();
      if (error) throw error;

      if (catalogIds.length > 0) {
        await supabase
          .from('schedule_calendar_catalogs')
          .insert(catalogIds.map(cid => ({ calendar_id: data.id, catalog_id: cid })));
      }

      await loadScheduleData();
    } catch (err) {
      console.error('Erro ao criar calendário:', err);
    }
  };

  const handleUpdateScheduleCalendar = async (calendar: ScheduleCalendar) => {
    try {
      await supabase
        .from('schedule_calendars')
        .update({
          name: calendar.name,
          is_enabled: calendar.isEnabled,
          show_slots_to_client: calendar.showSlotsToClient,
          require_scheduling: calendar.requireScheduling,
          advance_days: calendar.advanceDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendar.id);

      // Sync catalog associations: delete all then re-insert
      await supabase.from('schedule_calendar_catalogs').delete().eq('calendar_id', calendar.id);
      if (calendar.catalogIds.length > 0) {
        await supabase
          .from('schedule_calendar_catalogs')
          .insert(calendar.catalogIds.map(cid => ({ calendar_id: calendar.id, catalog_id: cid })));
      }

      setScheduleCalendars(prev => prev.map(c => c.id === calendar.id ? calendar : c));
    } catch (err) {
      console.error('Erro ao atualizar calendário:', err);
    }
  };

  const handleDeleteScheduleCalendar = async (calendarId: string) => {
    try {
      const { error } = await supabase.from('schedule_calendars').delete().eq('id', calendarId);
      if (error) throw error;
      setScheduleCalendars(prev => prev.filter(c => c.id !== calendarId));
      setScheduleSlots(prev => prev.filter(s => s.calendarId !== calendarId));
    } catch (err) {
      console.error('Erro ao excluir calendário:', err);
    }
  };

  const handleAddScheduleSlot = async (slot: Omit<ScheduleSlot, 'id' | 'currentBookings'>) => {
    try {
      const { data, error } = await supabase
        .from('schedule_slots')
        .insert([{
          calendar_id: slot.calendarId,
          store_id: slot.storeId,
          slot_date: slot.slotDate,
          slot_time: slot.slotTime,
          max_capacity: slot.maxCapacity,
          is_enabled: slot.isEnabled,
        }])
        .select()
        .single();
      if (error) throw error;
      setScheduleSlots(prev => [
        ...prev,
        {
          id: data.id,
          calendarId: data.calendar_id,
          storeId: data.store_id,
          slotDate: data.slot_date,
          slotTime: data.slot_time.substring(0, 5),
          maxCapacity: data.max_capacity,
          currentBookings: data.current_bookings,
          isEnabled: data.is_enabled,
        }
      ]);
    } catch (err: any) {
      console.error('Erro ao adicionar slot:', err);
      if (err.code === '23505') alert('Já existe um slot para este horário nesta data neste calendário.');
    }
  };

  const handleAddBulkScheduleSlots = async (slots: Array<Omit<ScheduleSlot, 'id' | 'currentBookings'>>) => {
    try {
      const toInsert = slots.map(s => ({
        calendar_id: s.calendarId,
        store_id: s.storeId,
        slot_date: s.slotDate,
        slot_time: s.slotTime,
        max_capacity: s.maxCapacity,
        is_enabled: s.isEnabled,
      }));
      const { error } = await supabase
        .from('schedule_slots')
        .upsert(toInsert, { onConflict: 'calendar_id,slot_date,slot_time', ignoreDuplicates: true });
      if (error) throw error;
      await loadScheduleData();
    } catch (err) {
      console.error('Erro ao criar slots em lote:', err);
    }
  };

  const handleDeleteScheduleSlot = async (slotId: string) => {
    try {
      const { error } = await supabase.from('schedule_slots').delete().eq('id', slotId);
      if (error) throw error;
      setScheduleSlots(prev => prev.filter(s => s.id !== slotId));
    } catch (err) {
      console.error('Erro ao excluir slot:', err);
    }
  };

  const handleToggleScheduleSlot = async (slotId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase.from('schedule_slots').update({ is_enabled: isEnabled }).eq('id', slotId);
      if (error) throw error;
      setScheduleSlots(prev => prev.map(s => s.id === slotId ? { ...s, isEnabled } : s));
    } catch (err) {
      console.error('Erro ao alternar slot:', err);
    }
  };

  useEffect(() => {
    const initSessionAndLoad = async () => {
      if (!user) {
        setActiveEmployee(null);
        setLoadingData(false);
        return;
      }
      setLoadingData(true);
      
      let tenantIdToUse = user.id;
      
      try {
        let employeeData: any = null;

        // 1. Tentar buscar no banco de dados
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          if (!error && data) {
            employeeData = data;
          }
        } catch (dbErr) {
          console.warn('Tabela de funcionários não encontrada ou erro no banco. Usando fallback local:', dbErr);
        }

        // 2. Fallback: Varrer todas as chaves do localStorage para encontrar o funcionário por e-mail (para testes locais/offline)
        if (!employeeData) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('MANDAPIX_LOCAL_EMPLOYEES_')) {
              try {
                const localEmps = JSON.parse(localStorage.getItem(key) || '[]');
                const found = localEmps.find((e: any) => e.email === user.email);
                if (found) {
                  employeeData = {
                    id: found.id,
                    tenant_id: key.replace('MANDAPIX_LOCAL_EMPLOYEES_', ''),
                    store_id: found.storeId,
                    name: found.name,
                    email: found.email,
                    phone: found.phone,
                    role: found.role,
                    access_code: found.accessCode,
                    allow_wallets: found.allowWallets
                  };
                  break;
                }
              } catch (parseErr) {
                console.error('Erro ao ler funcionários locais no login:', parseErr);
              }
            }
          }
        }

        if (employeeData) {
          const emp: Employee = {
            id: employeeData.id,
            tenantId: employeeData.tenant_id,
            storeId: employeeData.store_id,
            name: employeeData.name,
            email: employeeData.email,
            phone: employeeData.phone,
            role: employeeData.role as any,
            accessCode: employeeData.access_code,
            allowWallets: employeeData.allow_wallets
          };
          setActiveEmployee(emp);
          setActiveStoreId(employeeData.store_id);
          tenantIdToUse = employeeData.tenant_id;
          setActiveTab('stores');
          
          let allowed = true;
          if (employeeData.role === 'GERENTE') {
            if (activeSubTab === 'ecommerce' || activeSubTab === 'cobranças') allowed = false;
          } else if (employeeData.role === 'VENDEDOR') {
            if (!['pdv', 'orders', 'schedule'].includes(activeSubTab)) allowed = false;
          } else if (employeeData.role === 'ATENDENTE') {
            if (!['orders', 'invoices', 'clients', 'catalogs', 'schedule'].includes(activeSubTab)) allowed = false;
          }
          if (!allowed) {
            setActiveSubTab('orders');
          }
        } else {
          setActiveEmployee(null);
        }
      } catch (err) {
        console.error('Erro ao verificar login direto de funcionário:', err);
      }

      try {
        await Promise.all([
          loadStores(tenantIdToUse),
          loadClients(tenantIdToUse),
          loadEmployees(tenantIdToUse),
          loadCatalogs(tenantIdToUse),
          loadProducts(tenantIdToUse),
          loadWallets(tenantIdToUse),
          loadInvoices(tenantIdToUse),
          loadOrders(tenantIdToUse),
          loadRoutingSettings(),
          loadScheduleData(tenantIdToUse),
          loadExpenses(tenantIdToUse)
        ]);
      } catch (err) {
        console.error('Erro ao carregar dados do Supabase:', err);
      } finally {
        setLoadingData(false);
      }
    };

    initSessionAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Callbacks para Lojas
  const handleAddStore = async (newStoreData: Omit<Store, 'id'>) => {
    try {
      const { error } = await supabase
        .from('stores')
        .insert([newStoreData]);
      if (error) throw error;
      await loadStores();
    } catch (err) {
      console.error('Erro ao adicionar loja:', err);
    }
  };

  const handleEditStore = async (updatedStore: Store) => {
    try {
      const { error } = await supabase
        .from('stores')
        .update({ 
          name: updatedStore.name, 
          description: updatedStore.description, 
          color: updatedStore.color,
          document: updatedStore.document || null,
          contact: updatedStore.contact || null,
          email: updatedStore.email || null,
          legal_name: updatedStore.legal_name || null,
          address: updatedStore.address || null
        })
        .eq('id', updatedStore.id);
      if (error) throw error;
      await loadStores();
    } catch (err) {
      console.error('Erro ao editar loja:', err);
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Deseja excluir esta loja? Todos os catálogos, pedidos, clientes e faturas vinculados serão excluídos.')) return;
    try {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);
      if (error) throw error;
      if (activeStoreId === id) {
        setActiveStoreId(null);
      }
      await loadAllData();
    } catch (err) {
      console.error('Erro ao excluir loja:', err);
    }
  };

  // Callbacks para Clientes
  const handleAddClient = async (newClientData: Omit<Client, 'id'>) => {
    try {
      const { error } = await supabase
        .from('clients')
        .insert([{
          store_id: newClientData.storeId,
          name: newClientData.name,
          document: newClientData.document,
          email: newClientData.email,
          phone: newClientData.phone
        }]);
      if (error) throw error;
      await loadClients();
    } catch (err) {
      console.error('Erro ao adicionar cliente:', err);
    }
  };

  const handleEditClient = async (updatedClient: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: updatedClient.name,
          document: updatedClient.document,
          email: updatedClient.email,
          phone: updatedClient.phone
        })
        .eq('id', updatedClient.id);
      if (error) throw error;
      await loadClients();
    } catch (err) {
      console.error('Erro ao editar cliente:', err);
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadClients();
    } catch (err) {
      console.error('Erro ao deletar cliente:', err);
    }
  };

  // Callbacks para Funcionários
  const handleAddEmployee = async (newEmpData: Omit<Employee, 'id'>) => {
    if (!currentTenantId) return;
    try {
      // Registrar o funcionário no Supabase Auth para permitir o login direto
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('VITE_SUPABASE_URL') || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
          await tempSupabase.auth.signUp({
            email: newEmpData.email,
            password: newEmpData.accessCode,
            options: {
              data: {
                role: 'tenant' // Perfil inicial para trigger no banco criar perfil tenant
              }
            }
          });
        } catch (signUpErr) {
          console.warn('Erro ao criar credenciais de autenticação do funcionário:', signUpErr);
        }
      }

      const { error } = await supabase
        .from('employees')
        .insert([{
          tenant_id: currentTenantId,
          store_id: newEmpData.storeId,
          name: newEmpData.name,
          email: newEmpData.email,
          phone: newEmpData.phone,
          role: newEmpData.role,
          access_code: newEmpData.accessCode,
          allow_wallets: newEmpData.allowWallets || false
        }]);
      if (error) throw error;
      await loadEmployees();
    } catch (err) {
      console.warn('Erro ao salvar no Supabase, salvando localmente:', err);
      const newEmp: Employee = {
        id: 'emp-' + Math.random().toString(36).substring(2, 9),
        ...newEmpData
      };
      const updated = [newEmp, ...employees];
      setEmployees(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EMPLOYEES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  const handleEditEmployee = async (updatedEmp: Employee) => {
    if (!currentTenantId) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          name: updatedEmp.name,
          email: updatedEmp.email,
          phone: updatedEmp.phone,
          role: updatedEmp.role,
          access_code: updatedEmp.accessCode,
          allow_wallets: updatedEmp.allowWallets || false
        })
        .eq('id', updatedEmp.id);
      if (error) throw error;
      await loadEmployees();
    } catch (err) {
      console.warn('Erro ao editar no Supabase, atualizando localmente:', err);
      const updated = employees.map(e => e.id === updatedEmp.id ? updatedEmp : e);
      setEmployees(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EMPLOYEES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!currentTenantId) return;
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadEmployees();
    } catch (err) {
      console.warn('Erro ao excluir no Supabase, atualizando localmente:', err);
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EMPLOYEES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  // Callbacks para Produtos
  const handleAddProduct = async (newProductData: Omit<ProductService, 'id'>) => {
    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          catalog_id: newProductData.catalogId,
          name: newProductData.name,
          type: newProductData.type,
          price: newProductData.price,
          description: newProductData.description,
          image: newProductData.image
        }]);
      if (error) throw error;
      await loadProducts();
    } catch (err) {
      console.error('Erro ao adicionar produto:', err);
    }
  };

  const handleEditProduct = async (updatedProduct: ProductService) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: updatedProduct.name,
          type: updatedProduct.type,
          price: updatedProduct.price,
          description: updatedProduct.description,
          image: updatedProduct.image
        })
        .eq('id', updatedProduct.id);
      if (error) throw error;
      await loadProducts();
    } catch (err) {
      console.error('Erro ao editar produto:', err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadProducts();
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
    }
  };

  // Callbacks para Catálogos
  const handleAddCatalog = async (newCatData: Omit<Catalog, 'id'>) => {
    try {
      const { error } = await supabase
        .from('catalogs')
        .insert([{
          store_id: newCatData.storeId,
          name: newCatData.name,
          description: newCatData.description
        }]);
      if (error) throw error;
      await loadCatalogs();
    } catch (err) {
      console.error('Erro ao adicionar catálogo:', err);
    }
  };

  const handleEditCatalog = async (updatedCat: Catalog) => {
    try {
      const { error } = await supabase
        .from('catalogs')
        .update({
          name: updatedCat.name,
          description: updatedCat.description
        })
        .eq('id', updatedCat.id);
      if (error) throw error;
      await loadCatalogs();
    } catch (err) {
      console.error('Erro ao editar catálogo:', err);
    }
  };

  const handleDeleteCatalog = async (id: string) => {
    try {
      const { error } = await supabase
        .from('catalogs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadCatalogs();
      await loadProducts();
    } catch (err) {
      console.error('Erro ao deletar catálogo:', err);
    }
  };

  // Callbacks para Faturas
  const handleAddInvoice = async (newInvoice: Invoice) => {
    try {
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .insert([{
          store_id: newInvoice.storeId,
          invoice_number: newInvoice.invoiceNumber,
          client_id: newInvoice.clientId,
          product_service_id: newInvoice.productServiceId || null,
          description: newInvoice.description,
          total_amount: newInvoice.totalAmount,
          installments_count: newInvoice.installmentsCount,
          wallet_id: newInvoice.walletId || newInvoice.pixKeyId || null,
          payment_method_used: newInvoice.paymentMethodUsed || null
        }])
        .select()
        .single();
      
      if (invError) throw invError;
      
      const installmentsToInsert = newInvoice.installments.map(inst => ({
        invoice_id: invData.id,
        number: inst.number,
        amount: inst.amount,
        due_date: inst.dueDate,
        status: inst.status,
        pix_payload: inst.pixPayload,
        confirmed_date: inst.confirmedDate || null,
        payment_method_used: inst.paymentMethodUsed || null
      }));

      const { error: instError } = await supabase
        .from('installments')
        .insert(installmentsToInsert);
      
      if (instError) throw instError;

      // Se houver agendamento de slot ativo associado a esta venda
      if (newInvoice.scheduleSlotId && newInvoice.scheduleCalendarId && newInvoice.scheduledAt) {
        const clientObj = clients.find(c => c.id === newInvoice.clientId);
        
        // 1. Inserir pedido correspondente na tabela de pedidos (para aparecer na agenda)
        const { error: orderError } = await supabase
          .from('orders')
          .insert([{
            store_id: newInvoice.storeId,
            order_number: newInvoice.invoiceNumber,
            client_name: clientObj?.name || 'Cliente Avulso',
            client_phone: clientObj?.phone || '',
            client_email: clientObj?.email || '',
            client_document: clientObj?.document || '',
            items: [{ productServiceId: newInvoice.productServiceId || '', name: newInvoice.description, quantity: 1, price: newInvoice.totalAmount }],
            total_amount: newInvoice.totalAmount,
            status: 'AGENDADO',
            invoice_id: invData.id,
            scheduled_at: newInvoice.scheduledAt,
            schedule_slot_id: newInvoice.scheduleSlotId,
            schedule_calendar_id: newInvoice.scheduleCalendarId
          }]);
        
        if (orderError) throw orderError;

        // 2. Incrementar contagem no slot
        const slot = scheduleSlots.find(s => s.id === newInvoice.scheduleSlotId);
        if (slot) {
          await supabase
            .from('schedule_slots')
            .update({ current_bookings: slot.currentBookings + 1 })
            .eq('id', newInvoice.scheduleSlotId);
        }

        await loadOrders();
        await loadScheduleData();
      }

      await loadInvoices();
    } catch (err) {
      console.error('Erro ao adicionar fatura:', err);
    }
  };

  const handleEditInvoice = async (updatedInvoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          description: updatedInvoice.description,
          total_amount: updatedInvoice.totalAmount,
          wallet_id: updatedInvoice.walletId || updatedInvoice.pixKeyId || null,
          payment_method_used: updatedInvoice.paymentMethodUsed || null
        })
        .eq('id', updatedInvoice.id);

      if (error) throw error;
      await loadInvoices();
    } catch (err) {
      console.error('Erro ao editar fatura:', err);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadInvoices();
      await loadOrders();
    } catch (err) {
      console.error('Erro ao deletar fatura:', err);
    }
  };

  const handleUpdateInstallmentStatus = async (
    invoiceId: string,
    installmentId: string,
    status: 'PAGO' | 'PENDENTE',
    paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
  ) => {
    try {
      const { error } = await supabase
        .from('installments')
        .update({
          status,
          confirmed_date: status === 'PAGO' ? new Date().toISOString().split('T')[0] : null,
          payment_method_used: status === 'PAGO' ? (paymentMethodUsed || 'PIX') : null
        })
        .eq('id', installmentId);
      
      if (error) throw error;

      const order = orders.find(o => o.invoiceId === invoiceId);
      if (order) {
        const { data: instsData, error: instsError } = await supabase
          .from('installments')
          .select('*')
          .eq('invoice_id', invoiceId);
        
        if (instsError) throw instsError;

        const allPaid = instsData.every((inst: any) => inst.status === 'PAGO');
        const newStatus = allPaid ? 'APROVADO' : 'PENDENTE';
        
        if (order.status !== newStatus) {
          await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id);
        }
      }

      await loadInvoices();
      await loadOrders();
    } catch (err) {
      console.error('Erro ao atualizar status da parcela:', err);
    }
  };

  // Callbacks para Pedidos
  const handleCancelOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CANCELADO' })
        .eq('id', id);
      if (error) throw error;
      await loadOrders();
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err);
    }
  };

  const handleUpdateOrderStatus = async (id: string, newStatus: Order['status']) => {
    try {
      const order = orders.find(o => o.id === id);
      let calculatedSplit = order?.commission_split;
      
      if (newStatus === 'PIX Confirmado' && order && order.scheduleSlotId) {
        const slot = scheduleSlots.find(s => s.id === order.scheduleSlotId);
        if (slot) {
          const calendar = scheduleCalendars.find(c => c.id === slot.calendarId);
          if (calendar && calendar.employee_id) {
            const employee = employees.find(e => e.id === calendar.employee_id);
            if (employee) {
              const rate = employee.commission_rate ?? 30;
              const professionalAmount = parseFloat((order.totalAmount * rate / 100).toFixed(2));
              const storeAmount = parseFloat((order.totalAmount - professionalAmount).toFixed(2));
              calculatedSplit = {
                employeeId: employee.id,
                employeeName: employee.name,
                rate,
                professionalAmount,
                storeAmount
              };
            }
          }
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          commission_split: calculatedSplit
        })
        .eq('id', id);
      if (error) throw error;

      if (newStatus === 'APROVADO') {
        if (order && order.invoiceId) {
          const inv = invoices.find(i => i.id === order.invoiceId);
          if (inv && inv.installments.length > 0) {
            const firstInst = inv.installments[0];
            if (firstInst.status !== 'PAGO') {
              await supabase
                .from('installments')
                .update({
                  status: 'PAGO',
                  confirmed_date: new Date().toISOString().split('T')[0],
                  payment_method_used: firstInst.paymentMethodUsed || 'PIX'
                })
                .eq('id', firstInst.id);
            }
          }
        }
      }

      if (newStatus === 'PIX Confirmado' && order) {
        if (webhookUrl) {
          const isService = order.items.some(item => {
            const prod = products.find(p => p.id === item.productServiceId);
            return prod?.type === 'SERVICO';
          }) || activeBranch?.key === 'servicos';
          
          const invoiceType = isService ? 'NFS-e (Serviço)' : 'NFC-e (Comércio)';
          const logId = 'log-' + Math.random().toString(36).substring(2, 9);
          
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'order.payment_confirmed',
                orderId: order.id,
                orderNumber: order.orderNumber,
                clientName: order.clientName,
                clientDocument: order.clientDocument,
                totalAmount: order.totalAmount,
                items: order.items,
                invoiceType,
                timestamp: new Date().toISOString()
              })
            });
            
            const newLog = {
              id: logId,
              timestamp: new Date().toISOString(),
              orderNumber: order.orderNumber,
              clientName: order.clientName,
              invoiceType,
              status: 'SUCESSO' as const,
              endpoint: webhookUrl,
              payload: `Nota fiscal emitida com sucesso para o pedido #${order.orderNumber}`
            };
            setWebhookLogs(prev => {
              const updated = [newLog, ...prev];
              localStorage.setItem(`MANDAPIX_WEBHOOK_LOGS_${currentTenantId}`, JSON.stringify(updated));
              return updated;
            });
          } catch (webErr) {
            console.warn('Erro ao disparar webhook de faturamento:', webErr);
            const newLog = {
              id: logId,
              timestamp: new Date().toISOString(),
              orderNumber: order.orderNumber,
              clientName: order.clientName,
              invoiceType,
              status: 'ERRO' as const,
              endpoint: webhookUrl,
              payload: `Erro na comunicação: ${webErr instanceof Error ? webErr.message : String(webErr)}`
            };
            setWebhookLogs(prev => {
              const updated = [newLog, ...prev];
              localStorage.setItem(`MANDAPIX_WEBHOOK_LOGS_${currentTenantId}`, JSON.stringify(updated));
              return updated;
            });
          }
        }

        for (const item of order.items) {
          const prod = products.find(p => p.id === item.productServiceId || p.name === item.name);
          if (prod && prod.insumos && prod.insumos.length > 0) {
            for (const insumo of prod.insumos) {
              const insumoProduct = products.find(p => p.id === insumo.product_id);
              if (insumoProduct) {
                const currentStock = insumoProduct.stock_quantity ?? 10;
                const quantityToDeduct = insumo.quantity * item.quantity;
                const newStock = Math.max(0, currentStock - quantityToDeduct);
                
                await supabase
                  .from('products')
                  .update({ stock_quantity: newStock })
                  .eq('id', insumoProduct.id);
              }
            }
          }
        }
      }

      await loadOrders();
      await loadInvoices();
      await loadProducts();
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
    }
  };

  useEffect(() => {
    if (currentTenantId) {
      const savedUrl = localStorage.getItem(`MANDAPIX_WEBHOOK_URL_${currentTenantId}`) || '';
      setWebhookUrl(savedUrl);
      const savedLogs = localStorage.getItem(`MANDAPIX_WEBHOOK_LOGS_${currentTenantId}`);
      setWebhookLogs(savedLogs ? JSON.parse(savedLogs) : []);
    }
  }, [currentTenantId]);

  const loadExpenses = async (tenantId = currentTenantId) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      setExpenses((data || []).map((d: any) => ({
        id: d.id,
        storeId: d.store_id,
        category: d.category,
        description: d.description,
        amount: Number(d.amount),
        dueDate: d.due_date,
        status: d.status
      })));
    } catch (err) {
      console.warn('Erro ao carregar despesas do Supabase, usando local:', err);
      const local = localStorage.getItem(`MANDAPIX_LOCAL_EXPENSES_${tenantId}`);
      if (local) {
        setExpenses(JSON.parse(local));
      } else {
        setExpenses([]);
      }
    }
  };

  const handleAddExpense = async (newExpData: any) => {
    if (!currentTenantId) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          tenant_id: currentTenantId,
          store_id: newExpData.storeId,
          category: newExpData.category,
          description: newExpData.description,
          amount: newExpData.amount,
          due_date: newExpData.dueDate,
          status: newExpData.status
        }]);
      if (error) throw error;
      await loadExpenses();
    } catch (err) {
      console.warn('Erro ao adicionar despesa no Supabase, salvando localmente:', err);
      const newExp = {
        id: 'exp-' + Math.random().toString(36).substring(2, 9),
        ...newExpData
      };
      const updated = [...expenses, newExp];
      setExpenses(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EXPENSES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  const handlePayExpense = async (id: string, newStatus: 'PENDENTE' | 'PAGO') => {
    if (!currentTenantId) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      await loadExpenses();
    } catch (err) {
      console.warn('Erro ao atualizar status da despesa no Supabase, usando local:', err);
      const updated = expenses.map(e => e.id === id ? { ...e, status: newStatus } : e);
      setExpenses(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EXPENSES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentTenantId) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadExpenses();
    } catch (err) {
      console.warn('Erro ao deletar despesa no Supabase, usando local:', err);
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_EXPENSES_${currentTenantId}`, JSON.stringify(updated));
    }
  };

  const handleWebhookUrlChange = (url: string) => {
    setWebhookUrl(url);
    if (currentTenantId) {
      localStorage.setItem(`MANDAPIX_WEBHOOK_URL_${currentTenantId}`, url);
    }
  };



  const handleKeysChanged = () => {
    loadWallets();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Computações e filtros do Painel Financeiro
  const dashboardInvoices = dashboardStoreFilter === 'ALL' 
    ? invoices 
    : invoices.filter(inv => inv.storeId === dashboardStoreFilter);

  const getInstallmentsInPeriod = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allInsts = dashboardInvoices.flatMap(inv => 
      inv.installments.map(inst => ({
        ...inst,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        description: inv.description
      }))
    );

    return allInsts.filter(inst => {
      if (periodFilter === 'ALL') return true;

      const instDate = new Date(inst.dueDate + 'T12:00:00');
      instDate.setHours(0, 0, 0, 0);

      if (periodFilter === 'THIS_MONTH') {
        return instDate.getMonth() === today.getMonth() && instDate.getFullYear() === today.getFullYear();
      }

      if (periodFilter === '30_DAYS') {
        const diffTime = instDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= -30 && diffDays <= 30;
      }

      if (periodFilter === '90_DAYS') {
        const diffTime = instDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= -90 && diffDays <= 90;
      }

      return true;
    });
  };

  const filteredInsts = getInstallmentsInPeriod();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const totalPaid = filteredInsts
    .filter(i => i.status === 'PAGO')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalA_Vencer = filteredInsts
    .filter(i => i.status === 'PENDENTE' && new Date(i.dueDate + 'T12:00:00') >= todayDate)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalVencido = filteredInsts
    .filter(i => i.status === 'PENDENTE' && new Date(i.dueDate + 'T12:00:00') < todayDate)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalBilled = totalPaid + totalA_Vencer + totalVencido;

  const paidRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  const overdueRate = totalBilled > 0 ? (totalVencido / totalBilled) * 100 : 0;

  // Gráfico 1: Dados mensais agrupados (últimos 4 meses)
  const getMonthlyChartData = () => {
    const monthGroups: { [key: string]: { paid: number; unpaid: number; label: string } } = {};
    
    monthGroups['2026-04'] = { paid: 0, unpaid: 0, label: 'Abr' };
    monthGroups['2026-05'] = { paid: 0, unpaid: 0, label: 'Mai' };
    monthGroups['2026-06'] = { paid: 0, unpaid: 0, label: 'Jun' };
    monthGroups['2026-07'] = { paid: 0, unpaid: 0, label: 'Jul' };
    
    dashboardInvoices.forEach(inv => {
      inv.installments.forEach(inst => {
        const date = new Date(inst.dueDate + 'T12:00:00');
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthGroups[key]) {
          const label = date.toLocaleDateString('pt-BR', { month: 'short' }).substring(0, 3);
          monthGroups[key] = { paid: 0, unpaid: 0, label: label.charAt(0).toUpperCase() + label.slice(1) };
        }
        
        if (inst.status === 'PAGO') {
          monthGroups[key].paid += inst.amount;
        } else {
          monthGroups[key].unpaid += inst.amount;
        }
      });
    });

    return Object.keys(monthGroups)
      .sort()
      .map(k => ({
        key: k,
        ...monthGroups[k]
      }))
      .slice(-4);
  };

  const monthlyChartData = getMonthlyChartData();
  const maxValInChart = Math.max(
    ...monthlyChartData.map(d => Math.max(d.paid, d.unpaid)),
    100
  );

  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const paidDash = (totalPaid / (totalBilled || 1)) * circ;
  const aVencerDash = (totalA_Vencer / (totalBilled || 1)) * circ;
  const vencidoDash = (totalVencido / (totalBilled || 1)) * circ;

  const primaryKey = savedKeys.find(k => k.isPrimary) || savedKeys[0];

  const getClientName = (id: string) => {
    const cli = clients.find(c => c.id === id);
    return cli ? cli.name : 'Cliente Excluído';
  };

  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: Home },
    { id: 'stores', label: 'Loja', icon: ShoppingBag },
    { id: 'wallets', label: 'Carteiras', icon: WalletIcon }
  ] as const;

  const visibleMenuItems = activeEmployee 
    ? (activeEmployee.allowWallets
        ? menuItems.filter(item => item.id === 'stores' || item.id === 'wallets')
        : menuItems.filter(item => item.id === 'stores')
      )
    : menuItems;

  const renderStoreSubmenu = (isMobile: boolean) => {
    const getFilteredSubtabs = (subtabs: any[]) => {
      return subtabs.filter(subTab => {
        if (activeEmployee) {
          if (activeEmployee.role === 'GERENTE') {
            if (['ecommerce', 'cobranças', 'fiscal', 'store_settings'].includes(subTab.id)) return false;
          } else if (activeEmployee.role === 'VENDEDOR') {
            if (!['pdv', 'orders', 'schedule'].includes(subTab.id)) return false;
          } else if (activeEmployee.role === 'ATENDENTE') {
            if (!['orders', 'invoices', 'clients', 'catalogs', 'schedule'].includes(subTab.id)) return false;
          }
        }
        if (!activeBranch) return true;
        if (subTab.id === 'schedule' && activeBranch.config?.hide_agenda) return false;
        if (subTab.id === 'pdv' && activeBranch.key !== 'varejo') return false;
        return true;
      });
    };

    const modules = [
      {
        id: 'vendas_catalogo',
        name: 'Vendas e Catálogos',
        subtabs: [
          ...(activeBranch?.key === 'varejo' ? [{ id: 'pdv', label: 'PDV Rápido' }] : []),
          { id: 'orders', label: isClinica ? 'Consultas' : 'Pedidos' },
          { id: 'invoices', label: isClinica ? 'Faturamento' : 'Gerenciar Vendas' },
          { id: 'catalogs', label: isClinica ? 'Procedimentos' : 'Catálogos' },
          { id: 'stock', label: 'Estoque e Insumos' }
        ]
      },
      {
        id: 'clientes_agenda',
        name: 'Clientes e Agenda',
        subtabs: [
          { id: 'schedule', label: isClinica ? 'Agenda Médica' : 'Agenda' },
          { id: 'clients', label: isClinica ? 'Pacientes' : 'Clientes' }
        ]
      },
      {
        id: 'financeiro_fiscal',
        name: 'Financeiro e Fiscal',
        subtabs: [
          { id: 'cobranças', label: 'Cobranças' },
          { id: 'cashflow', label: 'Fluxo de Caixa' },
          { id: 'fiscal', label: 'Painel MEI & Fiscal' }
        ]
      },
      {
        id: 'gestao_loja',
        name: 'Gestão da Loja',
        subtabs: [
          { id: 'store_settings', label: 'Identificação' },
          { id: 'employees', label: isClinica ? 'Médicos & Equipe' : 'Funcionários' },
          { id: 'ecommerce', label: 'E-commerce' }
        ]
      }
    ];

    return (
      <div className="pl-4 pr-1 py-1 flex flex-col gap-1 border-l border-slate-800 ml-5 mt-1 space-y-1 select-none">
        {modules.map(module => {
          const visibleSubtabs = getFilteredSubtabs(module.subtabs);
          if (visibleSubtabs.length === 0) return null;

          const isExpanded = !!expandedModules[module.id];
          const isModuleActive = visibleSubtabs.some(sub => activeSubTab === sub.id);

          return (
            <div key={module.id} className="flex flex-col gap-0.5">
              {/* Module Header */}
              <button
                type="button"
                onClick={() => {
                  setExpandedModules(prev => ({
                    ...prev,
                    [module.id]: !prev[module.id]
                  }));
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-left transition-all ${
                  isModuleActive 
                    ? 'text-[#4FD1C5] font-black' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{module.name}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                )}
              </button>

              {/* Module Subtabs (only if expanded) */}
              {isExpanded && (
                <div className="pl-2 flex flex-col gap-0.5 transition-all duration-200">
                  {visibleSubtabs.map(subTab => {
                    const isSubActive = activeSubTab === subTab.id;
                    return (
                      <button
                        key={subTab.id}
                        type="button"
                        onClick={() => {
                          setActiveSubTab(subTab.id as any);
                          setActiveTab('stores');
                          if (isMobile) {
                            setIsSidebarOpen(false);
                          }
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          isSubActive
                            ? 'bg-pix/15 text-[#4FD1C5] font-extrabold border-l-2 border-pix'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                        }`}
                      >
                        {subTab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-905 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-pix border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando Banco de Dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      {!isDirectEmployee && (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen flex-shrink-0 z-20 shadow-xl">
          <div className="p-6 border-b border-slate-800/60 flex items-center gap-2.5">
            <div className="p-2 bg-pix rounded-xl text-white shadow-md shadow-pix/20">
              <svg viewBox="0 0 135 135" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
                <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
                <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-white leading-none">MandaPIX</h1>
              <span className="text-[10px] text-pix uppercase tracking-widest font-black">ERP Autônomo</span>
            </div>
          </div>

          {/* Logged in User Profile Info (Desktop) */}
          <div className="px-6 py-4 border-b border-slate-800/40 flex flex-col gap-2 bg-slate-900/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 truncate">
                {activeEmployee ? (
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0">
                    {activeEmployee.name.charAt(0)}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-pix/10 border border-pix/20 text-pix flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0">
                    {firstName.charAt(0)}
                  </div>
                )}
                <div className="truncate">
                  {activeEmployee ? (
                    <>
                      <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">{activeEmployee.role}</p>
                      <p className="text-xs font-bold text-slate-200 truncate mt-0.5">{activeEmployee.name}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Olá, bem-vindo(a)</p>
                      <p className="text-xs font-bold text-slate-200 truncate mt-0.5">{firstName}</p>
                    </>
                  )}
                </div>
              </div>
              {activeEmployee ? (
                <button
                  onClick={() => {
                    if (confirm("Deseja sair do modo funcionário e retornar ao painel principal?")) {
                      setActiveEmployee(null);
                    }
                  }}
                  className="p-2 bg-amber-500/10 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-amber-500 transition-all active:scale-95 flex-shrink-0"
                  title="Sair do Perfil de Funcionário"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-800/40 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-slate-400 transition-all active:scale-95 flex-shrink-0 animate-fade-in"
                  title="Sair da Conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {visibleMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (item.id === 'stores') {
                return (
                  <div key={item.id} className="flex flex-col gap-1 animate-fade-in">
                    <button
                      onClick={() => {
                        setActiveTab('stores');
                        setActiveSubTab('orders');
                        setIsSidebarOpen(false);
                        if (stores.length > 0) {
                          setActiveStoreId(stores[0].id);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-pix text-white shadow-md shadow-pix/10' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                    {isActive && renderStoreSubmenu(false)}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-pix text-white shadow-md shadow-pix/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer info in sidebar */}
          {primaryKey && (
            <div className="p-4 m-4 bg-slate-800/50 rounded-2xl border border-slate-800 flex items-center justify-between text-left">
              <div className="truncate max-w-[140px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Carteira Receptora</p>
                <p className="text-xs font-bold text-white truncate mt-0.5">{primaryKey.label}</p>
              </div>
              <div className="w-6 h-6 rounded bg-pix/10 text-pix flex items-center justify-center font-bold text-[10px] uppercase">
                {primaryKey.walletType === 'PIX'
                  ? primaryKey.bankName.substring(0, 2)
                  : primaryKey.walletType === 'CREDIT_CARD'
                  ? 'CC'
                  : 'CD'}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* MOBILE HEADER (Top Navigation) */}
      {!isDirectEmployee && (
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pix rounded-lg text-white">
              <svg viewBox="0 0 135 135" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
                <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
                <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
              </svg>
            </div>
            <h1 className="font-extrabold text-sm tracking-tight">MandaPIX ERP</h1>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>
      )}

      {/* Mobile Drawer (Overlay) */}
      {isSidebarOpen && !isDirectEmployee && (
        <div className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex justify-end animate-fade-in">
          <div className="bg-slate-900 w-64 h-full p-6 flex flex-col justify-between text-white animate-slide-up">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="font-bold text-sm tracking-widest text-pix uppercase">Menu ERP</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Logged in User Profile Info (Mobile) */}
              <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 truncate">
                    {activeEmployee ? (
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0">
                        {activeEmployee.name.charAt(0)}
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-pix/10 border border-pix/20 text-pix flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0">
                        {firstName.charAt(0)}
                      </div>
                    )}
                    <div className="truncate">
                      {activeEmployee ? (
                        <>
                          <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">{activeEmployee.role}</p>
                          <p className="text-xs font-bold text-slate-200 truncate mt-0.5">{activeEmployee.name}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Olá, bem-vindo(a)</p>
                          <p className="text-xs font-bold text-slate-200 truncate mt-0.5">{firstName}</p>
                        </>
                      )}
                    </div>
                  </div>
                  {activeEmployee ? (
                    <button
                      onClick={() => {
                        if (confirm("Deseja sair do modo funcionário e retornar ao painel principal?")) {
                          setActiveEmployee(null);
                        }
                      }}
                      className="p-2 bg-amber-500/10 hover:bg-rose-500/20 hover:text-rose-455 rounded-xl text-amber-500 transition-all active:scale-95 flex-shrink-0"
                      title="Sair do Perfil de Funcionário"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleLogout}
                      className="p-2 bg-slate-800/40 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-slate-400 transition-all active:scale-95 flex-shrink-0"
                      title="Sair da Conta"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
                

              </div>
              <nav className="space-y-1">
                {visibleMenuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  if (item.id === 'stores') {
                    return (
                      <div key={item.id} className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setActiveTab('stores');
                            setActiveSubTab('orders');
                            if (stores.length > 0) {
                              setActiveStoreId(stores[0].id);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                            isActive 
                              ? 'bg-pix text-white shadow-md' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                        {isActive && renderStoreSubmenu(true)}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-pix text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>


            </div>
            {primaryKey && (
              <div className="bg-slate-800/50 p-4 rounded-xl text-xs space-y-1 border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500">
                  {primaryKey.walletType === 'PIX' ? 'Chave Principal' : 'Carteira Principal'}
                </span>
                <p className="font-semibold text-white">{primaryKey.label}</p>
                <p className="font-mono text-[10px] text-slate-400 truncate">
                  {primaryKey.walletType === 'PIX' ? primaryKey.key : `ID: •••• •••• •••• ${primaryKey.accountIdentifier?.slice(-4) || 'CARD'}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Dashboard Sub Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Painel Financeiro</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Resumo de contas a receber e faturamento</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filtrar Loja:</span>
                  <select
                    value={dashboardStoreFilter}
                    onChange={(e) => setDashboardStoreFilter(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-pix/50 shadow-sm"
                  >
                    <option value="ALL">Todas as Lojas</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-sm">
                  {(['30_DAYS', '90_DAYS', 'THIS_MONTH', 'ALL'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPeriodFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        periodFilter === f 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f === '30_DAYS' ? '30 dias' : f === '90_DAYS' ? '90 dias' : f === 'THIS_MONTH' ? 'Este Mês' : 'Tudo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Dashboard Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {/* 4 KPI CARD MATRIX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recebido</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalPaid)}</h3>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Receita consolidada
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl z-10">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-emerald-500/5 rounded-full" />
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Vencer</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalA_Vencer)}</h3>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                      <Clock className="w-3.5 h-3.5" /> Títulos pendentes futuros
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl z-10">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-slate-400/5 rounded-full" />
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atrasado / Vencido</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalVencido)}</h3>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${totalVencido > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      <AlertCircle className="w-3.5 h-3.5" /> {totalVencido > 0 ? 'Requer atenção' : 'Nenhuma pendência'}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50 text-red-500 rounded-2xl z-10">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-red-500/5 rounded-full" />
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxa de Liquidez</span>
                    <h3 className="text-2xl font-black text-slate-800">{paidRate.toFixed(1)}%</h3>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Inadimplência: {overdueRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-3 bg-pix-light text-pix rounded-2xl z-10">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-pix/5 rounded-full" />
                </div>
              </div>

              {/* DUAL CHART GRID SYSTEM */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Faturamento por Período</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Comparativo mensal de títulos pagos vs pendentes (BRL)</p>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 block" /> Pago</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 block" /> Aberto / A vencer</span>
                    </div>
                  </div>

                  <div className="w-full">
                    <svg viewBox="0 0 450 220" className="w-full h-auto max-h-[200px]">
                      {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => (
                        <line 
                          key={idx}
                          x1="30" 
                          y1={170 - r * 140} 
                          x2="430" 
                          y2={170 - r * 140} 
                          stroke="#f1f5f9" 
                          strokeWidth="1"
                        />
                      ))}

                      {monthlyChartData.map((d, idx) => {
                        const xOffset = 60 + idx * 95;
                        const paidHeight = (d.paid / maxValInChart) * 140;
                        const unpaidHeight = (d.unpaid / maxValInChart) * 140;
                        
                        return (
                          <g key={d.key}>
                            <rect
                              x={xOffset}
                              y={170 - paidHeight}
                              width="24"
                              height={Math.max(paidHeight, 2)}
                              rx="4"
                              fill="#34d399"
                              className="transition-all duration-300 hover:fill-emerald-500 cursor-pointer"
                            />
                            <rect
                              x={xOffset + 28}
                              y={170 - unpaidHeight}
                              width="24"
                              height={Math.max(unpaidHeight, 2)}
                              rx="4"
                              fill="#fb923c"
                              className="transition-all duration-300 hover:fill-orange-500 cursor-pointer"
                            />
                            <text
                              x={xOffset + 26}
                              y="192"
                              textAnchor="middle"
                              fill="#94a3b8"
                              className="text-[10px] font-bold"
                            >
                              {d.label}
                            </text>
                            
                            {d.paid > 0 && (
                              <text
                                x={xOffset + 12}
                                  y={160 - paidHeight}
                                textAnchor="middle"
                                fill="#475569"
                                className="text-[8px] font-black"
                              >
                                {d.paid >= 1000 ? `${(d.paid/1000).toFixed(1)}k` : d.paid.toFixed(0)}
                              </text>
                            )}
                            {d.unpaid > 0 && (
                              <text
                                x={xOffset + 40}
                                  y={160 - unpaidHeight}
                                textAnchor="middle"
                                fill="#475569"
                                className="text-[8px] font-black"
                              >
                                {d.unpaid >= 1000 ? `${(d.unpaid/1000).toFixed(1)}k` : d.unpaid.toFixed(0)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      
                      <line x1="30" y1="172" x2="430" y2="172" stroke="#cbd5e1" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="pb-2 border-b border-slate-50">
                    <h4 className="font-bold text-slate-800 text-sm">Distribuição de Recebíveis</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Divisão percentual de títulos por status no período</p>
                  </div>

                  {totalBilled === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
                      Nenhum dado faturado neste período.
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="transparent"
                            stroke="#f1f5f9"
                            strokeWidth="20"
                          />
                          {totalPaid > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#34d399"
                              strokeWidth="20"
                              strokeDasharray={`${paidDash} ${circ - paidDash}`}
                              strokeDashoffset={0}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          {totalA_Vencer > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#94a3b8"
                              strokeWidth="20"
                              strokeDasharray={`${aVencerDash} ${circ - aVencerDash}`}
                              strokeDashoffset={-paidDash}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          {totalVencido > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#f87171"
                              strokeWidth="20"
                              strokeDasharray={`${vencidoDash} ${circ - vencidoDash}`}
                              strokeDashoffset={-(paidDash + aVencerDash)}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          
                          <text x="100" y="95" textAnchor="middle" fill="#94a3b8" className="text-[11px] uppercase tracking-wider font-bold">Total</text>
                          <text x="100" y="120" textAnchor="middle" fill="#1e293b" className="text-[17px] font-black tracking-tighter">
                            {totalBilled >= 1000 ? `${(totalBilled/1000).toFixed(1)}k` : totalBilled.toFixed(0)}
                          </text>
                        </svg>
                      </div>

                      <div className="w-full grid grid-cols-3 gap-2 text-center">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pago</span>
                          <p className="text-xs font-black text-emerald-500">{(totalBilled > 0 ? (totalPaid/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">A Vencer</span>
                          <p className="text-xs font-black text-slate-400">{(totalBilled > 0 ? (totalA_Vencer/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Atrasado</span>
                          <p className="text-xs font-black text-red-400">{(totalBilled > 0 ? (totalVencido/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD CONTAINER MATRIX: Virtual Card (Left) & Upcoming Receivables (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-3.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Minha Chave Receptora Principal</h4>
                  <VirtualCard 
                    primaryKey={primaryKey}
                    onNavigateToKeys={() => setActiveTab('wallets')} 
                  />
                </div>

                <div className="lg:col-span-2 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Próximos Vencimentos</h4>
                    <button
                      onClick={() => { setActiveTab('stores'); if (stores.length > 0) { setActiveStoreId(stores[0].id); setActiveSubTab('invoices'); } }}
                      className="text-[10px] font-bold text-pix flex items-center gap-0.5 hover:underline"
                    >
                      Ver todas cobranças <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 overflow-hidden">
                    {filteredInsts.filter(i => i.status === 'PENDENTE').length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        Nenhum faturamento pendente para receber neste período.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50 max-h-[240px] overflow-y-auto no-scrollbar">
                        {filteredInsts
                          .filter(i => i.status === 'PENDENTE')
                          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                          .slice(0, 4)
                          .map((item) => {
                            const isOverdue = new Date(item.dueDate + 'T12:00:00') < todayDate;
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  const inv = invoices.find(i => i.id === item.invoiceId);
                                  if (inv && inv.storeId) {
                                    setActiveStoreId(inv.storeId);
                                    setActiveSubTab('invoices');
                                    setActiveTab('stores');
                                  }
                                }}
                                className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer rounded-xl px-2 transition-colors"
                              >
                                <div className="flex flex-col max-w-[65%]">
                                  <span className="font-bold text-slate-800 text-xs truncate uppercase">
                                    {getClientName(item.clientId)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 truncate mt-0.5">
                                    {item.description} ({item.invoiceNumber} P{item.number})
                                  </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-extrabold text-xs text-slate-800">
                                    {formatBRL(item.amount)}
                                  </span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                    isOverdue 
                                      ? 'bg-red-50 text-red-700 border-red-100'
                                      : 'bg-slate-50 text-slate-600 border-slate-100'
                                  }`}>
                                    {isOverdue 
                                      ? `Atrasado desde ${new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                      : `Vence em ${new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stores' && activeStoreId && (
          <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
            {(() => {
              const currentStore = stores.find(s => s.id === activeStoreId);
              if (!currentStore) return null;
              const colorGradient = currentStore.color || 'from-slate-600 to-blue-700';
              
              return (
                <div className="bg-white border-b border-slate-100 flex-shrink-0 flex flex-col">
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Loja</span>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
                          <span className={`w-3.5 h-3.5 rounded bg-gradient-to-r ${colorGradient} inline-block shadow-sm`} />
                          {currentStore?.name}
                        </h2>
                      </div>
                    </div>
                    
                    {isDirectEmployee ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                            {activeEmployee?.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800 leading-none">{activeEmployee?.name}</p>
                            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mt-0.5 block">{activeEmployee?.role === 'GERENTE' ? 'Gerente' : activeEmployee?.role === 'VENDEDOR' ? 'Vendedor' : 'Atendente'}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-500 border border-slate-200 transition-all active:scale-95 flex-shrink-0"
                          title="Sair da Conta"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                {activeSubTab === 'pdv' && (
                  <QuickPOS
                    storeId={activeStoreId!}
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    activeWallet={primaryKey}
                    onOrderCreated={(newOrder) => {
                      setOrders(prev => [newOrder, ...prev]);
                    }}
                    onRefreshProducts={() => {
                      loadProducts();
                    }}
                  />
                )}

                 {activeSubTab === 'orders' && (
                  <OrderManager
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    invoices={invoices.filter(inv => inv.storeId === activeStoreId)}
                    onCancelOrder={handleCancelOrder}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                    activeBranch={activeBranch}
                    isClinica={isClinica}
                  />
                )}

                {activeSubTab === 'invoices' && (
                  <InvoiceManager
                    invoices={invoices.filter(inv => inv.storeId === activeStoreId)}
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    catalogs={catalogs.filter(cat => cat.storeId === activeStoreId)}
                    savedKeys={savedKeys}
                    onAddInvoice={(invoice) => handleAddInvoice({ ...invoice, storeId: activeStoreId! })}
                    onEditInvoice={handleEditInvoice}
                    onDeleteInvoice={handleDeleteInvoice}
                    onUpdateInstallmentStatus={handleUpdateInstallmentStatus}
                    onNavigateToKeys={() => setActiveTab('wallets')}
                    onNavigateToClients={() => setActiveSubTab('clients')}
                    routingSettings={routingSettings}
                    ecommerceSettings={ecommerceSettings}
                    scheduleSlots={scheduleSlots.filter(s => s.storeId === activeStoreId)}
                    scheduleCalendars={scheduleCalendars.filter(c => c.storeId === activeStoreId)}
                    storeId={activeStoreId}
                    storeName={stores.find(s => s.id === activeStoreId)?.name || 'Minha Loja'}
                  />
                )}

                {activeSubTab === 'clients' && (
                  <ClientManager
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    onAddClient={(client) => handleAddClient({ ...client, storeId: activeStoreId! })}
                    onEditClient={handleEditClient}
                    onDeleteClient={handleDeleteClient}
                    isClinica={isClinica}
                    activeEmployee={activeEmployee}
                  />
                )}

                {activeSubTab === 'catalogs' && (
                  <CatalogManager
                    catalogs={catalogs.filter(cat => cat.storeId === activeStoreId)}
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    onAddCatalog={(catalog) => handleAddCatalog({ ...catalog, storeId: activeStoreId! })}
                    onEditCatalog={handleEditCatalog}
                    onDeleteCatalog={handleDeleteCatalog}
                    onAddProduct={handleAddProduct}
                    onEditProduct={handleEditProduct}
                    onDeleteProduct={handleDeleteProduct}
                    productCardSize={ecommerceSettings?.product_card_size || 'medium'}
                  />
                )}

                {activeSubTab === 'schedule' && (
                  <ScheduleManager
                    storeName={stores.find(s => s.id === activeStoreId)?.name || 'Minha Loja'}
                    calendars={scheduleCalendars.filter(c => c.storeId === activeStoreId)}
                    slots={scheduleSlots.filter(s => s.storeId === activeStoreId)}
                    catalogs={catalogs.filter(c => c.storeId === activeStoreId)}
                    onCreateCalendar={handleCreateScheduleCalendar}
                    onUpdateCalendar={handleUpdateScheduleCalendar}
                    onDeleteCalendar={handleDeleteScheduleCalendar}
                    onAddSlot={handleAddScheduleSlot}
                    onAddBulkSlots={handleAddBulkScheduleSlots}
                    onDeleteSlot={handleDeleteScheduleSlot}
                    onToggleSlot={handleToggleScheduleSlot}
                    isClinica={isClinica}
                  />
                )}

                {activeSubTab === 'ecommerce' && (
                  <EcommerceManager
                    store={stores.find(s => s.id === activeStoreId)!}
                    catalogs={catalogs.filter(c => c.storeId === activeStoreId)}
                    onSettingsSaved={() => {
                      loadAllData();
                      if (activeStoreId) loadEcommerceSettings(activeStoreId);
                    }}
                  />
                )}

                {activeSubTab === 'cobranças' && (
                  <BillingSettingsManager
                    store={stores.find(s => s.id === activeStoreId)!}
                    savedKeys={savedKeys}
                    onSettingsSaved={() => {
                      loadAllData();
                      if (activeStoreId) loadEcommerceSettings(activeStoreId);
                    }}
                  />
                )}

                {activeSubTab === 'employees' && (
                  <EmployeeManager
                    employees={employees.filter(e => e.storeId === activeStoreId)}
                    onAddEmployee={(emp) => handleAddEmployee({ ...emp, storeId: activeStoreId! })}
                    onEditEmployee={handleEditEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                  />
                )}

                {activeSubTab === 'stock' && (
                  <StockManager
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    catalogs={catalogs.filter(cat => cat.storeId === activeStoreId)}
                    onEditProduct={handleEditProduct}
                  />
                )}

                {activeSubTab === 'cashflow' && (
                  <CashFlowManager
                    storeId={activeStoreId!}
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    expenses={expenses.filter(e => e.storeId === activeStoreId)}
                    onAddExpense={handleAddExpense}
                    onPayExpense={handlePayExpense}
                    onDeleteExpense={handleDeleteExpense}
                  />
                )}

                {activeSubTab === 'fiscal' && (
                  <FiscalManager
                    storeId={activeStoreId!}
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    webhookUrl={webhookUrl}
                    onWebhookUrlChange={handleWebhookUrlChange}
                    webhookLogs={webhookLogs}
                  />
                )}

                {activeSubTab === 'store_settings' && (
                  <StoreSettings
                    store={stores.find(s => s.id === activeStoreId)!}
                    onSaveStore={handleEditStore}
                  />
                )}
              </div>
            </div>
        )}

        {activeTab === 'wallets' && (
          <SavedKeys onKeysChanged={handleKeysChanged} />
        )}
      </main>



      {/* MOBILE TAB MENU */}
      <div className="md:hidden bg-white border-t border-slate-100 py-2.5 px-3 flex justify-between select-none flex-shrink-0 z-20 shadow-md">
        {visibleMenuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive ? 'text-pix scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[8px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* PIN Lock / Employee Login Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative space-y-6 text-white text-center" style={{ backgroundColor: '#0f172a' }}>
            
            {/* Lock Icon and Header */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
                <Users className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-100 tracking-tight">Acesso de Funcionário</h3>
              <p className="text-xs text-slate-400">Selecione seu perfil e digite seu código de acesso</p>
            </div>

            {/* Form */}
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Funcionário</label>
                <select
                  value={selectedEmployeeIdForPin}
                  onChange={(e) => {
                    setSelectedEmployeeIdForPin(e.target.value);
                    setPinError('');
                  }}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-800 rounded-xl bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:border-transparent transition-all font-semibold"
                >
                  <option value="" disabled>Selecione um perfil...</option>
                  {employees
                    .filter(e => e.storeId === activeStoreId)
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role === 'GERENTE' ? 'Gerente' : emp.role === 'VENDEDOR' ? 'Vendedor' : 'Atendente'})
                      </option>
                    ))}
                </select>
                {employees.filter(e => e.storeId === activeStoreId).length === 0 && (
                  <p className="text-[10px] text-amber-450 mt-1 font-semibold">
                    * Nenhum funcionário cadastrado nesta loja. Cadastre-os na aba de Funcionários.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Código PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  className="w-full text-center tracking-widest text-lg font-mono py-2.5 border border-slate-800 rounded-xl bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:border-transparent transition-all"
                />
              </div>

              {pinError && (
                <p className="text-red-500 text-xs font-semibold text-center animate-shake">
                  {pinError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const emp = employees.find(e => e.id === selectedEmployeeIdForPin);
                  if (!emp) {
                    setPinError('Selecione um funcionário.');
                    return;
                  }
                  if (!pinInput) {
                    setPinError('Digite o código PIN.');
                    return;
                  }
                  if (emp.accessCode === pinInput) {
                    setActiveEmployee(emp);
                    setIsPinModalOpen(false);
                    setPinInput('');
                    setPinError('');
                    setSelectedEmployeeIdForPin('');
                    
                    // Adjust active tab if current is forbidden
                    let allowed = true;
                    if (emp.role === 'GERENTE') {
                      if (activeSubTab === 'ecommerce' || activeSubTab === 'cobranças') allowed = false;
                    } else if (emp.role === 'VENDEDOR') {
                      if (!['pdv', 'orders', 'schedule'].includes(activeSubTab)) allowed = false;
                    } else if (emp.role === 'ATENDENTE') {
                      if (!['orders', 'invoices', 'clients', 'catalogs', 'schedule'].includes(activeSubTab)) allowed = false;
                    }
                    if (!allowed) {
                      setActiveSubTab('orders');
                    }
                  } else {
                    setPinError('Código PIN incorreto!');
                  }
                }}
                className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-pix/10 active:scale-98"
              >
                Confirmar Acesso
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setPinInput('');
                  setPinError('');
                  setSelectedEmployeeIdForPin('');
                }}
                className="w-full bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Componente Root com Provedor de Rotas
export default function AppRouter() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingOrRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
          <Route path="/app" element={<PrivateRoute><MandaPixApp /></PrivateRoute>} />
          <Route path="/e/:storeId" element={<PublicStorefront />} />
          <Route path="/e/:storeSlug/:storeId" element={<PublicStorefront />} />
          <Route path="/*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
