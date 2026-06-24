import React, { useState, useMemo, useEffect } from 'react';
import { Search, Eye, Ban, Calendar, User, Mail, Phone, FileText, CheckCircle, Clock, X, ShoppingCart, Truck, Package, CalendarClock, ChevronLeft, ChevronRight, LayoutGrid, List, CalendarDays, Sparkles, Minus, Plus } from 'lucide-react';
import { formatBRL, parseScheduledDate } from '../utils/pix';
import type { Order, Invoice, ProductService } from '../utils/pix';
import { supabase } from '../utils/supabaseClient';

interface OrderManagerProps {
  orders: Order[];
  invoices?: Invoice[];
  onCancelOrder: (id: string) => void;
  onUpdateOrderStatus: (id: string, status: Order['status']) => void;
  onUpdateInstallmentStatus?: (
    invoiceId: string,
    installmentId: string,
    status: 'PAGO' | 'PENDENTE',
    paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
  ) => void;
  activeBranch?: any;
  products?: ProductService[];
}

export const OrderManager: React.FC<OrderManagerProps> = ({
  orders,
  invoices,
  onCancelOrder,
  onUpdateOrderStatus,
  onUpdateInstallmentStatus,
  activeBranch,
  products
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Checkout comissão state
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<any[]>([]);
  const [selectedExtraProductId, setSelectedExtraProductId] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // View Modes: PDV (operational) or AGENDA (calendar schedule)
  const [viewMode, setViewMode] = useState<'PDV' | 'AGENDA'>(() => {
    const saved = localStorage.getItem('manda_pix_view_mode');
    return (saved === 'PDV' || saved === 'AGENDA') ? saved : 'PDV';
  });
  const [pdvSubMode, setPdvSubMode] = useState<'LIST' | 'KDS'>(() => {
    const saved = localStorage.getItem('manda_pix_pdv_sub_mode');
    return (saved === 'LIST' || saved === 'KDS') ? saved : 'LIST';
  });
  const [agendaWeekOffset, setAgendaWeekOffset] = useState(0);

  // Sync chosen modes to localStorage
  useEffect(() => {
    localStorage.setItem('manda_pix_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('manda_pix_pdv_sub_mode', pdvSubMode);
  }, [pdvSubMode]);

  // Adjust view mode based on active branch
  useEffect(() => {
    if (activeBranch?.key === 'servicos') {
      if (viewMode !== 'AGENDA') setViewMode('AGENDA');
    } else if (activeBranch?.config?.hide_agenda && viewMode !== 'PDV') {
      setViewMode('PDV');
    }
  }, [activeBranch, viewMode]);

  useEffect(() => {
    if (activeBranch?.config?.hide_kitchen && pdvSubMode !== 'LIST') {
      setPdvSubMode('LIST');
    }
  }, [activeBranch, pdvSubMode]);

  // Sync checkout items when checkoutOrder opens
  useEffect(() => {
    if (checkoutOrder) {
      setCheckoutItems(checkoutOrder.items.map((item: any) => {
        const p = products?.find(prod => prod.id === item.productServiceId || prod.name === item.name);
        return {
          ...item,
          commission_rate: p?.commission_rate ?? 50.00
        };
      }));
    } else {
      setCheckoutItems([]);
    }
  }, [checkoutOrder, products]);

  const addExtraProduct = () => {
    if (!selectedExtraProductId || !products) return;
    const prod = products.find(p => p.id === selectedExtraProductId);
    if (!prod) return;

    const existing = checkoutItems.find(item => item.productServiceId === prod.id);
    if (existing) {
      setCheckoutItems(checkoutItems.map(item => 
        item.productServiceId === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCheckoutItems([...checkoutItems, {
        productServiceId: prod.id,
        name: prod.name,
        quantity: 1,
        price: prod.price,
        commission_rate: prod.commission_rate ?? 50.00
      }]);
    }
    setSelectedExtraProductId('');
  };

  const updateCheckoutItemQty = (idx: number, delta: number) => {
    const item = checkoutItems[idx];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCheckoutItems(checkoutItems.filter((_, i) => i !== idx));
    } else {
      setCheckoutItems(checkoutItems.map((it, i) => i === idx ? { ...it, quantity: newQty } : it));
    }
  };

  const updateCheckoutItemRate = (idx: number, rate: number) => {
    const bounded = Math.max(0, Math.min(100, rate));
    setCheckoutItems(checkoutItems.map((it, i) => i === idx ? { ...it, commission_rate: bounded } : it));
  };

  const checkoutTotal = checkoutItems.reduce((sum, item: any) => sum + (item.price * item.quantity), 0);
  const professionalTotal = checkoutItems.reduce((sum, item: any) => {
    const rate = item.commission_rate ?? 50;
    return sum + (item.price * item.quantity * rate / 100);
  }, 0);
  const storeTotal = checkoutTotal - professionalTotal;

  const handleConfirmCheckout = async () => {
    if (!checkoutOrder) return;
    setIsProcessingCheckout(true);
    try {
      const totalRate = checkoutItems.reduce((sum, item: any) => sum + (item.commission_rate ?? 50), 0);
      const avgRate = checkoutItems.length > 0 ? parseFloat((totalRate / checkoutItems.length).toFixed(2)) : 50;

      const split = {
        professionalAmount: parseFloat(professionalTotal.toFixed(2)),
        storeAmount: parseFloat(storeTotal.toFixed(2)),
        rate: avgRate
      };

      const { error } = await supabase
        .from('orders')
        .update({
          items: checkoutItems.map((item: any) => ({
            productServiceId: item.productServiceId,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          total_amount: checkoutTotal,
          commission_split: split,
          status: 'DIVISAO_COMISSAO'
        })
        .eq('id', checkoutOrder.id);

      if (error) throw error;

      setSelectedOrder((prev: Order | null) => prev ? {
        ...prev,
        items: checkoutItems,
        totalAmount: checkoutTotal,
        status: 'DIVISAO_COMISSAO',
        commission_split: split
      } : null);

      onUpdateOrderStatus(checkoutOrder.id, 'DIVISAO_COMISSAO');
      setCheckoutOrder(null);
      alert('Checkout realizado com sucesso! Divisão de comissão registrada.');
    } catch (err: any) {
      alert('Erro ao realizar checkout: ' + err.message);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);



  // Find linked invoice for the selected order
  const linkedInvoice = useMemo(() => {
    if (!selectedOrder?.invoiceId || !invoices) return null;
    return invoices.find(inv => inv.id === selectedOrder.invoiceId);
  }, [selectedOrder, invoices]);

  // Agenda/Calendar Calculations
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekStart = useMemo(() => {
    const dow = todayDate.getDay();
    const mon = new Date(todayDate);
    mon.setDate(todayDate.getDate() - dow + (dow === 0 ? -6 : 1));
    const result = new Date(mon);
    result.setDate(mon.getDate() + agendaWeekOffset * 7);
    return result;
  }, [todayDate, agendaWeekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const dateRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }, [weekDays]);

  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {};
    orders
      .filter(o => o.scheduledAt)
      .forEach(o => {
        const dateStr = o.scheduledAt!.split('T')[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(o);
      });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => {
        const timeA = a.scheduledAt!.split('T')[1] || '';
        const timeB = b.scheduledAt!.split('T')[1] || '';
        return timeA.localeCompare(timeB);
      });
    });
    return map;
  }, [orders]);

  const formatStatusLabel = (status: string) => {
    const upper = status.toUpperCase();
    if (upper === 'PENDENTE') return 'Aguardando pagamento';
    if (upper === 'AGENDADO') return 'Agendado';
    if (upper === 'EM_ATENDIMENTO') return 'Em atendimento';
    if (upper === 'PAGAMENTO') return 'Pagamento';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getNextActionLabel = (nextStatus: string) => {
    if (!nextStatus) return '';
    const upper = nextStatus.toUpperCase();
    if (upper === 'APROVADO') return 'Aprovar';
    if (upper === 'PREPARACAO') return 'Preparar';
    if (upper === 'A_CAMINHO') return 'Despachar';
    if (upper === 'ENTREGUE') return 'Entregar';
    if (upper === 'CHECK_IN') return 'Check-in';
    if (upper === 'CHECKOUT') return 'Checkout';
    if (upper === 'PAGAMENTO') return 'Pagar';
    if (upper === 'DIVISAO_COMISSAO') return 'Concluir repasse';
    if (upper === 'AGENDADO') return 'Confirmar agendamento';
    if (upper === 'EM_ATENDIMENTO') return 'Iniciar atendimento';
    return `Ir para ${formatStatusLabel(nextStatus)}`;
  };

  const getStatusBadgeClass = (status: string) => {
    const upper = status.toUpperCase();
    if (upper === 'PENDENTE' || upper === 'AGENDAMENTO') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (upper === 'APROVADO' || upper === 'CHECK_IN' || upper === 'AGENDADO') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (upper === 'PREPARACAO' || upper === 'CHECKOUT' || upper === 'EM_ATENDIMENTO') return 'bg-purple-50 text-purple-700 border-purple-100';
    if (upper === 'A_CAMINHO' || upper === 'PAGAMENTO') return 'bg-sky-50 text-sky-700 border-sky-100';
    if (upper === 'ENTREGUE' || upper === 'DIVISAO_COMISSAO' || upper === 'VENDA_CONCLUIDA' || upper === 'PEDIDO_ENTREGUE') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (upper === 'CANCELADO') return 'bg-red-50 text-red-700 border-red-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const statusFlow: string[] = useMemo(() => {
    if (activeBranch && Array.isArray(activeBranch.order_status_flow)) {
      return activeBranch.order_status_flow;
    }
    return ['PENDENTE', 'APROVADO', 'PREPARACAO', 'A_CAMINHO', 'ENTREGUE'];
  }, [activeBranch]);

  // Auto-migrate legacy/invalid statuses of scheduled orders to the default 'PENDENTE' (Aguardando pagamento) when opened
  useEffect(() => {
    if (selectedOrder && selectedOrder.scheduledAt) {
      if (!statusFlow.includes(selectedOrder.status)) {
        const defaultStatus = statusFlow[0] || 'PENDENTE';
        supabase
          .from('orders')
          .update({ status: defaultStatus })
          .eq('id', selectedOrder.id)
          .then(({ error }: { error: any }) => {
            if (!error) {
              onUpdateOrderStatus(selectedOrder.id, defaultStatus as any);
              setSelectedOrder(prev => prev && prev.id === selectedOrder.id ? { ...prev, status: defaultStatus } : prev);
            }
          })
          .catch((err: any) => console.error('Error auto-updating status:', err));
      }
    }
  }, [selectedOrder, statusFlow, onUpdateOrderStatus]);

  // Statistics
  const totalCount = orders.length;
  const pendenteCount = orders.filter(o => o.status === 'PENDENTE' || o.status === 'AGENDAMENTO').length;
  const emAndamentoCount = orders.filter(o => o.status === 'APROVADO' || o.status === 'PREPARACAO' || o.status === 'A_CAMINHO' || o.status === 'CHECK_IN' || o.status === 'CHECKOUT' || o.status === 'PAGAMENTO' || o.status === 'AGENDADO' || o.status === 'EM_ATENDIMENTO').length;
  const entregueCount = orders.filter(o => o.status === 'ENTREGUE' || o.status === 'DIVISAO_COMISSAO' || o.status === 'VENDA_CONCLUIDA' || o.status === 'PEDIDO_ENTREGUE').length;

  const handleCancelClick = (id: string, number: string) => {
    if (confirm(`Deseja realmente cancelar o pedido ${number}? A cobrança vinculada a ele não será excluída automaticamente.`)) {
      onCancelOrder(id);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.orderNumber.includes(search) || 
      o.clientName.toLowerCase().includes(search.toLowerCase()) || 
      o.clientDocument.includes(search);
      
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {viewMode === 'PDV' ? (
              pdvSubMode === 'LIST' ? (
                <ShoppingCart className="w-6 h-6 text-pix" />
              ) : (
                <LayoutGrid className="w-6 h-6 text-pix" />
              )
            ) : (
              <CalendarDays className="w-6 h-6 text-pix" />
            )}
            {viewMode === 'PDV' ? (pdvSubMode === 'LIST' ? 'Histórico de Pedidos' : 'Painel KDS / Fluxo') : 'Agenda de Pedidos'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {viewMode === 'PDV' 
              ? (pdvSubMode === 'LIST' ? 'Acompanhe e gerencie todos os pedidos em formato de lista' : 'Acompanhe a esteira de produção e andamento dos seus pedidos')
              : 'Visualize os pedidos com agendamento direto em formato de calendário semanal'}
          </p>
        </div>

          {/* View Mode Toggle Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Main View Mode Selector (PDV vs Agenda) */}
            {!activeBranch?.config?.hide_agenda && activeBranch?.key !== 'servicos' && (
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-150 gap-1">
                <button
                  onClick={() => setViewMode('PDV')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    viewMode === 'PDV'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> PDV
                </button>
                <button
                  onClick={() => setViewMode('AGENDA')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    viewMode === 'AGENDA'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Agenda
                </button>
              </div>
            )}

            {/* Sub-mode selector (only visible for PDV) */}
            {viewMode === 'PDV' && (
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-150 gap-1 animate-fade-in">
                <button
                  onClick={() => setPdvSubMode('LIST')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    pdvSubMode === 'LIST'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Visualizar em Lista"
                >
                  <List className="w-3.5 h-3.5" /> Lista
                </button>
                {!activeBranch?.config?.hide_kitchen && (
                  <button
                    onClick={() => setPdvSubMode('KDS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      pdvSubMode === 'KDS'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="Visualizar Painel KDS"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> KDS
                  </button>
                )}
              </div>
            )}
          </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* PDV - LIST MODE */}
        {viewMode === 'PDV' && pdvSubMode === 'LIST' && (
          <>
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Pedidos</span>
                  <h3 className="text-xl font-black text-slate-800">{totalCount}</h3>
                </div>
                <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pendentes</span>
                  <h3 className="text-xl font-black text-slate-800">{pendenteCount}</h3>
                </div>
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Preparação / Envio</span>
                  <h3 className="text-xl font-black text-slate-850 text-indigo-650">{emAndamentoCount}</h3>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Entregues</span>
                  <h3 className="text-xl font-black text-slate-800 text-emerald-650">{entregueCount}</h3>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-550 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Search bar */}
              <div className="relative max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nº pedido, cliente ou documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none"
                />
              </div>

              {/* Status Select Tabs */}
              <div className="flex flex-wrap bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-sm self-start gap-0.5">
                {['ALL', ...statusFlow, 'CANCELADO'].map(f => {
                  const label = f === 'ALL' ? 'Todos' : formatStatusLabel(f);
                  
                  return (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        statusFilter === f 
                          ? 'bg-white text-slate-800 shadow-sm font-extrabold' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center shadow-sm">
                <ShoppingCart className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum pedido encontrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  {search || statusFilter !== 'ALL' 
                    ? 'Nenhum resultado corresponde aos filtros selecionados.' 
                    : 'Seus clientes ainda não geraram pedidos a partir do Catálogo Online.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Pedido</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Agendado para</th>
                        <th className="py-3 px-4">Total</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
                      {filteredOrders.map((order) => {
                        const statusConfig = getStatusBadgeClass(order.status);

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              #{order.orderNumber}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-700">{order.clientName}</span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{order.clientDocument}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {new Date(order.dateCreated).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3.5 px-4">
                              {order.scheduledAt ? (
                                <div className="flex items-center gap-1 text-pix font-bold">
                                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="text-[10px]">
                                    {parseScheduledDate(order.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    {' '}
                                    {parseScheduledDate(order.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-800">
                              {formatBRL(order.totalAmount)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${statusConfig}`}>
                                {formatStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedOrder(order)}
                                  className="p-1 rounded bg-slate-50 hover:bg-pix-light text-slate-400 hover:text-pix border border-slate-100 hover:border-pix/10 transition-all active:scale-90"
                                  title="Visualizar Detalhes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {order.status === 'PENDENTE' && (
                                  <button
                                    onClick={() => handleCancelClick(order.id, `#${order.orderNumber}`)}
                                    className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                                    title="Cancelar Pedido"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* PDV - KDS MODE */}
        {viewMode === 'PDV' && pdvSubMode === 'KDS' && (
          <div className="flex flex-col gap-4 h-full">
            {/* Search bar for KDS */}
            <div className="relative max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nº pedido ou cliente no KDS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none"
              />
            </div>

            {/* Kanban Columns */}
            <div className="flex gap-4 overflow-x-auto pb-4 items-start select-none no-scrollbar">
              {statusFlow.map((columnStatus: string, idx: number) => {
                const columnOrders = filteredOrders.filter(o => o.status === columnStatus);
                
                const bgs = ['bg-amber-50/50', 'bg-indigo-50/50', 'bg-purple-50/50', 'bg-sky-50/50', 'bg-emerald-55/50'];
                const borders = ['border-amber-100', 'border-indigo-100', 'border-purple-100', 'border-sky-100', 'border-emerald-100'];
                const texts = ['text-amber-800', 'text-indigo-800', 'text-purple-800', 'text-sky-800', 'text-emerald-800'];
                const dots = ['bg-amber-400', 'bg-indigo-500', 'bg-purple-500', 'bg-sky-500', 'bg-emerald-500'];

                const nextStatus = idx < statusFlow.length - 1 ? statusFlow[idx + 1] : '';

                const columnConfig = {
                  title: formatStatusLabel(columnStatus),
                  bg: bgs[idx % bgs.length],
                  border: borders[idx % borders.length],
                  text: texts[idx % texts.length],
                  dot: dots[idx % dots.length],
                  nextLabel: getNextActionLabel(nextStatus),
                  nextStatus: nextStatus
                };

                return (
                  <div 
                    key={columnStatus} 
                    className={`flex-shrink-0 w-80 max-h-full flex flex-col rounded-2xl border ${columnConfig.border} ${columnConfig.bg} shadow-sm overflow-hidden`}
                  >
                    {/* Column Header */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-100/50 bg-white">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${columnConfig.dot}`} />
                        <h3 className={`font-black text-xs uppercase tracking-wider ${columnConfig.text}`}>{columnConfig.title}</h3>
                      </div>
                      <span className="text-xs font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {columnOrders.length}
                      </span>
                    </div>

                    {/* Column Cards Container */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar max-h-[calc(100vh-280px)]">
                      {columnOrders.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-[11px] font-semibold italic">
                          Sem pedidos nesta etapa
                        </div>
                      ) : (
                        columnOrders.map(order => (
                          <div 
                            key={order.id} 
                            className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs hover:shadow-sm transition-all space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-xs text-slate-800">#{order.orderNumber}</span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {new Date(order.dateCreated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="space-y-0.5">
                              <p className="font-bold text-xs text-slate-850 line-clamp-1">{order.clientName}</p>
                              <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-relaxed">
                                {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                              </p>
                            </div>

                            {order.scheduledAt && (
                              <div className="flex items-center gap-1 text-[10px] text-pix font-bold bg-pix-light px-2 py-1 rounded-lg w-max">
                                <CalendarClock className="w-3.5 h-3.5" />
                                <span>
                                  {parseScheduledDate(order.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {parseScheduledDate(order.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 gap-2">
                              <span className="font-black text-xs text-slate-800">{formatBRL(order.totalAmount)}</span>
                              
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setSelectedOrder(order)}
                                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-pix-light text-slate-400 hover:text-pix border border-slate-100 transition-all"
                                  title="Visualizar Detalhes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {columnConfig.nextStatus && (
                                  <button
                                    onClick={() => {
                                      onUpdateOrderStatus(order.id, columnConfig.nextStatus as Order['status']);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-pix hover:bg-pix-dark text-white text-[10px] font-bold shadow-xs active:scale-95 transition-all"
                                  >
                                    {columnConfig.nextLabel}
                                  </button>
                                )}

                                {columnStatus === 'PENDENTE' && (
                                  <button
                                    onClick={() => handleCancelClick(order.id, `#${order.orderNumber}`)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 border border-slate-100 transition-all"
                                    title="Cancelar Pedido"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AGENDA MODE */}
        {viewMode === 'AGENDA' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[500px]">
            {/* Week navigation */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button 
                onClick={() => setAgendaWeekOffset(w => w - 1)} 
                className="p-2 rounded-xl hover:bg-slate-100 border border-slate-200 text-slate-500 transition-all active:scale-95 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="font-extrabold text-slate-800 text-sm">
                  {dateRangeLabel}
                </p>
                {agendaWeekOffset === 0 && <span className="text-[9px] font-black text-pix uppercase tracking-wide">Semana Atual</span>}
              </div>
              <button 
                onClick={() => setAgendaWeekOffset(w => w + 1)} 
                className="p-2 rounded-xl hover:bg-slate-100 border border-slate-200 text-slate-500 transition-all active:scale-95 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekly columns grid */}
            <div className="grid grid-cols-7 divide-x divide-slate-100 flex-1 overflow-x-auto min-h-[400px]">
              {weekDays.map(day => {
                const dateStr = formatDateLocal(day);
                const dayOrders = ordersByDate[dateStr] || [];
                const isToday = formatDateLocal(new Date()) === dateStr;
                const isPast = day < todayDate;
                
                const weekdayLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day.getDay()];

                return (
                  <div key={dateStr} className={`flex flex-col min-w-[150px] ${isPast ? 'bg-slate-50/40' : 'bg-white'}`}>
                    {/* Day Header */}
                    <div className={`py-2.5 px-2 text-center border-b border-slate-100 flex-shrink-0 ${isToday ? 'bg-pix-light' : ''}`}>
                      <p className={`text-[9px] font-bold uppercase ${isToday ? 'text-pix' : 'text-slate-400'}`}>
                        {weekdayLabel}
                      </p>
                      <p className={`text-base font-black mt-0.5 ${isToday ? 'text-pix' : isPast ? 'text-slate-300' : 'text-slate-800'}`}>
                        {day.getDate()}
                      </p>
                    </div>

                    {/* Day Cards list */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto no-scrollbar max-h-[calc(100vh-320px)]">
                      {dayOrders.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-[10px] font-semibold italic">
                          Sem agendamentos
                        </div>
                      ) : (
                        dayOrders.map(order => {
                          const statusConfig = getStatusBadgeClass(order.status);
                          const orderTime = order.scheduledAt ? order.scheduledAt.split('T')[1]?.substring(0, 5) || '' : '';

                          return (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrder(order)}
                              className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-xs hover:shadow-sm hover:border-pix/20 transition-all cursor-pointer space-y-1.5 group select-none text-left"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-[10px] text-slate-800 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3 text-slate-400" /> {orderTime}
                                </span>
                                <span className="font-extrabold text-[9px] text-slate-450">#{order.orderNumber}</span>
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-[10px] text-slate-700 line-clamp-1 group-hover:text-pix transition-colors">
                                  {order.clientName}
                                </p>
                                <p className="text-[9px] text-slate-400 line-clamp-2 leading-tight">
                                  {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                                </p>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-50 pt-1.5">
                                <span className="font-black text-[10px] text-slate-800">{formatBRL(order.totalAmount)}</span>
                                <span className={`px-1.5 py-0.5 rounded-full border text-[8px] font-bold uppercase scale-90 ${statusConfig}`}>
                                  {formatStatusLabel(order.status).substring(0, 5)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <ShoppingCart className="w-5 h-5 text-pix" /> Detalhes do Pedido #{selectedOrder.orderNumber}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Data do Pedido
                  </span>
                  <p className="text-xs font-bold text-slate-700">
                    {new Date(selectedOrder.dateCreated).toLocaleDateString('pt-BR')} às {new Date(selectedOrder.dateCreated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Status Atual
                  </span>
                  <p className="text-xs font-extrabold text-slate-700 uppercase">
                    <span className={getStatusBadgeClass(selectedOrder.status) + " px-2 py-0.5 rounded text-[10px]"}>
                      {formatStatusLabel(selectedOrder.status)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Scheduling info in modal */}
              {selectedOrder.scheduledAt && (
                <div className="bg-pix-light border border-pix/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pix flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-pix uppercase tracking-wide">Pedido Agendado</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {parseScheduledDate(selectedOrder.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      {parseScheduledDate(selectedOrder.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {/* TIMELINE VISUAL STEPPER */}
              {(() => {
                const steps = statusFlow.map(s => ({
                  key: s,
                  label: formatStatusLabel(s)
                }));
                const currentStepIdx = steps.findIndex(s => s.key === selectedOrder.status);

                return selectedOrder.status !== 'CANCELADO' ? (
                  <div className="py-4 border-y border-slate-100 px-2">
                    <div className="flex items-center justify-between w-full relative">
                      {/* Base Line */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-150 z-0 rounded-full" />
                      {/* Active line */}
                      <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-pix z-0 rounded-full transition-all duration-500" 
                        style={{ width: `${currentStepIdx >= 0 ? (currentStepIdx / (steps.length - 1)) * 100 : 0}%` }}
                      />
                      
                      {steps.map((step, idx) => {
                        const isCompleted = currentStepIdx >= idx;
                        const isActive = currentStepIdx === idx;
                        return (
                          <div key={step.key} className="flex flex-col items-center z-10 relative">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border font-bold text-[9px] transition-all duration-300 ${
                              isCompleted
                                ? 'bg-pix border-pix text-white shadow-md scale-110'
                                : 'bg-white border-slate-200 text-slate-400'
                            }`}>
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span className={`text-[8px] font-bold mt-1.5 tracking-tight ${
                              isActive ? 'text-pix' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-800">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-extrabold text-sm flex-shrink-0">✕</div>
                    <div>
                      <h5 className="font-extrabold text-xs">Pedido Cancelado</h5>
                      <p className="text-[10px] text-red-650 mt-0.5">Este pedido foi cancelado e não pode seguir o fluxo operacional.</p>
                    </div>
                  </div>
                );
              })()}

              {/* STATUS OPERATION ACTIONS */}
              {selectedOrder.status !== 'CANCELADO' && selectedOrder.status !== statusFlow[statusFlow.length - 1] && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Ações de Operação (Esteira)</span>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Primary transition button */}
                    <button
                      onClick={() => {
                        const currentIdx = statusFlow.indexOf(selectedOrder.status);
                        const nextStatus = (currentIdx >= 0 && currentIdx < statusFlow.length - 1) 
                          ? statusFlow[currentIdx + 1] 
                          : null;
                        if (nextStatus) {
                          onUpdateOrderStatus(selectedOrder.id, nextStatus);
                          setSelectedOrder(prev => prev ? { ...prev, status: nextStatus } : null);
                        }
                      }}
                      className="flex-grow bg-pix hover:bg-pix-dark text-white font-extrabold py-2 px-3 rounded-xl text-xs shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1"
                    >
                      {(() => {
                        const currentIdx = statusFlow.indexOf(selectedOrder.status);
                        const nextStatus = (currentIdx >= 0 && currentIdx < statusFlow.length - 1) 
                          ? statusFlow[currentIdx + 1] 
                          : '';
                        return getNextActionLabel(nextStatus);
                      })()}
                    </button>

                    {/* Direct selector */}
                    <div className="relative flex-shrink-0">
                      <select
                        value={selectedOrder.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          onUpdateOrderStatus(selectedOrder.id, newStatus);
                          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
                        }}
                        className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-pix shadow-sm"
                      >
                        {statusFlow.map(status => (
                          <option key={status} value={status}>{formatStatusLabel(status)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cancel action */}
                    <button
                      onClick={() => {
                        if (confirm(`Deseja realmente cancelar o pedido #${selectedOrder.orderNumber}?`)) {
                          onCancelOrder(selectedOrder.id);
                          onUpdateOrderStatus(selectedOrder.id, 'CANCELADO');
                          setSelectedOrder(prev => prev ? { ...prev, status: 'CANCELADO' } : null);
                        }
                      }}
                      className="bg-white hover:bg-red-50 text-red-500 hover:text-red-650 border border-slate-200 hover:border-red-200 font-extrabold px-3 py-2 rounded-xl text-xs transition-all active:scale-98"
                    >
                      Cancelar
                    </button>
                  </div>
                  
                  {activeBranch?.key === 'servicos' && selectedOrder.status !== 'DIVISAO_COMISSAO' && (
                    <button
                      onClick={() => setCheckoutOrder(selectedOrder)}
                      className="w-full bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-600 hover:to-emerald-500 text-slate-950 font-black py-3 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-500/10 mt-3"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Fazer Checkout / PDV (Comissão)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Client Info */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Informações do Cliente</h4>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-650">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-bold text-slate-800">{selectedOrder.clientName}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">{selectedOrder.clientDocument}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{selectedOrder.clientEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{selectedOrder.clientPhone}</span>
                  </div>
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Itens do Pedido</h4>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="p-4 divide-y divide-slate-50 max-h-[200px] overflow-y-auto text-xs space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center pt-3 first:pt-0">
                        <div className="max-w-[70%] space-y-0.5">
                          <p className="font-bold text-slate-850 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {item.quantity} x {formatBRL(item.price)}
                          </p>
                        </div>
                        <span className="font-extrabold text-slate-800">
                          {formatBRL(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="uppercase">Valor Total do Pedido</span>
                    <span className="text-base text-pix font-black">{formatBRL(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
              {linkedInvoice && linkedInvoice.installments && linkedInvoice.installments.length > 0 ? (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Detalhamento Financeiro (Entrada/Parcelas)</h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 shadow-inner">
                    <div className="divide-y divide-slate-200/60 space-y-3">
                      {linkedInvoice.installments.map((inst) => {
                        const isEntry = inst.number === 1 && linkedInvoice.installments.length === 2 && inst.amount < linkedInvoice.totalAmount;
                        const label = isEntry ? "Entrada (Adiantado)" : (linkedInvoice.installments.length === 2 && inst.amount < linkedInvoice.totalAmount ? "Saldo Restante" : `Parcela ${inst.number}`);
                        
                        return (
                          <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 first:pt-0 gap-2 text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${inst.status === 'PAGO' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                {label}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                Vencimento: {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {inst.confirmedDate && ` • Pago em: ${new Date(inst.confirmedDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <span className="font-extrabold text-slate-800">{formatBRL(inst.amount)}</span>
                              
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${
                                  inst.status === 'PAGO'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                  {inst.status === 'PAGO' ? 'Pago' : 'Pendente'}
                                </span>

                                {inst.status === 'PENDENTE' && onUpdateInstallmentStatus && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Confirmar recebimento manual de ${formatBRL(inst.amount)} para este pedido?`)) {
                                        onUpdateInstallmentStatus(linkedInvoice.id, inst.id, 'PAGO', 'PIX');
                                      }
                                    }}
                                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-xs"
                                  >
                                    Confirmar Pago
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                selectedOrder.invoiceId && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Cobrança Vinculada
                    </span>
                    <span className="text-slate-800 bg-white border border-slate-100 px-2.5 py-1 rounded-xl shadow-xs">
                      PIX Copia e Cola / QR Code ativo
                    </span>
                  </div>
                )
              )}

              {/* Dynamic commission repasse split panel */}
              {selectedOrder.commission_split && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Divisão de Repasse (Comissão)</h4>
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Taxa de Comissão Média:</span>
                      <span className="font-bold text-teal-400">{selectedOrder.commission_split.rate}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-800 text-xs">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Profissional Repasse</span>
                        <p className="font-black text-sm text-emerald-400">{formatBRL(selectedOrder.commission_split.professionalAmount)}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Estabelecimento Líquido</span>
                        <p className="font-black text-sm text-slate-200">{formatBRL(selectedOrder.commission_split.storeAmount)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Service Commission Modal Overlay */}
      {checkoutOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-slate-100">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <span>Faturamento & Checkout do Serviço</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Pedido #{checkoutOrder.orderNumber} • {checkoutOrder.clientName}</p>
              </div>
              <button
                onClick={() => setCheckoutOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Product adding selection */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 space-y-3">
                <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider block">Adicionar Produtos ou Serviços Extra</span>
                <div className="flex gap-2">
                  <select
                    value={selectedExtraProductId}
                    onChange={(e) => setSelectedExtraProductId(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-250 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 text-slate-100"
                  >
                    <option value="" className="text-slate-500">Selecione um item para adicionar...</option>
                    {products?.map(p => (
                      <option key={p.id} value={p.id} className="text-slate-100">{p.name} - {formatBRL(p.price)}</option>
                    ))}
                  </select>
                  <button
                    onClick={addExtraProduct}
                    disabled={!selectedExtraProductId}
                    className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Items List with commission inputs */}
              <div className="space-y-3">
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Itens Inclusos no Atendimento</span>
                
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                  {checkoutItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-extrabold text-xs text-white truncate leading-snug">{item.name}</p>
                        <p className="text-[10px] font-black text-teal-400">{formatBRL(item.price)}</p>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                        {/* Qty controller */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCheckoutItemQty(idx, -1)}
                            className="p-1 bg-slate-950 hover:bg-slate-850 rounded text-slate-400"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-bold text-slate-200 min-w-[15px] text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCheckoutItemQty(idx, 1)}
                            className="p-1 bg-slate-950 hover:bg-slate-850 rounded text-slate-400"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Comm split controller */}
                        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Comissão:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.commission_rate}
                            onChange={(e) => updateCheckoutItemRate(idx, parseFloat(e.target.value) || 0)}
                            className="w-12 bg-transparent text-xs font-bold text-teal-400 font-mono text-center focus:outline-none"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Split calculation panel */}
              <div className="bg-slate-950 rounded-3xl p-5 border border-slate-850 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Faturamento Total</span>
                  <p className="text-lg font-black text-white">{formatBRL(checkoutTotal)}</p>
                </div>
                <div className="space-y-1 border-t sm:border-t-0 sm:border-x border-slate-850 py-2 sm:py-0">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide block">Repasse Profissional</span>
                  <p className="text-lg font-black text-emerald-400">{formatBRL(professionalTotal)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-teal-500 uppercase tracking-wide block">Estabelecimento Líquido</span>
                  <p className="text-lg font-black text-teal-400">{formatBRL(storeTotal)}</p>
                </div>
              </div>

            </div>

            {/* Footer actions */}
            <div className="p-5 border-t border-slate-850 bg-slate-900/60 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setCheckoutOrder(null)}
                className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-350 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCheckout}
                disabled={isProcessingCheckout || checkoutItems.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-600 hover:to-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-55 active:scale-95 shadow-md shadow-teal-500/10"
              >
                {isProcessingCheckout ? 'Finalizando...' : 'Confirmar & Checkout'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;
