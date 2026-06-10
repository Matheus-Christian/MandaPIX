import React, { useState, useEffect, useRef } from 'react';
import { History, Search, Plus, Trash2, X, Calendar, CheckCircle2, AlertCircle, Eye, Landmark, User, QrCode, Copy, Check, ArrowRight, Edit, CreditCard } from 'lucide-react';
import { formatBRL, formatCurrencyInput, parseBRLToNumber, generatePixPayload, routePixPayment } from '../utils/pix';
import type { Invoice, Client, ProductService, SavedPixKey, Installment, Catalog } from '../utils/pix';
import confetti from 'canvas-confetti';

interface InvoiceManagerProps {
  invoices: Invoice[];
  clients: Client[];
  products: ProductService[];
  catalogs: Catalog[];
  savedKeys: SavedPixKey[];
  onAddInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onUpdateInstallmentStatus: (invoiceId: string, installmentId: string, status: 'PAGO' | 'PENDENTE', paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD') => void;
  onNavigateToKeys: () => void;
  onNavigateToClients: () => void;
  routingSettings?: any;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({
  invoices,
  clients,
  products,
  catalogs,
  savedKeys,
  onAddInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onUpdateInstallmentStatus,
  onNavigateToKeys,
  onNavigateToClients,
  routingSettings,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PAGO' | 'A_VENCER' | 'VENCIDO'>('TODOS');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Edit Invoice States
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editPixKeyId, setEditPixKeyId] = useState('');
  const [editInstallments, setEditInstallments] = useState<Installment[]>([]);

  const startEditInvoice = () => {
    if (!selectedInvoice) return;
    setEditDescription(selectedInvoice.description);
    setEditClientId(selectedInvoice.clientId);
    setEditPixKeyId(selectedInvoice.pixKeyId);
    setEditInstallments(JSON.parse(JSON.stringify(selectedInvoice.installments)));
    setIsEditingInvoice(true);
  };

  const handleCancelEdit = () => {
    setIsEditingInvoice(false);
  };

  const handleEditInstallmentAmount = (id: string, amountStr: string) => {
    const numeric = parseFloat(amountStr) || 0;
    setEditInstallments(prev => prev.map(inst => 
      inst.id === id ? { ...inst, amount: numeric } : inst
    ));
  };

  const handleEditInstallmentDueDate = (id: string, dateStr: string) => {
    setEditInstallments(prev => prev.map(inst => 
      inst.id === id ? { ...inst, dueDate: dateStr } : inst
    ));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (!editDescription.trim()) {
      alert('Descrição é obrigatória');
      return;
    }
    if (!editClientId) {
      alert('Selecione um cliente');
      return;
    }

    const key = savedKeys.find(k => k.id === editPixKeyId) || savedKeys[0];
    let totalFee = 0;
    let routedGatewayName: string | undefined = undefined;

    const updatedInstallments = editInstallments.map(inst => {
      const original = selectedInvoice.installments.find(o => o.id === inst.id);
      const amountChanged = !original || original.amount !== inst.amount;
      const dueDateChanged = !original || original.dueDate !== inst.dueDate;
      const keyChanged = selectedInvoice.pixKeyId !== editPixKeyId;

      if (inst.status === 'PENDENTE' && (amountChanged || dueDateChanged || keyChanged)) {
        let pixPayload = '';
        let instGateway = undefined;
        let instFee = undefined;
        let instAmount = inst.amount;

        if (key.walletType === 'PIX') {
          pixPayload = generatePixPayload({
            key: key.key,
            keyType: key.type,
            name: key.name,
            city: key.city,
            amount: inst.amount,
            description: `#${selectedInvoice.invoiceNumber} P${inst.number}`.substring(0, 72)
          });
        } else if (key.walletType === 'PIX_AUTO') {
          const route = routePixPayment(inst.amount, routingSettings || {
            threshold: 100,
            below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
            above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
          });
          
          instGateway = route.gateway;
          instFee = route.fee;
          instAmount = route.total;

          pixPayload = generatePixPayload({
            key: route.key,
            keyType: route.key.includes('@') ? 'EMAIL' : 'RANDOM',
            name: `MandaPIX Central (${route.gateway})`,
            city: 'SAO PAULO',
            amount: route.total,
            description: `#${selectedInvoice.invoiceNumber} P${inst.number}`.substring(0, 72)
          });
          
          totalFee += route.fee;
          routedGatewayName = route.gateway;
        } else {
          pixPayload = `card_payment_token_${Date.now()}_${inst.amount}`;
        }

        return { 
          ...inst, 
          amount: instAmount, 
          pixPayload,
          paymentMethodUsed: key.walletType === 'PIX_AUTO' ? 'PIX' : key.walletType as any,
          routedGateway: instGateway,
          transactionFee: instFee
        } as any;
      } else {
        if (inst.status === 'PAGO' && (inst as any).transactionFee) {
          totalFee += (inst as any).transactionFee;
          routedGatewayName = (inst as any).routedGateway;
        }
        return inst;
      }
    });

    const newTotal = updatedInstallments.reduce((sum, i) => sum + i.amount, 0);

    const updatedInvoice: Invoice = {
      ...selectedInvoice,
      clientId: editClientId,
      description: editDescription.trim(),
      pixKeyId: editPixKeyId,
      walletId: editPixKeyId,
      totalAmount: parseFloat(newTotal.toFixed(2)),
      paymentMethodUsed: key.walletType === 'PIX_AUTO' ? 'PIX' : key.walletType as any,
      installments: updatedInstallments,
      routedGateway: routedGatewayName,
      transactionFee: totalFee > 0 ? parseFloat(totalFee.toFixed(2)) : undefined
    } as any;

    onEditInvoice(updatedInvoice);
    setSelectedInvoice(updatedInvoice);
    setIsEditingInvoice(false);
  };

  // QR Code Modal State
  const [activeInstallment, setActiveInstallment] = useState<{
    invoiceId: string;
    installment: Installment;
    invoiceNumber: string;
    clientName: string;
  } | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  // Card Payment Simulator States
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [cardErrors, setCardErrors] = useState<{ [key: string]: string }>({});

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.replace(/(\d{4})(\d)/g, '$1 $2').trim();
    setCardNumber(val.substring(0, 19));
    setCardErrors(prev => ({ ...prev, number: '' }));
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
      val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    setCardExpiry(val.substring(0, 5));
    setCardErrors(prev => ({ ...prev, expiry: '' }));
  };

  const handleCardCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    setCardCvv(val.substring(0, 4));
    setCardErrors(prev => ({ ...prev, cvv: '' }));
  };

  // Form State
  const [clientId, setClientId] = useState('');
  const [productServiceId, setProductServiceId] = useState('manual');
  const [description, setDescription] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [entryAmountRaw, setEntryAmountRaw] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [pixKeyId, setPixKeyId] = useState('');
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Populate primary key
  useEffect(() => {
    if (savedKeys.length > 0) {
      const primary = savedKeys.find(k => k.isPrimary) || savedKeys[0];
      setPixKeyId(primary.id);
    }
  }, [savedKeys]);

  // Handle product selection to autofill amount and description
  const handleProductSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProductServiceId(val);

    if (val === 'manual') {
      setDescription('');
      setAmountRaw('');
    } else {
      const prod = products.find(p => p.id === val);
      if (prod) {
        setDescription(prod.name);
        setAmountRaw(prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      }
    }
    setErrors(prev => ({ ...prev, amount: '', description: '' }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCurrencyInput(rawVal);
    setAmountRaw(formatted);
    if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
  };

  const handleEntryAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCurrencyInput(rawVal);
    setEntryAmountRaw(formatted);
    if (errors.entryAmount) setErrors(prev => ({ ...prev, entryAmount: '' }));
  };

  // Helper to check installment status
  const getInstallmentDisplayStatus = (inst: Installment): 'PAGO' | 'VENCIDO' | 'A_VENCER' => {
    if (inst.status === 'PAGO') return 'PAGO';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(inst.dueDate + 'T12:00:00'); // enforce time to avoid timezone offset shifts
    due.setHours(0, 0, 0, 0);
    return due < today ? 'VENCIDO' : 'A_VENCER';
  };

  // Dynamically render QR Code when active installment changes
  useEffect(() => {
    if (activeInstallment && qrCanvasRef.current) {
      import('qrcode').then((QRCode) => {
        QRCode.toCanvas(
          qrCanvasRef.current!,
          activeInstallment.installment.pixPayload,
          {
            width: 200,
            margin: 1,
            color: {
              dark: '#0f172a', // slate-900
              light: '#ffffff',
            },
          },
          (error) => {
            if (error) console.error('Error rendering QR Code', error);
          }
        );
      }).catch(err => {
        console.error('Failed to load QR Code library', err);
      });
    }
  }, [activeInstallment]);

  const handleCopyPix = () => {
    if (!activeInstallment) return;
    navigator.clipboard.writeText(activeInstallment.installment.pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      const now = ctx.currentTime;
      
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {}
  };

  const handleSimulatePayment = (paymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' = 'PIX') => {
    if (!activeInstallment) return;
    const { invoiceId, installment } = activeInstallment;
    
    // Confetti
    confetti({
      particleCount: 100,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#32B3A6', '#299e92', '#34d399', '#fbbf24']
    });
    
    playChime();
    
    // Update State in Parent
    onUpdateInstallmentStatus(invoiceId, installment.id, 'PAGO', paymentMethod);
    
    // Update local modal view state
    const updatedInstallment = { 
      ...installment, 
      status: 'PAGO' as const, 
      confirmedDate: new Date().toISOString().split('T')[0],
      paymentMethodUsed: paymentMethod
    };
    setActiveInstallment(prev => prev ? { ...prev, installment: updatedInstallment } : null);

    // Update selectedInvoice state if open to show payment immediately
    setSelectedInvoice(prev => {
      if (!prev || prev.id !== invoiceId) return prev;
      const updatedInsts = prev.installments.map(i => i.id === installment.id ? updatedInstallment : i);
      return { ...prev, installments: updatedInsts };
    });
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { [key: string]: string } = {};
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      errs.number = 'Número do cartão inválido (16 dígitos)';
    }
    if (!cardHolder.trim() || cardHolder.trim().length < 3) {
      errs.holder = 'Nome do titular é obrigatório';
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      errs.expiry = 'Validade inválida (MM/AA)';
    }
    if (cardCvv.length < 3 || cardCvv.length > 4) {
      errs.cvv = 'CVV inválido';
    }
    if (Object.keys(errs).length > 0) {
      setCardErrors(errs);
      return;
    }

    setIsProcessingCard(true);
    setTimeout(() => {
      setIsProcessingCard(false);
      
      const activeInvoice = invoices.find(inv => inv.id === activeInstallment?.invoiceId);
      const activeWallet = activeInvoice ? savedKeys.find(w => w.id === activeInvoice.pixKeyId) : null;
      const paymentMethod = (activeWallet 
        ? (activeWallet.walletType === 'PIX_AUTO' ? 'PIX' : activeWallet.walletType) 
        : 'CREDIT_CARD') as 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';

      // Complete simulation payment
      handleSimulatePayment(paymentMethod);
      
      // Reset card details
      setCardNumber('');
      setCardHolder('');
      setCardExpiry('');
      setCardCvv('');
      setCardErrors({});
    }, 1500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!clientId) newErrors.client = 'Selecione um cliente';
    if (!description.trim()) newErrors.description = 'A descrição do faturamento é obrigatória';
    
    const amountVal = parseBRLToNumber(amountRaw);
    const entryVal = entryAmountRaw ? parseBRLToNumber(entryAmountRaw) : 0;

    if (amountVal <= 0) newErrors.amount = 'O valor total deve ser maior que R$ 0,00';
    if (entryVal < 0) newErrors.entryAmount = 'O valor de entrada não pode ser negativo';
    if (entryVal >= amountVal) newErrors.entryAmount = 'O valor de entrada deve ser menor que o valor total';
    if (!pixKeyId) newErrors.pixKey = 'Selecione uma chave PIX para receber';
    if (!firstDueDate) newErrors.dueDate = 'Data de vencimento é obrigatória';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const key = savedKeys.find(k => k.id === pixKeyId)!;
    
    // Generate Installments
    const newInstallments: Installment[] = [];
    const firstDate = new Date(firstDueDate + 'T12:00:00');

    let finalTotalAmount = 0;
    let totalFee = 0;
    let routedGatewayName: string | undefined = undefined;

    const invoiceNum = invoices.length > 0 
      ? String(Math.max(...invoices.map(inv => parseInt(inv.invoiceNumber) || 1000)) + 1)
      : '1001';

    // 1. Entrada (se houver)
    if (entryVal > 0) {
      const todayString = new Date().toISOString().split('T')[0];
      let pixPayload = '';
      let instGateway = undefined;
      let instFee = undefined;
      let instAmount = entryVal;

      if (key.walletType === 'PIX') {
        pixPayload = generatePixPayload({
          key: key.key,
          keyType: key.type,
          name: key.name,
          city: key.city,
          amount: instAmount,
          description: `#${invoiceNum} Entrada`.substring(0, 72)
        });
        finalTotalAmount += instAmount;
      } else if (key.walletType === 'PIX_AUTO') {
        const route = routePixPayment(instAmount, routingSettings || {
          threshold: 100,
          below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
          above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
        });

        instGateway = route.gateway;
        instFee = route.fee;
        instAmount = route.total;
        
        pixPayload = generatePixPayload({
          key: route.key,
          keyType: route.key.includes('@') ? 'EMAIL' : 'RANDOM',
          name: `MandaPIX Central (${route.gateway})`,
          city: 'SAO PAULO',
          amount: route.total,
          description: `#${invoiceNum} Entrada`.substring(0, 72)
        });

        finalTotalAmount += route.total;
        totalFee += route.fee;
        routedGatewayName = route.gateway;
      } else {
        pixPayload = `card_payment_token_${Date.now()}_entry_${instAmount}`;
        finalTotalAmount += instAmount;
      }

      newInstallments.push({
        id: `inst-${Date.now()}-entry`,
        number: 1,
        amount: instAmount,
        dueDate: todayString,
        status: 'PENDENTE',
        pixPayload,
        paymentMethodUsed: key.walletType === 'PIX_AUTO' ? 'PIX' : key.walletType as any,
        routedGateway: instGateway,
        transactionFee: instFee
      } as any);
    }

    // 2. Parcelas restantes
    const totalRemaining = amountVal - entryVal;
    const installmentValue = parseFloat((totalRemaining / installmentsCount).toFixed(2));

    for (let i = 1; i <= installmentsCount; i++) {
      const installmentNumber = entryVal > 0 ? (i + 1) : i;
      const dueDateObj = new Date(firstDate);
      dueDateObj.setMonth(firstDate.getMonth() + (i - 1));
      
      const dueDateString = dueDateObj.toISOString().split('T')[0];
      let instAmount = i === installmentsCount 
        ? parseFloat((totalRemaining - (installmentValue * (installmentsCount - 1))).toFixed(2)) // Adjust last rounding cents
        : installmentValue;

      let pixPayload = '';
      let instGateway = undefined;
      let instFee = undefined;

      const descLabel = entryVal > 0 
        ? `#${invoiceNum} Parc ${i}/${installmentsCount}`
        : `#${invoiceNum} Parc ${i}/${installmentsCount}`;

      if (key.walletType === 'PIX') {
        pixPayload = generatePixPayload({
          key: key.key,
          keyType: key.type,
          name: key.name,
          city: key.city,
          amount: instAmount,
          description: descLabel.substring(0, 72)
        });
        finalTotalAmount += instAmount;
      } else if (key.walletType === 'PIX_AUTO') {
        const route = routePixPayment(instAmount, routingSettings || {
          threshold: 100,
          below: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-abaixo@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-abaixo@mandapix.com' } },
          above: { asaas: { fixed: 0.99, percent: 0, key: 'asaas-acima@mandapix.com' }, efi: { fixed: 0, percent: 1.19, key: 'efi-acima@mandapix.com' } }
        });

        instGateway = route.gateway;
        instFee = route.fee;
        instAmount = route.total;
        
        pixPayload = generatePixPayload({
          key: route.key,
          keyType: route.key.includes('@') ? 'EMAIL' : 'RANDOM',
          name: `MandaPIX Central (${route.gateway})`,
          city: 'SAO PAULO',
          amount: route.total,
          description: descLabel.substring(0, 72)
        });

        finalTotalAmount += route.total;
        totalFee += route.fee;
        routedGatewayName = route.gateway;
      } else {
        pixPayload = `card_payment_token_${Date.now()}_${instAmount}`;
        finalTotalAmount += instAmount;
      }

      newInstallments.push({
        id: `inst-${Date.now()}-${installmentNumber}`,
        number: installmentNumber,
        amount: instAmount,
        dueDate: dueDateString,
        status: 'PENDENTE',
        pixPayload,
        paymentMethodUsed: key.walletType === 'PIX_AUTO' ? 'PIX' : key.walletType as any,
        routedGateway: instGateway,
        transactionFee: instFee
      } as any);
    }

    const newInvoiceNum = invoices.length > 0 
      ? String(Math.max(...invoices.map(inv => parseInt(inv.invoiceNumber) || 1000)) + 1)
      : '1001';

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: newInvoiceNum,
      clientId,
      productServiceId: productServiceId === 'manual' ? undefined : productServiceId,
      description: description.trim(),
      totalAmount: parseFloat(finalTotalAmount.toFixed(2)),
      dateCreated: new Date().toISOString().split('T')[0],
      installmentsCount: entryVal > 0 ? installmentsCount + 1 : installmentsCount,
      pixKeyId,
      walletId: pixKeyId,
      paymentMethodUsed: key.walletType === 'PIX_AUTO' ? 'PIX' : key.walletType as any,
      installments: newInstallments,
      routedGateway: routedGatewayName,
      transactionFee: totalFee > 0 ? parseFloat(totalFee.toFixed(2)) : undefined
    } as any;

    onAddInvoice(newInvoice);

    // Reset fields
    setClientId('');
    setProductServiceId('manual');
    setDescription('');
    setAmountRaw('');
    setEntryAmountRaw('');
    setInstallmentsCount(1);
    setErrors({});
    setIsAdding(false);
  };

  const handleDelete = (id: string, number: string) => {
    if (confirm(`Deseja realmente excluir a cobrança #${number}? Esta ação não pode ser desfeita.`)) {
      onDeleteInvoice(id);
      setSelectedInvoice(null);
    }
  };

  // Map client helper
  const getClientName = (id: string) => {
    const cli = clients.find(c => c.id === id);
    return cli ? cli.name : 'Cliente Excluído';
  };

  // Filter invoices based on status filter and search query
  const filteredInvoices = invoices.filter(inv => {
    const clientName = getClientName(inv.clientId).toLowerCase();
    const desc = inv.description.toLowerCase();
    const num = inv.invoiceNumber;
    const matchesSearch = clientName.includes(search.toLowerCase()) || desc.includes(search.toLowerCase()) || num.includes(search);
    
    if (!matchesSearch) return false;

    if (statusFilter === 'TODOS') return true;

    // Check installment statuses
    const installmentStatuses = inv.installments.map(inst => getInstallmentDisplayStatus(inst));

    if (statusFilter === 'PAGO') {
      // Invoice is fully paid if all installments are PAGO
      return installmentStatuses.every(s => s === 'PAGO');
    }
    
    if (statusFilter === 'VENCIDO') {
      // Invoice has at least one overdue installment
      return installmentStatuses.some(s => s === 'VENCIDO');
    }

    if (statusFilter === 'A_VENCER') {
      // Invoice has pending installments, none of which are overdue
      const hasPending = installmentStatuses.some(s => s === 'A_VENCER');
      const hasOverdue = installmentStatuses.some(s => s === 'VENCIDO');
      return hasPending && !hasOverdue;
    }

    return true;
  }).sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber)); // Newer invoices first

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-pix" /> Gerenciar Vendas
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">Controle de faturamentos, parcelamento e recebíveis dos clientes</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Gerar pedido
          </button>
        )}
      </div>

      {/* Content scroll box */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isAdding ? (
          /* NEW BILLING FORM */
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg">Novo Pedido</h3>
              <button
                onClick={() => { setIsAdding(false); setErrors({}); }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <h4 className="font-bold text-slate-700">Nenhum cliente cadastrado</h4>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                  Para emitir uma cobrança ou faturamento parcelado, cadastre pelo menos um cliente no painel primeiro.
                </p>
                <button
                  onClick={onNavigateToClients}
                  className="bg-pix text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-pix-dark transition-all"
                >
                  Cadastrar Cliente Agora
                </button>
              </div>
            ) : savedKeys.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <Landmark className="w-12 h-12 text-amber-500 mx-auto" />
                <h4 className="font-bold text-slate-700">Nenhuma chave PIX cadastrada</h4>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                  Você precisa cadastrar uma chave receptora PIX nas configurações para gerar os códigos e QR Codes de faturamento.
                </p>
                <button
                  onClick={onNavigateToKeys}
                  className="bg-pix text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-pix-dark transition-all"
                >
                  Configurar Chaves PIX
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddSubmit} className="space-y-4">
                {/* Client Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cliente Beneficiário</label>
                  <select
                    value={clientId}
                    onChange={(e) => { setClientId(e.target.value); if (errors.client) setErrors(prev => ({ ...prev, client: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.client ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  >
                    <option value="">-- Selecione o Cliente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
                    ))}
                  </select>
                  {errors.client && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.client}</p>}
                </div>

                {/* Catalog Item Select */}
                {products.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Item do Catálogo (Opcional - Preenchimento Rápido)</label>
                    <select
                      value={productServiceId}
                      onChange={handleProductSelectChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white"
                    >
                      <option value="manual">-- Preencher manualmente --</option>
                      {catalogs.map(cat => {
                        const catProds = products.filter(p => p.catalogId === cat.id);
                        if (catProds.length === 0) return null;
                        return (
                          <optgroup key={cat.id} label={cat.name}>
                            {catProds.map(p => (
                              <option key={p.id} value={p.id}>
                                [{p.type === 'SERVICO' ? 'Serv' : 'Prod'}] {p.name} - R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição do Faturamento / Serviço</label>
                  <input
                    type="text"
                    placeholder="Ex: Desenvolvimento de site, Venda de Equipamento, etc."
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(prev => ({ ...prev, description: '' })); }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.description ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.description && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Value */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor Total Cobrado</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={amountRaw}
                        onChange={handleCurrencyChange}
                        className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-bold ${errors.amount ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                      />
                    </div>
                    {errors.amount && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.amount}</p>}
                  </div>

                  {/* Valor de Entrada */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor de Entrada (Opcional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={entryAmountRaw}
                        onChange={handleEntryAmountChange}
                        className={`w-full pl-9 pr-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.entryAmount ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                      />
                    </div>
                    {errors.entryAmount && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.entryAmount}</p>}
                  </div>

                  {/* Installments Count */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Parcelamento</label>
                    <select
                      value={installmentsCount}
                      onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white font-semibold"
                    >
                      <option value={1}>À vista (1x)</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
                        const totalVal = parseBRLToNumber(amountRaw);
                        const entryVal = entryAmountRaw ? parseBRLToNumber(entryAmountRaw) : 0;
                        const remainingVal = totalVal - entryVal;
                        const valuePerInstallment = remainingVal > 0 ? (remainingVal / n) : 0;
                        return (
                          <option key={n} value={n}>
                            {n}x de R$ {valuePerInstallment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Pix Key */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Receber na Chave</label>
                    <select
                      value={pixKeyId}
                      onChange={(e) => { setPixKeyId(e.target.value); if (errors.pixKey) setErrors(prev => ({ ...prev, pixKey: '' })); }}
                      className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.pixKey ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                    >
                      {savedKeys.map(k => (
                        <option key={k.id} value={k.id}>
                          {k.label} {k.walletType === 'PIX_AUTO' ? '(PIX Automatizado + Taxas)' : `(${k.key})`}
                        </option>
                      ))}
                    </select>
                    {errors.pixKey && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.pixKey}</p>}
                  </div>

                  {/* Due Date of first installment */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Vencimento da 1ª Parcela</label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => { setFirstDueDate(e.target.value); if (errors.dueDate) setErrors(prev => ({ ...prev, dueDate: '' })); }}
                      className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.dueDate ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                    />
                    {errors.dueDate && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.dueDate}</p>}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-pix hover:bg-pix-dark text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-pix/10 active:scale-98 text-sm flex items-center justify-center gap-1"
                  >
                    Gerar Pedido <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* BILLS LIST VIEW & METRICS ROW */
          <div className="space-y-6">
            {/* Filter and search controls */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              {/* Search Bar */}
              <div className="relative max-w-sm flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, descrição, título..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all"
                />
              </div>

              {/* Status pills filters */}
              <div className="flex flex-wrap gap-1">
                {(['TODOS', 'PAGO', 'A_VENCER', 'VENCIDO'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                      statusFilter === filter
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {filter === 'TODOS' ? 'Todos' : filter === 'PAGO' ? 'Pago' : filter === 'A_VENCER' ? 'A Vencer' : 'Vencidos'}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices List Display */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
                <History className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhuma cobrança encontrada</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  {search || statusFilter !== 'TODOS' 
                    ? 'Nenhuma fatura coincide com os filtros selecionados.' 
                    : 'Registre novos faturamentos e acompanhe os recebimentos.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredInvoices.map((inv) => {
                  const clientName = getClientName(inv.clientId);
                  const paidInsts = inv.installments.filter(i => i.status === 'PAGO').length;
                  
                  // Compute overall invoice payment indicator
                  const isFullyPaid = paidInsts === inv.installmentsCount;
                  
                  // Check if any installment is overdue
                  const hasOverdue = inv.installments.some(i => getInstallmentDisplayStatus(i) === 'VENCIDO');

                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-slate-200 hover:shadow-subtle transition-all cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden group"
                    >
                      {/* Top bar info */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-slate-400">#CN-{inv.invoiceNumber}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              isFullyPaid
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : hasOverdue
                                ? 'bg-red-50 border-red-100 text-red-700'
                                : 'bg-amber-50 border-amber-100 text-amber-700'
                            }`}>
                              {isFullyPaid 
                                ? 'Total Pago' 
                                : hasOverdue 
                                ? 'Parcela Vencida' 
                                : 'A Vencer'}
                            </span>
                            
                            <span className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {paidInsts}/{inv.installmentsCount} Parc.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <h4 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{clientName}</h4>
                        </div>
                        
                        <p className="text-slate-500 font-medium text-xs line-clamp-1 italic">
                          "{inv.description}"
                        </p>
                      </div>

                      {/* Footer value & quick click */}
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Valor Total</span>
                          <span className="font-extrabold text-slate-800 text-base">{formatBRL(inv.totalAmount)}</span>
                        </div>
                        
                        {(inv as any).routedGateway && (
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Taxa Roteamento</span>
                            <span className="text-[11px] font-bold text-teal-600 bg-teal-50/50 border border-teal-100 px-1.5 py-0.5 rounded-md">
                              {formatBRL((inv as any).transactionFee || 0)} ({(inv as any).routedGateway})
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}
                            className="text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detalhar
                          </button>
                          
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(inv.id, inv.invoiceNumber); }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all"
                            title="Remover Faturamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL DRAWER */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end animate-fade-in">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
              <div>
                <span className="font-mono text-[10px] font-bold text-slate-400">Contrato #CN-{selectedInvoice.invoiceNumber}</span>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-1 mt-0.5 uppercase">
                  <User className="w-4 h-4 text-pix" /> {getClientName(selectedInvoice.clientId)}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {!isEditingInvoice && (
                  <button
                    onClick={startEditInvoice}
                    className="p-1.5 text-slate-400 hover:text-pix rounded-lg hover:bg-slate-50 transition-all mr-1"
                    title="Editar faturamento"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedInvoice.id, selectedInvoice.invoiceNumber)}
                  className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-50 transition-all mr-1"
                  title="Excluir cobrança"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setSelectedInvoice(null); setIsEditingInvoice(false); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isEditingInvoice ? (
              <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-slate-50/50">
                  
                  {/* Edit Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 shadow-sm"
                    />
                  </div>

                  {/* Edit Client */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cliente</label>
                    <select
                      value={editClientId}
                      onChange={(e) => setEditClientId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 shadow-sm"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Edit Pix Key */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Chave de Recebimento</label>
                    <select
                      value={editPixKeyId}
                      onChange={(e) => setEditPixKeyId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 shadow-sm"
                    >
                      {savedKeys.map(k => (
                        <option key={k.id} value={k.id}>
                          {k.label} {k.walletType === 'PIX_AUTO' ? '(PIX Automatizado + Taxas)' : `(${k.key})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Edit Installments List */}
                  <div>
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ajuste de Parcelas</span>
                    <div className="space-y-3.5">
                      {editInstallments.map((inst) => {
                        const isPaid = inst.status === 'PAGO';
                        const dispStatus = getInstallmentDisplayStatus(inst);
                        return (
                          <div key={inst.id} className="bg-white p-4 border border-slate-100 rounded-2xl space-y-3 shadow-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-700">Parcela {inst.number}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : dispStatus === 'VENCIDO'
                                  ? 'bg-red-50 text-red-700 border-red-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-100'
                              }`}>
                                {isPaid ? 'Pago' : dispStatus === 'VENCIDO' ? 'Vencida' : 'A Vencer'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Valor (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={isPaid}
                                  value={inst.amount}
                                  onChange={(e) => handleEditInstallmentAmount(inst.id, e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 disabled:opacity-50 font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Vencimento</label>
                                <input
                                  type="date"
                                  disabled={isPaid}
                                  value={inst.dueDate}
                                  onChange={(e) => handleEditInstallmentDueDate(inst.id, e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 disabled:opacity-50 font-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Edit Form Footer */}
                <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-xl text-xs transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-pix hover:bg-pix-dark text-white font-bold py-2 px-6 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-pix/10"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar bg-slate-50/50">
                  
                  {/* Summary Box */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Valor Total Geral</span>
                        <p className="font-extrabold text-slate-800 text-lg">{formatBRL(selectedInvoice.totalAmount)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Data de Emissão</span>
                        <p className="font-semibold text-slate-700 text-sm mt-0.5">{new Date(selectedInvoice.dateCreated + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    {(selectedInvoice as any).routedGateway && (
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-2.5">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Gateway Roteado</span>
                          <p className="font-bold text-pix text-xs mt-0.5">{(selectedInvoice as any).routedGateway}</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Taxa Roteamento</span>
                          <p className="font-bold text-slate-700 text-xs mt-0.5">{formatBRL((selectedInvoice as any).transactionFee || 0)}</p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-50 pt-2.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Descrição do Contrato</span>
                      <p className="text-slate-700 text-xs font-semibold">{selectedInvoice.description}</p>
                    </div>
                  </div>

                  {/* Installments Checklist */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Parcelas e Recebíveis</h4>
                    
                    <div className="space-y-2.5">
                      {selectedInvoice.installments.map((inst) => {
                        const dispStatus = getInstallmentDisplayStatus(inst);
                        return (
                          <div
                            key={inst.id}
                            className="bg-white p-3.5 border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm hover:border-slate-200 transition-all"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 text-xs">Parcela {inst.number} de {selectedInvoice.installmentsCount}</span>
                              <span className="text-[10px] text-slate-400 font-semibold block flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" /> Vencimento: {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-extrabold text-xs text-slate-800">{formatBRL(inst.amount)}</span>
                                
                                {/* Color Tag */}
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                  dispStatus === 'PAGO'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : dispStatus === 'VENCIDO'
                                    ? 'bg-red-50 text-red-700 border-red-100'
                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                                }`}>
                                  {dispStatus === 'PAGO' ? 'Pago' : dispStatus === 'VENCIDO' ? 'Vencida' : 'A Vencer'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Pix Code Button */}
                                <button
                                  onClick={() => setActiveInstallment({
                                    invoiceId: selectedInvoice.id,
                                    installment: inst,
                                    invoiceNumber: selectedInvoice.invoiceNumber,
                                    clientName: getClientName(selectedInvoice.clientId)
                                  })}
                                  className="p-1.5 rounded-lg bg-pix/10 hover:bg-pix/20 text-pix border border-pix/25 flex items-center justify-center transition-all active:scale-90"
                                  title="Visualizar Pix / QR Code"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>

                                {/* Mark paid toggle */}
                                <button
                                  onClick={() => {
                                    const nextStatus = inst.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
                                    onUpdateInstallmentStatus(selectedInvoice.id, inst.id, nextStatus);
                                    // Sync local modal selectedInvoice state
                                    setSelectedInvoice(prev => {
                                      if (!prev) return null;
                                      const updatedInsts = prev.installments.map(i => 
                                        i.id === inst.id 
                                          ? ({ 
                                              ...i, 
                                              status: nextStatus,
                                              confirmedDate: nextStatus === 'PAGO' ? new Date().toISOString().split('T')[0] : undefined 
                                            } as Installment) 
                                          : i
                                      );
                                      return { ...prev, installments: updatedInsts };
                                    });
                                  }}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    inst.status === 'PAGO'
                                      ? 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                                  }`}
                                  title={inst.status === 'PAGO' ? 'Marcar como Pendente' : 'Marcar como Recebido'}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-5 border-t border-slate-100 bg-white flex justify-end flex-shrink-0">
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-slate-900/10"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* PIX QR CODE / CARD PAYMENT DRAWER MODAL OVERLAY */}
      {activeInstallment && (() => {
        const activeInvoice = invoices.find(inv => inv.id === activeInstallment.invoiceId);
        const activeWallet = activeInvoice ? savedKeys.find(w => w.id === activeInvoice.pixKeyId) : null;
        const activeWalletType = activeWallet ? activeWallet.walletType : 'PIX';
        
        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 shadow-2xl flex flex-col justify-between animate-scale-in">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-pix" /> Cobrança #CN-{activeInstallment.invoiceNumber}
                </span>
                <button
                  onClick={() => { setActiveInstallment(null); setCardErrors({}); }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 flex flex-col items-center text-center space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cliente: {activeInstallment.clientName}</span>
                  <h3 className="font-extrabold text-2xl text-slate-800">{formatBRL(activeInstallment.installment.amount)}</h3>
                  <span className="text-[9px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                    Parcela {activeInstallment.installment.number} • Vence em {new Date(activeInstallment.installment.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {activeInstallment.installment.status !== 'PAGO' ? (
                  (activeWalletType === 'PIX' || activeWalletType === 'PIX_AUTO') ? (
                    <>
                      {/* Canvas QR Code */}
                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-inner relative">
                        <canvas ref={qrCanvasRef} />
                        
                        {/* Floating PIX Logo */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-white rounded-xl shadow-md border border-slate-50 flex items-center justify-center text-pix">
                          <svg viewBox="0 0 135 135" className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
                            <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-[#101929]" fillOpacity="0.85" />
                            <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
                          </svg>
                        </div>
                      </div>

                      {/* Copy Paste line */}
                      <div className="w-full text-left space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Linha Copia e Cola</span>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 font-mono text-[9px] text-slate-500 break-all select-all max-h-[70px] overflow-y-auto no-scrollbar shadow-inner">
                          {activeInstallment.installment.pixPayload}
                        </div>
                        
                        <button
                          onClick={handleCopyPix}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                            copied
                              ? 'bg-emerald-500/10 border-emerald-300 text-emerald-600 font-extrabold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-98 shadow-sm'
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500" /> Pix Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" /> Copiar Código Pix
                            </>
                          )}
                        </button>
                      </div>

                      {/* Payment Simulator Button */}
                      <button
                        onClick={() => handleSimulatePayment('PIX')}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-amber-500/10 transition-all active:scale-95"
                      >
                        Simular Recebimento PIX
                      </button>
                    </>
                  ) : (
                    /* CARD CHECKOUT SIMULATION FORM */
                    <form onSubmit={handleCardSubmit} className="w-full text-left space-y-3.5 animate-fade-in text-xs">
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-150 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Provedor/Gateway:</span>
                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 uppercase">
                          {activeWallet?.cardProvider || 'Cartão'}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número do Cartão</label>
                        <input
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          disabled={isProcessingCard}
                          className={`w-full px-3 py-2 border rounded-xl bg-slate-50 text-slate-800 font-mono focus:outline-none transition-all ${
                            cardErrors.number ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'
                          }`}
                        />
                        {cardErrors.number && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{cardErrors.number}</p>}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Impresso no Cartão</label>
                        <input
                          type="text"
                          placeholder="Ex: JOAO SILVA"
                          value={cardHolder}
                          onChange={(e) => { setCardHolder(e.target.value.toUpperCase()); setCardErrors(prev => ({ ...prev, holder: '' })); }}
                          disabled={isProcessingCard}
                          className={`w-full px-3 py-2 border rounded-xl bg-slate-50 text-slate-800 focus:outline-none transition-all ${
                            cardErrors.holder ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'
                          }`}
                        />
                        {cardErrors.holder && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{cardErrors.holder}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Validade</label>
                          <input
                            type="text"
                            placeholder="MM/AA"
                            value={cardExpiry}
                            onChange={handleCardExpiryChange}
                            disabled={isProcessingCard}
                            className={`w-full px-3 py-2 border rounded-xl bg-slate-50 text-slate-800 focus:outline-none transition-all ${
                              cardErrors.expiry ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'
                            }`}
                          />
                          {cardErrors.expiry && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{cardErrors.expiry}</p>}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CVV</label>
                          <input
                            type="text"
                            placeholder="123"
                            value={cardCvv}
                            onChange={handleCardCvvChange}
                            disabled={isProcessingCard}
                            className={`w-full px-3 py-2 border rounded-xl bg-slate-50 text-slate-800 focus:outline-none transition-all ${
                              cardErrors.cvv ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'
                            }`}
                          />
                          {cardErrors.cvv && <p className="text-red-500 text-[9px] mt-0.5 ml-1">{cardErrors.cvv}</p>}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isProcessingCard}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 shadow-md"
                      >
                        {isProcessingCard ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Processando...</span>
                          </>
                        ) : (
                          <span>Pagar com {activeWalletType === 'CREDIT_CARD' ? 'Crédito' : 'Débito'}</span>
                        )}
                      </button>
                    </form>
                  )
                ) : (
                  /* RECEIPT GRAPHIC IN MODAL */
                  <div className="py-4 space-y-4 w-full">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/25 mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2">
                      <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Status</span>
                        <span className="font-extrabold text-emerald-600">PAGO</span>
                      </div>
                      <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Meio de Pagamento</span>
                        <span className="font-semibold text-slate-700">
                          {activeInstallment.installment.paymentMethodUsed === 'CREDIT_CARD'
                            ? `Cartão de Crédito (${activeWallet?.cardProvider || 'Gateway'})`
                            : activeInstallment.installment.paymentMethodUsed === 'DEBIT_CARD'
                            ? `Cartão de Débito (${activeWallet?.cardProvider || 'Gateway'})`
                            : 'PIX'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-emerald-100/50 pb-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Confirmação</span>
                        <span className="font-semibold text-slate-700">Transação Autorizada</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Data Liquidação</span>
                        <span className="font-semibold text-slate-700">
                          {activeInstallment.installment.confirmedDate 
                            ? new Date(activeInstallment.installment.confirmedDate + 'T12:00:00').toLocaleDateString('pt-BR') 
                            : new Date().toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveInstallment(null)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
export default InvoiceManager;
