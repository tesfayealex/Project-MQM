import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/language-context';

interface SurveyStatsProps {
  surveyId: string;
}

interface SurveyStats {
  totalResponses: number;
  completionRate: number;
  averageTime: number;
  responsesByDate: {
    date: string;
    count: number;
  }[];
  responsesByDevice: {
    device: string;
    count: number;
  }[];
  responsesByLocation: {
    location: string;
    count: number;
  }[];
}

export default function SurveyStatsClient({ surveyId }: SurveyStatsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { t, i18n } = useTranslation(['surveys', 'common'], { useSuspense: false });
  const { locale: currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load translations
    i18n.loadNamespaces(['surveys', 'common']).catch(err => 
      console.error('Failed to load namespaces:', err)
    );
  }, [i18n]);

  useEffect(() => {
    // Update language when cookie changes
    const checkLanguage = () => {
      const newLocale = getCookie('NEXT_LOCALE') as string;
      if (newLocale && newLocale !== currentLanguage) {
        setCurrentLanguage(newLocale);
        i18n.changeLanguage(newLocale);
      }
    };

    const interval = setInterval(checkLanguage, 1000);
    return () => clearInterval(interval);
  }, [currentLanguage, i18n]);

  // ... existing code ...
} 