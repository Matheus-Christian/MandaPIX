import React, { useState, useMemo } from 'react';
import { Package, Search, AlertTriangle, Plus, Minus, Check, ArrowRight } from 'lucide-react';
import type { ProductService, Catalog } from '../utils/pix';

interface StockManagerProps {
  products: ProductService[];
  catalogs: Catalog[];
  onEditProduct: (product: ProductService) => Promise<void>;
}

export const StockManager: React.FC<StockManagerProps> = ({
  products,
  catalogs,
  onEditProduct,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PRODUTO' | 'SERVICO'>('ALL');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<string>('');

  const getCatalogName = (catalogId: string) => {
    return catalogs.find(c => c.id === catalogId)?.name || 'Sem catálogo';
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            p.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'ALL' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [products, search, filterType]);

  const handleQuickAdjust = async (product: ProductService, delta: number) => {
    const currentStock = product.stock_quantity ?? 10;
    const newStock = Math.max(0, currentStock + delta);
    await onEditProduct({
      ...product,
      stock_quantity: newStock,
    });
  };

  const handleSaveDirectStock = async (product: ProductService) => {
    const val = parseInt(tempStock);
    if (!isNaN(val) && val >= 0) {
      await onEditProduct({
        ...product,
        stock_quantity: val,
      });
    }
    setAdjustingId(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-pix" /> Controle de Estoque e Insumos
          </h2>
          <p className="text-xs text-slate-500 mt-1">Gerencie a quantidade física de produtos e as regras de consumo de insumos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between flex-shrink-0">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produtos/serviços..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pix/50 text-slate-800"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {(['ALL', 'PRODUTO', 'SERVICO'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                filterType === t
                  ? 'bg-pix border-pix text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t === 'ALL' ? 'Todos' : t === 'PRODUTO' ? 'Produtos' : 'Serviços'}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-center">Qtd. Estoque</th>
                <th className="py-3 px-4">Ficha Técnica (Consumo)</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isService = p.type === 'SERVICO';
                  const stock = p.stock_quantity ?? 0;
                  const isLow = !isService && stock <= 5;
                  const isOut = !isService && stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{p.description || 'Sem descrição'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-500">
                        {getCatalogName(p.catalogId)}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isService ? 'bg-indigo-50 text-indigo-655' : 'bg-emerald-50 text-emerald-655'
                        }`}>
                          {isService ? 'Serviço' : 'Produto'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isService ? (
                          <span className="text-slate-400 italic font-mono">-</span>
                        ) : adjustingId === p.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={tempStock}
                              onChange={(e) => setTempStock(e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-pix font-bold text-xs"
                            />
                            <button
                              onClick={() => handleSaveDirectStock(p)}
                              className="p-1 bg-pix text-white rounded hover:bg-pix-dark transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setAdjustingId(p.id);
                              setTempStock(stock.toString());
                            }}
                            className="cursor-pointer inline-flex items-center justify-center gap-1.5"
                          >
                            <span className={`font-bold font-mono text-sm ${
                              isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-700'
                            }`}>
                              {stock}
                            </span>
                            {isOut ? (
                              <span className="bg-red-50 text-red-500 border border-red-100 rounded px-1 text-[8px] font-bold uppercase">Esgotado</span>
                            ) : isLow ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {p.insumos && p.insumos.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {p.insumos.map((ins, idx) => {
                              const insItem = products.find(prod => prod.id === ins.product_id);
                              return (
                                <div key={idx} className="flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span>{ins.quantity}x</span>
                                  <span className="underline">{insItem?.name || 'Insumo Excluído'}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">Consumo nulo</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {!isService ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                            <button
                              onClick={() => handleQuickAdjust(p, -1)}
                              className="p-1 text-slate-500 hover:text-slate-750 hover:bg-white rounded transition-all active:scale-90"
                              title="Remover 1 do Estoque"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleQuickAdjust(p, 1)}
                              className="p-1 text-slate-500 hover:text-slate-750 hover:bg-white rounded transition-all active:scale-90"
                              title="Adicionar 1 ao Estoque"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Apenas insumos</span>
                        )}
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
  );
};
