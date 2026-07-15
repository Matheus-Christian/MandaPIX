import React, { useState, useEffect } from 'react';
import { ShoppingBag, Save } from 'lucide-react';
import type { Store } from '../utils/pix';

interface StoreSettingsProps {
  store: Store;
  onSaveStore: (store: Store) => Promise<void>;
}

const GRADIENTS = [
  { label: 'Cinza Mineral', value: 'from-slate-500 to-slate-600' },
  { label: 'Azul Esmaltado', value: 'from-slate-600 to-blue-700' },
  { label: 'Verde Sálvia', value: 'from-teal-800 to-slate-600' },
  { label: 'Terracota Argila', value: 'from-stone-600 to-amber-900' },
  { label: 'Ametista Muted', value: 'from-indigo-900 to-slate-600' },
  { label: 'Café Neutro', value: 'from-stone-500 to-stone-700' }
];

export const StoreSettings: React.FC<StoreSettingsProps> = ({ store, onSaveStore }) => {
  const [name, setName] = useState(store.name || '');
  const [description, setDescription] = useState(store.description || '');
  const [legalName, setLegalName] = useState(store.legal_name || '');
  const [document, setDocument] = useState(store.document || '');
  const [email, setEmail] = useState(store.email || '');
  const [contact, setContact] = useState(store.contact || '');
  const [address, setAddress] = useState(store.address || '');
  const [selectedGradient, setSelectedGradient] = useState(store.color || GRADIENTS[0].value);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync state with store prop changes (e.g. when changing stores or initial load)
  useEffect(() => {
    setName(store.name || '');
    setDescription(store.description || '');
    setLegalName(store.legal_name || '');
    setDocument(store.document || '');
    setEmail(store.email || '');
    setContact(store.contact || '');
    setAddress(store.address || '');
    setSelectedGradient(store.color || GRADIENTS[0].value);
  }, [store]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'O nome da loja é obrigatório' });
      return;
    }
    
    setSaving(true);
    setSuccess(false);
    
    try {
      await onSaveStore({
        ...store,
        name: name.trim(),
        description: description.trim(),
        color: selectedGradient,
        legal_name: legalName.trim(),
        document: document.trim(),
        email: email.trim(),
        contact: contact.trim(),
        address: address.trim(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações da loja:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-pix" /> Identificação da Loja
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie as informações públicas, cadastrais e identidade visual da sua loja
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Nome Fantasia (Loja) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nome da sua Loja ou Negócio"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({});
                    }}
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${
                      errors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
                    }`}
                  />
                  {errors.name && <p className="text-red-500 text-[10px] mt-1 ml-1 font-semibold">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Razão Social (Nome Jurídico)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Razão Social da Empresa Ltda"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 00.000.000/0001-00 ou 000.000.000-00"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    placeholder="Ex: contato@suaempresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-9999"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Endereço Comercial
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rua, Número, Bairro, Cidade - UF"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Descrição da Loja / Sobre
              </label>
              <textarea
                placeholder="Ex: Prestação de serviços de beleza ou Comércio local de cosméticos."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
              />
            </div>

            {/* Gradient Palette Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                Identidade Visual (Cor do Negócio)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setSelectedGradient(g.value)}
                    className={`h-11 rounded-xl bg-gradient-to-r ${g.value} border-2 transition-all flex items-center justify-center ${
                      selectedGradient === g.value
                        ? 'border-slate-800 scale-102 ring-2 ring-slate-200'
                        : 'border-transparent hover:scale-102'
                    }`}
                    title={g.label}
                  >
                    {selectedGradient === g.value && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-md animate-scale-in" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {success && (
              <span className="text-emerald-600 text-xs font-bold animate-fade-in">
                Configurações salvas com sucesso!
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-pix hover:bg-pix-dark disabled:opacity-50 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-md shadow-pix/10 transition-all active:scale-98"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
