import React, { useState, useRef } from 'react';
import { Package, Folder, ArrowLeft, Search, Plus, Trash2, Edit, X, FolderOpen, ArrowRight } from 'lucide-react';
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
  productCardSize?: 'small' | 'medium' | 'large';
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
  productCardSize = 'medium',
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
  const [productImage, setProductImage] = useState<string | undefined>(undefined);

  // Cropper states
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const actualZoom = zoom >= 1 ? zoom : 1 / (2 - zoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropperImageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - offset.x,
      y: e.touches[0].clientY - offset.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleImageUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropperSrc(event.target.result as string);
          setZoom(1);
          setOffset({ x: 0, y: 0 });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropConfirm = () => {
    if (!cropperSrc || !cropperImageRef.current) return;
    const img = cropperImageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1080, 1080);

      const screenHeight = 256;
      const screenWidth = 256 * (img.naturalWidth / img.naturalHeight);
      const scaleFactor = 1080 / 208; // 208px is the cutout view inside the 256x256 container minus 24px borders
      
      const cW = screenWidth * actualZoom * scaleFactor;
      const cH = screenHeight * actualZoom * scaleFactor;
      const cX = 540 + offset.x * scaleFactor;
      const cY = 540 + offset.y * scaleFactor;
      
      ctx.drawImage(img, cX - cW / 2, cY - cH / 2, cW, cH);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      setProductImage(croppedBase64);
      setCropperSrc(null);
    }
  };

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
    setProductImage(undefined);
    setProductErrors({});
    setIsProductModalOpen(true);
  };

  const openEditProduct = (prod: ProductService) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductType(prod.type);
    setProductPriceRaw(prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setProductDescription(prod.description);
    setProductImage(prod.image);
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
        image: productImage,
      });
    } else {
      onAddProduct({
        catalogId: selectedCatalogId,
        name: productName.trim(),
        type: productType,
        price,
        description: productDescription.trim(),
        image: productImage,
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
               <div className={
                productCardSize === 'small' 
                  ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4' 
                  : productCardSize === 'large' 
                  ? 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6' 
                  : 'grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-5'
              }>
                {filteredProducts.map((product) => {
                  const cardPadding = productCardSize === 'small' ? 'p-2.5' : productCardSize === 'large' ? 'p-4' : 'p-3.5';
                  const cardHeight = productCardSize === 'small' ? 'h-[150px]' : productCardSize === 'large' ? 'h-[190px]' : 'h-[170px]';
                  const imgSize = productCardSize === 'small' ? 'w-20 h-20 min-w-[80px]' : productCardSize === 'large' ? 'w-28 h-28 min-w-[112px]' : 'w-24 h-24 min-w-[96px]';
                  const titleSize = productCardSize === 'small' ? 'text-xs' : productCardSize === 'large' ? 'text-base' : 'text-sm';
                  const descSize = productCardSize === 'small' ? 'text-[10px]' : productCardSize === 'large' ? 'text-xs' : 'text-[11px]';
                  const priceSize = productCardSize === 'small' ? 'text-xs' : productCardSize === 'large' ? 'text-base' : 'text-sm';
                  const iconSize = productCardSize === 'small' ? 'w-6 h-6' : productCardSize === 'large' ? 'w-10 h-10' : 'w-8 h-8';

                  return (
                    <div
                      key={product.id}
                      className={`bg-white ${cardPadding} ${cardHeight} rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm flex flex-row items-center gap-3.5 group`}
                    >
                      {/* Square Image next to info */}
                      <div className={`${imgSize} aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center`}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className={`${iconSize} text-slate-300`} />
                        )}
                      </div>

                      {/* Product Info & Actions column */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase border ${
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
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleProductDelete(product.id, product.name)}
                                className="p-1 rounded bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                                title="Remover Item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <h4 className={`font-extrabold text-slate-800 ${titleSize} truncate`} title={product.name}>{product.name}</h4>
                          <p className={`text-slate-455 ${descSize} font-semibold line-clamp-2 leading-relaxed`}>
                            {product.description || 'Sem descrição cadastrada'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 mt-1.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Valor Sugerido</span>
                          <span className={`font-extrabold text-slate-800 ${priceSize}`}>{formatBRL(product.price)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Foto do Item (Opcional)</label>
                <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {productImage ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm flex-shrink-0">
                      <img src={productImage} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProductImage(undefined)}
                        className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        title="Remover Foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-slate-350 flex items-center justify-center text-slate-400 bg-white flex-shrink-0">
                      <Plus className="w-5 h-5 text-slate-300" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUploadChange}
                      className="hidden"
                      id="product-image-upload"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-[10px] uppercase tracking-wide font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-all active:scale-95 shadow-sm"
                    >
                      Selecionar Foto
                    </label>
                    <p className="text-[9px] text-slate-400 leading-normal font-semibold">
                      Enquadramento recomendado: quadrado (1:1, ex: 1080x1080px).
                    </p>
                  </div>
                </div>
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

      {/* ----------------- MODAL: CUSTOM IMAGE CROPPER ----------------- */}
      {cropperSrc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-150 shadow-2xl flex flex-col p-5 space-y-4 animate-scale-in">
            
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">Enquadrar Imagem</h4>
              <button
                type="button"
                onClick={() => setCropperSrc(null)}
                className="text-slate-400 hover:text-slate-650 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Arraste a imagem para reposicionar e use a barra abaixo para ajustar o zoom. A área central clara representa o enquadramento final quadrado (1:1, corte final de 1080x1080px).
            </p>

            {/* Cropping box frame */}
            <div 
              className="w-64 h-64 relative overflow-hidden bg-slate-900 border border-slate-200 rounded-2xl mx-auto cursor-move select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={cropperSrc}
                alt="Upload a recortar"
                draggable="false"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${actualZoom})`,
                  transformOrigin: 'center',
                  maxHeight: 'none',
                  maxWidth: 'none',
                  width: 'auto',
                  height: '100%',
                  pointerEvents: 'none'
                }}
                ref={cropperImageRef}
              />
              
              {/* Overlay borders forming a square cutout */}
              <div className="absolute inset-0 border-[24px] border-slate-950/60 pointer-events-none">
                <div className="w-full h-full border border-white/40" />
              </div>
            </div>

            {/* Slider zoom */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-450 uppercase tracking-wider">
                <span>Ampliar Imagem</span>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="-2"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-pix focus:outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => setCropperSrc(null)}
                className="flex-1 bg-slate-50 hover:bg-slate-150 text-slate-700 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="flex-1 bg-pix hover:bg-pix-dark text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-pix/10"
              >
                Cortar e Salvar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
export default CatalogManager;
