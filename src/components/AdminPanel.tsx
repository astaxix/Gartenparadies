import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Settings, 
  Tag, 
  FolderTree, 
  LogOut, 
  Search, 
  Bell, 
  Menu, 
  FileText, 
  Package, 
  Database, 
  BarChart3, 
  Sliders, 
  Landmark, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Info,
  Plus
} from 'lucide-react';
import { Order, Product, CategoryNode } from '../types';
import { useState } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';

// Importer existing sub tabs & new visual section builders
import ArticlesTab from './admin/ArticlesTab';
import CategoriesTab from './admin/CategoriesTab';
import BackupTab from './admin/BackupTab';
import StatsSection from './admin/StatsSection';
import WarehouseSection from './admin/WarehouseSection';
import AccountingSection from './admin/AccountingSection';

interface AdminResponsiveProps {
  products: Product[];
  categories: CategoryNode[];
  orders: Order[];
  onExitAdmin: () => void;
  onUpdateProducts: (products: Product[]) => Promise<any> | any;
  onUpdateCategories: (categories: CategoryNode[]) => Promise<any> | any;
}

export default function AdminPanel({ 
  products, 
  categories, 
  orders, 
  onExitAdmin, 
  onUpdateProducts, 
  onUpdateCategories 
}: AdminResponsiveProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL path
  const currentPath = location.pathname;
  let activeTab = 'dashboard';
  if (currentPath.includes('/admin/shop/artikel')) activeTab = 'articles';
  else if (currentPath.includes('/admin/shop/kategorien')) activeTab = 'categories';
  else if (currentPath.includes('/admin/shop/statistiken')) activeTab = 'stats';
  else if (currentPath.includes('/admin/shop/backup')) activeTab = 'backup';
  else if (currentPath.includes('/admin/warehouse/bestand')) activeTab = 'warehouse_bestand';
  else if (currentPath.includes('/admin/warehouse/einstellungen')) activeTab = 'warehouse_einstellungen';
  else if (currentPath.includes('/admin/accounting/bestellungen')) activeTab = 'accounting_bestellungen';
  else if (currentPath.includes('/admin/accounting/kunden')) activeTab = 'accounting_kunden';
  else if (currentPath.includes('/admin/accounting/gutscheine')) activeTab = 'accounting_gutscheine';
  else if (currentPath.includes('/admin/accounting/rechnungen')) activeTab = 'accounting_rechnungen';
  else if (currentPath.includes('/admin/accounting/einstellungen')) activeTab = 'accounting_einstellungen';
  else if (currentPath.includes('/admin/accounting/manuell')) activeTab = 'accounting_manuell';

  const totalRevenue = orders.reduce((acc, order) => acc + order.total, 0);

  const getTabClass = (tab: string) => {
    const base = "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all w-full text-left font-sans text-xs font-semibold ";
    if (activeTab === tab) {
      return base + "bg-blue-600 text-white shadow-sm font-bold scale-[1.01]";
    }
    return base + "text-gray-300 hover:bg-gray-800 hover:text-white";
  };

  const handleTabClick = (tab: string, path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  // Safe Warehouse alerts count
  const lowStockThreshold = Number(localStorage.getItem('wh_low_stock_threshold')) || 5;
  const warehouseAlertCount = products.filter(p => (p.stock ?? 0) <= lowStockThreshold).length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans overflow-x-hidden w-full select-none">
      
      {/* Sidebar - Grouped Admin Sections (Shop, Warehouse, Accounting) */}
      <aside className={`w-full md:w-64 bg-[#1f2937] text-gray-350 md:min-h-screen flex flex-col flex-shrink-0 transition-all shadow-md ${isMobileMenuOpen ? 'h-auto' : 'h-16 md:h-auto overflow-hidden md:overflow-visible'}`}>
        <div className="p-4 bg-[#111827] flex items-center justify-between shrink-0 h-16 border-b border-gray-800">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleTabClick('dashboard', '/admin/dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-emerald-55 bg-emerald-600 flex items-center justify-center font-black text-white font-mono text-[15px] shadow-inner">GP</div>
            <span className="text-white font-extrabold text-sm tracking-wider uppercase">Garten <span className="font-light text-gray-400">Admin</span></span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="md:hidden text-gray-400 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        
        {/* Navigation grouped list */}
        <nav className={`flex-1 py-4 flex flex-col gap-4 px-3 overflow-y-auto scrollbar-none ${isMobileMenuOpen ? 'flex' : 'hidden md:flex'}`}>
          <button onClick={() => handleTabClick('dashboard', '/admin/dashboard')} className={getTabClass('dashboard')}>
            <LayoutDashboard className="w-4 h-4 text-gray-400" /> Haupt-Dashboard
          </button>
          
          {/* Admin Shop Section */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Admin Shop</span>
            <button onClick={() => handleTabClick('articles', '/admin/shop/artikel')} className={getTabClass('articles')}>
              <Tag className="w-4 h-4 text-emerald-400" /> Artikel verwalten
            </button>
            <button onClick={() => handleTabClick('categories', '/admin/shop/kategorien')} className={getTabClass('categories')}>
              <FolderTree className="w-4 h-4 text-emerald-400" /> Kategorien
            </button>
            <button onClick={() => handleTabClick('stats', '/admin/shop/statistiken')} className={getTabClass('stats')}>
              <BarChart3 className="w-4 h-4 text-emerald-400" /> Statistiken &amp; Umsatz
            </button>
            <button onClick={() => handleTabClick('backup', '/admin/shop/backup')} className={getTabClass('backup')}>
              <Database className="w-4 h-4 text-emerald-400" /> Sicherungen &amp; Cloud
            </button>
          </div>

          {/* Admin Warehouse Section */}
          <div className="space-y-1">
            <div className="flex justify-between items-center px-3 mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Admin Warehouse</span>
              {warehouseAlertCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block animate-pulse" />
              )}
            </div>
            <button onClick={() => handleTabClick('warehouse_bestand', '/admin/warehouse/bestand')} className={getTabClass('warehouse_bestand')}>
              <Package className="w-4 h-4 text-sky-400" /> Warenbestand {warehouseAlertCount > 0 && <span className="ml-auto bg-amber-500 text-slate-900 border border-amber-400 font-extrabold text-[9px] px-1 rounded font-mono">{warehouseAlertCount}</span>}
            </button>
            <button onClick={() => handleTabClick('warehouse_einstellungen', '/admin/warehouse/einstellungen')} className={getTabClass('warehouse_einstellungen')}>
              <Settings className="w-4 h-4 text-sky-400" /> Lager-Einstellungen
            </button>
          </div>

          {/* Admin Accounting Section */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Admin Accounting</span>
            <button onClick={() => handleTabClick('accounting_bestellungen', '/admin/accounting/bestellungen')} className={getTabClass('accounting_bestellungen')}>
              <ShoppingBag className="w-4 h-4 text-purple-400" /> Bestellungen
            </button>
            <button onClick={() => handleTabClick('accounting_kunden', '/admin/accounting/kunden')} className={getTabClass('accounting_kunden')}>
              <Users className="w-4 h-4 text-purple-400" /> Kunden verwalten
            </button>
            <button onClick={() => handleTabClick('accounting_gutscheine', '/admin/accounting/gutscheine')} className={getTabClass('accounting_gutscheine')}>
              <Tag className="w-4 h-4 text-purple-400" /> Rabatt-Gutscheine
            </button>
            <button onClick={() => handleTabClick('accounting_rechnungen', '/admin/accounting/rechnungen')} className={getTabClass('accounting_rechnungen')}>
              <FileText className="w-4 h-4 text-purple-400" /> Rechnungsbelege
            </button>
            <button onClick={() => handleTabClick('accounting_manuell', '/admin/accounting/manuell')} className={getTabClass('accounting_manuell')}>
              <Plus className="w-4 h-4 text-purple-400" /> Manuelle Aufträge
            </button>
            <button onClick={() => handleTabClick('accounting_einstellungen', '/admin/accounting/einstellungen')} className={getTabClass('accounting_einstellungen')}>
              <Sliders className="w-4 h-4 text-purple-400" /> Steuer &amp; Briefkopf
            </button>
          </div>
        </nav>

        {/* Exit footer link */}
        <div className={`p-4 border-t border-gray-800 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <button onClick={onExitAdmin} className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full transition-colors font-semibold text-xs py-1 cursor-pointer">
            <LogOut className="w-4.5 h-4.5" /> Zum Shop wechseln
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        
        {/* Top Header line */}
        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 min-w-0 shadow-xs z-10">
           <div className="flex items-center gap-2 md:gap-4 text-gray-500 w-full max-w-sm mr-4">
             <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-450" />
                <input 
                  type="text" 
                  placeholder="In Administration suchen..." 
                  disabled
                  className="pl-9 pr-4 py-1.5 bg-gray-50 border-transparent rounded-lg text-xs w-full outline-none opacity-60 cursor-not-allowed font-medium" 
                />
             </div>
           </div>
           
           <div className="flex items-center gap-3 md:gap-4 shrink-0">
              <button className="relative text-gray-450 hover:text-gray-700 cursor-not-allowed" disabled>
                <Bell className="w-5 h-5" />
                <span className="absolute top-0.5 right-0.5 bg-red-500 w-2 h-2 rounded-full border-2 border-white"></span>
              </button>
              
              <div className="flex items-center gap-2 border-l pl-3 md:pl-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
                  AD
                </div>
                <div className="hidden lg:block text-left text-[11px] leading-tight">
                  <span className="block font-bold text-gray-805">Haupt-Administrator</span>
                  <span className="text-gray-400 font-mono">info@as-mietwagen-service.de</span>
                </div>
              </div>
           </div>
        </header>

        {/* Dynamic routing contents container */}
        <div className="p-4 md:p-6 overflow-auto flex-1 max-w-7xl mx-auto w-full">
          <Routes>
            
            {/* 1. Haupt Admin Panel Landing Dashboard */}
            <Route path="dashboard" element={
              <div className="space-y-6">
                
                {/* Visual Intro Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b pb-3 border-gray-200">
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Haupt Admin Panel</h1>
                    <p className="text-sm text-gray-500">Willkommen im zentralen Steuerungszentrale von Gartenparadies.</p>
                  </div>
                  <button className="bg-gray-200 text-gray-700 pointer-events-none text-xs font-semibold px-3 py-1.5 rounded-md border">
                    Rolle: Haupt-Admin ✓
                  </button>
                </div>

                {/* Dashboard KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-t-4 border-t-blue-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gesamtumsatz</p>
                    <h3 className="text-2xl font-black text-gray-800 mt-1">{totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-[10px] text-green-600 font-medium mt-1.5 flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" /> +14% im Vormonatsvergleich
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-t-4 border-t-purple-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bestellungen (Brutto)</p>
                    <h3 className="text-2xl font-black text-gray-800 mt-1">{orders.length} Transaktionen</h3>
                    <p className="text-[10px] text-gray-500 font-medium mt-1.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-blue-500" /> Echtzeit Synchronisation aktiv
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-t-4 border-t-emerald-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Katalog Artikel</p>
                    <h3 className="text-2xl font-black text-gray-800 mt-1">{products.length} Artikel</h3>
                    <p className="text-[10px] text-gray-500 font-medium mt-1.5">
                      Alle Online &amp; aktiv geschaltet
                    </p>
                  </div>
                </div>

                {/* 3-COLUMN ADMINISTRATIVE DEPARTMENT GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-2">
                  
                  {/* Department 1: Shop */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-150">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">Admin Shop</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">Shop-Katalog, Kategorien und Umsatz-Performance.</p>
                      
                      <div className="mt-4 gap-1.5 flex flex-col text-xs font-semibold text-gray-500 border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span>Katalogartikel:</span>
                          <span className="font-bold text-slate-800">{products.length} Stk</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Kategorien:</span>
                          <span className="font-bold text-slate-800">{categories.length} Stk</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 space-y-2">
                      <button 
                        onClick={() => navigate('/admin/shop/artikel')}
                        className="w-full text-center bg-[#f8fafc] hover:bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 group"
                      >
                        Artikel &amp; Kategorien <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                      <button 
                        onClick={() => navigate('/admin/shop/statistiken')}
                        className="w-full text-center bg-blue-50 hover:bg-blue-105 hover:bg-blue-600 hover:text-white text-blue-600 text-xs font-bold py-2 rounded transition-all cursor-pointer"
                      >
                        Umsatzstatistiken öffnen
                      </button>
                    </div>
                  </div>

                  {/* Department 2: Warehouse */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-4 border border-sky-150">
                        <Package className="w-5 h-5" />
                      </div>
                      <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">Admin Warehouse</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">Bestandssteuerung, Meldeschwellen &amp; Lieferanten.</p>
                      
                      <div className="mt-4 gap-1.5 flex flex-col text-xs font-semibold text-gray-500 border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span>Gesamtlagerbestand:</span>
                          <span className="font-bold text-slate-800 font-mono">{products.reduce((acc, p) => acc + (p.stock || 0), 0)} Einheiten</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Lagerwarnungen:</span>
                          <span className={`font-bold ${warehouseAlertCount > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>{warehouseAlertCount} Artikel</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      <button 
                        onClick={() => navigate('/admin/warehouse/bestand')}
                        className="w-full text-center bg-[#f8fafc] hover:bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 group"
                      >
                        Warenbestand anpassen <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                      <button 
                        onClick={() => navigate('/admin/warehouse/einstellungen')}
                        className="w-full text-center bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-600 text-xs font-bold py-2 rounded transition-all cursor-pointer"
                      >
                        Lager-Grenzwerte anpassen
                      </button>
                    </div>
                  </div>

                  {/* Department 3: Accounting */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-150">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">Admin Accounting</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">Bestellungen, Gutscheincodes, Rechnungen &amp; MwSt.</p>
                      
                      <div className="mt-4 gap-1.5 flex flex-col text-xs font-semibold text-gray-500 border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span>Rechnungen:</span>
                          <span className="font-bold text-slate-800">{orders.length} Belege</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Gutscheine (aktiv):</span>
                          <span className="font-bold text-slate-800">Gesichert</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      <button 
                        onClick={() => navigate('/admin/accounting/bestellungen')}
                        className="w-full text-center bg-[#f8fafc] hover:bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 group"
                      >
                        Bestellungen &amp; Rechnungen <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                      <button 
                        onClick={() => navigate('/admin/accounting/gutscheine')}
                        className="w-full text-center bg-purple-50 hover:bg-purple-650 hover:bg-purple-600 hover:text-white text-purple-600 text-xs font-bold py-2 rounded transition-all cursor-pointer"
                      >
                        Gutscheincodes anlegen
                      </button>
                    </div>
                  </div>

                </div>

                {/* Warnings / Diagnostics */}
                {warehouseAlertCount > 0 && (
                  <div className="flex gap-3 text-xs text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4 leading-normal items-start font-sans">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">Warnung: Einige Artikel unterschreiten den Meldesollbestand!</p>
                      <p className="mt-0.5">Detaillierte Zähler zeigen <strong>{warehouseAlertCount} Artikel</strong> mit kritischem Bestand. Bitte wechsle in das <strong>Admin Warehouse</strong>, um Lieferantennachbestellungen auszulösen oder den Warenbestand zu erhöhen.</p>
                    </div>
                  </div>
                )}

              </div>
            } />
            
            {/* 2. ADMIN SHOP ROUTESTRUCS */}
            <Route path="shop/artikel" element={
              <ArticlesTab 
                products={products} 
                categories={categories} 
                onUpdateProducts={onUpdateProducts} 
              />
            } />
            
            <Route path="shop/kategorien" element={
              <CategoriesTab 
                categories={categories} 
                onUpdateCategories={onUpdateCategories} 
              />
            } />

            <Route path="shop/statistiken" element={
              <StatsSection 
                orders={orders} 
                products={products} 
              />
            } />

            <Route path="shop/backup" element={
              <BackupTab 
                products={products} 
                categories={categories} 
                onUpdateProducts={onUpdateProducts} 
                onUpdateCategories={onUpdateCategories} 
              />
            } />

            {/* 3. ADMIN WAREHOUSE (Sub-Routed inside section) */}
            <Route path="warehouse/bestand" element={
              <WarehouseSection 
                products={products}
                categories={categories}
                onUpdateProducts={onUpdateProducts}
              />
            } />

            <Route path="warehouse/einstellungen" element={
              <div className="space-y-4">
                {/* Fallback routing to let Warehouse Tab handle settings smoothly */}
                <WarehouseSection 
                  products={products}
                  categories={categories}
                  onUpdateProducts={onUpdateProducts}
                />
              </div>
            } />

            {/* 4. ADMIN ACCOUNTING */}
            <Route path="accounting/bestellungen" element={
              <AccountingSection orders={orders} products={products} />
            } />
            <Route path="accounting/kunden" element={
              <AccountingSection orders={orders} products={products} />
            } />
            <Route path="accounting/gutscheine" element={
              <AccountingSection orders={orders} products={products} />
            } />
            <Route path="accounting/rechnungen" element={
              <AccountingSection orders={orders} products={products} />
            } />
            <Route path="accounting/einstellungen" element={
              <AccountingSection orders={orders} products={products} />
            } />
            <Route path="accounting/manuell" element={
              <AccountingSection orders={orders} products={products} />
            } />

            {/* Default Catch-all */}
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
