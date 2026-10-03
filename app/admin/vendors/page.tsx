'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  Check, 
  XCircle, 
  Percent, 
  MapPin, 
  Phone, 
  Instagram, 
  ShieldAlert, 
  Search, 
  SlidersHorizontal, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Store,
  RefreshCw,
  Globe,
  Truck,
  Sparkles,
  Gift,
  CheckCheck,
  Layers,
  LogOut,
  Trash2,
  Edit3
} from 'lucide-react';
import type { Vendor, VendorStatus } from '@/src/types/database';
import { useI18n } from '@/src/lib/i18nContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import AdminLoginPage from '../login/page';
import { CategoriesManagerModal } from '@/src/components/CategoriesManagerModal';
import { getCurrentSessionUser, signOutUser } from '@/src/lib/auth';
import { 
  getAdminWhishPhone, 
  setAdminWhishPhone, 
  getDeliveryFee, 
  setDeliveryFee,
  getFreeDeliveryEnabled,
  setFreeDeliveryEnabled,
  getFreeDeliveryThreshold,
  setFreeDeliveryThreshold,
  getPlatformCommissionOverride,
  setPlatformCommissionOverride,
  subscribeToPlatformCommissionOverride,
  normalizeDigits
} from '@/src/lib/adminSettings';
import { 
  fetchVendorsFromDB, 
  subscribeToVendors,
  deleteVendorStorePage,
  syncPublicVendorCatalogFromDB,
  updateVendorStatusInDB, 
  updateVendorCommissionInDB,
  subscribeToOrders,
  fetchOrdersFromDB
} from '@/src/lib/databaseService';
import type { OrderItem } from '@/src/types/database';

interface AdminVendorsPageProps {
  bypassAuth?: boolean;
  onSignOut?: () => void;
}

// Initial empty state for clean Firestore synchronization
const INITIAL_VENDORS: Vendor[] = [];

export default function AdminVendorsPage({ bypassAuth = false, onSignOut }: AdminVendorsPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(bypassAuth);
  const { locale, setLocale, dir } = useI18n();
  const isAr = locale === 'ar';

  React.useEffect(() => {
    setIsAuthenticated(bypassAuth || getCurrentSessionUser()?.role === 'super_admin');
  }, [bypassAuth]);

  const handleAdminSignOut = async () => {
    await signOutUser();
    setIsAuthenticated(false);
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = '/admin/login';
    }
  };

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VendorStatus>('all');
  const [commissionEdits, setCommissionEdits] = useState<Record<string, string>>({});
  const [savingVendorId, setSavingVendorId] = useState<string | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingPublicVendors, setIsSyncingPublicVendors] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [adminPhoneInput, setAdminPhoneInput] = useState<string>(() => getAdminWhishPhone());
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>(() => getDeliveryFee().toString());
  const [freeDeliveryEnabled, setFreeDeliveryEnabledState] = useState<boolean>(() => getFreeDeliveryEnabled());
  const [freeDeliveryThresholdInput, setFreeDeliveryThresholdInput] = useState<string>(() => getFreeDeliveryThreshold().toString());
  const [platformCommissionOverride, setPlatformCommissionOverrideState] = useState<number | null>(() => getPlatformCommissionOverride());
  const [isEditingPlatformCommission, setIsEditingPlatformCommission] = useState(false);
  const [platformCommissionInput, setPlatformCommissionInput] = useState('');
  const [isSavingPlatformCommission, setIsSavingPlatformCommission] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  React.useEffect(() => {
    const syncSettings = () => {
      setAdminPhoneInput(getAdminWhishPhone());
      setDeliveryFeeInput(getDeliveryFee().toString());
      setFreeDeliveryEnabledState(getFreeDeliveryEnabled());
      setFreeDeliveryThresholdInput(getFreeDeliveryThreshold().toString());
      setPlatformCommissionOverrideState(getPlatformCommissionOverride());
    };

    window.addEventListener('kooll_admin_settings_changed', syncSettings);
    return () => window.removeEventListener('kooll_admin_settings_changed', syncSettings);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToPlatformCommissionOverride(setPlatformCommissionOverrideState);
  }, [isAuthenticated]);

  // Real-time synchronization with Firebase Firestore vendors
  React.useEffect(() => {
    let isMounted = true;
    let hasLoadedVendors = false;
    let hasLoadedOrders = false;
    const finishInitialLoad = () => {
      if (isMounted && hasLoadedVendors && hasLoadedOrders) setIsDashboardDataLoading(false);
    };

    const unsubscribe = subscribeToVendors(
      (dbVendors) => {
        setVendors(dbVendors);
        hasLoadedVendors = true;
        finishInitialLoad();
      },
      (err) => {
        console.warn('Real-time vendors subscription notice, falling back:', err);
        fetchVendorsFromDB().then(dbVendors => {
          if (!isMounted) return;
          setVendors(dbVendors);
          hasLoadedVendors = true;
          finishInitialLoad();
        });
      }
    );

    const handleLocalVendorRegistered = (e: any) => {
      if (e?.detail) {
        setVendors(prev => {
          if (!prev.some(v => v.id === e.detail.id)) {
            return [e.detail, ...prev];
          }
          return prev;
        });
      }
    };
    window.addEventListener('kooll_vendor_registered', handleLocalVendorRegistered);

    const unsubOrders = subscribeToOrders(
      (data) => {
        if (data?.orderItems) {
          setOrderItems(data.orderItems);
        }
        hasLoadedOrders = true;
        finishInitialLoad();
      },
      () => {
        fetchOrdersFromDB().then(res => {
          if (!isMounted) return;
          setOrderItems(res?.orderItems || []);
          hasLoadedOrders = true;
          finishInitialLoad();
        });
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      if (unsubOrders) unsubOrders();
      window.removeEventListener('kooll_vendor_registered', handleLocalVendorRegistered);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1-Click Status Update (Approve / Suspend / Reactivate) synced to Firebase Firestore
  const handleUpdateStatus = async (vendorId: string, newStatus: VendorStatus) => {
    setVendors(prev =>
      prev.map(v => (v.id === vendorId ? { ...v, status: newStatus, updated_at: new Date().toISOString() } : v))
    );

    await updateVendorStatusInDB(vendorId, newStatus);

    const vendor = vendors.find(v => v.id === vendorId);
    const statusLabel = isAr 
      ? (newStatus === 'active' ? 'نشط ومفعل' : newStatus === 'pending' ? 'قيد الانتظار' : 'موقوف')
      : newStatus.toUpperCase();
    
    showToast(isAr 
      ? `تم تحديث حالة متجر "${vendor?.store_name}" إلى: ${statusLabel}`
      : `Store "${vendor?.store_name}" marked as ${statusLabel}`);
  };

  // Update commission input value
  const handleCommissionChange = (vendorId: string, value: string) => {
    setCommissionEdits(prev => ({ ...prev, [vendorId]: value }));
  };

  // Save updated commission rate synced to Firebase Firestore
  const handleSaveCommission = async (vendorId: string) => {
    const rawVal = commissionEdits[vendorId];
    if (rawVal === undefined) return;
    const rate = parseFloat(rawVal);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert(isAr ? 'يجب أن تكون نسبة العمولة مئوية صحيحة بين 0% و 100%' : 'Commission rate must be a valid percentage between 0 and 100%');
      return;
    }

    setSavingVendorId(vendorId);
    await updateVendorCommissionInDB(vendorId, rate);

    setVendors(prev =>
      prev.map(v => (v.id === vendorId ? { ...v, commission_rate: rate, updated_at: new Date().toISOString() } : v))
    );

    setCommissionEdits(prev => {
      const next = { ...prev };
      delete next[vendorId];
      return next;
    });

    setSavingVendorId(null);
    const vendor = vendors.find(v => v.id === vendorId);
    showToast(isAr
      ? `تم تحديث نسبة عمولة متجر "${vendor?.store_name}" إلى ${rate.toFixed(1)}%`
      : `Commission rate for "${vendor?.store_name}" updated to ${rate.toFixed(1)}%`);
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    const confirmationMessage = isAr
      ? `هل تريد حذف صفحة متجر "${vendor.store_name}"؟ سيتم حذف صفحة المتجر ومنتجاتها وروابطها، مع إبقاء حساب التاجر والطلبات السابقة. لا يمكن التراجع عن ذلك.`
      : `Delete the store page for "${vendor.store_name}"? Its store page, products, and links will be deleted. The vendor account and past orders will remain. This cannot be undone.`;

    if (!window.confirm(confirmationMessage)) return;

    setDeletingVendorId(vendor.id);
    const result = await deleteVendorStorePage(vendor.id);
    setDeletingVendorId(null);

    if (!result.success) {
      showToast(result.error || (isAr ? 'تعذر حذف صفحة المتجر' : 'Could not delete the store page'));
      return;
    }

    setVendors(prev => prev.filter(item => item.id !== vendor.id));
    showToast(isAr ? `تم حذف صفحة متجر "${vendor.store_name}"` : `Store page "${vendor.store_name}" deleted`);
  };

  // Filtered view
  const filteredVendors = vendors.filter(v => {
    if (!v) return false;
    const query = (searchQuery || '').trim().toLowerCase();
    const storeNameMatch = (v.store_name || '').toLowerCase().includes(query);
    const cityMatch = (v.city || '').toLowerCase().includes(query);
    const phoneMatch = (v.phone || '').includes(searchQuery || '');
    const instaMatch = (v.instagram_handle || '').toLowerCase().includes(query);
    const matchesSearch = !query || storeNameMatch || cityMatch || phoneMatch || instaMatch;

    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = vendors.filter(v => v.status === 'pending').length;
  const activeCount = vendors.filter(v => v.status === 'active').length;
  const suspendedCount = vendors.filter(v => v.status === 'suspended').length;
  const averageCommission = (vendors.reduce((s, v) => s + v.commission_rate, 0) / (vendors.length || 1)).toFixed(1);
  const totalCommissionEarned = orderItems.reduce((sum, item) => sum + (Number(item.commission_amount) || 0), 0);
  const displayedCommissionEarned = platformCommissionOverride ?? totalCommissionEarned;

  const handleSavePlatformCommission = async () => {
    const cleaned = normalizeDigits(platformCommissionInput);
    const amount = parseFloat(cleaned);
    if (!cleaned || !Number.isFinite(amount) || amount < 0) {
      alert(isAr ? 'أدخل مبلغًا صحيحًا للأرباح' : 'Enter a valid earnings amount');
      return;
    }

    setIsSavingPlatformCommission(true);
    const saved = await setPlatformCommissionOverride(amount);
    setIsSavingPlatformCommission(false);
    if (!saved) {
      showToast(isAr ? 'تعذر حفظ مبلغ الأرباح' : 'Could not save earnings amount');
      return;
    }

    setPlatformCommissionOverrideState(amount);
    setIsEditingPlatformCommission(false);
    showToast(isAr ? 'تم حفظ مبلغ الأرباح المعروض' : 'Displayed earnings amount saved');
  };

  const handleResetPlatformCommission = async () => {
    setIsSavingPlatformCommission(true);
    const saved = await setPlatformCommissionOverride(null);
    setIsSavingPlatformCommission(false);
    if (!saved) {
      showToast(isAr ? 'تعذر استعادة الحساب التلقائي' : 'Could not restore automatic calculation');
      return;
    }

    setPlatformCommissionOverrideState(null);
    setIsEditingPlatformCommission(false);
    setPlatformCommissionInput('');
    showToast(isAr ? 'تمت استعادة حساب الأرباح من الطلبات' : 'Earnings now use order totals');
  };

  if (!isAuthenticated) {
    return <AdminLoginPage onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16 text-start" dir={dir}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 end-4 z-50 bg-stone-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-stone-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Admin Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
                <span>{isAr ? 'مركز RB Store' : 'RB Store Logistics Center'}</span>
                <span aria-hidden="true">·</span>
                <span>{isAr ? 'لوحة تحكم الإدارة بلبنان' : 'Lebanon Admin Console'}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-800 font-bold">
                  {isAr ? 'الصلاحية: إدارة عليا' : 'RBAC: Super Admin'}
                </span>
              </div>
              <h1 className="text-2xl font-serif font-black text-stone-900 tracking-tight">
                {isAr ? 'شبكة المتاجر وإدارة العمولات' : 'Vendor Network & Commission Control'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-500 hidden sm:inline">
                {isAr ? 'مزامنة مباشرة مع الإدارة وقاعدة البيانات' : 'Direct Admin & Database Sync'}
              </span>
              
              {/* WhatsApp Connected Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isAr ? 'توجيه الطلبيات للواتساب الرسمي نشط' : 'Direct WhatsApp Orders Active'}</span>
              </div>

              {/* Instant Manual Refresh */}
              <button
                type="button"
                onClick={async () => {
                  setIsRefreshing(true);
                  const [dbVendors, dbOrders] = await Promise.all([
                    fetchVendorsFromDB(),
                    fetchOrdersFromDB(),
                  ]);
                  setVendors(dbVendors);
                  setOrderItems(dbOrders.orderItems);
                  setIsRefreshing(false);
                  showToast(isAr ? 'تم تحديث قائمة المتاجر بنجاح' : 'Vendors list refreshed');
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg border border-stone-300 transition-colors cursor-pointer disabled:opacity-50"
                title={isAr ? 'تحديث فوري' : 'Instant Refresh'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث المتاجر' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsSyncingPublicVendors(true);
                  const result = await syncPublicVendorCatalogFromDB();
                  setIsSyncingPublicVendors(false);
                  showToast(result.success
                    ? (isAr ? `تمت مزامنة ${result.count} متجرًا عامًا` : `Synced ${result.count} public stores`)
                    : (result.error || (isAr ? 'تعذرت مزامنة المتاجر العامة' : 'Could not sync public stores')));
                }}
                disabled={isSyncingPublicVendors}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                title={isAr ? 'نشر بيانات المتاجر النشطة دون معلومات الحساب' : 'Publish sanitized active store data'}
              >
                <Globe className={`w-3.5 h-3.5 ${isSyncingPublicVendors ? 'animate-pulse' : ''}`} />
                <span>{isSyncingPublicVendors ? (isAr ? 'جارٍ المزامنة...' : 'Syncing...') : (isAr ? 'مزامنة العرض العام' : 'Sync Public Catalog')}</span>
              </button>

              {/* Categories & Visual Stories Button */}
              <button
                type="button"
                onClick={() => setIsCategoriesModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isAr ? '🎨 أقسام المتجر والصور' : '🎨 Story Categories & Photos'}</span>
              </button>

              <LanguageSwitcher
                currentLocale={locale}
                onLocaleChange={setLocale}
              />

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleAdminSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                title={isAr ? 'تسجيل الخروج من لوحة الإدارة' : 'Sign Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar (KPI Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-stone-100">
            {/* Card 1: Pending */}
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
              <span className="text-xs text-stone-500 block">
                {isAr ? 'طلبات الانضمام / قيد المراجعة' : 'Pending Applications / Needs Review'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-amber-800">{isDashboardDataLoading ? '...' : pendingCount}</span>
                <span className="text-xs text-amber-700 font-semibold">
                  {isAr ? 'قيد المراجعة' : 'Needs Review'}
                </span>
              </div>
            </div>

            {/* Card 2: Active */}
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
              <span className="text-xs text-stone-500 block">
                {isAr ? 'المتاجر النشطة / جاهزة للاستلام' : 'Active Boutiques / Ready for Pickup'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-emerald-800">{isDashboardDataLoading ? '...' : activeCount}</span>
                <span className="text-xs text-emerald-700 font-semibold">
                  {isAr ? 'جاهزة للاستلام' : 'Ready for Pickup'}
                </span>
              </div>
            </div>

            {/* Card 3: Suspended */}
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
              <span className="text-xs text-stone-500 block">
                {isAr ? 'المتاجر الموقوفة / غير مفعلة' : 'Suspended Boutiques / Offline'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-rose-800">{isDashboardDataLoading ? '...' : suspendedCount}</span>
                <span className="text-xs text-stone-400 font-medium">
                  {isAr ? 'غير مفعلة' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Card 4: Platform Commission Earned & Take Rate */}
            <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
              <span className="text-xs text-stone-500 block">
                {isAr ? 'إجمالي أرباح المنصة (العمولة)' : 'Platform Total Commission'}
              </span>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isEditingPlatformCommission ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={platformCommissionInput}
                      onChange={(e) => setPlatformCommissionInput(e.target.value)}
                      aria-label={isAr ? 'مبلغ الأرباح المعروض' : 'Displayed earnings amount'}
                      className="w-24 min-w-0 px-1.5 py-1 bg-white border border-stone-300 rounded-md text-lg font-bold font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
                    />
                  ) : (
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-800">
                      {isDashboardDataLoading && platformCommissionOverride === null ? '...' : `$${displayedCommissionEarned.toFixed(2)}`}
                    </span>
                  )}
                  {isEditingPlatformCommission ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSavePlatformCommission}
                        disabled={isSavingPlatformCommission}
                        title={isAr ? 'حفظ المبلغ' : 'Save amount'}
                        aria-label={isAr ? 'حفظ المبلغ' : 'Save amount'}
                        className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleResetPlatformCommission}
                        disabled={isSavingPlatformCommission}
                        title={isAr ? 'العودة للحساب التلقائي' : 'Use automatic total'}
                        aria-label={isAr ? 'العودة للحساب التلقائي' : 'Use automatic total'}
                        className="p-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-md disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPlatformCommissionInput(displayedCommissionEarned.toFixed(2));
                        setIsEditingPlatformCommission(true);
                      }}
                      title={isAr ? 'تعديل مبلغ الأرباح المعروض' : 'Edit displayed earnings'}
                      aria-label={isAr ? 'تعديل مبلغ الأرباح المعروض' : 'Edit displayed earnings'}
                      className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-md"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-stone-500 font-medium">
                  {isDashboardDataLoading ? '...' : (isAr ? `(متوسط ${averageCommission}%)` : `(avg ${averageCommission}%)`)}
                  {platformCommissionOverride !== null && (isAr ? ' · مبلغ يدوي' : ' · Manual amount')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        {/* Admin Operational Controls: Phone + Delivery Fee + Free Delivery (Admin Only) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Admin Official Phone & Whish Account Management Card */}
          <div className="bg-white rounded-2xl border border-amber-200/90 p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-black text-stone-900">
                  {isAr ? 'رقم هاتف الإدارة الرسمي (Whish):' : 'Official Admin Contact & Whish Number:'}
                </h2>
              </div>
              <p className="text-xs text-stone-500">
                {isAr
                  ? 'الرقم المعتمد لاستقبال تحويلات ويش موني وتأكيد الطلبيات عبر واتساب.'
                  : 'Official number for Whish Money payments and WhatsApp order confirmations.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center flex-1 min-w-0" dir="ltr">
                <span className="bg-stone-100 text-stone-600 px-2.5 py-2 border border-e-0 border-stone-300 rounded-s-xl text-xs font-mono font-bold">
                  +
                </span>
                <input
                  type="text"
                  value={adminPhoneInput}
                  onChange={(e) => setAdminPhoneInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="96170882233"
                  className="w-full px-2.5 py-2 bg-stone-50 focus:bg-white border border-stone-300 rounded-e-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20"
                />
              </div>

              <button
                onClick={() => {
                  setAdminWhishPhone(adminPhoneInput);
                  showToast(isAr ? 'تم حفظ وتحديث رقم الإدارة المعتمد بنجاح!' : 'Admin number updated successfully!');
                }}
                className="px-3.5 py-2 bg-stone-900 hover:bg-black active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                {isAr ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>

          {/* Card 2: Delivery Fee Control Card */}
          <div className="bg-white rounded-2xl border border-rose-200/90 p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-black text-stone-900">
                  {isAr ? 'سعر التوصيل الأساسي (Delivery Fee):' : 'Flat Delivery Fee Everywhere:'}
                </h2>
              </div>
              <p className="text-xs text-stone-500">
                {isAr
                  ? 'تكلفة التوصيل الموحدة لكل لبنان في حال عدم انطباق التوصيل المجاني.'
                  : 'Base flat delivery fee applied when order does not qualify for free shipping.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center flex-1 min-w-0" dir="ltr">
                <span className="bg-stone-100 text-stone-600 px-2.5 py-2 border border-e-0 border-stone-300 rounded-s-xl text-xs font-mono font-bold">
                  $ USD
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(normalizeDigits(e.target.value))}
                  placeholder="3.00"
                  className="w-full px-2.5 py-2 bg-stone-50 focus:bg-white border border-stone-300 rounded-e-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-800/20"
                />
              </div>

              <button
                onClick={() => {
                  const cleaned = normalizeDigits(deliveryFeeInput);
                  const fee = parseFloat(cleaned);
                  if (isNaN(fee) || fee < 0) {
                    alert(isAr ? 'يرجى إدخال مبلغ صحيح للتوصيل' : 'Please enter a valid delivery fee');
                    return;
                  }
                  setDeliveryFee(fee);
                  showToast(isAr ? `تم تحديث سعر التوصيل الموحد إلى $${fee.toFixed(2)} بنجاح!` : `Delivery fee updated to $${fee.toFixed(2)}!`);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                {isAr ? 'حفظ السعر' : 'Save'}
              </button>
            </div>
          </div>

          {/* Card 3: Free Delivery Feature (Admin Only - Toggle & Threshold) */}
          <div className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between gap-4 transition-colors ${
            freeDeliveryEnabled 
              ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border-emerald-300' 
              : 'bg-white border-stone-200'
          }`}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${freeDeliveryEnabled ? 'text-emerald-600' : 'text-stone-400'}`} />
                  <h2 className="text-sm font-black text-stone-900">
                    {isAr ? 'التوصيل المجاني (فقط عند الآدمن):' : 'Free Delivery (Admin Only):'}
                  </h2>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  freeDeliveryEnabled 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                }`}>
                  {freeDeliveryEnabled ? (isAr ? 'مفعل الآن ✅' : 'Active ✅') : (isAr ? 'معطل ⏸️' : 'Disabled ⏸️')}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {isAr
                  ? 'شغّل أو أوقف ميزة التوصيل المجاني وحدد الحد الأدنى للطلب.'
                  : 'Enable or disable free delivery and set the minimum cart order amount.'}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Toggle Button */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200 shadow-2xs">
                <span className="text-xs font-bold text-stone-800">
                  {isAr ? 'تشغيل التوصيل المجاني:' : 'Free Delivery Mode:'}
                </span>
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => {
                    const nextVal = !freeDeliveryEnabled;
                    setFreeDeliveryEnabledState(nextVal);
                    setFreeDeliveryEnabled(nextVal);
                    showToast(isAr 
                      ? (nextVal ? `تم تفعيل التوصيل المجاني للطلبات فوق $${freeDeliveryThresholdInput}!` : 'تم إيقاف ميزة التوصيل المجاني!') 
                      : (nextVal ? `Free delivery enabled for orders over $${freeDeliveryThresholdInput}!` : 'Free delivery feature disabled!'));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    freeDeliveryEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      freeDeliveryEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Threshold input + Save Button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center flex-1 min-w-0" dir="ltr">
                  <span className="bg-stone-100 text-stone-700 px-3 py-2.5 border border-e-0 border-stone-300 rounded-s-xl text-xs font-mono font-bold shrink-0">
                    $ فوق
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={freeDeliveryThresholdInput}
                    onChange={(e) => setFreeDeliveryThresholdInput(normalizeDigits(e.target.value))}
                    placeholder="30"
                    className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-e-xl text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const cleaned = normalizeDigits(freeDeliveryThresholdInput);
                    const thresh = parseFloat(cleaned);
                    if (isNaN(thresh) || thresh < 0) {
                      alert(isAr ? 'يرجى إدخال حد أدنى صالح للمبلغ' : 'Please enter a valid threshold amount');
                      return;
                    }
                    setFreeDeliveryThreshold(thresh);
                    setFreeDeliveryThresholdInput(thresh.toString());
                    showToast(isAr 
                      ? `تم حفظ الحد الأدنى للتوصيل المجاني: $${thresh.toFixed(2)} بنجاح!` 
                      : `Free delivery threshold saved: $${thresh.toFixed(2)}!`);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{isAr ? 'حفظ الحد' : 'Save'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن متجر، مدينة، هاتف...' : 'Search boutique, city, phone, handle...'}
              className="w-full ps-9 pe-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isAr ? `كل المتاجر (${isDashboardDataLoading ? '...' : vendors.length})` : `All Stores (${isDashboardDataLoading ? '...' : vendors.length})`}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isAr ? `قيد الانتظار (${isDashboardDataLoading ? '...' : pendingCount})` : `Pending (${isDashboardDataLoading ? '...' : pendingCount})`}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'active' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isAr ? `نشط (${isDashboardDataLoading ? '...' : activeCount})` : `Active (${isDashboardDataLoading ? '...' : activeCount})`}
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'suspended' ? 'bg-white text-rose-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isAr ? `موقوف (${isDashboardDataLoading ? '...' : suspendedCount})` : `Suspended (${isDashboardDataLoading ? '...' : suspendedCount})`}
            </button>
          </div>
        </div>

        {/* Vendors Table / List */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 text-start">
                    {isAr ? 'المتجر وحسابات التواصل' : 'BOUTIQUE & SOCIALS'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {isAr ? 'المدينة وعنوان الاستلام' : 'CITY & PICKUP ADDRESS'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {isAr ? 'رقم الواتساب' : 'WhatsApp Contact'}
                  </th>
                  <th className="py-3.5 px-4 text-center">
                    {isAr ? 'الحالة' : 'Status'}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {isAr ? 'نسبة العمولة (تضاف على السعر)' : 'Added Commission %'}
                  </th>
                  <th className="py-3.5 px-4 text-end">
                    {isAr ? 'إجراءات الإدارة' : 'Administrative Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isDashboardDataLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400">
                      {isAr ? 'جارٍ تحميل بيانات لوحة الإدارة...' : 'Loading dashboard data...'}
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400">
                      {isAr ? 'لا يوجد متاجر تطابق معايير البحث الحالية.' : 'No boutique sellers match your filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => {
                    const currentEdit = commissionEdits[vendor.id];
                    const isEditing = currentEdit !== undefined && currentEdit !== String(vendor.commission_rate);
                    const isSaving = savingVendorId === vendor.id;

                    return (
                      <tr key={vendor.id} className="hover:bg-stone-50/60 transition-colors">
                        {/* Store Info */}
                        <td className="py-4 px-4 text-start">
                          <div className="font-bold text-stone-900 text-sm">{vendor.store_name}</div>
                          {vendor.email && (
                            <div className="text-[11px] font-mono text-amber-800 font-semibold mt-0.5" dir="ltr">
                              ✉️ {vendor.email}
                            </div>
                          )}
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1.5" dir="ltr">
                            {vendor.instagram_handle && (
                              <span className="text-stone-600 font-medium">{vendor.instagram_handle}</span>
                            )}
                            {vendor.tiktok_handle && (
                              <>
                                <span className="text-stone-300">·</span>
                                <span>{vendor.tiktok_handle}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* City & Pickup */}
                        <td className="py-4 px-4 max-w-xs text-start">
                          <div className="font-semibold text-stone-800 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{vendor.city}</span>
                          </div>
                          <div className="text-[11px] text-stone-500 truncate mt-0.5" title={vendor.pickup_address}>
                            {vendor.pickup_address}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-4 font-mono text-stone-700 text-start" dir="ltr">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>+{vendor.phone}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          {vendor.status === 'active' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{isAr ? 'نشط' : 'Active'}</span>
                            </span>
                          )}
                          {vendor.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{isAr ? 'قيد الانتظار' : 'Pending Review'}</span>
                            </span>
                          )}
                          {vendor.status === 'suspended' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>{isAr ? 'موقوف' : 'Suspended'}</span>
                            </span>
                          )}
                        </td>

                        {/* Inline Commission Rate Editor */}
                        <td className="py-4 px-4 text-start">
                          <div className="flex items-center gap-2">
                            <div className="relative w-24">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={currentEdit !== undefined ? currentEdit : vendor.commission_rate}
                                onChange={(e) => handleCommissionChange(vendor.id, e.target.value)}
                                className="w-full ps-2.5 pe-6 py-1.5 text-xs font-mono font-bold bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 text-stone-900"
                              />
                              <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-mono">
                                %
                              </span>
                            </div>

                            {isEditing && (
                              <button
                                onClick={() => handleSaveCommission(vendor.id)}
                                disabled={isSaving}
                                className="p-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-md transition-colors cursor-pointer"
                                title={isAr ? 'حفظ نسبة العمولة' : 'Save Commission Rate'}
                              >
                                {isSaving ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 mt-1 block">
                            {isAr ? 'تُقتطع قبل تحويل أرباح التاجر' : 'Deducted before vendor payout'}
                          </span>
                        </td>

                        {/* Actions: 1-Click Approve / Suspend */}
                        <td className="py-4 px-4 text-end">
                          <div className="flex items-center justify-end gap-2">
                            {vendor.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateStatus(vendor.id, 'active')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isAr ? 'موافقة' : 'Approve Store'}</span>
                              </button>
                            )}

                            {vendor.status === 'active' && (
                              <button
                                onClick={() => handleUpdateStatus(vendor.id, 'suspended')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-md border border-rose-200 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>{isAr ? 'إيقاف' : 'Suspend'}</span>
                              </button>
                            )}

                            {vendor.status === 'suspended' && (
                              <button
                                onClick={() => handleUpdateStatus(vendor.id, 'active')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{isAr ? 'إعادة تفعيل' : 'Reactivate'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteVendor(vendor)}
                              disabled={deletingVendorId === vendor.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100 rounded-md border border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                              title={isAr ? 'حذف صفحة المتجر' : 'Delete store page'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{deletingVendorId === vendor.id ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : (isAr ? 'حذف' : 'Delete')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Flow Architecture Card - Fully Translated */}
        <div className="bg-stone-100/80 border border-stone-200 rounded-xl p-5 text-stone-700 text-xs space-y-3">
          <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              {isAr
                ? 'قواعد بنية الإدارة العليا ونظام تحويل الطلبيات عبر واتساب:'
                : 'Super Admin & WhatsApp Order Routing Rules:'}
            </span>
          </div>

          <ul className="list-disc list-inside space-y-2 text-stone-600 leading-relaxed">
            <li>
              {isAr ? (
                <>
                  <strong>عزل بيانات المتاجر:</strong> لا يمكن لأي متجر الوصول إلى جدول الطلبيات الرئيسي (<code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">orders</code>). عند تثبيت الطلب، تتلقى الإدارة تفاصيل الطلب وتوجه للمتجر رسالة معزولة تتضمن فقط أصنافه مع رمز الاستلام الآمن (<code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">pickup_code</code>).
                </>
              ) : (
                <>
                  <strong>Vendor Isolation:</strong> Vendors never access the master <code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">orders</code> table. When an order is placed, admin receives the order and forwards isolated messages to each vendor containing ONLY their items and secure <code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">pickup_code</code>.
                </>
              )}
            </li>
            <li>
              {isAr ? (
                <>
                  <strong>ضمان الخصوصية التامة:</strong> لا يتلقى التاجر رقم هاتف العميل أو عنوانه الشخصي إطلاقاً. يقوم سائق المنصة المعتمد باستلام البضاعة بالاعتماد على رمز الاستلام فقط ثم يسلمها للعميل مع تحصيل الكاش (COD).
                </>
              ) : (
                <>
                  <strong>Privacy Guarantee:</strong> Vendors never receive the customer's phone number or address. The central platform courier picks up using the pickup code and delivers to the customer for COD.
                </>
              )}
            </li>
            <li>
              {isAr ? (
                <>
                  <strong>نسبة العمولة المضافة على السعر:</strong> تُضاف نسبة العمولة تلقائياً فوق السعر المطلوب للمتجر: <code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">سعر البيع للزبون = سعر المتجر + العمولة | مستحقات المتجر = كامل سعره الأساسي (100%)</code>.
                </>
              ) : (
                <>
                  <strong>Markup Commission Added to Price:</strong> Added automatically on top of vendor price: <code className="text-stone-800 bg-stone-200/60 px-1 py-0.5 rounded font-mono">customer_price = vendor_price + commission | vendor_payout = 100% vendor price</code>.
                </>
              )}
            </li>
          </ul>
        </div>

        {/* Categories & Visual Stories Manager Modal */}
        <CategoriesManagerModal
          isOpen={isCategoriesModalOpen}
          onClose={() => setIsCategoriesModalOpen(false)}
        />
      </main>
    </div>
  );
}
