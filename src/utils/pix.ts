// PIX Static Payload Generator and Validation Utilities
// Specifications by Central Bank of Brazil (Banco Central do Brasil)

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

/**
 * Calculates CRC-16 CCITT (polynomial 0x1021, init 0xFFFF, no reverse, no final XOR)
 * equivalent to CRC-16/CCITT-FALSE
 */
export function calculateCRC16(data: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  
  for (let i = 0; i < data.length; i++) {
    const b = data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = ((b >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }
  
  crc &= 0xFFFF;
  const hex = crc.toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

export interface PixPayloadOptions {
  key: string;
  keyType: PixKeyType;
  name: string;
  city: string;
  amount?: number;
  description?: string;
  txid?: string;
}

/**
 * Generates the BR Code string (PIX Copia e Cola / QR Code payload)
 */
export function generatePixPayload({
  key,
  keyType,
  name,
  city,
  amount,
  description,
  txid = '***'
}: PixPayloadOptions): string {
  
  // Helper to format EMV Tag-Length-Value
  const formatTag = (tag: string, value: string): string => {
    const len = value.length.toString().padStart(2, '0');
    return `${tag}${len}${value}`;
  };

  // Normalize string for PIX (removes accents, keeps alphanumeric and spaces, max lengths)
  const cleanString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-zA-Z0-9 ]/g, '') // keep only alphanumeric and spaces
      .toUpperCase();
  };

  const cleanName = cleanString(name).substring(0, 25).trim();
  const cleanCity = cleanString(city).substring(0, 15).trim();
  const formattedKey = formatKeyForPayload(keyType, key);

  // Tag 26: Merchant Account Information
  const gui = formatTag('00', 'br.gov.bcb.pix');
  const keyTag = formatTag('01', formattedKey);
  
  // Custom description tag inside Tag 26 (sub-tag 02)
  const descTag = description && description.trim().length > 0
    ? formatTag('02', cleanString(description).substring(0, 72).trim())
    : '';

  const merchantAccountInfo = formatTag('26', `${gui}${keyTag}${descTag}`);

  const parts = [
    formatTag('00', '01'), // Payload Format Indicator (Fixed to '01')
    merchantAccountInfo,   // Merchant Account Info (Tag 26)
    formatTag('52', '0000'), // Merchant Category Code (Fixed to '0000')
    formatTag('53', '986'), // Transaction Currency (Fixed to '986' - BRL)
  ];

  if (amount && amount > 0) {
    parts.push(formatTag('54', amount.toFixed(2))); // Transaction Amount (Tag 54)
  }

  parts.push(
    formatTag('58', 'BR'), // Country Code (Tag 58)
    formatTag('59', cleanName || 'RECEBEDOR'), // Merchant Name (Tag 59)
    formatTag('60', cleanCity || 'SAO PAULO') // Merchant City (Tag 60)
  );

  // Tag 62: Additional Data Field Template
  const cleanTxid = cleanString(txid).replace(/\s+/g, '').substring(0, 25) || '***';
  const txidTag = formatTag('05', cleanTxid);
  parts.push(formatTag('62', txidTag));

  // Append CRC Tag (63) and placeholder length (04)
  const payloadWithoutCrc = parts.join('') + '6304';
  const crc = calculateCRC16(payloadWithoutCrc);
  
  return `${payloadWithoutCrc}${crc}`;
}

/**
 * Validates PIX key by its type
 */
export const validatePixKey = (type: PixKeyType, key: string): { isValid: boolean; error?: string } => {
  const trimmed = key.trim();
  if (!trimmed) {
    return { isValid: false, error: 'A chave não pode estar vazia' };
  }

  switch (type) {
    case 'CPF': {
      const clean = trimmed.replace(/\D/g, '');
      if (clean.length !== 11) return { isValid: false, error: 'CPF deve conter 11 números' };
      // Quick validation for block of same numbers
      if (/^(\d)\1+$/.test(clean)) return { isValid: false, error: 'CPF inválido' };
      
      // Calculate first digit
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
      let rev = 11 - (sum % 11);
      if (rev === 10 || rev === 11) rev = 0;
      if (rev !== parseInt(clean.charAt(9))) return { isValid: false, error: 'CPF inválido' };
      
      // Calculate second digit
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
      rev = 11 - (sum % 11);
      if (rev === 10 || rev === 11) rev = 0;
      if (rev !== parseInt(clean.charAt(10))) return { isValid: false, error: 'CPF inválido' };
      
      return { isValid: true };
    }
    case 'CNPJ': {
      const clean = trimmed.replace(/\D/g, '');
      if (clean.length !== 14) return { isValid: false, error: 'CNPJ deve conter 14 números' };
      if (/^(\d)\1+$/.test(clean)) return { isValid: false, error: 'CNPJ inválido' };
      
      // Simple length check for CNPJ validation
      return { isValid: true };
    }
    case 'PHONE': {
      const clean = trimmed.replace(/\D/g, '');
      // Expecting standard phone without country code (10 or 11 digits: e.g. 11999998888 or 1133334444)
      // Or with country code (12 or 13 digits)
      if (clean.length < 10 || clean.length > 13) {
        return { isValid: false, error: 'Telefone deve conter DDD + número (ex: 11999999999)' };
      }
      return { isValid: true };
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return { isValid: false, error: 'Formato de e-mail inválido' };
      }
      return { isValid: true };
    }
    case 'RANDOM': {
      // UUID format validation (36 characters with hyphens: 8-4-4-4-12)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(trimmed)) {
        return { isValid: false, error: 'Chave aleatória deve estar no formato UUID (ex: 123e4567-e89b-12d3-a456-426614174000)' };
      }
      return { isValid: true };
    }
    default:
      return { isValid: false, error: 'Tipo de chave inválido' };
  }
};

/**
 * Applies UI masks while typing
 */
export const maskPixKey = (type: PixKeyType, value: string): string => {
  const clean = value.replace(/\D/g, '');
  
  switch (type) {
    case 'CPF':
      return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
    case 'CNPJ':
      return clean
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .substring(0, 18);
    case 'PHONE':
      if (clean.length <= 10) {
        return clean
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
          .substring(0, 14);
      } else {
        return clean
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
          .substring(0, 15);
      }
    default:
      return value; // E-mail and Random keys have no numeric mask
  }
};

/**
 * Prepares the key string for use inside the Central Bank payload
 */
export const formatKeyForPayload = (type: PixKeyType, key: string): string => {
  const clean = key.replace(/\D/g, '');
  
  switch (type) {
    case 'CPF':
    case 'CNPJ':
      return clean;
    case 'PHONE':
      // Central Bank requires phone keys to be E.164: +55[DDD][NUMBER]
      if (clean.startsWith('55') && clean.length >= 12) {
        return `+${clean}`;
      }
      return `+55${clean}`;
    case 'RANDOM':
      return key.trim().toLowerCase();
    case 'EMAIL':
      return key.trim().toLowerCase();
    default:
      return key.trim();
  }
};

/**
 * Formats a number to BRL Currency (R$ 0,00)
 */
export const formatBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Parses currency string to a number
 */
export const parseBRLToNumber = (formattedValue: string): number => {
  const clean = formattedValue.replace(/[^\d]/g, '');
  if (!clean) return 0;
  return parseFloat(clean) / 100;
};

/**
 * Formats user input on-the-fly for BRL currencies
 */
export const formatCurrencyInput = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  const num = parseFloat(clean) / 100;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export type WalletType = 'PIX' | 'PIX_AUTO' | 'CREDIT_CARD' | 'DEBIT_CARD';

export interface PixRoutingGateway {
  fixed: number;
  percent: number;
  key: string;
}

export interface PixRoutingSettings {
  threshold: number;
  below: {
    asaas: PixRoutingGateway;
    efi: PixRoutingGateway;
  };
  above: {
    asaas: PixRoutingGateway;
    efi: PixRoutingGateway;
  };
}

export interface RoutedPayment {
  gateway: 'Asaas' | 'Efí';
  fee: number;
  key: string;
  total: number;
}

export function routePixPayment(amount: number, settings: PixRoutingSettings): RoutedPayment {
  const threshold = settings?.threshold ?? 100;
  const isBelow = amount < threshold;
  const rates = isBelow ? settings?.below : settings?.above;

  const asaasFixed = rates?.asaas?.fixed ?? 0.99;
  const asaasPercent = rates?.asaas?.percent ?? 0;
  const asaasKey = rates?.asaas?.key || 'asaas-default@mandapix.com';

  const efiFixed = rates?.efi?.fixed ?? 0;
  const efiPercent = rates?.efi?.percent ?? 1.19;
  const efiKey = rates?.efi?.key || 'efi-default@mandapix.com';

  const asaasCost = asaasFixed + (amount * asaasPercent / 100);
  const efiCost = efiFixed + (amount * efiPercent / 100);

  const cheapest = asaasCost <= efiCost ? 'asaas' : 'efi';
  const fee = cheapest === 'asaas' ? asaasCost : efiCost;
  const routedKey = cheapest === 'asaas' ? asaasKey : efiKey;

  return {
    gateway: cheapest === 'asaas' ? 'Asaas' : 'Efí',
    fee: parseFloat(fee.toFixed(2)),
    key: routedKey,
    total: parseFloat((amount + fee).toFixed(2))
  };
}

export interface Wallet {
  id: string;
  walletType: WalletType;
  label: string;
  bankName: string;
  isPrimary: boolean;
  
  // PIX options
  type: PixKeyType;
  key: string;
  name: string;
  city: string;

  // Card details
  cardProvider?: string; // Stripe, Mercado Pago, Cielo, etc.
  accountIdentifier?: string; // e.g. Merchant ID or Account ID
}

export type SavedPixKey = Wallet;

export const BANKS = [
  { name: 'Nubank', gradient: 'from-purple-900 via-purple-800 to-indigo-950', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { name: 'Itaú', gradient: 'from-orange-600 via-orange-500 to-amber-700', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { name: 'Bradesco', gradient: 'from-red-800 via-red-700 to-rose-950', badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { name: 'Banco do Brasil', gradient: 'from-yellow-600 via-yellow-500 to-blue-900', badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { name: 'Caixa', gradient: 'from-blue-800 via-blue-700 to-indigo-950', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { name: 'Inter', gradient: 'from-amber-600 via-amber-500 to-orange-700', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { name: 'C6 Bank', gradient: 'from-zinc-800 via-zinc-700 to-zinc-900', badgeColor: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' },
  { name: 'Outro', gradient: 'from-teal-800 via-teal-700 to-emerald-900', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
];

export const DEFAULT_KEYS: SavedPixKey[] = [
  {
    id: 'key-default-auto',
    walletType: 'PIX_AUTO',
    type: 'RANDOM',
    key: 'automatico',
    name: 'Roteamento MandaPIX',
    city: 'SAO PAULO',
    label: 'PIX Automatizado + Taxas',
    bankName: 'MandaPIX',
    isPrimary: false,
  },
  {
    id: 'key-default-1',
    walletType: 'PIX',
    type: 'CPF',
    key: '123.456.789-00',
    name: 'José Carlos da Silva',
    city: 'SAO PAULO',
    label: 'Minha Chave Nubank',
    bankName: 'Nubank',
    isPrimary: true,
  },
  {
    id: 'key-default-2',
    walletType: 'PIX',
    type: 'EMAIL',
    key: 'pagamentos@mandapix.com.br',
    name: 'MandaPIX Negócios LTDA',
    city: 'BELO HORIZONTE',
    label: 'Recebimentos Empresa',
    bankName: 'Inter',
    isPrimary: false,
  },
  {
    id: 'wallet-default-cc',
    walletType: 'CREDIT_CARD',
    type: 'RANDOM',
    key: 'gateway_stripe',
    name: 'MandaPIX Tech',
    city: 'SAO PAULO',
    label: 'Stripe Gateway Crédito',
    bankName: 'Outro',
    isPrimary: false,
    cardProvider: 'Stripe',
    accountIdentifier: 'acct_123456789'
  },
  {
    id: 'wallet-default-dc',
    walletType: 'DEBIT_CARD',
    type: 'RANDOM',
    key: 'gateway_mercadopago',
    name: 'MandaPIX Tech',
    city: 'SAO PAULO',
    label: 'Mercado Pago Débito',
    bankName: 'Outro',
    isPrimary: false,
    cardProvider: 'Mercado Pago',
    accountIdentifier: 'mp_merchant_9876'
  }
];

export interface Store {
  id: string;
  name: string;
  description: string;
  color: string;
  document?: string;
  contact?: string;
  email?: string;
  legal_name?: string;
  address?: string;
}

export interface Client {
  id: string;
  storeId?: string;
  name: string;
  document: string;
  email: string;
  phone: string;
}

export interface Employee {
  id: string;
  tenantId?: string;
  storeId?: string;
  name: string;
  email: string;
  phone: string;
  role: 'GERENTE' | 'VENDEDOR' | 'ATENDENTE';
  accessCode: string;
  allowWallets?: boolean;
  commission_rate?: number;
}

export interface Catalog {
  id: string;
  storeId?: string;
  name: string;
  description: string;
}

export interface ProductService {
  id: string;
  catalogId: string;
  name: string;
  type: 'PRODUTO' | 'SERVICO';
  price: number;
  description: string;
  image?: string;
  stock_quantity?: number;
  commission_rate?: number;
  insumos?: Array<{ product_id: string; quantity: number }>;
}

export interface Installment {
  id: string;
  number: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'PENDENTE' | 'PAGO';
  pixPayload: string;
  confirmedDate?: string;
  paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
}

export interface Invoice {
  id: string;
  storeId?: string;
  invoiceNumber: string;
  clientId: string;
  productServiceId?: string;
  description: string;
  totalAmount: number;
  dateCreated: string;
  installmentsCount: number;
  pixKeyId: string; // Acts as walletId
  walletId?: string; // Clear named property mapping
  paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
  installments: Installment[];
  scheduleSlotId?: string;
  scheduleCalendarId?: string;
  scheduledAt?: string;
  routedGateway?: string;
  transactionFee?: number;
}

export const DEFAULT_STORES: Store[] = [
  { id: 'store-1', name: 'MandaPIX Tech', description: 'Consultoria de TI e Licenças de Software', color: 'from-blue-600 to-indigo-600' },
  { id: 'store-2', name: 'MandaPIX Cosméticos', description: 'Vendas de fragrâncias e autocuidado', color: 'from-pink-600 to-rose-600' }
];

export const DEFAULT_CLIENTS: Client[] = [
  { id: 'cli-1', storeId: 'store-1', name: 'Ana Júlia Pinheiro', document: '456.789.012-34', email: 'anajulia@gmail.com', phone: '(21) 99988-7766' },
  { id: 'cli-2', storeId: 'store-1', name: 'TechSolutions Ltda', document: '12.345.678/0001-90', email: 'financeiro@techsolutions.com', phone: '(11) 98765-4321' },
  { id: 'cli-3', storeId: 'store-1', name: 'Marcos Oliveira de Souza', document: '789.012.345-67', email: 'marcos.souza@yahoo.com', phone: '(31) 98877-6655' },
  { id: 'cli-4', storeId: 'store-2', name: 'Clara Vasconcelos', document: '321.654.987-00', email: 'clara.v@gmail.com', phone: '(11) 97766-5544' }
];

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp-1', storeId: 'store-1', name: 'Carlos Gerente', email: 'carlos@loja.com', phone: '(11) 99999-1111', role: 'GERENTE', accessCode: '1234' },
  { id: 'emp-2', storeId: 'store-1', name: 'Maria Vendedora', email: 'maria@loja.com', phone: '(11) 99999-2222', role: 'VENDEDOR', accessCode: '5678' }
];

export const DEFAULT_CATALOGS: Catalog[] = [
  { id: 'cat-1', storeId: 'store-1', name: 'Desenvolvimento & TI', description: 'Serviços de consultoria, websites e suporte de tecnologia' },
  { id: 'cat-2', storeId: 'store-2', name: 'Cosméticos & Cuidados', description: 'Produtos de beleza, perfumes e autocuidado' }
];

export const DEFAULT_PRODUCTS: ProductService[] = [
  { id: 'prod-1', catalogId: 'cat-1', name: 'Desenvolvimento Web Freelance', type: 'SERVICO', price: 3500.00, description: 'Criação de site responsivo em React e Tailwind' },
  { id: 'prod-2', catalogId: 'cat-1', name: 'Consultoria Mensal TI', type: 'SERVICO', price: 1200.00, description: 'Suporte e melhorias contínuas em sistemas' },
  { id: 'prod-3', catalogId: 'cat-1', name: 'Licença de Software ERP', type: 'PRODUTO', price: 450.00, description: 'Assinatura anual do sistema integrado' },
  { id: 'prod-4', catalogId: 'cat-2', name: 'Perfume Black Essential Charm', type: 'PRODUTO', price: 150.00, description: 'Fragrância masculina marcante' },
  { id: 'prod-5', catalogId: 'cat-2', name: 'Creme Corporal Avelã', type: 'PRODUTO', price: 65.00, description: 'Hidratante corporal 400ml' }
];

export const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    storeId: 'store-1',
    invoiceNumber: '1001',
    clientId: 'cli-2',
    productServiceId: 'prod-2',
    description: 'Consultoria TI Mensal - Maio',
    totalAmount: 1200.00,
    dateCreated: '2026-04-10',
    installmentsCount: 1,
    pixKeyId: 'key-default-1',
    installments: [
      {
        id: 'inst-1-1',
        number: 1,
        amount: 1200.00,
        dueDate: '2026-05-10',
        status: 'PAGO',
        pixPayload: '',
        confirmedDate: '2026-05-09'
      }
    ]
  },
  {
    id: 'inv-2',
    storeId: 'store-1',
    invoiceNumber: '1002',
    clientId: 'cli-1',
    productServiceId: 'prod-1',
    description: 'Desenvolvimento de Website Institucional',
    totalAmount: 3500.00,
    dateCreated: '2026-05-28',
    installmentsCount: 3,
    pixKeyId: 'key-default-1',
    installments: [
      {
        id: 'inst-2-1',
        number: 1,
        amount: 1166.67,
        dueDate: '2026-06-01',
        status: 'PAGO',
        pixPayload: '',
        confirmedDate: '2026-06-01'
      },
      {
        id: 'inst-2-2',
        number: 2,
        amount: 1166.67,
        dueDate: '2026-07-01',
        status: 'PENDENTE',
        pixPayload: ''
      },
      {
        id: 'inst-2-3',
        number: 3,
        amount: 1166.66,
        dueDate: '2026-08-01',
        status: 'PENDENTE',
        pixPayload: ''
      }
    ]
  },
  {
    id: 'inv-3',
    storeId: 'store-1',
    invoiceNumber: '1003',
    clientId: 'cli-3',
    productServiceId: 'prod-3',
    description: 'Licença ERP Anual Autônomo',
    totalAmount: 450.00,
    dateCreated: '2026-05-05',
    installmentsCount: 1,
    pixKeyId: 'key-default-1',
    installments: [
      {
        id: 'inst-3-1',
        number: 1,
        amount: 450.00,
        dueDate: '2026-06-05',
        status: 'PENDENTE',
        pixPayload: ''
      }
    ]
  },
  {
    id: 'inv-4',
    storeId: 'store-1',
    invoiceNumber: '1004',
    clientId: 'cli-2',
    productServiceId: 'prod-2',
    description: 'Consultoria TI Mensal - Junho',
    totalAmount: 1200.00,
    dateCreated: '2026-06-05',
    installmentsCount: 1,
    pixKeyId: 'key-default-2',
    installments: [
      {
        id: 'inst-4-1',
        number: 1,
        amount: 1200.00,
        dueDate: '2026-06-15',
        status: 'PENDENTE',
        pixPayload: ''
      }
    ]
  },
  {
    id: 'inv-5',
    storeId: 'store-2',
    invoiceNumber: '1005',
    clientId: 'cli-4',
    productServiceId: 'prod-4',
    description: 'Venda de Perfume Black Essential',
    totalAmount: 150.00,
    dateCreated: '2026-06-01',
    installmentsCount: 1,
    pixKeyId: 'key-default-1',
    installments: [
      {
        id: 'inst-5-1',
        number: 1,
        amount: 150.00,
        dueDate: '2026-06-10',
        status: 'PENDENTE',
        pixPayload: ''
      }
    ]
  }
];

export function initializeDefaultInvoices(keys: SavedPixKey[]): Invoice[] {
  return DEFAULT_INVOICES.map(inv => {
    const key = keys.find(k => k.id === inv.pixKeyId) || keys[0] || DEFAULT_KEYS[0];
    const installments = inv.installments.map(inst => {
      const payload = generatePixPayload({
        key: key.key,
        keyType: key.type,
        name: key.name,
        city: key.city,
        amount: inst.amount,
        description: `${inv.invoiceNumber} P${inst.number}`.substring(0, 72)
      });
      return { ...inst, pixPayload: payload };
    });
    return { ...inv, installments };
  });
}

export interface OrderItem {
  productServiceId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  storeId: string;
  orderNumber: string; // Ex: 1001, 1002
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientDocument: string;
  items: OrderItem[];
  totalAmount: number;
  status: string; // Dynamic status determined by branch flow
  dateCreated: string;
  invoiceId?: string; // Links to invoice
  scheduledAt?: string; // ISO datetime string for scheduled appointment
  scheduleSlotId?: string; // Reference to the schedule_slots row
  commission_split?: {
    professionalAmount: number;
    storeAmount: number;
    rate: number;
    employeeId?: string;
    employeeName?: string;
  } | null;
}

export interface BusinessBranch {
  id: string;
  key: string;
  name: string;
  initial_trigger: string;
  focus: string;
  order_status_flow: string[];
  config: {
    hide_agenda?: boolean;
    hide_kitchen?: boolean;
    hide_delivery?: boolean;
    main_screen?: 'pdv' | 'schedule' | 'orders';
  };
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// SCHEDULING TYPES
// ==========================================

/**
 * A named scheduling calendar belonging to a store.
 * A store can have multiple calendars, each linked to one or more catalogs.
 */
export interface ScheduleCalendar {
  id: string;
  storeId: string;
  name: string;                    // e.g. "Aline Lima Beauty – Atendimento"
  catalogIds: string[];            // Associated catalog IDs
  isEnabled: boolean;              // Habilita o módulo de agendamento neste calendário
  showSlotsToClient: boolean;      // Exibe vagas disponíveis para o cliente final
  requireScheduling: boolean;      // Torna seleção de slot obrigatória no pedido
  advanceDays: number;             // Janela de dias futuros disponíveis para agendar
  employee_id?: string;            // Linked professional/employee ID
}

export interface ScheduleSlot {
  id: string;
  calendarId: string;              // References ScheduleCalendar
  storeId: string;                 // Denormalized for easy filtering
  slotDate: string;                // YYYY-MM-DD
  slotTime: string;                // HH:MM
  maxCapacity: number;
  currentBookings: number;
  isEnabled: boolean;
}

// Legacy alias kept for backward compat inside StorefrontSimulator
export type ScheduleConfig = Pick<ScheduleCalendar,
  'isEnabled' | 'showSlotsToClient' | 'requireScheduling' | 'advanceDays'
>;


export const DEFAULT_ORDERS: Order[] = [
  {
    id: 'ord-1',
    storeId: 'store-1',
    orderNumber: '1001',
    clientName: 'TechSolutions Ltda',
    clientPhone: '(11) 98765-4321',
    clientEmail: 'financeiro@techsolutions.com',
    clientDocument: '12.345.678/0001-90',
    items: [
      {
        productServiceId: 'prod-2',
        name: 'Consultoria Mensal TI',
        quantity: 1,
        price: 1200.00
      }
    ],
    totalAmount: 1200.00,
    status: 'APROVADO',
    dateCreated: '2026-04-10',
    invoiceId: 'inv-1'
  },
  {
    id: 'ord-2',
    storeId: 'store-2',
    orderNumber: '1002',
    clientName: 'Clara Vasconcelos',
    clientPhone: '(11) 97766-5544',
    clientEmail: 'clara.v@gmail.com',
    clientDocument: '321.654.987-00',
    items: [
      {
        productServiceId: 'prod-4',
        name: 'Perfume Black Essential Charm',
        quantity: 1,
        price: 150.00
      }
    ],
    totalAmount: 150.00,
    status: 'PENDENTE',
    dateCreated: '2026-06-01',
    invoiceId: 'inv-5'
  },
  {
    id: 'ord-3',
    storeId: 'store-1',
    orderNumber: '1003',
    clientName: 'Marcos Oliveira de Souza',
    clientPhone: '(31) 98877-6655',
    clientEmail: 'marcos.souza@yahoo.com',
    clientDocument: '789.012.345-67',
    items: [
      {
        productServiceId: 'prod-3',
        name: 'Licença ERP Anual Autônomo',
        quantity: 1,
        price: 450.00
      }
    ],
    totalAmount: 450.00,
    status: 'PREPARACAO',
    dateCreated: '2026-05-05',
    invoiceId: 'inv-3'
  }
];

// ==========================================
// E-COMMERCE CONFIGURATION TYPES
// ==========================================

export interface CheckoutFieldConfig {
  show: boolean;
  required: boolean;
}

export interface CheckoutFields {
  name: CheckoutFieldConfig;
  document: CheckoutFieldConfig;
  email: CheckoutFieldConfig;
  phone: CheckoutFieldConfig;
  address: CheckoutFieldConfig;
}

export interface BusinessHourDay {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  open: string;
  close: string;
  closed: boolean;
  is24h?: boolean;
  hasInterval?: boolean;
  open2?: string;
  close2?: string;
}

export interface EcommerceSettings {
  store_id: string;
  is_enabled: boolean;
  catalog_ids: string[];
  payment_methods: Array<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'>;
  payment_wallets?: Record<string, string>;
  down_payment_enabled: boolean;
  down_payment_value: number;
  down_payment_type: 'percentage' | 'fixed';
  installments_enabled: boolean;
  max_installments: number;
  business_hours: BusinessHourDay[];
  show_schedule_calendar: boolean;
  checkout_fields: CheckoutFields;
  product_card_size?: 'small' | 'medium' | 'large';
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHourDay[] = [
  { day: 1, open: '08:00', close: '18:00', closed: false },
  { day: 2, open: '08:00', close: '18:00', closed: false },
  { day: 3, open: '08:00', close: '18:00', closed: false },
  { day: 4, open: '08:00', close: '18:00', closed: false },
  { day: 5, open: '08:00', close: '18:00', closed: false },
  { day: 6, open: '09:00', close: '13:00', closed: true },
  { day: 0, open: '09:00', close: '13:00', closed: true }
];

export const DEFAULT_CHECKOUT_FIELDS: CheckoutFields = {
  name: { show: true, required: true },
  document: { show: true, required: true },
  email: { show: true, required: true },
  phone: { show: true, required: true },
  address: { show: false, required: false }
};

export const slugify = (text: string): string => {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w-]+/g, '') // remove all non-word chars
    .replace(/--+/g, '-'); // replace multiple - with single -
};

/**
 * Parses an ISO datetime string while stripping any timezone offsets or Z designator.
 * This forces JavaScript's Date to parse it in the user's local timezone.
 */
export const parseScheduledDate = (dateStr: string | undefined | null): Date => {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.replace(/Z|[+-]\d{2}:\d{2}$/, '');
  return new Date(cleanStr);
};



