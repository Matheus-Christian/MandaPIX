import React, { useState } from 'react';
import { ShieldAlert, Search, Plus, Trash2, X, Edit, Eye, EyeOff } from 'lucide-react';
import type { Employee } from '../utils/pix';

interface EmployeeManagerProps {
  employees: Employee[];
  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
}) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'GERENTE' | 'VENDEDOR' | 'ATENDENTE'>('VENDEDOR');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [allowWallets, setAllowWallets] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const startEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone);
    setRole(emp.role);
    setAccessCode(emp.accessCode);
    setAllowWallets(emp.allowWallets || false);
    setIsAdding(true);
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingEmployee(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('VENDEDOR');
    setAccessCode('');
    setAllowWallets(false);
    setErrors({});
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
    if (!email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }
    if (!phone.trim()) newErrors.phone = 'Telefone é obrigatório';
    if (!accessCode.trim()) {
      newErrors.accessCode = 'Código de acesso é obrigatório';
    } else if (accessCode.trim().length < 4) {
      newErrors.accessCode = 'Código de acesso deve ter pelo menos 4 dígitos';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingEmployee) {
      onEditEmployee({
        id: editingEmployee.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        accessCode: accessCode.trim(),
        allowWallets: allowWallets,
      });
    } else {
      onAddEmployee({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        accessCode: accessCode.trim(),
        allowWallets: allowWallets,
      });
    }

    // Reset Form
    setName('');
    setEmail('');
    setPhone('');
    setRole('VENDEDOR');
    setAccessCode('');
    setAllowWallets(false);
    setEditingEmployee(null);
    setErrors({});
    setIsAdding(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza de que deseja excluir o funcionário "${name}"? Ele perderá o acesso à loja.`)) {
      onDeleteEmployee(id);
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-pix" /> Funcionários & Acessos
          </h2>
          <p className="text-xs text-slate-500 mt-1">Crie perfis de acesso restritos para a sua equipe</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Cadastrar Funcionário
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isAdding ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingEmployee ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Ex: João Souza"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cargo / Função</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-805 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                  >
                    <option value="GERENTE">Gerente (Acesso Administrativo)</option>
                    <option value="VENDEDOR">Vendedor (PDV, Pedidos, Agenda)</option>
                    <option value="ATENDENTE">Atendente (Pedidos, Agenda)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">E-mail de Login</label>
                  <input
                    type="email"
                    placeholder="joao@empresa.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.email ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.email && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefone</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Código de Acesso (PIN/Senha)</label>
                <div className="relative">
                  <input
                    type={showAccessCode ? 'text' : 'password'}
                    placeholder="Mínimo 4 caracteres (Ex: 1234)"
                    value={accessCode}
                    onChange={(e) => { setAccessCode(e.target.value); if (errors.accessCode) setErrors(prev => ({ ...prev, accessCode: '' })); }}
                    className={`w-full px-3 py-2 pr-12 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-mono ${errors.accessCode ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-455 hover:text-slate-600"
                  >
                    {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.accessCode && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.accessCode}</p>}
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Este código será solicitado quando o funcionário selecionar seu perfil para acessar o PDV ou Pedidos da loja.</p>
              </div>

              <div className="flex items-center gap-2.5 py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="allowWallets"
                  checked={allowWallets}
                  onChange={(e) => setAllowWallets(e.target.checked)}
                  className="w-4 h-4 text-pix border-slate-300 rounded focus:ring-pix/50 focus:outline-none cursor-pointer"
                />
                <label htmlFor="allowWallets" className="text-xs font-bold text-slate-600 uppercase tracking-wide cursor-pointer select-none">
                  Permitir acesso ao painel de Carteiras
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-pix/10 active:scale-98 text-sm"
                >
                  Salvar Perfil
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
                placeholder="Buscar funcionários..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none focus:bg-white transition-all"
              />
            </div>

            {/* List */}
            {filteredEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center">
                <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum funcionário cadastrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
                  {search ? 'Nenhum resultado corresponde à sua busca.' : 'Cadastre sua equipe para restringir acessos e registrar vendas por colaborador.'}
                </p>
                {!search && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="mt-4 bg-pix/10 hover:bg-pix/20 text-pix font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 pl-6">Nome</th>
                        <th className="p-4">Cargo</th>
                        <th className="p-4">Contato</th>
                        <th className="p-4">Código / PIN</th>
                        <th className="p-4">Acesso Carteiras</th>
                        <th className="p-4 text-right pr-6">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-pix/10 text-pix flex items-center justify-center font-bold text-xs uppercase">
                                {emp.name.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block text-sm">{emp.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              emp.role === 'GERENTE' 
                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                : emp.role === 'VENDEDOR'
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-slate-50 text-slate-600 border-slate-150'
                            }`}>
                              {emp.role}
                            </span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="text-slate-700 block font-medium">{emp.email}</span>
                            <span className="text-slate-400 block font-semibold text-[10px]">{emp.phone}</span>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-655">
                            •••• (PIN Oculto)
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              emp.allowWallets 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {emp.allowWallets ? 'Permitido' : 'Bloqueado'}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6 space-x-1.5 flex items-center justify-end">
                            <button
                              onClick={() => startEditEmployee(emp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pix hover:bg-pix-light border border-transparent hover:border-pix/10 transition-all active:scale-90"
                              title="Editar Perfil"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-90"
                              title="Excluir Perfil"
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
    </div>
  );
};
export default EmployeeManager;
