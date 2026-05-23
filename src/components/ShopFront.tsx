import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Search, Menu, Leaf, Droplets, ArrowRight, PackageOpen, User, X, ChevronRight, Check, Plus, Minus, Download, FileText } from 'lucide-react';
import { Product } from '../types';

interface ShopFrontProps {
  products: Product[];
  categories: string[];
  onAddToCart: (product: Product, variations?: Record<string, string>, quantity?: number) => void;
  cartItemCount: number;
  onOpenCart: () => void;
  onNavigateToAdmin: () => void;
  isAdmin: boolean;
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ShopFront({ products, categories, onAddToCart, cartItemCount, onOpenCart, onNavigateToAdmin, isAdmin, setIsAdmin }: ShopFrontProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    if (selectedProduct && selectedProduct.variations) {
      const initial: Record<string, string> = {};
      selectedProduct.variations.forEach(v => {
        if (v.options.length > 0) {
          initial[v.id] = v.options[0].name;
        }
      });
      setSelectedVariations(initial);
      setSelectedQuantity(1);
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === 'admin' && loginPassword === 'admin') {
      setIsAdmin(true);
      setIsUserDropdownOpen(false);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Benutzername oder Passwort falsch.');
    }
  };

  const filteredProducts = products.filter(p => {
    if (p.category === 'Planer Artikel') return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.articleNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory ? p.category === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  const displayCategories = categories.filter(c => c !== 'Planer Artikel');


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
          
          {/* Logo and Menu Box */}
          <div className="flex items-center gap-2 md:gap-6 shrink-0 z-20">
            <div ref={categoryMenuRef} className="relative shrink-0">
              <button 
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className="p-1 md:p-3 hover:bg-gray-100 rounded-md transition-colors text-gray-700"
              >
                <Menu className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              
              {isCategoryMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 md:w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 text-sm md:text-base">Kategorien</h3>
                  </div>
                  <ul className="py-2">
                    <li>
                      <button 
                        onClick={() => { setActiveCategory(null); setIsCategoryMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm md:text-base hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${activeCategory === null ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                      >
                        Alle Produkte
                      </button>
                    </li>
                    {displayCategories.map(c => (
                      <li key={c}>
                        <button 
                          onClick={() => { setActiveCategory(c); setIsCategoryMenuOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm md:text-base hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${activeCategory === c ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                        >
                          {c}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Logo Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:transform-none flex items-center gap-1 md:gap-3 shrink-0 cursor-pointer overflow-hidden z-10 w-auto" onClick={() => setActiveCategory(null)}>
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
                className="w-full bg-transparent py-3 md:py-4 pl-12 md:pl-14 pr-12 text-sm md:text-base outline-none text-gray-800 placeholder:text-gray-400"
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
          <div className="flex items-center gap-3 sm:gap-6 shrink-0 relative z-20">
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
                      {isAdmin ? 'Mein Konto' : 'Anmelden'}
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4">
                    {isAdmin ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">Angemeldet als Administrator</p>
                        <button 
                          onClick={() => {
                            setIsAdmin(false);
                            setIsUserDropdownOpen(false);
                          }}
                          className="w-full bg-red-50 text-red-600 text-sm sm:text-base font-medium py-2 rounded-lg hover:bg-red-100 transition-colors"
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
                          <label className="block text-xs font-medium text-gray-700 mb-1">Benutzername</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                            value={loginUsername}
                            onChange={(e) => setLoginUsername(e.target.value)}
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
                          className="w-full bg-emerald-600 text-white font-medium py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Einloggen
                        </button>
                        <div className="text-center pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500">Noch kein Konto?</p>
                          <button type="button" className="text-xs sm:text-sm font-medium text-emerald-600 hover:underline mt-1">Jetzt registrieren</button>
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
              className="w-full bg-transparent py-3 pl-12 pr-12 text-sm outline-none text-gray-800 placeholder:text-gray-400"
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
      <section className="relative bg-emerald-900 text-white overflow-hidden py-32 lg:py-48">
        <div className="absolute inset-0 opacity-40 mix-blend-overlay">
          <img 
            src="https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=2000" 
            alt="Aquarium background" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-900/60 to-transparent"></div>
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
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4">
              <button 
                onClick={() => setActiveCategory(null)}
                className={`px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all uppercase tracking-wider ${activeCategory === null ? 'bg-emerald-900 text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 hover:bg-emerald-50 border border-gray-200 hover:text-emerald-800 hover:border-emerald-200 shadow-sm'}`}
              >
                Alle
              </button>
              {displayCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all uppercase tracking-wider ${activeCategory === cat ? 'bg-emerald-900 text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 hover:bg-emerald-50 border border-gray-200 hover:text-emerald-800 hover:border-emerald-200 shadow-sm'}`}
                >
                  {cat}
                </button>
              ))}
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
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Über uns</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Versand & Zahlung</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Widerrufsrecht</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Datenschutz</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Impressum</a></li>
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
                      onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                      className="text-gray-500 hover:text-emerald-600 disabled:opacity-50 p-2"
                      disabled={selectedQuantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-12 text-center font-bold text-lg text-gray-800">{selectedQuantity}</span>
                    <button 
                      onClick={() => setSelectedQuantity(selectedQuantity + 1)}
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
    </div>
  );
}
