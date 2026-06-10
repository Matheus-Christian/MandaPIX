import { useState, useEffect } from 'react';
import { Home, History, Users, ArrowRight, ArrowLeft, FolderOpen, DollarSign, Calendar, Clock, TrendingUp, Menu, X, AlertCircle, ShoppingBag, ShoppingCart, Wallet } from 'lucide-react';
import { 
  DEFAULT_KEYS, 
  DEFAULT_CLIENTS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_CATALOGS,
  DEFAULT_STORES,
  DEFAULT_ORDERS,
  initializeDefaultInvoices, 
  formatBRL,
  generatePixPayload
} from './utils/pix';
import type { SavedPixKey, Client, ProductService, Invoice, Catalog, Store, Order, Installment } from './utils/pix';

import { VirtualCard } from './components/VirtualCard';
import { ClientManager } from './components/ClientManager';
import { CatalogManager } from './components/CatalogManager';
import { InvoiceManager } from './components/InvoiceManager';
import { SavedKeys } from './components/SavedKeys';
import { StoreManager } from './components/StoreManager';
import { OrderManager } from './components/OrderManager';
import { StorefrontSimulator } from './components/StorefrontSimulator';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stores' | 'wallets'>('dashboard');
  
  // Responsive Sidebar menu state for mobile drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // States
  const [stores, setStores] = useState<Store[]>(() => {
    const stored = localStorage.getItem('mandapix_stores');
    return stored ? JSON.parse(stored) : DEFAULT_STORES;
  });

  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'invoices' | 'clients' | 'catalogs'>('orders');
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>(() => {
    const stored = localStorage.getItem('mandapix_orders');
    return stored ? JSON.parse(stored) : DEFAULT_ORDERS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const stored = localStorage.getItem('mandapix_clients');
    return stored ? JSON.parse(stored) : DEFAULT_CLIENTS;
  });

  const [catalogs, setCatalogs] = useState<Catalog[]>(() => {
    const stored = localStorage.getItem('mandapix_catalogs');
    return stored ? JSON.parse(stored) : DEFAULT_CATALOGS;
  });

  const [products, setProducts] = useState<ProductService[]>(() => {
    const stored = localStorage.getItem('mandapix_products');
    return stored ? JSON.parse(stored) : DEFAULT_PRODUCTS;
  });

  const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>(() => {
    const storedWallets = localStorage.getItem('mandapix_saved_wallets');
    if (storedWallets) {
      try {
        return JSON.parse(storedWallets);
      } catch (e) {}
    }
    const storedKeys = localStorage.getItem('mandapix_saved_keys');
    if (storedKeys) {
      try {
        const parsed = JSON.parse(storedKeys);
        const migrated = parsed.map((k: any) => ({ ...k, walletType: k.walletType || 'PIX' }));
        localStorage.setItem('mandapix_saved_wallets', JSON.stringify(migrated));
        return migrated;
      } catch (e) {}
    }
    const defaults = DEFAULT_KEYS.map(k => ({ ...k, walletType: k.walletType || 'PIX' }));
    localStorage.setItem('mandapix_saved_wallets', JSON.stringify(defaults));
    return defaults;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const stored = localStorage.getItem('mandapix_invoices');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return initializeDefaultInvoices(DEFAULT_KEYS);
      }
    }
    return initializeDefaultInvoices(DEFAULT_KEYS);
  });

  // Dashboard filter state
  const [periodFilter, setPeriodFilter] = useState<'30_DAYS' | '90_DAYS' | 'THIS_MONTH' | 'ALL'>('ALL');

  // Local Storage Sync
  useEffect(() => {
    localStorage.setItem('mandapix_stores', JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem('mandapix_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('mandapix_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('mandapix_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('mandapix_catalogs', JSON.stringify(catalogs));
  }, [catalogs]);

  useEffect(() => {
    localStorage.setItem('mandapix_saved_wallets', JSON.stringify(savedKeys));
    localStorage.setItem('mandapix_saved_keys', JSON.stringify(savedKeys));
  }, [savedKeys]);

  useEffect(() => {
    localStorage.setItem('mandapix_invoices', JSON.stringify(invoices));
  }, [invoices]);

  // Migration for old products without catalogId or with invalid catalogId, and items without storeId
  useEffect(() => {
    let hasChanges = false;
    
    // 1. Ensure we have stores
    let currentStores = [...stores];
    if (stores.length === 0) {
      currentStores = DEFAULT_STORES;
      setStores(currentStores);
      localStorage.setItem('mandapix_stores', JSON.stringify(currentStores));
      hasChanges = true;
    }
    const defaultStoreId = currentStores[0]?.id || 'store-1';

    // 2. Ensure all clients have storeId
    const updatedClients = clients.map(c => {
      if (!c.storeId) {
        hasChanges = true;
        return { ...c, storeId: defaultStoreId };
      }
      return c;
    });

    // 3. Ensure catalogs exist and have storeId
    let updatedCatalogs = [...catalogs];
    if (catalogs.length === 0) {
      const defaultCat = {
        id: 'cat-general',
        storeId: defaultStoreId,
        name: 'Catálogo Geral',
        description: 'Catálogo contendo produtos cadastrados anteriormente'
      };
      updatedCatalogs = [defaultCat];
      setCatalogs(updatedCatalogs);
      localStorage.setItem('mandapix_catalogs', JSON.stringify(updatedCatalogs));
      hasChanges = true;
    } else {
      updatedCatalogs = catalogs.map(c => {
        if (!c.storeId) {
          hasChanges = true;
          return { ...c, storeId: defaultStoreId };
        }
        return c;
      });
    }

    const targetCatalogId = updatedCatalogs[0]?.id || 'cat-general';

    // 4. Ensure all products belong to a valid catalog
    const updatedProducts = products.map(p => {
      const catalogExists = updatedCatalogs.some(c => c.id === p.catalogId);
      if (!p.catalogId || !catalogExists) {
        hasChanges = true;
        return { ...p, catalogId: targetCatalogId };
      }
      return p;
    });

    // 5. Ensure all invoices have storeId
    const updatedInvoices = invoices.map(inv => {
      if (!inv.storeId) {
        hasChanges = true;
        const clientObj = updatedClients.find(c => c.id === inv.clientId);
        const invStoreId = clientObj?.storeId || defaultStoreId;
        return { ...inv, storeId: invStoreId };
      }
      return inv;
    });

    // 6. Ensure all orders have storeId
    const updatedOrders = orders.map(ord => {
      if (!ord.storeId) {
        hasChanges = true;
        return { ...ord, storeId: defaultStoreId };
      }
      return ord;
    });

    if (hasChanges) {
      setClients(updatedClients);
      localStorage.setItem('mandapix_clients', JSON.stringify(updatedClients));

      setCatalogs(updatedCatalogs);
      localStorage.setItem('mandapix_catalogs', JSON.stringify(updatedCatalogs));

      setProducts(updatedProducts);
      localStorage.setItem('mandapix_products', JSON.stringify(updatedProducts));

      setInvoices(updatedInvoices);
      localStorage.setItem('mandapix_invoices', JSON.stringify(updatedInvoices));

      setOrders(updatedOrders);
      localStorage.setItem('mandapix_orders', JSON.stringify(updatedOrders));
    }
  }, [stores, clients, catalogs, products, invoices, orders]);

  // Callbacks for Stores
  const handleAddStore = (newStoreData: Omit<Store, 'id'>) => {
    const newStore: Store = {
      id: `store-${Date.now()}`,
      ...newStoreData
    };
    setStores(prev => [...prev, newStore]);
  };

  const handleEditStore = (updatedStore: Store) => {
    setStores(prev => prev.map(s => s.id === updatedStore.id ? updatedStore : s));
  };

  const handleDeleteStore = (id: string) => {
    setStores(prev => prev.filter(s => s.id !== id));
    const catalogsToDelete = catalogs.filter(cat => cat.storeId === id).map(cat => cat.id);
    
    setClients(prev => prev.filter(c => c.storeId !== id));
    setCatalogs(prev => prev.filter(cat => cat.storeId !== id));
    setProducts(prev => prev.filter(p => !catalogsToDelete.includes(p.catalogId)));
    setInvoices(prev => prev.filter(inv => inv.storeId !== id));
    
    if (activeStoreId === id) {
      setActiveStoreId(null);
    }
  };

  // Callbacks for Clients
  const handleAddClient = (newClientData: Omit<Client, 'id'>) => {
    const newClient: Client = {
      id: `cli-${Date.now()}`,
      ...newClientData
    };
    setClients(prev => [...prev, newClient]);
  };

  const handleDeleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // Callbacks for Products
  const handleAddProduct = (newProductData: Omit<ProductService, 'id'>) => {
    const newProduct: ProductService = {
      id: `prod-${Date.now()}`,
      ...newProductData
    };
    setProducts(prev => [...prev, newProduct]);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Callbacks for Catalogs
  const handleAddCatalog = (newCatData: Omit<Catalog, 'id'>) => {
    const newCat: Catalog = {
      id: `cat-${Date.now()}`,
      ...newCatData
    };
    setCatalogs(prev => [...prev, newCat]);
  };

  const handleEditCatalog = (updatedCat: Catalog) => {
    setCatalogs(prev => prev.map(c => c.id === updatedCat.id ? { ...c, ...updatedCat } : c));
  };

  const handleDeleteCatalog = (id: string) => {
    setCatalogs(prev => prev.filter(c => c.id !== id));
    setProducts(prev => prev.filter(p => p.catalogId !== id));
  };

  // Callbacks for Invoices
  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const handleEditClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
  };

  const handleEditProduct = (updatedProduct: ProductService) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
  };

  const handleEditInvoice = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? { ...inv, ...updatedInvoice } : inv));
  };

  // Callbacks for Orders
  const handleCancelOrder = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELADO' } : o));
  };

  const handleUpdateOrderStatus = (id: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));

    // If transitioning to APROVADO, mark the first linked invoice installment as PAGO if not already
    if (newStatus === 'APROVADO') {
      const order = orders.find(o => o.id === id);
      if (order && order.invoiceId) {
        const inv = invoices.find(i => i.id === order.invoiceId);
        if (inv && inv.installments.length > 0) {
          if (inv.installments[0].status !== 'PAGO') {
            handleUpdateInstallmentStatus(order.invoiceId, inv.installments[0].id, 'PAGO');
          }
        }
      }
    }
  };

  const handleCreateOrderFromStorefront = async (orderData: {
    clientName: string;
    clientDocument: string;
    clientEmail: string;
    clientPhone: string;
    items: Array<{ productServiceId: string; quantity: number }>;
    paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
  }) => {
    let targetClientId = '';
    const existingClient = clients.find(c => c.storeId === activeStoreId && c.document === orderData.clientDocument);
    if (existingClient) {
      targetClientId = existingClient.id;
    } else {
      const newClient: Client = {
        id: `cli-${Date.now()}`,
        storeId: activeStoreId!,
        name: orderData.clientName,
        document: orderData.clientDocument,
        email: orderData.clientEmail,
        phone: orderData.clientPhone
      };
      setClients(prev => [...prev, newClient]);
      targetClientId = newClient.id;
    }

    const invoiceNum = invoices.length > 0 
      ? String(Math.max(...invoices.map(inv => parseInt(inv.invoiceNumber) || 1000)) + 1)
      : '1001';

    const total = orderData.items.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productServiceId);
      return sum + (prod ? prod.price * item.quantity : 0);
    }, 0);

    const method = orderData.paymentMethod || 'PIX';
    const key = savedKeys.find(k => k.walletType === method) || savedKeys.find(k => k.isPrimary) || savedKeys[0] || DEFAULT_KEYS[0];
    const installmentId = `inst-${Date.now()}-1`;
    
    const pixPayload = key.walletType === 'PIX'
      ? generatePixPayload({
          key: key.key,
          keyType: key.type,
          name: key.name,
          city: key.city,
          amount: total,
          description: `#${invoiceNum} Parc 1/1`.substring(0, 72)
        })
      : `card_payment_token_${Date.now()}_${total}`;

    const newInstallment: Installment = {
      id: installmentId,
      number: 1,
      amount: total,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'PENDENTE',
      pixPayload,
      paymentMethodUsed: key.walletType
    };

    const invoiceId = `inv-${Date.now()}`;
    const newInvoice: Invoice = {
      id: invoiceId,
      storeId: activeStoreId!,
      invoiceNumber: invoiceNum,
      clientId: targetClientId,
      description: `Pedido #${invoiceNum} gerado via Catálogo Online`,
      totalAmount: total,
      dateCreated: new Date().toISOString().split('T')[0],
      installmentsCount: 1,
      pixKeyId: key.id,
      walletId: key.id,
      paymentMethodUsed: key.walletType,
      installments: [newInstallment]
    };
    setInvoices(prev => [newInvoice, ...prev]);

    const orderId = `ord-${Date.now()}`;
    const newOrder: Order = {
      id: orderId,
      storeId: activeStoreId!,
      orderNumber: invoiceNum,
      clientName: orderData.clientName,
      clientPhone: orderData.clientPhone,
      clientEmail: orderData.clientEmail,
      clientDocument: orderData.clientDocument,
      items: orderData.items.map(item => {
        const prod = products.find(p => p.id === item.productServiceId);
        return {
          productServiceId: item.productServiceId,
          name: prod?.name || 'Item Desconhecido',
          quantity: item.quantity,
          price: prod?.price || 0
        };
      }),
      totalAmount: total,
      status: 'PENDENTE',
      dateCreated: new Date().toISOString(),
      invoiceId
    };
    setOrders(prev => [newOrder, ...prev]);

    return {
      orderNumber: invoiceNum,
      pixPayload,
      invoiceId
    };
  };

  const handleUpdateInstallmentStatus = (
    invoiceId: string,
    installmentId: string,
    status: 'PAGO' | 'PENDENTE',
    paymentMethodUsed?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
  ) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invoiceId) {
        const updatedInsts = inv.installments.map(inst => {
          if (inst.id === installmentId) {
            return {
              ...inst,
              status,
              confirmedDate: status === 'PAGO' ? new Date().toISOString().split('T')[0] : undefined,
              paymentMethodUsed: status === 'PAGO' ? (paymentMethodUsed || inst.paymentMethodUsed || 'PIX') : undefined
            };
          }
          return inst;
        });

        // Sync order status if fully paid or reverted
        const isAllPaid = updatedInsts.every(inst => inst.status === 'PAGO');
        if (isAllPaid) {
          setOrders(prevOrders => prevOrders.map(o => {
            if (o.invoiceId === invoiceId && o.status === 'PENDENTE') {
              return { ...o, status: 'APROVADO' };
            }
            return o;
          }));
        } else {
          setOrders(prevOrders => prevOrders.map(o => {
            if (o.invoiceId === invoiceId) {
              return { ...o, status: 'PENDENTE' };
            }
            return o;
          }));
        }

        return { ...inv, installments: updatedInsts };
      }
      return inv;
    }));
  };

  const handleKeysChanged = (newKeys: SavedPixKey[]) => {
    setSavedKeys(newKeys);
  };

  // ERP Accounts Receivable Dashboard Filter & Computations
  const [dashboardStoreFilter, setDashboardStoreFilter] = useState<string>('ALL');

  const dashboardInvoices = dashboardStoreFilter === 'ALL' 
    ? invoices 
    : invoices.filter(inv => inv.storeId === dashboardStoreFilter);

  const getInstallmentsInPeriod = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allInsts = dashboardInvoices.flatMap(inv => 
      inv.installments.map(inst => ({
        ...inst,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        description: inv.description
      }))
    );

    return allInsts.filter(inst => {
      if (periodFilter === 'ALL') return true;

      const instDate = new Date(inst.dueDate + 'T12:00:00');
      instDate.setHours(0, 0, 0, 0);

      if (periodFilter === 'THIS_MONTH') {
        return instDate.getMonth() === today.getMonth() && instDate.getFullYear() === today.getFullYear();
      }

      if (periodFilter === '30_DAYS') {
        const diffTime = instDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= -30 && diffDays <= 30;
      }

      if (periodFilter === '90_DAYS') {
        const diffTime = instDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= -90 && diffDays <= 90;
      }

      return true;
    });
  };

  const filteredInsts = getInstallmentsInPeriod();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const totalPaid = filteredInsts
    .filter(i => i.status === 'PAGO')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalA_Vencer = filteredInsts
    .filter(i => i.status === 'PENDENTE' && new Date(i.dueDate + 'T12:00:00') >= todayDate)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalVencido = filteredInsts
    .filter(i => i.status === 'PENDENTE' && new Date(i.dueDate + 'T12:00:00') < todayDate)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalBilled = totalPaid + totalA_Vencer + totalVencido;

  // Receiving rate indicator
  const paidRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  const overdueRate = totalBilled > 0 ? (totalVencido / totalBilled) * 100 : 0;

  // Chart 1: Grouped bar chart calculations (last 4 months)
  const getMonthlyChartData = () => {
    const monthGroups: { [key: string]: { paid: number; unpaid: number; label: string } } = {};
    
    // Seed groups to ensure they are present for recent months
    monthGroups['2026-04'] = { paid: 0, unpaid: 0, label: 'Abr' };
    monthGroups['2026-05'] = { paid: 0, unpaid: 0, label: 'Mai' };
    monthGroups['2026-06'] = { paid: 0, unpaid: 0, label: 'Jun' };
    monthGroups['2026-07'] = { paid: 0, unpaid: 0, label: 'Jul' };
    
    dashboardInvoices.forEach(inv => {
      inv.installments.forEach(inst => {
        const date = new Date(inst.dueDate + 'T12:00:00');
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthGroups[key]) {
          const label = date.toLocaleDateString('pt-BR', { month: 'short' }).substring(0, 3);
          monthGroups[key] = { paid: 0, unpaid: 0, label: label.charAt(0).toUpperCase() + label.slice(1) };
        }
        
        if (inst.status === 'PAGO') {
          monthGroups[key].paid += inst.amount;
        } else {
          monthGroups[key].unpaid += inst.amount;
        }
      });
    });

    return Object.keys(monthGroups)
      .sort()
      .map(k => ({
        key: k,
        ...monthGroups[k]
      }))
      .slice(-4);
  };

  const monthlyChartData = getMonthlyChartData();
  const maxValInChart = Math.max(
    ...monthlyChartData.map(d => Math.max(d.paid, d.unpaid)),
    100 // Avoid division by zero
  );

  // Chart 2: Donut stroke dash details
  const radius = 50;
  const circ = 2 * Math.PI * radius; // ~314.16
  const paidDash = (totalPaid / (totalBilled || 1)) * circ;
  const aVencerDash = (totalA_Vencer / (totalBilled || 1)) * circ;
  const vencidoDash = (totalVencido / (totalBilled || 1)) * circ;

  // Get active key info
  const primaryKey = savedKeys.find(k => k.isPrimary) || savedKeys[0];

  const getClientName = (id: string) => {
    const cli = clients.find(c => c.id === id);
    return cli ? cli.name : 'Cliente Excluído';
  };

  // Nav menu items definition
  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: Home },
    { id: 'stores', label: 'Lojas', icon: ShoppingBag },
    { id: 'wallets', label: 'Carteiras', icon: Wallet }
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen flex-shrink-0 z-20 shadow-xl">
        {/* Brand Logo */}
        <div className="p-6 border-b border-slate-800/60 flex items-center gap-2.5">
          <div className="p-2 bg-pix rounded-xl text-white shadow-md shadow-pix/20">
            <svg viewBox="0 0 135 135" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
              <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
              <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
            </svg>
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-white leading-none">MandaPIX</h1>
            <span className="text-[10px] text-pix uppercase tracking-widest font-black">ERP Autônomo</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive 
                    ? 'bg-pix text-white shadow-md shadow-pix/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        {primaryKey && (
          <div className="p-4 m-4 bg-slate-800/50 rounded-2xl border border-slate-800 flex items-center justify-between text-left">
            <div className="truncate max-w-[140px]">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Carteira Receptora</p>
              <p className="text-xs font-bold text-white truncate mt-0.5">{primaryKey.label}</p>
            </div>
            <div className="w-6 h-6 rounded bg-pix/10 text-pix flex items-center justify-center font-bold text-[10px] uppercase">
              {primaryKey.walletType === 'PIX'
                ? primaryKey.bankName.substring(0, 2)
                : primaryKey.walletType === 'CREDIT_CARD'
                ? 'CC'
                : 'CD'}
            </div>
          </div>
        )}
      </aside>

      {/* MOBILE HEADER (Top Navigation) */}
      <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-pix rounded-lg text-white">
            <svg viewBox="0 0 135 135" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
              <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
              <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
            </svg>
          </div>
          <h1 className="font-extrabold text-sm tracking-tight">MandaPIX ERP</h1>
        </div>
        
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer (Overlay) */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex justify-end animate-fade-in">
          <div className="bg-slate-900 w-64 h-full p-6 flex flex-col justify-between text-white animate-slide-up">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="font-bold text-sm tracking-widest text-pix uppercase">Menu ERP</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-pix text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            {primaryKey && (
              <div className="bg-slate-800/50 p-4 rounded-xl text-xs space-y-1 border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500">
                  {primaryKey.walletType === 'PIX' ? 'Chave Principal' : 'Carteira Principal'}
                </span>
                <p className="font-semibold text-white">{primaryKey.label}</p>
                <p className="font-mono text-[10px] text-slate-400 truncate">
                  {primaryKey.walletType === 'PIX' ? primaryKey.key : `ID: •••• •••• •••• ${primaryKey.accountIdentifier?.slice(-4) || 'CARD'}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Dashboard Sub Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Painel Financeiro</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Resumo de contas a receber e faturamento</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                {/* Store Filter Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filtrar Loja:</span>
                  <select
                    value={dashboardStoreFilter}
                    onChange={(e) => setDashboardStoreFilter(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-pix/50 shadow-sm"
                  >
                    <option value="ALL">Todas as Lojas</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Period Select Filter */}
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-sm">
                  {(['30_DAYS', '90_DAYS', 'THIS_MONTH', 'ALL'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPeriodFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        periodFilter === f 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f === '30_DAYS' ? '30 dias' : f === '90_DAYS' ? '90 dias' : f === 'THIS_MONTH' ? 'Este Mês' : 'Tudo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Dashboard Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {/* 4 KPI CARD MATRIX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Recebido */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recebido</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalPaid)}</h3>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Receita consolidada
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl z-10">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-emerald-500/5 rounded-full" />
                </div>

                {/* 2. Total A Vencer */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Vencer</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalA_Vencer)}</h3>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                      <Clock className="w-3.5 h-3.5" /> Títulos pendentes futuros
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl z-10">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-slate-400/5 rounded-full" />
                </div>

                {/* 3. Total Vencido */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atrasado / Vencido</span>
                    <h3 className="text-2xl font-black text-slate-800">{formatBRL(totalVencido)}</h3>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${totalVencido > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      <AlertCircle className="w-3.5 h-3.5" /> {totalVencido > 0 ? 'Requer atenção' : 'Nenhuma pendência'}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50 text-red-500 rounded-2xl z-10">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-red-500/5 rounded-full" />
                </div>

                {/* 4. Recebimento Rate */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="space-y-1.5 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxa de Liquidez</span>
                    <h3 className="text-2xl font-black text-slate-800">{paidRate.toFixed(1)}%</h3>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Inadimplência: {overdueRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-3 bg-pix-light text-pix rounded-2xl z-10">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-[20%] translate-y-[20%] w-20 h-20 bg-pix/5 rounded-full" />
                </div>

              </div>

              {/* DUAL CHART GRID SYSTEM */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart 1: Grouped bar chart (Span 2 columns) */}
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Faturamento por Período</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Comparativo mensal de títulos pagos vs pendentes (BRL)</p>
                    </div>
                    
                    {/* Color legends */}
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 block" /> Pago</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 block" /> Aberto / A vencer</span>
                    </div>
                  </div>

                  {/* SVG Chart Area */}
                  <div className="w-full">
                    <svg viewBox="0 0 450 220" className="w-full h-auto max-h-[200px]">
                      {/* Grid Y lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => (
                        <line 
                          key={idx}
                          x1="30" 
                          y1={170 - r * 140} 
                          x2="430" 
                          y2={170 - r * 140} 
                          stroke="#f1f5f9" 
                          strokeWidth="1"
                        />
                      ))}

                      {/* Render monthly bars */}
                      {monthlyChartData.map((d, idx) => {
                        const xOffset = 60 + idx * 95;
                        const paidHeight = (d.paid / maxValInChart) * 140;
                        const unpaidHeight = (d.unpaid / maxValInChart) * 140;
                        
                        return (
                          <g key={d.key}>
                            {/* Paid Bar (Green) */}
                            <rect
                              x={xOffset}
                              y={170 - paidHeight}
                              width="24"
                              height={Math.max(paidHeight, 2)}
                              rx="4"
                              fill="#34d399"
                              className="transition-all duration-300 hover:fill-emerald-500 cursor-pointer"
                            />
                            {/* Unpaid Bar (Orange) */}
                            <rect
                              x={xOffset + 28}
                              y={170 - unpaidHeight}
                              width="24"
                              height={Math.max(unpaidHeight, 2)}
                              rx="4"
                              fill="#fb923c"
                              className="transition-all duration-300 hover:fill-orange-500 cursor-pointer"
                            />
                            {/* Month Label */}
                            <text
                              x={xOffset + 26}
                              y="192"
                              textAnchor="middle"
                              fill="#94a3b8"
                              className="text-[10px] font-bold"
                            >
                              {d.label}
                            </text>
                            
                            {/* Value tooltips inside chart bars */}
                            {d.paid > 0 && (
                              <text
                                x={xOffset + 12}
                                y={160 - paidHeight}
                                textAnchor="middle"
                                fill="#475569"
                                className="text-[8px] font-black"
                              >
                                {d.paid >= 1000 ? `${(d.paid/1000).toFixed(1)}k` : d.paid.toFixed(0)}
                              </text>
                            )}
                            {d.unpaid > 0 && (
                              <text
                                x={xOffset + 40}
                                y={160 - unpaidHeight}
                                textAnchor="middle"
                                fill="#475569"
                                className="text-[8px] font-black"
                              >
                                {d.unpaid >= 1000 ? `${(d.unpaid/1000).toFixed(1)}k` : d.unpaid.toFixed(0)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Base axis line */}
                      <line x1="30" y1="172" x2="430" y2="172" stroke="#cbd5e1" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                {/* Chart 2: Status Donut Chart (Span 1 column) */}
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="pb-2 border-b border-slate-50">
                    <h4 className="font-bold text-slate-800 text-sm">Distribuição de Recebíveis</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Divisão percentual de títulos por status no período</p>
                  </div>

                  {totalBilled === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
                      Nenhum dado faturado neste período.
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4">
                      {/* SVG Donut Circle */}
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          {/* Circular background track */}
                          <circle
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="transparent"
                            stroke="#f1f5f9"
                            strokeWidth="20"
                          />
                          {/* Paid segment (Green) */}
                          {totalPaid > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#34d399"
                              strokeWidth="20"
                              strokeDasharray={`${paidDash} ${circ - paidDash}`}
                              strokeDashoffset={0}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          {/* A Vencer segment (Slate/blue) */}
                          {totalA_Vencer > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#94a3b8"
                              strokeWidth="20"
                              strokeDasharray={`${aVencerDash} ${circ - aVencerDash}`}
                              strokeDashoffset={-paidDash}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          {/* Vencido segment (Red) */}
                          {totalVencido > 0 && (
                            <circle
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="transparent"
                              stroke="#f87171"
                              strokeWidth="20"
                              strokeDasharray={`${vencidoDash} ${circ - vencidoDash}`}
                              strokeDashoffset={-(paidDash + aVencerDash)}
                              transform="rotate(-90 100 100)"
                            />
                          )}
                          
                          {/* Center Text Indicator */}
                          <text x="100" y="95" textAnchor="middle" fill="#94a3b8" className="text-[11px] uppercase tracking-wider font-bold">Total</text>
                          <text x="100" y="120" textAnchor="middle" fill="#1e293b" className="text-[17px] font-black tracking-tighter">
                            {totalBilled >= 1000 ? `${(totalBilled/1000).toFixed(1)}k` : totalBilled.toFixed(0)}
                          </text>
                        </svg>
                      </div>

                      {/* Custom list layout for Donut labels */}
                      <div className="w-full grid grid-cols-3 gap-2 text-center">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pago</span>
                          <p className="text-xs font-black text-emerald-500">{(totalBilled > 0 ? (totalPaid/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">A Vencer</span>
                          <p className="text-xs font-black text-slate-400">{(totalBilled > 0 ? (totalA_Vencer/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Atrasado</span>
                          <p className="text-xs font-black text-red-400">{(totalBilled > 0 ? (totalVencido/totalBilled)*100 : 0).toFixed(0)}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* CARD CONTAINER MATRIX: Virtual Card (Left) & Upcoming Receivables (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Virtual Card (Span 1 column) */}
                <div className="space-y-3.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Minha Chave Receptora Principal</h4>
                  <VirtualCard 
                    primaryKey={primaryKey}
                    onNavigateToKeys={() => setActiveTab('wallets')} 
                  />
                </div>

                {/* Upcoming Receivables (Span 2 columns) */}
                <div className="lg:col-span-2 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Próximos Vencimentos</h4>
                    <button
                      onClick={() => { setActiveTab('stores'); if (stores.length > 0) { setActiveStoreId(stores[0].id); setActiveSubTab('invoices'); } }}
                      className="text-[10px] font-bold text-pix flex items-center gap-0.5 hover:underline"
                    >
                      Ver todas cobranças <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 overflow-hidden">
                    {filteredInsts.filter(i => i.status === 'PENDENTE').length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        Nenhum faturamento pendente para receber neste período.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50 max-h-[240px] overflow-y-auto no-scrollbar">
                        {filteredInsts
                          .filter(i => i.status === 'PENDENTE')
                          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                          .slice(0, 4)
                          .map((item) => {
                            const isOverdue = new Date(item.dueDate + 'T12:00:00') < todayDate;
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  const inv = invoices.find(i => i.id === item.invoiceId);
                                  if (inv && inv.storeId) {
                                    setActiveStoreId(inv.storeId);
                                    setActiveSubTab('invoices');
                                    setActiveTab('stores');
                                  }
                                }}
                                className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer rounded-xl px-2 transition-colors"
                              >
                                <div className="flex flex-col max-w-[65%]">
                                  <span className="font-bold text-slate-800 text-xs truncate uppercase">
                                    {getClientName(item.clientId)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 truncate mt-0.5">
                                    {item.description} ({item.invoiceNumber} P{item.number})
                                  </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-extrabold text-xs text-slate-800">
                                    {formatBRL(item.amount)}
                                  </span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                    isOverdue 
                                      ? 'bg-red-50 text-red-700 border-red-100'
                                      : 'bg-slate-50 text-slate-600 border-slate-100'
                                  }`}>
                                    {isOverdue 
                                      ? `Atrasado desde ${new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                      : `Vence em ${new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          activeStoreId === null ? (
            <StoreManager
              stores={stores}
              clients={clients}
              catalogs={catalogs}
              invoices={invoices}
              onAddStore={handleAddStore}
              onEditStore={handleEditStore}
              onDeleteStore={handleDeleteStore}
              onSelectStore={(id) => {
                setActiveStoreId(id);
                setActiveSubTab('orders');
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
              {/* Store Workspace Header */}
              {(() => {
                const currentStore = stores.find(s => s.id === activeStoreId);
                const colorGradient = currentStore?.color || 'from-blue-600 to-indigo-700';
                
                return (
                  <div className="bg-white border-b border-slate-100 flex-shrink-0 flex flex-col">
                    {/* Store Title Bar */}
                    <div className="p-5 flex items-center justify-between border-b border-slate-50">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setActiveStoreId(null)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 border border-slate-100 transition-all active:scale-95"
                          title="Voltar para Lojas"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Loja Ativa</span>
                          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
                            <span className={`w-3.5 h-3.5 rounded bg-gradient-to-r ${colorGradient} inline-block shadow-sm`} />
                            {currentStore?.name}
                          </h2>
                        </div>
                      </div>
                      
                      {/* Quick store switcher dropdown */}
                      <select
                        value={activeStoreId}
                        onChange={(e) => setActiveStoreId(e.target.value)}
                        className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none"
                      >
                        {stores.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Horizontal Sub Tabs Navigation */}
                    <div className="flex px-5 bg-white">
                      {([
                        { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
                        { id: 'invoices', label: 'Cobranças', icon: History },
                        { id: 'clients', label: 'Clientes', icon: Users },
                        { id: 'catalogs', label: 'Catálogos', icon: FolderOpen }
                      ] as const).map(subTab => {
                        const Icon = subTab.icon;
                        const isSubActive = activeSubTab === subTab.id;
                        return (
                          <button
                            key={subTab.id}
                            onClick={() => setActiveSubTab(subTab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all relative ${
                              isSubActive 
                                ? 'border-pix text-pix' 
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{subTab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Render Selected Sub Tab Workspace Component */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                {activeSubTab === 'orders' && (
                  <OrderManager
                    orders={orders.filter(o => o.storeId === activeStoreId)}
                    onCancelOrder={handleCancelOrder}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                    onSimulateStorefront={() => setIsStorefrontOpen(true)}
                  />
                )}

                {activeSubTab === 'invoices' && (
                  <InvoiceManager
                    invoices={invoices.filter(inv => inv.storeId === activeStoreId)}
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    catalogs={catalogs.filter(cat => cat.storeId === activeStoreId)}
                    savedKeys={savedKeys}
                    onAddInvoice={(invoice) => handleAddInvoice({ ...invoice, storeId: activeStoreId! })}
                    onEditInvoice={handleEditInvoice}
                    onDeleteInvoice={handleDeleteInvoice}
                    onUpdateInstallmentStatus={handleUpdateInstallmentStatus}
                    onNavigateToKeys={() => setActiveTab('wallets')}
                    onNavigateToClients={() => setActiveSubTab('clients')}
                  />
                )}

                {activeSubTab === 'clients' && (
                  <ClientManager
                    clients={clients.filter(c => c.storeId === activeStoreId)}
                    onAddClient={(client) => handleAddClient({ ...client, storeId: activeStoreId! })}
                    onEditClient={handleEditClient}
                    onDeleteClient={handleDeleteClient}
                  />
                )}

                {activeSubTab === 'catalogs' && (
                  <CatalogManager
                    catalogs={catalogs.filter(cat => cat.storeId === activeStoreId)}
                    products={products.filter(p => {
                      const cat = catalogs.find(c => c.id === p.catalogId);
                      return cat && cat.storeId === activeStoreId;
                    })}
                    onAddCatalog={(catalog) => handleAddCatalog({ ...catalog, storeId: activeStoreId! })}
                    onEditCatalog={handleEditCatalog}
                    onDeleteCatalog={handleDeleteCatalog}
                    onAddProduct={handleAddProduct}
                    onEditProduct={handleEditProduct}
                    onDeleteProduct={handleDeleteProduct}
                  />
                )}
              </div>
            </div>
          )
        )}

        {activeTab === 'wallets' && (
          <SavedKeys onKeysChanged={handleKeysChanged} />
        )}
      </main>

      {/* Online Customer Storefront Simulator Overlay */}
      {isStorefrontOpen && activeStoreId && (
        <StorefrontSimulator
          store={stores.find(s => s.id === activeStoreId)!}
          catalogs={catalogs.filter(c => c.storeId === activeStoreId)}
          products={products.filter(p => {
            const cat = catalogs.find(c => c.id === p.catalogId);
            return cat && cat.storeId === activeStoreId;
          })}
          onPlaceOrder={handleCreateOrderFromStorefront}
          onClose={() => setIsStorefrontOpen(false)}
          onSimulatePayment={(invoiceId) => {
            const invObj = invoices.find(inv => inv.id === invoiceId);
            if (invObj && invObj.installments.length > 0) {
              handleUpdateInstallmentStatus(invoiceId, invObj.installments[0].id, 'PAGO');
            }
          }}
        />
      )}

      {/* BOTTOM TAB NAVIGATION BAR (Mobile Menu) */}
      <div className="md:hidden bg-white border-t border-slate-100 py-2.5 px-3 flex justify-between select-none flex-shrink-0 z-20 shadow-md">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive ? 'text-pix scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[8px] font-bold">{item.label.split('/')[0]}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

export default App;
