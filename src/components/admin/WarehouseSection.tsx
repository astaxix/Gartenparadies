import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Product, CategoryNode } from '../../types';
import { Package, Search, AlertOctagon, ArrowUpDown, ChevronDown, CheckCircle2, RotateCcw, Plus, Minus, Save, Info, Sliders, Mail, Clock } from 'lucide-react';

interface WarehouseSectionProps {
  products: Product[];
  categories: CategoryNode[];
  onUpdateProducts: (products: Product[]) => Promise<any> | any;
}

export default function WarehouseSection({ products, categories, onUpdateProducts }: WarehouseSectionProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSubTab = location.pathname.includes('/warehouse/einstellungen') ? 'settings' : 'inventory';

  const setActiveSubTab = (tab: 'inventory' | 'settings') => {
    if (tab === 'inventory') {
      navigate('/admin/warehouse/bestand');
    } else {
      navigate('/admin/warehouse/einstellungen');
    }
  };
  
  // Inventory Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'sku'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inline Editing tracker
  const [localStocks, setLocalStocks] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Settings
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    return Number(localStorage.getItem('wh_low_stock_threshold')) || 5;
  });
  const [autoReplenish, setAutoReplenish] = useState<boolean>(() => {
    return localStorage.getItem('wh_auto_replenish') !== 'false';
  });
  const [leadTimeDays, setLeadTimeDays] = useState<number>(() => {
    return Number(localStorage.getItem('wh_lead_time_days')) || 3;
  });
  const [supplierEmail, setSupplierEmail] = useState<string>(() => {
    return localStorage.getItem('wh_supplier_email') || 'bestellung@garten-grosshandel.de';
  });

  // Keep local stocks and settings updated list
  useEffect(() => {
    const initial: Record<string, number> = {};
    products.forEach(p => {
      initial[p.id] = p.stock ?? 0;
    });
    setLocalStocks(prev => ({ ...initial, ...prev })); // only fill missing, keep current edits
  }, [products]);

  // Safe save for warehouse settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wh_low_stock_threshold', String(lowStockThreshold));
    localStorage.setItem('wh_auto_replenish', String(autoReplenish));
    localStorage.setItem('wh_lead_time_days', String(leadTimeDays));
    localStorage.setItem('wh_supplier_email', supplierEmail);
    
    // Quick flash
    alert('Lager-Einstellungen erfolgreich lokal gespeichert!');
  };

  // Adjust stock in local state
  const adjustStock = (productId: string, amount: number) => {
    setLocalStocks(prev => {
      const current = prev[productId] ?? products.find(p => p.id === productId)?.stock ?? 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + amount)
      };
    });
  };

  const handleCustomStock = (productId: string, isAdd: boolean) => {
    const val = prompt(isAdd ? "Menge für Lieferung eingeben:" : "Menge für Verkauf eingeben:");
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) {
        adjustStock(productId, isAdd ? num : -num);
      }
    }
  };

  // Safe write of stock back to Products & Firestore/Cloud
  const handleSaveStock = async (productId: string) => {
    const targetStock = localStocks[productId];
    if (targetStock === undefined) return;

    setSavingId(productId);
    try {
      const updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { ...p, stock: targetStock };
        }
        return p;
      });
      await onUpdateProducts(updatedProducts);
      
      setSuccessId(productId);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      console.error('Error saving stock for product:', err);
      alert('Fehler beim Speichern des Lagerbestandes in der Cloud. Daten wurden lokal zurückgesetzt.');
      // Restore
      const orig = products.find(p => p.id === productId)?.stock ?? 0;
      setLocalStocks(prev => ({ ...prev, [productId]: orig }));
    } finally {
      setSavingId(null);
    }
  };

  // Restock action for all low stock items
  const handleRestockAllLow = async () => {
    if (!window.confirm('Möchtest du alle Artikel mit einer Bestands-Warnung um +25 auffüllen?')) return;
    
    const updatedProducts = products.map(p => {
      if (p.stock <= lowStockThreshold) {
        return { ...p, stock: (p.stock || 0) + 25 };
      }
      return p;
    });

    try {
      await onUpdateProducts(updatedProducts);
      // Sync local UI
      const initial: Record<string, number> = {};
      updatedProducts.forEach(p => {
        initial[p.id] = p.stock;
      });
      setLocalStocks(initial);
      alert('Bestseller erfolgreich aufgestockt!');
    } catch (err) {
      alert('Aktion fehlgeschlagen.');
    }
  };

  // Filter products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(query) || 
                            p.articleNumber?.toLowerCase().includes(query) ||
                            p.id.toLowerCase().includes(query);
      
      const matchesCategory = categoryFilter === '' || p.category === categoryFilter;
      
      const matchesLowStock = !onlyLowStock || p.stock <= lowStockThreshold;

      return matchesSearch && matchesCategory && matchesLowStock;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'stock') {
        comparison = a.stock - b.stock;
      } else if (sortBy === 'sku') {
        comparison = (a.articleNumber || '').localeCompare(b.articleNumber || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, searchQuery, categoryFilter, onlyLowStock, sortBy, sortOrder, lowStockThreshold]);

  const toggleSort = (field: 'name' | 'stock' | 'sku') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Warehouse</h1>
          <p className="text-sm text-gray-500">Präzise Bestandsverwaltung, Warnschwellen und Lieferanten-Nachbestellungen.</p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex bg-gray-200/80 p-1 rounded-lg border border-gray-200">
          <button 
            onClick={() => setActiveSubTab('inventory')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeSubTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Package className="w-4 h-4" /> Warenbestand
          </button>
          <button 
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeSubTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Sliders className="w-4 h-4" /> Lager-Einstellungen
          </button>
        </div>
      </div>

      {activeSubTab === 'inventory' ? (
        <>
          {/* Quick Info & Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center border border-slate-800">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gesamtbestand im Lager</p>
                <h3 className="text-2xl font-black mt-1 font-mono">
                  {products.reduce((acc, p) => acc + (p.stock || 0), 0)} <span className="text-xs text-slate-400 font-normal font-sans">Produkte</span>
                </h3>
              </div>
              <Package className="w-8 h-8 text-slate-500" />
            </div>

            <div className="bg-amber-50 rounded-xl p-4 flex justify-between items-center border border-amber-200 text-amber-900">
              <div>
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Unter Warnschwelle ({lowStockThreshold})</p>
                <h3 className="text-2xl font-black mt-1 font-mono">
                  {products.filter(p => p.stock <= lowStockThreshold).length} <span className="text-xs text-amber-600 font-normal font-sans">Artikel</span>
                </h3>
              </div>
              <AlertOctagon className="w-8 h-8 text-amber-500" />
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col justify-between border border-gray-200">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Lager-Schnellaktion</span>
              <button 
                onClick={handleRestockAllLow}
                className="mt-2 w-full text-center bg-blue-605 sm:bg-blue-600 hover:bg-blue-700 text-white rounded-md py-1.5 px-3 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Alle kritischen Bestände auffüllen (+25)
              </button>
            </div>
          </div>

          {/* Filtering Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Suche nach Name, EAN, Artikelnummer..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Alle Kategorien</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            {/* Warning filter toggle */}
            <button
              onClick={() => setOnlyLowStock(prev => !prev)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-2 ${
                onlyLowStock 
                  ? 'bg-amber-100 text-amber-900 border-amber-300' 
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" /> Nur Warnungen anzeigen
            </button>
          </div>

          {/* Core Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-400 font-medium font-sans">
                  Keine passenden Artikel im Warenbestand gefunden.
                </div>
              ) : filteredProducts.map(p => {
                const currentStock = localStocks[p.id] ?? p.stock ?? 0;
                const stockChanged = currentStock !== p.stock;
                const isLow = currentStock <= lowStockThreshold && currentStock > 0;
                const isCritical = currentStock === 0;

                return (
                  <div key={p.id} className={`p-4 flex flex-col gap-3 ${stockChanged ? 'bg-amber-50/40' : ''}`}>
                    <div className="flex gap-4">
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=200'; }}
                        className="w-16 h-16 object-cover rounded border border-gray-200 flex-shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-[13px] line-clamp-2 leading-snug">{p.name}</div>
                        <div className="text-[10px] text-gray-400 mt-1">ID: {p.id}</div>
                        <div className="font-mono text-[11px] text-gray-500 font-medium mt-0.5">Art.-Nr: {p.articleNumber || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Bestand</div>
                        <div className="flex items-center gap-2">
                           <span className={`${stockChanged ? 'text-amber-800 font-black line-through scale-90 opacity-60' : 'hidden'}`}>
                             {p.stock}
                           </span>
                           <span className={`text-[16px] font-black ${
                             isCritical ? 'text-rose-600' :
                             isLow ? 'text-amber-600' :
                             stockChanged ? 'text-blue-600' : 'text-slate-800'
                           }`}>
                             {currentStock}
                           </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 overflow-hidden w-[100px] shadow-sm">
                            <button 
                              onClick={() => adjustStock(p.id, -1)}
                              className="p-1 px-2.5 h-8 text-gray-500 hover:text-black hover:bg-gray-150 transition-all font-bold cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input 
                              type="number" 
                              value={currentStock}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setLocalStocks(prev => ({ ...prev, [p.id]: Math.max(0, val) }));
                              }}
                              className="w-full text-center h-8 bg-white border-x border-gray-200 font-mono font-bold text-xs outline-none"
                            />
                            <button 
                              onClick={() => adjustStock(p.id, 1)}
                              className="p-1 px-2.5 h-8 text-gray-500 hover:text-black hover:bg-gray-150 transition-all font-bold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 opacity-70 focus-within:opacity-100 hover:opacity-100 transition-opacity mt-1">
                            <button onClick={() => handleCustomStock(p.id, false)} className="text-[9px] bg-red-50 text-red-700 px-1 rounded hover:bg-red-100 border border-red-200" title="Verkauf beliebig">- Menge</button>
                            <button onClick={() => adjustStock(p.id, -10)} className="text-[9px] bg-red-50 text-red-700 px-1 rounded hover:bg-red-100" title="Verkauf 10">-10</button>
                            <button onClick={() => adjustStock(p.id, 10)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100" title="Lieferung 10">+10</button>
                            <button onClick={() => adjustStock(p.id, 50)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100" title="Lieferung 50">+50</button>
                            <button onClick={() => handleCustomStock(p.id, true)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100 border border-emerald-200" title="Lieferung beliebig">+ Menge</button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveStock(p.id)}
                          disabled={!stockChanged || savingId === p.id}
                          className={`p-2 rounded transition-all cursor-pointer ${
                            successId === p.id 
                              ? 'bg-emerald-500 text-white'
                              : stockChanged 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {savingId === p.id ? (
                            <span className="block border-2 border-white border-t-transparent animate-spin w-4 h-4 rounded-full"></span>
                          ) : successId === p.id ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-55/60 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider font-mono">
                  <tr>
                    <th className="px-5 py-3.5 text-center w-12">Bild</th>
                    <th className="px-5 py-3.5 cursor-pointer hover:text-black" onClick={() => toggleSort('name')}>
                      Artikelname {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th className="px-5 py-3.5 cursor-pointer hover:text-black" onClick={() => toggleSort('sku')}>
                      EAN / SKU {sortBy === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th className="px-5 py-3.5">Kategorie</th>
                    <th className="px-5 py-3.5 cursor-pointer hover:text-black" onClick={() => toggleSort('stock')}>
                      Bestand {sortBy === 'stock' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-center w-[160px]">Bestand anpassen</th>
                    <th className="px-5 py-3.5 text-center w-20">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 leading-normal">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-400 font-medium font-sans">
                        Keine passenden Artikel im Warenbestand gefunden.
                      </td>
                    </tr>
                  ) : filteredProducts.map(p => {
                    const currentStock = localStocks[p.id] ?? p.stock ?? 0;
                    const stockChanged = currentStock !== p.stock;
                    
                    const isLow = currentStock <= lowStockThreshold && currentStock > 0;
                    const isCritical = currentStock === 0;

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${stockChanged ? 'bg-amber-50/40' : ''}`}>
                        {/* Image */}
                        <td className="px-5 py-3">
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=200'; }}
                            className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0 mx-auto" 
                            referrerPolicy="no-referrer"
                          />
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3 font-medium text-slate-800">
                          <div className="font-semibold text-gray-800 text-[13px]">{p.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">ID: {p.id}</div>
                        </td>

                        {/* SKU */}
                        <td className="px-5 py-3 font-mono text-[11px] text-gray-500 font-medium">
                          {p.articleNumber || 'N/A'}
                        </td>

                        {/* Category */}
                        <td className="px-5 py-3 text-slate-500 font-medium">
                          {p.category || 'Standard'}
                        </td>

                        {/* Stock */}
                        <td className="px-5 py-3 font-mono">
                          <span className={`${stockChanged ? 'text-amber-800 font-black line-through scale-90 opacity-60 mr-1.5 inline-block' : 'hidden'}`}>
                            {p.stock}
                          </span>
                          <span className={`text-[14px] font-black ${
                            isCritical ? 'text-rose-600 font-black' :
                            isLow ? 'text-amber-600 font-black' :
                            stockChanged ? 'text-blue-600' : 'text-slate-800'
                          }`}>
                            {currentStock}
                          </span>
                        </td>

                        {/* Status Pills */}
                        <td className="px-5 py-3">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-[10px] uppercase font-sans animate-pulse">
                              Ausverkauft
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-extrabold text-[10px] uppercase font-sans">
                              Meldebestand
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-[10px] uppercase font-sans">
                              Verfügbar
                            </span>
                          )}
                        </td>

                        {/* Adjust Stock Widget */}
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 overflow-hidden w-[120px] mx-auto shadow-sm">
                              <button 
                                onClick={() => adjustStock(p.id, -1)}
                                className="p-1 px-2.5 h-8 text-gray-500 hover:text-black hover:bg-gray-150 transition-all font-bold cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input 
                                type="number" 
                                value={currentStock}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setLocalStocks(prev => ({ ...prev, [p.id]: Math.max(0, val) }));
                                }}
                                className="w-full text-center h-8 bg-white border-x border-gray-200 font-mono font-bold text-xs outline-none"
                              />
                              <button 
                                onClick={() => adjustStock(p.id, 1)}
                                className="p-1 px-2.5 h-8 text-gray-500 hover:text-black hover:bg-gray-150 transition-all font-bold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 opacity-70 focus-within:opacity-100 hover:opacity-100 transition-opacity mt-1">
                              <button onClick={() => handleCustomStock(p.id, false)} className="text-[9px] bg-red-50 text-red-700 px-1 rounded hover:bg-red-100 border border-red-200" title="Verkauf beliebig">- Menge</button>
                              <button onClick={() => adjustStock(p.id, -10)} className="text-[9px] bg-red-50 text-red-700 px-1 rounded hover:bg-red-100" title="Verkauf 10">-10</button>
                              <button onClick={() => adjustStock(p.id, 10)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100" title="Lieferung 10">+10</button>
                              <button onClick={() => adjustStock(p.id, 50)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100" title="Lieferung 50">+50</button>
                              <button onClick={() => handleCustomStock(p.id, true)} className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded hover:bg-emerald-100 border border-emerald-200" title="Lieferung beliebig">+ Menge</button>
                            </div>
                          </div>
                        </td>

                        {/* Save Button */}
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handleSaveStock(p.id)}
                            disabled={!stockChanged || savingId === p.id}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              successId === p.id 
                                ? 'bg-emerald-500 text-white'
                                : stockChanged 
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow shadow-sm'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title="Lagerbestand speichern"
                          >
                            {savingId === p.id ? (
                              <span className="block border-2 border-white border-t-transparent animate-spin w-4 h-4 rounded-full"></span>
                            ) : successId === p.id ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Settings Tab */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl font-sans">
          <div className="flex items-center gap-2 mb-6 border-b pb-3">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-lg text-gray-800">Lagerhaltungs-Parameter konfigurieren</h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Allgemeine Meldeschwelle (Warnungs-Limit)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={lowStockThreshold} 
                  onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value) || 0))} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 transition-all pl-10"
                />
                <Info className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <p className="text-[10px] text-gray-400 leading-normal mt-1.5">
                Ist der Bestand eines Produkts kleiner oder gleich dieser Menge, wird das System eine Warnung ausgeben.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Automatischer Bestellungsentwurf bei Unterschreitung
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="auto_rep"
                  checked={autoReplenish}
                  onChange={(e) => setAutoReplenish(e.target.checked)}
                  className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="auto_rep" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                  Entwurf an Lieferanten automatisch generieren (Vorschlagsliste aktivieren)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Lieferzeit Restock (Wiederbeschaffung)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    value={leadTimeDays} 
                    onChange={(e) => setLeadTimeDays(Math.max(1, parseInt(e.target.value) || 0))} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 transition-all pl-10"
                  />
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">In Tagen (z.B. 3 Werktage).</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  E-Mail Lieferant
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={supplierEmail} 
                    onChange={(e) => setSupplierEmail(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 transition-all pl-10"
                  />
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">Für den Schnelleinkauf.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button 
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-620 bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Lagerparameter sichern
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
