import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { CartItem } from '../types';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
}

export default function CartSidebar({ isOpen, onClose, items, onUpdateQuantity, onRemoveItem }: CartSidebarProps) {
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
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                  <ShoppingBag className="w-16 h-16 text-gray-300" />
                  <p>Ihr Warenkorb ist leer.</p>
                  <button 
                    onClick={onClose}
                    className="mt-4 px-6 py-2 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors font-medium"
                  >
                    Weiter einkaufen
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex gap-4 items-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center p-1">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">{item.name}</h4>
                        {item.selectedVariations && Object.keys(item.selectedVariations).length > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                             {item.variations?.map(v => item.selectedVariations![v.id] && (
                               <div key={v.id}>{v.name}: {item.selectedVariations![v.id]}</div>
                             ))}
                          </div>
                        )}
                        <div className="text-emerald-600 font-bold mt-1">
                          {item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 border border-gray-300 rounded-md px-2 py-1 text-sm">
                            <button 
                              onClick={() => onUpdateQuantity(index, -1)}
                              className="text-gray-500 hover:text-emerald-600 disabled:opacity-50"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-4 text-center font-medium text-gray-700">{item.quantity}</span>
                            <button 
                              onClick={() => onUpdateQuantity(index, 1)}
                              className="text-gray-500 hover:text-emerald-600"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={() => onRemoveItem(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Entfernen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                <p className="text-xs text-gray-500 mb-4 text-center">
                  Versandkosten und Steuern werden an der Kasse berechnet.
                </p>
                <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30">
                  Zur Kasse
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
