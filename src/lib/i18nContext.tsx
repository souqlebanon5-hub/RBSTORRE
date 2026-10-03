import React, { createContext, useContext, useState, useEffect } from 'react';
import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';

export type Locale = 'ar' | 'en';

type MessagesType = typeof enMessages;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: 'rtl' | 'ltr';
  t: (path: string, params?: Record<string, string | number>) => string;
  messages: MessagesType;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLocale?: Locale }> = ({
  children,
  initialLocale = 'ar'
}) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
  }, [locale]);

  const messages = (locale === 'ar' ? arMessages : enMessages) as MessagesType;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // Deep dot-notation path resolver with parameter interpolation: t('cart.itemsCount', { count: 3 })
  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = messages;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return path;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    let text = current;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }

    return text;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, dir, t, messages }}>
      <div dir={dir} className={locale === 'ar' ? 'font-arabic' : 'font-sans'}>
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    // Graceful fallback for standalone routes (defaults to Arabic RTL)
    return {
      locale: 'ar',
      setLocale: () => {},
      dir: 'rtl',
      t: (path: string, params?: Record<string, string | number>): string => {
        const keys = path.split('.');
        let current: any = arMessages;
        for (const key of keys) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            return path;
          }
        }
        if (typeof current !== 'string') return path;
        let text = current;
        if (params) {
          Object.entries(params).forEach(([paramKey, paramVal]) => {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
          });
        }
        return text;
      },
      messages: arMessages as MessagesType
    };
  }
  return context;
};
