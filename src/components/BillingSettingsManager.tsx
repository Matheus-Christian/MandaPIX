import React, { useState, useEffect } from 'react';
import { 
  Save, 
  AlertTriangle,
  DollarSign,
  Percent,
  CreditCard,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { 
  formatCurrencyInput, 
  parseBRLToNumber
} from '../utils/pix';
import type { 
  Store, 
  SavedPixKey, 
  EcommerceSettings 
} from '../utils/pix';

interface BillingSettingsManagerProps {
  store: Store;
  savedKeys: SavedPixKey[];
  onSettingsSaved?: () => void;
}

export const BillingSettingsManager: React.FC<BillingSettingsManagerProps> = ({
  store,
  savedKeys = [],
  onSettingsSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Complete settings state to avoid losing other properties on upsert
  const [fullSettings, setFullSettings] = useState<EcommerceSettings | null>(null);

  // Local settings states
  const [paymentMethods, setPaymentMethods] = useState<Array<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'>>(['PIX']);
  const [paymentWallets, setPaymentWallets] = useState<Record<string, string>>({});
  
  // Down payment states
  const [downPaymentEnabled, setDownPaymentEnabled] = useState(false);
  const [downPaymentType, setDownPaymentType] = useState<'percentage' | 'fixed'>('percentage');
  const [downPaymentValueRaw, setDownPaymentValueRaw] = useState('0,00');

  // Installments states
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState(1);

  // Check wallets availability
  const hasPixWallet = savedKeys.some(k => k.walletType === 'PIX' || k.walletType === 'PIX_AUTO');
  const hasCreditWallet = savedKeys.some(k => k.walletType === 'CREDIT_CARD');
  const hasDebitWallet = savedKeys.some(k => k.walletType === 'DEBIT_CARD');

  // Load settings from Supabase
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
          setFullSettings(settings);
          setPaymentMethods(settings.payment_methods || ['PIX']);
          setPaymentWallets(settings.payment_wallets || {});
          setDownPaymentEnabled(settings.down_payment_enabled || false);
          setDownPaymentType(settings.down_payment_type || 'percentage');
          setDownPaymentValueRaw(
            (settings.down_payment_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          );
          setInstallmentsEnabled(settings.installments_enabled || false);
          setMaxInstallments(settings.max_installments || 1);
        }
      } catch (err) {
        console.error('Error fetching billing settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [store.id]);

  const togglePaymentMethod = (method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD') => {
    setPaymentMethods(prev => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(m => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleDownPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setDownPaymentValueRaw(formatted);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const downPaymentVal = parseBRLToNumber(downPaymentValueRaw);

      // Default fields if fullSettings wasn't initialized yet
      const defaultFields = {
        is_enabled: true,
        catalog_ids: [],
        business_hours: [],
        show_schedule_calendar: true,
        checkout_fields: {
          name: { show: true, required: true },
          document: { show: true, required: true },
          email: { show: true, required: true },
          phone: { show: true, required: true },
          address: { show: false, required: false }
        }
      };

      const settingsPayload = {
        ...defaultFields,
        ...fullSettings,
        store_id: store.id,
        payment_methods: paymentMethods,
        payment_wallets: paymentWallets,
        down_payment_enabled: downPaymentEnabled,
        down_payment_value: downPaymentVal,
        down_payment_type: downPaymentType,
        installments_enabled: installmentsEnabled,
        max_installments: maxInstallments,
        updated_at: new Date().toISOString()
      };

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

      alert('Configurações de cobrança salvas com sucesso!');
    } catch (err: any) {
      console.error('Error saving billing settings:', err);
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
            <DollarSign className="w-6 h-6 text-pix" /> Parâmetros de Cobrança
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure as regras de parcelamento, entradas/saldos e meios de pagamento unificados para todo o site
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

      {/* Settings Scroll Box */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: Online Payment Methods & Wallets */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-pix" /> Meios de Recebimento
              </h3>
              <p className="text-[11px] text-slate-450 mt-1">Defina quais formas de pagamento estão ativas e as contas vinculadas</p>
            </div>

            <div className="space-y-4">
              {/* PIX */}
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:bg-slate-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <span className="bg-teal-50 border border-teal-100 text-teal-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">PIX</span>
                    <span className="text-xs font-bold text-slate-700">PIX (Manual ou Automatizado)</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={paymentMethods.includes('PIX')}
                    onChange={() => togglePaymentMethod('PIX')}
                    className="rounded text-pix focus:ring-pix border-slate-300 w-4 h-4"
                  />
                </label>
                {paymentMethods.includes('PIX') && (
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider">Carteira PIX para Recebimentos</label>
                    <select
                      value={paymentWallets['PIX'] || ''}
                      onChange={(e) => setPaymentWallets(prev => ({ ...prev, PIX: e.target.value }))}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                    >
                      <option value="">-- Selecione a carteira PIX --</option>
                      {savedKeys
                        .filter(k => k.walletType === 'PIX' || k.walletType === 'PIX_AUTO')
                        .map(k => (
                          <option key={k.id} value={k.id}>
                            {k.label} ({k.walletType === 'PIX_AUTO' ? 'Automático + Taxas' : `${k.type}: ${k.key}`})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
                {!hasPixWallet && paymentMethods.includes('PIX') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhuma carteira PIX cadastrada. Adicione uma chave receptora na aba de Configuração de Chaves.</span>
                  </div>
                )}
              </div>

              {/* CREDIT CARD */}
              <div className="space-y-2">
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
                {paymentMethods.includes('CREDIT_CARD') && (
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider">Carteira / Gateway de Crédito</label>
                    <select
                      value={paymentWallets['CREDIT_CARD'] || ''}
                      onChange={(e) => setPaymentWallets(prev => ({ ...prev, CREDIT_CARD: e.target.value }))}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                    >
                      <option value="">-- Selecione o provedor de crédito --</option>
                      {savedKeys
                        .filter(k => k.walletType === 'CREDIT_CARD')
                        .map(k => (
                          <option key={k.id} value={k.id}>
                            {k.label} ({k.cardProvider})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
                {!hasCreditWallet && paymentMethods.includes('CREDIT_CARD') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhuma carteira de Crédito configurada nas chaves da plataforma.</span>
                  </div>
                )}
              </div>

              {/* DEBIT CARD */}
              <div className="space-y-2">
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
                {paymentMethods.includes('DEBIT_CARD') && (
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase tracking-wider">Carteira / Gateway de Débito</label>
                    <select
                      value={paymentWallets['DEBIT_CARD'] || ''}
                      onChange={(e) => setPaymentWallets(prev => ({ ...prev, DEBIT_CARD: e.target.value }))}
                      className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                    >
                      <option value="">-- Selecione o provedor de débito --</option>
                      {savedKeys
                        .filter(k => k.walletType === 'DEBIT_CARD')
                        .map(k => (
                          <option key={k.id} value={k.id}>
                            {k.label} ({k.cardProvider})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
                {!hasDebitWallet && paymentMethods.includes('DEBIT_CARD') && (
                  <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[10px] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Nenhuma carteira de Débito configurada nas chaves da plataforma.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Down Payment / Entry configuration */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-pix" /> Entrada Obrigatória
                </h3>
                <p className="text-[11px] text-slate-450 mt-1">Exija um pagamento de entrada adiantado no agendamento ou pedido</p>
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

            {downPaymentEnabled ? (
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
            ) : (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                A cobrança de entrada adiantada está desativada. O cliente pagará o valor total.
              </div>
            )}

            {/* Installments (Parcelamento) */}
            <div className="border-t border-slate-100 pt-4 mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-pix" /> Regras de Parcelamento
                  </h3>
                  <p className="text-[11px] text-slate-450 mt-1">Configure o limite máximo de parcelas permitidas nas cobranças</p>
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

              {installmentsEnabled ? (
                <div className="pt-2 animate-fade-in">
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Limite Máximo de Parcelas</label>
                  <select
                    value={maxInstallments}
                    onChange={(e) => setMaxInstallments(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none font-bold"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <option key={n} value={n}>{n} Parcelas</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Parcelamento desativado. Somente faturamentos à vista (1x) são gerados.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security / System Summary Info */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-xs text-emerald-800">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Configuração Centralizada Ativa</span>
            <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
              Esses parâmetros são aplicados automaticamente na vitrine do seu E-commerce público e servem como padrão ao gerar novos pedidos manuais no painel principal, garantindo a uniformidade de taxas e carteiras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSettingsManager;
