import React, { useState } from 'react';
import { ShoppingBag, Search, Eye, Ban, Calendar, User, Mail, Phone, FileText, CheckCircle, Clock, X, ShoppingCart, Truck, Package, CalendarClock } from 'lucide-react';
import { formatBRL } from '../utils/pix';
import type { Order } from '../utils/pix';

interface OrderManagerProps {
  orders: Order[];
  onCancelOrder: (id: string) => void;
  onUpdateOrderStatus: (id: string, status: Order['status']) => void;
  onSimulateStorefront: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({
  orders,
  onCancelOrder,
  onUpdateOrderStatus,
  onSimulateStorefront
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDENTE' | 'APROVADO' | 'PREPARACAO' | 'A_CAMINHO' | 'ENTREGUE' | 'CANCELADO'>('ALL');
  
  // Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Statistics
  const totalCount = orders.length;
  const pendenteCount = orders.filter(o => o.status === 'PENDENTE').length;
  const emAndamentoCount = orders.filter(o => o.status === 'APROVADO' || o.status === 'PREPARACAO' || o.status === 'A_CAMINHO').length;
  const entregueCount = orders.filter(o => o.status === 'ENTREGUE').length;

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
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-pix" /> Histórico de Pedidos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pedidos gerados de forma automática pelos clientes a partir do seu Catálogo Online
          </p>
        </div>
        <button
          onClick={onSimulateStorefront}
          className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
        >
          <ShoppingBag className="w-4 h-4" /> 🔗 Simular Catálogo Online (Cliente)
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
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
            {(['ALL', 'PENDENTE', 'APROVADO', 'PREPARACAO', 'A_CAMINHO', 'ENTREGUE', 'CANCELADO'] as const).map(f => {
              const label = {
                ALL: 'Todos',
                PENDENTE: 'Pendentes',
                APROVADO: 'Aprovados',
                PREPARACAO: 'Preparação',
                A_CAMINHO: 'A Caminho',
                ENTREGUE: 'Entregues',
                CANCELADO: 'Cancelados'
              }[f];
              
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
                    const statusConfig = {
                      PENDENTE: 'bg-amber-50 text-amber-700 border-amber-100',
                      APROVADO: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                      PREPARACAO: 'bg-purple-50 text-purple-700 border-purple-100',
                      A_CAMINHO: 'bg-sky-50 text-sky-700 border-sky-100',
                      ENTREGUE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      CANCELADO: 'bg-red-50 text-red-700 border-red-100'
                    }[order.status];

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
                                {new Date(order.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                {' '}
                                {new Date(order.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                            {order.status === 'PENDENTE' && 'Pendente'}
                            {order.status === 'APROVADO' && 'Aprovado'}
                            {order.status === 'PREPARACAO' && 'Preparação'}
                            {order.status === 'A_CAMINHO' && 'A Caminho'}
                            {order.status === 'ENTREGUE' && 'Entregue'}
                            {order.status === 'CANCELADO' && 'Cancelado'}
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
                  <p className="text-xs font-extrabold text-slate-755 uppercase">
                    {selectedOrder.status === 'PENDENTE' && <span className="text-amber-600">Pendente</span>}
                    {selectedOrder.status === 'APROVADO' && <span className="text-indigo-650">Aprovado</span>}
                    {selectedOrder.status === 'PREPARACAO' && <span className="text-purple-600">Em Preparação</span>}
                    {selectedOrder.status === 'A_CAMINHO' && <span className="text-sky-655">A Caminho</span>}
                    {selectedOrder.status === 'ENTREGUE' && <span className="text-emerald-650">Entregue</span>}
                    {selectedOrder.status === 'CANCELADO' && <span className="text-red-650">Cancelado</span>}
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
                      {new Date(selectedOrder.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      {new Date(selectedOrder.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {/* TIMELINE VISUAL STEPPER */}
              {(() => {
                const steps = [
                  { key: 'PENDENTE', label: 'Pendente' },
                  { key: 'APROVADO', label: 'Aprovado' },
                  { key: 'PREPARACAO', label: 'Preparação' },
                  { key: 'A_CAMINHO', label: 'A Caminho' },
                  { key: 'ENTREGUE', label: 'Entregue' }
                ];
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
                      <p className="text-[10px] text-red-600 mt-0.5">Este pedido foi cancelado e não pode seguir o fluxo operacional.</p>
                    </div>
                  </div>
                );
              })()}

              {/* STATUS OPERATION ACTIONS */}
              {selectedOrder.status !== 'CANCELADO' && selectedOrder.status !== 'ENTREGUE' && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Ações de Operação (Esteira)</span>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Primary transition button */}
                    <button
                      onClick={() => {
                        const statusProgression: { [key: string]: Order['status'] } = {
                          PENDENTE: 'APROVADO',
                          APROVADO: 'PREPARACAO',
                          PREPARACAO: 'A_CAMINHO',
                          A_CAMINHO: 'ENTREGUE'
                        };
                        const nextStatus = statusProgression[selectedOrder.status];
                        if (nextStatus) {
                          onUpdateOrderStatus(selectedOrder.id, nextStatus);
                          setSelectedOrder(prev => prev ? { ...prev, status: nextStatus } : null);
                        }
                      }}
                      className="flex-grow bg-pix hover:bg-pix-dark text-white font-extrabold py-2 px-3 rounded-xl text-xs shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1"
                    >
                      {selectedOrder.status === 'PENDENTE' && 'Aprovar Pedido'}
                      {selectedOrder.status === 'APROVADO' && 'Iniciar Preparação'}
                      {selectedOrder.status === 'PREPARACAO' && 'Despachar / Enviar'}
                      {selectedOrder.status === 'A_CAMINHO' && 'Confirmar Entrega'}
                    </button>

                    {/* Direct selector */}
                    <div className="relative flex-shrink-0">
                      <select
                        value={selectedOrder.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as Order['status'];
                          onUpdateOrderStatus(selectedOrder.id, newStatus);
                          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
                        }}
                        className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-pix shadow-sm"
                      >
                        <option value="PENDENTE">Pendente</option>
                        <option value="APROVADO">Aprovado</option>
                        <option value="PREPARACAO">Preparação</option>
                        <option value="A_CAMINHO">A Caminho</option>
                        <option value="ENTREGUE">Entregue</option>
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

              {/* Linked Invoice Info */}
              {selectedOrder.invoiceId && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Cobrança Vinculada
                  </span>
                  <span className="text-slate-800 bg-white border border-slate-100 px-2.5 py-1 rounded-xl shadow-xs">
                    PIX Copia e Cola / QR Code ativo
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderManager;
