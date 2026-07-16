import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, X, Wallet as WalletIcon, ShieldCheck, CreditCard, Edit2 } from 'lucide-react';
import { validatePixKey, maskPixKey, BANKS } from '../utils/pix';
import type { PixKeyType, Wallet, WalletType } from '../utils/pix';
import { supabase } from '../utils/supabaseClient';

interface SavedKeysProps {
  onKeysChanged?: (keys: Wallet[]) => void;
}

// Helpers para conversão entre camelCase (JS) e snake_case (Postgres)
const mapFromDB = (db: any): Wallet => ({
  id: db.id,
  walletType: db.wallet_type as WalletType,
  label: db.label,
  bankName: db.bank_name,
  isPrimary: db.is_primary,
  type: db.type as PixKeyType,
  key: db.key,
  name: db.name,
  city: db.city,
  cardProvider: db.card_provider,
  accountIdentifier: db.account_identifier,
});

const mapToDB = (wallet: Omit<Wallet, 'id'> & { id?: string }) => ({
  id: wallet.id,
  wallet_type: wallet.walletType,
  label: wallet.label,
  bank_name: wallet.bankName,
  is_primary: wallet.isPrimary,
  type: wallet.type,
  key: wallet.key,
  name: wallet.name,
  city: wallet.city,
  card_provider: wallet.cardProvider,
  account_identifier: wallet.accountIdentifier,
});

export const SavedKeys: React.FC<SavedKeysProps> = ({ onKeysChanged }) => {
  const [keys, setKeys] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  
  // Form State
  const [walletType, setWalletType] = useState<WalletType>('PIX');
  const [label, setLabel] = useState('');
  const [bankName, setBankName] = useState('Nubank');
  const [type, setType] = useState<PixKeyType>('CPF');
  const [keyValue, setKeyValue] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverCity, setReceiverCity] = useState('');
  const [cardProvider, setCardProvider] = useState('Stripe');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  
  // Errors state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Carregar carteiras do Supabase
  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const mapped = (data || []).map(mapFromDB);
      setKeys(mapped);
      if (onKeysChanged) {
        onKeysChanged(mapped);
      }
    } catch (err) {
      console.error('Erro ao carregar carteiras do banco de dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskPixKey(type, rawVal);
    setKeyValue(masked);
    if (errors.key) {
      setErrors(prev => ({ ...prev, key: '' }));
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PixKeyType;
    setType(newType);
    setKeyValue('');
    setErrors(prev => ({ ...prev, key: '' }));
  };

  const handleEdit = (w: Wallet) => {
    setEditingWallet(w);
    setWalletType(w.walletType);
    setLabel(w.label);
    setBankName(w.bankName || 'Nubank');
    setType(w.type || 'CPF');
    setKeyValue(w.key || '');
    setReceiverName(w.name || '');
    setReceiverCity(w.city || '');
    setCardProvider(w.cardProvider || 'Stripe');
    setAccountIdentifier(w.accountIdentifier || '');
    setIsAdding(true);
  };

  const handleSetPrimary = async (id: string) => {
    try {
      // 1. Atualizar todas para falso no banco
      const { error: resetError } = await supabase
        .from('wallets')
        .update({ is_primary: false })
        .eq('is_primary', true); // Apenas as que eram principais
      
      if (resetError) throw resetError;

      // 2. Atualizar a escolhida para verdadeira
      const { error: setError } = await supabase
        .from('wallets')
        .update({ is_primary: true })
        .eq('id', id);

      if (setError) throw setError;

      await loadKeys();
    } catch (err) {
      console.error('Erro ao definir carteira principal:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const targetKey = keys.find(k => k.id === id);
    if (!targetKey) return;

    if (confirm(`Deseja mesmo remover a carteira "${targetKey.label}"?`)) {
      try {
        const { error } = await supabase
          .from('wallets')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Se era principal e sobrou algum item, define o primeiro como principal
        const remaining = keys.filter(k => k.id !== id);
        if (targetKey.isPrimary && remaining.length > 0) {
          const first = remaining[0];
          await supabase
            .from('wallets')
            .update({ is_primary: true })
            .eq('id', first.id);
        }

        await loadKeys();
      } catch (err) {
        console.error('Erro ao deletar carteira:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    // Validar Label
    if (!label.trim()) newErrors.label = 'O apelido é obrigatório';

    if (walletType === 'PIX') {
      // Validar Nome Recebedor
      if (!receiverName.trim()) newErrors.name = 'O nome do recebedor é obrigatório';
      else if (receiverName.trim().length < 3) newErrors.name = 'Nome deve ter no mínimo 3 caracteres';

      // Validar Cidade
      if (!receiverCity.trim()) newErrors.city = 'A cidade é obrigatória';
      else if (receiverCity.trim().length < 2) newErrors.city = 'Cidade inválida';

      // Validar Chave
      const validation = validatePixKey(type, keyValue);
      if (!validation.isValid) {
        newErrors.key = validation.error || 'Chave inválida';
      }
    } else if (walletType === 'PIX_AUTO') {
      // Somente o label é obrigatório, já validado acima
    } else {
      // Validar detalhes do cartão
      if (!accountIdentifier.trim()) {
        newErrors.accountIdentifier = 'O identificador da conta é obrigatório';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const walletId = editingWallet ? editingWallet.id : crypto.randomUUID();
      const isPrimaryValue = editingWallet ? editingWallet.isPrimary : keys.length === 0;

      let walletData: Wallet;

      if (walletType === 'PIX') {
        walletData = {
          id: walletId,
          walletType: 'PIX',
          type,
          key: keyValue.trim(),
          name: receiverName.trim().toUpperCase(),
          city: receiverCity.trim().toUpperCase(),
          label: label.trim(),
          bankName,
          isPrimary: isPrimaryValue,
        };
      } else if (walletType === 'PIX_AUTO') {
        walletData = {
          id: walletId,
          walletType: 'PIX_AUTO',
          type: 'RANDOM',
          key: 'automatico',
          name: 'Roteamento MandaPIX',
          city: 'SAO PAULO',
          label: label.trim(),
          bankName: 'MandaPIX',
          isPrimary: isPrimaryValue,
        };
      } else {
        walletData = {
          id: walletId,
          walletType,
          type: 'RANDOM',
          key: accountIdentifier.trim(),
          name: label.trim().toUpperCase(),
          city: 'SAO PAULO',
          label: label.trim(),
          bankName: 'Outro',
          cardProvider,
          accountIdentifier: accountIdentifier.trim(),
          isPrimary: isPrimaryValue,
        };
      }

      // Salvar ou Atualizar no Supabase
      if (editingWallet) {
        const { error } = await supabase
          .from('wallets')
          .update(mapToDB(walletData))
          .eq('id', editingWallet.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wallets')
          .insert([mapToDB(walletData)]);

        if (error) throw error;
      }

      // Resetar Form
      setLabel('');
      setKeyValue('');
      setReceiverName('');
      setReceiverCity('');
      setAccountIdentifier('');
      setWalletType('PIX');
      setIsAdding(false);
      setEditingWallet(null);
      setErrors({});
      
      await loadKeys();
    } catch (err) {
      console.error('Erro ao salvar carteira no Supabase:', err);
    }
  };

  const getBankGradient = (k: Wallet) => {
    if (k.walletType === 'PIX_AUTO') {
      return 'from-teal-600 via-teal-750 to-emerald-800';
    }
    if (k.walletType !== 'PIX') {
      return 'from-slate-800 via-slate-900 to-zinc-950';
    }
    const b = BANKS.find(x => x.name.toLowerCase() === k.bankName.toLowerCase());
    return b ? b.gradient : 'from-slate-700 to-slate-900';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Area */}
      <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-1.5">
            <WalletIcon className="w-5 h-5 text-pix" /> Minhas Carteiras
          </h2>
          <p className="text-xs text-slate-500">Gerencie suas chaves PIX e credenciais de cartões para faturamento rápido</p>
        </div>
        {!isAdding && !loading && (
          <button
            onClick={() => { setEditingWallet(null); setIsAdding(true); }}
            className="flex items-center gap-1 bg-pix text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-pix-dark transition-all shadow-md shadow-pix/10 tap-highlight-transparent active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pix border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">Carregando carteiras...</p>
          </div>
        ) : isAdding ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-fade-in max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Nova Carteira de Recebimento</h3>
              <button 
                onClick={() => { setIsAdding(false); setEditingWallet(null); setErrors({}); }}
                className="text-slate-400 hover:text-slate-650 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Wallet Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Meio de Pagamento / Tipo de Carteira</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PIX', 'PIX_AUTO', 'CREDIT_CARD'] as WalletType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setWalletType(t); setErrors({}); }}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                        walletType === t
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {t === 'PIX' && (
                        <>
                          <WalletIcon className="w-4 h-4 text-pix" />
                          <span>PIX Manual</span>
                        </>
                      )}
                      {t === 'PIX_AUTO' && (
                        <>
                          <ShieldCheck className="w-4 h-4 text-teal-400" />
                          <span>PIX Auto + Taxas</span>
                        </>
                      )}
                      {t === 'CREDIT_CARD' && (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Crédito</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Common Label Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Apelido da Carteira (ex: Meu Nubank Comercial, Gateway Stripe)</label>
                <input
                  type="text"
                  placeholder="Nome identificador da carteira"
                  value={label}
                  onChange={(e) => { setLabel(e.target.value); setErrors(prev => ({ ...prev, label: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.label ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {errors.label && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.label}</p>}
              </div>

              {/* Conditional Fields based on Type */}
              {walletType === 'PIX' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Instituição</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white"
                      >
                        {BANKS.map((b, idx) => (
                          <option key={idx} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Chave</label>
                      <select
                        value={type}
                        onChange={handleTypeChange}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white"
                      >
                        <option value="CPF">CPF</option>
                        <option value="CNPJ">CNPJ</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="PHONE">Celular</option>
                        <option value="RANDOM">Chave Aleatória (UUID)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Chave PIX</label>
                    <input
                      type="text"
                      placeholder={
                        type === 'CPF' ? '000.000.000-00' :
                        type === 'CNPJ' ? '00.000.000/0000-00' :
                        type === 'PHONE' ? '(11) 99999-9999' :
                        type === 'EMAIL' ? 'exemplo@email.com' :
                        '123e4567-e89b-12d3-a456-426614174000'
                      }
                      value={keyValue}
                      onChange={handleKeyInputChange}
                      className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white font-mono transition-all ${errors.key ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                    />
                    {errors.key && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.key}</p>}
                  </div>

                  <div className="border-t border-slate-100 pt-3 mt-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-pix" /> Dados de Recebimento (Bancos)
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Beneficiário</label>
                        <input
                          type="text"
                          placeholder="Nome titular da conta"
                          value={receiverName}
                          onChange={(e) => { setReceiverName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                          className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.name ? 'border-red-450 ring-2 ring-red-100' : 'border-slate-200'}`}
                        />
                        {errors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Cidade da Conta</label>
                        <input
                          type="text"
                          placeholder="SAO PAULO"
                          value={receiverCity}
                          onChange={(e) => { setReceiverCity(e.target.value); if (errors.city) setErrors(prev => ({ ...prev, city: '' })); }}
                          className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.city ? 'border-red-450 ring-2 ring-red-100' : 'border-slate-200'}`}
                        />
                        {errors.city && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.city}</p>}
                      </div>
                    </div>
                  </div>
                </>
              ) : walletType === 'PIX_AUTO' ? (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-slate-500 text-[11px] leading-relaxed space-y-2">
                  <p className="font-bold text-slate-700 mb-1 flex items-center gap-1 text-xs">
                    <ShieldCheck className="w-4 h-4 text-pix" /> PIX Automatizado + Taxas (Recomendado)
                  </p>
                  <p>
                    Esta modalidade utiliza o roteamento inteligente de taxas do MandaPIX através das contas centralizadas dos gateways <strong>Asaas</strong> e <strong>Efí</strong>.
                  </p>
                  <p>
                    <strong>Benefícios:</strong>
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 font-medium">
                    <li>Roteamento dinâmico automático baseado no valor da venda.</li>
                    <li>Melhor custo-benefício garantido para cada transação.</li>
                    <li>Não requer nenhuma chave ou credencial pessoal do lojista.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Provedor / Gateway de Pagamento</label>
                      <select
                        value={cardProvider}
                        onChange={(e) => setCardProvider(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white"
                      >
                        <option value="Stripe">Stripe</option>
                        <option value="Mercado Pago">Mercado Pago</option>
                        <option value="Cielo">Cielo</option>
                        <option value="Rede">Rede</option>
                        <option value="PagSeguro">PagSeguro</option>
                        <option value="Outro">Outro Provedor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Identificador / ID da Conta Comercial</label>
                      <input
                        type="text"
                        placeholder="Ex: acct_102938475"
                        value={accountIdentifier}
                        onChange={(e) => { setAccountIdentifier(e.target.value); setErrors(prev => ({ ...prev, accountIdentifier: '' })); }}
                        className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.accountIdentifier ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                      />
                      {errors.accountIdentifier && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.accountIdentifier}</p>}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-slate-500 text-[11px] leading-relaxed">
                    <p className="font-bold text-slate-700 mb-1">Nota sobre Carteiras de Cartão:</p>
                    Estas credenciais servem para simular o faturamento através de links de pagamentos integrados. Ao emitir faturas utilizando esta carteira, os clientes finais verão opções de checkout via cartão de crédito ou débito em vez de dados PIX.
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-pix text-white py-2.5 rounded-xl font-bold hover:bg-pix-dark transition-all mt-4 shadow-md shadow-pix/10 tap-highlight-transparent active:scale-98"
              >
                {editingWallet ? 'Salvar Alterações' : 'Salvar Carteira'}
              </button>
            </form>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <WalletIcon className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Nenhuma carteira cadastrada</h3>
            <p className="text-sm text-slate-400 max-w-[260px] mb-5">
              Cadastre suas carteiras PIX ou de Cartões para gerar faturamentos instantâneos.
            </p>
            <button
              onClick={() => { setEditingWallet(null); setIsAdding(true); }}
              className="bg-pix text-white px-5 py-2.5 rounded-full font-bold shadow-md shadow-pix/10 hover:bg-pix-dark transition-all tap-highlight-transparent active:scale-95"
            >
              Criar Primeira Carteira
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {keys.map((k) => (
              <div
                key={k.id}
                className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm flex flex-col hover:border-slate-350 transition-all group"
              >
                {/* Visual strip based on wallet type */}
                <div className={`h-2.5 bg-gradient-to-r ${getBankGradient(k)}`} />
                <div className="p-4 flex flex-col justify-between flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{k.label}</span>
                        {k.isPrimary && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Principal
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          (k.walletType === 'PIX' || k.walletType === 'PIX_AUTO')
                            ? 'bg-teal-50 border-teal-100 text-teal-700'
                            : k.walletType === 'CREDIT_CARD'
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}>
                          {(k.walletType === 'PIX' || k.walletType === 'PIX_AUTO') ? 'PIX' : k.walletType === 'CREDIT_CARD' ? 'Crédito' : 'Débito'}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {k.walletType === 'PIX' 
                          ? `${k.bankName} • ${k.type}` 
                          : k.walletType === 'PIX_AUTO' 
                          ? 'Roteamento MandaPIX' 
                          : `${k.cardProvider} Gateway`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(k)}
                        title="Editar carteira"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-pix hover:bg-slate-50 transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!k.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(k.id)}
                          title="Tornar carteira principal"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-slate-50 transition-all"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-slate-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {k.walletType === 'PIX' ? (
                    <div className="mt-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Chave</span>
                        <span className="font-mono text-slate-700 font-semibold">{k.key}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Titular</span>
                        <span className="text-slate-700 font-semibold text-right max-w-[160px] truncate">{k.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Cidade</span>
                        <span className="text-slate-600 font-medium">{k.city}</span>
                      </div>
                    </div>
                  ) : k.walletType === 'PIX_AUTO' ? (
                    <div className="mt-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Modalidade</span>
                        <span className="text-slate-750 font-bold text-pix text-right">Automatizado + Taxas</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Gateways</span>
                        <span className="text-slate-700 font-semibold text-right">Asaas / Efí</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Roteamento</span>
                        <span className="text-emerald-600 font-bold text-right">Ativo e Otimizado</span>
                      </div>
                    </div>
                  ) : (
                    /* Render specialized card detail slots */
                    <div className="mt-2 bg-slate-950 text-white rounded-xl p-3 border border-slate-800 flex flex-col justify-between font-mono relative overflow-hidden h-28 shadow-inner">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.05),transparent_45%)]" />
                      <div className="flex justify-between items-start z-10">
                        <CreditCard className={`w-6 h-6 ${k.walletType === 'CREDIT_CARD' ? 'text-indigo-400' : 'text-emerald-400'}`} />
                        <span className="text-[8px] tracking-wider uppercase font-bold text-white/50">{k.cardProvider}</span>
                      </div>
                      
                      <div className="w-6 h-4.5 bg-gradient-to-r from-amber-400 to-amber-600 rounded-xs mt-1.5 opacity-80" />
                      
                      <div className="flex justify-between items-end mt-2 z-10">
                        <div>
                          <div className="text-[10px] tracking-widest text-slate-300">
                            •••• •••• •••• {k.accountIdentifier?.slice(-4) || 'CARD'}
                          </div>
                          <div className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-wide truncate max-w-[150px]">
                            {k.label}
                          </div>
                        </div>
                        <div className="text-[8px] text-right font-sans text-slate-400 font-bold bg-white/10 px-1.5 py-0.5 rounded-sm backdrop-blur-xs">
                          {k.walletType === 'CREDIT_CARD' ? 'CRÉDITO' : 'DÉBITO'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedKeys;
