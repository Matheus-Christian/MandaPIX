import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Package, 
  Trash2, 
  Plus, 
  Minus, 
  X, 
  Check, 
  Copy, 
  AlertCircle, 
  CalendarClock, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  FileText 
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { 
  formatBRL, 
  routePixPayment, 
  generatePixPayload 
} from '../utils/pix';
import type { 
  Store, 
  Catalog, 
  ProductService, 
  SavedPixKey, 
  ScheduleSlot, 
  ScheduleCalendar, 
  EcommerceSettings, 
  BusinessHourDay
} from '../utils/pix';
import confetti from 'canvas-confetti';

interface CartItem {
  product: ProductService;
  quantity: number;
}

export const PublicStorefront: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();

  // Database state loaded on mount
  const [store, setStore] = useState<Store | null>(null);
  const [ecommerceSettings, setEcommerceSettings] = useState<EcommerceSettings | null>(null);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [merchantWallets, setMerchantWallets] = useState<SavedPixKey[]>([]);
  const [scheduleCalendars, setScheduleCalendars] = useState<ScheduleCalendar[]>([]);
  const [availableSlots, setAvailableSlots] = useState<ScheduleSlot[]>([]);
  const [routingSettings, setRoutingSettings] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shopClosedMsg, setShopClosedMsg] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Navigation & Category Selection
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Checkout Form State
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'>('PIX');
  const [selectedInstallmentCount, setSelectedInstallmentCount] = useState<number>(1);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Scheduling states
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0);

  // Success screen state
  const [checkoutResult, setCheckoutResult] = useState<{
    orderNumber: string;
    invoiceId: string;
    orderId: string;
    totalAmount: number;
    downPaymentAmount: number;
    installments: Array<{
      id: string;
      number: number;
      amount: number;
      dueDate: string;
      status: string;
      pixPayload?: string;
    }>;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPaymentSimulated, setIsPaymentSimulated] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Fetch all store data securely
  useEffect(() => {
    if (!storeId) return;

    const fetchStorefrontData = async () => {
      setLoading(true);
      setErrorMsg(null);
      setShopClosedMsg(null);

      try {
        // Fetch Store
        const { data: storeData, error: storeErr } = await supabase
          .from('stores')
          .select('*')
          .eq('id', storeId)
          .maybeSingle();

        if (storeErr || !storeData) {
          throw new Error('Loja não encontrada.');
        }
        setStore(storeData as Store);

        // Fetch Ecommerce Settings
        const { data: ecoData, error: ecoErr } = await supabase
          .from('ecommerce_settings')
          .select('*')
          .eq('store_id', storeId)
          .maybeSingle();

        if (ecoErr || !ecoData) {
          // If no settings exist, it means ecommerce is disabled by default
          setShopClosedMsg('O e-commerce para esta loja não está ativo no momento.');
          setLoading(false);
          return;
        }

        const settings = ecoData as EcommerceSettings;
        setEcommerceSettings(settings);

        if (!settings.is_enabled) {
          setShopClosedMsg('Esta loja online está temporariamente desativada.');
          setLoading(false);
          return;
        }

        // Validate business hours
        const isOpenNow = checkShopBusinessHours(settings.business_hours);
        if (!isOpenNow.isOpen) {
          setShopClosedMsg(isOpenNow.message);
          setLoading(false);
          return;
        }

        // Fetch active catalogs, products, wallets, schedule config & routing
        const [catalogsRes, productsRes, walletsRes, calsRes, slotsRes, routingRes] = await Promise.all([
          supabase.from('catalogs').select('*').eq('store_id', storeId),
          supabase.from('products').select('*').eq('tenant_id', storeData.tenant_id),
          supabase.from('wallets').select('*').eq('tenant_id', storeData.tenant_id),
          supabase.from('schedule_calendars').select('*').eq('store_id', storeId).eq('is_enabled', true),
          supabase.from('schedule_slots').select('*').eq('store_id', storeId).eq('is_enabled', true).order('slot_date').order('slot_time'),
          supabase.from('settings').select('value').eq('key', 'pix_routing').maybeSingle()
        ]);

        // Filter catalogs allowed by settings
        const allowedCatalogIds = settings.catalog_ids || [];
        const loadedCatalogs = (catalogsRes.data || [])
          .map((d: any) => ({
            id: d.id,
            storeId: d.store_id,
            name: d.name,
            description: d.description
          }))
          .filter((c: Catalog) => allowedCatalogIds.includes(c.id));
        setCatalogs(loadedCatalogs);

        // Products in allowed catalogs
        const loadedProducts = (productsRes.data || [])
          .map((d: any) => ({
            id: d.id,
            catalogId: d.catalog_id,
            name: d.name,
            type: d.type,
            price: Number(d.price),
            description: d.description,
            image: d.image
          }))
          .filter((p: ProductService) => allowedCatalogIds.includes(p.catalogId));
        setProducts(loadedProducts);

        setMerchantWallets((walletsRes.data || []).map((d: any) => ({
          id: d.id,
          walletType: d.wallet_type,
          label: d.label,
          bankName: d.bank_name,
          isPrimary: d.is_primary,
          type: d.type,
          key: d.key,
          name: d.name,
          city: d.city,
          cardProvider: d.card_provider,
          accountIdentifier: d.account_identifier
        })));
        
        // Calendars
        if (calsRes.data) {
          // Fetch associations
          const { data: linkData } = await supabase.from('schedule_calendar_catalogs').select('*');
          const catLinks = linkData || [];
          
          setScheduleCalendars(calsRes.data.map((d: any) => ({
            id: d.id,
            storeId: d.store_id,
            name: d.name,
            catalogIds: catLinks.filter((l: any) => l.calendar_id === d.id).map((l: any) => l.catalog_id),
            isEnabled: d.is_enabled,
            showSlotsToClient: d.show_slots_to_client,
            requireScheduling: d.require_scheduling,
            advanceDays: d.advance_days,
          })));
        }

        if (slotsRes.data) {
          setAvailableSlots(slotsRes.data.map((d: any) => ({
            id: d.id,
            calendarId: d.calendar_id,
            storeId: d.store_id,
            slotDate: d.slot_date,
            slotTime: d.slot_time.substring(0, 5),
            maxCapacity: d.max_capacity,
            currentBookings: d.current_bookings,
            isEnabled: d.is_enabled,
          })));
        }

        if (routingRes.data) {
          setRoutingSettings(routingRes.data.value);
        }

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Erro ao carregar a loja.');
      } finally {
        setLoading(false);
      }
    };

    fetchStorefrontData();
  }, [storeId]);

  // Business hours checking helper
  const checkShopBusinessHours = (hours: BusinessHourDay[]): { isOpen: boolean; message: string } => {
    if (!hours || hours.length === 0) return { isOpen: true, message: '' };

    const now = new Date();
    // JS getDay(): 0 = Sunday, 1 = Monday, etc.
    const currentDay = now.getDay();
    const config = hours.find(h => h.day === currentDay);

    if (!config || config.closed) {
      return { 
        isOpen: false, 
        message: 'A loja está fechada hoje. Por favor, volte durante nosso horário de expediente.' 
      };
    }

    if (config.is24h) {
      return { isOpen: true, message: '' };
    }

    // Current HH:MM format
    const pad = (n: number) => n.toString().padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (config.hasInterval) {
      const open1 = config.open || '08:00';
      const close1 = config.close || '12:00';
      const open2 = config.open2 || '14:00';
      const close2 = config.close2 || '18:00';

      const inPeriod1 = currentTime >= open1 && currentTime <= close1;
      const inPeriod2 = currentTime >= open2 && currentTime <= close2;

      if (!inPeriod1 && !inPeriod2) {
        return {
          isOpen: false,
          message: `A loja está fechada no momento. Expediente de hoje: das ${open1} às ${close1} e das ${open2} às ${close2}.`
        };
      }
    } else {
      if (currentTime < config.open || currentTime > config.close) {
        return { 
          isOpen: false, 
          message: `A loja está fechada no momento. Nosso expediente de hoje é das ${config.open} às ${config.close}.` 
        };
      }
    }

    return { isOpen: true, message: '' };
  };

  // Format Input Masks
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

  // Scheduling helpers
  const scheduleEnabled = useMemo(() => {
    if (scheduleCalendars.length === 0 || cart.length === 0 || !ecommerceSettings?.show_schedule_calendar) return false;
    const cartCatalogIds = new Set(cart.map(item => item.product.catalogId).filter(Boolean));
    return scheduleCalendars.some(cal => cal.isEnabled && cal.catalogIds.some(cid => cartCatalogIds.has(cid)));
  }, [scheduleCalendars, cart, ecommerceSettings]);

  const activeCalendar = useMemo(() => {
    if (cart.length === 0 || !ecommerceSettings?.show_schedule_calendar) return null;
    const cartCatalogIds = new Set(cart.map(item => item.product.catalogId).filter(Boolean));
    return scheduleCalendars.find(cal => cal.isEnabled && cal.catalogIds.some(cid => cartCatalogIds.has(cid))) || null;
  }, [scheduleCalendars, cart, ecommerceSettings]);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const weekStart = useMemo(() => {
    const dow = todayDate.getDay();
    const mon = new Date(todayDate);
    mon.setDate(todayDate.getDate() - dow + (dow === 0 ? -6 : 1));
    const result = new Date(mon);
    result.setDate(mon.getDate() + scheduleWeekOffset * 7);
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleWeekOffset]);

  const scheduleWeekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const slotsByDate = useMemo(() => {
    const map: Record<string, ScheduleSlot[]> = {};
    const cutoff = new Date(todayDate);
    cutoff.setDate(todayDate.getDate() + (activeCalendar?.advanceDays || 30));
    availableSlots
      .filter(s => {
        if (s.calendarId !== activeCalendar?.id) return false;
        const d = new Date(s.slotDate + 'T12:00:00');
        return d >= todayDate && d <= cutoff && s.isEnabled && s.currentBookings < s.maxCapacity;
      })
      .forEach(s => {
        if (!map[s.slotDate]) map[s.slotDate] = [];
        map[s.slotDate].push(s);
      });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSlots, activeCalendar]);

  const selectedSlot = availableSlots.find(s => s.id === selectedSlotId);

  // Payment Calculations
  const cartTotal = getCartTotal();

  // Down Payment (Entrada) calculation
  const downPaymentAmount = useMemo(() => {
    if (!ecommerceSettings?.down_payment_enabled || cartTotal <= 0) return 0;
    if (ecommerceSettings.down_payment_type === 'percentage') {
      return Math.min(cartTotal, (cartTotal * ecommerceSettings.down_payment_value) / 100);
    } else {
      return Math.min(cartTotal, ecommerceSettings.down_payment_value);
    }
  }, [ecommerceSettings, cartTotal]);

  const remainingBalance = cartTotal - downPaymentAmount;

  // Active wallets & routing
  const activeWallet = useMemo(() => {
    if (merchantWallets.length === 0) return null;

    // Check if the tenant selected a specific wallet for this payment method
    const selectedWalletId = ecommerceSettings?.payment_wallets?.[paymentMethod];
    if (selectedWalletId) {
      const selected = merchantWallets.find(k => k.id === selectedWalletId);
      if (selected) return selected;
    }

    if (paymentMethod === 'PIX') {
      return (
        merchantWallets.find(k => k.walletType === 'PIX_AUTO') ||
        merchantWallets.find(k => k.walletType === 'PIX') ||
        merchantWallets.find(k => k.isPrimary) ||
        merchantWallets[0]
      );
    } else {
      return (
        merchantWallets.find(k => k.walletType === paymentMethod) ||
        merchantWallets.find(k => k.isPrimary) ||
        merchantWallets[0]
      );
    }
  }, [merchantWallets, paymentMethod, ecommerceSettings]);

  const isPixAuto = activeWallet?.walletType === 'PIX_AUTO';

  // Checkout process submit handler
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ecommerceSettings) return;

    const errors: { [key: string]: string } = {};

    // Validate fields according to configuration
    const cf = ecommerceSettings.checkout_fields;
    if (cf.name.required && !name.trim()) errors.name = 'Nome completo é obrigatório';
    if (cf.document.required && !document.trim()) errors.document = 'CPF ou CNPJ é obrigatório';
    
    if (cf.email.required && !email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido';
    }

    if (cf.phone.required && !phone.trim()) errors.phone = 'Telefone é obrigatório';
    if (cf.address.required && !address.trim()) errors.address = 'Endereço é obrigatório';

    // Card validations
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

    // Schedule validation
    if (scheduleEnabled && activeCalendar?.requireScheduling && !selectedSlotId) {
      errors.schedule = 'A escolha de data e horário é obrigatória para agendar este serviço.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsProcessingCheckout(true);

      const itemsPayload = cart.map(item => ({
        productServiceId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      }));

      // Generate PIX or Card installments layout payload
      const installmentsList: any[] = [];
      let routedGateway = null;
      let transactionFee = null;
      let totalAmountToRecord = cartTotal;

      if (paymentMethod === 'PIX') {
        if (downPaymentAmount > 0) {
          // Installment 1: Entry
          let inst1Amount = downPaymentAmount;
          let inst1Gateway = null;
          let inst1Fee = null;
          let inst1Key = activeWallet?.key || '';
          let inst1KeyType = activeWallet?.type || 'RANDOM';
          let inst1Name = activeWallet?.name || store?.name || 'RECEBEDOR';

          // Apply routing specifically for this payment if auto
          if (isPixAuto) {
            const route = routePixPayment(downPaymentAmount, routingSettings || {
              threshold: 100,
              below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
              above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
            });
            inst1Amount = route.total;
            inst1Gateway = route.gateway;
            inst1Fee = route.fee;
            inst1Key = route.key;
            inst1KeyType = route.key.includes('@') ? 'EMAIL' : 'RANDOM';
            inst1Name = `MandaPIX Central (${route.gateway})`;
          }

          const pix1 = generatePixPayload({
            key: inst1Key,
            keyType: inst1KeyType as any,
            name: inst1Name,
            city: activeWallet?.city || 'SAO PAULO',
            amount: inst1Amount,
            description: `Entrada Pedido`.substring(0, 72)
          });

          installmentsList.push({
            number: 1,
            amount: inst1Amount,
            due_date: new Date().toISOString().split('T')[0],
            status: 'PENDENTE',
            pix_payload: pix1,
            routed_gateway: inst1Gateway,
            transaction_fee: inst1Fee
          });

          // Installment 2: Remaining balance
          if (remainingBalance > 0) {
            let inst2Amount = remainingBalance;
            let inst2Gateway = null;
            let inst2Fee = null;
            let inst2Key = activeWallet?.key || '';
            let inst2KeyType = activeWallet?.type || 'RANDOM';
            let inst2Name = activeWallet?.name || store?.name || 'RECEBEDOR';

            if (isPixAuto) {
              const route = routePixPayment(remainingBalance, routingSettings || {
                threshold: 100,
                below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
                above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
              });
              inst2Amount = route.total;
              inst2Gateway = route.gateway;
              inst2Fee = route.fee;
              inst2Key = route.key;
              inst2KeyType = route.key.includes('@') ? 'EMAIL' : 'RANDOM';
              inst2Name = `MandaPIX Central (${route.gateway})`;
            }

            const pix2 = generatePixPayload({
              key: inst2Key,
              keyType: inst2KeyType as any,
              name: inst2Name,
              city: activeWallet?.city || 'SAO PAULO',
              amount: inst2Amount,
              description: `Saldo Pedido`.substring(0, 72)
            });

            // Spaced 30 days or scheduled slot date
            let dueDateStr = '';
            if (selectedSlotId && selectedSlot) {
              dueDateStr = selectedSlot.slotDate;
            } else {
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 30);
              dueDateStr = futureDate.toISOString().split('T')[0];
            }

            installmentsList.push({
              number: 2,
              amount: inst2Amount,
              due_date: dueDateStr,
              status: 'PENDENTE',
              pix_payload: pix2,
              routed_gateway: inst2Gateway,
              transaction_fee: inst2Fee
            });
          }

          // Compute totals recorded
          routedGateway = inst1Gateway;
          transactionFee = (inst1Fee || 0) + (installmentsList[1]?.transaction_fee || 0);
          totalAmountToRecord = inst1Amount + (installmentsList[1]?.amount || 0);

        } else {
          // Standard Single or multiple installments split
          const splitCount = selectedInstallmentCount;
          const splitAmount = cartTotal / splitCount;

          for (let i = 1; i <= splitCount; i++) {
            let instAmount = splitAmount;
            let instGateway = null;
            let instFee = null;
            let instKey = activeWallet?.key || '';
            let instKeyType = activeWallet?.type || 'RANDOM';
            let instName = activeWallet?.name || store?.name || 'RECEBEDOR';

            if (isPixAuto) {
              const route = routePixPayment(splitAmount, routingSettings || {
                threshold: 100,
                below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
                above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
              });
              instAmount = route.total;
              instGateway = route.gateway;
              instFee = route.fee;
              instKey = route.key;
              instKeyType = route.key.includes('@') ? 'EMAIL' : 'RANDOM';
              instName = `MandaPIX Central (${route.gateway})`;
            }

            const pix = generatePixPayload({
              key: instKey,
              keyType: instKeyType as any,
              name: instName,
              city: activeWallet?.city || 'SAO PAULO',
              amount: instAmount,
              description: `Parc ${i}/${splitCount}`.substring(0, 72)
            });

            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (i - 1) * 30);

            installmentsList.push({
              number: i,
              amount: instAmount,
              due_date: dueDate.toISOString().split('T')[0],
              status: 'PENDENTE',
              pix_payload: pix,
              routed_gateway: instGateway,
              transaction_fee: instFee
            });
          }

          routedGateway = installmentsList[0].routed_gateway;
          transactionFee = installmentsList.reduce((sum, inst) => sum + (inst.transaction_fee || 0), 0);
          totalAmountToRecord = installmentsList.reduce((sum, inst) => sum + inst.amount, 0);
        }
      } else {
        // Card payments (Stripe/Mercado Pago) - single or multiple
        const splitCount = selectedInstallmentCount;
        const splitAmount = cartTotal / splitCount;

        for (let i = 1; i <= splitCount; i++) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (i - 1) * 30);

          installmentsList.push({
            number: i,
            amount: splitAmount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'PENDENTE',
            pix_payload: null,
            routed_gateway: activeWallet?.cardProvider || 'CreditCardProvider',
            transaction_fee: 0
          });
        }
      }

      // Format appointment time
      const scheduledAt = selectedSlotId && selectedSlot
        ? `${selectedSlot.slotDate}T${selectedSlot.slotTime}:00`
        : null;

      // Executa o checkout atômico no banco em nome do tenant com SECURITY DEFINER
      const { data, error } = await supabase.rpc('create_storefront_order', {
        p_store_id: storeId,
        p_client_name: name.trim(),
        p_client_document: document.trim() || 'NÃO INFORMADO',
        p_client_email: email.trim() || 'checkout@mandapix.com',
        p_client_phone: phone.trim() || 'NÃO INFORMADO',
        p_items: itemsPayload,
        p_payment_method: paymentMethod,
        p_wallet_id: activeWallet?.id || null,
        p_scheduled_at: scheduledAt,
        p_schedule_slot_id: selectedSlotId || null,
        p_schedule_calendar_id: activeCalendar?.id || null,
        p_installments: installmentsList,
        p_routed_gateway: routedGateway,
        p_transaction_fee: transactionFee || 0,
        p_total_amount: totalAmountToRecord
      });

      if (error) throw error;

      // Card automatically simulates payment success
      let simulatedSuccess = false;
      if (paymentMethod !== 'PIX') {
        const { data: instData } = await supabase
          .from('installments')
          .select('id')
          .eq('invoice_id', data.invoiceId);
        
        if (instData) {
          // Update all installments to paid
          await Promise.all(instData.map((inst: any) => 
            supabase
              .from('installments')
              .update({ status: 'PAGO', confirmed_date: new Date().toISOString().split('T')[0] })
              .eq('id', inst.id)
          ));
          // Update order status to APROVADO
          await supabase
            .from('orders')
            .update({ status: 'APROVADO' })
            .eq('invoice_id', data.invoiceId);
        }
        simulatedSuccess = true;
      }

      // Success feedback
      setCheckoutResult({
        orderNumber: data.orderNumber,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        totalAmount: totalAmountToRecord,
        downPaymentAmount: downPaymentAmount,
        installments: installmentsList.map((inst, index) => ({
          ...inst,
          id: `temp-${index}`,
          dueDate: inst.due_date,
          pixPayload: inst.pix_payload
        }))
      });

      if (simulatedSuccess) {
        setIsPaymentSimulated(true);
      }

      // Sound and Confetti!
      triggerSuccessSoundAndConfetti();

      // Clear cart
      setCart([]);
      setIsCartOpen(false);
      setIsProcessingCheckout(false);
    } catch (err: any) {
      console.error(err);
      setIsProcessingCheckout(false);
      alert('Erro ao processar o checkout: ' + err.message);
    }
  };

  const triggerSuccessSoundAndConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });

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
  };

  // Render QR Code for PIX checkouts
  useEffect(() => {
    const activeInstallment = checkoutResult?.installments[0];
    if (checkoutResult && activeInstallment?.pixPayload && qrCanvasRef.current && paymentMethod === 'PIX') {
      import('qrcode').then((QRCode) => {
        QRCode.toCanvas(
          qrCanvasRef.current!,
          activeInstallment.pixPayload!,
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
    const activeInstallment = checkoutResult?.installments[0];
    if (!activeInstallment?.pixPayload) return;
    navigator.clipboard.writeText(activeInstallment.pixPayload);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const simulateSuccess = async () => {
    if (!checkoutResult) return;
    try {
      setIsPaymentSimulated(true);
      triggerSuccessSoundAndConfetti();

      // Abre o WhatsApp para enviar o comprovante
      const cleanPhone = store?.contact ? store.contact.replace(/\D/g, '') : '';
      const hasDownPayment = checkoutResult.downPaymentAmount > 0;
      const amountPaid = hasDownPayment ? checkoutResult.downPaymentAmount : checkoutResult.totalAmount;
      const text = encodeURIComponent(
        `Olá! Envio o comprovante de pagamento do pedido #${checkoutResult.orderNumber} no valor de ${formatBRL(amountPaid)}.`
      );
      const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${text}`
        : `https://wa.me/?text=${text}`;
      
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar.');
    }
  };

  // Filter products by search & catalog category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCatalog = selectedCatalogId === 'ALL' || p.catalogId === selectedCatalogId;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCatalog && matchesSearch;
    });
  }, [products, selectedCatalogId, searchQuery]);

  const storeColor = store?.color || 'from-slate-600 to-slate-700';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pix border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Oops! Algo deu errado</h2>
          <p className="text-sm text-slate-400 font-semibold">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (shopClosedMsg) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-slate-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative z-10">
          <div className="p-4 bg-slate-800/80 border border-slate-750 rounded-2xl w-fit mx-auto text-amber-500">
            <Clock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">{store?.name}</h2>
            <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest text-amber-500 mt-1">Loja Fechada</p>
            <p className="text-xs text-slate-350 leading-relaxed font-semibold mt-3">{shopClosedMsg}</p>
          </div>

          <div className="pt-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            MandaPIX E-commerce Storefront
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between overflow-x-hidden font-sans">
      
      {/* SUCCESS SCREEN */}
      {checkoutResult ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-8 w-full max-w-xl text-center space-y-6 shadow-2xl relative z-10">
            
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full w-fit mx-auto animate-bounce">
              <Check className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-white">Pedido Realizado!</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número: #{checkoutResult.orderNumber}</p>
            </div>

            {/* PIX SCREEN */}
            {paymentMethod === 'PIX' && !isPaymentSimulated && (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-5 animate-fade-in">
                
                <div className="flex justify-center">
                  <div className="bg-white p-2.5 rounded-2xl shadow-inner">
                    <canvas ref={qrCanvasRef} className="mx-auto block" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
                    <span>
                      {checkoutResult.downPaymentAmount > 0 ? 'Entrada Obrigatória (PIX)' : 'Valor da Parcela 1 (PIX)'}
                    </span>
                    <span className="text-white font-extrabold text-sm">
                      {formatBRL(checkoutResult.installments[0].amount)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={checkoutResult.installments[0].pixPayload || ''}
                      className="bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[9px] rounded-xl px-3 py-2 flex-1 focus:outline-none select-all truncate"
                    />
                    <button
                      onClick={copyPix}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                        isCopied ? 'bg-emerald-500 text-white' : 'bg-white hover:bg-slate-100 text-slate-950'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* DETAILED PAYMENT BREAKDOWN FOR PIX */}
                {checkoutResult && checkoutResult.installments.length > 0 && (
                  <div className="border-t border-slate-800 pt-3 text-left space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fluxo de Cobrança do Pedido</p>
                    <div className="space-y-1.5">
                      {checkoutResult.installments.map((inst, index) => {
                        const isEntry = inst.number === 1 && checkoutResult.installments.length === 2 && checkoutResult.downPaymentAmount > 0;
                        const label = isEntry ? "Entrada (Adiantado)" : (checkoutResult.installments.length === 2 && checkoutResult.downPaymentAmount > 0 ? "Saldo Restante" : `Parcela ${inst.number}`);
                        const statusLabel = index === 0 ? "AGUARDANDO PIX" : "AGUARDANDO DATA";
                        return (
                          <div key={index} className="flex justify-between items-center text-[10px] bg-slate-900/40 p-2.5 rounded-xl border border-slate-850/50">
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{label}</span>
                              <span className="text-[9px] text-slate-500">
                                {isEntry ? "Pagar agora para confirmar agendamento" : `Vence no dia ${new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white">{formatBRL(inst.amount)}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                index === 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={simulateSuccess}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-teal-500/10 active:scale-95 transition-all"
                >
                  Enviar comprovante no WhatsApp
                </button>
              </div>
            )}

            {/* Simulated success receipt */}
            {(paymentMethod !== 'PIX' || isPaymentSimulated) && (
              <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-5 space-y-4 animate-fade-in">
                <div className="text-left space-y-3">
                  <div className="flex justify-between text-xs font-bold text-slate-400 pb-2 border-b border-slate-800">
                    <span>Status de Pagamento</span>
                    <span className="text-amber-400 uppercase">Aguardando pagamento</span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Loja</span>
                      <span className="text-white font-bold">{store?.name}</span>
                    </div>
                    {name && (
                      <div className="flex justify-between">
                        <span>Comprador</span>
                        <span className="text-white font-bold">{name}</span>
                      </div>
                    )}
                    {selectedSlot && (
                      <div className="flex justify-between">
                        <span>Horário Agendado</span>
                        <span className="text-teal-400 font-bold">{selectedSlot.slotDate} às {selectedSlot.slotTime}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-800 text-xs font-bold">
                      <span className="text-slate-400">Total do Pedido</span>
                      <span className="text-white">{formatBRL(checkoutResult.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* DETAILED PAYMENT BREAKDOWN */}
                {checkoutResult && checkoutResult.installments.length > 0 && (
                  <div className="border-t border-slate-800 pt-3 text-left space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalhamento do Pagamento</p>
                    <div className="space-y-1.5">
                      {checkoutResult.installments.map((inst, index) => {
                        const isEntry = inst.number === 1 && checkoutResult.installments.length === 2 && checkoutResult.downPaymentAmount > 0;
                        const label = isEntry ? "Entrada (Adiantado)" : (checkoutResult.installments.length === 2 && checkoutResult.downPaymentAmount > 0 ? "Saldo Restante" : `Parcela ${inst.number}`);
                        const isPaid = paymentMethod !== 'PIX' || inst.status === 'PAGO';
                        return (
                          <div key={index} className="flex justify-between items-center text-[10px] bg-slate-900/40 p-2.5 rounded-xl border border-slate-850/50">
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{label}</span>
                              <span className="text-[9px] text-slate-500">
                                {isEntry 
                                  ? (paymentMethod === 'PIX' 
                                      ? (isPaid ? "Pago via Pix" : "Aguardando pagamento via Pix") 
                                      : (paymentMethod === 'CREDIT_CARD' ? "Pago via Cartão de Crédito" : "Pago via Cartão de Débito")) 
                                  : `Vence no dia ${new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white">{formatBRL(inst.amount)}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                isPaid ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {isPaid ? "PAGO" : "PENDENTE"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 italic">
                  Seu agendamento e fatura já foram integrados ao painel do lojista.
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => {
                  setCheckoutResult(null);
                  setIsPaymentSimulated(false);
                }}
                className="text-xs font-bold text-slate-400 hover:text-white underline"
              >
                Voltar à Página Principal
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MAIN STOREFRONT CATALOG & CART */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT SECTION: PRODUCT CATALOG EXPOSURE */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Store Banner */}
            <div className={`bg-gradient-to-r ${storeColor} text-white p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">{store?.name}</h1>
                <p className="text-xs text-white/80 font-medium mt-1.5 max-w-xl">{store?.description || 'Vitrine de Vendas Oficial'}</p>
              </div>

              {/* Float cart button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="bg-white text-slate-900 px-4 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-slate-100 transition-all shadow-lg font-bold text-xs"
              >
                <ShoppingCart className="w-4 h-4 text-pix" />
                <span>Carrinho ({getCartCount()})</span>
              </button>
            </div>

            {/* Catalog list filter categories */}
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
              <button
                onClick={() => setSelectedCatalogId('ALL')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                  selectedCatalogId === 'ALL'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                }`}
              >
                Todos
              </button>
              {catalogs.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatalogId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all whitespace-nowrap ${
                    selectedCatalogId === cat.id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Search and Catalog Products list */}
            <div className="p-6 space-y-6 flex-1 bg-slate-50/50">
              {/* Search */}
              <div className="relative max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <input
                  type="text"
                  placeholder="Buscar itens no catálogo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-4 pr-10 py-2.5 text-xs bg-transparent text-slate-800 focus:outline-none w-full"
                />
              </div>

              {/* Grid of items */}
              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center max-w-sm mx-auto shadow-sm">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-extrabold text-slate-700 text-sm">Nenhum item visível</h4>
                  <p className="text-xs text-slate-400 mt-1">Nenhum produto corresponde aos filtros ou busca.</p>
                </div>
              ) : (
                <div className={
                  ecommerceSettings?.product_card_size === 'small' 
                    ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4' 
                    : ecommerceSettings?.product_card_size === 'large' 
                    ? 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6' 
                    : 'grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-5'
                }>
                  {filteredProducts.map(prod => {
                    const cartQty = cart.find(item => item.product.id === prod.id)?.quantity || 0;
                    const size = ecommerceSettings?.product_card_size || 'medium';
                    const cardPadding = size === 'small' ? 'p-2.5' : size === 'large' ? 'p-4' : 'p-3.5';
                    const cardHeight = size === 'small' ? 'h-[150px]' : size === 'large' ? 'h-[190px]' : 'h-[170px]';
                    const imgSize = size === 'small' ? 'w-20 h-20 min-w-[80px]' : size === 'large' ? 'w-28 h-28 min-w-[112px]' : 'w-24 h-24 min-w-[96px]';
                    const titleSize = size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm';
                    const descSize = size === 'small' ? 'text-[10px]' : size === 'large' ? 'text-xs' : 'text-[11px]';
                    const priceSize = size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm';
                    const iconSize = size === 'small' ? 'w-6 h-6' : size === 'large' ? 'w-10 h-10' : 'w-8 h-8';

                    return (
                      <div 
                        key={prod.id} 
                        className={`bg-white border border-slate-100 rounded-2xl ${cardPadding} ${cardHeight} shadow-sm hover:shadow-subtle transition-all flex flex-row items-center gap-3.5 group`}
                      >
                        {/* Square Image next to info */}
                        <div className={`${imgSize} aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center`}>
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className={`${iconSize} text-slate-300`} />
                          )}
                        </div>

                        {/* Product Info & Actions column */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                          <div className="space-y-1">
                            <div className="flex justify-between items-start">
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                prod.type === 'SERVICO'
                                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                  : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              }`}>
                                {prod.type === 'SERVICO' ? 'Serviço' : 'Produto'}
                              </span>
                            </div>

                            <h3 className={`font-extrabold text-slate-800 ${titleSize} group-hover:text-pix transition-colors truncate`} title={prod.name}>
                              {prod.name}
                            </h3>
                            <p className={`${descSize} text-slate-400 font-semibold line-clamp-2 leading-relaxed`}>
                              {prod.description || 'Sem descrição cadastrada'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-55 mt-1.5">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Preço</span>
                              <span className={`font-extrabold text-slate-800 ${priceSize}`}>{formatBRL(prod.price)}</span>
                            </div>

                            {cartQty > 0 ? (
                              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                                <button 
                                  onClick={() => updateQuantity(prod.id, -1)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="text-xs font-bold px-1 text-slate-800">{cartQty}</span>
                                <button 
                                  onClick={() => updateQuantity(prod.id, 1)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(prod)}
                                className="bg-slate-900 hover:bg-slate-850 text-white rounded-xl py-1 px-2.5 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adicionar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE / SLIDE CART AND CHECKOUT DETAIL */}
          {isCartOpen && (
            <div className="w-full lg:w-96 border-l border-slate-100 bg-white shadow-2xl flex flex-col justify-between h-auto lg:h-screen fixed lg:sticky right-0 top-0 bottom-0 z-40 animate-slide-in overflow-hidden">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-pix" /> Resumo do Checkout
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Checkout flow */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto" />
                    <p className="text-xs font-bold">Seu carrinho está vazio.</p>
                  </div>
                ) : (
                  <>
                    {/* Item list */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Itens Escolhidos</span>
                      <div className="divide-y divide-slate-55 overflow-y-auto max-h-[160px]">
                        {cart.map(item => (
                          <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex-1 truncate pr-3">
                              <p className="font-bold text-slate-800 truncate">{item.product.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{item.quantity}x {formatBRL(item.product.price)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800">{formatBRL(item.product.price * item.quantity)}</span>
                              <button 
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-slate-350 hover:text-red-500 p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Schedule block if active */}
                    {scheduleEnabled && activeCalendar && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <CalendarClock className="w-4 h-4 text-pix" />
                          <span className="text-xs font-bold">Agendamento Recomendado</span>
                        </div>

                        {/* Week selector */}
                        <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                          <button
                            type="button"
                            disabled={scheduleWeekOffset <= 0}
                            onClick={() => setScheduleWeekOffset(prev => Math.max(0, prev - 1))}
                            className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {scheduleWeekOffset === 0 ? 'Semana Atual' : `Próxima Semana (${scheduleWeekOffset})`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setScheduleWeekOffset(prev => prev + 1)}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Days selectors */}
                        <div className="grid grid-cols-7 gap-1">
                          {scheduleWeekDays.map(date => {
                            const dateStr = date.toISOString().split('T')[0];
                            const isPast = date < todayDate;
                            const slots = slotsByDate[dateStr] || [];
                            const availableCount = slots.length;
                            const isSelected = selectedDate === dateStr;

                            return (
                              <button
                                key={dateStr}
                                type="button"
                                disabled={isPast}
                                onClick={() => { setSelectedDate(dateStr); setSelectedSlotId(null); }}
                                className={`p-1.5 rounded-lg flex flex-col items-center justify-center border transition-all ${
                                  isPast 
                                    ? 'opacity-30 cursor-not-allowed bg-transparent border-transparent text-slate-350'
                                    : isSelected
                                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                      : availableCount > 0
                                        ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-350'
                                        : 'bg-slate-100 border-slate-200 text-slate-400'
                                }`}
                              >
                                <span className="text-[8px] font-bold uppercase">
                                  {date.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3)}
                                </span>
                                <span className="text-[11px] font-extrabold mt-0.5">{date.getDate()}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected day slots */}
                        {selectedDate && (
                          <div className="space-y-1.5 animate-fade-in">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Horários Disponíveis</span>
                            
                            {(slotsByDate[selectedDate] || []).length === 0 ? (
                              <p className="text-[10px] text-slate-400 font-semibold italic">Nenhum horário disponível para esta data.</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-1.5 max-h-[100px] overflow-y-auto">
                                {(slotsByDate[selectedDate] || []).map(slot => {
                                  const isSlotSelected = selectedSlotId === slot.id;
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSlotId(slot.id);
                                        if (formErrors.schedule) setFormErrors(prev => ({ ...prev, schedule: '' }));
                                      }}
                                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border text-center transition-all ${
                                        isSlotSelected
                                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350'
                                      }`}
                                    >
                                      {slot.slotTime}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {formErrors.schedule && (
                          <p className="text-red-500 text-[9px] font-bold">{formErrors.schedule}</p>
                        )}
                      </div>
                    )}

                    {/* Customer Info Form */}
                    {ecommerceSettings && (
                      <div className="space-y-3.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Dados Pessoais</span>
                        
                        <div className="space-y-3">
                          {/* Name (always show/required) */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' })); }}
                                placeholder="Ex: João da Silva"
                                className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-semibold text-slate-800 ${
                                  formErrors.name ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                                }`}
                              />
                            </div>
                            {formErrors.name && <p className="text-red-500 text-[9px]">{formErrors.name}</p>}
                          </div>

                          {/* Document */}
                          {ecommerceSettings.checkout_fields.document.show && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                CPF / CNPJ {ecommerceSettings.checkout_fields.document.required && '*'}
                              </label>
                              <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  value={document}
                                  onChange={handleDocumentChange}
                                  placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-90"
                                  className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-semibold text-slate-800 ${
                                    formErrors.document ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              {formErrors.document && <p className="text-red-500 text-[9px]">{formErrors.document}</p>}
                            </div>
                          )}

                          {/* Email */}
                          {ecommerceSettings.checkout_fields.email.show && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                E-mail {ecommerceSettings.checkout_fields.email.required && '*'}
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="email"
                                  value={email}
                                  onChange={(e) => { setEmail(e.target.value); if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' })); }}
                                  placeholder="Ex: joao.silva@email.com"
                                  className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-semibold text-slate-800 ${
                                    formErrors.email ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              {formErrors.email && <p className="text-red-500 text-[9px]">{formErrors.email}</p>}
                            </div>
                          )}

                          {/* Phone */}
                          {ecommerceSettings.checkout_fields.phone.show && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                Telefone {ecommerceSettings.checkout_fields.phone.required && '*'}
                              </label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  value={phone}
                                  onChange={handlePhoneChange}
                                  placeholder="Ex: (11) 99999-9999"
                                  className={`w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-semibold text-slate-800 ${
                                    formErrors.phone ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              {formErrors.phone && <p className="text-red-500 text-[9px]">{formErrors.phone}</p>}
                            </div>
                          )}

                          {/* Address */}
                          {ecommerceSettings.checkout_fields.address.show && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                Endereço {ecommerceSettings.checkout_fields.address.required && '*'}
                              </label>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                <textarea
                                  value={address}
                                  onChange={(e) => { setAddress(e.target.value); if (formErrors.address) setFormErrors(prev => ({ ...prev, address: '' })); }}
                                  placeholder="Ex: Av. Paulista, 1000, Apto 202"
                                  rows={2}
                                  className={`w-full bg-slate-50 border rounded-xl py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-semibold text-slate-850 ${
                                    formErrors.address ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              {formErrors.address && <p className="text-red-500 text-[9px]">{formErrors.address}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Payment configurations selection */}
                    {ecommerceSettings && (
                      <div className="space-y-4">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Forma de Pagamento</span>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {ecommerceSettings.payment_methods.includes('PIX') && (
                            <button
                              type="button"
                              onClick={() => { setPaymentMethod('PIX'); setSelectedInstallmentCount(1); }}
                              className={`py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                                paymentMethod === 'PIX'
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350'
                              }`}
                            >
                              PIX
                            </button>
                          )}

                          {ecommerceSettings.payment_methods.includes('CREDIT_CARD') && (
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('CREDIT_CARD')}
                              className={`py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                                paymentMethod === 'CREDIT_CARD'
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350'
                              }`}
                            >
                              Crédito
                            </button>
                          )}

                          {ecommerceSettings.payment_methods.includes('DEBIT_CARD') && (
                            <button
                              type="button"
                              onClick={() => { setPaymentMethod('DEBIT_CARD'); setSelectedInstallmentCount(1); }}
                              className={`py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                                paymentMethod === 'DEBIT_CARD'
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350'
                              }`}
                            >
                              Débito
                            </button>
                          )}
                        </div>

                        {/* Credit Card inputs & Installments selection */}
                        {paymentMethod === 'CREDIT_CARD' && (
                          <div className="space-y-3.5 bg-slate-50 p-4 border border-slate-150 rounded-2xl animate-fade-in">
                            
                            {/* Card numbers */}
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Número do Cartão</label>
                              <input
                                type="text"
                                maxLength={16}
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                                placeholder="4000 1234 5678 9010"
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2 space-y-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Titular</label>
                                <input
                                  type="text"
                                  value={cardHolder}
                                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                                  placeholder="JOÃO DA SILVA"
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">CVV</label>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                  placeholder="123"
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Validade (MM/AA)</label>
                              <input
                                type="text"
                                maxLength={5}
                                value={cardExpiry}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if (val.length >= 2) {
                                    val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                  }
                                  setCardExpiry(val);
                                }}
                                placeholder="12/29"
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                              />
                            </div>

                            {/* Max installments options */}
                            {ecommerceSettings.installments_enabled && ecommerceSettings.max_installments > 1 && (
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Opções de Parcelamento</label>
                                <select
                                  value={selectedInstallmentCount}
                                  onChange={(e) => setSelectedInstallmentCount(parseInt(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold text-slate-700"
                                >
                                  {Array.from({ length: ecommerceSettings.max_installments }, (_, i) => i + 1).map(num => {
                                    const splitAmount = (downPaymentAmount > 0 ? remainingBalance : cartTotal) / num;
                                    return (
                                      <option key={num} value={num}>
                                        {num}x de {formatBRL(splitAmount)} sem juros
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            )}

                          </div>
                        )}

                        {paymentMethod === 'DEBIT_CARD' && (
                          <div className="space-y-3.5 bg-slate-50 p-4 border border-slate-150 rounded-2xl animate-fade-in">
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Número do Cartão de Débito</label>
                              <input
                                type="text"
                                maxLength={16}
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                                placeholder="5067 1234 5678 9010"
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Validade (MM/AA)</label>
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={cardExpiry}
                                  placeholder="12/28"
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length >= 2) {
                                      val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                    }
                                    setCardExpiry(val);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">CVV</label>
                                <input
                                  type="text"
                                  maxLength={3}
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                  placeholder="123"
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none font-bold placeholder-slate-300"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pricing details and submit */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      {/* Down payment display */}
                      {downPaymentAmount > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-[11px] font-semibold text-amber-700 space-y-2">
                          <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/50">
                            <span>Valor de Entrada Hoje:</span>
                            <span className="font-extrabold text-xs">{formatBRL(downPaymentAmount)}</span>
                          </div>
                          {remainingBalance > 0 && (
                            <div className="flex justify-between items-center text-[10px] text-amber-600 font-medium">
                              <span>
                                {selectedSlot ? (
                                  <>Saldo Restante (a pagar no dia {new Date(selectedSlot.slotDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}):</>
                                ) : (
                                  <>Saldo Restante (a pagar depois):</>
                                )}
                              </span>
                              <span className="font-bold">{formatBRL(remainingBalance)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                        <span className="font-black text-slate-900 text-lg">{formatBRL(cartTotal)}</span>
                      </div>

                      {/* Checkout button */}
                      <button
                        onClick={handleCheckoutSubmit}
                        disabled={isProcessingCheckout}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-350 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
                      >
                        {isProcessingCheckout ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span>Finalizar Pedido</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Footer Branding */}
      <footer className="bg-white border-t border-slate-100 py-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider flex-shrink-0">
        Desenvolvido via MandaPIX Storefront Services
      </footer>

    </div>
  );
};

export default PublicStorefront;
