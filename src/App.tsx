import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Store, 
  ShieldCheck, 
  Truck, 
  MapPin, 
  Phone, 
  Instagram, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Flame, 
  Sparkles, 
  Star, 
  Zap, 
  Code, 
  Layers, 
  Settings, 
  SlidersHorizontal, 
  Shirt, 
  Gem, 
  Smartphone, 
  HeartHandshake, 
  Gift, 
  Grid,
  Lock,
  UserCheck,
  Clock,
  Package,
  Edit3,
  LogOut
} from 'lucide-react';
import { getCurrentSessionUser, signOutUser } from './lib/auth';
import { 
  INITIAL_VENDORS, 
  INITIAL_PRODUCTS
} from './data/mockData';
import type { 
  CartItem, 
  ProductWithVendor, 
  Vendor, 
  Order, 
  OrderItem, 
  ItemStatus, 
  UltraMsgDispatchSummary, 
  CheckoutResponse,
  CheckoutPayload
} from './types/database';
import { executeCheckoutService } from './lib/checkoutService';
import { CheckoutModal } from '../components/checkout/CheckoutModal';
import { ProductDetailsModal } from '../components/product/ProductDetailsModal';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import AdminVendorsPage from '../app/admin/vendors/page.tsx';
import AdminLoginPage from '../app/admin/login/page.tsx';
import VendorSignupPage from '../app/vendor/signup/page.tsx';
import VendorLoginPage from '../app/vendor/login/page.tsx';
import { VendorDashboard } from './components/VendorDashboard';
import { I18nProvider, useI18n } from './lib/i18nContext';
import { 
  getDeliveryFee, 
  getFreeDeliveryEnabled, 
  getFreeDeliveryThreshold, 
  calculateOrderDeliveryFee 
} from './lib/adminSettings';
import { 
  fetchProductsFromDB,
  fetchPublicVendorsFromDB,
  saveProductToDB,
  subscribeToProducts,
  subscribeToPublicVendors,
  updateOrderItemStatusInDB
} from './lib/databaseService';
import { getStorageImageUrl } from './lib/storage';
import { 
  CategoryItem, 
  DEFAULT_CATEGORIES, 
  subscribeToCategories,
  fetchCategoriesFromDB 
} from './lib/categoriesService';
import { CategoriesManagerModal } from './components/CategoriesManagerModal';
import { getProductCustomerPrice } from './lib/pricingService';

type AppView = 
  | 'storefront' 
  | 'vendor-login' 
  | 'vendor-signup' 
  | 'vendor-dashboard' 
  | 'admin-login' 
  | 'admin-dashboard';

function MarketplaceApp() {
  const { t, locale, setLocale, dir } = useI18n();
  const isRtl = dir === 'rtl';
  const [restoredSession] = useState(() => getCurrentSessionUser());

  // Navigation: Storefront is the public customer experience
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (restoredSession?.role === 'super_admin') return 'admin-dashboard';
    if (restoredSession?.role === 'vendor' && restoredSession.vendor) return 'vendor-dashboard';
    return 'storefront';
  });

  // Core Data States (Pure Firestore & clean initial state)
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<ProductWithVendor[]>([]);

  // Clear any legacy mock data from browser localStorage on first mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('kooll_products');
        localStorage.removeItem('kooll_registered_vendors');
        localStorage.removeItem('kooll_orders');
        localStorage.removeItem('kooll_order_items');
        localStorage.removeItem('kooll_cart');
      } catch (e) {
        console.warn('Notice clearing legacy storage:', e);
      }
    }
  }, []);

  const [viewingProduct, setViewingProduct] = useState<ProductWithVendor | null>(null);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);

  const openProductDetails = (product: ProductWithVendor) => {
    setViewingProduct(product);
    setIsProductDetailsOpen(true);
  };

  const handleUpdateProduct = async (updated: ProductWithVendor) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    await saveProductToDB(updated);
  };

  const handleAddProduct = async (newProd: ProductWithVendor) => {
    setProducts(prev => [newProd, ...prev]);
    await saveProductToDB(newProd);
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [dispatches, setDispatches] = useState<UltraMsgDispatchSummary[]>([]);
  const [latestAdminWhatsAppUrl, setLatestAdminWhatsAppUrl] = useState<string>('');

  // Active authenticated sessions
  const [currentVendorSession, setCurrentVendorSession] = useState<Vendor | null>(restoredSession?.vendor || null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(restoredSession?.role === 'super_admin');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBoutique, setSelectedBoutique] = useState<string>('All');
  const [activeVendorIdForPortal, setActiveVendorIdForPortal] = useState<string>(restoredSession?.vendor?.id || '');

  // Dynamic Story Categories managed by Admin & synced to Firestore
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [isCategoriesManagerOpen, setIsCategoriesManagerOpen] = useState(false);

  useEffect(() => {
    fetchCategoriesFromDB().then(res => {
      if (res && res.length > 0) setCategories(res);
    });
    const unsub = subscribeToCategories((cats) => {
      if (cats && cats.length > 0) setCategories(cats);
    });
    return () => unsub();
  }, []);

  // Dynamic Best Seller & Trending Analytics computed from real customer orders
  const productSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of orderItems) {
      if (item.product_id) {
        map[item.product_id] = (map[item.product_id] || 0) + (Number(item.quantity) || 1);
      }
    }
    return map;
  }, [orderItems]);

  const maxProductSales = useMemo(() => {
    const vals: number[] = Object.values(productSalesMap);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }, [productSalesMap]);

  // Firebase Firestore Database Hydration & Real-time Listeners Hook
  useEffect(() => {
    let isMounted = true;

    async function loadFirestoreData() {
      try {
        const [dbProducts, dbVendors] = await Promise.all([
          fetchProductsFromDB(),
          fetchPublicVendorsFromDB(),
        ]);

        if (isMounted) {
          if (dbProducts && dbProducts.length > 0) setProducts(dbProducts);
          if (dbVendors && dbVendors.length > 0) setVendors(dbVendors);
        }
      } catch (err) {
        console.warn('Firestore initial fetch notice:', err);
      }
    }

    loadFirestoreData();

    // Attach real-time Firestore listeners
    const unsubProducts = subscribeToProducts((realtimeProducts) => {
      if (isMounted && realtimeProducts.length > 0) {
        setProducts(realtimeProducts);
      }
    });

    const unsubVendors = subscribeToPublicVendors((realtimeVendors) => {
      if (isMounted && realtimeVendors.length > 0) {
        setVendors(realtimeVendors);
      }
    });

    const handleSignedOut = () => {
      setIsAdminAuthenticated(false);
      setCurrentVendorSession(null);
      setActiveVendorIdForPortal('');
      setCurrentView('storefront');
    };
    window.addEventListener('kooll_auth_signed_out', handleSignedOut);

    return () => { 
      isMounted = false;
      unsubProducts();
      unsubVendors();
      window.removeEventListener('kooll_auth_signed_out', handleSignedOut);
    };
  }, []);

  // Cart State (Shared across all boutiques & persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('kooll_cart');
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.warn('Could not read cart from localStorage:', err);
      }
    }
    return [];
  });

  // LocalStorage Synchronization Hook for client transient cart
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('kooll_cart', JSON.stringify(cart));
      } catch (err) {
        console.warn('Failed saving cart to localStorage:', err);
      }
    }
  }, [cart]);

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  // Selected variant per product
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({
    'prod_linen_shirt': 'var_linen_sand_m',
    'prod_knit_top': 'var_knit_cream_s',
    'prod_cedar_board': 'var_cedar_med',
    'prod_gold_pendant': 'var_gold_45',
    'prod_baguette_bag': 'var_bag_black',
    'prod_laurel_soap': 'var_soap_trio',
    'prod_silk_scarf': 'var_scarf_terracotta',
    'prod_vintage_tray': 'var_tray_32',
    'prod_airpods_strap': 'var_airpods_pro'
  });

  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Admin Configurable Delivery Rate & Free Delivery Feature (Admin Only)
  const [adminDeliveryRate, setAdminDeliveryRate] = useState<number>(() => getDeliveryFee());
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState<boolean>(() => getFreeDeliveryEnabled());
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(() => getFreeDeliveryThreshold());

  useEffect(() => {
    const handleSettingsChanged = () => {
      setAdminDeliveryRate(getDeliveryFee());
      setFreeDeliveryEnabled(getFreeDeliveryEnabled());
      setFreeDeliveryThreshold(getFreeDeliveryThreshold());
    };

    // Re-check immediately when view changes (e.g. returning from Admin to Storefront)
    handleSettingsChanged();

    window.addEventListener('kooll_admin_settings_changed', handleSettingsChanged);
    window.addEventListener('storage', handleSettingsChanged);
    return () => {
      window.removeEventListener('kooll_admin_settings_changed', handleSettingsChanged);
      window.removeEventListener('storage', handleSettingsChanged);
    };
  }, [currentView]);

  // Cart calculations with smart free delivery calculation
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const {
    deliveryFee: computedDeliveryFee,
    isFreeDeliveryUnlocked,
    amountRemainingForFreeDelivery
  } = calculateOrderDeliveryFee(cartSubtotal);

  const deliveryFee = totalCartCount > 0 ? computedDeliveryFee : 0.00;
  const cartTotal = cartSubtotal + deliveryFee;
  const distinctBoutiquesInCart = Array.from(new Set(cart.map(i => i.vendorName)));

  // Add to cart with micro-interaction and stock check
  const handleAddToCart = (
    product: ProductWithVendor, 
    variantOrEvent?: string | React.MouseEvent,
    customQuantity: number = 1
  ) => {
    if (product.in_stock === false) return;

    let variantId: string | undefined;
    let qtyToAdd = customQuantity;

    if (typeof variantOrEvent === 'string') {
      variantId = variantOrEvent;
    } else if (variantOrEvent && 'stopPropagation' in variantOrEvent) {
      variantOrEvent.stopPropagation();
      variantId = selectedVariants[product.id] || product.variants[0]?.id;
    } else {
      variantId = selectedVariants[product.id] || product.variants[0]?.id;
    }

    const variant = product.variants.find(v => v.id === variantId);
    const pricing = getProductCustomerPrice(product, variantId);
    const unitPrice = pricing.customerSellingPrice;
    const basePrice = pricing.basePrice;
    const commissionRate = pricing.commissionRate;

    setCart(prev => {
      const existingIdx = prev.findIndex(
        i => i.productId === product.id && i.variantId === variantId
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += qtyToAdd;
        return next;
      }

      return [
        ...prev,
        {
          productId: product.id,
          variantId,
          vendorId: product.vendor.id,
          vendorName: product.vendor.store_name,
          title: product.title,
          variantName: variant?.name,
          unitPrice,
          basePrice,
          commissionRate,
          quantity: qtyToAdd
        }
      ];
    });

    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 1200);
  };

  const handleUpdateQuantity = (productId: string, variantId: string | null | undefined, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.productId === productId && item.variantId === variantId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (productId: string, variantId: string | null | undefined) => {
    setCart(prev => prev.filter(i => !(i.productId === productId && i.variantId === variantId)));
  };

  // Zero-friction guest checkout handler
  const handleCustomCheckout = async (payload: CheckoutPayload): Promise<CheckoutResponse> => {
    const result = executeCheckoutService(payload, vendors, orders, orderItems);
    setOrders(prev => [result.newOrder, ...prev]);
    setOrderItems(prev => [...result.newOrderItems, ...prev]);
    setDispatches(prev => [...result.dispatches, ...prev]);
    setLatestAdminWhatsAppUrl(result.response.adminWhatsAppUrl);
    return result.response;
  };

  const handleUpdateItemStatus = async (itemId: string, status: ItemStatus) => {
    setOrderItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, item_status: status, updated_at: new Date().toISOString() } : i))
    );
    const saved = await updateOrderItemStatusInDB(itemId, status);
    if (!saved) console.warn('Could not save order item status.');
  };

  const handleNewVendorRegistered = (newVendor: Vendor) => {
    setVendors(prev => [newVendor, ...prev]);
    setCurrentVendorSession(newVendor);
  };

  const handleVendorLoginSuccess = (vendor: Vendor) => {
    setCurrentVendorSession(vendor);
    setActiveVendorIdForPortal(vendor.id);
    setCurrentView('vendor-dashboard');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentView('admin-dashboard');
  };

  // Filter products by category, boutique, and search query
  const filteredProducts = products.filter(p => {
    if (!p) return false;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesBoutique = selectedBoutique === 'All' || (p.vendor && p.vendor.id === selectedBoutique);
    const query = (searchQuery || '').trim().toLowerCase();
    const titleMatch = (p.title || '').toLowerCase().includes(query);
    const descMatch = (p.description || '').toLowerCase().includes(query);
    const vendorMatch = (p.vendor?.store_name || '').toLowerCase().includes(query);
    const matchesSearch = !query || titleMatch || descMatch || vendorMatch;
    return matchesCategory && matchesBoutique && matchesSearch && p.is_active;
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-stone-900 flex flex-col antialiased selection:bg-rose-500 selection:text-white" dir={dir}>
      
      {/* 
        TRENDY SOCIAL-COMMERCE HEADER
      */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
        {/* Top Micro-Banner with Free Delivery Highlights */}
        <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 text-white text-[11px] font-semibold py-1 px-4 text-center tracking-wide flex items-center justify-center">
          <span>
            {freeDeliveryEnabled ? (
              locale === 'ar' 
                ? `🇱🇧 توصيل مجاني للطلبات فوق $${freeDeliveryThreshold}! ديليفري عادي $${adminDeliveryRate} لكل لبنان · كاش أو ويش موني`
                : `🇱🇧 FREE Delivery on orders over $${freeDeliveryThreshold}! Flat $${adminDeliveryRate} delivery · Cash or Whish Money`
            ) : (
              locale === 'ar' 
                ? `🇱🇧 ديليفري موحد ${adminDeliveryRate === 0 ? 'مجاني' : `$${adminDeliveryRate}`} لكل لبنان · الدفع كاش أو عبر ويش موني` 
                : `🇱🇧 Flat ${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} Delivery Everywhere in Lebanon · Cash on Delivery or Whish Money`
            )}
          </span>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Wordmark & Logo */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => setCurrentView('storefront')}
              className="group flex items-center gap-2 sm:gap-2.5 cursor-pointer text-start select-none shrink-0"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-stone-900 flex items-center justify-center text-white shadow-sm group-hover:bg-rose-700 transition-colors shrink-0">
                <span className="text-xs sm:text-sm font-black tracking-tight">RB</span>
              </div>
              <div className="flex flex-col shrink-0">
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-base sm:text-2xl font-black tracking-tight text-stone-950 leading-none whitespace-nowrap">
                    RB Store
                  </span>
                </div>
                <span className="hidden sm:inline-block text-[10px] font-bold text-stone-500 tracking-wide mt-0.5 whitespace-nowrap">
                  {locale === 'ar' ? 'تسوّق ببساطة' : 'Simple local shopping'}
                </span>
              </div>
            </button>
          </div>

          {/* Quick Search Input */}
          {currentView === 'storefront' && (
            <div className="flex-1 max-w-md mx-2 hidden sm:block">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={locale === 'ar' ? 'ابحث عن فساتين، إكسسوارات، كفرات تيك توك...' : 'Search linen, chunky jewelry, viral drops...'}
                  className="w-full ps-9 pe-4 py-2 bg-stone-100 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-black rounded-full text-xs text-stone-900 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Actions: Navigation, Language Switcher + Bag */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Storefront return button when inside Admin or Vendor portal */}
            {currentView !== 'storefront' && (
              <button
                onClick={() => setCurrentView('storefront')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                {dir === 'rtl' ? (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
                    <span>السوق</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5 text-rose-600" />
                    <span>Store</span>
                  </>
                )}
              </button>
            )}

            {/* Merchant Portal Access */}
            {currentView === 'storefront' && (
              <button
                onClick={() => {
                  if (currentVendorSession) {
                    setCurrentView('vendor-dashboard');
                  } else {
                    setCurrentView('vendor-login');
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200"
                title={locale === 'ar' ? 'بوابة المتاجر' : 'Store Portal'}
              >
                <Store className="w-3.5 h-3.5 text-stone-600" />
                <span>{locale === 'ar' ? 'بوابة المتاجر' : 'Stores'}</span>
              </button>
            )}

            <LanguageSwitcher
              currentLocale={locale}
              onLocaleChange={(newLocale) => setLocale(newLocale)}
            />

            {/* Bag Button - Only displayed on customer storefront */}
            {currentView === 'storefront' && (
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-black text-white hover:bg-stone-800 active:scale-95 rounded-full transition-all shadow-md cursor-pointer shrink-0"
                aria-label="Open Cart"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-1 -end-1 bg-rose-500 text-white text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in-50 duration-150">
                    {totalCartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Bar Row - ONLY on storefront */}
        {currentView === 'storefront' && (
          <div className="px-3 pb-2 sm:hidden">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-stone-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === 'ar' ? 'ابحث في متاجرك المفضلة...' : 'Search local shops & viral drops...'}
                className="w-full ps-9 pe-4 py-2 bg-stone-100 border border-stone-200 rounded-full text-xs text-stone-900 focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        )}
      </header>

      {/* 
        AUTHENTICATION ROUTE VIEWS
      */}
      {currentView === 'vendor-signup' && (
        <div className="flex-1">
          <div className="bg-stone-900 text-white p-3 flex items-center justify-between text-xs">
            <span>✨ Boutique Merchant Registration</span>
            <button 
              onClick={() => setCurrentView('storefront')} 
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-black font-semibold rounded-md hover:bg-stone-200 cursor-pointer text-xs"
            >
              {dir === 'rtl' ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
              <span>{locale === 'ar' ? 'العودة إلى RB Store' : 'Back to RB Store'}</span>
            </button>
          </div>
          <VendorSignupPage 
            onSuccess={handleNewVendorRegistered}
            onNavigateLogin={() => setCurrentView('vendor-login')}
          />
        </div>
      )}

      {currentView === 'vendor-login' && (
        <div className="flex-1">
          <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between text-xs text-stone-800">
            <span className="font-bold flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-rose-600" />
              <span>{locale === 'ar' ? 'تسجيل دخول التاجر الشريك' : 'Boutique Merchant Sign In'}</span>
            </span>
            <button 
              onClick={() => setCurrentView('storefront')} 
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-stone-100 text-stone-900 border border-stone-300 font-bold rounded-lg transition-colors cursor-pointer text-xs"
            >
              {dir === 'rtl' ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
              <span>{locale === 'ar' ? 'العودة للمتجر' : 'Back to Storefront'}</span>
            </button>
          </div>
          <VendorLoginPage 
            onSuccess={handleVendorLoginSuccess}
            onNavigateSignup={() => setCurrentView('vendor-signup')}
          />
        </div>
      )}

      {currentView === 'admin-login' && (
        <div className="flex-1">
          <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between text-xs text-stone-800">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>{locale === 'ar' ? 'لوحة تحكم RB Store' : 'RB Store Admin Control'}</span>
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentView('vendor-login')} 
                className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                {locale === 'ar' ? 'بوابة التجار' : '← Vendor Login'}
              </button>
              <button 
                onClick={() => setCurrentView('storefront')} 
                className="flex items-center gap-1.5 px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
              >
                {dir === 'rtl' ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                <span>{locale === 'ar' ? 'العودة للمتجر' : 'Back to Storefront'}</span>
              </button>
            </div>
          </div>
          <AdminLoginPage 
            onSuccess={handleAdminLoginSuccess}
            onNavigateVendor={() => setCurrentView('vendor-login')}
          />
        </div>
      )}

      {currentView === 'admin-dashboard' && (
        <div className="flex-1">
          <div className="bg-stone-900 text-white p-3 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-400">
              {locale === 'ar' ? '🛡️ جلسة الإدارة العليا النشطة (الصلاحية: super_admin)' : '🛡️ Super Admin Active Session (RBAC: super_admin)'}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  await signOutUser();
                  setIsAdminAuthenticated(false);
                  setCurrentView('storefront');
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md text-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
              <button 
                onClick={() => setCurrentView('storefront')} 
                className="flex items-center gap-1.5 px-3 py-1 bg-white text-black font-semibold rounded-md hover:bg-stone-200 cursor-pointer text-xs"
              >
                {dir === 'rtl' ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                <span>{locale === 'ar' ? 'العودة للمتجر' : 'Back to Storefront'}</span>
              </button>
            </div>
          </div>
          <AdminVendorsPage 
            bypassAuth={isAdminAuthenticated} 
            onSignOut={async () => {
              await signOutUser();
              setIsAdminAuthenticated(false);
              setCurrentView('storefront');
            }}
          />
        </div>
      )}

      {currentView === 'vendor-dashboard' && (
        <div className="flex-1">
          <div className="bg-stone-900 text-white p-3 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-400">
              {locale === 'ar' ? '🏪 لوحة تحكم التاجر الشريك' : '🏪 Boutique Merchant Console'}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  await signOutUser();
                  setCurrentVendorSession(null);
                  setActiveVendorIdForPortal('');
                  setCurrentView('storefront');
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md text-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
              <button 
                onClick={() => setCurrentView('storefront')} 
                className="flex items-center gap-1 px-3 py-1 bg-white text-black font-semibold rounded-md hover:bg-stone-200 cursor-pointer text-xs"
              >
                {dir === 'rtl' ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                <span>{locale === 'ar' ? 'العودة للمتجر' : 'Back to Storefront'}</span>
              </button>
            </div>
          </div>
          <VendorDashboard
            vendors={vendors}
            currentVendorId={activeVendorIdForPortal}
            onSelectVendor={setActiveVendorIdForPortal}
            products={products}
            onUpdateItemStatus={handleUpdateItemStatus}
            onNavigateToRegister={() => setCurrentView('vendor-signup')}
            onUpdateProduct={handleUpdateProduct}
            onAddProduct={handleAddProduct}
            onDeleteProduct={(prodId) => setProducts(prev => prev.filter(p => p.id !== prodId))}
            currentVendorSession={currentVendorSession}
            currentUserId={currentVendorSession?.profile_id || currentVendorSession?.id}
            onSignOut={async () => {
              await signOutUser();
              setCurrentVendorSession(null);
              setActiveVendorIdForPortal('');
              setCurrentView('storefront');
            }}
            onAccountDeleted={() => {
              if (currentVendorSession) {
                setVendors(prev => prev.filter(v => v.id !== currentVendorSession.id));
                setProducts(prev => prev.filter(p => p.vendor_id !== currentVendorSession.id));
              }
              setCurrentVendorSession(null);
              setCurrentView('storefront');
            }}
          />
        </div>
      )}

      {/* 
        CUSTOMER-FACING SOCIAL COMMERCE STOREFRONT
      */}
      {currentView === 'storefront' && (
        <main className="flex-1 pb-24 text-start">
          
          {/* ENERGETIC HERO BANNER WITH SEAMLESS TRANSITION */}
          <section className="relative overflow-hidden bg-gradient-to-b from-stone-950 via-stone-900 to-stone-900 text-white pt-10 sm:pt-14 pb-16 sm:pb-20 px-4 sm:px-6 rounded-b-3xl sm:rounded-b-[2.5rem] shadow-xl shadow-stone-950/20">
            {/* Ambient Glow Orbs */}
            <div className="absolute top-0 end-0 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 start-0 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-pink-400 text-xs font-bold mb-3 shadow-inner">
                <Flame className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                <span>{locale === 'ar' ? 'سوق المتاجر اللبنانية الموحد #1' : 'LEBANON\'S #1 LOCAL BOUTIQUE HUB'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
                {locale === 'ar' ? (
                  <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">كل متاجرك المفضلة</span>
                ) : (
                  <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">All Your Favorite Local Shops</span>
                )}
              </h1>

              <p className="mt-3 sm:mt-4 text-xs sm:text-base text-stone-300 max-w-xl mx-auto leading-relaxed">
                {freeDeliveryEnabled ? (
                  locale === 'ar'
                    ? `اجمع مشترياتك من أفضل المتاجر اللبنانية بسلة وحدة. توصيل مجاني للطلبات فوق $${freeDeliveryThreshold} (أو $${adminDeliveryRate} عادي)، والدفع كاش أو عبر ويش موني!`
                    : `Shop curated collections from local stores. FREE delivery on orders over $${freeDeliveryThreshold}! Pay with Cash or Whish Money.`
                ) : (
                  locale === 'ar'
                    ? `اجمع مشترياتك من أفضل المتاجر اللبنانية بسلة وحدة. دفع كاش عند الاستلام أو عبر ويش موني، وديليفري موحد ${adminDeliveryRate === 0 ? 'مجاني' : `$${adminDeliveryRate}`} لكل لبنان!`
                    : `Shop curated collections from local Lebanese stores into one single bag. Pay with Cash or Whish Money, and flat ${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} delivery everywhere in Lebanon!`
                )}
              </p>

              {/* Instant Conversion Badges */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {freeDeliveryEnabled 
                      ? (locale === 'ar' ? `توصيل مجاني فوق $${freeDeliveryThreshold}` : `Free Delivery over $${freeDeliveryThreshold}`)
                      : (locale === 'ar' ? `ديليفري موحد ${adminDeliveryRate === 0 ? 'مجاني' : `$${adminDeliveryRate}`} لكل لبنان` : `${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} Flat Delivery`)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{locale === 'ar' ? 'دفع كاش أو عبر ويش موني' : 'Cash or Whish Money'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                  <Zap className="w-3.5 h-3.5 text-pink-400" />
                  <span>{locale === 'ar' ? 'تأكيد فوري عبر واتساب' : 'Direct WhatsApp Flow'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* NATURAL SEAMLESS TRANSITION BRIDGE WITH INSTAGRAM-STORY CATEGORIES */}
          <div className="relative z-20 max-w-7xl mx-auto px-3 sm:px-6 -mt-8 sm:-mt-10">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-lg shadow-stone-900/5 py-4 px-3 sm:px-6">
              <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 scrollbar-none justify-start sm:justify-center">
                {categories.map((story) => {
                  const isSelected = selectedCategory === story.id;
                  const label = locale === 'ar' ? story.labelAr : story.labelEn;

                  return (
                    <button
                      key={story.id}
                      onClick={() => setSelectedCategory(story.id)}
                      className="group flex flex-col items-center gap-1.5 shrink-0 cursor-pointer focus:outline-none"
                    >
                      <div className={`p-0.5 rounded-full transition-all duration-200 ${
                        isSelected 
                          ? `bg-gradient-to-tr ${story.gradient} ring-2 ring-pink-500 scale-105 shadow-md shadow-pink-500/25` 
                          : `bg-gradient-to-tr ${story.gradient} opacity-85 group-hover:opacity-100 group-hover:scale-105`
                      }`}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-white p-0.5 shadow-xs">
                          <img
                            src={story.image}
                            alt={label}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                        </div>
                      </div>

                      <span className={`text-[11px] sm:text-xs font-bold tracking-tight transition-colors ${
                        isSelected ? 'text-pink-600 font-extrabold' : 'text-stone-600 group-hover:text-black'
                      }`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Boutique Filter & Stats */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-7 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-pink-600 flex items-center gap-1">
                <Flame className="w-4 h-4 fill-pink-500 text-pink-500" />
                <span>{locale === 'ar' ? 'تشكيلات الترند' : 'TRENDING DROPS'}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedBoutique}
                onChange={(e) => setSelectedBoutique(e.target.value)}
                className="text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-stone-800 shadow-2xs focus:outline-none focus:border-pink-500"
              >
                <option value="All">{locale === 'ar' ? 'جميع المتاجر' : 'All Stores'}</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.store_name} ({v.city.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PRODUCT GRID OR EMPTY STATE */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
            {filteredProducts.length === 0 ? (
              <div className="py-20 px-4 text-center max-w-md mx-auto bg-white rounded-3xl border border-stone-200/80 shadow-xs my-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-xs">
                  <Package className="w-8 h-8 text-rose-500" />
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  {locale === 'ar' ? 'لا توجد منتجات أو متاجر حالياً' : 'No Stores or Products Available'}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed mb-6">
                  {locale === 'ar'
                    ? 'تم مسح وتفريغ جميع المتاجر والمنتجات بنجاح. يمكنك الآن تسجيل متجر جديد وإضافة منتجاتك كأول متجر في المنصة!'
                    : 'All stores and products have been cleared. Register your boutique now and start listing your items!'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                  <button
                    onClick={() => setCurrentView('vendor-signup')}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/25 hover:shadow-rose-500/40 transition-all cursor-pointer"
                  >
                    {locale === 'ar' ? '✨ سجّل متجرك وابدأ البيع' : '✨ Register Boutique & Sell'}
                  </button>
                  <button
                    onClick={() => setCurrentView('admin-login')}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'لوحة تحكم الإدارة' : 'Admin Portal'}
                  </button>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.map((product) => {
                const currentVariantId = selectedVariants[product.id] || product.variants[0]?.id;
                const pricing = getProductCustomerPrice(product, currentVariantId);
                const displayPrice = pricing.customerSellingPrice;
                const isJustAdded = justAddedId === product.id;
                const imageUrl = getStorageImageUrl(product.images[0]);

                const isOutOfStock = product.in_stock === false;
                const salesCount = productSalesMap[product.id] || 0;
                const isTopSeller = salesCount > 0 && salesCount === maxProductSales;
                const isTrending = salesCount > 0 && !isTopSeller;

                return (
                  <div
                    key={product.id}
                    onClick={() => openProductDetails(product)}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col cursor-pointer text-start"
                  >
                    {/* Vertical 3/4 Image Container */}
                    <div className="relative aspect-3/4 bg-white overflow-hidden flex flex-col justify-between p-2.5 sm:p-3">
                      {/* Realistic High-Quality Unsplash Image */}
                      <img
                        src={imageUrl}
                        alt={product.title}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover object-center absolute inset-0 group-hover:scale-105 transition-transform duration-500 ease-out ${
                          isOutOfStock ? 'grayscale opacity-75' : ''
                        }`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';
                        }}
                      />

                      {/* Top Overlay Bar: Store Badge + Stock Status */}
                      <div className="relative z-10 flex items-start justify-between gap-1 w-full pointer-events-none">
                        <div className="bg-white/95 backdrop-blur-md text-stone-900 border border-stone-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs truncate max-w-[140px] pointer-events-auto">
                          <Store className="w-2.5 h-2.5 text-stone-700 shrink-0" />
                          <span className="truncate">{product.vendor.store_name}</span>
                        </div>

                        {isOutOfStock ? (
                          <span className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs shrink-0 pointer-events-auto">
                            {locale === 'ar' ? 'نفدت الكمية' : 'Out of Stock'}
                          </span>
                        ) : isTopSeller ? (
                          <span className="bg-gradient-to-r from-amber-500 to-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs shrink-0 pointer-events-auto flex items-center gap-1">
                            🔥 {locale === 'ar' ? `الأكثر طلباً (${salesCount})` : `TOP SELLER (${salesCount})`}
                          </span>
                        ) : isTrending ? (
                          <span className="bg-gradient-to-r from-pink-600 to-rose-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs shrink-0 pointer-events-auto">
                            ⚡ {locale === 'ar' ? `ترند (${salesCount})` : `TRENDING (${salesCount})`}
                          </span>
                        ) : (
                          <span className="bg-pink-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs shrink-0 pointer-events-auto">
                            HOT
                          </span>
                        )}
                      </div>

                      {/* Bottom Floating Bar on Image: Origin Pill + Quick Action */}
                      <div className="relative z-10 flex items-end justify-between w-full pointer-events-none">
                        <span className="bg-white/95 backdrop-blur-md text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200/80 shadow-xs flex items-center gap-1 pointer-events-auto">
                          <MapPin className="w-2.5 h-2.5 text-pink-600" />
                          <span>{product.vendor.city.split(' ')[0]}</span>
                        </span>

                        {/* Floating CTA Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isOutOfStock) {
                              openProductDetails(product);
                            } else {
                              handleAddToCart(product, e);
                            }
                          }}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md transition-all duration-200 cursor-pointer pointer-events-auto ${
                            isOutOfStock
                              ? 'bg-stone-300 text-stone-600 cursor-pointer hover:bg-stone-400'
                              : isJustAdded
                              ? 'bg-emerald-500 text-white scale-110 shadow-emerald-500/40 ring-2 ring-white'
                              : 'bg-gradient-to-tr from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 active:scale-90 text-white shadow-pink-600/35 hover:shadow-pink-600/50 ring-2 ring-white hover:scale-105'
                          }`}
                          aria-label={isOutOfStock ? 'View Out of Stock details' : 'Quick Add to Bag'}
                          title={isOutOfStock ? 'نفدت الكمية - اضغط للتفاصيل' : 'Add to Bag'}
                        >
                          {isOutOfStock ? (
                            <span className="text-[10px] font-black">{locale === 'ar' ? 'نفدت' : 'OUT'}</span>
                          ) : isJustAdded ? (
                            <Check className="w-5 h-5 stroke-[3] text-white" />
                          ) : (
                            <Plus className="w-5 h-5 stroke-[2.5] text-white" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Card Content & Pricing Details */}
                    <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2 bg-white">
                      <div>
                        {/* Title */}
                        <h3 className="font-bold text-xs sm:text-sm text-stone-900 line-clamp-1 group-hover:text-pink-600 transition-colors">
                          {product.title}
                        </h3>

                        {/* Description snippet */}
                        <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                          {product.description}
                        </p>

                        {/* Variant Quick Selector Pills */}
                        {product.variants.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.variants.map((v) => (
                              <button
                                key={v.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVariants(prev => ({ ...prev, [product.id]: v.id }));
                                }}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                  currentVariantId === v.id
                                    ? 'bg-black text-white border-black'
                                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'
                                }`}
                              >
                                {v.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing Tag with Stock Pill */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base sm:text-lg font-black font-mono text-black">
                              ${displayPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-bold text-stone-400">USD</span>
                          </div>
                          <span className="text-[10px] text-stone-400 block font-mono">
                            ~{Math.round(displayPrice * 89500).toLocaleString()} LBP
                          </span>
                        </div>

                        {/* Status Badge */}
                        {isOutOfStock ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {locale === 'ar' ? 'نفدت الكمية' : 'Out of Stock'}
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {locale === 'ar' ? 'متوفر' : 'In Stock'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </section>
        </main>
      )}

      {/* STICKY MOBILE BOTTOM BAR (SHEIN / TikTok Shop Fast Action) */}
      {totalCartCount > 0 && currentView === 'storefront' && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                {distinctBoutiquesInCart.length} {locale === 'ar' ? 'متاجر بسلتك' : 'Shops in Bag'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-slate-950 font-mono">${cartTotal.toFixed(2)}</span>
                <span className="text-[10px] font-bold text-emerald-600">COD</span>
              </div>
            </div>

            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF2A6D] hover:bg-[#E01E5A] active:scale-98 text-white text-xs font-black rounded-xl shadow-lg shadow-[#FF2A6D]/30 transition-transform cursor-pointer"
            >
              <Phone className="w-4 h-4 fill-white" />
              <span>{locale === 'ar' ? 'تأكيد الطلب بالواتساب (كاش أو ويش)' : 'Checkout via WhatsApp (Cash / Whish)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Slide-Over Shared Cart Drawer */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150" dir={dir}>
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-s border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Vibrant Accent Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 shrink-0" />

            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF2A6D] animate-pulse" />
                <h3 className="font-black text-base text-stone-900">
                  {t('cart.title')} ({totalCartCount})
                </h3>
              </div>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-stone-400 text-xs">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                  <p className="font-bold text-stone-600 text-sm">{t('cart.emptyTitle')}</p>
                  <p className="mt-1">{t('cart.emptySubtitle')}</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/80 rounded-xl text-xs text-rose-950 flex items-center gap-2">
                    <Store className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">
                      {isFreeDeliveryUnlocked ? (
                        locale === 'ar' 
                          ? `🎉 أصناف من ${distinctBoutiquesInCart.length} متجر ستصلك معاً بتوصيل مجاني!` 
                          : `🎉 Items from ${distinctBoutiquesInCart.length} boutique(s) with FREE delivery!`
                      ) : (
                        t('cart.consolidationBanner', { count: distinctBoutiquesInCart.length, fee: deliveryFee.toFixed(2) })
                      )}
                    </span>
                  </div>

                  {/* Free Delivery Interactive Progress Bar (Controlled by Admin) */}
                  {freeDeliveryEnabled && (
                    <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1.5 text-stone-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {isFreeDeliveryUnlocked ? (
                            <span className="text-emerald-700 font-extrabold">
                              {locale === 'ar' ? '🎉 مبروك! حصلت على توصيل مجاني!' : '🎉 Free Delivery Unlocked!'}
                            </span>
                          ) : (
                            <span>
                              {locale === 'ar' 
                                ? `أضف بقيمة $${amountRemainingForFreeDelivery.toFixed(2)} إضافية لتحصل على توصيل مجاني!`
                                : `Add $${amountRemainingForFreeDelivery.toFixed(2)} more for FREE Delivery!`}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-stone-500">
                          ${Math.min(cartSubtotal, freeDeliveryThreshold).toFixed(0)}/${freeDeliveryThreshold}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 rounded-full ${
                            isFreeDeliveryUnlocked ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, (cartSubtotal / freeDeliveryThreshold) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-stone-100">
                    {cart.map((item, idx) => (
                      <div key={`${item.productId}-${item.variantId}-${idx}`} className="py-3 flex items-start justify-between gap-3">
                        <div className="space-y-0.5 max-w-[220px]">
                          <span className="text-[10px] font-extrabold text-rose-600 uppercase flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            <span>{item.vendorName}</span>
                          </span>
                          <h4 className="text-xs font-bold text-stone-900 truncate">{item.title}</h4>
                          {item.variantName && (
                            <span className="text-[11px] text-stone-500 block truncate">{item.variantName}</span>
                          )}
                          <div className="font-mono font-bold text-xs text-black pt-1">
                            ${item.unitPrice.toFixed(2)} USD
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, -1)}
                              className="p-1 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-mono text-xs font-bold text-black tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, 1)}
                              className="p-1 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemoveFromCart(item.productId, item.variantId)}
                            className="text-stone-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-stone-200 bg-stone-50 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>{t('cart.subtotal')}</span>
                    <span className="font-mono font-bold tabular-nums">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-stone-500" />
                      <span>{t('cart.delivery')}</span>
                    </span>
                    {isFreeDeliveryUnlocked ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded text-[11px] font-mono">
                        {locale === 'ar' ? 'مجاني $0.00 🎉' : 'FREE $0.00 🎉'}
                      </span>
                    ) : (
                      <span className="font-mono font-bold tabular-nums">${deliveryFee.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-950 text-sm">
                    <span>{t('cart.totalDue')}</span>
                    <span className="font-mono tabular-nums text-[#FF2A6D]">${cartTotal.toFixed(2)} USD</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCartDrawerOpen(false);
                    setIsCheckoutModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FF2A6D] hover:bg-[#E01E5A] active:scale-98 text-white text-xs font-black rounded-xl shadow-lg shadow-[#FF2A6D]/25 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4 fill-white" />
                  <span>{t('cart.proceedCheckout')}</span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Details Browsing Modal */}
      <ProductDetailsModal
        product={viewingProduct}
        isOpen={isProductDetailsOpen}
        onClose={() => setIsProductDetailsOpen(false)}
        isAdmin={isAdminAuthenticated}
        onDeleteProduct={(prodId) => setProducts(prev => prev.filter(p => p.id !== prodId))}
        onAddToCart={(prod, variantId, qty) => {
          handleAddToCart(prod, variantId, qty);
        }}
        onSelectStore={(storeId) => {
          setSelectedBoutique(storeId);
          setCurrentView('storefront');
        }}
      />

      {/* Customer Guest Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        items={cart}
        onClearCart={() => setCart([])}
        customCheckoutHandler={handleCustomCheckout}
      />

      {/* Categories & Visual Stories Manager Modal for Admin */}
      <CategoriesManagerModal
        isOpen={isCategoriesManagerOpen}
        onClose={() => setIsCategoriesManagerOpen(false)}
        onCategoriesUpdated={setCategories}
      />

      {/* FOOTER */}
      <footer className="border-t border-stone-200 bg-white pt-12 pb-8 text-stone-600 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-stone-100">
            {/* Brand Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white shadow-xs">
                  <span className="text-[10px] font-black">RB</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-black text-black tracking-tight leading-tight">
                    RB Store
                  </span>
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                    SIMPLE SHOPPING
                  </span>
                </div>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                {locale === 'ar'
                  ? `منصة التسوق الموحدة للمتاجر اللبنانية. سلة واحدة، وتوصيل موحد ${adminDeliveryRate === 0 ? 'مجاني' : `$${adminDeliveryRate}`} لجميع المناطق، والدفع كاش عند الاستلام أو عبر ويش موني.`
                  : `Lebanon’s consolidated multi-vendor marketplace. One unified bag, flat ${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} delivery, and Cash or Whish Money.`}
              </p>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                <Truck className="w-3.5 h-3.5" />
                <span>{locale === 'ar' ? `توصيل موحد ${adminDeliveryRate === 0 ? 'مجاني' : `$${adminDeliveryRate}`} · دفع كاش أو عبر ويش موني` : `Flat ${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} Delivery · Cash or Whish Money`}</span>
              </div>
            </div>

            {/* Shopping Links */}
            <div className="space-y-3 text-start">
              <h4 className="font-bold text-stone-900 text-sm">
                {locale === 'ar' ? 'أقسام السوق' : 'Marketplace'}
              </h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => { setSelectedCategory('All'); setCurrentView('storefront'); }} 
                    className="hover:text-black transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'جميع التشكيلات والمنتجات' : 'All Collections'}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => { setSelectedCategory('Clothes'); setCurrentView('storefront'); }} 
                    className="hover:text-black transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'الأزياء والملابس' : 'Clothing & Apparel'}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => { setSelectedCategory('Jewelry'); setCurrentView('storefront'); }} 
                    className="hover:text-black transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'المجوهرات والإكسسوارات' : 'Jewelry & Accessories'}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => { setSelectedCategory('Gifts'); setCurrentView('storefront'); }} 
                    className="hover:text-black transition-colors cursor-pointer"
                  >
                    {locale === 'ar' ? 'الهدايا والديكور' : 'Gifts & Home'}
                  </button>
                </li>
              </ul>
            </div>

            {/* Store Portal Links */}
            <div className="space-y-3 text-start">
              <h4 className="font-bold text-stone-900 text-sm">
                {locale === 'ar' ? 'للمتاجر' : 'For Stores'}
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <button 
                    onClick={() => setCurrentView('vendor-signup')} 
                    className="hover:text-black transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-stone-400" />
                    <span>{locale === 'ar' ? 'تسجيل متجر جديد' : 'Register New Store'}</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      if (currentVendorSession) {
                        setCurrentView('vendor-dashboard');
                      } else {
                        setCurrentView('vendor-login');
                      }
                    }} 
                    className="hover:text-black transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Store className="w-3.5 h-3.5 text-stone-400" />
                    <span>{locale === 'ar' ? 'تسجيل دخول المتاجر' : 'Store Login'}</span>
                  </button>
                </li>
                {/* Admin Control Page only here at the bottom beside Store Login */}
                <li>
                  <button 
                    onClick={() => {
                      if (isAdminAuthenticated) {
                        setCurrentView('admin-dashboard');
                      } else {
                        setCurrentView('admin-login');
                      }
                    }} 
                    className="hover:text-amber-800 transition-colors cursor-pointer flex items-center gap-1.5 text-stone-400 hover:text-stone-700"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
                    <span>{locale === 'ar' ? 'لوحة تحكم الإدارة (الآدمن)' : 'Admin Control Panel'}</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Delivery & Guarantees Column */}
            <div className="space-y-3 text-start">
              <h4 className="font-bold text-stone-900 text-sm">
                {locale === 'ar' ? 'الشحن والدفع' : 'Delivery & Payment'}
              </h4>
              <ul className="space-y-2 text-stone-500 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{locale === 'ar' ? `توصيل موحد ${adminDeliveryRate === 0 ? 'مجاني' : `${adminDeliveryRate}$`} لكل لبنان` : `Flat ${adminDeliveryRate === 0 ? 'Free' : `$${adminDeliveryRate}`} Delivery Everywhere`}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{locale === 'ar' ? 'الدفع كاش عند الاستلام أو عبر ويش موني' : 'Cash on Delivery or Whish Money'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{locale === 'ar' ? 'سلة واحدة لمتاجر متعددة' : 'One Cart, Multiple Local Stores'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-pink-500 font-bold">•</span>
                  <span>{locale === 'ar' ? 'تأكيد مباشر عبر الواتساب' : 'Direct WhatsApp Order Confirmation'}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright Sub-bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-stone-400 text-[11px]">
            <p>
                © 2026 RB Store. {locale === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-4">
              <span>🇱🇧 Beirut, Lebanon</span>
              <span>·</span>
              <span>{locale === 'ar' ? 'الدفع كاش أو عبر ويش موني' : 'Cash or Whish Money'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider initialLocale="ar">
      <MarketplaceApp />
    </I18nProvider>
  );
}
