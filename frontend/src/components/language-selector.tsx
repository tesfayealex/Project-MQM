"use client"

import React, { useState } from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/contexts/language-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'

type Language = {
  code: string
  name: string
}

export function LanguageSelector() {
  const { t } = useTranslation('common')
  const { locale, changeLanguage } = useLanguage()
  const { state } = useSidebar()
  const { toast } = useToast()
  const [changing, setChanging] = useState(false)
  const isCollapsed = state === 'collapsed'

  const languages: Language[] = [
    { code: 'en', name: t('languages.en') },
    { code: 'fr', name: t('languages.fr') },
    { code: 'es', name: t('languages.es') },
    { code: 'de', name: t('languages.de') }
  ]

  const handleLanguageChange = async (newLocale: string) => {
    if (newLocale === locale) {
      console.log(`[LANGUAGE-SELECTOR] Language already set to ${newLocale}, ignoring change`);
      return;
    }
    
    if (changing) {
      console.log(`[LANGUAGE-SELECTOR] Language change already in progress, ignoring`);
      return;
    }
    
    try {
      console.log(`[LANGUAGE-SELECTOR] Changing language from ${locale} to ${newLocale}`);
      setChanging(true);
      
      // Show toast to indicate language change is in progress
      toast({
        title: "Changing language",
        description: `Switching to ${languages.find(lang => lang.code === newLocale)?.name}...`,
        duration: 3000
      });
      
      // Attempt to change language
      await changeLanguage(newLocale);
      
      // Note: We won't reach this point if the page reloads
      setChanging(false);
    } catch (error) {
      console.error(`[LANGUAGE-SELECTOR] Error changing language:`, error);
      setChanging(false);
      
      // Show error toast
      toast({
        title: "Error",
        description: "Failed to change language. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2",
      isCollapsed && "justify-center"
    )}>
      {!isCollapsed && (
        <span className="text-sm text-muted-foreground">
          {t('app.switchLanguage')}
        </span>
      )}
      
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Select
              value={locale}
              onValueChange={handleLanguageChange}
              disabled={changing}
            >
              <SelectTrigger 
                className={cn(
                  "bg-transparent border-none h-8 w-auto focus:ring-0",
                  isCollapsed && "p-0 w-8",
                  changing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCollapsed ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <>
                    <SelectValue placeholder={t('app.switchLanguage')} />
                    {changing && <span className="ml-2 animate-spin">↻</span>}
                  </>
                )}
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem 
                    key={lang.code} 
                    value={lang.code}
                    disabled={lang.code === locale || changing}
                  >
                    {lang.name} {lang.code === locale && '✓'}
                  </SelectItem>
                ))}
                {/* Debug info for development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1">
                    Current: {locale} | i18n: {t('languages.current', { locale })}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" align="center">
            {t('app.switchLanguage')}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  )
} 