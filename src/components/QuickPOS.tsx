import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  CheckCircle, 
  Smartphone, 
  AlertCircle, 
  User, 
  Barcode,
  QrCode
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { ProductService, Client, Order, SavedPixKey } from '../utils/pix';
import { formatBRL, generatePixPayload } from '../utils/pix';

interface QuickPOSProps {
  storeId: string;
  products: ProductService[];
  clients: Client[];
  activeWallet: SavedPixKey | null;
  onOrderCreated: (order: Order) => void;
  onRefreshProducts: () => void;
}

interface CartItem {
  product: ProductService;
  quantity: number;
}

export const QuickPOS: React.FC<QuickPOSProps> = ({
  storeId,
  products,
  clients,
  activeWallet,
  onOrderCreated,
  onRefreshProducts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [anonymousName, setAnonymousName] = useState('');
  const [anonymousPhone, setAnonymousPhone] = useState('');
  
  // Checkout & Payment State
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'payment' | 'receipt'>('cart');
  const [pixPayload, setPixPayload] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  
  // Barcode Beep simulation effect
  const [isBeeping, setIsBeeping] = useState(false);
  const [beepMessage, setBeepMessage] = useState('');

  // Timer reference for PIX
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter products to only PRODUTO type and match search
  const availableProducts = products.filter(p => 
    p.type === 'PRODUTO' && 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Countdowns
  useEffect(() => {
    if (checkoutStep === 'payment' && countdown > 0 && !paymentApproved) {
      timerRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && checkoutStep === 'payment' && !paymentApproved) {
      // Regenerate payload or timeout
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown, checkoutStep, paymentApproved]);

  const addToCart = (product: ProductService) => {
    const stockLimit = product.stock_quantity ?? 10;
    const existing = cart.find(item => item.product.id === product.id);
    
    if (existing) {
      if (existing.quantity >= stockLimit) {
        alert(`Atenção: Apenas ${stockLimit} unidades disponíveis em estoque para o produto "${product.name}".`);
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (stockLimit <= 0) {
        alert(`Atenção: Produto "${product.name}" esgotado no estoque.`);
        return;
      }
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const existing = cart.find(item => item.product.id === productId);
    if (!existing) return;

    const newQty = existing.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const stockLimit = existing.product.stock_quantity ?? 10;
    if (newQty > stockLimit) {
      alert(`Quantidade limite em estoque (${stockLimit}) atingida.`);
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQty }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  // Simulate Barcode Biper
  const triggerBarcodeBeep = () => {
    if (products.length === 0) return;
    
    const physicalProducts = products.filter(p => p.type === 'PRODUTO');
    if (physicalProducts.length === 0) {
      alert('Nenhum produto físico disponível para bipe.');
      return;
    }

    // Select random product
    const randomProduct = physicalProducts[Math.floor(Math.random() * physicalProducts.length)];
    
    setIsBeeping(true);
    setBeepMessage(`BIP! Código lido: ${randomProduct.name}`);
    addToCart(randomProduct);

    // Audio cue fallback
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 1200; // beep frequency
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn('Som do scanner não suportado', e);
    }

    setTimeout(() => {
      setIsBeeping(false);
      setBeepMessage('');
    }, 1200);
  };

  const handleStartCheckout = () => {
    if (cart.length === 0) {
      alert('Seu carrinho está vazio.');
      return;
    }

    if (!activeWallet) {
      alert('Nenhuma carteira PIX configurada ou ativa para receber pagamentos. Vá em Configurações > Minhas Chaves.');
      return;
    }

    // Generate PIX
    const total = getCartTotal();
    const txid = `POS${Date.now().toString().slice(-10)}`;
    const payload = generatePixPayload({
      key: activeWallet.key,
      keyType: activeWallet.type,
      name: activeWallet.name || 'MandaPIX POS',
      city: activeWallet.city || 'SAO PAULO',
      amount: total,
      description: `Venda PDV ${txid}`,
      txid: txid
    });

    setPixPayload(payload);
    setCountdown(60);
    setPaymentApproved(false);
    setCheckoutStep('payment');
  };

  const simulatePaymentConfirm = async () => {
    if (paymentApproved) return;
    setPaymentApproved(true);

    try {
      // 1. Deduct stock in DB
      for (const item of cart) {
        const currentStock = item.product.stock_quantity ?? 10;
        const newStock = Math.max(0, currentStock - item.quantity);
        
        const { error: updateErr } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.product.id);

        if (updateErr) {
          console.error(`Erro ao atualizar estoque para ${item.product.name}:`, updateErr);
        }
      }

      // 2. Identify Client
      let clientName = 'Cliente Balcão (Consumidor)';
      let clientPhone = '';
      let clientEmail = '';
      let clientDocument = '';

      if (selectedClientId) {
        const client = clients.find(c => c.id === selectedClientId);
        if (client) {
          clientName = client.name;
          clientPhone = client.phone;
          clientEmail = client.email;
          clientDocument = client.document;
        }
      } else if (anonymousName) {
        clientName = anonymousName;
        clientPhone = anonymousPhone;
      }

      // 3. Create Order
      const newOrderPayload = {
        store_id: storeId,
        order_number: `${Date.now().toString().slice(-6)}`,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        client_document: clientDocument,
        items: cart.map(item => ({
          productServiceId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price
        })),
        total_amount: getCartTotal(),
        status: 'VENDA_CONCLUIDA', // Final status for POS branch
        date_created: new Date().toISOString()
      };

      const { data: insertedOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([newOrderPayload])
        .select('*')
        .single();

      if (orderErr) throw orderErr;

      // 4. Update UI & parent
      setCreatedOrder(insertedOrder || {
        id: `local-${Date.now()}`,
        storeId,
        orderNumber: newOrderPayload.order_number,
        clientName: newOrderPayload.client_name,
        clientPhone: newOrderPayload.client_phone,
        clientEmail: newOrderPayload.client_email,
        clientDocument: newOrderPayload.client_document,
        items: newOrderPayload.items,
        totalAmount: newOrderPayload.total_amount,
        status: newOrderPayload.status,
        dateCreated: newOrderPayload.date_created
      });

      onOrderCreated(insertedOrder || newOrderPayload);
      onRefreshProducts();
      setCheckoutStep('receipt');
    } catch (err: any) {
      alert('Erro ao processar venda: ' + err.message);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const startNewSale = () => {
    setCart([]);
    setSelectedClientId('');
    setAnonymousName('');
    setAnonymousPhone('');
    setPixPayload('');
    setCreatedOrder(null);
    setCheckoutStep('cart');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900 text-slate-100 font-sans">
      
      {/* Laser flashing visual alert on scan simulation */}
      {isBeeping && (
        <div className="absolute inset-0 bg-teal-500/10 border-4 border-teal-500/30 animate-pulse pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-slate-950/90 border border-teal-500/30 py-3 px-6 rounded-2xl flex items-center gap-2.5 shadow-2xl">
            <Barcode className="w-6 h-6 text-teal-400 animate-bounce" />
            <span className="font-extrabold text-sm text-teal-400 tracking-wide uppercase">{beepMessage}</span>
          </div>
        </div>
      )}

      {/* Column 1: Items Search and Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden border-r border-slate-800">
        
        {/* Top bar with POS features */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Barcode className="w-6 h-6 text-teal-400" />
              <span>Frente de Caixa Rápida</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">PDV Automatizado & Controle de Estoque</p>
          </div>

          <button
            onClick={triggerBarcodeBeep}
            className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-600 hover:to-emerald-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-teal-500/10 active:scale-95 transition-all"
          >
            <Barcode className="w-4 h-4" />
            <span>Simular Leitor (Bipar)</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-6 flex-shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Digite o nome, código ou descrição para buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 text-white rounded-xl py-3.5 pl-11 pr-4 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {availableProducts.length === 0 ? (
            <div className="text-center py-16 text-slate-500 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhum produto físico encontrado</p>
              <p className="text-xs text-slate-600 max-w-[280px] mx-auto leading-relaxed">Certifique-se de que os produtos possuem estoque e estão cadastrados como tipo PRODUTO.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {availableProducts.map(product => {
                const stock = product.stock_quantity ?? 0;
                const cartQty = cart.find(item => item.product.id === product.id)?.quantity ?? 0;
                const remainingStock = stock - cartQty;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={remainingStock <= 0}
                    className={`bg-slate-950/40 border rounded-2xl p-4 text-left flex flex-col justify-between hover:border-teal-500/40 active:scale-[0.98] transition-all group relative overflow-hidden h-[135px] ${
                      remainingStock <= 0 ? 'opacity-40 border-slate-900 cursor-not-allowed' : 'border-slate-800'
                    }`}
                  >
                    {/* Visual Badge for Cart quantity */}
                    {cartQty > 0 && (
                      <span className="absolute top-2.5 right-2.5 bg-teal-500 text-slate-950 font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-fade-in">
                        {cartQty}x
                      </span>
                    )}

                    <div className="space-y-1">
                      <h4 className="font-extrabold text-xs text-slate-200 line-clamp-2 pr-6 leading-snug group-hover:text-white">{product.name}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{product.description || 'Sem descrição.'}</p>
                    </div>

                    <div className="flex items-end justify-between pt-2 border-t border-slate-900 w-full">
                      <span className="text-sm font-black text-teal-400">{formatBRL(product.price)}</span>
                      <span className={`text-[9px] font-bold uppercase ${
                        remainingStock <= 2 ? 'text-amber-500' : 'text-slate-500'
                      }`}>
                        Estoque: {remainingStock}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Column 2: POS Cart Panel */}
      <div className="w-full md:w-[380px] flex flex-col bg-slate-950/60 overflow-hidden flex-shrink-0">
        
        {checkoutStep === 'cart' && (
          <>
            {/* Cart Header */}
            <div className="p-6 border-b border-slate-900 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-teal-400" />
                <span className="font-black text-sm text-white">Carrinho da Venda</span>
              </div>
              <span className="bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400 rounded-lg">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} itens
              </span>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-600 space-y-2">
                  <ShoppingCart className="w-8 h-8 mx-auto opacity-35" />
                  <p className="text-xs font-bold uppercase tracking-wider">Carrinho Vazio</p>
                  <p className="text-[10px] max-w-[200px] mx-auto text-slate-700 leading-normal">Bipe produtos ou clique nos cards ao lado para começar a faturar.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 animate-slide-up">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="font-extrabold text-[11px] text-slate-200 truncate leading-snug">{item.product.name}</p>
                      <p className="text-[10px] font-black text-teal-400">{formatBRL(item.product.price)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold font-mono text-slate-100 min-w-[16px] text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 hover:bg-rose-500/10 hover:text-rose-400 rounded text-slate-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Details Form */}
            <div className="p-6 bg-slate-950/90 border-t border-slate-900 space-y-4 flex-shrink-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Identificar Cliente (Opcional)</span>
                  <User className="w-3 h-3 text-slate-500" />
                </div>
                
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    if (e.target.value) {
                      setAnonymousName('');
                      setAnonymousPhone('');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="">Consumidor Não Identificado (Balcão)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
                  ))}
                </select>

                {!selectedClientId && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      value={anonymousName}
                      onChange={(e) => setAnonymousName(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-white rounded-xl py-2 px-3 text-[11px] font-medium focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp (ex: 11999999999)"
                      value={anonymousPhone}
                      onChange={(e) => setAnonymousPhone(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-white rounded-xl py-2 px-3 text-[11px] font-medium focus:outline-none focus:border-teal-500"
                    />
                  </div>
                )}
              </div>

              {/* Order Sum & Action */}
              <div className="space-y-4 pt-3 border-t border-slate-900">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Total da Venda</span>
                  <span className="text-2xl font-black text-white">{formatBRL(getCartTotal())}</span>
                </div>

                <button
                  onClick={handleStartCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-teal-500/10 active:scale-98"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Cobrar via PIX</span>
                </button>
              </div>
            </div>
          </>
        )}

        {checkoutStep === 'payment' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setCheckoutStep('cart')}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
              >
                &larr; Voltar
              </button>
              <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg animate-pulse">
                Aguardando PIX
              </span>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-5 shadow-2xl relative overflow-hidden">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none block">Escaneie o QR Code</span>
                <span className="text-xl font-black text-white">{formatBRL(getCartTotal())}</span>
              </div>

              {/* PIX Mock QR Container */}
              <div className="w-[180px] h-[180px] bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg relative">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(pixPayload)}`} 
                  alt="PIX QR Code" 
                  className="w-full h-full object-contain"
                />
                
                {paymentApproved && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-4 rounded-2xl animate-fade-in">
                    <CheckCircle className="w-10 h-10 text-emerald-400 animate-bounce mb-2" />
                    <span className="font-black text-xs text-white">Pago com Sucesso!</span>
                    <span className="text-[9px] text-slate-500 mt-1 font-semibold">Atualizando estoque...</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 w-full">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-medium">
                  <Smartphone className="w-4 h-4 text-teal-400" />
                  <span>Chave: <strong>{activeWallet?.key}</strong></span>
                </div>
                
                {/* Copia e cola text box */}
                <textarea
                  readOnly
                  value={pixPayload}
                  onClick={(e) => {
                    (e.target as HTMLTextAreaElement).select();
                    navigator.clipboard.writeText(pixPayload);
                    alert('Código Copia e Cola copiado!');
                  }}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-[8px] font-mono text-slate-400 h-14 resize-none cursor-pointer focus:outline-none select-all text-center leading-normal"
                  title="Clique para copiar"
                />
                <span className="text-[8px] text-slate-500 font-bold block uppercase leading-none">Clique na caixa acima para copiar o código</span>
              </div>
            </div>

            {/* Countdown / Action Area */}
            <div className="space-y-4 pt-4 border-t border-slate-900 text-center">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Expira em:</span>
                <span className={`font-mono font-bold ${countdown < 15 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>{countdown}s</span>
              </div>

              <button
                onClick={simulatePaymentConfirm}
                disabled={paymentApproved}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-98"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Simular Confirmação PIX</span>
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'receipt' && createdOrder && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
            
            <div className="text-center space-y-1.5 py-4 border-b border-slate-900">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
              <h3 className="font-extrabold text-sm text-white">Venda Finalizada!</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Comprovante de Pagamento PIX</p>
            </div>

            {/* Visual printable receipt */}
            <div id="receipt-print-area" className="bg-white text-slate-950 rounded-3xl p-6 shadow-2xl space-y-4 font-mono text-xs border border-slate-200 leading-relaxed">
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                <span className="font-black text-sm tracking-tight block uppercase">MandaPIX PDV</span>
                <span className="text-[10px] font-bold text-slate-500 block leading-none">CNPJ: {createdOrder.clientDocument || 'ISENTO'}</span>
                <span className="text-[9px] text-slate-400 block">{new Date(createdOrder.dateCreated).toLocaleString('pt-BR')}</span>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                <p className="font-bold">ORDEM: #{createdOrder.orderNumber}</p>
                <p className="text-slate-700 truncate">CLIENTE: {createdOrder.clientName}</p>
                {createdOrder.clientPhone && <p className="text-slate-700">TEL: {createdOrder.clientPhone}</p>}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300">
                <p className="font-black border-b border-dashed border-slate-200 pb-1 mb-1">PRODUTOS VENDIDOS</p>
                {createdOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] leading-tight">
                    <span className="truncate max-w-[200px]">{item.name}</span>
                    <span className="font-bold text-right pl-2 shrink-0">{item.quantity}x {formatBRL(item.price)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 pt-1 font-bold">
                <div className="flex justify-between">
                  <span>PAGAMENTO:</span>
                  <span>PIX</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1.5">
                  <span>TOTAL PAGO:</span>
                  <span>{formatBRL(createdOrder.totalAmount)}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 pt-3 border-t border-dashed border-slate-200 leading-tight font-sans">
                Obrigado pela preferência!<br />MandaPIX - Comprovante Digital.
              </div>
            </div>

            {/* Receipt actions */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-900">
              <button
                onClick={handlePrintReceipt}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4 text-teal-400" />
                <span>Imprimir</span>
              </button>
              
              <button
                onClick={startNewSale}
                className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-teal-500/10"
              >
                <span>Nova Venda</span>
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
export default QuickPOS;
