import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Clock, 
  Calendar, 
  User, 
  Globe, 
  Save, 
  AlertTriangle 
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { 
  formatCurrencyInput, 
  parseBRLToNumber,
  slugify
} from '../utils/pix';
import type { 
  Store, 
  Catalog, 
  SavedPixKey, 
  EcommerceSettings, 
  BusinessHourDay, 
  CheckoutFields 
} from '../utils/pix';

// Standard translations for weekdays
const WEEKDAYS = [
  { day: 1, label: 'Segunda-feira' },
  { day: 2, label: 'Terça-feira' },
  { day: 3, label: 'Quarta-feira' },
  { day: 4, label: 'Quinta-feira' },
  { day: 5, label: 'Sexta-feira' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' }
];

interface EcommerceManagerProps {
  store: Store;
  catalogs: Catalog[];
  savedKeys: SavedPixKey[];
  onSettingsSaved?: () => void;
}

export const EcommerceManager: React.FC<EcommerceManagerProps> = ({
  store,
  catalogs = [],
  savedKeys = [],
  onSettingsSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states matching table columns
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'>>(['PIX']);
  
  // Down payment states
  const [downPaymentEnabled, setDownPaymentEnabled] = useState(false);
  const [downPaymentType, setDownPaymentType] = useState<'percentage' | 'fixed'>('percentage');
  const [downPaymentValueRaw, setDownPaymentValueRaw] = useState('0,00');

  // Installments states
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState(1);

  // Business hours states
  const [businessHours, setBusinessHours] = useState<BusinessHourDay[]>([]);

  // Checkout fields config states
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFields>({
    name: { show: true, required: true },
    document: { show: true, required: true },
    email: { show: true, required: true },
    phone: { show: true, required: true },
    address: { show: false, required: false }
  });

  // Calendar toggle
  const [showScheduleCalendar, setShowScheduleCalendar] = useState(true);

  // Store's URL
  const publicUrl = `${window.location.origin}/e/${store.id}/${slugify(store.name)}`;

  // Check wallets availability
  const hasPixWallet = savedKeys.some(k => k.walletType === 'PIX' || k.walletType === 'PIX_AUTO');
  const hasCreditWallet = savedKeys.some(k => k.walletType === 'CREDIT_CARD');
  const hasDebitWallet = savedKeys.some(k => k.walletType === 'DEBIT_CARD');

  // Load ecommerce settings from Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ecommerce_settings')
          .select('*')
          .eq('store_id', store.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const settings = data as EcommerceSettings;
          setIsEnabled(settings.is_enabled);
          setSelectedCatalogIds(settings.catalog_ids || []);
          setPaymentMethods(settings.payment_methods || ['PIX']);
          setDownPaymentEnabled(settings.down_payment_enabled);
          setDownPaymentType(settings.down_payment_type || 'percentage');
          
          if (settings.down_payment_type === 'percentage') {
            setDownPaymentValueRaw(settings.down_payment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
          } else {
            setDownPaymentValueRaw(settings.down_payment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
          }
          
          setInstallmentsEnabled(settings.installments_enabled);
          setMaxInstallments(settings.max_installments || 1);
          setBusinessHours(settings.business_hours || []);
          setShowScheduleCalendar(settings.show_schedule_calendar !== false);
          setCheckoutFields(settings.checkout_fields || {
            name: { show: true, required: true },
            document: { show: true, required: true },
            email: { show: true, required: true },
            phone: { show: true, required: true },
            address: { show: false, required: false }
          });
        } else {
          // Defaults if no row exists yet
          setIsEnabled(false);
          setSelectedCatalogIds(catalogs.map(c => c.id));
          setPaymentMethods(['PIX']);
          setDownPaymentEnabled(false);
          setDownPaymentType('percentage');
          setDownPaymentValueRaw('0,00');
          setInstallmentsEnabled(false);
          setMaxInstallments(1);
          setShowScheduleCalendar(true);
          setCheckoutFields({
            name: { show: true, required: true },
            document: { show: true, required: true },
            email: { show: true, required: true },
            phone: { show: true, required: true },
            address: { show: false, required: false }
          });

          // Standard 8 to 18 Mon-Fri business hours
          const defaultHours: BusinessHourDay[] = WEEKDAYS.map(w => ({
            day: w.day,
            open: '08:00',
            close: '18:00',
            closed: w.day === 0 || w.day === 6 // Closed on weekends by default
          }));
          setBusinessHours(defaultHours);
        }
      } catch (err) {
        console.error('Error fetching ecommerce settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [store.id, catalogs]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCatalog = (id: string) => {
    setSelectedCatalogIds(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const togglePaymentMethod = (method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD') => {
    setPaymentMethods(prev => 
      prev.includes(method) 
        ? (prev.length > 1 ? prev.filter(m => m !== method) : prev) // keep at least one
        : [...prev, method]
    );
  };

  const handleDownPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDownPaymentValueRaw(formatCurrencyInput(e.target.value));
  };

  const handleHourChange = (dayIndex: number, field: 'open' | 'close', val: string) => {
    setBusinessHours(prev => prev.map(bh => {
      if (bh.day === dayIndex) {
        return { ...bh, [field]: val };
      }
      return bh;
    }));
  };

  const toggleDayClosed = (dayIndex: number) => {
    setBusinessHours(prev => prev.map(bh => {
      if (bh.day === dayIndex) {
        return { ...bh, closed: !bh.closed };
      }
      return bh;
    }));
  };

  const handleCheckoutFieldToggle = (field: keyof CheckoutFields, action: 'show' | 'required') => {
    setCheckoutFields(prev => {
      const fieldConfig = { ...prev[field] };
      fieldConfig[action] = !fieldConfig[action];
      
      // If we are hiding the field, it cannot be required
      if (action === 'show' && !fieldConfig.show) {
        fieldConfig.required = false;
      }
      // Name cannot be hidden or unrequired (standard requirement)
      if (field === 'name') {
        fieldConfig.show = true;
        fieldConfig.required = true;
      }

      return {
        ...prev,
        [field]: fieldConfig
      };
    });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const downPaymentVal = parseBRLToNumber(downPaymentValueRaw);

      // Make sure name is always show/required
      const finalizedCheckoutFields = {
        ...checkoutFields,
        name: { show: true, required: true }
      };

      const settingsPayload = {
        store_id: store.id,
        is_enabled: isEnabled,
        catalog_ids: selectedCatalogIds,
        payment_methods: paymentMethods,
        down_payment_enabled: downPaymentEnabled,
        down_payment_value: downPaymentVal,
        down_payment_type: downPaymentType,
        installments_enabled: installmentsEnabled,
        max_installments: maxInstallments,
        business_hours: businessHours,
        show_schedule_calendar: showScheduleCalendar,
        checkout_fields: finalizedCheckoutFields,
        updated_at: new Date().toISOString()
      };

      // Upsert settings in database
      const { error } = await supabase
        .from('ecommerce_settings')
        .upsert({
          ...settingsPayload,
          tenant_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      if (onSettingsSaved) {
        onSettingsSaved();
      }

      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Error saving ecommerce settings:', err);
      alert('Erro ao salvar as configurações: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-pix border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-6 h-6 text-pix" /> Configurações de E-commerce
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie o funcionamento, meios de pagamento e opções da sua vitrine de vendas online pública
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-pix hover:bg-pix-dark disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-pix/10 transition-all active:scale-95 self-start md:self-auto"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Alterações
        </button>
      </div>

      {/* Settings form container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        
        {/* Public Shareable Link Block */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-pix" /> Link da Página de Vendas
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Compartilhe este link com seus clientes para que eles façam pedidos diretamente online
              </p>
            </div>
            
            {/* General toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pix"></div>
              <span className="ml-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                {isEnabled ? 'Ativo' : 'Desativado'}
              </span>
            </label>
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5 overflow-hidden gap-3">
            <span className="text-xs font-bold text-slate-500 select-all truncate flex-1 font-mono">
              {publicUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${
                copied 
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                  : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic configuration grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Catalogs selection list */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Catálogos Exibidos</h3>
              <p className="text-[11px] text-slate-450 mt-0.5">Escolha quais catálogos e produtos estarão visíveis no e-commerce</p>
            </div>

            {catalogs.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Nenhum catálogo disponível. Crie um na aba "Catálogos".
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {catalogs.map(cat => (
                  <label 
                    key={cat.id} 
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedCatalogIds.includes(cat.id)}
                      onChange={() => toggleCatalog(cat.id)}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                      <p className="text-[10px] text-slate-450 line-clamp-1 mt-0.5">{cat.description || 'Sem descrição'}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Meios de Pagamento Online</h3>
              <p className="text-[11px] text-slate-450 mt-0.5">Selecione as formas de pagamento disponíveis para o cliente</p>
            </div>

            <div className="space-y-3">
              {/* PIX */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <span className="bg-teal-50 border border-teal-100 text-teal-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">PIX</span>
                    <span className="text-xs font-bold text-slate-700">PIX (QR Code & Copia/Cola)</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={paymentMethods.includes('PIX')}
                    onChange={() => togglePaymentMethod('PIX')}
                    className="rounded text-pix focus:ring-pix border-slate-300 w-4 h-4"
                  />
                </label>
                {!hasPixWallet && paymentMethods.includes('PIX') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhuma carteira PIX cadastrada. Acesse a aba "Minhas Chaves" para cadastrar.</span>
                  </div>
                )}
              </div>

              {/* CREDIT CARD */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Crédito</span>
                    <span className="text-xs font-bold text-slate-700">Cartão de Crédito</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={paymentMethods.includes('CREDIT_CARD')}
                    onChange={() => togglePaymentMethod('CREDIT_CARD')}
                    className="rounded text-pix focus:ring-pix border-slate-300 w-4 h-4"
                  />
                </label>
                {!hasCreditWallet && paymentMethods.includes('CREDIT_CARD') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhum provedor de cartão de crédito cadastrado na aba "Minhas Chaves".</span>
                  </div>
                )}
              </div>

              {/* DEBIT CARD */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-50 border border-blue-100 text-blue-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Débito</span>
                    <span className="text-xs font-bold text-slate-700">Cartão de Débito</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={paymentMethods.includes('DEBIT_CARD')}
                    onChange={() => togglePaymentMethod('DEBIT_CARD')}
                    className="rounded text-pix focus:ring-pix border-slate-300 w-4 h-4"
                  />
                </label>
                {!hasDebitWallet && paymentMethods.includes('DEBIT_CARD') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhum provedor de cartão de débito cadastrado na aba "Minhas Chaves".</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Down Payment & Installments Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Down Payment (Entrada) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Regras de Valor de Entrada</h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Exija um adiantamento no agendamento ou pedido</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={downPaymentEnabled}
                  onChange={(e) => setDownPaymentEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pix"></div>
              </label>
            </div>

            {downPaymentEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Tipo de Entrada</label>
                  <select
                    value={downPaymentType}
                    onChange={(e) => setDownPaymentType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none font-bold"
                  >
                    <option value="percentage">Percentual (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    {downPaymentType === 'percentage' ? 'Percentual (%)' : 'Valor da Entrada'}
                  </label>
                  <div className="relative">
                    {downPaymentType === 'fixed' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    )}
                    <input
                      type="text"
                      value={downPaymentValueRaw}
                      onChange={handleDownPaymentChange}
                      placeholder={downPaymentType === 'percentage' ? '30,00' : '50,00'}
                      className={`w-full py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:bg-white transition-all font-bold ${
                        downPaymentType === 'fixed' ? 'pl-8 pr-3' : 'px-3'
                      }`}
                    />
                    {downPaymentType === 'percentage' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Installments (Parcelamento) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Regras de Parcelamento</h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Ative pagamentos fracionados nas vendas</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={installmentsEnabled}
                  onChange={(e) => setInstallmentsEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pix"></div>
              </label>
            </div>

            {installmentsEnabled && (
              <div className="pt-2 animate-fade-in">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Máximo de Parcelas</label>
                <select
                  value={maxInstallments}
                  onChange={(e) => setMaxInstallments(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none font-bold"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      Até {num}x sem juros
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Business Hours Setup */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-pix" /> Horário de Funcionamento (Expediente)
            </h3>
            <p className="text-[11px] text-slate-450 mt-0.5 font-semibold">
              O e-commerce bloqueará compras automáticas fora destes horários marcados como abertos
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {WEEKDAYS.map(wd => {
              const dayConfig = businessHours.find(bh => bh.day === wd.day) || { day: wd.day, open: '08:00', close: '18:00', closed: true };
              return (
                <div key={wd.day} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 w-40">
                    <button
                      type="button"
                      onClick={() => toggleDayClosed(wd.day)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                        dayConfig.closed
                          ? 'bg-red-50 border-red-100 text-red-600'
                          : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                      }`}
                    >
                      {dayConfig.closed ? 'Fechado' : 'Aberto'}
                    </button>
                    <span className="text-xs font-bold text-slate-700">{wd.label}</span>
                  </div>

                  {!dayConfig.closed && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="time" 
                        value={dayConfig.open}
                        onChange={(e) => handleHourChange(wd.day, 'open', e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
                      />
                      <span className="text-slate-400 text-xs">às</span>
                      <input 
                        type="time" 
                        value={dayConfig.close}
                        onChange={(e) => handleHourChange(wd.day, 'close', e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkout Fields Customization & Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Checkout Fields Customization */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <User className="w-4 h-4 text-pix" /> Campos do Formulário de Checkout
              </h3>
              <p className="text-[11px] text-slate-455 mt-0.5">Selecione quais dados cadastrais solicitar no fechamento do pedido</p>
            </div>

            <div className="space-y-3">
              {/* Name (Fixed) */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Nome Completo</span>
                  <span className="text-[10px] text-slate-400 font-semibold italic mt-0.5">Ex: João da Silva</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visível</span>
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase">Obrigatório</span>
                </div>
              </div>

              {/* Document */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-850">Documento (CPF / CNPJ)</span>
                  <span className="text-[10px] text-slate-400 font-semibold italic mt-0.5">Ex: 123.456.789-00</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={checkoutFields.document.show}
                      onChange={() => handleCheckoutFieldToggle('document', 'show')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Mostrar</span>
                  </label>
                  
                  <label className={`flex items-center gap-1.5 cursor-pointer ${!checkoutFields.document.show ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox"
                      checked={checkoutFields.document.required}
                      disabled={!checkoutFields.document.show}
                      onChange={() => handleCheckoutFieldToggle('document', 'required')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Obrigatório</span>
                  </label>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-850">E-mail</span>
                  <span className="text-[10px] text-slate-400 font-semibold italic mt-0.5">Ex: cliente@email.com</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={checkoutFields.email.show}
                      onChange={() => handleCheckoutFieldToggle('email', 'show')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Mostrar</span>
                  </label>
                  
                  <label className={`flex items-center gap-1.5 cursor-pointer ${!checkoutFields.email.show ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox"
                      checked={checkoutFields.email.required}
                      disabled={!checkoutFields.email.show}
                      onChange={() => handleCheckoutFieldToggle('email', 'required')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Obrigatório</span>
                  </label>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-850">Telefone</span>
                  <span className="text-[10px] text-slate-400 font-semibold italic mt-0.5">Ex: (11) 99999-9999</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={checkoutFields.phone.show}
                      onChange={() => handleCheckoutFieldToggle('phone', 'show')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Mostrar</span>
                  </label>
                  
                  <label className={`flex items-center gap-1.5 cursor-pointer ${!checkoutFields.phone.show ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox"
                      checked={checkoutFields.phone.required}
                      disabled={!checkoutFields.phone.show}
                      onChange={() => handleCheckoutFieldToggle('phone', 'required')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Obrigatório</span>
                  </label>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-850">Endereço de Entrega / Serviço</span>
                  <span className="text-[10px] text-slate-400 font-semibold italic mt-0.5">Ex: Av. Paulista, 1000, Apto 12</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={checkoutFields.address.show}
                      onChange={() => handleCheckoutFieldToggle('address', 'show')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Mostrar</span>
                  </label>
                  
                  <label className={`flex items-center gap-1.5 cursor-pointer ${!checkoutFields.address.show ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox"
                      checked={checkoutFields.address.required}
                      disabled={!checkoutFields.address.show}
                      onChange={() => handleCheckoutFieldToggle('address', 'required')}
                      className="rounded text-pix focus:ring-pix border-slate-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase">Obrigatório</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Display Option */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-pix" /> Calendário de Agendamentos
                </h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Exiba a opção de escolher data e hora para os serviços agendados</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showScheduleCalendar}
                  onChange={(e) => setShowScheduleCalendar(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pix"></div>
              </label>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[11px] text-slate-500 leading-relaxed">
              Quando habilitado, se um produto/serviço que pertence a um catálogo vinculado a algum Calendário Ativo for adicionado ao carrinho, o cliente será obrigado a agendar um horário disponível no momento do checkout.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EcommerceManager;
