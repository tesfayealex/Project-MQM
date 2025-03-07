"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { setCookie, getCookie } from 'cookies-next';
import i18n from '@/lib/i18n';

// Define supported languages
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de'];

type LanguageContextType = {
  locale: string;
  changeLanguage: (locale: string) => Promise<void>;
  forceRefresh: () => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_COOKIE = 'NEXT_LOCALE';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [locale, setLocale] = useState<string>('en');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // For debugging
  useEffect(() => {
    console.log(`[LANGUAGE-CONTEXT] Provider mounted. Current locale: ${locale}`);
    
    return () => {
      console.log(`[LANGUAGE-CONTEXT] Provider unmounted`);
    };
  }, [locale]);

  useEffect(() => {
    // Initialize from cookie or browser language
    const savedLocale = getCookie(LANGUAGE_COOKIE) as string;
    console.log(`[LANGUAGE-CONTEXT] Initial cookie locale: ${savedLocale}`);
    
    if (savedLocale && SUPPORTED_LANGUAGES.includes(savedLocale)) {
      setLocale(savedLocale);
      console.log(`[LANGUAGE-CONTEXT] Setting initial locale from cookie: ${savedLocale}`);
      i18n.changeLanguage(savedLocale).catch(err => 
        console.error('[LANGUAGE-CONTEXT] Failed to set initial language:', err)
      );
    } else {
      // Default to browser language if available and supported
      const browserLang = navigator.language.split('-')[0];
      const defaultLocale = SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
      console.log(`[LANGUAGE-CONTEXT] No cookie found. Using browser language: ${browserLang} -> ${defaultLocale}`);
      
      setLocale(defaultLocale);
      setCookie(LANGUAGE_COOKIE, defaultLocale, { maxAge: 30 * 24 * 60 * 60 }); // 30 days
      i18n.changeLanguage(defaultLocale).catch(err => 
        console.error('[LANGUAGE-CONTEXT] Failed to set default language:', err)
      );
    }
  }, []);

  // Force a refresh when counter changes
  const forceRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };

  useEffect(() => {
    if (refreshCounter > 0) {
      console.log(`[LANGUAGE-CONTEXT] Force refresh triggered (${refreshCounter})`);
    }
  }, [refreshCounter]);

  const changeLanguage = async (newLocale: string): Promise<void> => {
    if (SUPPORTED_LANGUAGES.includes(newLocale)) {
      console.log(`[LANGUAGE-CONTEXT] Changing language from ${locale} to ${newLocale}`);
      
      try {
        // Set cookie first
        setCookie(LANGUAGE_COOKIE, newLocale, { maxAge: 30 * 24 * 60 * 60 }); // 30 days
        console.log(`[LANGUAGE-CONTEXT] Cookie set: ${LANGUAGE_COOKIE}=${newLocale}`);
        
        // Update state
        setLocale(newLocale);
        
        // Load all namespaces for the new language
        console.log(`[LANGUAGE-CONTEXT] Loading namespaces for ${newLocale}`);
        await Promise.all([
          i18n.loadNamespaces('common'),
          i18n.loadNamespaces('surveys'),
          i18n.loadNamespaces('dashboard'),
          i18n.loadNamespaces('settings')
        ]);
        
        // Change language after namespaces are loaded
        console.log(`[LANGUAGE-CONTEXT] Setting i18n language to ${newLocale}`);
        await i18n.changeLanguage(newLocale);
        
        // Force a hard reload to ensure all components pick up the new language
        console.log(`[LANGUAGE-CONTEXT] Forcing page reload for language change`);
        window.location.href = window.location.href;
      } catch (err) {
        console.error('[LANGUAGE-CONTEXT] Failed to change language:', err);
        throw err;
      }
    } else {
      console.error(`[LANGUAGE-CONTEXT] Unsupported language: ${newLocale}`);
      throw new Error(`Unsupported language: ${newLocale}`);
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, forceRefresh }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 