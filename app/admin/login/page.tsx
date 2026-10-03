'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  KeyRound, 
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { signInSuperAdmin } from '@/src/lib/auth';
import { useI18n } from '@/src/lib/i18nContext';

interface AdminLoginProps {
  onSuccess?: () => void;
  onNavigateVendor?: () => void;
}

export default function AdminLoginPage({ onSuccess, onNavigateVendor }: AdminLoginProps) {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signInSuperAdmin(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(
        result.error || 
        (isAr ? 'تم رفض الوصول: يتطلب تسجيل الدخول بحساب إدارة عليا صالح.' : 'Access Denied: Super Admin credentials required.')
      );
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      window.location.href = '/admin/vendors';
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-stone-50 via-white to-stone-100 py-12 px-4 sm:px-6 text-stone-900 flex items-center justify-center text-start" dir={dir}>
      <div className="max-w-md w-full">
        {/* Header Icon & Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-rose-500/10 via-amber-500/10 to-rose-500/20 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-rose-200/80 shadow-xs">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-950">
            {isAr ? 'لوحة تحكم RB Store' : 'RB Store Admin Console'}
          </h1>
          <p className="text-xs text-stone-500 mt-1.5 max-w-sm mx-auto">
            {isAr 
              ? 'دخول محمي: تحقق من صلاحيات الإدارة العليا والتحكم بالشبكة.'
              : 'Restricted access: Super Admin authentication & RBAC check.'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/60 border border-stone-200/90 p-6 sm:p-8">
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 text-start">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>{isAr ? 'اسم المستخدم أو البريد الإلكتروني للمسؤول' : 'Admin Username or Email'}</span>
              </label>
              <input
                type="text"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or email address'}
                className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-950 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-950/10 transition-colors font-mono"
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
                className="w-full px-3.5 py-2.5 bg-stone-50/60 hover:bg-stone-50 focus:bg-white border border-stone-300 focus:border-stone-950 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-950/10 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:opacity-95 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{isAr ? 'جارِ التحقق من الصلاحيات...' : 'Verifying Role Permissions...'}</span>
              ) : (
                <>
                  <span>{isAr ? 'تسجيل الدخول كإدارة عليا' : 'Sign In as Super Admin'}</span>
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Switcher back to Vendor Login */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onNavigateVendor ? onNavigateVendor() : window.location.href = '/vendor/login'}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 font-bold transition-colors cursor-pointer"
          >
            <span>{isAr ? '← التبديل إلى تسجيل دخول المتاجر' : '← Switch to Store Login'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
