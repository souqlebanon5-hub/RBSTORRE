'use client';

import React, { useState } from 'react';
import { 
  Store, 
  Lock, 
  Mail, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { signInVendor } from '@/src/lib/auth';
import { useI18n } from '@/src/lib/i18nContext';
import type { Vendor, VendorStatus } from '@/src/types/database';

interface VendorLoginProps {
  onSuccess?: (vendor: Vendor) => void;
  onNavigateSignup?: () => void;
}

export default function VendorLoginPage({ onSuccess, onNavigateSignup }: VendorLoginProps) {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status Review State if pending/suspended
  const [vendorReviewState, setVendorReviewState] = useState<{
    status: VendorStatus;
    vendor: Vendor;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signInVendor(email, password);
    setIsSubmitting(false);

    if (!result.success || !result.user?.vendor) {
      setErrorMessage(
        result.error || 
        (isAr ? 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد وكلمة المرور.' : 'Invalid merchant credentials.')
      );
      return;
    }

    const vendor = result.user.vendor;
    const status = result.vendorStatus || vendor.status;

    // Restrict access to /vendor/dashboard until Super Admin approves to 'active'
    if (status !== 'active') {
      setVendorReviewState({ status, vendor });
      return;
    }

    if (onSuccess) {
      onSuccess(vendor);
    } else {
      window.location.href = '/vendor/dashboard';
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-stone-50 via-white to-stone-100 py-12 px-4 sm:px-6 text-stone-900 flex items-center justify-center text-start" dir={dir}>
      <div className="max-w-md w-full">
        {/* Header Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200/80 mb-3 shadow-2xs">
            <Store className="w-3.5 h-3.5" />
            <span>{isAr ? 'RB Store · بوابة المتاجر' : 'RB Store · Merchant Portal'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-950">
            {isAr ? 'تسجيل دخول المتجر' : 'Boutique Partner Login'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-sm mx-auto">
            {isAr 
              ? 'متابعة وإدارة طلبياتك، ورموز الاستلام، وأرباحك المباشرة.'
              : 'Access your fulfillment queue, pickup codes, and payout reports.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/60 border border-stone-200/90 p-6 sm:p-8">
          {vendorReviewState ? (
            /* Restricted Status Gate */
            <div className="text-center py-4 space-y-4">
              {vendorReviewState.status === 'pending' && (
                <>
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                    <Clock className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {isAr ? 'حالة الحساب: قيد مراجعة الإدارة' : 'Account Status: Pending Approval'}
                  </h2>
                  <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                    {isAr 
                      ? `متجر "${vendorReviewState.vendor.store_name}" قيد التحقق حالياً من إدارة RB Store. ستتاح لك لوحة التحكم فور اعتماد المتجر.`
                      : `Store "${vendorReviewState.vendor.store_name}" is currently pending verification. Full dashboard access will unlock immediately once approved.`}
                  </p>
                </>
              )}

              {vendorReviewState.status === 'suspended' && (
                <>
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
                    <XCircle className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {isAr ? 'الحساب متوقف مؤقتاً' : 'Store Suspended'}
                  </h2>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {isAr 
                      ? 'تم إيقاف هذا الحساب مؤقتاً. يرجى التواصل مع إدارة RB Store عبر الواتساب لإعادة التفعيل.'
                      : 'This boutique account is currently suspended. Please contact platform logistics support via WhatsApp to reactivate.'}
                  </p>
                </>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSubmitting(true);
                    const res = await signInVendor(email, password);
                    setIsSubmitting(false);
                    if (res.success && res.user?.vendor && (res.vendorStatus === 'active' || res.user.vendor.status === 'active')) {
                      if (onSuccess) onSuccess(res.user.vendor);
                      else window.location.href = '/vendor/dashboard';
                    } else if (res.vendorStatus) {
                      setVendorReviewState({ status: res.vendorStatus, vendor: res.user?.vendor || vendorReviewState.vendor });
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                >
                  {isSubmitting ? (isAr ? 'جارِ التحقق...' : 'Checking...') : (isAr ? '🔄 إعادة فحص حالة الاعتماد الآن' : '🔄 Check Approval Status Now')}
                </button>

                <button
                  type="button"
                  onClick={() => setVendorReviewState(null)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-black font-semibold cursor-pointer py-1"
                >
                  <span>{isAr ? '← العودة لتسجيل الدخول' : '← Back to Login'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 text-start">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  <span>{isAr ? 'اسم المتجر أو البريد الإلكتروني' : 'Store Name or Email'}</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAr ? 'اسم المتجر أو البريد الإلكتروني' : 'Store name or email'}
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-900 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>{isAr ? 'جارِ التحقق...' : 'Verifying...'}</span>
                ) : (
                  <>
                    <span>{isAr ? 'تسجيل الدخول إلى المتجر' : 'Sign In to Boutique'}</span>
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Link to Register Store */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onNavigateSignup ? onNavigateSignup() : window.location.href = '/vendor/signup'}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-950 font-bold transition-colors cursor-pointer"
          >
            <span>{isAr ? 'ليس لديك حساب متجر؟ سجّل متجرك في RB Store' : "Don't have a boutique account? Register on RB Store"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
