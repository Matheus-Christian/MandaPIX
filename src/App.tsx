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
  CalendarClock
} from 'lucide-react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate 
} from 'react-router-dom';

import { 
  formatBRL,
  generatePixPayload,
  routePixPayment
} from './utils/pix';
import type { SavedPixKey, Client, ProductService, Invoice, Catalog, Store, Order, ScheduleSlot, ScheduleCalendar } from './utils/pix';

import { VirtualCard } from './components/VirtualCard';
import { ClientManager } from './components/ClientManager';
import { CatalogManager } from './components/CatalogManager';
import { InvoiceManager } from './components/InvoiceManager';
import { SavedKeys } from './components/SavedKeys';
import { StoreManager } from './components/StoreManager';
import { OrderManager } from './components/OrderManager';
import { StorefrontSimulator } from './components/StorefrontSimulator';
import { ScheduleManager } from './components/ScheduleManager';

import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { LandingPage } from './pages/LandingPage';
import { supabase, isSupabaseConfigured } from './utils/supabaseClient';
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'stores' | 'wallets'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // States de Dados
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'invoices' | 'clients' | 'catalogs' | 'schedule'>('orders');

  // Schedule states
  const [scheduleCalendars, setScheduleCalendars] = useState<ScheduleCalendar[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [routingSettings, setRoutingSettings] = useState<any>(null);

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
        loadCatalogs(),
        loadProducts(),
        loadWallets(),
        loadInvoices(),
        loadOrders(),
        loadRoutingSettings(),
        loadScheduleData()
      ]);
    } catch (err) {
      console.error('Erro ao carregar dados do Supabase:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadScheduleData = async () => {
    try {
      const [calsRes, catLinksRes, slotsRes] = await Promise.all([
        supabase.from('schedule_calendars').select('*').order('created_at'),
        supabase.from('schedule_calendar_catalogs').select('*'),
        supabase.from('schedule_slots').select('*').order('slot_date').order('slot_time')
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

  const loadStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    setStores(data || []);
  };
  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
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

  const loadCatalogs = async () => {
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    setCatalogs((data || []).map((d: any) => ({
      id: d.id,
      storeId: d.store_id,
      name: d.name,
      description: d.description
    })));
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    setProducts((data || []).map((d: any) => ({
      id: d.id,
      catalogId: d.catalog_id,
      name: d.name,
      type: d.type,
      price: Number(d.price),
      description: d.description
    })));
  };

  const loadWallets = async () => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
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

  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, installments(*)')
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

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
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
    loadAllData();
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
          description: newProductData.description
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
          description: updatedProduct.description
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
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;

      if (newStatus === 'APROVADO') {
        const order = orders.find(o => o.id === id);
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

      await loadOrders();
      await loadInvoices();
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
    }
  };

  const handleCreateOrderFromStorefront = async (orderData: {
    clientName: string;
    clientDocument: string;
    clientEmail: string;
    clientPhone: string;
    items: Array<{ productServiceId: string; quantity: number }>;
    paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
    scheduledAt?: string;
    scheduleSlotId?: string;
  }) => {
    try {
      const method = orderData.paymentMethod || 'PIX';
      const key = (method === 'PIX')
        ? (savedKeys.find(k => k.walletType === 'PIX_AUTO') || savedKeys.find(k => k.walletType === 'PIX') || savedKeys.find(k => k.isPrimary) || savedKeys[0])
        : (savedKeys.find(k => k.walletType === method) || savedKeys.find(k => k.isPrimary) || savedKeys[0]);

      if (!key) throw new Error('Nenhuma carteira receptora configurada pelo lojista.');

      const itemsWithDetails = orderData.items.map(item => {
        const prod = products.find(p => p.id === item.productServiceId);
        return {
          productServiceId: item.productServiceId,
          name: prod?.name || 'Item Desconhecido',
          quantity: item.quantity,
          price: prod?.price || 0
        };
      });

      const subtotal = itemsWithDetails.reduce((sum, it) => sum + (it.price * it.quantity), 0);
      let routedGateway = null;
      let transactionFee = null;
      let finalTotal = subtotal;

      // Executa o checkout atômico no banco em nome do tenant
      const { data, error } = await supabase.rpc('create_storefront_order', {
        p_store_id: activeStoreId,
        p_client_name: orderData.clientName,
        p_client_document: orderData.clientDocument,
        p_client_email: orderData.clientEmail,
        p_client_phone: orderData.clientPhone,
        p_items: itemsWithDetails,
        p_payment_method: method,
        p_wallet_id: key.id
      });

      if (error) throw error;

      let pixPayload = data.pixPayload;
      
      if (method === 'PIX') {
        if (key.walletType === 'PIX_AUTO') {
          const route = routePixPayment(subtotal, routingSettings || {
            threshold: 100,
            below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
            above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
          });
          
          routedGateway = route.gateway;
          transactionFee = route.fee;
          finalTotal = route.total;

          pixPayload = generatePixPayload({
            key: route.key,
            keyType: route.key.includes('@') ? 'EMAIL' : 'RANDOM',
            name: `MandaPIX Central (${route.gateway})`,
            city: 'SAO PAULO',
            amount: route.total,
            description: `#${data.orderNumber} Parc 1/1`.substring(0, 72)
          });
        } else {
          pixPayload = generatePixPayload({
            key: key.key,
            keyType: key.type,
            name: key.name,
            city: key.city,
            amount: subtotal,
            description: `#${data.orderNumber} Parc 1/1`.substring(0, 72)
          });
        }

        // Buscar parcela única e salvar o payload real gerado
        const { data: instData } = await supabase
          .from('installments')
          .select('id')
          .eq('invoice_id', data.invoiceId)
          .single();

        if (instData) {
          // Atualizar faturas
          await supabase
            .from('invoices')
            .update({
              routed_gateway: routedGateway,
              transaction_fee: transactionFee,
              total_amount: finalTotal
            })
            .eq('id', data.invoiceId);

          // Atualizar parcelas
          await supabase
            .from('installments')
            .update({ 
              pix_payload: pixPayload,
              routed_gateway: routedGateway,
              transaction_fee: transactionFee,
              amount: finalTotal
            })
            .eq('id', instData.id);

          // Atualizar pedido total_amount e agendamento
          const orderUpdate: any = { total_amount: finalTotal };
          if (orderData.scheduledAt) {
            orderUpdate.scheduled_at = orderData.scheduledAt;
            orderUpdate.schedule_slot_id = orderData.scheduleSlotId || null;
          }
          await supabase
            .from('orders')
            .update(orderUpdate)
            .eq('invoice_id', data.invoiceId);

          // Increment slot bookings if scheduled
          if (orderData.scheduleSlotId) {
            await supabase.rpc('increment_slot_booking', { slot_id: orderData.scheduleSlotId }).catch(() => {
              // Fallback: manual increment
              supabase
                .from('schedule_slots')
                .select('current_bookings')
                .eq('id', orderData.scheduleSlotId!)
                .single()
                .then((res: any) => {
                  const sd = res.data;
                  if (sd) {
                    supabase
                      .from('schedule_slots')
                      .update({ current_bookings: sd.current_bookings + 1 })
                      .eq('id', orderData.scheduleSlotId!);
                  }
                });
            });
            await loadScheduleData();
          }
        }
      }

      await loadAllData();

      return {
        orderNumber: data.orderNumber,
        pixPayload,
        invoiceId: data.invoiceId,
        routedGateway,
        transactionFee
      };
    } catch (err: any) {
      console.error('Erro ao processar pedido:', err);
      alert('Erro ao criar pedido: ' + err.message);
      throw err;
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
    { id: 'stores', label: 'Lojas', icon: ShoppingBag },
    { id: 'wallets', label: 'Carteiras', icon: WalletIcon }
  ] as const;

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

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
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

        {/* Botão Sair no Desktop */}
        <div className="px-4 mb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20 active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta</span>
          </button>
        </div>

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

      {/* MOBILE HEADER (Top Navigation) */}
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

      {/* Mobile Drawer (Overlay) */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex justify-end animate-fade-in">
          <div className="bg-slate-900 w-64 h-full p-6 flex flex-col justify-between text-white animate-slide-up">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="font-bold text-sm tracking-widest text-pix uppercase">Menu ERP</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
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

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
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

        {activeTab === 'stores' && (
          activeStoreId === null ? (
            <StoreManager
              stores={stores}
              clients={clients}
              catalogs={catalogs}
              invoices={invoices}
              onAddStore={handleAddStore}
              onEditStore={handleEditStore}
              onDeleteStore={handleDeleteStore}
              onSelectStore={(id) => {
                setActiveStoreId(id);
                setActiveSubTab('orders');
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
              {(() => {
                const currentStore = stores.find(s => s.id === activeStoreId);
                const colorGradient = currentStore?.color || 'from-blue-600 to-indigo-700';
                
                return (
                  <div className="bg-white border-b border-slate-100 flex-shrink-0 flex flex-col">
                    <div className="p-5 flex items-center justify-between border-b border-slate-50">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setActiveStoreId(null)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 border border-slate-100 transition-all active:scale-95"
                          title="Voltar para Lojas"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Loja Ativa</span>
                          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
                            <span className={`w-3.5 h-3.5 rounded bg-gradient-to-r ${colorGradient} inline-block shadow-sm`} />
                            {currentStore?.name}
                          </h2>
                        </div>
                      </div>
                      
                      <select
                        value={activeStoreId}
                        onChange={(e) => setActiveStoreId(e.target.value)}
                        className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none"
                      >
                        {stores.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex px-5 bg-white overflow-x-auto">
                      {([
                        { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
                        { id: 'invoices', label: 'Gerenciar vendas', icon: History },
                        { id: 'clients', label: 'Clientes', icon: Users },
                        { id: 'catalogs', label: 'Catálogos', icon: FolderOpen },
                        { id: 'schedule', label: 'Agendamento', icon: CalendarClock }
                      ] as const).map(subTab => {
                        const Icon = subTab.icon;
                        const isSubActive = activeSubTab === subTab.id;
                        return (
                          <button
                            key={subTab.id}
                            onClick={() => setActiveSubTab(subTab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all relative ${
                              isSubActive 
                                ? 'border-pix text-pix' 
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{subTab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                {activeSubTab === 'orders' && (
                  <OrderManager
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    onCancelOrder={handleCancelOrder}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
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
                  />
                )}

                {activeSubTab === 'clients' && (
                  <ClientManager
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    onAddClient={(client) => handleAddClient({ ...client, storeId: activeStoreId! })}
                    onEditClient={handleEditClient}
                    onDeleteClient={handleDeleteClient}
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
                    onSimulateStorefront={() => setIsStorefrontOpen(true)}
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
                  />
                )}
              </div>
            </div>
          )
        )}

        {activeTab === 'wallets' && (
          <SavedKeys onKeysChanged={handleKeysChanged} />
        )}
      </main>

      {/* Simulador de Loja pública do comprador */}
      {isStorefrontOpen && activeStoreId && (
        <StorefrontSimulator
          store={stores.find(s => s.id === activeStoreId)!}
          catalogs={catalogs.filter(c => c.storeId === activeStoreId)}
          products={products.filter(p => {
            const cat = catalogs.find(c => c.id === p.catalogId);
            return cat && cat.storeId === activeStoreId;
          })}
          onPlaceOrder={handleCreateOrderFromStorefront}
          onClose={() => setIsStorefrontOpen(false)}
          onSimulatePayment={(invoiceId) => {
            const invObj = invoices.find(inv => inv.id === invoiceId);
            if (invObj && invObj.installments.length > 0) {
              handleUpdateInstallmentStatus(invoiceId, invObj.installments[0].id, 'PAGO');
            }
          }}
          routingSettings={routingSettings}
          merchantWallets={savedKeys}
          scheduleCalendars={scheduleCalendars.filter(c => c.storeId === activeStoreId)}
          availableSlots={scheduleSlots.filter(s => s.storeId === activeStoreId && s.isEnabled)}
        />
      )}

      {/* MOBILE TAB MENU */}
      <div className="md:hidden bg-white border-t border-slate-100 py-2.5 px-3 flex justify-between select-none flex-shrink-0 z-20 shadow-md">
        {menuItems.map(item => {
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
          <Route path="/*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
