'use client';

import React, { useState } from 'react';
import { 
  Store, 
  MapPin, 
  Phone, 
  Instagram, 
  Lock, 
  Mail, 
  User, 
  Clock, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { signUpVendor } from '@/src/lib/auth';
import { useI18n } from '@/src/lib/i18nContext';
import type { Vendor } from '@/src/types/database';

interface VendorSignupProps {
  onSuccess?: (vendor: Vendor) => void;
  onNavigateLogin?: () => void;
}

export default function VendorSignupPage({ onSuccess, onNavigateLogin }: VendorSignupProps) {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Beirut (Achrafieh)');
  const [pickupAddress, setPickupAddress] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredVendor, setRegisteredVendor] = useState<Vendor | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !storeName || !phone || !pickupAddress) {
      setErrorMessage(isAr ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage(isAr ? 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' : 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signUpVendor({
      email,
      password,
      fullName,
      storeName,
      phone,
      city,
      pickupAddress,
      instagramHandle,
      tiktokHandle
    });

    setIsSubmitting(false);

    if (!result.success || !result.user?.vendor) {
      setErrorMessage(result.error || (isAr ? 'تعذر إتمام التسجيل، يرجى المحاولة ثانية.' : 'Signup failed. Please try again.'));
      return;
    }

    setRegisteredVendor(result.user.vendor);
    if (onSuccess) onSuccess(result.user.vendor);
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-stone-50 via-white to-stone-100 py-12 px-4 sm:px-6 text-stone-900 flex items-center justify-center text-start" dir={dir}>
      <div className="max-w-xl w-full">
        {/* Header Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200/80 mb-3 shadow-2xs">
            <Store className="w-3.5 h-3.5" />
            <span>{isAr ? 'RB Store · تسجيل متجر' : 'RB Store · Boutique Merchant Onboarding'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-950">
            {isAr ? 'تسجيل متجر جديد' : 'Create Your Boutique Store'}
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/60 border border-stone-200/90 p-6 sm:p-8">
          {registeredVendor ? (
            /* Pending Approval Review Gate */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-stone-900">
                {isAr ? 'طلب الانضمام قيد المراجعة' : 'Application Under Review'}
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                {isAr 
                  ? <>شكراً لانضمامك إلى RB Store، متجر <strong>{registeredVendor.store_name}</strong>! تم استلام طلبك وبانتظار اعتماد الإدارة.</>
                  : <>Thank you for joining RB Store, <strong>{registeredVendor.store_name}</strong>! Your account is set to <span className="font-bold text-amber-800 uppercase px-1">Pending Approval</span> by default.</>}
              </p>
              
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-start space-y-2 text-stone-700">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? 'خطوات التفعيل التالية:' : 'Next Steps for Merchant Activation:'}</span>
                </div>
                <p>{isAr ? '1. يقوم فريق إدارة RB Store بالتحقق من حسابك ومصداقية المنتجات.' : '1. Our RB Store admin team verifies your boutique.'}</p>
                <p>{isAr ? `2. يتم تأكيد عنوان الاستلام في (${registeredVendor.city}) لجدولة مسارات المندوبين.` : `2. We confirm your pickup address in ${registeredVendor.city} for our courier routes.`}</p>
                <p>{isAr ? '3. بمجرد التفعيل، ستصلك رسالة واتساب وستتمكن من الدخول للوحة التحكم واستقبال الطلبيات.' : '3. Once approved, you can log in to access your fulfillment queue & pickup codes.'}</p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateLogin ? onNavigateLogin() : window.location.href = '/vendor/login'}
                  className="w-full py-3.5 bg-stone-950 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {isAr ? 'الانتقال إلى تسجيل الدخول' : 'Go to Merchant Login'}
                </button>
              </div>
            </div>
          ) : (
            /* Sign-up Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-start">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Login credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span>{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-stone-400" />
                    <span>{isAr ? 'كلمة المرور' : 'Password'}</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Store & Owner details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{isAr ? 'اسم صاحب المتجر' : 'Owner Full Name'}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-stone-400" />
                    <span>{isAr ? 'اسم المتجر / العلامة التجارية' : 'Boutique / Store Name'}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                  />
                </div>
              </div>

              {/* Social Channels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-rose-500" />
                    <span>{isAr ? 'حساب إنستغرام' : 'Instagram Handle'}</span>
                  </label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    {isAr ? 'حساب تيك توك (اختياري)' : 'TikTok Handle (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={tiktokHandle}
                    onChange={(e) => setTiktokHandle(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                  />
                </div>
              </div>

              {/* Phone with Lebanese prefix */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{isAr ? 'رقم الواتساب (لاستلام إشعارات التحضير الآلية)' : 'WhatsApp Mobile (For Automated Pickup Notices)'}</span>
                </label>
                <div className="flex" dir="ltr">
                  <span className="inline-flex items-center px-3 rounded-s-xl border border-e-0 border-stone-300 bg-stone-100 text-stone-700 text-xs font-mono font-bold">
                    🇱🇧 +961
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-e-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* City and Address */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{isAr ? 'المدينة / المحافظة' : 'City / Governorate'}</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors cursor-pointer"
                >
                  <option value="Beirut (Achrafieh)">Beirut (Achrafieh) - بيروت (الأشرفية)</option>
                  <option value="Beirut (Mar Mikhael / Gemmayzeh)">Beirut (Mar Mikhael / Gemmayzeh) - مار مخايل / الجميزة</option>
                  <option value="Beirut (Hamra / Verdun)">Beirut (Hamra / Verdun) - الحمرا / فردان</option>
                  <option value="Mount Lebanon (Metn / Dbayeh)">Mount Lebanon (Metn / Dbayeh) - المتن / ضبية</option>
                  <option value="Mount Lebanon (Keserwan / Jounieh)">Mount Lebanon (Keserwan / Jounieh) - كسروان / جونية</option>
                  <option value="Mount Lebanon (Chouf / Deir el Qamar)">Mount Lebanon (Chouf / Deir el Qamar) - الشوف</option>
                  <option value="North (Tripoli / Al-Mina)">North (Tripoli / Al-Mina) - طرابلس / الميناء</option>
                  <option value="North (Batroun Old Town)">North (Batroun Old Town) - البترون القديمة</option>
                  <option value="South (Sidon / Saida)">South (Sidon / Saida) - صيدا</option>
                  <option value="Bekaa (Zahle / Chtaura)">Bekaa (Zahle / Chtaura) - زحلة / شتورة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {isAr ? 'عنوان الاستلام الدقيق لمندوب التوصيل' : 'Exact Pickup Address for Courier Collection'}
                </label>
                <textarea
                  rows={2}
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:opacity-95 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>{isAr ? 'جارِ إرسال طلب المتجر...' : 'Registering Boutique Account...'}</span>
                ) : (
                  <>
                    <span>{isAr ? 'إرسال طلب تسجيل المتجر' : 'Submit Boutique Registration'}</span>
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-stone-500">
                  {isAr ? 'لديك حساب بالفعل؟ ' : 'Already registered? '}
                  <button
                    type="button"
                    onClick={() => onNavigateLogin ? onNavigateLogin() : window.location.href = '/vendor/login'}
                    className="text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    {isAr ? 'تسجيل الدخول إلى المتجر' : 'Merchant Log In'}
                  </button>
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
