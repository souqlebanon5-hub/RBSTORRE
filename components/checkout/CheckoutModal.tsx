'use client';

import React, { useState } from 'react';
import { 
  X, 
  ShoppingBag, 
  ShieldCheck, 
  Truck, 
  ArrowRight, 
  ArrowLeft,
  Phone, 
  MapPin, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Store,
  Clock,
  CreditCard,
  Banknote,
  Copy,
  Check
} from 'lucide-react';
import type { CartItem, CheckoutPayload, CheckoutResponse } from '@/src/types/database';
import { useI18n } from '@/src/lib/i18nContext';
import { getAdminWhishPhone, calculateOrderDeliveryFee } from '@/src/lib/adminSettings';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onClearCart?: () => void;
  onOrderSuccess?: (response: CheckoutResponse) => void;
  customCheckoutHandler?: (payload: CheckoutPayload) => Promise<CheckoutResponse>;
}

const LEBANON_CITIES_EN = [
  'Beirut - Achrafieh',
  'Beirut - Mar Mikhael / Gemmayzeh',
  'Beirut - Hamra & Verdun',
  'Beirut - Ras Beirut',
  'Mount Lebanon - Metn (Dbayeh / Antelias)',
  'Mount Lebanon - Keserwan (Jounieh / Kaslik)',
  'Mount Lebanon - Jbeil (Byblos)',
  'Mount Lebanon - Chouf & Deir el Qamar',
  'Mount Lebanon - Baabda & Hazmieh',
  'Mount Lebanon - Aley & Bhamdoun',
  'North - Tripoli & Al-Mina',
  'North - Batroun Coastal',
  'North - Koura',
  'South - Sidon (Saida)',
  'South - Tyre (Sour)',
  'South - Nabatieh',
  'Bekaa - Zahle & Chtaura'
];

const LEBANON_CITIES_AR = [
  'بيروت - الأشرفية',
  'بيروت - مار مخايل / الجميزة',
  'بيروت - الحمرا وفردان',
  'بيروت - رأس بيروت',
  'جبل لبنان - المتن (الضبية / أنطلياس)',
  'جبل لبنان - كسروان (جونيه / الكسليك)',
  'جبل لبنان - جبيل (بيبلوس)',
  'جبل لبنان - الشوف ودير القمر',
  'جبل لبنان - بعبدا والحازمية',
  'جبل لبنان - عاليه وبحمدون',
  'الشمال - طرابلس والميناء',
  'الشمال - البترون الساحلية',
  'الشمال - الكورة',
  'الجنوب - صيدا',
  'الجنوب - صور',
  'الجنوب - النبطية',
  'البقاع - زحلة وشتورا'
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onClearCart,
  onOrderSuccess,
  customCheckoutHandler
}) => {
  const { t, locale, dir } = useI18n();

  const citiesList = locale === 'ar' ? LEBANON_CITIES_AR : LEBANON_CITIES_EN;
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState(citiesList[0]);
  const [addressDetails, setAddressDetails] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'whish'>('cod');
  const [whishSenderPhone, setWhishSenderPhone] = useState('');
  const [copiedWhish, setCopiedWhish] = useState(false);

  const adminWhishPhone = getAdminWhishPhone();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<CheckoutResponse | null>(null);

  if (!isOpen) return null;

  const isRtl = dir === 'rtl';
  const isAr = locale === 'ar';
  const vendorsInCart = Array.from(new Set(items.map(item => item.vendorName)));
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const { deliveryFee, isFreeDeliveryUnlocked } = calculateOrderDeliveryFee(subtotal);
  const totalAmount = subtotal + deliveryFee;
  const totalLbpApprox = Math.round(totalAmount * 89500).toLocaleString(locale === 'ar' ? 'ar-LB' : 'en-US');

  // Input validation
  const validateForm = (): boolean => {
    if (!customerName.trim()) {
      setErrorMessage(t('checkout.validationError'));
      return false;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      setErrorMessage(t('checkout.validationError'));
      return false;
    }
    if (!addressDetails.trim()) {
      setErrorMessage(t('checkout.validationError'));
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (items.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: CheckoutPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      city,
      address_details: addressDetails.trim(),
      delivery_notes: deliveryNotes.trim() || undefined,
      payment_method: paymentMethod,
      whish_sender_phone: paymentMethod === 'whish' ? (whishSenderPhone.trim() || undefined) : undefined,
      items
    };

    try {
      let data: CheckoutResponse;

      if (customCheckoutHandler) {
        data = await customCheckoutHandler(payload);
      } else {
        const response = await fetch('/api/orders/checkout-and-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Checkout failed (${response.status})`);
        }

        data = await response.json();
      }

      setCompletedOrder(data);
      if (onOrderSuccess) onOrderSuccess(data);
      if (onClearCart) onClearCart();

      // Open WhatsApp link safely
      if (data.adminWhatsAppUrl) {
        try {
          window.location.href = data.adminWhatsAppUrl;
        } catch (navErr) {
          console.log('Direct navigation handled in UI', navErr);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not complete order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      dir={dir}
    >
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Vibrant Accent Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 shrink-0" />

        {/* Header */}
        <div className="px-6 py-4.5 border-b border-stone-100 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide bg-gradient-to-r from-rose-50 to-pink-50 text-[#FF2A6D] border border-rose-200/80">
                <Truck className="w-3 h-3" />
                {t('checkout.headerBadge')}
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-xs font-bold text-stone-500">{t('common.cashOnDelivery')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              {completedOrder ? t('checkout.successTitle') : t('checkout.headerTitle')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-start">
          {completedOrder ? (
            /* Post-Checkout Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-stone-100 rounded-full text-xs font-mono font-bold tracking-wider text-stone-700 mb-2">
                  {t('checkout.orderRef')} {completedOrder.orderNumber}
                </span>
                <h3 className="text-2xl font-black text-stone-900">
                  {t('checkout.successTitle')}
                </h3>
                <p className="text-sm font-medium text-stone-600 mt-2 max-w-sm mx-auto leading-relaxed">
                  {t('checkout.successSubtitle', { vendorCount: completedOrder.vendorDispatchesCount })}
                </p>
              </div>

              {/* Order summary box */}
              <div className="bg-gradient-to-br from-stone-50 to-rose-50/30 rounded-2xl p-4.5 text-start border border-rose-100 space-y-2 text-sm shadow-2xs">
                <div className="flex justify-between text-stone-600 font-medium">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-mono font-bold tabular-nums text-stone-900">${completedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600 font-medium">
                  <span>{t('cart.delivery')}</span>
                  <span className="font-mono font-bold tabular-nums text-stone-900">${completedOrder.deliveryFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-stone-200 pt-2.5 flex justify-between font-black text-stone-900 text-base">
                  <span>{t('cart.totalDue')}</span>
                  <span className="font-mono text-xl font-black text-[#FF2A6D]">
                    ${completedOrder.totalAmount.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* WhatsApp Redirection Link Button */}
              <div className="pt-2">
                <a
                  href={completedOrder.adminWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4 fill-white" />
                  <span>{t('checkout.openWhatsAppAdmin')}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : (
            /* Order Input & Review Form */
            <form onSubmit={handleCheckout} className="space-y-4">
              {/* Consolidation Banner (Vibrant & Beautiful matching storefront) */}
              <div className="bg-gradient-to-r from-rose-50/90 via-pink-50/60 to-purple-50/40 border border-rose-200/90 rounded-2xl p-4 flex items-start gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-rose-100 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-[#FF2A6D]" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF2A6D] block mb-0.5">
                    {locale === 'ar' ? 'طلبية واحدة موحدة' : 'Single Consolidated Package'}
                  </span>
                  <div className="text-xs font-semibold text-stone-800 leading-relaxed">
                    {isFreeDeliveryUnlocked ? (
                      locale === 'ar' 
                        ? `🎉 أصناف من ${vendorsInCart.length} متجر ستصلك معاً بتوصيل مجاني بالكامل!` 
                        : `🎉 Items from ${vendorsInCart.length} boutique(s) will arrive together with FREE delivery!`
                    ) : (
                      t('cart.consolidationBanner', { count: vendorsInCart.length, fee: deliveryFee.toFixed(2) })
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('checkout.fullName')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('checkout.fullNamePlaceholder')}
                    className="w-full px-4 py-3 bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#FF2A6D] focus:ring-4 focus:ring-[#FF2A6D]/15 rounded-xl text-sm font-medium text-stone-900 transition-all placeholder:text-stone-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('checkout.whatsappPhone')}</span>
                  </label>
                  <div className="flex" dir="ltr">
                    <span className="inline-flex items-center px-3.5 rounded-s-xl border border-e-0 border-stone-200 bg-stone-100/90 text-stone-800 text-xs font-mono font-bold">
                      🇱🇧 +961
                    </span>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t('checkout.whatsappPhonePlaceholder')}
                      className="w-full px-4 py-3 bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#FF2A6D] focus:ring-4 focus:ring-[#FF2A6D]/15 rounded-e-xl text-sm font-medium text-stone-900 transition-all placeholder:text-stone-400 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('checkout.regionCity')}</span>
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#FF2A6D] focus:ring-4 focus:ring-[#FF2A6D]/15 rounded-xl text-sm font-semibold text-stone-900 transition-all outline-none cursor-pointer"
                  >
                    {citiesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('checkout.addressDetails')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addressDetails}
                    onChange={(e) => setAddressDetails(e.target.value)}
                    placeholder={t('checkout.addressPlaceholder')}
                    className="w-full px-4 py-3 bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#FF2A6D] focus:ring-4 focus:ring-[#FF2A6D]/15 rounded-xl text-sm font-medium text-stone-900 transition-all placeholder:text-stone-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('checkout.deliveryNotes')}</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder={t('checkout.deliveryNotesPlaceholder')}
                    className="w-full px-4 py-3 bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#FF2A6D] focus:ring-4 focus:ring-[#FF2A6D]/15 rounded-xl text-sm font-medium text-stone-900 transition-all placeholder:text-stone-400 outline-none"
                  />
                </div>
              </div>

              {/* Items Mini-Breakdown */}
              <div className="border-t border-stone-100 pt-3.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-2.5 block">
                  {t('checkout.cartItems', { count: items.length })}
                </span>
                <div className="space-y-2 max-h-36 overflow-y-auto pe-1">
                  {items.map((item, idx) => (
                    <div key={`${item.productId}-${item.variantId}-${idx}`} className="flex justify-between items-center text-xs py-1.5 px-2 rounded-lg hover:bg-stone-50 transition-colors">
                      <div className="truncate max-w-[240px]">
                        <span className="font-bold text-stone-900">{item.title}</span>
                        <span className="text-stone-300 mx-1.5">·</span>
                        <span className="text-[#FF2A6D] font-medium">{item.vendorName}</span>
                        {item.variantName && (
                          <span className="text-stone-400 block text-[11px] truncate">{item.variantName}</span>
                        )}
                      </div>
                      <div className="text-end shrink-0">
                        <span className="font-mono font-bold tabular-nums text-stone-900">
                          {item.quantity} × ${item.unitPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="border-t border-stone-100 pt-3.5 space-y-2.5">
                <label className="block text-xs font-black text-stone-800">
                  {isAr ? 'طريقة الدفع المعتمدة:' : 'Selected Payment Method:'}
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3.5 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50/40 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100/70'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'cod' ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'
                    }`}>
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-stone-900">
                        {isAr ? 'كاش عند الاستلام' : 'Cash on Delivery'}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {isAr ? 'بالدولار أو بالليرة' : 'USD or LBP'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('whish')}
                    className={`p-3.5 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${
                      paymentMethod === 'whish'
                        ? 'bg-gradient-to-br from-rose-50 to-pink-50/50 border-[#FF2A6D] ring-2 ring-[#FF2A6D]/20 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100/70'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'whish' ? 'bg-rose-100 text-[#FF2A6D]' : 'bg-stone-200 text-stone-500'
                    }`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-stone-900">
                        {isAr ? 'عبر ويش موني' : 'Whish Money'}
                      </span>
                      <span className="text-[10px] text-[#FF2A6D] font-bold">
                        {isAr ? 'حساب الإدارة' : 'Admin Whish'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Whish Instructions and Admin Phone Box */}
                {paymentMethod === 'whish' && (
                  <div className="bg-gradient-to-br from-rose-50 to-pink-50/70 border border-rose-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-rose-900 block">
                          {isAr ? 'رقم حساب ويش موني المعتمد للإدارة:' : 'Official Admin Whish Phone:'}
                        </span>
                        <span className="font-mono font-black text-rose-950 text-base tracking-wider" dir="ltr">
                          +{adminWhishPhone}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(adminWhishPhone);
                          setCopiedWhish(true);
                          setTimeout(() => setCopiedWhish(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
                      >
                        {copiedWhish ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedWhish ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ الرقم' : 'Copy')}</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-rose-950 mb-1">
                        {isAr ? 'رقم هاتفك المحول منه أو رقم العملية (اختياري للتأكيد):' : 'Sender Phone or Transfer Ref (Optional):'}
                      </label>
                      <input
                        type="text"
                        value={whishSenderPhone}
                        onChange={(e) => setWhishSenderPhone(e.target.value)}
                        placeholder={isAr ? 'مثال: 70123456 أو رقم المعاملة' : 'e.g. 70123456 or reference code'}
                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Totals (Vibrant & High-Fashion matching storefront) */}
              <div className="bg-gradient-to-br from-stone-50 via-rose-50/20 to-stone-50 rounded-2xl p-4.5 border border-stone-200/90 space-y-2 text-xs shadow-2xs">
                <div className="flex justify-between text-stone-600 font-medium">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-mono font-bold tabular-nums text-stone-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>{t('cart.delivery')}</span>
                  </span>
                  {isFreeDeliveryUnlocked ? (
                    <span className="font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full text-xs font-mono">
                      {isAr ? 'مجاني $0.00 🎉' : 'FREE $0.00 🎉'}
                    </span>
                  ) : (
                    <span className="font-mono font-bold tabular-nums text-stone-900">${deliveryFee.toFixed(2)}</span>
                  )}
                </div>
                <div className="border-t border-stone-200/90 pt-3 flex justify-between font-black text-stone-900 text-sm">
                  <span>{t('cart.totalDue')}</span>
                  <div className="text-end">
                    <span className="font-mono text-xl font-black text-[#FF2A6D] block">${totalAmount.toFixed(2)} USD</span>
                    <span className="block text-[11px] font-semibold text-stone-500 mt-0.5">~{totalLbpApprox} {t('common.lbp')}</span>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Trust Indicators */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 px-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('checkout.payUponArrival')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('checkout.consolidationGuarantee')}</span>
                </span>
              </div>

              {/* Submit Button (Vibrant & High-Conversion) */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/25 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2 text-sm">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('checkout.generatingDispatch')}</span>
                  </span>
                ) : (
                  <>
                    <Phone className="w-4 h-4 fill-white" />
                    <span>{t('checkout.confirmViaWhatsApp')}</span>
                    {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
