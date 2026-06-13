import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Zap,
  X,
  Calendar,
  RefreshCw,
  BookOpen,
  ArrowLeft,
  Edit2,
  Tag,
} from 'lucide-react';
import type { ScheduleCalendar, ScheduleSlot, Catalog } from '../utils/pix';

interface ScheduleManagerProps {
  storeName: string;
  calendars: ScheduleCalendar[];
  slots: ScheduleSlot[];
  catalogs: Catalog[];
  onCreateCalendar: (data: { name: string; catalogIds: string[] }) => Promise<void>;
  onUpdateCalendar: (calendar: ScheduleCalendar) => Promise<void>;
  onDeleteCalendar: (calendarId: string) => Promise<void>;
  onAddSlot: (slot: Omit<ScheduleSlot, 'id' | 'currentBookings'>) => Promise<void>;
  onAddBulkSlots: (slots: Array<Omit<ScheduleSlot, 'id' | 'currentBookings'>>) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onToggleSlot: (slotId: string, isEnabled: boolean) => Promise<void>;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────
// Sub-component: Calendar List (landing view)
// ─────────────────────────────────────────────────────────────
interface CalendarListProps {
  calendars: ScheduleCalendar[];
  slots: ScheduleSlot[];
  catalogs: Catalog[];
  onSelect: (cal: ScheduleCalendar) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onEdit: (cal: ScheduleCalendar) => void;
}

const CalendarList: React.FC<CalendarListProps> = ({
  calendars, slots, catalogs, onSelect, onDelete, onCreate, onEdit,
}) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-pix" />
            Calendários de Agendamento
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cada calendário pode ser associado a um ou mais catálogos desta loja
          </p>
        </div>
        <button
          onClick={onCreate}
          className="self-start md:self-auto flex items-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Criar Calendário
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {calendars.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
              <CalendarClock className="w-10 h-10 text-slate-200" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-base">Nenhum calendário criado</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                Crie um calendário e associe-o a um ou mais catálogos. Os clientes que adicionarem produtos desses catálogos poderão escolher uma data e hora.
              </p>
            </div>
            <button
              onClick={onCreate}
              className="flex items-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Criar primeiro calendário
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {calendars.map(cal => {
              const calSlots = slots.filter(s => s.calendarId === cal.id);
              const activeSlots = calSlots.filter(s => s.isEnabled && s.currentBookings < s.maxCapacity).length;
              const assocCatalogs = catalogs.filter(c => cal.catalogIds.includes(c.id));

              return (
                <div
                  key={cal.id}
                  className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-slate-200 transition-all group"
                >
                  {/* Card header */}
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cal.isEnabled ? 'bg-pix text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <CalendarClock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-800 text-sm truncate">{cal.name}</h3>
                        <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${cal.isEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <span className={`w-1 h-1 rounded-full ${cal.isEnabled ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          {cal.isEnabled ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={e => { e.stopPropagation(); onEdit(cal); }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-pix hover:bg-pix-light transition-all"
                        title="Editar nome/catálogos"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm(`Excluir o calendário "${cal.name}"? Todos os slots serão excluídos.`)) onDelete(cal.id); }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Excluir calendário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Catalogs */}
                  <div className="px-4 pb-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Catálogos associados</p>
                    {assocCatalogs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assocCatalogs.map(cat => (
                          <span key={cat.id} className="flex items-center gap-0.5 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600">
                            <Tag className="w-2.5 h-2.5 text-pix" /> {cat.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Nenhum catálogo associado
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 divide-x divide-slate-50 border-t border-slate-50">
                    <div className="px-3 py-2.5 text-center">
                      <p className="text-sm font-black text-slate-800">{calSlots.length}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Total</p>
                    </div>
                    <div className="px-3 py-2.5 text-center">
                      <p className="text-sm font-black text-emerald-600">{activeSlots}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Livres</p>
                    </div>
                    <div className="px-3 py-2.5 text-center">
                      <p className="text-sm font-black text-amber-600">{calSlots.filter(s => s.currentBookings > 0).length}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Agend.</p>
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => onSelect(cal)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-pix-light border-t border-slate-100 text-slate-500 hover:text-pix text-xs font-bold transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Gerenciar slots e configurações
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-component: Calendar Detail (slot management)
// ─────────────────────────────────────────────────────────────
interface CalendarDetailProps {
  calendar: ScheduleCalendar;
  slots: ScheduleSlot[];
  catalogs: Catalog[];
  onBack: () => void;
  onUpdateCalendar: (cal: ScheduleCalendar) => Promise<void>;
  onAddSlot: (slot: Omit<ScheduleSlot, 'id' | 'currentBookings'>) => Promise<void>;
  onAddBulkSlots: (slots: Array<Omit<ScheduleSlot, 'id' | 'currentBookings'>>) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onToggleSlot: (slotId: string, isEnabled: boolean) => Promise<void>;
  onEdit: (cal: ScheduleCalendar) => void;
}

const CalendarDetail: React.FC<CalendarDetailProps> = ({
  calendar, slots, catalogs, onBack, onUpdateCalendar,
  onAddSlot, onAddBulkSlots, onDeleteSlot, onToggleSlot, onEdit,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addTime, setAddTime] = useState('09:00');
  const [addCapacity, setAddCapacity] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('18:00');
  const [bulkInterval, setBulkInterval] = useState(60);
  const [bulkCapacity, setBulkCapacity] = useState(1);
  const [bulkWeeksAhead, setBulkWeeksAhead] = useState(4);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const assocCatalogs = catalogs.filter(c => calendar.catalogIds.includes(c.id));

  const weekStart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mon = addDays(today, -dow + (dow === 0 ? -6 : 1));
    return addDays(mon, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const slotsByDate = useMemo(() => {
    const map: Record<string, ScheduleSlot[]> = {};
    slots.forEach(s => {
      if (!map[s.slotDate]) map[s.slotDate] = [];
      map[s.slotDate].push(s);
    });
    Object.keys(map).forEach(k => map[k].sort((a, b) => a.slotTime.localeCompare(b.slotTime)));
    return map;
  }, [slots]);

  const toggleKey = async (key: keyof ScheduleCalendar, value: boolean | number) => {
    setSavingConfig(true);
    try { await onUpdateCalendar({ ...calendar, [key]: value }); }
    finally { setSavingConfig(false); }
  };

  const handleAddSlot = async () => {
    if (!addDate || !addTime) return;
    setAddLoading(true);
    try {
      await onAddSlot({
        calendarId: calendar.id,
        storeId: calendar.storeId,
        slotDate: addDate,
        slotTime: addTime,
        maxCapacity: addCapacity,
        isEnabled: true,
      });
      setShowAddModal(false);
      setAddDate('');
      setAddTime('09:00');
      setAddCapacity(1);
    } finally { setAddLoading(false); }
  };

  const handleBulkAdd = async () => {
    setBulkLoading(true);
    try {
      const [startH, startM] = bulkStartTime.split(':').map(Number);
      const [endH, endM] = bulkEndTime.split(':').map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      const times: string[] = [];
      for (let m = startMins; m < endMins; m += bulkInterval) {
        times.push(`${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newSlots: Array<Omit<ScheduleSlot, 'id' | 'currentBookings'>> = [];
      for (let d = 1; d <= bulkWeeksAhead * 7; d++) {
        const date = addDays(today, d);
        if (!bulkDays.includes(date.getDay())) continue;
        const dateStr = formatDate(date);
        times.forEach(time => {
          if (!slots.some(s => s.slotDate === dateStr && s.slotTime === time)) {
            newSlots.push({ calendarId: calendar.id, storeId: calendar.storeId, slotDate: dateStr, slotTime: time, maxCapacity: bulkCapacity, isEnabled: true });
          }
        });
      }
      if (newSlots.length === 0) { alert('Nenhum slot novo para adicionar.'); return; }
      await onAddBulkSlots(newSlots);
      setShowBulkModal(false);
      alert(`✅ ${newSlots.length} slots criados com sucesso!`);
    } finally { setBulkLoading(false); }
  };

  const getSlotStatus = (slot: ScheduleSlot) => {
    if (!slot.isEnabled) return 'disabled';
    if (slot.currentBookings >= slot.maxCapacity) return 'full';
    if (slot.currentBookings > 0) return 'partial';
    return 'available';
  };

  const slotStatusStyles: Record<string, { badge: string; dot: string }> = {
    available: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-400' },
    partial:   { badge: 'bg-amber-50 text-amber-700 border-amber-100',       dot: 'bg-amber-400' },
    full:      { badge: 'bg-red-50 text-red-700 border-red-100',             dot: 'bg-red-400' },
    disabled:  { badge: 'bg-slate-50 text-slate-400 border-slate-100',       dot: 'bg-slate-300' },
  };

  const totalSlots = slots.filter(s => s.isEnabled).length;
  const availableSlots = slots.filter(s => s.isEnabled && s.currentBookings < s.maxCapacity).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-white border-b border-slate-100 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold text-slate-800 truncate flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-pix flex-shrink-0" />
            {calendar.name}
            <button
              onClick={() => onEdit(calendar)}
              className="p-1 rounded-lg text-slate-400 hover:text-pix hover:bg-slate-50 transition-all flex-shrink-0"
              title="Editar nome e catálogos"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </h2>
          {assocCatalogs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assocCatalogs.map(c => (
                <span key={c.id} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-500">
                  <Tag className="w-2 h-2 text-pix" />{c.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setAddDate(''); setShowAddModal(true); }}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Slot
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Zap className="w-4 h-4" /> Em Lote
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Ativos</span><h3 className="text-xl font-black text-slate-800 mt-0.5">{totalSlots}</h3></div>
            <div className="p-2 bg-pix-light text-pix rounded-xl"><Calendar className="w-4 h-4" /></div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Disponíveis</span><h3 className="text-xl font-black text-slate-800 mt-0.5">{availableSlots}</h3></div>
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl"><CheckCircle className="w-4 h-4" /></div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Agendados</span><h3 className="text-xl font-black text-slate-800 mt-0.5">{slots.filter(s => s.currentBookings > 0).length}</h3></div>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Users className="w-4 h-4" /></div>
          </div>
        </div>

        {/* Config toggles */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Configurações deste Calendário</h3>
            {savingConfig && <div className="flex items-center gap-1 text-pix text-[10px] font-bold"><RefreshCw className="w-3 h-3 animate-spin" /> Salvando...</div>}
          </div>
          <div className="divide-y divide-slate-50">
            {([
              { key: 'isEnabled',         label: 'Habilitar Agendamento',                     desc: 'Ativa o seletor de horário para clientes que adicionarem produtos dos catálogos associados.' },
              { key: 'requireScheduling', label: 'Agendamento Obrigatório',                   desc: 'Impede finalizar o pedido sem selecionar um slot.' },
              { key: 'showSlotsToClient', label: 'Mostrar Vagas Disponíveis ao Cliente',      desc: 'Exibe "X vagas restantes" em cada horário.' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className={`px-5 py-3.5 flex items-center justify-between transition-opacity ${key !== 'isEnabled' && !calendar.isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="pr-4">
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                </div>
                <button onClick={() => toggleKey(key, !calendar[key])} className="flex-shrink-0">
                  {calendar[key]
                    ? <ToggleRight className="w-9 h-9 text-pix" />
                    : <ToggleLeft className="w-9 h-9 text-slate-300" />
                  }
                </button>
              </div>
            ))}
            <div className={`px-5 py-3.5 flex items-center justify-between transition-opacity ${!calendar.isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="pr-4">
                <p className="text-sm font-bold text-slate-800">Janela de Agendamento</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Dias à frente que o cliente pode ver e agendar.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input type="number" min={1} max={90} value={calendar.advanceDays}
                  onChange={e => toggleKey('advanceDays', parseInt(e.target.value) || 7)}
                  className="w-14 text-center font-bold text-sm border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-pix/50"
                />
                <span className="text-xs text-slate-400 font-semibold">dias</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          {[['bg-emerald-400','Disponível'],['bg-amber-400','Parcial'],['bg-red-400','Lotado'],['bg-slate-300','Inativo']].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${color} block`} />{label}</span>
          ))}
        </div>

        {/* Weekly calendar grid */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-sm">
                {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              {weekOffset === 0 && <span className="text-[9px] font-bold text-pix uppercase">Semana atual</span>}
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 divide-x divide-slate-50 min-h-[240px]">
            {weekDays.map((day) => {
              const dateStr = formatDate(day);
              const daySlots = slotsByDate[dateStr] || [];
              const isToday = formatDate(new Date()) === dateStr;
              const isPast = day < new Date(new Date().setHours(0,0,0,0));
              return (
                <div key={dateStr} className={`flex flex-col ${isPast ? 'bg-slate-50/50' : 'bg-white'}`}>
                  <div className={`py-2 px-1 text-center border-b border-slate-50 ${isToday ? 'bg-pix-light' : ''}`}>
                    <p className={`text-[9px] font-bold uppercase ${isToday ? 'text-pix' : 'text-slate-400'}`}>{DAYS_OF_WEEK[day.getDay()]}</p>
                    <p className={`text-sm font-black mt-0.5 ${isToday ? 'text-pix' : isPast ? 'text-slate-300' : 'text-slate-800'}`}>{day.getDate()}</p>
                  </div>
                  <div className="flex-1 p-1 space-y-0.5 overflow-y-auto">
                    {daySlots.map(slot => {
                      const status = getSlotStatus(slot);
                      const styles = slotStatusStyles[status];
                      return (
                        <div key={slot.id} className={`group relative rounded-lg border px-2 py-1.5 text-[10px] font-bold ${styles.badge}`}>
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
                            <span className="font-mono text-[11px] font-black">{slot.slotTime}</span>
                          </div>
                          <div className="text-[9px] opacity-75 font-semibold mt-0.5">{slot.currentBookings}/{slot.maxCapacity}</div>
                          <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-1 z-10">
                            <button onClick={() => onToggleSlot(slot.id, !slot.isEnabled)} className="w-4.5 h-4.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-pix flex items-center justify-center shadow-sm" title={slot.isEnabled ? "Desativar slot" : "Ativar slot"}>
                              <span className={`w-1.5 h-1.5 rounded-full block ${slot.isEnabled ? 'bg-pix' : 'bg-slate-300'}`} />
                            </button>
                            <button onClick={() => { if (confirm(`Excluir slot ${slot.slotTime}?`)) onDeleteSlot(slot.id); }}
                              className="w-4.5 h-4.5 rounded-full bg-white border border-slate-200 text-slate-300 hover:text-red-500 flex items-center justify-center shadow-sm" title="Excluir slot">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!isPast && (
                      <button onClick={() => { setAddDate(dateStr); setShowAddModal(true); }}
                        className="w-full rounded-lg border border-dashed border-slate-300 text-slate-400 bg-slate-50/50 hover:bg-pix-light/20 hover:border-pix hover:text-pix py-1.5 transition-all flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming slots table */}
        {slots.filter(s => s.slotDate >= formatDate(new Date())).length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50">
              <h4 className="font-bold text-slate-800 text-sm">Próximos Slots</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Horário</th>
                    <th className="py-2.5 px-4">Vagas</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
                  {slots
                    .filter(s => s.slotDate >= formatDate(new Date()))
                    .sort((a, b) => `${a.slotDate}${a.slotTime}`.localeCompare(`${b.slotDate}${b.slotTime}`))
                    .slice(0, 20)
                    .map(slot => {
                      const status = getSlotStatus(slot);
                      const styles = slotStatusStyles[status];
                      const remaining = slot.maxCapacity - slot.currentBookings;
                      return (
                        <tr key={slot.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            {parseLocalDate(slot.slotDate).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />{slot.slotTime}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="font-bold">{slot.maxCapacity}</span></div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${styles.badge}`}>
                              {status === 'available' && `${remaining} vaga${remaining !== 1 ? 's' : ''}`}
                              {status === 'partial'   && `${remaining} restante${remaining !== 1 ? 's' : ''}`}
                              {status === 'full'      && 'Lotado'}
                              {status === 'disabled'  && 'Inativo'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => onToggleSlot(slot.id, !slot.isEnabled)}
                                className="p-1 rounded bg-slate-50 hover:bg-pix-light border border-slate-100 text-slate-400 hover:text-pix transition-all">
                                {slot.isEnabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => { if (confirm(`Excluir slot ${slot.slotTime}?`)) onDeleteSlot(slot.id); }}
                                className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 text-slate-300 hover:text-red-500 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

        {slots.length === 0 && (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center gap-3">
            <CalendarClock className="w-10 h-10 text-slate-200" />
            <div>
              <h4 className="font-bold text-slate-600 text-sm">Nenhum slot cadastrado neste calendário</h4>
              <p className="text-xs text-slate-400 mt-1">Use <strong>Em Lote</strong> para criar vários horários de uma vez.</p>
            </div>
          </div>
        )}
      </div>

      {/* === MODAL: Add Slot === */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5"><Plus className="w-5 h-5 text-pix" /> Adicionar Slot</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Data</label>
                <input type="date" value={addDate} min={formatDate(new Date())} onChange={e => setAddDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-pix/50 bg-slate-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Horário</label>
                <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-pix/50 bg-slate-50 font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Vagas Disponíveis</label>
                <input type="number" min={1} max={999} value={addCapacity} onChange={e => setAddCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-pix/50 bg-slate-50" />
              </div>
              <button onClick={handleAddSlot} disabled={!addDate || !addTime || addLoading}
                className="w-full bg-pix hover:bg-pix-dark disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5">
                {addLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</> : <><Plus className="w-4 h-4" />Adicionar Slot</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Bulk Add === */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5"><Zap className="w-5 h-5 text-pix" /> Criação em Lote</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Dias da Semana</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d, idx) => (
                    <button key={idx} type="button" onClick={() => setBulkDays(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx])}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${bulkDays.includes(idx) ? 'bg-pix border-pix text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Hora Início</label>
                  <input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-mono focus:outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Hora Fim</label>
                  <input type="time" value={bulkEndTime} onChange={e => setBulkEndTime(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-mono focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Intervalo</label>
                  <select value={bulkInterval} onChange={e => setBulkInterval(parseInt(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none">
                    {[[15,'15 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'1 hora'],[90,'1h 30min'],[120,'2 horas']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Vagas por Slot</label>
                  <input type="number" min={1} max={999} value={bulkCapacity} onChange={e => setBulkCapacity(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none" /></div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Próximas semanas</label>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} max={12} value={bulkWeeksAhead} onChange={e => setBulkWeeksAhead(parseInt(e.target.value) || 4)}
                    className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 text-center font-bold focus:outline-none" />
                  <span className="text-sm text-slate-500 font-semibold">semanas</span>
                </div>
              </div>
              <div className="bg-pix-light border border-pix/20 rounded-xl p-3 text-xs text-pix font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Slots de <strong>{bulkStartTime}</strong> a <strong>{bulkEndTime}</strong>, a cada <strong>{bulkInterval} min</strong>, por <strong>{bulkWeeksAhead} semanas</strong>. Duplicatas ignoradas.</span>
              </div>
              <button onClick={handleBulkAdd} disabled={bulkDays.length === 0 || bulkLoading}
                className="w-full bg-pix hover:bg-pix-dark disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5">
                {bulkLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Criando...</> : <><Zap className="w-4 h-4" />Gerar Slots</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main: ScheduleManager (orchestrator)
// ─────────────────────────────────────────────────────────────
export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  storeName, calendars, slots, catalogs,
  onCreateCalendar, onUpdateCalendar, onDeleteCalendar,
  onAddSlot, onAddBulkSlots, onDeleteSlot, onToggleSlot,
}) => {
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create calendar modal state
  const [newCalName, setNewCalName] = useState('');
  const [newCalCatalogIds, setNewCalCatalogIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit calendar modal state
  const [editingCalendar, setEditingCalendar] = useState<ScheduleCalendar | null>(null);
  const [editCalName, setEditCalName] = useState('');
  const [editCalCatalogIds, setEditCalCatalogIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  const activeCalendar = calendars.find(c => c.id === activeCalendarId);
  const activeSlots = activeCalendar
    ? slots.filter(s => s.calendarId === activeCalendar.id)
    : [];

  const handleCreateCalendar = async () => {
    if (!newCalName.trim()) return;
    setCreating(true);
    try {
      await onCreateCalendar({ name: newCalName.trim(), catalogIds: newCalCatalogIds });
      setShowCreateModal(false);
      setNewCalName('');
      setNewCalCatalogIds([]);
    } finally { setCreating(false); }
  };

  const handleStartEdit = (cal: ScheduleCalendar) => {
    setEditingCalendar(cal);
    setEditCalName(cal.name);
    setEditCalCatalogIds(cal.catalogIds);
  };

  const handleUpdateCalendarDetails = async () => {
    if (!editingCalendar || !editCalName.trim()) return;
    setUpdating(true);
    try {
      await onUpdateCalendar({
        ...editingCalendar,
        name: editCalName.trim(),
        catalogIds: editCalCatalogIds,
      });
      setEditingCalendar(null);
      setEditCalName('');
      setEditCalCatalogIds([]);
    } finally { setUpdating(false); }
  };

  return (
    <>
      {activeCalendar ? (
        <CalendarDetail
          calendar={activeCalendar}
          slots={activeSlots}
          catalogs={catalogs}
          onBack={() => setActiveCalendarId(null)}
          onUpdateCalendar={onUpdateCalendar}
          onAddSlot={onAddSlot}
          onAddBulkSlots={onAddBulkSlots}
          onDeleteSlot={onDeleteSlot}
          onToggleSlot={onToggleSlot}
          onEdit={handleStartEdit}
        />
      ) : (
        <CalendarList
          calendars={calendars}
          slots={slots}
          catalogs={catalogs}
          onSelect={cal => setActiveCalendarId(cal.id)}
          onDelete={onDeleteCalendar}
          onCreate={() => setShowCreateModal(true)}
          onEdit={handleStartEdit}
        />
      )}

      {/* === MODAL: Create Calendar === */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-pix" /> Criar Calendário
              </h3>
              <button onClick={() => { setShowCreateModal(false); setNewCalName(''); setNewCalCatalogIds([]); }}
                className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nome do Calendário</label>
                <input
                  type="text"
                  placeholder={`Ex: ${storeName}`}
                  value={newCalName}
                  onChange={e => setNewCalName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-pix/50 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-0.5">Um nome descritivo que identifique este calendário (ex: nome da loja, serviço ou turno).</p>
              </div>

              {/* Catalogs */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Associar a Catálogos <span className="text-red-400">*</span>
                </label>
                {catalogs.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-semibold">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Nenhum catálogo disponível nesta loja. Crie um catálogo primeiro.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {catalogs.map(cat => {
                      const selected = newCalCatalogIds.includes(cat.id);
                      // Check if already used in another calendar
                      const usedBy = calendars.find(cal => cal.catalogIds.includes(cat.id));
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selected
                              ? 'bg-pix-light border-pix/30'
                              : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setNewCalCatalogIds(prev =>
                              prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id]
                            )}
                            className="w-4 h-4 accent-pix rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${selected ? 'text-pix' : 'text-slate-700'}`}>
                              {cat.name}
                            </p>
                            {cat.description && (
                              <p className="text-[10px] text-slate-400 truncate">{cat.description}</p>
                            )}
                          </div>
                          {usedBy && usedBy.name !== newCalName && (
                            <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5 flex-shrink-0">
                              <BookOpen className="w-3 h-3" /> {usedBy.name}
                            </span>
                          )}
                          <Tag className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-pix' : 'text-slate-300'}`} />
                        </label>
                      );
                    })}
                  </div>
                )}
                {newCalCatalogIds.length > 0 && (
                  <p className="text-[10px] text-pix font-bold mt-1.5 ml-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {newCalCatalogIds.length} catálogo{newCalCatalogIds.length !== 1 ? 's' : ''} selecionado{newCalCatalogIds.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowCreateModal(false); setNewCalName(''); setNewCalCatalogIds([]); }}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-2.5 rounded-xl transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCalendar}
                  disabled={!newCalName.trim() || newCalCatalogIds.length === 0 || creating}
                  className="flex-1 bg-pix hover:bg-pix-dark disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 text-sm"
                >
                  {creating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Criando...</>
                    : <><Plus className="w-4 h-4" />Criar Calendário</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Edit Calendar === */}
      {editingCalendar && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-pix" /> Editar Calendário
              </h3>
              <button onClick={() => { setEditingCalendar(null); setEditCalName(''); setEditCalCatalogIds([]); }}
                className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nome do Calendário</label>
                <input
                  type="text"
                  placeholder={`Ex: ${storeName}`}
                  value={editCalName}
                  onChange={e => setEditCalName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-pix/50 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-0.5">Um nome descritivo que identifique este calendário (ex: nome da loja, serviço ou turno).</p>
              </div>

              {/* Catalogs */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Associar a Catálogos <span className="text-red-400">*</span>
                </label>
                {catalogs.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-semibold">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Nenhum catálogo disponível nesta loja. Crie um catálogo primeiro.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {catalogs.map(cat => {
                      const selected = editCalCatalogIds.includes(cat.id);
                      // Check if already used in another calendar
                      const usedBy = calendars.find(cal => cal.catalogIds.includes(cat.id));
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selected
                              ? 'bg-pix-light border-pix/30'
                              : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setEditCalCatalogIds(prev =>
                              prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id]
                            )}
                            className="w-4 h-4 accent-pix rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${selected ? 'text-pix' : 'text-slate-700'}`}>
                              {cat.name}
                            </p>
                            {cat.description && (
                              <p className="text-[10px] text-slate-400 truncate">{cat.description}</p>
                            )}
                          </div>
                          {usedBy && usedBy.id !== editingCalendar.id && (
                            <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5 flex-shrink-0">
                              <BookOpen className="w-3 h-3" /> {usedBy.name}
                            </span>
                          )}
                          <Tag className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-pix' : 'text-slate-300'}`} />
                        </label>
                      );
                    })}
                  </div>
                )}
                {editCalCatalogIds.length > 0 && (
                  <p className="text-[10px] text-pix font-bold mt-1.5 ml-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {editCalCatalogIds.length} catálogo{editCalCatalogIds.length !== 1 ? 's' : ''} selecionado{editCalCatalogIds.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setEditingCalendar(null); setEditCalName(''); setEditCalCatalogIds([]); }}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-2.5 rounded-xl transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateCalendarDetails}
                  disabled={!editCalName.trim() || editCalCatalogIds.length === 0 || updating}
                  className="flex-1 bg-pix hover:bg-pix-dark disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 text-sm"
                >
                  {updating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
                    : <><Edit2 className="w-4 h-4" />Salvar Alterações</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScheduleManager;
