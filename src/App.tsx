import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ShopFront from './components/ShopFront';
import AdminPanel from './components/AdminPanel';
import CartSidebar from './components/CartSidebar';
import Planner from './components/Planner';
import BetaGate from './components/BetaGate';
import { initialOrders, initialProducts, plannerProducts } from './data';
import { CartItem, Product, Order } from './types';

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Can be replaced by real auth
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize from localStorage or use defaults
  const [products, setProducts] = useState<Product[]>(() => {
    const savedProducts = localStorage.getItem('gartenparadies_products');
    let loadedProducts = initialProducts;
    if (savedProducts) {
      try {
        loadedProducts = JSON.parse(savedProducts);
      } catch (e) {
        console.error('Failed to parse products from local storage', e);
      }
    }
    
    // Ensure all planner products exist and are fully updated
    let needsUpdate = false;
    const finalProducts = [...loadedProducts];
    plannerProducts.forEach(pp => {
       const existingIndex = finalProducts.findIndex(p => p.id === pp.id);
       if (existingIndex === -1) {
          finalProducts.push(pp);
          needsUpdate = true;
       } else {
          // If plannerType is missing or outdated, update it in-place
          const existing = finalProducts[existingIndex];
          if (!existing.plannerType || existing.plannerType !== pp.plannerType || existing.plannerStations !== pp.plannerStations) {
             finalProducts[existingIndex] = { ...existing, ...pp };
             needsUpdate = true;
          }
       }
    });
    
    if (needsUpdate) {
       localStorage.setItem('gartenparadies_products', JSON.stringify(finalProducts));
    }
    return finalProducts;
  });
  
  const [categories, setCategories] = useState<string[]>(() => {
    const savedCategories = localStorage.getItem('gartenparadies_categories');
    let loadedCategories = ['Pflanzen', 'Bodengrund', 'Technik', 'Pflege', 'Futter'];
    if (savedCategories) {
      try {
        loadedCategories = JSON.parse(savedCategories);
      } catch (e) {
        console.error('Failed to parse categories from local storage', e);
      }
    }
    if (!loadedCategories.includes('Planer Artikel')) {
       loadedCategories.push('Planer Artikel');
       localStorage.setItem('gartenparadies_categories', JSON.stringify(loadedCategories));
    }
    return loadedCategories;
  });
  
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Save to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('gartenparadies_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('gartenparadies_categories', JSON.stringify(categories));
  }, [categories]);

  // Derived state
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const getUnitPrice = (product: Product, variations: Record<string, string> | undefined, quantity: number) => {
    let finalPrice = product.price;

    // Apply variation differences
    if (variations && product.variations) {
      product.variations.forEach(v => {
        const optName = variations[v.id];
        if (optName) {
           const opt = v.options.find(o => o.name === optName);
           if (opt) finalPrice += opt.priceDiff;
        }
      });
    }

    // Apply volume pricing if applicable
    if (product.volumePricing && product.volumePricing.length > 0) {
      // Sort by quantity descending to find the best applicable tier
      const sortedTiers = [...product.volumePricing].sort((a, b) => b.quantity - a.quantity);
      for (const tier of sortedTiers) {
        if (quantity >= tier.quantity) {
          if (product.variations && product.variations.length > 0 && tier.discountPercentage !== undefined) {
            finalPrice = finalPrice * (1 - (tier.discountPercentage / 100));
          } else if (tier.price !== undefined) {
            finalPrice = tier.price;
          }
          break; // Stop at the highest applicable quantity tier
        }
      }
    }

    return finalPrice;
  };

  // Actions
  const handleAddToCart = (product: Product, selectedVariations?: Record<string, string>, addedQuantity: number = 1) => {
    setCartItems(prev => {
      const existingKey = product.id + JSON.stringify(selectedVariations || {});
      const existing = prev.find(item => item.id + JSON.stringify(item.selectedVariations || {}) === existingKey);
      
      if (existing) {
        return prev.map(item => {
          if (item === existing) {
            const sumQuantity = item.quantity + addedQuantity;
            return { ...item, quantity: sumQuantity, price: getUnitPrice(product, selectedVariations, sumQuantity) };
          }
          return item;
        });
      }
      return [...prev, { ...product, price: getUnitPrice(product, selectedVariations, addedQuantity), quantity: addedQuantity, selectedVariations }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (itemIndex: number, delta: number) => {
    setCartItems(prev => prev.map((item, index) => {
      if (index === itemIndex) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity, price: getUnitPrice(item as Product, item.selectedVariations, newQuantity) };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (itemIndex: number) => {
    setCartItems(prev => prev.filter((_, index) => index !== itemIndex));
  };

  return (
    <>
      <Routes>
        <Route path="/admin/*" element={
          isAdmin ? (
            <AdminPanel 
              products={products}
              categories={categories}
              orders={orders}
              onExitAdmin={() => navigate('/')}
              onUpdateProducts={setProducts}
              onUpdateCategories={setCategories}
            />
          ) : (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
              <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Admin Login</h2>
              </div>
              <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                  <div className="space-y-6">
                    <div>
                        <button 
                          onClick={() => setIsAdmin(true)} 
                          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
                        >
                          Als Admin anmelden
                        </button>
                    </div>
                    <div className="text-center">
                      <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-900">Zurück zum Shop</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        } />
        
        <Route path="/planer" element={<Planner products={products} />} />

        <Route path="/" element={
          <ShopFront 
            products={products}
            categories={categories}
            onAddToCart={handleAddToCart}
            cartItemCount={cartItemCount}
            onOpenCart={() => setIsCartOpen(true)}
            onNavigateToAdmin={() => navigate('/admin')}
            isAdmin={isAdmin}
            setIsAdmin={setIsAdmin}
          />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Cart Overlay */}
      <CartSidebar 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
      />
    </>
  );
}

export default function App() {
  const [isBetaUnlocked, setIsBetaUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('beta_unlocked') === 'true';
  });

  if (!isBetaUnlocked) {
    return (
      <BetaGate 
        onUnlock={() => {
          localStorage.setItem('beta_unlocked', 'true');
          setIsBetaUnlocked(true);
        }} 
      />
    );
  }

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

