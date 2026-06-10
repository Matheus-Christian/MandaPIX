import React, { useState } from 'react';
import { Package, Folder, ArrowLeft, Search, Plus, Trash2, Edit, X, FolderOpen, ArrowRight, ShoppingBag } from 'lucide-react';
import { formatBRL, formatCurrencyInput, parseBRLToNumber } from '../utils/pix';
import type { Catalog, ProductService } from '../utils/pix';

interface CatalogManagerProps {
  catalogs: Catalog[];
  products: ProductService[];
  onAddCatalog: (catalog: Omit<Catalog, 'id'>) => void;
  onEditCatalog: (catalog: Catalog) => void;
  onDeleteCatalog: (id: string) => void;
  onAddProduct: (product: Omit<ProductService, 'id'>) => void;
  onEditProduct: (product: ProductService) => void;
  onDeleteProduct: (id: string) => void;
  onSimulateStorefront?: () => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  catalogs,
  products,
  onAddCatalog,
  onEditCatalog,
  onDeleteCatalog,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSimulateStorefront,
}) => {
  // Navigation level state
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  
  // Search state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Catalog Form Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [catalogErrors, setCatalogErrors] = useState<{ [key: string]: string }>({});

  // Product Form Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState<'PRODUTO' | 'SERVICO'>('SERVICO');
  const [productPriceRaw, setProductPriceRaw] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productErrors, setProductErrors] = useState<{ [key: string]: string }>({});

  // Get current catalog object
  const activeCatalog = catalogs.find(c => c.id === selectedCatalogId);

  // --- CATALOG CRUD ACTIONS ---
  const openNewCatalog = () => {
    setEditingCatalog(null);
    setCatalogName('');
    setCatalogDescription('');
    setCatalogErrors({});
    setIsCatalogModalOpen(true);
  };

  const openEditCatalog = (e: React.MouseEvent, cat: Catalog) => {
    e.stopPropagation(); // Avoid entering catalog detail view
    setEditingCatalog(cat);
    setCatalogName(cat.name);
    setCatalogDescription(cat.description);
    setCatalogErrors({});
    setIsCatalogModalOpen(true);
  };

  const handleCatalogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!catalogName.trim()) {
      newErrors.name = 'Nome do catálogo é obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setCatalogErrors(newErrors);
      return;
    }

    if (editingCatalog) {
      onEditCatalog({
        id: editingCatalog.id,
        name: catalogName.trim(),
        description: catalogDescription.trim(),
      });
    } else {
      onAddCatalog({
        name: catalogName.trim(),
        description: catalogDescription.trim(),
      });
    }

    setIsCatalogModalOpen(false);
    setEditingCatalog(null);
    setCatalogName('');
    setCatalogDescription('');
    setCatalogErrors({});
  };

  const handleCatalogDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    const childProductsCount = products.filter(p => p.catalogId === id).length;
    let msg = `Deseja realmente remover o catálogo "${name}"?`;
    if (childProductsCount > 0) {
      msg = `ATENÇÃO: O catálogo "${name}" contém ${childProductsCount} produto(s)/serviço(s) cadastrados. Se você excluí-lo, todos os seus produtos vinculados também serão removidos permanentemente. Deseja prosseguir?`;
    }
    if (confirm(msg)) {
      onDeleteCatalog(id);
    }
  };

  // --- PRODUCT CRUD ACTIONS ---
  const openNewProduct = () => {
    setEditingProduct(null);
    setProductName('');
    setProductType('SERVICO');
    setProductPriceRaw('');
    setProductDescription('');
    setProductErrors({});
    setIsProductModalOpen(true);
  };

  const openEditProduct = (prod: ProductService) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductType(prod.type);
    setProductPriceRaw(prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setProductDescription(prod.description);
    setProductErrors({});
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogId) return;

    const newErrors: { [key: string]: string } = {};
    if (!productName.trim()) newErrors.name = 'Nome do item é obrigatório';
    
    if (!productPriceRaw.trim()) {
      newErrors.price = 'Preço sugerido é obrigatório';
    } else {
      const priceVal = parseBRLToNumber(productPriceRaw);
      if (priceVal <= 0) newErrors.price = 'Preço deve ser maior que R$ 0,00';
    }

    if (Object.keys(newErrors).length > 0) {
      setProductErrors(newErrors);
      return;
    }

    const price = parseBRLToNumber(productPriceRaw);

    if (editingProduct) {
      onEditProduct({
        id: editingProduct.id,
        catalogId: selectedCatalogId,
        name: productName.trim(),
        type: productType,
        price,
        description: productDescription.trim(),
      });
    } else {
      onAddProduct({
        catalogId: selectedCatalogId,
        name: productName.trim(),
        type: productType,
        price,
        description: productDescription.trim(),
      });
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductName('');
    setProductPriceRaw('');
    setProductDescription('');
    setProductErrors({});
  };

  const handleProductDelete = (id: string, name: string) => {
    if (confirm(`Deseja realmente remover o item "${name}"? Faturamentos já gerados não serão afetados.`)) {
      onDeleteProduct(id);
    }
  };

  const handleProductCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCurrencyInput(rawVal);
    setProductPriceRaw(formatted);
    if (productErrors.price) setProductErrors(prev => ({ ...prev, price: '' }));
  };

  // Filter Catalog lists
  const filteredCatalogs = catalogs.filter(c =>
    c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // Filter Products of active Catalog
  const filteredProducts = products.filter(p =>
    p.catalogId === selectedCatalogId &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.description.toLowerCase().includes(productSearch.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* ----------------- LEVEL 1: CATALOGS LIST VIEW ----------------- */}
      {!selectedCatalogId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Folder className="w-6 h-6 text-pix" /> Meus Catálogos
              </h2>
              <p className="text-xs text-slate-500 mt-1">Organize seus produtos e serviços em catálogos separados</p>
            </div>
            <button
              onClick={openNewCatalog}
              className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Novo Catálogo
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Search Bar */}
            <div className="relative max-w-md bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar catálogos..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none"
              />
            </div>

            {/* Catalogs Grid */}
            {filteredCatalogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center">
                <Folder className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm font-sans">Nenhum catálogo encontrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  {catalogSearch ? 'Nenhum resultado corresponde à sua busca.' : 'Crie catálogos para agrupar seus produtos ou serviços por categoria.'}
                </p>
                {!catalogSearch && (
                  <button
                    onClick={openNewCatalog}
                    className="mt-4 bg-pix/10 hover:bg-pix/20 text-pix font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Criar Catálogo
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCatalogs.map((catalog) => {
                  const itemsCount = products.filter(p => p.catalogId === catalog.id).length;
                  return (
                    <div
                      key={catalog.id}
                      onClick={() => setSelectedCatalogId(catalog.id)}
                      className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm flex flex-col justify-between transition-all cursor-pointer hover:shadow-subtle group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" /> {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => openEditCatalog(e, catalog)}
                              className="p-1 rounded bg-slate-50 hover:bg-pix-light text-slate-400 hover:text-pix border border-slate-100 hover:border-pix/10 transition-all active:scale-90"
                              title="Editar Catálogo"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleCatalogDelete(e, catalog.id, catalog.name)}
                              className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                              title="Remover Catálogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-slate-800 text-base line-clamp-1 flex items-center gap-1.5">
                          <FolderOpen className="w-4 h-4 text-pix/80" /> {catalog.name}
                        </h4>
                        <p className="text-slate-400 text-xs font-semibold line-clamp-2 min-h-8">
                          {catalog.description || 'Sem descrição cadastrada'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-pix font-bold text-xs group-hover:text-pix-dark">
                        <span>Ver produtos e serviços</span>
                        <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        
        /* ----------------- LEVEL 2: DETAILED CATALOG VIEW (PRODUCTS LIST) ----------------- */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCatalogId(null)}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 border border-slate-100 transition-all"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Catálogo Selecionado</span>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-1.5 uppercase mt-0.5">
                  <FolderOpen className="w-5 h-5 text-pix" /> {activeCatalog?.name}
                </h2>
              </div>
            </div>
            <button
              onClick={openNewProduct}
              className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Novo Item neste Catálogo
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Catalog Info block */}
            {activeCatalog?.description && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-xs font-medium text-slate-500 leading-relaxed italic">
                "{activeCatalog.description}"
              </div>
            )}

            {/* Search Bar */}
            <div className="relative max-w-md bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar itens dentro deste catálogo..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent text-slate-800 focus:outline-none"
              />
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center">
                <Package className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Catálogo Vazio</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  {productSearch ? 'Nenhum resultado corresponde à sua busca.' : 'Cadastre produtos e serviços específicos dentro deste catálogo.'}
                </p>
                {!productSearch && (
                  <button
                    onClick={openNewProduct}
                    className="mt-4 bg-pix/10 hover:bg-pix/20 text-pix font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Item
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm flex flex-col justify-between transition-all group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          product.type === 'SERVICO'
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}>
                          {product.type === 'SERVICO' ? 'Serviço' : 'Produto'}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditProduct(product)}
                            className="p-1 rounded bg-slate-50 hover:bg-pix-light text-slate-400 hover:text-pix border border-slate-100 hover:border-pix/10 transition-all active:scale-90"
                            title="Editar Item"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleProductDelete(product.id, product.name)}
                            className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                            title="Remover Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-extrabold text-slate-800 text-base line-clamp-1">{product.name}</h4>
                      <p className="text-slate-400 text-xs font-semibold line-clamp-2 min-h-8 leading-relaxed">
                        {product.description || 'Sem descrição cadastrada'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Sugerido</span>
                      <span className="font-extrabold text-slate-800 text-base">{formatBRL(product.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- MODAL: CATALOG FORM (ADD / EDIT) ----------------- */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <Folder className="w-5 h-5 text-pix" /> {editingCatalog ? 'Editar Catálogo' : 'Novo Catálogo'}
              </h3>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCatalogSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome do Catálogo</label>
                <input
                  type="text"
                  placeholder="Ex: Cosméticos, Serviços Digitais, Consultoria"
                  value={catalogName}
                  onChange={(e) => { setCatalogName(e.target.value); if (catalogErrors.name) setCatalogErrors(prev => ({ ...prev, name: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${catalogErrors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {catalogErrors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{catalogErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição Breve (Opcional)</label>
                <textarea
                  placeholder="Descreva a categoria dos produtos contidos neste catálogo..."
                  rows={3}
                  value={catalogDescription}
                  onChange={(e) => setCatalogDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-pix/10 text-sm"
                >
                  Salvar Catálogo
                </button>
                {onSimulateStorefront && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatalogModalOpen(false);
                      onSimulateStorefront();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4" /> Simular Catálogo Online (Cliente)
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: PRODUCT/SERVICE FORM (ADD / EDIT IN CATALOG) ----------------- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <Package className="w-5 h-5 text-pix" /> {editingProduct ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome do Item</label>
                  <input
                    type="text"
                    placeholder="Ex: Consultoria Técnica, Batom Hidratante"
                    value={productName}
                    onChange={(e) => { setProductName(e.target.value); if (productErrors.name) setProductErrors(prev => ({ ...prev, name: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${productErrors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {productErrors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{productErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tipo</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'PRODUTO' | 'SERVICO')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white font-semibold"
                  >
                    <option value="SERVICO">Serviço</option>
                    <option value="PRODUTO">Produto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Preço Sugerido (Valor Base)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={productPriceRaw}
                    onChange={handleProductCurrencyChange}
                    className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-bold ${productErrors.price ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                </div>
                {productErrors.price && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{productErrors.price}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição Breve (Opcional)</label>
                <textarea
                  placeholder="Escreva detalhes técnicos ou características do produto/serviço..."
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-pix hover:bg-pix-dark text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-pix/10 text-sm"
                >
                  Salvar Item no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default CatalogManager;
