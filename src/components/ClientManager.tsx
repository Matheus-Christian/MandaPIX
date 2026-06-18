import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Edit, 
  Eye, 
  Mail, 
  Phone, 
  FileText, 
  ShoppingBag, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { formatBRL } from '../utils/pix';
import type { Client, Order } from '../utils/pix';

interface ClientManagerProps {
  clients: Client[];
  orders: Order[];
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const ClientManager: React.FC<ClientManagerProps> = ({
  clients,
  orders,
  onAddClient,
  onEditClient,
  onDeleteClient,
}) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'pedidos' | 'agendamentos'>('pedidos');

  // Form State
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const startEditClient = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setDocument(client.document);
    setEmail(client.email);
    setPhone(client.phone);
    setIsAdding(true);
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingClient(null);
    setName('');
    setDocument('');
    setEmail('');
    setPhone('');
    setErrors({});
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 11) {
      // CPF Mask
      val = val
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ Mask
      val = val
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    setDocument(val.substring(0, 18));
    if (errors.document) setErrors(prev => ({ ...prev, document: '' }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
    setPhone(val.substring(0, 15));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!document.trim()) newErrors.document = 'CPF/CNPJ é obrigatório';
    if (!email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }
    if (!phone.trim()) newErrors.phone = 'Telefone é obrigatório';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingClient) {
      onEditClient({
        id: editingClient.id,
        name: name.trim(),
        document: document.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    } else {
      onAddClient({
        name: name.trim(),
        document: document.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    }

    // Reset Form
    setName('');
    setDocument('');
    setEmail('');
    setPhone('');
    setEditingClient(null);
    setErrors({});
    setIsAdding(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza de que deseja excluir o cliente "${name}"? Todas as cobranças vinculadas a ele continuarão registradas.`)) {
      onDeleteClient(id);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-pix" /> Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1">Cadastre e gerencie a base de clientes do seu negócio</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Cadastrar Cliente
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isAdding ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome Completo / Razão Social</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva ou Empresa XYZ Ltda"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {errors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">CPF / CNPJ</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={document}
                    onChange={handleDocumentChange}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-mono ${errors.document ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.document && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.document}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefone Celular</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={handlePhoneChange}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.phone ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.phone && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="exemplo@dominio.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.email ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {errors.email && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.email}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-pix/10 active:scale-98 text-sm"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar clientes por nome, documento ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none focus:bg-white transition-all"
              />
            </div>

            {/* List */}
            {filteredClients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum cliente cadastrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
                  {search ? 'Nenhum resultado corresponde à sua busca.' : 'Cadastre seus primeiros clientes para gerar cobranças fáceis.'}
                </p>
                {!search && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="mt-4 bg-pix/10 hover:bg-pix/20 text-pix font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Criar Cliente
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 pl-6">Cliente</th>
                        <th className="p-4">CPF / CNPJ</th>
                        <th className="p-4">Contato</th>
                        <th className="p-4 text-right pr-6">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-pix/10 text-pix flex items-center justify-center font-bold text-xs uppercase">
                                {client.name.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block text-sm">{client.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-600">
                            {client.document}
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="text-slate-700 block font-medium">{client.email}</span>
                            <span className="text-slate-400 block font-semibold text-[10px]">{client.phone}</span>
                          </td>
                          <td className="p-4 text-right pr-6 space-x-1.5 flex items-center justify-end">
                            <button
                              onClick={() => { setViewingClient(client); setActiveModalTab('pedidos'); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pix hover:bg-pix-light border border-transparent hover:border-pix/10 transition-all active:scale-90"
                              title="Visualizar Informações"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => startEditClient(client)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pix hover:bg-pix-light border border-transparent hover:border-pix/10 transition-all active:scale-90"
                              title="Editar Cliente"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(client.id, client.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-90"
                              title="Excluir Cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Cliente */}
      {viewingClient && (() => {
        // Find client orders and appointments
        const clientOrders = orders.filter(o => 
          o.clientDocument === viewingClient.document || 
          (viewingClient.email && o.clientEmail === viewingClient.email) ||
          (viewingClient.phone && o.clientPhone === viewingClient.phone)
        );

        // A normal order has no scheduledAt. A scheduled order has scheduledAt
        const normalOrders = clientOrders.filter(o => !o.scheduledAt);
        const appointments = clientOrders.filter(o => !!o.scheduledAt);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100 shadow-2xl animate-scale-up">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-pix" />
                  <h3 className="font-bold text-slate-800 text-lg">Informações do Cliente</h3>
                </div>
                <button
                  onClick={() => setViewingClient(null)}
                  className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Profile Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-pix/10 text-pix flex items-center justify-center font-black text-xl uppercase shrink-0">
                    {viewingClient.name.substring(0, 2)}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800">{viewingClient.name}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500 font-semibold mt-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-450" />
                        <span>{viewingClient.document}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-slate-450" />
                        <span>{viewingClient.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-slate-450" />
                        <span>{viewingClient.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-100 flex gap-4">
                  <button
                    onClick={() => setActiveModalTab('pedidos')}
                    className={`pb-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeModalTab === 'pedidos' 
                        ? 'border-pix text-pix' 
                        : 'border-transparent text-slate-400 hover:text-slate-500'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Histórico de Pedidos ({normalOrders.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveModalTab('agendamentos')}
                    className={`pb-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeModalTab === 'agendamentos' 
                        ? 'border-pix text-pix' 
                        : 'border-transparent text-slate-400 hover:text-slate-500'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Agendamentos ({appointments.length})</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div>
                  {activeModalTab === 'pedidos' && (
                    <div className="space-y-3">
                      {normalOrders.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-slate-455 text-xs">
                          Nenhum pedido registrado para este cliente.
                        </div>
                      ) : (
                        normalOrders.map(order => (
                          <div 
                            key={order.id}
                            className="p-4 border border-slate-100 bg-slate-50/40 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-805">Pedido #{order.orderNumber}</span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {new Date(order.dateCreated + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="text-slate-500 font-medium max-w-md">
                                {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2">
                              <span className="font-black text-slate-800 text-sm">
                                {formatBRL(order.totalAmount)}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                order.status === 'APROVADO' || order.status === 'VENDA_CONCLUIDA' || order.status === 'PEDIDO_ENTREGUE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : order.status === 'PENDENTE' || order.status === 'REGISTRO_ITENS' || order.status === 'ENTRADA_PEDIDO'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-slate-50 text-slate-650 border border-slate-150'
                              }`}>
                                {order.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeModalTab === 'agendamentos' && (
                    <div className="space-y-3">
                      {appointments.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-slate-455 text-xs">
                          Nenhum agendamento ativo ou histórico registrado.
                        </div>
                      ) : (
                        appointments.map(app => {
                          const dateObj = new Date(app.scheduledAt || '');
                          const isValidDate = !isNaN(dateObj.getTime());
                          const dateFormatted = isValidDate 
                            ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                            : '';
                          const timeFormatted = isValidDate
                            ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '';

                          return (
                            <div 
                              key={app.id}
                              className="p-4 border border-slate-100 bg-slate-50/40 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 text-pix font-black">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{dateFormatted} às {timeFormatted}</span>
                                  </div>
                                </div>
                                <div className="text-slate-600 font-semibold">
                                  {app.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  Pedido #{app.orderNumber} • Criado em {new Date(app.dateCreated + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                              <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2">
                                <span className="font-extrabold text-slate-800">
                                  {formatBRL(app.totalAmount)}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                  app.status === 'APROVADO' || app.status === 'VENDA_CONCLUIDA' || app.status === 'PEDIDO_ENTREGUE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : app.status === 'PENDENTE' || app.status === 'REGISTRO_ITENS' || app.status === 'ENTRADA_PEDIDO'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-slate-50 text-slate-650 border border-slate-150'
                                }`}>
                                  {app.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewingClient(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};
export default ClientManager;
