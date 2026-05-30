import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Search, Menu, Leaf, Droplets, ArrowRight, PackageOpen, User, X, ChevronRight, Check, Plus, Minus, Download, FileText, Trash2, Package, Loader2, CornerDownRight } from 'lucide-react';
import { Product, CategoryNode } from '../types';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup
} from 'firebase/auth';
import { db, auth, loginWithGoogle } from '../lib/firebase';
import { doc, getDocs, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

import { useNavigate, Link } from 'react-router-dom';

interface ShopFrontProps {
  products: Product[];
  categories: CategoryNode[];
  onAddToCart: (product: Product, variations?: Record<string, string>, quantity?: number) => void;
  cartItemCount: number;
  onOpenCart: () => void;
  onNavigateToAdmin: () => void;
  isAdmin: boolean;
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser?: any;
  setCurrentUser?: (user: any) => void;
}

export default function ShopFront({ 
  products, 
  categories, 
  onAddToCart, 
  cartItemCount, 
  onOpenCart, 
  onNavigateToAdmin, 
  isAdmin, 
  setIsAdmin,
  currentUser,
  setCurrentUser 
}: ShopFrontProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<CategoryNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  
  // Registration and account states
  const [isSavedPlansModalOpen, setIsSavedPlansModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordRepeat, setRegPasswordRepeat] = useState('');
  const [regName, setRegName] = useState('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [onlinePlans, setOnlinePlans] = useState<any[]>([]);
  const [loginSpinner, setLoginSpinner] = useState(false);

  useEffect(() => {
    if (!currentUser || !isSavedPlansModalOpen) return;

    async function fetchPlans() {
      try {
        const q = query(collection(db, 'plans'), where('userId', '==', currentUser.id));
        const s = await getDocs(q);
        const loaded = s.docs.map(doc => doc.data());
        setOnlinePlans(loaded);
      } catch (err) {
        console.error('Failed fetching plans from Firestore:', err);
      }
    }
    fetchPlans();
  }, [currentUser, isSavedPlansModalOpen]);

  const isRoundedTo25 = (product: Product | null) => {
    if (!product) return false;
    const ln = product.name.toLowerCase();
    return ln.includes('pe rohr') || ln.includes('pe-rohr') || ln.includes('tropfrohr') || ln.includes('tropfschlauch');
  };

  useEffect(() => {
    if (selectedProduct && selectedProduct.variations) {
      const initial: Record<string, string> = {};
      selectedProduct.variations.forEach(v => {
        if (v.options.length > 0) {
          initial[v.id] = v.options[0].name;
        }
      });
      setSelectedVariations(initial);
      setSelectedQuantity(isRoundedTo25(selectedProduct) ? 25 : 1);
    } else if (selectedProduct) {
      setSelectedVariations({});
      setSelectedQuantity(isRoundedTo25(selectedProduct) ? 25 : 1);
    } else {
      setSelectedVariations({});
      setSelectedQuantity(1);
    }
  }, [selectedProduct]);

  const calculateDynamicPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.price;
    if (selectedProduct.variations) {
      selectedProduct.variations.forEach(v => {
        const selectedOpt = selectedVariations[v.id];
        if (selectedOpt) {
          const opt = v.options.find(o => o.name === selectedOpt);
          if (opt) price += opt.priceDiff;
        }
      });
    }

    if (selectedProduct.volumePricing && selectedProduct.volumePricing.length > 0) {
      const sortedTiers = [...selectedProduct.volumePricing].sort((a, b) => b.quantity - a.quantity);
      for (const tier of sortedTiers) {
        if (selectedQuantity >= tier.quantity) {
          if (selectedProduct.variations && selectedProduct.variations.length > 0 && tier.discountPercentage !== undefined) {
             price = price * (1 - (tier.discountPercentage / 100));
          } else if (tier.price !== undefined) {
             price = tier.price;
          }
          break;
        }
      }
    }

    return price;
  };
  
  const getStartingPrice = (product: Product) => {
    let lowestPrice = product.price;
    if (product.volumePricing && product.volumePricing.length > 0) {
       const hasVars = product.variations && product.variations.length > 0;
       if (hasVars) {
         // for variations, calculate lowest based on discount
         const maxDiscount = Math.max(...product.volumePricing.map(v => v.discountPercentage || 0));
         lowestPrice = lowestPrice * (1 - (maxDiscount / 100));
       } else {
         lowestPrice = Math.min(lowestPrice, ...product.volumePricing.map(v => v.price !== undefined ? v.price : product.price));
       }
    }
    const hasVariations = product.variations && product.variations.length > 0;
    const hasVolume = product.volumePricing && product.volumePricing.length > 0;
    
    return {
      price: lowestPrice,
      isStarting: hasVariations || hasVolume
    };
  };
  
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedInSearch = (desktopSearchRef.current && desktopSearchRef.current.contains(target)) || 
                              (mobileSearchRef.current && mobileSearchRef.current.contains(target));
      if (!clickedInSearch) {
        setIsSearchFocused(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setIsUserDropdownOpen(false);
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(target)) {
        setIsCategoryMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === 'admin' && loginPassword === 'admin') {
      setIsAdmin(true);
      if (setCurrentUser) {
        setCurrentUser({ id: 'admin', email: 'admin', name: 'Administrator', username: 'admin' });
      }
      setIsUserDropdownOpen(false);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
      return;
    }
    
    try {
      setLoginSpinner(true);
      
      let signinEmail = loginUsername;
      if (!loginUsername.includes('@')) {
        const q = query(collection(db, 'users'), where('username', '==', loginUsername));
        const snap = await getDocs(q);
        if (!snap.empty) {
          signinEmail = snap.docs[0].data().email;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, signinEmail, loginPassword);
      setIsAdmin(userCredential.user.email === 'info@as-mietwagen-service.de' || loginUsername === 'admin');
      setIsUserDropdownOpen(false);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Anmeldung fehlerhaft. Bitte überprüfen Sie Name und Passwort.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'E-Mail/Benutzername oder Passwort falsch.';
      }
      setLoginError(errorMsg);
    } finally {
      setLoginSpinner(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!regUsername || !regEmail || !regPassword) {
      setLoginError('Bitte fülle alle Pflichtfelder aus.');
      return;
    }
    if (regPassword !== regPasswordRepeat) {
      setLoginError('Die Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setLoginSpinner(true);
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const user = userCredential.user;
      
      // Save profile info in Firestore/users
      const userDocRef = doc(db, 'users', user.uid);
      const userData = {
        id: user.uid,
        username: regUsername,
        displayName: regName || regUsername,
        email: regEmail
      };
      await setDoc(userDocRef, userData);

      if (setCurrentUser) {
        setCurrentUser(userData);
      }

      setIsAdmin(user.email === 'info@as-mietwagen-service.de');
      setIsRegistering(false);
      setIsUserDropdownOpen(false);
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setRegPasswordRepeat('');
      setRegName('');
      setLoginError('');
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Registrierung fehlgeschlagen.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Diese E-Mail-Adresse wird bereits verwendet.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Das Passwort ist zu schwach (mind. 6 Zeichen).';
      }
      setLoginError(errorMsg);
    } finally {
      setLoginSpinner(false);
    }
  };

  const getDescendantCategoryIds = (catId: string, allCats: CategoryNode[]): string[] => {
    const children = allCats.filter(c => c.parentId === catId).map(c => c.id);
    let descendants = [...children];
    for (const childId of children) {
      descendants = [...descendants, ...getDescendantCategoryIds(childId, allCats)];
    }
    return descendants;
  };

  const isPlaner = (str: string | undefined) => str ? str.toLowerCase().includes('planer') : false;

  const filteredProducts = products.filter(p => {
    if (isPlaner(p.category) || p.categories?.some(isPlaner)) return false;

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.articleNumber?.toLowerCase().includes(searchQuery.toLowerCase());
                          
    let matchesCategory = true;
    if (activeCategory) {
      const allowedCategories = [activeCategory.id, ...getDescendantCategoryIds(activeCategory.id, categories)];
      matchesCategory = (p.categories || [p.category].filter(Boolean)).some(catId => allowedCategories.includes(catId));
    } else {
      matchesCategory = !(p.categories || [p.category]).some(id => {
        const cat = categories.find(c => c.id === id);
        return isPlaner(cat?.name) || isPlaner(id);
      });
    }
    return matchesSearch && matchesCategory;
  });

  const displayCategories = categories.filter(c => !isPlaner(c.name) && !c.parentId);
  
  const currentSubcategories = activeCategory 
    ? categories.filter(c => c.parentId === activeCategory.id)
    : displayCategories; // if no active category, we show the top level categories inside the main page before articles


  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-gray-800 overflow-x-hidden w-full">
      {/* Top Bar */}
      <div className="bg-emerald-950 text-emerald-100/80 text-[10px] sm:text-xs py-2 px-2 sm:px-4 flex justify-between items-center tracking-wide">
        <span className="truncate pr-2">Kostenloser Versand ab 49€ innerhalb Deutschlands</span>
        {isAdmin && (
          <button onClick={onNavigateToAdmin} className="hover:text-white transition-colors flex items-center gap-1 sm:gap-2 shrink-0">
            Zum Admin Panel <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Main Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200 w-full">
        <div className="max-w-[1400px] mx-auto px-2 md:px-6 py-2 md:py-6 relative">
          <div className="flex items-center justify-between md:gap-8 relative w-full h-12 sm:h-14 md:h-auto">
          
          {/* Menu and Logo Box */}
          <div className="flex items-center gap-4 md:gap-8 shrink-0 z-50">
            {/* Category Menu */}
            <div ref={categoryMenuRef} className="relative shrink-0">
              <button 
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className="p-2 md:p-3 flex items-center gap-2 hover:bg-emerald-50 rounded-xl transition-all text-[#152B4B] md:bg-gray-50 md:border md:border-gray-200 shadow-sm hover:shadow hover:scale-105"
              >
                <Menu className="w-9 h-9 md:w-11 md:h-11 text-[#152B4B]" strokeWidth={2.5} />
                <span className="hidden lg:block font-bold text-lg pr-2 text-[#152B4B]">Kategorien</span>
              </button>
              
              <AnimatePresence>
                {isCategoryMenuOpen && (
                  <>
                    {/* Dark translucent backdrop */}
                    <motion.div
                      key="category-sidebar-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsCategoryMenuOpen(false)}
                      className="fixed inset-0 bg-emerald-950/60 backdrop-blur-xs z-50 cursor-pointer"
                    />

                    {/* Animated Sliding Sidebar Drawer on the Left */}
                    <motion.div
                      key="category-sidebar-drawer"
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                      className="fixed inset-y-0 left-0 w-80 max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col border-r border-[#E2E8F0] h-full"
                    >
                      {/* Sidebar Header */}
                      <div className="p-6 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1 relative scale-90">
                            <Droplets className="w-6 h-6 text-[#1388C9]" />
                            <Leaf className="w-6 h-6 text-[#56A02B] absolute left-2 top-0" />
                          </div>
                          <span className="font-bold text-xl text-[#152B4B] tracking-tight">Kategorien</span>
                        </div>
                        <button 
                          onClick={() => setIsCategoryMenuOpen(false)}
                          aria-label="Schließen"
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-rose-50 rounded-full transition-all duration-200"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Mobile search integration inside Sidebar */}
                      <div className="p-4 border-b border-gray-100 bg-white md:hidden shrink-0 box-border w-full">
                        <div className="relative border border-gray-200 bg-gray-50 rounded-xl overflow-hidden focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-100">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input 
                            type="text" 
                            placeholder="Suche..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(false)}
                            className="block w-full box-border bg-transparent py-2.5 pl-9 pr-4 text-sm outline-none text-gray-800 placeholder:text-gray-400 m-0"
                            style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Scrollable List of Categories */}
                      <div className="flex-1 overflow-y-auto py-4">
                        <div className="px-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Sortiment durchstöbern
                        </div>
                        <ul className="space-y-1.5 px-3">
                          {/* Alle Produkte Option */}
                          <li>
                            <button 
                              onClick={() => { setActiveCategory(null); setIsCategoryMenuOpen(false); }}
                              className={`w-full text-left px-4 py-3 text-base rounded-lg transition-all flex items-center justify-between ${activeCategory === null ? 'bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-500 shadow-xs' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Package className="w-5 h-5 text-emerald-600" />
                                <span className="font-medium">Alle Produkte</span>
                              </div>
                              <ChevronRight className="w-4 h-4 opacity-50" />
                            </button>
                          </li>

                          {/* Dynamic Categories List */}
                          {displayCategories.map(c => {
                            const children = categories.filter(child => child.parentId === c.id && !isPlaner(child.name));
                            const isActive = activeCategory?.id === c.id;
                            const hasActiveChild = activeCategory && children.some(child => child.id === activeCategory.id);

                            return (
                              <li key={c.id} className="space-y-1">
                                <button 
                                  onClick={() => { setActiveCategory(c); setIsCategoryMenuOpen(false); }}
                                  className={`w-full text-left px-4 py-3 text-base rounded-lg transition-all flex items-center justify-between ${isActive || hasActiveChild ? 'bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-500 shadow-xs' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Leaf className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span className="truncate font-medium">{c.name}</span>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 opacity-50 transition-all duration-200 ${isActive || hasActiveChild ? 'rotate-90 text-emerald-600 font-bold' : ''}`} />
                                </button>

                                {/* Detailed Indented Subcategories Support within Sidebar */}
                                {children.length > 0 && (isActive || hasActiveChild) && (
                                  <ul className="pl-8 pr-2 py-1 space-y-1 bg-emerald-50/25 rounded-md mt-1 border-l-2 border-emerald-200/50">
                                    {children.map(sub => (
                                      <li key={sub.id}>
                                        <button
                                          onClick={() => { setActiveCategory(sub); setIsCategoryMenuOpen(false); }}
                                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center gap-1.5 ${activeCategory?.id === sub.id ? 'text-emerald-700 font-bold bg-emerald-100/60' : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/40'}`}
                                        >
                                          <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                          <span className="truncate">{sub.name}</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Sidebar Footer Info */}
                      <div className="p-6 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-3 shrink-0">
                        <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-100">
                          <Droplets className="w-4 h-4 text-emerald-600" />
                          <span>Kostenlose Lieferung ab 49€</span>
                        </div>
                        <div className="text-center text-[11px] text-gray-400 font-medium">
                          © {new Date().getFullYear()} Gartenparadies GmbH
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Logo Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:translate-x-0 md:translate-y-0 md:transform-none flex items-center gap-1 md:gap-3 shrink-0 cursor-pointer overflow-hidden z-10 w-auto" onClick={() => setActiveCategory(null)}>
              <div className="flex -space-x-1 relative shrink-0">
                <Droplets className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-[#1388C9]" />
                <Leaf className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-[#56A02B] absolute left-2.5 top-0" />
              </div>
              <div className="flex flex-col justify-center items-center ml-1 sm:ml-2 md:ml-3">
                <span className="text-xl sm:text-2xl md:text-[2.75rem] font-semibold tracking-tight text-[#152B4B] leading-none">
                  <span className="text-[#56A02B]">Garten</span>paradies
                </span>
                <div className="flex items-center justify-between mt-1 md:mt-2 w-full gap-0.5 sm:gap-1 md:gap-2 hidden sm:flex">
                  <div className="h-[1px] md:h-[2px] flex-1 bg-[#56A02B]"></div>
                  <span className="text-[5px] sm:text-[6px] md:text-[9px] font-bold text-[#152B4B] tracking-[0.2em] uppercase shrink-0">Bewässerung für ein grünes Paradies</span>
                  <div className="h-[1px] md:h-[2px] flex-1 bg-[#56A02B]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div ref={desktopSearchRef} className="flex-1 hidden md:block max-w-3xl px-4 xl:px-8 relative z-50 transition-all duration-300 mx-auto">
            <div className="relative flex items-center w-full shadow-sm border border-gray-200 bg-white rounded-full overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              <Search className="w-5 h-5 md:w-6 md:h-6 text-gray-400 absolute left-4" />
              <input 
                type="text" 
                placeholder="Suche nach Artikelname oder Art.-Nr..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full box-border bg-transparent py-3 md:py-4 pl-12 md:pl-14 pr-12 text-sm md:text-base outline-none text-gray-800 placeholder:text-gray-400 m-0"
                style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }}
                  className="absolute right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Desktop Search Popup Window */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white shadow-xl border border-gray-200 overflow-hidden text-sm rounded-xl">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                    <Search className="w-10 h-10 mx-auto text-gray-200 mb-4" />
                    <p className="font-medium text-gray-600 text-base">Keine Artikel gefunden</p>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto w-full">
                    <div className="px-5 py-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 sticky top-0 z-10 w-full">
                      Suchergebnisse ({filteredProducts.length})
                    </div>
                    <ul className="py-2 w-full">
                       {filteredProducts.map(p => (
                        <li key={p.id}>
                          <a href={`#produkte`} className="flex items-center gap-4 px-5 py-3 hover:bg-emerald-50/50 transition-colors" onClick={() => setIsSearchFocused(false)}>
                            <div className="w-14 h-14 bg-gray-100 overflow-hidden shrink-0 border border-gray-200 rounded-md">
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 truncate text-base">{p.name}</h4>
                              <p className="text-sm text-gray-400 mt-1">Art.-Nr: <span className="font-mono text-gray-500">{p.articleNumber}</span></p>
                            </div>
                            <div className="font-bold text-emerald-700 whitespace-nowrap pl-4 text-lg">
                              {p.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions (Right) */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0 relative z-50">
            <button 
              className="relative flex items-center justify-center p-1 text-[#4A8EC3] hover:text-emerald-600 transition-colors"
              onClick={onOpenCart}
            >
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.5]" />
              {cartItemCount > 0 && (
                <span className="absolute -bottom-1 -right-1 sm:-right-2 bg-[#5B6D21] text-white text-[10px] sm:text-[11px] font-bold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full border border-white shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
            <div ref={userDropdownRef} className="relative shrink-0">
              <button 
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#B4B4B4] text-white hover:bg-gray-400 transition-colors"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </button>
              
              {/* User Dropdown */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                      {currentUser ? 'Mein Profil' : isAdmin ? 'Administrator' : isRegistering ? 'Registrieren' : 'Anmelden'}
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4">
                    {currentUser ? (
                      <div className="space-y-3">
                        <div className="pb-2 border-b border-gray-100">
                          <p className="text-sm font-bold text-gray-850 text-gray-800 font-sans">Hallo, {currentUser.displayName || currentUser.username || currentUser.name || 'Gartenfreund'}!</p>
                          <p className="text-xs text-gray-500 font-sans">{currentUser.email}</p>
                        </div>
                        <button 
                          onClick={() => {
                            navigate('/account/plans');
                          }}
                          className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer font-semibold"
                        >
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>Meine Pläne</span>
                        </button>
                        <button 
                          onClick={() => {
                            navigate('/account/orders');
                          }}
                          className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer font-semibold"
                        >
                          <Package className="w-4 h-4 text-emerald-600" />
                          <span>Meine Bestellungen</span>
                        </button>
                        <button 
                          onClick={() => {
                            navigate('/account');
                          }}
                          className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer font-semibold"
                        >
                          <User className="w-4 h-4 text-emerald-600" />
                          <span>Mein Profil</span>
                        </button>

                        {isAdmin && (
                          <button 
                            onClick={onNavigateToAdmin}
                            className="w-full font-sans text-left flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 hover:text-amber-800 rounded-lg transition-colors cursor-pointer font-semibold mt-2"
                          >
                            <User className="w-4 h-4" />
                            <span>System Administration</span>
                          </button>
                        )}
                        <button 
                          onClick={async () => {
                            await signOut(auth);
                            setIsUserDropdownOpen(false);
                          }}
                          className="w-full bg-red-50 text-red-600 text-sm font-semibold py-2 rounded-lg hover:bg-red-100 transition-colors font-sans cursor-pointer mt-2"
                        >
                          Abmelden
                        </button>
                      </div>
                    ) : isAdmin ? (
                      <div className="space-y-4 text-left p-1 select-none">
                        <p className="text-xs text-slate-500 font-medium">Angemeldet als</p>
                        <p className="text-sm font-bold text-slate-900 border-b pb-2 mb-2 break-all">info@as-mietwagen-service.de</p>
                        
                        <button 
                          onClick={onNavigateToAdmin}
                          className="w-full font-sans text-left flex items-center justify-center gap-2 px-3 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer font-semibold mt-2"
                        >
                          <User className="w-4 h-4" />
                          <span>System Administration</span>
                        </button>

                        <button 
                          onClick={async () => {
                            await signOut(auth);
                            setIsUserDropdownOpen(false);
                            if (setIsAdmin) setIsAdmin(false);
                          }}
                          className="w-full bg-red-50 text-red-600 text-sm font-semibold py-2 rounded-lg hover:bg-red-100 transition-colors font-sans cursor-pointer"
                        >
                          Abmelden
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 text-sm sm:text-base">
                        {loginError && (
                          <div className="bg-red-50 text-red-600 text-xs p-2 rounded border border-red-100">
                            {loginError}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail oder Benutzername *</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                            value={loginUsername}
                            onChange={(e) => setLoginUsername(e.target.value)}
                            placeholder="admin oder name@beispiel.de"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Passwort</label>
                          <input 
                            type="password" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            required
                          />
                        </div>
                        <button 
                          type="submit" 
                          disabled={loginSpinner}
                          className="w-full bg-emerald-600 text-white font-bold py-2 sm:py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {loginSpinner ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Anmelden'}
                        </button>
                        <div className="text-center pt-2 sm:pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Noch kein Konto?</p>
                          <button 
                            type="button" 
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              navigate('/register');
                            }} 
                            className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm cursor-pointer"
                          >
                            Jetzt kostenfrei Registrieren
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Search Bar - moved into header */}
        <div ref={mobileSearchRef} className="md:hidden mt-3 w-full relative z-30">
          <div className="relative flex items-center w-full shadow-sm border border-gray-200 bg-white rounded-full overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
            <Search className="w-5 h-5 text-gray-400 absolute left-4" />
            <input 
              type="text" 
              placeholder="Suche nach Artikelname oder Art.-Nr..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-full box-border bg-transparent py-3 pl-12 pr-12 text-sm outline-none text-gray-800 placeholder:text-gray-400 m-0"
              style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }}
                className="absolute right-3 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Popup Window */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white shadow-xl border border-gray-200 overflow-hidden text-sm rounded-xl">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-gray-500 flex flex-col items-center">
                  <Search className="w-8 h-8 mx-auto text-gray-200 mb-3" />
                  <p className="font-medium text-gray-600">Keine Artikel gefunden</p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto">
                  <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 sticky top-0 z-10">
                    Suchergebnisse ({filteredProducts.length})
                  </div>
                  <ul className="py-1">
                     {filteredProducts.map(p => (
                      <li key={p.id}>
                        <a href={`#produkte`} className="flex items-center gap-4 px-4 py-3 hover:bg-emerald-50/50 transition-colors" onClick={() => setIsSearchFocused(false)}>
                          <div className="w-12 h-12 bg-gray-100 overflow-hidden shrink-0 border border-gray-200 rounded-md">
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 truncate">{p.name}</h4>
                            <p className="text-xs text-gray-400 mt-0.5">Art.-Nr: <span className="font-mono text-gray-500">{p.articleNumber}</span></p>
                          </div>
                          <div className="font-bold text-emerald-700 whitespace-nowrap pl-4">
                            {p.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>

      {/* Hero Section */}
      <section className="relative bg-[#0d2a1b] text-white overflow-hidden py-16 md:py-24 lg:py-32">
        <div className="absolute inset-0 opacity-80">
          <img 
            src="https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=2000" 
            alt="Garden and Agriculture background" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#091f14] via-[#0d2a1b]/40 to-[#091f14]/20"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-medium tracking-wide mb-6 border border-white/30 text-emerald-50"
          >
            Willkommen im neuen Shop
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black mb-6 max-w-4xl leading-tight tracking-tight text-white drop-shadow-lg"
          >
            Gestalte jetzt dein <br className="hidden md:block"/> Gartenparadies
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-emerald-100/90 mb-10 max-w-2xl font-light"
          >
            Entdecken Sie unsere große Auswahl an Produkten für eine perfekte Bewässerung 
            und ein gesundes Pflanzenwachstum.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => window.location.href = '/planer'}
              className="inline-flex items-center justify-center bg-white text-emerald-900 font-bold px-8 py-4 rounded-full text-lg hover:bg-emerald-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Paradies planen
            </button>
          </motion.div>
        </div>
      </section>

      {/* Bestsellers or Empty State */}
      <main id="produkte" className="max-w-7xl mx-auto px-4 py-20 flex-1 w-full flex flex-col">
        <div className="flex flex-col mb-12 gap-6">
          <div className="text-center">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Unsere Produkte</h2>
            <p className="text-gray-500 mt-2 text-lg">Entdecken Sie unser gesamtes Sortiment</p>
          </div>

          {/* Mobile Search Bar logic moved to Header above */}

          {/* Category Filters */}
          {products.length > 0 && (
            <div className="flex flex-col gap-4 items-center">
              {/* Top Level or Siblings */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <button 
                  onClick={() => setActiveCategory(null)}
                  className={`px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all uppercase tracking-wider ${activeCategory === null ? 'bg-emerald-900 text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 hover:bg-emerald-50 border border-gray-200 hover:text-emerald-800 hover:border-emerald-200 shadow-sm'}`}
                >
                  Alle
                </button>
                {/* Find siblings if we have an active category */}
                {(activeCategory ? categories.filter(c => c.parentId === activeCategory.parentId && !isPlaner(c.name)) : displayCategories).map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all uppercase tracking-wider ${activeCategory?.id === cat.id ? 'bg-emerald-900 text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 hover:bg-emerald-50 border border-gray-200 hover:text-emerald-800 hover:border-emerald-200 shadow-sm'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Subcategories if any */}
              {currentSubcategories.length > 0 && activeCategory && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <span className="text-sm font-semibold text-gray-400 mr-2 uppercase tracking-wide flex items-center gap-1"><CornerDownRight className="w-4 h-4" /> Unterkategorien:</span>
                  {currentSubcategories.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setActiveCategory(cat)}
                      className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs font-bold transition-all uppercase tracking-wider bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-300 shadow-sm"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 flex flex-col items-center justify-center text-center min-h-[40vh]">
            <PackageOpen className="w-20 h-20 text-gray-300 mb-6" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              {products.length === 0 ? 'Shop im Aufbau' : 'Keine Artikel gefunden'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              {products.length === 0 
                ? 'Aktuell sind noch keine Artikel im System hinterlegt. Bitte wechseln Sie in den Admin-Bereich, um das Sortiment zu füllen.'
                : 'Ihre Suche oder der gewählte Filter lieferte leider keine Treffer.'}
            </p>
            {products.length === 0 && (
              <button 
                onClick={onNavigateToAdmin}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                Zum Admin Panel
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((product, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={product.id} 
                onClick={() => setSelectedProduct(product)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col group cursor-pointer"
              >
                <div className="relative h-72 overflow-hidden bg-gray-100">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-emerald-900 rounded shadow-sm">
                    {product.category}
                  </div>
                  {product.stock <= 5 && product.stock > 0 && (
                    <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded shadow-sm">
                      Nur noch {product.stock}
                    </div>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-gray-900 text-white px-4 py-2 font-bold uppercase tracking-widest text-sm rounded">Ausverkauft</span>
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-bold text-lg text-gray-900 leading-tight mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">{product.name}</h3>
                  <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed">{product.description}</p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-gray-900">
                        {getStartingPrice(product).isStarting && <span className="text-sm text-gray-500 font-medium mr-1 tracking-normal">ab</span>}
                        {getStartingPrice(product).price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">inkl. MwSt. zzgl. Versand</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product);
                      }}
                      disabled={product.stock === 0}
                      className="w-12 h-12 flex items-center justify-center bg-gray-50 text-emerald-600 border border-emerald-100 rounded-full hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm group-hover:bg-emerald-50"
                      aria-label="In den Warenkorb"
                    >
                      <ShoppingCart className="w-5 h-5 ml-[-2px] transition-transform group-hover:scale-110" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] text-gray-400 py-16 mt-auto border-t-4 border-emerald-600">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-2xl font-black tracking-tight text-white mb-6">
              <Droplets className="w-6 h-6 text-blue-500" />
              <Leaf className="w-6 h-6 text-emerald-500" />
              Gartenparadies
            </div>
            <p className="text-sm leading-relaxed max-w-sm mb-8 text-gray-400">
              Ihr Fachhandel für moderne Aquaristik, Aquascaping und gesundes Pflanzenwachstum. 
              Wir bieten Premium-Qualität für Ihr natürliches Zuhause.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"><span className="font-bold text-sm">IG</span></div>
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"><span className="font-bold text-sm">FB</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Rechtliches</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="/legal/agb" className="hover:text-emerald-400 transition-colors">AGB</Link></li>
              <li><Link to="/legal/versand" className="hover:text-emerald-400 transition-colors">Versand & Zahlung</Link></li>
              <li><Link to="/legal/widerruf" className="hover:text-emerald-400 transition-colors">Widerrufsrecht</Link></li>
              <li><Link to="/legal/datenschutz" className="hover:text-emerald-400 transition-colors">Datenschutz</Link></li>
              <li><Link to="/legal/impressum" className="hover:text-emerald-400 transition-colors">Impressum</Link></li>
            </ul>
          </div>
          <div>
             <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Newsletter</h4>
             <p className="text-sm mb-4 leading-relaxed">Abonnieren Sie unseren Newsletter für 10% Rabatt auf Ihre nächste Bestellung.</p>
             <div className="flex flex-col gap-3">
               <input type="email" placeholder="Ihre E-Mail Adresse" className="bg-gray-800/50 text-white px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-700 transition-all" />
               <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg shadow-emerald-600/20">
                 Abonnieren
               </button>
             </div>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-hidden auto-cols-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-full overflow-hidden flex flex-col relative"
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute right-4 top-4 z-10 w-10 h-10 bg-white shadow-sm border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
              {/* Image Section */}
              <div className="w-full md:w-1/2 min-h-[300px] md:h-full bg-gray-100 relative shrink-0 p-8 flex items-center justify-center">
                <img 
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.name}
                  className="w-full h-full max-w-md object-contain filter drop-shadow-xl"
                />
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">
                    {selectedProduct.category}
                  </span>
                  {selectedProduct.stock <= 5 && selectedProduct.stock > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">
                      Nur noch {selectedProduct.stock} auf Lager
                    </span>
                  )}
                </div>
              </div>

              {/* Data Section */}
              <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col md:overflow-y-auto bg-gray-50/50">
                <div className="flex items-center text-xs font-medium text-gray-500 tracking-wider uppercase mb-4 gap-2">
                  <span>Home</span> <ChevronRight className="w-3 h-3" />
                  <span>{selectedProduct.category}</span>
                </div>
                
                <h2 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight mb-2">
                  {selectedProduct.name}
                </h2>
                
                <p className="text-sm font-mono text-gray-400 mb-6 flex items-center gap-4">
                  <span>Art.-Nr: {selectedProduct.articleNumber}</span>
                  {selectedProduct.manufacturer && (
                    <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-300"></span>{selectedProduct.manufacturer}</span>
                  )}
                </p>

                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl font-black text-emerald-700">
                    {calculateDynamicPrice().toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">inkl. MwSt., zzgl. Versand</span>
                </div>

                {selectedProduct.variations && selectedProduct.variations.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {selectedProduct.variations.map(v => (
                      <div key={v.id}>
                        <label className="block text-sm font-bold text-gray-800 mb-2">{v.name}</label>
                        <div className="flex flex-wrap gap-2">
                          {v.options.map(opt => {
                            const isSelected = selectedVariations[v.id] === opt.name;
                            return (
                              <button
                                key={opt.name}
                                onClick={() => setSelectedVariations(prev => ({ ...prev, [v.id]: opt.name }))}
                                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                                  isSelected 
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-[0_0_0_1px_#059669]' 
                                    : 'border-gray-300 text-gray-700 hover:border-emerald-400'
                                }`}
                              >
                                {opt.name}
                                {opt.priceDiff !== 0 && (
                                  <span className="text-xs ml-1 opacity-70">
                                    ({opt.priceDiff > 0 ? '+' : ''}{opt.priceDiff.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedProduct.volumePricing && selectedProduct.volumePricing.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-bold text-gray-900 mb-2 text-sm">Staffelpreise</h4>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden text-sm">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Menge</th>
                            <th className="px-4 py-2 font-semibold">{selectedProduct.variations && selectedProduct.variations.length > 0 ? 'Rabatt' : 'Preis / Stück'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2">ab 1</td>
                            <td className="px-4 py-2 font-medium">{selectedProduct.variations && selectedProduct.variations.length > 0 ? '0%' : selectedProduct.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                          </tr>
                          {[...selectedProduct.volumePricing]
                            .sort((a, b) => a.quantity - b.quantity)
                            .map((tier, idx) => (
                              <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2">ab {tier.quantity}</td>
                                <td className="px-4 py-2 font-medium text-emerald-700">
                                  {selectedProduct.variations && selectedProduct.variations.length > 0 
                                    ? `${tier.discountPercentage || 0}% Rabatt`
                                    : (tier.price || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8 shadow-sm">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">Sofort lieferbar</span>
                        <span className="text-xs text-gray-500">{selectedProduct.deliveryStatus || 'ca. 2 - 4 Tage'}</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">Kostenloser Rückversand</span>
                        <span className="text-xs text-gray-500">14 Tage Widerrufsrecht</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-gray-900 mb-3 text-lg">Beschreibung</h3>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                    {selectedProduct.description}
                  </p>
                </div>

                {selectedProduct.documents && selectedProduct.documents.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-gray-900 mb-3 text-lg">Dokumente</h3>
                    <ul className="space-y-2">
                      {selectedProduct.documents.map(doc => (
                        <li key={doc.id}>
                          <a 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
                          >
                            <FileText className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                            <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-emerald-800">{doc.name}</span>
                            <Download className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-auto pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 h-14 bg-white shrink-0">
                    <button 
                      onClick={() => {
                        const step = isRoundedTo25(selectedProduct) ? 25 : 1;
                        setSelectedQuantity(Math.max(step, selectedQuantity - step));
                      }}
                      className="text-gray-500 hover:text-emerald-600 disabled:opacity-50 p-2"
                      disabled={isRoundedTo25(selectedProduct) ? selectedQuantity <= 25 : selectedQuantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-12 text-center font-bold text-lg text-gray-800">{selectedQuantity}</span>
                    <button 
                      onClick={() => {
                        const step = isRoundedTo25(selectedProduct) ? 25 : 1;
                        setSelectedQuantity(selectedQuantity + step);
                      }}
                      className="text-gray-500 hover:text-emerald-600 p-2"
                      disabled={selectedQuantity >= selectedProduct.stock}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      onAddToCart(selectedProduct, selectedVariations, selectedQuantity);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock === 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold h-14 px-8 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 text-lg"
                  >
                    <ShoppingCart className="w-6 h-6" />
                    {selectedProduct.stock === 0 ? 'Ausverkauft' : 'In den Warenkorb'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Saved Plans Modal */}
      <AnimatePresence>
        {isSavedPlansModalOpen && currentUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-150 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">Meine gespeicherten Pläne</h3>
                </div>
                <button 
                  onClick={() => setIsSavedPlansModalOpen(false)}
                  className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {onlinePlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-4">Du hast noch keine Bewässerungspläne gespeichert.</p>
                    <button 
                      onClick={() => {
                        setIsSavedPlansModalOpen(false);
                        window.location.href = '/planer';
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition duration-150 shadow-md cursor-pointer inline-flex items-center gap-2"
                    >
                      Jetzt planen starten
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  onlinePlans.map((plan: any) => (
                    <div key={plan.id} className="p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 select-none text-left">
                        <h4 className="font-bold text-gray-900 text-base">{plan.name}</h4>
                        <p className="text-xs text-gray-400">Zuletzt bearbeitet: {plan.lastEdited}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-emerald-700">
                          {plan.plannerData?.sprinklers !== undefined && (
                            <span className="bg-emerald-50 px-2 py-0.5 rounded-md">
                              Regner: {plan.plannerData.sprinklers}
                            </span>
                          )}
                          {plan.plannerData?.zones !== undefined && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                              Zonen: {plan.plannerData.zones}
                            </span>
                          )}
                          {plan.plannerData?.gardenArea !== undefined && (
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                              Fläche: {plan.plannerData.gardenArea} m²
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            setIsSavedPlansModalOpen(false);
                            window.location.href = `/planer?load_plan=${plan.id}`;
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition duration-200 cursor-pointer"
                        >
                          Plan laden
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm("Aufgepasst: Möchtest du diesen Plan wirklich löschen?")) {
                              try {
                                await deleteDoc(doc(db, 'plans', plan.id));
                                setOnlinePlans(prev => prev.filter(p => p.id !== plan.id));
                              } catch (err) {
                                console.error('Error deleting plan:', err);
                              }
                            }
                          }}
                          className="p-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition duration-200 cursor-pointer animate-none"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
