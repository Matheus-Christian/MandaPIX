import React, { useState } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Edit, X, ArrowRight, Users, Folder, DollarSign } from 'lucide-react';
import type { Store, Client, Catalog, Invoice } from '../utils/pix';

interface StoreManagerProps {
  stores: Store[];
  clients: Client[];
  catalogs: Catalog[];
  invoices: Invoice[];
  onAddStore: (store: Omit<Store, 'id'>) => void;
  onEditStore: (store: Store) => void;
  onDeleteStore: (id: string) => void;
  onSelectStore: (id: string) => void;
}

const GRADIENTS = [
  { label: 'Cinza Mineral', value: 'from-slate-500 to-slate-600' },
  { label: 'Azul Esmaltado', value: 'from-slate-600 to-blue-700' },
  { label: 'Verde Sálvia', value: 'from-teal-800 to-slate-600' },
  { label: 'Terracota Argila', value: 'from-stone-600 to-amber-900' },
  { label: 'Ametista Muted', value: 'from-indigo-900 to-slate-600' },
  { label: 'Café Neutro', value: 'from-stone-500 to-stone-700' }
];

export const StoreManager: React.FC<StoreManagerProps> = ({
  stores,
  clients,
  catalogs,
  invoices,
  onAddStore,
  onEditStore,
  onDeleteStore,
  onSelectStore,
}) => {
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [legalName, setLegalName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const openNewStore = () => {
    setEditingStore(null);
    setName('');
    setDescription('');
    setLegalName('');
    setDocument('');
    setEmail('');
    setContact('');
    setAddress('');
    setSelectedGradient(GRADIENTS[0].value);
    setErrors({});
    setIsOpen(true);
  };

  const openEditStore = (e: React.MouseEvent, store: Store) => {
    e.stopPropagation(); // Prevent entering the store
    setEditingStore(store);
    setName(store.name);
    setDescription(store.description);
    setLegalName(store.legal_name || '');
    setDocument(store.document || '');
    setEmail(store.email || '');
    setContact(store.contact || '');
    setAddress(store.address || '');
    setSelectedGradient(store.color || GRADIENTS[0].value);
    setErrors({});
    setIsOpen(true);
  };

  const handleStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Nome da loja é obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingStore) {
      onEditStore({
        id: editingStore.id,
        name: name.trim(),
        description: description.trim(),
        color: selectedGradient,
        legal_name: legalName.trim(),
        document: document.trim(),
        email: email.trim(),
        contact: contact.trim(),
        address: address.trim(),
      });
    } else {
      onAddStore({
        name: name.trim(),
        description: description.trim(),
        color: selectedGradient,
        legal_name: legalName.trim(),
        document: document.trim(),
        email: email.trim(),
        contact: contact.trim(),
        address: address.trim(),
      });
    }

    setIsOpen(false);
    setEditingStore(null);
    setName('');
    setDescription('');
    setLegalName('');
    setDocument('');
    setEmail('');
    setContact('');
    setAddress('');
    setErrors({});
  };

  const handleStoreDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    
    // Count associated items
    const clientCount = clients.filter(c => c.storeId === id).length;
    const catalogCount = catalogs.filter(cat => cat.storeId === id).length;
    const invoiceCount = invoices.filter(inv => inv.storeId === id).length;
    
    let warning = `Deseja realmente remover a loja "${name}"?`;
    if (clientCount > 0 || catalogCount > 0 || invoiceCount > 0) {
      warning = `ATENÇÃO: A loja "${name}" possui ${clientCount} cliente(s), ${catalogCount} catálogo(s) e ${invoiceCount} cobrança(s) vinculadas.\n\nSe você excluir esta loja, TODOS os dados pertencentes a ela serão removidos permanentemente. Deseja prosseguir?`;
    }
    
    if (confirm(warning)) {
      onDeleteStore(id);
    }
  };

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-pix" /> Minhas Lojas / Negócios
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie múltiplos negócios de forma independente ou divida suas operações
          </p>
        </div>
        <button
          onClick={openNewStore}
          className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Nova Loja
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Search Input */}
        <div className="relative max-w-md bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar lojas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border-none bg-transparent text-slate-800 focus:outline-none"
          />
        </div>

        {/* Stores Grid */}
        {filteredStores.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-700 text-sm">Nenhuma loja encontrada</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
              {search ? 'Tente ajustar sua busca para encontrar sua loja.' : 'Comece cadastrando um novo negócio para gerenciar cobranças, clientes e catálogos.'}
            </p>
            {!search && (
              <button
                onClick={openNewStore}
                className="mt-4 bg-pix/10 hover:bg-pix/20 text-pix font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Criar Loja
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStores.map((store) => {
              const storeClients = clients.filter(c => c.storeId === store.id).length;
              const storeCatalogs = catalogs.filter(cat => cat.storeId === store.id).length;
              const storeInvoices = invoices.filter(inv => inv.storeId === store.id).length;
              const colorGradient = store.color || 'from-blue-600 to-indigo-700';

              return (
                <div
                  key={store.id}
                  onClick={() => onSelectStore(store.id)}
                  className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden transition-all cursor-pointer hover:shadow-subtle group"
                >
                  {/* Color Banner */}
                  <div className={`h-2.5 bg-gradient-to-r ${colorGradient}`} />

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-pix transition-colors">
                          {store.name}
                        </h3>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => openEditStore(e, store)}
                            className="p-1 rounded bg-slate-50 hover:bg-pix-light text-slate-400 hover:text-pix border border-slate-100 hover:border-pix/10 transition-all active:scale-90"
                            title="Editar Loja"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleStoreDelete(e, store.id, store.name)}
                            className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                            title="Remover Loja"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-400 text-xs font-semibold line-clamp-2 min-h-8">
                        {store.description || 'Sem descrição cadastrada.'}
                      </p>

                      {/* Store Metadata */}
                      {(store.document || store.contact || store.email) && (
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-[10px] text-slate-500">
                          {store.document && (
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-[8px] text-slate-400 uppercase tracking-wider">CNPJ/CPF:</span>
                              <span className="font-semibold truncate text-slate-600">{store.document}</span>
                            </div>
                          )}
                          {store.contact && (
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-[8px] text-slate-400 uppercase tracking-wider">Contato:</span>
                              <span className="font-semibold truncate text-slate-600">{store.contact}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stats Badges */}
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <span className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> {storeClients} clie.
                        </span>
                        <span className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <Folder className="w-3.5 h-3.5 text-slate-400" /> {storeCatalogs} catá.
                        </span>
                        <span className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" /> {storeInvoices} cobr.
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-slate-50 flex items-center justify-between text-pix font-bold text-xs group-hover:text-pix-dark">
                      <span>Gerenciar Negócio</span>
                      <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Store Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-pix" /> {editingStore ? 'Editar Loja' : 'Cadastrar Nova Loja'}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleStoreSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Coluna 1 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Nome Fantasia (Loja)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Nome da sua Loja ou Negócio"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                      className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${
                        errors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
                      }`}
                    />
                    {errors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Razão Social (Nome Jurídico)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Razão Social da Empresa Ltda"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      CPF / CNPJ
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 00.000.000/0001-00 ou 000.000.000-00"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Coluna 2 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      E-mail de Contato
                    </label>
                    <input
                      type="email"
                      placeholder="Ex: contato@suaempresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Endereço Comercial
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Rua, Número, Bairro, Cidade - UF"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                    />
                  </div>
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  placeholder="Ex: Prestação de serviços de TI ou Comércio local de produtos."
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                />
              </div>

              {/* Gradient Palette Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Paleta de Cores (Identidade Visual - Cores Discretas)
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setSelectedGradient(g.value)}
                      className={`h-9 rounded-xl bg-gradient-to-r ${g.value} border-2 transition-all flex items-center justify-center ${
                        selectedGradient === g.value
                          ? 'border-slate-800 scale-102 ring-2 ring-slate-200'
                          : 'border-transparent hover:scale-102'
                      }`}
                      title={g.label}
                    >
                      {selectedGradient === g.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-pix/10 text-sm animate-pulse-once"
                >
                  Salvar Loja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StoreManager;
