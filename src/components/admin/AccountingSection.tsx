import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, setDoc, getDocs, getDoc, collection, doc as firestoreDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, CartItem, Product } from '../../types';
import { ShoppingBag, Users, Tag, FileText, Sliders, CheckCircle2, AlertCircle, Trash2, Plus, Download, Printer, Save, Search, Eye, Landmark, Percent } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface AccountingSectionProps {
  orders: Order[];
  products?: Product[];
}

export interface Voucher {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  expiryDate: string;
  maxUses: number;
  uses: number;
  isActive: boolean;
}

export default function AccountingSection({ orders, products = [] }: AccountingSectionProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Deduce tab from active request URL
  let activeSubTab: 'orders' | 'customers' | 'coupons' | 'invoices' | 'settings' | 'manual' = 'orders';
  if (location.pathname.includes('/accounting/bestellungen')) activeSubTab = 'orders';
  else if (location.pathname.includes('/accounting/kunden')) activeSubTab = 'customers';
  else if (location.pathname.includes('/accounting/gutscheine')) activeSubTab = 'coupons';
  else if (location.pathname.includes('/accounting/rechnungen')) activeSubTab = 'invoices';
  else if (location.pathname.includes('/accounting/einstellungen')) activeSubTab = 'settings';
  else if (location.pathname.includes('/accounting/manuell')) activeSubTab = 'manual';

  const setActiveSubTab = (tab: 'orders' | 'customers' | 'coupons' | 'invoices' | 'settings' | 'manual') => {
    if (tab === 'orders') navigate('/admin/accounting/bestellungen');
    else if (tab === 'customers') navigate('/admin/accounting/kunden');
    else if (tab === 'coupons') navigate('/admin/accounting/gutscheine');
    else if (tab === 'invoices') navigate('/admin/accounting/rechnungen');
    else if (tab === 'settings') navigate('/admin/accounting/einstellungen');
    else if (tab === 'manual') navigate('/admin/accounting/manuell');
  };
  
  // States
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);

  // Voucher state
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed'>('percentage');
  const [newValue, setNewValue] = useState(10);
  const [newMinOrder, setNewMinOrder] = useState(0);
  const [newExpiry, setNewExpiry] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(100);

  // Search/Filters vars
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Order state
  const [manualOrderItems, setManualOrderItems] = useState<Array<{ sku: string; name: string; quantity: number; price: number; }>>([
    { sku: '', name: '', quantity: 1, price: 0 }
  ]);
  const [manualOrderCustomer, setManualOrderCustomer] = useState('');
  const [manualOrderEmail, setManualOrderEmail] = useState('');
  const [manualOrderLoading, setManualOrderLoading] = useState(false);

  // Accounting Settings state
  const [vatStandard, setVatStandard] = useState<number>(() => Number(localStorage.getItem('acc_vat_standard')) || 19);
  const [vatReduced, setVatReduced] = useState<number>(() => Number(localStorage.getItem('acc_vat_reduced')) || 7);
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('acc_company_name') || 'Gartenparadies GmbH');
  const [companyAddress, setCompanyAddress] = useState(() => localStorage.getItem('acc_company_address') || 'Heideweg 42, 45133 Essen');
  const [ceoName, setCeoName] = useState(() => localStorage.getItem('acc_ceo_name') || 'Dr. h.c. Thomas Gärtner');
  const [bankName, setBankName] = useState(() => localStorage.getItem('acc_bank_name') || 'Sparkasse Essen');
  const [bankIban, setBankIban] = useState(() => localStorage.getItem('acc_bank_iban') || 'DE89 3605 0105 0001 2345 67');
  const [bankBic, setBankBic] = useState(() => localStorage.getItem('acc_bank_bic') || 'WELADED1ESS');
  const [taxId, setTaxId] = useState(() => localStorage.getItem('acc_tax_id') || '312/5801/4932');
  const [vatId, setVatId] = useState(() => localStorage.getItem('acc_vat_id') || 'DE 294 583 103');
  const [invoicePrefix, setInvoicePrefix] = useState(() => localStorage.getItem('acc_invoice_prefix') || 'RE-2026-');

  // Load live Firestore registered users & coupons
  useEffect(() => {
    async function loadRegisteredUsers() {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty) {
          const loaded = snap.docs.map(d => d.data());
          setDbUsers(loaded);
        }
      } catch (err) {
        console.warn('Error loading auth users directly, aggregating from orders:', err);
      } finally {
        setLoadingUsers(false);
      }
    }

    async function loadCoupons() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'coupons'));
        if (snap.exists() && snap.data().vouchers) {
          setVouchers(snap.data().vouchers);
        } else {
          // Initialize standard coupons locally and save
          const standard: Voucher[] = [
            { code: 'GARTEN10', type: 'percentage', value: 10, minOrderValue: 30, expiryDate: '2026-12-31', maxUses: 500, uses: 12, isActive: true },
            { code: 'FRUEHLING20', type: 'fixed', value: 20, minOrderValue: 100, expiryDate: '2026-06-30', maxUses: 200, uses: 45, isActive: true }
          ];
          setVouchers(standard);
          await setDoc(doc(db, 'settings', 'coupons'), { vouchers: standard }, { merge: true });
        }
      } catch (err) {
        console.warn('Voucher sync fell back to local storage:', err);
        const cached = localStorage.getItem('acc_local_coupons');
        if (cached) {
          setVouchers(JSON.parse(cached));
        } else {
          setVouchers([
            { code: 'GARTEN10', type: 'percentage', value: 10, minOrderValue: 30, expiryDate: '2026-12-31', maxUses: 500, uses: 12, isActive: true }
          ]);
        }
      }
    }

    if (activeSubTab === 'customers' && dbUsers.length === 0) {
      loadRegisteredUsers();
    }
    loadCoupons();
  }, [activeSubTab]);

  // Handle Order status transition with dynamic live Sync to Firestore
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: Order['status']) => {
    const matched = orders.find(o => o.id === orderId);
    if (!matched) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, { ...matched, status: nextStatus }, { merge: true });
      console.log(`Order ${orderId} successfully synced status to "${nextStatus}" in Firestore.`);
    } catch (err) {
      console.error('Failed to write and sync order status:', err);
      alert('Der Verbindungs-Speichervorgang in die Cloud schlug fehl. Bitte überprüfe deine Internetverbindung.');
    }
  };

  // Add Voucher
  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || newValue <= 0) return;

    const added: Voucher = {
      code: newCode.toUpperCase().trim(),
      type: newType,
      value: newValue,
      minOrderValue: newMinOrder,
      expiryDate: newExpiry || '2026-12-31',
      maxUses: newMaxUses,
      uses: 0,
      isActive: true
    };

    const updated = [...vouchers, added];
    setVouchers(updated);
    setNewCode('');

    try {
      await setDoc(doc(db, 'settings', 'coupons'), { vouchers: updated }, { merge: true });
    } catch (err) {
      localStorage.setItem('acc_local_coupons', JSON.stringify(updated));
    }
  };

  // Delete Voucher
  const handleDeleteVoucher = async (code: string) => {
    const updated = vouchers.filter(v => v.code !== code);
    setVouchers(updated);
    try {
      await setDoc(doc(db, 'settings', 'coupons'), { vouchers: updated }, { merge: true });
    } catch (err) {
      localStorage.setItem('acc_local_coupons', JSON.stringify(updated));
    }
  };

  // Toggle Voucher status
  const toggleVoucherStatus = async (code: string) => {
    const updated = vouchers.map(v => {
      if (v.code === code) {
        return { ...v, isActive: !v.isActive };
      }
      return v;
    });
    setVouchers(updated);
    try {
      await setDoc(doc(db, 'settings', 'coupons'), { vouchers: updated }, { merge: true });
    } catch (err) {
      localStorage.setItem('acc_local_coupons', JSON.stringify(updated));
    }
  };

  // Save Accounting general configurations
  const handleSaveAccountingSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('acc_vat_standard', String(vatStandard));
    localStorage.setItem('acc_vat_reduced', String(vatReduced));
    localStorage.setItem('acc_company_name', companyName);
    localStorage.setItem('acc_company_address', companyAddress);
    localStorage.setItem('acc_ceo_name', ceoName);
    localStorage.setItem('acc_bank_name', bankName);
    localStorage.setItem('acc_bank_iban', bankIban);
    localStorage.setItem('acc_bank_bic', bankBic);
    localStorage.setItem('acc_tax_id', taxId);
    localStorage.setItem('acc_vat_id', vatId);
    localStorage.setItem('acc_invoice_prefix', invoicePrefix);

    alert('Buchhaltungsparameter erfolgreich lokal & im Briefkopf aktualisiert!');
  };

  // Aggregate customer accounts from both db list and orders to ensure a rich customer list
  const customersList = useMemo(() => {
    const list: Record<string, { email: string; name: string; totalSpent: number; ordersCount: number; lastOrder: string }> = {};

    // aggregate from orders list
    orders.forEach(o => {
      // Find order owner email in items or fallback
      const email = o.items?.[0]?.articleNumber?.includes('@') 
        ? o.items[0].articleNumber // sometimes stored in placeholders
        : 'info@as-mietwagen-service.de'; // default owner
      
      const key = o.customerName.toLowerCase().replace(/\s/g, '');
      if (!list[key]) {
        list[key] = {
          name: o.customerName,
          email: o.customerName.includes('Gärtner') ? 'info@as-mietwagen-service.de' : `${key}@garten-kunde.de`,
          totalSpent: 0,
          ordersCount: 0,
          lastOrder: o.date
        };
      }
      list[key].totalSpent += o.total;
      list[key].ordersCount += 1;
      if (new Date(o.date).getTime() > new Date(list[key].lastOrder).getTime()) {
        list[key].lastOrder = o.date;
      }
    });

    // Merge registered accounts
    dbUsers.forEach(u => {
      const email = u.email || '';
      const name = u.displayName || u.username || 'Kunde';
      const key = name.toLowerCase().replace(/\s/g, '');
      if (!list[key]) {
        list[key] = {
          name,
          email,
          totalSpent: 0,
          ordersCount: 0,
          lastOrder: 'N/A'
        };
      } else if (u.email) {
        list[key].email = u.email;
      }
    });

    return Object.values(list);
  }, [orders, dbUsers]);

  // Generate Highly Polished Invoice PDF using jsPDF (downloads client-side)
  const handleDownloadInvoicePDF = (order: Order) => {
    const doc = new jsPDF();
    const invoiceNum = `${invoicePrefix}${order.id.slice(-4).toUpperCase() || '1004'}`;
    const dateFormatted = new Date(order.date).toLocaleDateString('de-DE');
    
    // Header Company Details (Right side)
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(companyName, 140, 15);
    doc.text(companyAddress, 140, 19);
    doc.text(`Geschäftsführer: ${ceoName}`, 140, 23);
    doc.text(`Tel: +49 (0) 201 555-GARTEN`, 140, 27);
    doc.text(`USt-IdNr: ${vatId}`, 140, 31);

    // Main Logo/Company Label (Left side)
    doc.setFontSize(22);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // emerald-400 equivalent green
    doc.text('GARTENPARADIES', 20, 25);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Ihr Experte für professionelle Gartenbewässerung', 20, 30);

    // Sender line (Envelope-friendly small text format)
    doc.setFontSize(7);
    doc.text(`${companyName} · ${companyAddress}`, 20, 48);
    doc.line(20, 49, 100, 49);

    // Customer Address (Recipient Info Box)
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(order.customerName, 20, 56);
    doc.setFont('Helvetica', 'normal');
    doc.text('Kundenstraße 49', 20, 61);
    doc.text('45143 Essen', 20, 66);
    doc.text('Deutschland', 20, 71);

    // Invoice Title
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Rechnung Nr. ${invoiceNum}`, 20, 90);

    // Invoice metadata block
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Rechnungsdatum: ${dateFormatted}`, 140, 90);
    doc.text(`Leistungsdatum: entspricht Rechnungsdatum`, 140, 94);
    doc.text(`Zahlungsart: Vorkasse / Überweisung`, 140, 98);
    doc.text(`Bestell-ID: #${order.id}`, 20, 98);

    // Items table column headers
    doc.setFont('Helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 110, 170, 8, 'F');
    doc.setTextColor(50, 50, 50);
    doc.text('Pos', 22, 115);
    doc.text('Artikelbeschreibung', 35, 115);
    doc.text('Menge', 115, 115);
    doc.text('Art.-Nr.', 135, 115);
    doc.text('Netto', 155, 115);
    doc.text('Gesamt', 172, 115);
    doc.line(20, 118, 190, 118);

    // Render items rows
    doc.setFont('Helvetica', 'normal');
    let currentY = 124;
    
    order.items.forEach((item, idx) => {
      // Shorten name if too long to prevent spillover
      const name = item.name.length > 40 ? `${item.name.substring(0, 37)}...` : item.name;
      const priceNet = item.price / (1 + vatStandard / 100);
      const rowTotalNet = (item.price * item.quantity) / (1 + vatStandard / 100);

      doc.text(String(idx + 1), 22, currentY);
      doc.text(name, 35, currentY);
      doc.text(`${item.quantity} Stk`, 115, currentY);
      doc.text(item.articleNumber?.substring(0, 8) || 'N/A', 135, currentY);
      doc.text(`${priceNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 155, currentY);
      doc.text(`${rowTotalNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 172, currentY);
      doc.line(20, currentY + 3, 190, currentY + 3);
      currentY += 8;
    });

    const subtotalNet = order.total / (1 + vatStandard / 100);
    const vatSum = order.total - subtotalNet;

    // Totals Block
    currentY += 4;
    doc.setFont('Helvetica', 'normal');
    doc.text('Zwischensumme (Netto):', 120, currentY);
    doc.text(`${subtotalNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 172, currentY);

    currentY += 6;
    doc.text(`zzgl. ${vatStandard}% MwSt:`, 120, currentY);
    doc.text(`${vatSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 172, currentY);

    currentY += 7;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Gesamtsumme (Brutto):', 120, currentY);
    doc.text(`${order.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 172, currentY);

    // Footer Terms & Bank Account Details
    currentY = Math.max(220, currentY + 25);
    doc.line(20, currentY, 190, currentY);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text('Wir bitten um Begleichung des Rechnungsbetrages innerhalb von 14 Tagen ohne Abzug.', 20, currentY + 6);
    doc.text(`Bitte geben Sie bei der Überweisung unbedingt die Rechnungsnummer ${invoiceNum} als Verwendungszweck an.`, 20, currentY + 10);

    // Three columns footer details
    currentY += 20;
    doc.setFont('Helvetica', 'bold');
    doc.text('Bankverbindung:', 20, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Konto-Inhaber: ${companyName}`, 20, currentY + 4);
    doc.text(`Kreditinstitut: ${bankName}`, 20, currentY + 8);
    doc.text(`IBAN: ${bankIban}`, 20, currentY + 12);
    doc.text(`BIC: ${bankBic}`, 20, currentY + 16);

    doc.setFont('Helvetica', 'bold');
    doc.text('Unternehmen:', 110, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Steuernummer: ${taxId}`, 110, currentY + 4);
    doc.text(`USt-IdNr: ${vatId}`, 110, currentY + 8);
    doc.text('Gerichtsstand: Amtsgericht Essen', 110, currentY + 12);
    doc.text('HRB: 124 593 11 Essen', 110, currentY + 16);

    // Save and pop
    doc.save(`Rechnung_${invoiceNum}.pdf`);
  };

  // Filter lists
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    return o.customerName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
  });

  const filteredVouchers = vouchers.filter(v => {
    return v.code.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleManualOrderSkuChange = (index: number, sku: string) => {
    const newItems = [...manualOrderItems];
    newItems[index].sku = sku;
    // Auto-fill from catalog if matching
    const productMatch = products.find(p => p.articleNumber === sku);
    if (productMatch) {
      newItems[index].name = productMatch.name;
      newItems[index].price = productMatch.price > 0 ? productMatch.price : 0;
    }
    setManualOrderItems(newItems);
  };

  const handleUpdateManualOrderItem = (index: number, field: 'name' | 'quantity' | 'price', value: string | number) => {
    const newItems = [...manualOrderItems];
    (newItems[index] as any)[field] = value;
    setManualOrderItems(newItems);
  };

  const addManualOrderItem = () => {
    setManualOrderItems([...manualOrderItems, { sku: '', name: '', quantity: 1, price: 0 }]);
  };

  const removeManualOrderItem = (index: number) => {
    const newItems = [...manualOrderItems];
    newItems.splice(index, 1);
    if (newItems.length === 0) {
      newItems.push({ sku: '', name: '', quantity: 1, price: 0 });
    }
    setManualOrderItems(newItems);
  };

  const createManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderLoading(true);
    try {
      const validItems = manualOrderItems.filter(i => i.name && i.quantity > 0 && i.price >= 0);
      if (validItems.length === 0) throw new Error('Bitte füge mindestens einen gültigen Artikel hinzu.');
      
      const total = validItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
      
      const newOrder: Order = {
        id: 'M-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        userId: 'manual_customer',
        customerName: manualOrderCustomer || 'Max Mustermann',
        customerEmail: manualOrderEmail || 'keine@email.de',
        customerAddress: 'Manuell Erfasst',
        items: validItems.map(vi => ({
          id: 'manual-' + Math.random().toString(36).substr(2, 6),
          name: vi.name,
          category: 'Manuell',
          price: vi.price,
          quantity: vi.quantity,
          articleNumber: vi.sku,
          cartItemId: Math.random().toString(36)
        })) as CartItem[],
        total: total,
        status: 'pending',
        date: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'orders', newOrder.id), newOrder);
      alert('Manueller Auftrag wurde erfolgreich erstellt! Er ist nun in den regulären Rechnungen nutzbar.');
      
      // reset
      setManualOrderCustomer('');
      setManualOrderEmail('');
      setManualOrderItems([{ sku: '', name: '', quantity: 1, price: 0 }]);
    } catch (err: any) {
      alert('Fehler: ' + err.message);
    } finally {
      setManualOrderLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Tab Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Accounting</h1>
          <p className="text-sm text-gray-500">Transaktionen, kundenbezogene Bilanzen, Gutscheincodes &amp; Belege.</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex bg-gray-200/80 p-1 rounded-lg border border-gray-200 overflow-x-auto w-full sm:w-auto shrink-0 scrollbar-none">
          <button 
            onClick={() => { setActiveSubTab('orders'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'orders' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Bestellungen
          </button>
          <button 
            onClick={() => { setActiveSubTab('customers'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'customers' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Users className="w-3.5 h-3.5" /> Kunden
          </button>
          <button 
            onClick={() => { setActiveSubTab('coupons'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'coupons' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Tag className="w-3.5 h-3.5" /> Gutscheine
          </button>
          <button 
            onClick={() => { setActiveSubTab('invoices'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'invoices' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Rechnungen
          </button>
          <button 
            onClick={() => { setActiveSubTab('settings'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Sliders className="w-3.5 h-3.5" /> Einstellungen
          </button>
          <button 
            onClick={() => { setActiveSubTab('manual'); setSearchQuery(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${activeSubTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Plus className="w-3.5 h-3.5" /> Manuell
          </button>
        </div>
      </div>

      {/* Global query banner */}
      {activeSubTab !== 'settings' && activeSubTab !== 'coupons' && activeSubTab !== 'manual' && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex items-center relative">
          <Search className="w-4 h-4 absolute left-6 text-gray-400" />
          <input 
            type="text" 
            placeholder={
              activeSubTab === 'orders' ? 'Bestellnummer oder Kundenname durchsuchen...' :
              activeSubTab === 'customers' ? 'Kundenname oder E-Mail-Adresse filtern...' :
              'Rechnungsbelege filtern...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1 bg-gray-50 border border-gray-250 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium py-1.5"
          />
        </div>
      )}

      {/* RENDER ACTIVE MENU SECTION */}
      {activeSubTab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#f8fafc] border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3.5">Bestell-Nr.</th>
                  <th className="px-5 py-3.5">Kunde</th>
                  <th className="px-5 py-3.5">Bestelldatum</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5">Produkte (Menge)</th>
                  <th className="px-5 py-3.5 text-right font-mono">Umsatz (Brutto)</th>
                  <th className="px-5 py-3.5 text-center w-36">Status ändern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 leading-normal">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400 font-sans font-medium">
                      Keine Bestelltransaktionen gefunden.
                    </td>
                  </tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-blue-600">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-800 text-xs">{order.customerName}</div>
                      <div className="text-[9px] text-gray-400">Standardversand</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-500">
                      {new Date(order.date).toLocaleDateString('de-DE')} {new Date(order.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    {/* Status badge */}
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        order.status === 'Abgeschlossen' ? 'bg-green-100 text-green-800' :
                        order.status === 'Versendet' ? 'bg-sky-100 text-sky-800' :
                        order.status === 'In Bearbeitung' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    {/* Items brief representation */}
                    <td className="px-5 py-4">
                      <div className="max-w-[220px] truncate text-gray-600 font-medium font-sans">
                        {order.items.map(item => `${item.name} (${item.quantity}x)`).join(', ')}
                      </div>
                    </td>
                    {/* Price */}
                    <td className="px-5 py-4 text-right font-mono font-extrabold text-slate-800">
                      {order.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </td>
                    {/* Order action */}
                    <td className="px-5 py-4">
                      <select 
                        value={order.status}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                        className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[11px] font-semibold text-gray-700 outline-none transition-colors cursor-pointer"
                      >
                        <option value="Ausstehend">Ausstehend</option>
                        <option value="In Bearbeitung">In Bearbeitung</option>
                        <option value="Versendet">Versendet</option>
                        <option value="Abgeschlossen">Abgeschlossen</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMERS DIRECTORY */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#f8fafc] border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3.5">Kundenname</th>
                  <th className="px-5 py-3.5">E-Mail-Adresse</th>
                  <th className="px-5 py-3.5 text-center">Bestellungen</th>
                  <th className="px-5 py-3.5 text-right font-mono">Umsatz Beitrag (Brutto)</th>
                  <th className="px-5 py-3.5">Letzter Kauf</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 leading-normal">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent animate-spin rounded-full mx-auto mb-2"></div>
                      Kundenkonten werden geladen...
                    </td>
                  </tr>
                ) : customersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400 font-sans">Keine Kundenkonten registriert.</td>
                  </tr>
                ) : customersList.map((customer, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-sans font-bold flex items-center justify-center text-xs">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 text-[13px]">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-medium">
                      {customer.email}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-gray-800 font-mono">
                      {customer.ordersCount} Stk
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-black text-slate-800">
                      {customer.totalSpent.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-5 py-4 text-gray-400 font-medium font-mono">
                      {customer.lastOrder !== 'N/A' ? new Date(customer.lastOrder).toLocaleDateString('de-DE') : 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        Aktiv
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VOUCHER CODES TAB */}
      {activeSubTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List existing */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
              <h3 className="font-bold text-sm text-gray-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-blue-600" /> Aktive Aktions-Coupons ({vouchers.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#f8fafc] border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider font-mono">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Rabatttyp</th>
                    <th className="px-4 py-3">Rabattwert</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Verwendung (Caps)</th>
                    <th className="px-4 py-3">Gültig bis</th>
                    <th className="px-4 py-3 text-center w-16">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Keine Rabattcodes definiert. Erstelle jetzt den ersten.</td>
                    </tr>
                  ) : vouchers.map((v) => (
                    <tr key={v.code} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        <span className="bg-slate-100 px-1.5 py-1 rounded text-slate-800 border select-all">{v.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        {v.type === 'percentage' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">Prozentual (%)</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">Absoluter Betrag (€)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {v.type === 'percentage' ? `${v.value} %` : `${v.value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleVoucherStatus(v.code)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                            v.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {v.isActive ? 'Aktiv' : 'Deaktiviert'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-gray-500">
                        {v.uses} / {v.maxUses}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-400 font-medium">
                        {new Date(v.expiryDate).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleDeleteVoucher(v.code)}
                          className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Create */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 h-fit">
            <h3 className="font-bold text-sm text-gray-800 border-b pb-2 mb-4 flex items-center gap-1">
              <Plus className="w-4 h-4 text-blue-600" /> Neuen Coupon generieren
            </h3>
            
            <form onSubmit={handleAddVoucher} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-gray-400 uppercase mb-1">Rabatt-Code (z.B. GARTEN30)</label>
                <input 
                  type="text" 
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="CODE"
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs font-bold font-mono outline-none focus:bg-white focus:border-blue-500" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-400 uppercase mb-1">Typ</label>
                  <select 
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none cursor-pointer focus:bg-white"
                  >
                    <option value="percentage">Prozentual (%)</option>
                    <option value="fixed">Absolut (EUR)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-400 uppercase mb-1">Wert</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newValue}
                    onChange={(e) => setNewValue(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono outline-none focus:bg-white focus:border-blue-500" 
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-400 uppercase mb-1">Mindestbestellwert (€)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono outline-none focus:bg-white focus:border-blue-500" 
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-400 uppercase mb-1">Ablaufdatum</label>
                  <input 
                    type="date" 
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono outline-none focus:bg-white focus:border-blue-500" 
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-400 uppercase mb-1">Verwendungs-Cap (Anzahl)</label>
                <input 
                  type="number" 
                  min="1"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono outline-none focus:bg-white focus:border-blue-500" 
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-sm text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Coupon hinzufügen
              </button>
            </form>
          </div>

        </div>
      )}

      {/* INVOICE LIST WITH PDF BUILDER */}
      {activeSubTab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Table index */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
            <div className="p-4 border-b border-gray-100 bg-[#f8fafc]">
              <h3 className="font-bold text-sm text-gray-700 flex items-center gap-1">
                <FileText className="w-4 h-4 text-blue-600" /> Rechnungsbelege Verzeichnis
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#f8fafc] border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider font-mono">
                  <tr>
                    <th className="px-5 py-3">Rechnung</th>
                    <th className="px-5 py-3">Datum</th>
                    <th className="px-5 py-3">Empfänger</th>
                    <th className="px-5 py-3 text-right">Netto</th>
                    <th className="px-5 py-3 text-right">Mehrwertsteuer</th>
                    <th className="px-5 py-3 text-right">Bruttowert</th>
                    <th className="px-5 py-3 text-center w-28">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-sans">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-400">Keine Rechnungen generiert da keine Bestellungen vorliegen.</td>
                    </tr>
                  ) : filteredOrders.map(order => {
                    const invoiceNum = `${invoicePrefix}${order.id.slice(-4).toUpperCase() || '1004'}`;
                    const netVal = order.total / (1 + vatStandard / 100);
                    const vatSum = order.total - netVal;
                    return (
                      <tr 
                        key={order.id} 
                        className={`hover:bg-slate-50/50 cursor-pointer transition-all ${
                          selectedOrderForInvoice?.id === order.id ? 'bg-blue-50/40 border-l-4 border-l-blue-600' : ''
                        }`}
                        onClick={() => setSelectedOrderForInvoice(order)}
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                          {invoiceNum}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-gray-400 font-medium">
                          {new Date(order.date).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-5 py-3.5 font-semibold">
                          {order.customerName}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-gray-500">
                          {netVal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-gray-500">
                          {vatSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-800">
                          {order.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedOrderForInvoice(order)}
                              className="p-1 hover:bg-slate-100 text-gray-500 hover:text-black rounded transition-all cursor-pointer"
                              title="Briefkopf Vorschau"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDownloadInvoicePDF(order)}
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded transition-all cursor-pointer"
                              title="PDF Herunterladen"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Invoice PDF Preview Letterhead panel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-[10px] relative font-mono overflow-hidden h-fit">
            <span className="block text-xs font-bold text-gray-500 border-b pb-2 mb-4">Briefkopf / Rechnungs-Beleg Vorschau</span>
            {selectedOrderForInvoice ? (() => {
              const o = selectedOrderForInvoice;
              const subtotalNet = o.total / (1 + vatStandard / 100);
              const vatSum = o.total - subtotalNet;
              const invoiceNum = `${invoicePrefix}${o.id.slice(-4).toUpperCase() || '1004'}`;

              return (
                <div className="p-4 border rounded bg-slate-50 text-[10px] text-gray-600 leading-normal max-h-[420px] overflow-auto">
                  {/* Sender Header */}
                  <div className="flex justify-between items-start border-b pb-2 mb-4 leading-normal">
                    <div>
                      <h4 className="font-extrabold text-emerald-600 text-xs tracking-wider">GARTENPARADIES</h4>
                      <p className="text-[8px] text-gray-400">Empfänger-Zustellzeile: {companyName}, {companyAddress}</p>
                    </div>
                    <div className="text-right text-[8px] text-gray-400">
                      <p className="font-bold text-gray-600 font-mono">{companyName}</p>
                      <p>{companyAddress}</p>
                      <p>St-Nr: {taxId}</p>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="my-3">
                    <p className="text-[8px] text-gray-400 font-sans tracking-wide">RECHNUNGS-ADRESSE:</p>
                    <p className="font-bold text-gray-800 text-[11px] font-sans mt-0.5">{o.customerName}</p>
                    <p className="font-sans">Kundenstraße 49</p>
                    <p className="font-sans">45143 Essen</p>
                  </div>

                  {/* Document Metas */}
                  <div className="bg-white p-2 rounded border border-gray-150 my-3 flex justify-between">
                    <div>
                      <p className="font-extrabold text-slate-800">RECHNUNG #{invoiceNum}</p>
                      <p className="text-gray-400 text-[8px]">Datum: {new Date(o.date).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-slate-800">Brutto: {o.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[8px] text-gray-400">MwSt. enthalten</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1 my-3">
                    <p className="font-bold border-b pb-0.5 mb-1">PRODUKTPOSITIONEN</p>
                    {o.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-[9px] py-0.5 border-b border-dashed border-gray-200">
                        <span>{i.quantity}x {i.name.slice(0, 20)}...</span>
                        <span className="font-bold text-slate-700">{(i.price * i.quantity).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="text-right space-y-0.5 mt-4 border-t pt-2">
                    <p className="text-[9px]">Zwischensumme Netto: <span className="font-bold">{subtotalNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></p>
                    <p className="text-[9px]">zzgl. {vatStandard}% MwSt.: <span className="font-bold">{vatSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></p>
                    <p className="text-xs font-bold text-slate-900 border-t border-double pt-1 mt-1">Rechnungsbetrag Brutto: {o.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  </div>

                  {/* Action row inside preview */}
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleDownloadInvoicePDF(o)}
                      className="w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF Herunterladen
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-12 text-gray-400 leading-relaxed max-w-[240px] mx-auto font-sans">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-medium">Bequeme Vorschau</p>
                Wähle eine Rechnung aus der linken Liste, um die fertige MwSt.-Aufschlüsselung &amp; Belegstruktur im Briefkopf zu simulieren.
              </div>
            )}
          </div>

        </div>
      )}

      {/* BUCHHALTUNG CONFIGURATOR */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 font-sans">
          <div className="flex items-center gap-2 mb-6 border-b pb-3">
            <Landmark className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-lg text-gray-800">Gesamt-Buchhaltung konfigurieren (Deutsche Standards)</h2>
          </div>

          <form onSubmit={handleSaveAccountingSettings} className="space-y-5 text-gray-700">
            {/* Rates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Regelsteuersatz (Standard MwSt %)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={vatStandard} 
                    onChange={(e) => setVatStandard(Math.max(1, parseInt(e.target.value) || 0))} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 pl-10"
                    required
                  />
                  <Percent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">In Deutschland i.d.R. 19% für Standard-Artikel.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ermäßigter Steuersatz (MwSt %)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={vatReduced} 
                    onChange={(e) => setVatReduced(Math.max(1, parseInt(e.target.value) || 0))} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 pl-10"
                    required
                  />
                  <Percent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">In Deutschland i.d.R. 7% für z.B. Bücher/Lebensmittel.</span>
              </div>
            </div>

            {/* Invoicing info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Firmenschreibe / Briefkopf Name</label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Straße / Nr, Postleitzahl / Ort</label>
                <input 
                  type="text" 
                  value={companyAddress} 
                  onChange={(e) => setCompanyAddress(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Geschäftsleitung</label>
                <input 
                  type="text" 
                  value={ceoName} 
                  onChange={(e) => setCeoName(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Umsatzsteuer-ID (USt-IdNr)</label>
                <input 
                  type="text" 
                  value={vatId} 
                  onChange={(e) => setVatId(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Prefix für Rechnungsbelege</label>
                <input 
                  type="text" 
                  value={invoicePrefix} 
                  onChange={(e) => setInvoicePrefix(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kreditinstitut (Bankname)</label>
                <input 
                  type="text" 
                  value={bankName} 
                  onChange={(e) => setBankName(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">IBAN</label>
                <input 
                  type="text" 
                  value={bankIban} 
                  onChange={(e) => setBankIban(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">BIC (SWIFT)</label>
                <input 
                  type="text" 
                  value={bankBic} 
                  onChange={(e) => setBankBic(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inländische Steuernummer</label>
                <input 
                  type="text" 
                  value={taxId} 
                  onChange={(e) => setTaxId(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button 
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Briefkopf &amp; Bankverbindung sichern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUELLE AUFTRÄGE */}
      {activeSubTab === 'manual' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 font-sans">
          <div className="flex items-center justify-between mb-6 border-b pb-3">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-lg text-gray-800">Manuelle Aufträge erstellen</h2>
            </div>
          </div>
          <form onSubmit={createManualOrder} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kundenname</label>
                <input 
                  type="text" 
                  value={manualOrderCustomer} 
                  onChange={(e) => setManualOrderCustomer(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:border-blue-500"
                  placeholder="Max Mustermann"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">E-Mail (optional)</label>
                <input 
                  type="email" 
                  value={manualOrderEmail} 
                  onChange={(e) => setManualOrderEmail(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:bg-white focus:border-blue-500"
                  placeholder="kunde@beispiel.de"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Positionen</label>
              
              <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col gap-px bg-gray-200">
                <div className="grid grid-cols-12 gap-2 bg-gray-100 p-2 text-xs font-bold text-gray-600 uppercase">
                  <div className="col-span-3">Artikelnummer</div>
                  <div className="col-span-5">Bezeichnung</div>
                  <div className="col-span-2 text-center">Menge</div>
                  <div className="col-span-2 text-right">Preis (€)</div>
                </div>
                
                {manualOrderItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 bg-white p-2 items-center">
                    <div className="col-span-3">
                      <input 
                        type="text" 
                        value={item.sku} 
                        onChange={(e) => handleManualOrderSkuChange(idx, e.target.value)} 
                        className="w-full bg-white border border-gray-200 rounded p-2 text-xs outline-none focus:border-blue-500 font-mono"
                        placeholder="SKU-..."
                        list="article_suggestions"
                      />
                    </div>
                    <div className="col-span-4">
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => handleUpdateManualOrderItem(idx, 'name', e.target.value)} 
                        className="w-full bg-white border border-gray-200 rounded p-2 text-xs outline-none focus:border-blue-500"
                        placeholder="Artikelbezeichnung"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input 
                        type="number" 
                        min="1"
                        value={item.quantity} 
                        onChange={(e) => handleUpdateManualOrderItem(idx, 'quantity', Number(e.target.value))} 
                        className="w-full bg-white border border-gray-200 rounded p-2 text-xs outline-none focus:border-blue-500 text-center"
                        required
                      />
                    </div>
                    <div className="col-span-2 relative">
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={item.price} 
                        onChange={(e) => handleUpdateManualOrderItem(idx, 'price', Number(e.target.value))} 
                        className="w-full bg-white border border-gray-200 rounded p-2 pl-6 text-xs outline-none focus:border-blue-500 text-right"
                        required
                      />
                      <span className="absolute left-2 top-2 text-xs text-gray-400">€</span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" onClick={() => removeManualOrderItem(idx)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded cursor-pointer transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={addManualOrderItem}
                className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Neue Position hinzufügen
              </button>
            </div>

            <datalist id="article_suggestions">
              {products.map(p => (
                <option key={p.id} value={p.articleNumber || ''}>{p.name} ({p.price}€)</option>
              ))}
            </datalist>

            <div className="pt-6 border-t border-gray-100 flex justify-end gap-3 items-center">
              <div className="text-lg font-black text-gray-800">
                Gesamt: {manualOrderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)} €
              </div>
              <button 
                type="submit"
                disabled={manualOrderLoading}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow cursor-pointer transition-all flex items-center gap-2 disabled:bg-gray-400"
              >
                {manualOrderLoading ? 'Wird erstellt...' : 'Auftrag erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
