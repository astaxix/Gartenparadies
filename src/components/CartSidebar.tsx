import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, ShoppingBag, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  currentUser: any;
  onClearCart: () => Promise<void>;
}

export default function CartSidebar({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemoveItem,
  currentUser,
  onClearCart
}: CartSidebarProps) {
  const navigate = useNavigate();
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b text-emerald-900 border-gray-200">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <ShoppingBag className="w-5 h-5"/>
                Warenkorb ({totalItems})
              </div>
              <button 
                onClick={() => {
                  onClose();
                  setOrderSuccess(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-emerald-50/20 select-none">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-md border border-emerald-200 animate-bounce">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-950 mb-2 font-sans">Vielen Dank für Ihre Bestellung!</h3>
                <p className="text-gray-600 text-sm mb-6 max-w-xs leading-relaxed font-sans">
                  Ihre Bestellung wurde erfolgreich übermittelt und sicher in der Firebase Cloud gespeichert. Sie können Ihre Bestellung im Adminbereich einsehen.
                </p>
                <button 
                  onClick={() => {
                    setOrderSuccess(false);
                    onClose();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl transition duration-150 shadow-md cursor-pointer text-sm font-sans"
                >
                  Einkauf fortsetzen
                </button>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6">
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                      <ShoppingBag className="w-16 h-16 text-gray-300" />
                      <p>Ihr Warenkorb ist leer.</p>
                      <button 
                        onClick={onClose}
                        className="mt-4 px-6 py-2 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors font-medium cursor-pointer"
                      >
                        Weiter einkaufen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {items.map((item, index) => {
                        const isPlanPkg = !!item.isPlannerPackage;
                        return (
                          <div 
                            key={`${item.id}-${index}`} 
                            onClick={() => {
                              if (isPlanPkg) {
                                navigate('/planer?view_package=true');
                                onClose();
                              }
                            }}
                            className={`flex gap-4 items-center p-2 rounded-xl border transition-all ${
                              isPlanPkg 
                                ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-50 hover:border-blue-400 cursor-pointer shadow-xs' 
                                : 'border-transparent'
                            }`}
                          >
                            <div className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center p-1 ${
                              isPlanPkg ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-100 border-gray-200'
                            }`}>
                              {isPlanPkg ? (
                                <Map className="w-10 h-10 animate-pulse" />
                              ) : (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">
                                {item.name}
                              </h4>
                              {isPlanPkg && (
                                <span className="inline-block bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 mb-1 shadow-xs">
                                  Plan-Paket (Tippen für Übersicht)
                                </span>
                              )}
                              {item.selectedVariations && Object.keys(item.selectedVariations).length > 0 && !isPlanPkg && (
                                <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                                   {item.variations?.map(v => item.selectedVariations![v.id] && (
                                     <div key={v.id}>{v.name}: {item.selectedVariations![v.id]}</div>
                                   ))}
                                </div>
                              )}
                              <div className={`font-bold mt-1 ${isPlanPkg ? 'text-blue-700' : 'text-emerald-600'}`}>
                                {item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </div>
                              
                              <div className="flex items-center justify-between mt-2" onClick={e => isPlanPkg && e.stopPropagation()}>
                                {isPlanPkg ? (
                                  <div className="text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded-sm">
                                    Menge: {item.quantity}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 border border-gray-300 rounded-md px-2 py-1 text-sm bg-white">
                                    <button 
                                      onClick={() => onUpdateQuantity(index, -1)}
                                      className="text-gray-500 hover:text-emerald-600 disabled:opacity-50 cursor-pointer"
                                      disabled={(() => {
                                        const ln = item.name.toLowerCase();
                                        const is25 = ln.includes('pe rohr') || ln.includes('pe-rohr') || ln.includes('tropfrohr') || ln.includes('tropfschlauch');
                                        return item.quantity <= (is25 ? 25 : 1);
                                      })()}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-4 text-center font-medium text-gray-700">{item.quantity}</span>
                                    <button 
                                      onClick={() => onUpdateQuantity(index, 1)}
                                      className="text-gray-500 hover:text-emerald-600 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveItem(index);
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                  title="Entfernen"
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

                {/* Footer / Checkout */}
                {items.length > 0 && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50 shrink-0">
                    <div className="flex justify-between items-center mb-4 text-gray-800 font-medium pb-4 border-b border-gray-200">
                      <span>Zwischensumme</span>
                      <span className="text-xl font-bold">
                        {total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                    {!currentUser && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-850 text-xs px-3 py-2 rounded-lg mb-4 text-center font-sans tracking-wide">
                        Bitte melde dich oben rechts an, um deine Bestellung abzusenden.
                      </div>
                    )}
                    <button 
                      onClick={async () => {
                        if (!currentUser) {
                          alert("Bitte loggen Sie sich ein (oben rechts im Benutzer-Symbol), um Ihre Bestellung abzusenden.");
                          return;
                        }
                        try {
                          setIsSubmittingOrder(true);
                          const orderId = 'order-' + Date.now();
                          const newOrder = {
                            id: orderId,
                            userId: currentUser.id,
                            userEmail: currentUser.email || 'customer@as-garden.de',
                            userName: currentUser.displayName || currentUser.username || 'Kunde',
                            date: new Date().toISOString(),
                            items: items,
                            total: total,
                            status: 'Ausstehend'
                          };
                          await setDoc(doc(db, 'orders', orderId), newOrder);
                          await onClearCart();
                          setOrderSuccess(true);
                        } catch (err: any) {
                          console.error('Failed placing order:', err);
                          alert('Konnte Bestellung nicht absenden: ' + err.message);
                        } finally {
                          setIsSubmittingOrder(false);
                        }
                      }}
                      disabled={isSubmittingOrder || !currentUser}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30 font-sans flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingOrder ? "Wird verarbeitet..." : "Zahlungspflichtig bestellen"}
                    </button>
                    <button 
                      onClick={() => {
                        onClose();
                        navigate('/');
                      }}
                      className="w-full mt-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl transition-all font-sans text-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Weiter stöbern
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
