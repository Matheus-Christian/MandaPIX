import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Tag, Trash2, Plus, CheckCircle, Clock } from 'lucide-react';
import type { Order } from '../utils/pix';

interface Expense {
  id: string;
  storeId: string;
  category: 'Aluguel' | 'Luz' | 'Insumos' | 'Salários' | 'Outros';
  description: string;
  amount: number;
  dueDate: string;
  status: 'PENDENTE' | 'PAGO';
}

interface CashFlowManagerProps {
  storeId: string;
  orders: Order[];
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  onPayExpense: (id: string, status: 'PENDENTE' | 'PAGO') => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export const CashFlowManager: React.FC<CashFlowManagerProps> = ({
  storeId,
  orders,
  expenses,
  onAddExpense,
  onPayExpense,
  onDeleteExpense,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState<'Aluguel' | 'Luz' | 'Insumos' | 'Salários' | 'Outros'>('Outros');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const parseBRLToNumber = (val: string): number => {
    const clean = val.replace(/\D/g, '');
    return clean ? parseFloat(clean) / 100 : 0;
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setAmountRaw('');
      return;
    }
    const num = parseFloat(val) / 100;
    setAmountRaw(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
  };

  // Computations
  const totalRevenue = useMemo(() => {
    // Sum of orders with confirmed PIX or completed status
    const confirmedOrders = orders.filter(o => 
      ['PIX Confirmado', 'VENDA_CONCLUIDA', 'DIVISAO_COMISSAO', 'APROVADO'].includes(o.status)
    );
    return confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const totalExpenses = useMemo(() => {
    const paidExpenses = expenses.filter(e => e.status === 'PAGO');
    return paidExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const netProfit = totalRevenue - totalExpenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {} as any;
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    
    const amountVal = parseBRLToNumber(amountRaw);
    if (amountVal <= 0) newErrors.amount = 'Valor deve ser maior que R$ 0,00';
    if (!dueDate) newErrors.dueDate = 'Data de vencimento é obrigatória';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onAddExpense({
      storeId,
      description: description.trim(),
      amount: amountVal,
      category,
      dueDate,
      status: 'PENDENTE',
    });

    setDescription('');
    setAmountRaw('');
    setCategory('Outros');
    setDueDate('');
    setIsAdding(false);
  };

  // Chart data
  const chartHeight = 100;
  const revenueBarHeight = totalRevenue > 0 || totalExpenses > 0 ? (totalRevenue / Math.max(totalRevenue, totalExpenses)) * chartHeight : 0;
  const expenseBarHeight = totalRevenue > 0 || totalExpenses > 0 ? (totalExpenses / Math.max(totalRevenue, totalExpenses)) * chartHeight : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-pix" /> Fluxo de Caixa & Despesas
          </h2>
          <p className="text-xs text-slate-500 mt-1">Acompanhe suas receitas, cadastre despesas e visualize a lucratividade líquida</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Cadastrar Despesa
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profitability Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entradas (Confirmadas)</span>
              <span className="text-2xl font-black text-emerald-650 font-mono">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saídas (Despesas Pagas)</span>
              <span className="text-2xl font-black text-red-550 font-mono">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className={`bg-white border p-5 rounded-2xl shadow-sm flex items-center justify-between transition-all ${
            netProfit >= 0 ? 'border-emerald-100 bg-emerald-50/10' : 'border-red-100 bg-red-50/10'
          }`}>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lucro Líquido</span>
              <span className={`text-2xl font-black font-mono ${
                netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}>
                R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
              netProfit >= 0 ? 'bg-emerald-100 text-emerald-650' : 'bg-red-100 text-red-500'
            }`}>
              <TrendingUp className={`w-6 h-6 ${netProfit < 0 ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Add Expense Form */}
        {isAdding && (
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-md max-w-lg mx-auto animate-fade-in">
            <h3 className="font-extrabold text-slate-800 text-sm mb-4">Nova Despesa / Contas a Pagar</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel da Sala Comercial"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(prev => ({ ...prev, description: '' })); }}
                  className={`w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pix/50 text-slate-800 ${errors.description ? 'border-red-400' : 'border-slate-200'}`}
                />
                {errors.description && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={amountRaw}
                      onChange={handleCurrencyChange}
                      className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pix/50 text-slate-800 font-bold ${errors.amount ? 'border-red-400' : 'border-slate-200'}`}
                    />
                  </div>
                  {errors.amount && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{errors.amount}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); if (errors.dueDate) setErrors(prev => ({ ...prev, dueDate: '' })); }}
                    className={`w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pix/50 text-slate-800 ${errors.dueDate ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {errors.dueDate && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{errors.dueDate}</p>}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 font-bold"
                >
                  <option value="Aluguel">Aluguel / Condomínio</option>
                  <option value="Luz">Luz / Água / Internet</option>
                  <option value="Insumos">Compra de Insumos / Produtos</option>
                  <option value="Salários">Salários & Folha</option>
                  <option value="Outros">Outras Despesas</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lucratividade Chart & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm mb-1">Entradas vs. Saídas</h3>
              <p className="text-[10px] text-slate-400">Comparação proporcional de receitas e despesas quitadas</p>
            </div>
            
            <div className="flex justify-center items-end h-32 gap-8 my-4">
              {/* Revenue Bar */}
              <div className="flex flex-col items-center">
                <div
                  style={{ height: `${Math.max(4, revenueBarHeight)}px` }}
                  className="w-12 bg-emerald-500 rounded-t-lg shadow-sm"
                />
                <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wide">Receitas</span>
                <span className="text-[10px] font-bold text-slate-700 font-mono">
                  R$ {totalRevenue.toFixed(0)}
                </span>
              </div>

              {/* Expense Bar */}
              <div className="flex flex-col items-center">
                <div
                  style={{ height: `${Math.max(4, expenseBarHeight)}px` }}
                  className="w-12 bg-red-500 rounded-t-lg shadow-sm"
                />
                <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wide">Despesas</span>
                <span className="text-[10px] font-bold text-slate-700 font-mono">
                  R$ {totalExpenses.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center font-medium bg-slate-50 p-2 rounded-xl">
              Taxa de Lucratividade: <span className="font-bold text-slate-700 font-mono">{totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%</span>
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm">Contas a Pagar (Despesas)</h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-bold">
                {expenses.length} cadastradas
              </span>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Categoria</th>
                    <th className="py-2.5 px-4">Vencimento</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        Nenhuma despesa cadastrada. Clique em "Cadastrar Despesa".
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => {
                      const isPaid = e.status === 'PAGO';
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{e.description}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <Tag className="w-3 h-3 text-slate-400" />
                              {e.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px]">{e.dueDate.split('-').reverse().join('/')}</td>
                          <td className="py-3 px-4 text-right font-bold font-mono">
                            R$ {e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => onPayExpense(e.id, isPaid ? 'PENDENTE' : 'PAGO')}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all flex items-center gap-1 mx-auto ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-650 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-650 hover:bg-amber-100'
                              }`}
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                                  Pago
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  Pendente
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a despesa "${e.description}"?`)) {
                                  onDeleteExpense(e.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                              title="Excluir Despesa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
