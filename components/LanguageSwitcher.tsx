'use client';

import React, { useTransition } from 'react';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  currentLocale?: 'ar' | 'en';
  onLocaleChange?: (locale: 'ar' | 'en') => void;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLocale = 'ar',
  onLocaleChange,
  className = ''
}) => {
  const [isPending, startTransition] = useTransition();

  const handleSelectLocale = (targetLocale: 'ar' | 'en') => {
    if (targetLocale === currentLocale) return;

    if (onLocaleChange) {
      startTransition(() => {
        onLocaleChange(targetLocale);
      });
      return;
    }

    // Next.js client-side route transition if next-intl router is active in DOM
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const segments = currentPath.split('/').filter(Boolean);
      
      if (segments[0] === 'ar' || segments[0] === 'en') {
        segments[0] = targetLocale;
      } else {
        segments.unshift(targetLocale);
      }
      
      const newPath = '/' + segments.join('/') + window.location.search;
      window.location.href = newPath;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-stone-100/90 border border-stone-200/80 rounded-xl text-xs ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <div className="flex items-center gap-1 px-1.5 text-stone-500 hidden sm:flex">
        <Globe className="w-3.5 h-3.5 text-stone-400" />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() => handleSelectLocale('ar')}
        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
          currentLocale === 'ar'
            ? 'bg-white text-stone-900 shadow-xs font-bold border border-stone-200/60'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
        }`}
        aria-pressed={currentLocale === 'ar'}
      >
        العربية
      </button>

      <span className="text-stone-300 text-[10px]" aria-hidden="true">|</span>

      <button
        type="button"
        disabled={isPending}
        onClick={() => handleSelectLocale('en')}
        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
          currentLocale === 'en'
            ? 'bg-white text-stone-900 shadow-xs font-bold border border-stone-200/60'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
        }`}
        aria-pressed={currentLocale === 'en'}
      >
        English
      </button>
    </div>
  );
};

export default LanguageSwitcher;
