import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ShopFront from './components/ShopFront';
import AdminPanel from './components/AdminPanel';
import CartSidebar from './components/CartSidebar';
import Planner from './components/Planner';
import RegisterPage from './components/RegisterPage';
import UserDashboard from './components/UserDashboard';
import LegalPage from './components/LegalPage';
import { initialOrders, initialProducts, plannerProducts } from './data';
import { CartItem, Product, Order, CategoryNode } from './types';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, withTimeout } from './lib/firebase';

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(JSON.parse(localStorage.getItem('currentUser') || 'null'));
  const [products, setProducts] = useState<Product[]>(plannerProducts);

  useEffect(() => {
    localStorage.setItem('isAdmin', String(isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Monitor Auth Changes and sync User profile state online
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        let userData: any = null;
        try {
          const userDoc = await withTimeout(getDoc(userDocRef), 6000, "Verbindung zum Nutzerprofil fehlgeschlagen.");
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            userData = {
              id: user.uid,
              username: user.displayName || user.email?.split('@')[0] || 'Gartenfreund',
              displayName: user.displayName || '',
              email: user.email || ''
            };
            await withTimeout(setDoc(userDocRef, userData), 6000, "Erstellen des Nutzerprofils fehlgeschlagen.");
          }
        } catch (err) {
          console.warn('User settings initialization skipped locally:', err);
          userData = {
            id: user.uid,
            username: user.displayName || user.email?.split('@')[0] || 'Gartenfreund',
            displayName: user.displayName || '',
            email: user.email || ''
          };
        }
        setCurrentUser(userData);
        setIsAdmin(user.email === 'info@as-mietwagen-service.de');
      } else {
        // Only clear if we are not the local dummy admin
        setCurrentUser((prev: any) => {
          if (prev?.id === 'admin') return prev;
          return null;
        });
        setIsAdmin((prev) => {
          if (prev && localStorage.getItem('isAdmin') === 'true') return true;
          return false;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  // Load products catalog from Firestore online
  useEffect(() => {
    async function loadProducts() {
      try {
        const settingsRef = doc(db, 'settings', 'shop');
        const settingsSnap = await withTimeout(getDoc(settingsRef), 6000, "Verbindung zu den Laden-Einstellungen fehlgeschlagen.");
        if (settingsSnap.exists() && settingsSnap.data().categories) {
          const loaded = settingsSnap.data().categories;
          const parsed = loaded.map((c: any) => typeof c === 'string' ? { id: c, name: c, parentId: null } : c);
          setCategories(parsed);
        }

        const querySnapshot = await withTimeout(getDocs(collection(db, 'products')), 6000, "Verbindung zum Artikel-Katalog fehlgeschlagen.");
        if (!querySnapshot.empty) {
          const loadedProducts = querySnapshot.docs.map(doc => doc.data() as Product);
          // If items are present, use them
          setProducts(loadedProducts);
        } else {
          // Default seed fallback
          setProducts(plannerProducts);
        }
      } catch (err) {
        console.warn('Failed loading products from Firestore, utilizing catalog fallback:', err);
        setProducts(plannerProducts);
      }
    }
    loadProducts();
  }, []);

  // Update Products & push to Firestore
  const handleUpdateProducts = async (newProducts: Product[]) => {
    const originalProducts = products;
    setProducts(newProducts);
    try {
      const existingDocs = await withTimeout(getDocs(collection(db, 'products')), 6000, "Fehlgeschlagen beim Abrufen der aktuellen Artikel.");
      const batch = writeBatch(db);

      // Collect deletions
      for (const docSnap of existingDocs.docs) {
        if (!newProducts.find(p => p.id === docSnap.id)) {
          batch.delete(doc(db, 'products', docSnap.id));
        }
      }

      // Collect setter ops
      for (const prod of newProducts) {
        batch.set(doc(db, 'products', prod.id), prod);
      }

      await withTimeout(batch.commit(), 12000, "Batch-Commit der Produkte fehlgeschlagen (Timeout).");
      console.log('Successfully synced products via Firestore writeBatch.');
    } catch (error) {
      console.error('Failed syncing products to store:', error);
      setProducts(originalProducts);
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const [categories, setCategories] = useState<CategoryNode[]>([
    { id: 'cat-1', name: 'Pflanzen', parentId: null },
    { id: 'cat-2', name: 'Bodengrund', parentId: null },
    { id: 'cat-3', name: 'Technik', parentId: null },
    { id: 'cat-4', name: 'Planer Artikel', parentId: null }
  ]);

  const handleUpdateCategories = async (newCats: CategoryNode[]) => {
    const originalCats = categories;
    setCategories(newCats);
    try {
      const settingsRef = doc(db, 'settings', 'shop');
      await withTimeout(setDoc(settingsRef, { categories: newCats }, { merge: true }), 8000, "Speichern der Kategorien in die Cloud fehlgeschlagen (Timeout).");
    } catch (error) {
      console.error('Failed writing categories to store:', error);
      setCategories(originalCats);
      handleFirestoreError(error, OperationType.WRITE, 'settings/shop');
    }
  };

  // Load user shopping cart from Firestore on login with local storage resilience
  useEffect(() => {
    if (!currentUser) {
      setCartItems([]);
      return;
    }

    // Load from local storage immediately as an instant robust fallback
    const localCartKey = `cart_items_${currentUser.id}`;
    const cachedCart = localStorage.getItem(localCartKey);
    if (cachedCart) {
      try {
        setCartItems(JSON.parse(cachedCart));
      } catch (e) {
        console.warn('Could not parse cached cart, starting fresh:', e);
      }
    }

    async function loadCart() {
      try {
        const cartDoc = await getDoc(doc(db, 'carts', currentUser.id));
        if (cartDoc.exists()) {
          const cartData = cartDoc.data();
          if (cartData.items) {
            setCartItems(cartData.items);
            localStorage.setItem(localCartKey, JSON.stringify(cartData.items));
          }
        }
      } catch (err) {
        console.warn('Unable to sync cart from Firestore (offline Mode). Local shopping cart loaded instead:', err);
      }
    }
    loadCart();
  }, [currentUser]);

  // Save/Sync cart to Firestore online and local storage (using debounced timeout)
  useEffect(() => {
    if (!currentUser) return;

    const localCartKey = `cart_items_${currentUser.id}`;
    localStorage.setItem(localCartKey, JSON.stringify(cartItems));

    // If it's an empty cart, update local storage but still trigger database update
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'carts', currentUser.id), {
          userId: currentUser.id,
          items: cartItems,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Unable to sync cart to Firestore (offline Mode). Changes preserved locally:', err);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [cartItems, currentUser]);

  // Load orders dynamically and in real time (Admin sees all, Standard User sees self)
  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      return;
    }

    const ordersCol = collection(db, 'orders');
    const isUserAdmin = currentUser.email === 'info@as-mietwagen-service.de';
    const ordersQuery = isUserAdmin 
      ? query(ordersCol) 
      : query(ordersCol, where('userId', '==', currentUser.id));

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const loadedOrders = snapshot.docs.map(doc => doc.data() as Order);
      loadedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(loadedOrders);
    }, (error) => {
      console.error('Failed querying and syncing orders:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

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
  const handleAddToCart = (product: Product, selectedVariations?: Record<string, string>, addedQuantity: number = 1, customProps?: Partial<CartItem>) => {
    setCartItems(prev => {
      if (customProps?.isPlannerPackage) {
        // Replace or add the Planner Package
        const filtered = prev.filter(item => !item.isPlannerPackage);
        const newItem: CartItem = {
          ...product,
          price: product.price,
          quantity: addedQuantity,
          selectedVariations,
          ...customProps
        } as CartItem;
        return [...filtered, newItem];
      }
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
        let step = 1;
        const ln = item.name.toLowerCase();
        if (ln.includes('pe rohr') || ln.includes('pe-rohr') || ln.includes('tropfrohr') || ln.includes('tropfschlauch')) {
          step = 25;
        }
        const effectiveDelta = delta > 0 ? step : -step;
        const newQuantity = Math.max(step, item.quantity + effectiveDelta);
        return { ...item, quantity: newQuantity, price: getUnitPrice(item as Product, item.selectedVariations, newQuantity) };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (itemIndex: number) => {
    setCartItems(prev => prev.filter((_, index) => index !== itemIndex));
  };

  const handleClearCart = async () => {
    setCartItems([]);
    if (currentUser) {
      try {
        await setDoc(doc(db, 'carts', currentUser.id), {
          userId: currentUser.id,
          items: [],
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error clearing cart in Firestore:', err);
      }
    }
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
              onUpdateProducts={handleUpdateProducts}
              onUpdateCategories={handleUpdateCategories}
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
        
        <Route path="/planer" element={
          <Planner 
            products={products} 
            onAddToCart={handleAddToCart}
            onOpenCart={() => setIsCartOpen(true)}
            cartItems={cartItems}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
        } />

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
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
        } />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/legal/:pageId" element={<LegalPage />} />
        <Route path="/account/*" element={
          currentUser ? <UserDashboard currentUser={currentUser} /> : <Navigate to="/" replace />
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
        currentUser={currentUser}
        onClearCart={handleClearCart}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

