import { motion } from 'motion/react';
import { LayoutDashboard, ShoppingBag, Users, Settings, Tag, FolderTree, LogOut, Search, Bell, Menu, FileText, Package } from 'lucide-react';
import { Order, Product, CategoryNode } from '../types';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import ArticlesTab from './admin/ArticlesTab';
import CategoriesTab from './admin/CategoriesTab';

interface AdminResponsiveProps {
  products: Product[];
  categories: CategoryNode[];
  orders: Order[];
  onExitAdmin: () => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: CategoryNode[]) => void;
}

export default function AdminPanel({ products, categories, orders, onExitAdmin, onUpdateProducts, onUpdateCategories }: AdminResponsiveProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL path
  const currentPath = location.pathname;
  let activeTab = 'dashboard';
  if (currentPath.includes('/admin/artikel')) activeTab = 'articles';
  else if (currentPath.includes('/admin/kategorien')) activeTab = 'categories';
  else if (currentPath.includes('/admin/bestellungen')) activeTab = 'orders';
  else if (currentPath.includes('/admin/lager')) activeTab = 'inventory';
  else if (currentPath.includes('/admin/rechnungen')) activeTab = 'invoices';

  const totalRevenue = orders.reduce((acc, order) => acc + order.total, 0);

  const getTabClass = (tab: string) => {
    return `flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-left ${activeTab === tab ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 hover:text-white'}`;
  };

  const handleTabClick = (tab: string, path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans overflow-x-hidden w-full">
      
      {/* Sidebar - Admin Panel Style (dark blue/grey) */}
      <aside className={`w-full md:w-64 bg-[#1f2937] text-gray-300 md:min-h-screen flex flex-col flex-shrink-0 transition-all ${isMobileMenuOpen ? 'h-auto' : 'h-16 md:h-auto overflow-hidden md:overflow-visible'}`}>
        <div className="p-4 bg-[#111827] flex items-center justify-between shrink-0 h-16">
          <span className="text-white font-bold text-lg tracking-wider">Admin <span className="font-light">Panel</span></span>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="md:hidden text-gray-400 hover:text-white p-1"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        
        <nav className={`flex-1 py-4 flex-col gap-1 px-3 ${isMobileMenuOpen ? 'flex' : 'hidden md:flex'}`}>
          <button onClick={() => handleTabClick('dashboard', '/admin/dashboard')} className={getTabClass('dashboard')}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button onClick={() => handleTabClick('articles', '/admin/artikel')} className={getTabClass('articles')}>
            <Tag className="w-5 h-5" /> Artikel
          </button>
          <button onClick={() => handleTabClick('categories', '/admin/kategorien')} className={getTabClass('categories')}>
            <FolderTree className="w-5 h-5" /> Kategorien
          </button>
          <button onClick={() => handleTabClick('orders', '/admin/bestellungen')} className={getTabClass('orders')}>
            <ShoppingBag className="w-5 h-5" /> Bestellungen
          </button>
          <button onClick={() => handleTabClick('inventory', '/admin/lager')} className={getTabClass('inventory')}>
            <Package className="w-5 h-5" /> Lager
          </button>
          <button onClick={() => handleTabClick('invoices', '/admin/rechnungen')} className={getTabClass('invoices')}>
            <FileText className="w-5 h-5" /> Rechnungen
          </button>
          <button className="flex items-center gap-3 px-3 py-2 mt-4 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full text-left">
            <Users className="w-5 h-5" /> Kunden
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full text-left">
            <Settings className="w-5 h-5" /> Shop-Einstellungen
          </button>
        </nav>

        <div className={`p-4 border-t border-gray-700 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <button onClick={onExitAdmin} className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full transition-colors">
            <LogOut className="w-5 h-5" /> Zum Shop wechseln
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 min-w-0">
           <div className="flex items-center gap-2 md:gap-4 text-gray-500 w-full max-w-sm mr-4">
             <div className="relative w-full">
               <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input type="text" placeholder="Suchen..." className="pl-9 md:pl-10 pr-3 md:pr-4 py-2 bg-gray-100 border-transparent rounded-md focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm w-full outline-none transition-all" />
             </div>
           </div>
           <div className="flex items-center gap-3 md:gap-4 shrink-0">
              <button className="relative text-gray-500 hover:text-gray-700">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-white"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                AD
              </div>
           </div>
        </header>

        {/* Dynamic Content Route */}
        <div className="p-6 overflow-auto flex-1">
          <Routes>
            <Route path="dashboard" element={
              <>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
                    <p className="text-sm text-gray-500">Willkommen in der Administrationsoberfläche von Gartenparadies.</p>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                    Cache leeren
                  </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 border-t-4 border-t-blue-500">
                    <p className="text-sm font-medium text-gray-500 mb-1">Umsatz (Dieser Monat)</p>
                    <h3 className="text-3xl font-bold text-gray-800">{totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-xs text-green-600 mt-2 font-medium">+14% im Vergleich zum Vormonat</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 border-t-4 border-t-emerald-500">
                    <p className="text-sm font-medium text-gray-500 mb-1">Bestellungen</p>
                    <h3 className="text-3xl font-bold text-gray-800">{orders.length}</h3>
                    <p className="text-xs text-green-600 mt-2 font-medium">2 neue heute</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 border-t-4 border-t-purple-500">
                    <p className="text-sm font-medium text-gray-500 mb-1">Aktive Artikel</p>
                    <h3 className="text-3xl font-bold text-gray-800">{products.length}</h3>
                    <p className="text-xs text-gray-500 mt-2 font-medium">Status: Online</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Orders Table */}
                  <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-800">Neueste Bestellungen</h3>
                      <button onClick={() => navigate('/admin/bestellungen')} className="text-sm text-blue-600 hover:underline">Alle ansehen</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-5 py-3 font-medium">Bestell-Nr.</th>
                            <th className="px-5 py-3 font-medium">Kunde</th>
                            <th className="px-5 py-3 font-medium">Datum</th>
                            <th className="px-5 py-3 font-medium">Status</th>
                            <th className="px-5 py-3 font-medium text-right">Summe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                          {orders.length === 0 ? (
                            <tr><td colSpan={5} className="px-5 py-4 text-center text-gray-500">Keine Bestellungen vorhanden.</td></tr>
                          ) : orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-blue-600"><a href="#" className="hover:underline">{order.id}</a></td>
                              <td className="px-5 py-3">{order.customerName}</td>
                              <td className="px-5 py-3 text-gray-500">{new Date(order.date).toLocaleDateString('de-DE')}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium 
                                  ${order.status === 'Versendet' ? 'bg-green-100 text-green-800' : ''}
                                  ${order.status === 'In Bearbeitung' ? 'bg-blue-100 text-blue-800' : ''}
                                  ${order.status === 'Ausstehend' ? 'bg-yellow-100 text-yellow-800' : ''}
                                `}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right font-medium">{order.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Warning Box */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
                    <div className="p-5 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-800">Systemwarnungen</h3>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                       <div className="flex gap-3 text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-yellow-500 mt-1.5"></span>
                          <p>Ein Update für das Modul "PayPal Checkout" ist verfügbar (v3.1.4).</p>
                       </div>
                       <div className="flex gap-3 text-sm text-red-800 bg-red-50 p-3 rounded-md border border-red-200">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5"></span>
                          <p>Cronjob "Sitemap Generierung" wurde vor 2 Stunden erfolgreich ausgeführt.</p>
                       </div>
                    </div>
                  </div>

                </div>
              </>
            } />
            
            <Route path="artikel" element={
              <ArticlesTab 
                products={products} 
                categories={categories} 
                onUpdateProducts={onUpdateProducts} 
              />
            } />
            
            <Route path="kategorien" element={
              <CategoriesTab 
                categories={categories} 
                onUpdateCategories={onUpdateCategories} 
              />
            } />

            <Route path="bestellungen" element={
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
                <h2>Bestellungen (In Entwicklung)</h2>
              </div>
            } />

            <Route path="lager" element={
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
                <h2>Lager (In Entwicklung)</h2>
              </div>
            } />

            <Route path="rechnungen" element={
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
                <h2>Rechnungen (In Entwicklung)</h2>
              </div>
            } />

            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
