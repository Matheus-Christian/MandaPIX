import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, ShoppingCart, Trash2, Plus, Minus, X, Check, Copy, AlertCircle, CreditCard } from 'lucide-react';
import { formatBRL, routePixPayment } from '../utils/pix';
import type { Store, Catalog, ProductService, SavedPixKey } from '../utils/pix';
import confetti from 'canvas-confetti';

interface StorefrontSimulatorProps {
  store: Store;
  catalogs: Catalog[];
  products: ProductService[];
  onPlaceOrder: (orderData: {
    clientName: string;
    clientDocument: string;
    clientEmail: string;
    clientPhone: string;
    items: Array<{ productServiceId: string; quantity: number }>;
    paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
  }) => Promise<{ 
    orderNumber: string; 
    pixPayload: string; 
    invoiceId: string;
    routedGateway?: string | null;
    transactionFee?: number | null;
  }>;
  onClose: () => void;
  onSimulatePayment: (invoiceId: string) => void;
  routingSettings?: any;
  merchantWallets?: SavedPixKey[];
}

interface CartItem {
  product: ProductService;
  quantity: number;
}

export const StorefrontSimulator: React.FC<StorefrontSimulatorProps> = ({
  store,
  catalogs,
  products,
  onPlaceOrder,
  onClose,
  onSimulatePayment,
  routingSettings,
  merchantWallets
}) => {
  // Navigation & Category Selection
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Checkout Form State
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Card states
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'>('PIX');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  
  // Success / Payment Modal State
  const [checkoutResult, setCheckoutResult] = useState<{
    orderNumber: string;
    pixPayload: string;
    invoiceId: string;
    routedGateway?: string | null;
    transactionFee?: number | null;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPaymentSimulated, setIsPaymentSimulated] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const storeColor = store.color || 'from-blue-600 to-indigo-700';

  // Format Masks
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 11) {
      val = val.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      val = val.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    setDocument(val.substring(0, 18));
    if (formErrors.document) setFormErrors(prev => ({ ...prev, document: '' }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
    setPhone(val.substring(0, 15));
    if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
  };

  // Cart operations
  const addToCart = (product: ProductService) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    // Visual trigger
    confetti({
      particleCount: 15,
      spread: 40,
      origin: { y: 0.8, x: 0.8 }
    });
  };

  const updateQuantity = (productId: string, val: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + val;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Checkout submit
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!name.trim()) errors.name = 'Nome completo é obrigatório';
    if (!document.trim()) errors.document = 'CPF ou CNPJ é obrigatório';
    if (!email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido';
    }
    if (!phone.trim()) errors.phone = 'Telefone é obrigatório';

    if (paymentMethod !== 'PIX') {
      if (cardNumber.replace(/\s/g, '').length !== 16) {
        errors.cardNumber = 'Número do cartão inválido (16 dígitos)';
      }
      if (!cardHolder.trim() || cardHolder.trim().length < 3) {
        errors.cardHolder = 'Nome do titular é obrigatório';
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        errors.cardExpiry = 'Validade inválida (MM/AA)';
      }
      if (cardCvv.length < 3 || cardCvv.length > 4) {
        errors.cardCvv = 'CVV inválido';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsProcessingCheckout(true);
      const items = cart.map(item => ({
        productServiceId: item.product.id,
        quantity: item.quantity
      }));

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, paymentMethod !== 'PIX' ? 1800 : 800));

      const res = await onPlaceOrder({
        clientName: name.trim(),
        clientDocument: document.trim(),
        clientEmail: email.trim(),
        clientPhone: phone.trim(),
        items,
        paymentMethod
      });

      setCheckoutResult(res);

      if (paymentMethod !== 'PIX') {
        // Automatically simulate payment success for card checkouts
        onSimulatePayment(res.invoiceId);
        setIsPaymentSimulated(true);

        // Confetti!
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Toca o som de sucesso
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch {}
      }

      setCart([]);
      setIsCartOpen(false);
      setIsProcessingCheckout(false);
    } catch (err) {
      console.error(err);
      setIsProcessingCheckout(false);
      alert('Erro ao processar o pedido. Tente novamente.');
    }
  };

  // Render QR Code
  useEffect(() => {
    if (checkoutResult && qrCanvasRef.current && paymentMethod === 'PIX') {
      import('qrcode').then((QRCode) => {
        QRCode.toCanvas(
          qrCanvasRef.current!,
          checkoutResult.pixPayload,
          {
            width: 180,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          },
          (err) => {
            if (err) console.error('QR rendering error', err);
          }
        );
      }).catch(err => {
        console.error('Failed to load QR code generator', err);
      });
    }
  }, [checkoutResult, paymentMethod]);

  const copyPix = () => {
    if (!checkoutResult) return;
    navigator.clipboard.writeText(checkoutResult.pixPayload);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const simulateSuccess = () => {
    if (!checkoutResult) return;
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Play sound
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}

    onSimulatePayment(checkoutResult.invoiceId);
    setIsPaymentSimulated(true);
  };

  const getActiveWallet = (method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD') => {
    if (!merchantWallets || merchantWallets.length === 0) return null;
    if (method === 'PIX') {
      return (
        merchantWallets.find(k => k.walletType === 'PIX_AUTO') ||
        merchantWallets.find(k => k.walletType === 'PIX') ||
        merchantWallets.find(k => k.isPrimary) ||
        merchantWallets[0]
      );
    } else {
      return (
        merchantWallets.find(k => k.walletType === method) ||
        merchantWallets.find(k => k.isPrimary) ||
        merchantWallets[0]
      );
    }
  };

  const activeWallet = getActiveWallet(paymentMethod);
  const isPixAuto = activeWallet?.walletType === 'PIX_AUTO';
  const cartTotal = getCartTotal();

  const routeDetails = isPixAuto && paymentMethod === 'PIX'
    ? routePixPayment(cartTotal, routingSettings || {
        threshold: 100,
        below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
        above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
      })
    : null;

  // Filter Catalog & Search
  const filteredProducts = products.filter(p => {
    const matchesCatalog = selectedCatalogId === 'ALL' || p.catalogId === selectedCatalogId;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCatalog && matchesSearch;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col justify-between overflow-hidden animate-fade-in font-sans">
      
      {/* Top Banner Simulator Notice */}
      <div className="bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase py-1 px-4 tracking-widest text-center flex items-center justify-center gap-1.5 shadow-sm">
        <AlertCircle className="w-3.5 h-3.5" /> 
        Você está visualizando o catálogo da loja simulado do ponto de vista do Cliente.
        <button 
          onClick={onClose}
          className="ml-auto underline font-black hover:text-slate-800"
        >
          Voltar ao Painel Admin
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50">
        
        {/* LEFT SIDE: STOREFRONT PRODUCT EXPLORER */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-gradient-to-br ${storeColor} rounded-xl text-white shadow-md`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-slate-800 text-lg">{store.name}</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Catálogo de Vendas Online</p>
              </div>
            </div>

            {/* Actions: Search and Cart Button */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative max-w-[200px] sm:max-w-xs bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <input
                  type="text"
                  placeholder="Buscar itens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-3 pr-8 py-1.5 text-xs bg-transparent text-slate-800 focus:outline-none w-full"
                />
              </div>

              {/* Shopping Cart Trigger */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1 shadow-md"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="text-xs font-bold px-1.5 bg-pix rounded-full">{getCartCount()}</span>
              </button>
            </div>
          </div>

          {/* Navigation Categories */}
          <div className="bg-white border-b border-slate-100 px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
            <button
              onClick={() => setSelectedCatalogId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                selectedCatalogId === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Todos os Itens
            </button>
            {catalogs.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatalogId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all truncate max-w-[150px] ${
                  selectedCatalogId === cat.id
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Catalog Grid Explorer */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center justify-center shadow-xs">
                <ShoppingBag className="w-12 h-12 text-slate-200 mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum item disponível</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  Tente alterar sua categoria ou busca de produtos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm hover:shadow-subtle transition-all flex flex-col justify-between group"
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
                        <span className="font-extrabold text-slate-800 text-sm">{formatBRL(product.price)}</span>
                      </div>
                      
                      <h4 className="font-extrabold text-slate-800 text-sm line-clamp-1">{product.name}</h4>
                      <p className="text-slate-400 text-xs font-semibold line-clamp-2 leading-relaxed min-h-8">
                        {product.description || 'Sem descrição cadastrada.'}
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className="mt-4 w-full bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-[11px] font-bold py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar ao Carrinho
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE / SLIDE-OVER: SHOPPING CART & CHECKOUT FORM */}
        {isCartOpen && (
          <div className="fixed inset-0 lg:relative lg:inset-auto z-40 lg:w-96 bg-white border-l border-slate-100 h-full flex flex-col justify-between shadow-2xl lg:shadow-none animate-slide-up">
            
            {/* Cart Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <ShoppingCart className="w-5 h-5 text-slate-700" /> Meu Carrinho
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar bg-slate-50/40">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <ShoppingCart className="w-10 h-10 text-slate-200" />
                  <p className="font-bold">Seu carrinho está vazio.</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">Adicione produtos ou serviços do catálogo para prosseguir.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Itemized List */}
                  <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-150 p-4 shadow-xs space-y-3">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex justify-between items-center pt-3 first:pt-0">
                        <div className="max-w-[55%]">
                          <h5 className="font-bold text-slate-800 text-xs truncate">{item.product.name}</h5>
                          <span className="text-[10px] font-extrabold text-slate-400">{formatBRL(item.product.price)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-650"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 min-w-[15px] text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-650"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 ml-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Block */}
                  <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-xs space-y-2 text-xs text-slate-800">
                    <div className="flex items-center justify-between font-bold">
                      <span>Subtotal</span>
                      <span>{formatBRL(cartTotal)}</span>
                    </div>
                    {isPixAuto && paymentMethod === 'PIX' && routeDetails && (
                      <div className="flex items-center justify-between text-teal-650 font-semibold">
                        <span>Taxa de Roteamento (PIX Auto - {routeDetails.gateway})</span>
                        <span>{formatBRL(routeDetails.fee)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-black border-t border-slate-100 pt-2 text-sm">
                      <span>TOTAL COMPRADO</span>
                      <span className="text-base text-pix">
                        {formatBRL(isPixAuto && paymentMethod === 'PIX' && routeDetails ? routeDetails.total : cartTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information (Checkout Form) */}
                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Identificação do Cliente</h4>
                    <form onSubmit={handleCheckoutSubmit} className="bg-white rounded-2xl border border-slate-150 p-4 shadow-xs space-y-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                        <input
                          type="text"
                          placeholder="Ex: João da Silva"
                          value={name}
                          onChange={(e) => { setName(e.target.value); if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' })); }}
                          className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.name ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                        />
                        {formErrors.name && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CPF ou CNPJ</label>
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          value={document}
                          onChange={handleDocumentChange}
                          className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none font-mono ${formErrors.document ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                        />
                        {formErrors.document && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.document}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Celular</label>
                          <input
                            type="text"
                            placeholder="(11) 99999-9999"
                            value={phone}
                            onChange={handlePhoneChange}
                            disabled={isProcessingCheckout}
                            className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.phone ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                          />
                          {formErrors.phone && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.phone}</p>}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">E-mail</label>
                          <input
                            type="email"
                            placeholder="joao@dominio.com"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' })); }}
                            disabled={isProcessingCheckout}
                            className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.email ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                          />
                          {formErrors.email && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.email}</p>}
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Forma de Pagamento</label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {(['PIX', 'CREDIT_CARD', 'DEBIT_CARD'] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => { setPaymentMethod(method); setFormErrors({}); }}
                              disabled={isProcessingCheckout}
                              className={`py-2 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-1 transition-all ${
                                paymentMethod === method
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {method === 'PIX' && <span>PIX</span>}
                              {method === 'CREDIT_CARD' && (
                                <>
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Crédito</span>
                                </>
                              )}
                              {method === 'DEBIT_CARD' && (
                                <>
                                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Débito</span>
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Card fields rendering conditionally */}
                      {paymentMethod !== 'PIX' && (
                        <div className="space-y-2.5 border-t border-slate-100 pt-2.5 animate-fade-in text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número do Cartão</label>
                            <input
                              type="text"
                              placeholder="0000 0000 0000 0000"
                              value={cardNumber}
                              onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '').replace(/(\d{4})(\d)/g, '$1 $2').trim();
                                setCardNumber(val.substring(0, 19));
                                setFormErrors(prev => ({ ...prev, cardNumber: '' }));
                              }}
                              disabled={isProcessingCheckout}
                              className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none font-mono ${formErrors.cardNumber ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                            />
                            {formErrors.cardNumber && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.cardNumber}</p>}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Impresso no Cartão</label>
                            <input
                              type="text"
                              placeholder="Ex: JOAO SILVA"
                              value={cardHolder}
                              onChange={(e) => { setCardHolder(e.target.value.toUpperCase()); setFormErrors(prev => ({ ...prev, cardHolder: '' })); }}
                              disabled={isProcessingCheckout}
                              className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.cardHolder ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                            />
                            {formErrors.cardHolder && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.cardHolder}</p>}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Validade</label>
                              <input
                                type="text"
                                placeholder="MM/AA"
                                value={cardExpiry}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                  setCardExpiry(val.substring(0, 5));
                                  setFormErrors(prev => ({ ...prev, cardExpiry: '' }));
                                }}
                                disabled={isProcessingCheckout}
                                className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.cardExpiry ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                              />
                              {formErrors.cardExpiry && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.cardExpiry}</p>}
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CVV</label>
                              <input
                                type="text"
                                placeholder="123"
                                value={cardCvv}
                                onChange={(e) => {
                                  setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 4));
                                  setFormErrors(prev => ({ ...prev, cardCvv: '' }));
                                }}
                                disabled={isProcessingCheckout}
                                className={`w-full px-3 py-1.5 border rounded-xl bg-slate-50 focus:outline-none ${formErrors.cardCvv ? 'border-red-450 ring-1 ring-red-100' : 'border-slate-200'}`}
                              />
                              {formErrors.cardCvv && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{formErrors.cardCvv}</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isProcessingCheckout}
                        className="w-full bg-pix hover:bg-pix-dark disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-1 active:scale-98"
                      >
                        {isProcessingCheckout ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                            <span>Processando...</span>
                          </>
                        ) : (
                          <span>
                            {paymentMethod === 'PIX'
                              ? `Confirmar Pedido & Pagar ${formatBRL(isPixAuto && routeDetails ? routeDetails.total : cartTotal)} no PIX`
                              : `Pagar ${formatBRL(cartTotal)} no ${paymentMethod === 'CREDIT_CARD' ? 'Crédito' : 'Débito'}`}
                          </span>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating cart bubble for desktop/mobile when cart is closed */}
      {!isCartOpen && cart.length > 0 && !checkoutResult && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl transition-all active:scale-95 flex items-center justify-center z-40 border border-slate-800"
        >
          <ShoppingCart className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1.5 -right-1.5 bg-pix text-white font-black text-xs px-2 py-0.5 rounded-full border-2 border-slate-900">
            {getCartCount()}
          </span>
        </button>
      )}
              {/* SUCCESS CHECKOUT MODAL */}
      {checkoutResult && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Check className="w-5 h-5 text-emerald-500 bg-emerald-50 rounded-full p-0.5" /> Pedido Recebido com Sucesso!
              </h3>
              {!isPaymentSimulated && (
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-650 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Número do Pedido</span>
                <p className="font-extrabold text-slate-800 text-base">#{checkoutResult.orderNumber}</p>
              </div>

              {/* Roteamento e Taxa PIX_AUTO no Sucesso */}
              {(checkoutResult as any).routedGateway && (
                <div className="w-full bg-teal-50/50 border border-teal-100/80 rounded-2xl p-3 text-xs text-slate-600 space-y-1.5 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Gateway Roteado</span>
                    <span className="font-bold text-teal-700">{(checkoutResult as any).routedGateway}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Taxa de Processamento</span>
                    <span className="font-bold text-teal-700">{formatBRL((checkoutResult as any).transactionFee || 0)}</span>
                  </div>
                </div>
              )}

              {paymentMethod === 'PIX' ? (
                <>
                  {/* QR Code Canvas */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm relative group">
                    <canvas ref={qrCanvasRef} />
                    {isPaymentSimulated && (
                      <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                        <span className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow flex items-center gap-1 animate-bounce">
                          <Check className="w-4 h-4" /> Pago / Aprovado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    <p className="text-[11px] text-slate-450 font-semibold max-w-[250px] mx-auto leading-relaxed">
                      Escaneie o QR Code acima ou use a chave copia e cola abaixo para finalizar seu pagamento no PIX.
                    </p>

                    {/* Copia e Cola box */}
                    <div className="relative bg-slate-50 p-2.5 rounded-xl border border-slate-250 font-mono text-[9px] text-slate-500 break-all select-all text-left">
                      {checkoutResult.pixPayload.substring(0, 100)}...
                      <button
                        onClick={copyPix}
                        className="absolute right-2 bottom-2 p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-700"
                        title="Copiar Payload"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Simulation triggers */}
                  {!isPaymentSimulated ? (
                    <div className="pt-2 w-full space-y-2">
                      <button
                        onClick={simulateSuccess}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1"
                      >
                        Simular Pagamento (Sucesso)
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full text-slate-400 hover:text-slate-650 text-xs font-bold transition-all py-1.5"
                      >
                        Fechar e Voltar à Loja
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={onClose}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 mt-2"
                    >
                      Voltar ao Painel Administrativo
                    </button>
                  )}
                </>
              ) : (
                /* CARD SUCCESS TRANSACTION RECEIPT */
                <div className="w-full space-y-4 animate-scale-in">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/25 mx-auto">
                    <CreditCard className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2">
                    <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Status do Pedido</span>
                      <span className="font-extrabold text-emerald-600">APROVADO</span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Faturamento</span>
                      <span className="font-extrabold text-emerald-600">PAGO</span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Meio de Pagamento</span>
                      <span className="font-semibold text-slate-700">
                        {paymentMethod === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Cartão de Débito'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Cartão Utilizado</span>
                      <span className="font-mono text-slate-700 font-bold">
                        •••• •••• •••• {cardNumber.slice(-4) || '1234'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Titular</span>
                      <span className="font-semibold text-slate-700 max-w-[150px] truncate uppercase">{cardHolder || name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Data Liquidação</span>
                      <span className="font-semibold text-slate-700">{new Date().toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 mt-2"
                  >
                    Voltar ao Painel Administrativo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StorefrontSimulator;
