import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { User, FileText, Package, LogOut, ArrowLeft, Loader2, MapPin, Building2, UserCircle, Save } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

export default function UserDashboard({ currentUser }: { currentUser: any }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { name: 'Mein Profil', path: '/account', icon: UserCircle },
    { name: 'Meine Pläne', path: '/account/plans', icon: FileText },
    { name: 'Bestellungen', path: '/account/orders', icon: Package }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="text-gray-500 hover:text-emerald-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Mein Konto</h1>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (location.pathname === item.path + '/');
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      isActive 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-emerald-700'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <Routes>
                <Route path="/" element={<ProfileTab currentUser={currentUser} />} />
                <Route path="/plans" element={<PlansTab currentUser={currentUser} />} />
                <Route path="/orders" element={<OrdersTab currentUser={currentUser} />} />
              </Routes>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}

function ProfileTab({ currentUser }: { currentUser: any }) {
  const [formData, setFormData] = useState({
    displayName: currentUser?.displayName || '',
    company: currentUser?.company || '',
    street: currentUser?.address?.street || '',
    postalCode: currentUser?.address?.postalCode || '',
    city: currentUser?.address?.city || '',
    country: currentUser?.address?.country || 'Deutschland'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await setDoc(userRef, {
        displayName: formData.displayName,
        company: formData.company,
        address: {
          street: formData.street,
          postalCode: formData.postalCode,
          city: formData.city,
          country: formData.country
        }
      }, { merge: true });
      setSaveMessage('Erfolgreich gespeichert!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage('Fehler beim Speichern.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <UserCircle className="w-6 h-6 text-emerald-600" />
        Meine Profildaten
      </h2>

      <div className="bg-gray-50/50 rounded-xl p-4 mb-8 border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Account</p>
          <p className="font-bold text-gray-900">{currentUser.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Benutzername</p>
          <p className="font-bold text-gray-900">@{currentUser.username}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Anzeigename</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input name="displayName" value={formData.displayName} onChange={handleChange} className="pl-10 w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Firma <span className="font-normal normal-case text-gray-400">(optional)</span></label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Building2 className="w-5 h-5 text-gray-400" />
               </div>
               <input name="company" value={formData.company} onChange={handleChange} className="pl-10 w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" />
            </div>
          </div>

          <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
               <MapPin className="w-5 h-5 text-gray-400" />
               Rechnungs- & Lieferadresse
             </h3>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Straße & Hausnummer</label>
            <input name="street" value={formData.street} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">PLZ</label>
            <input name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ort</label>
            <input name="city" value={formData.city} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm" />
          </div>
          
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Land</label>
            <select name="country" value={formData.country} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm appearance-none">
              <option>Deutschland</option>
              <option>Österreich</option>
              <option>Schweiz</option>
            </select>
          </div>
        </div>

        <div className="pt-6 flex items-center justify-end gap-4 border-t border-gray-100">
           {saveMessage && (
             <span className={`text-sm font-bold ${saveMessage.includes('Fehler') ? 'text-red-500' : 'text-emerald-600'}`}>
               {saveMessage}
             </span>
           )}
           <button 
             type="submit" 
             disabled={isSaving}
             className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all disabled:opacity-70 flex items-center gap-2 cursor-pointer"
           >
             {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             Speichern
           </button>
        </div>
      </form>
    </div>
  );
}

function PlansTab({ currentUser }: { currentUser: any }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'plans'), where('userId', '==', currentUser.id));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data());
        data.sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
        setPlans(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [currentUser]);

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6 text-emerald-600" />
        Gespeicherte Bewässerungspläne
      </h2>

      {plans.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>Du hast noch keine Pläne gespeichert.</p>
          <button 
            onClick={() => navigate('/planner')} 
            className="mt-4 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold hover:bg-emerald-200 transition-colors"
          >
            Neuen Plan zeichnen
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:border-emerald-300 transition-colors group">
               <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">{p.name || 'Unbenannter Plan'}</h3>
               <p className="text-xs text-gray-500 mt-1">Zuletzt bearbeitet: {new Date(p.lastEdited).toLocaleDateString('de-DE')}</p>
               <button 
                 onClick={() => navigate('/planner', { state: { loadPlan: p.id } })}
                 className="mt-4 w-full bg-white border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors text-sm cursor-pointer"
               >
                 Im Planer öffnen
               </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ currentUser }: { currentUser: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'orders'), where('userId', '==', currentUser.id));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data());
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [currentUser]);

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Package className="w-6 h-6 text-emerald-600" />
        Meine Bestellungen
      </h2>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>Du hast noch keine Bestellungen aufgegeben.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, i) => (
             <div key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-emerald-300 transition-colors">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                   <div>
                     <p className="text-xs text-gray-500 font-bold uppercase">Bestelldatum</p>
                     <p className="font-semibold text-gray-900">{new Date(order.date).toLocaleString('de-DE')}</p>
                   </div>
                   <div className="text-left sm:text-right">
                     <p className="text-xs text-gray-500 font-bold uppercase">Bestellwert</p>
                     <p className="font-bold text-emerald-700">{order.total?.toFixed(2) || '0.00'} €</p>
                   </div>
                   <div>
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        order.status === 'Abgeschlossen' || order.status === 'Versendet' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-amber-100 text-amber-800'
                     }`}>
                        {order.status || 'Ausstehend'}
                     </span>
                   </div>
                </div>
                <div className="p-4">
                   <div className="space-y-3">
                     {order.items?.map((item: any, idx: number) => (
                       <div key={idx} className="flex items-center gap-3">
                         {item.imageUrl ? (
                           <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover rounded bg-gray-100" />
                         ) : (
                           <div className="w-10 h-10 bg-emerald-100 rounded flex items-center justify-center shrink-0">
                             <Package className="w-5 h-5 text-emerald-600" />
                           </div>
                         )}
                         <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 line-clamp-1">{item.name}</p>
                            <p className="text-xs text-gray-500">Menge: {item.quantity}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
