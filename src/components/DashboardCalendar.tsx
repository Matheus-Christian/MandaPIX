import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Calendar, 
  CalendarDays, 
  CheckCircle, 
  X, 
  ShoppingCart, 
  CalendarClock 
} from 'lucide-react';
import { formatBRL } from '../utils/pix';
import type { Order } from '../utils/pix';

interface DashboardCalendarProps {
  orders: Order[];
  isClinica: boolean;
  activeBranch: any;
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({
  orders,
  isClinica,
  activeBranch
}) => {
  const [agendaWeekOffset, setAgendaWeekOffset] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
    if (isClinica) {
      if (upper === 'PENDENTE') return 'Agendada';
      if (upper === 'CONFIRMADO') return 'Paciente Aguardando';
      if (upper === 'EM_ATENDIMENTO') return 'Em Consulta';
      if (upper === 'ATENDIDO') return 'Concluída';
      if (upper === 'CANCELADO') return 'Cancelada';
    }

    if (upper === 'PENDENTE') return 'Aguardando pagamento';
    if (upper === 'AGENDADO') return 'Agendado';
    if (upper === 'EM_ATENDIMENTO') return 'Em atendimento';
    if (upper === 'PAGAMENTO') return 'Pagamento';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getStatusBadgeClass = (status: string) => {
    const upper = status.toUpperCase();
    if (upper === 'PENDENTE' || upper === 'AGENDAMENTO') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (upper === 'APROVADO' || upper === 'CHECK_IN' || upper === 'AGENDADO' || upper === 'CONFIRMADO') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (upper === 'PREPARACAO' || upper === 'CHECKOUT' || upper === 'EM_ATENDIMENTO') return 'bg-purple-50 text-purple-700 border-purple-100';
    if (upper === 'A_CAMINHO' || upper === 'PAGAMENTO') return 'bg-sky-50 text-sky-700 border-sky-100';
    if (upper === 'ENTREGUE' || upper === 'DIVISAO_COMISSAO' || upper === 'VENDA_CONCLUIDA' || upper === 'PEDIDO_ENTREGUE' || upper === 'ATENDIDO') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (upper === 'CANCELADO') return 'bg-red-50 text-red-700 border-red-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      {/* Calendar Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/20">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-pix" />
            {isClinica ? 'Agenda de Consultas' : 'Pedidos Agendados (Semana)'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Visualize os próximos agendamentos diretamente no painel
          </p>
        </div>
        
        {/* Week navigation */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button 
            type="button"
            onClick={() => setAgendaWeekOffset(w => w - 1)} 
            className="p-1.5 rounded-lg hover:bg-slate-150 border border-slate-200 text-slate-600 transition-all active:scale-95 flex items-center justify-center bg-white"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="font-bold text-slate-700 text-xs">
              {dateRangeLabel}
            </p>
            {agendaWeekOffset === 0 && (
              <span className="text-[8px] font-black text-pix uppercase tracking-wider block">Semana Atual</span>
            )}
          </div>
          <button 
            type="button"
            onClick={() => setAgendaWeekOffset(w => w + 1)} 
            className="p-1.5 rounded-lg hover:bg-slate-150 border border-slate-200 text-slate-600 transition-all active:scale-95 flex-center bg-white"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekly columns grid */}
      <div className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100 overflow-x-auto min-h-[300px]">
        {weekDays.map(day => {
          const dateStr = formatDateLocal(day);
          const dayOrders = ordersByDate[dateStr] || [];
          const isToday = formatDateLocal(new Date()) === dateStr;
          const isPast = day < todayDate;
          
          const weekdayLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day.getDay()];

          return (
            <div key={dateStr} className={`flex flex-col min-w-[120px] ${isPast ? 'bg-slate-50/20' : 'bg-white'}`}>
              {/* Day Header */}
              <div className={`py-2 px-1.5 text-center border-b border-slate-100 flex-shrink-0 ${isToday ? 'bg-pix/5' : ''}`}>
                <p className={`text-[8px] font-bold uppercase ${isToday ? 'text-pix' : 'text-slate-400'}`}>
                  {weekdayLabel}
                </p>
                <p className={`text-sm font-black mt-0.5 ${isToday ? 'text-pix' : isPast ? 'text-slate-350' : 'text-slate-800'}`}>
                  {day.getDate()}
                </p>
              </div>

              {/* Day Cards list */}
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto no-scrollbar max-h-[350px]">
                {dayOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-300 text-[9px] font-medium italic">
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
                        className="bg-white p-2 rounded-lg border border-slate-150 shadow-2xs hover:shadow-xs hover:border-pix/20 transition-all cursor-pointer space-y-1 group select-none text-left"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-[8px] text-slate-800 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-400" /> {orderTime}
                          </span>
                          <span className="font-bold text-[8px] text-slate-400">#{order.orderNumber}</span>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold text-[9px] text-slate-700 line-clamp-1 group-hover:text-pix transition-colors">
                            {order.clientName}
                          </p>
                          <p className="text-[8px] text-slate-400 line-clamp-1 truncate">
                            {order.items.map(it => it.name).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-50 pt-1">
                          <span className="font-black text-[9px] text-slate-850">{formatBRL(order.totalAmount)}</span>
                          <span className={`px-1 rounded-full border text-[7px] font-bold uppercase scale-90 ${statusConfig}`}>
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

      {/* Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in text-slate-850">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-850 text-base flex items-center gap-1.5">
                <ShoppingCart className="w-5 h-5 text-pix" /> {isClinica ? 'Detalhes da Consulta' : 'Detalhes do Pedido'} #{selectedOrder.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-650 p-1"
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
                    <Calendar className="w-3.5 h-3.5" /> {isClinica ? 'Data da Consulta' : 'Data do Pedido'}
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
                    <p className="text-[9px] font-black text-pix uppercase tracking-wide">{isClinica ? 'Consulta Agendada' : 'Pedido Agendado'}</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {new Date(selectedOrder.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      {new Date(selectedOrder.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Cliente</h4>
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
                  <p className="text-sm font-bold text-slate-800">{selectedOrder.clientName}</p>
                  {selectedOrder.clientPhone && (
                    <p className="text-xs text-slate-500 font-semibold">Tel: {selectedOrder.clientPhone}</p>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Itens</h4>
                <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {item.quantity}x de {formatBRL(item.price)}
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-850">
                        {formatBRL(item.quantity * item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Value */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor Total</span>
                <span className="text-lg font-black text-slate-850">{formatBRL(selectedOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
