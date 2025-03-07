"use client"

import { useState, useEffect, useRef } from "react"
import { BarChart, Users, ClipboardList, TrendingUp } from "lucide-react"
import { getDashboardStats, DashboardStats } from "@/lib/services/dashboard-service"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslation } from "react-i18next"

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { status, data: session } = useSession()
  const { t } = useTranslation('dashboard')
  // Track attempts to prevent loops
  const fetchAttempts = useRef(0)
  const hasShownError = useRef(false)

  useEffect(() => {
    // Clear error state when session changes
    setError(null);
    
    // Only fetch if the user is authenticated and we haven't tried more than 2 times
    if (status === "authenticated" && fetchAttempts.current < 2) {
      // Wait a moment to ensure session is properly set up
      const timer = setTimeout(() => {
        fetchStats();
      }, 500);
      
      return () => clearTimeout(timer);
    } else if (status === "unauthenticated") {
      console.log("User is not authenticated, redirecting to login");
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchStats = async () => {
    try {
      // Increment attempt counter to limit retries
      fetchAttempts.current += 1;
      console.log(`Fetching stats (attempt ${fetchAttempts.current})`);
      
      // Additional logging to check authentication state
      if (session?.user) {
        console.log(`Authenticated as user ID: ${session.user.id}`);
        console.log(`Current cookies: ${typeof document !== 'undefined' ? document.cookie : 'N/A'}`);
      } else {
        console.warn("Session exists but no user data found");
      }
      
      setLoading(true);
      const data = await getDashboardStats();
      
      console.log("Successfully fetched dashboard stats:", data);
      setStats(data);
      setError(null);
      
      // Success! Reset error flag
      hasShownError.current = false;
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      
      // Only show error toast once to prevent error loops
      if (!hasShownError.current) {
        if (err.status === 401 || err.status === 403) {
          // Authentication error - add specific handling
          console.log("Authentication error fetching stats:", err.message);
          
          if (fetchAttempts.current >= 2) {
            // If we've already retried, show an error to the user
            setError(t("Unable to load dashboard data. Please try logging out and back in."));
          }
        } else {
          setError(err.message || t('Failed to fetch dashboard stats'));
          toast({
            variant: "destructive",
            title: t("Error loading dashboard"),
            description: err.message || t('Failed to fetch dashboard stats'),
          });
        }
        // Mark that we've shown an error to the user
        hasShownError.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  // If we've had multiple auth failures but session seems valid, show a refresh option
  const handleManualRefresh = () => {
    fetchAttempts.current = 0;
    hasShownError.current = false;
    setError(null);
    fetchStats();
  };

  // Show loading state while session status is being determined
  if (status === "loading") {
    return (
      <div className="space-y-6 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-muted-foreground">{t('loading_session', 'Loading session...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-muted-foreground">
            {t('welcome')}
          </p>
        </div>
        
        {error && (
          <button
            onClick={handleManualRefresh}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            {t('retry_loading', 'Retry Loading')}
          </button>
        )}
      </div>
      
      <div className="grid w-full gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('surveys.title')}</div>
              <div className="mt-2 text-2xl font-bold">{loading ? "-" : stats?.total_surveys || 0}</div>
            </div>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          {!loading && stats?.user_growth_rate && (
            <div className="mt-4 flex items-center text-sm text-green-500">
              <TrendingUp className="mr-1 h-4 w-4" />
              <span>+{stats.user_growth_rate}% {t('from_last_month', 'from last month')}</span>
            </div>
          )}
        </div>
        {session?.user?.groups?.some(group => group.name === 'Admin') && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('total_users', 'Total Users')}</div>
                <div className="mt-2 text-2xl font-bold">{loading ? "-" : stats?.total_users || 0}</div>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            {!loading && stats?.user_growth_rate && (
              <div className="mt-4 flex items-center text-sm text-green-500">
                <TrendingUp className="mr-1 h-4 w-4" />
                <span>+{stats.user_growth_rate}% {t('from_last_month', 'from last month')}</span>
              </div>
            )}
          </div>
        )}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('analytics.responses', 'Total Responses')}</div>
              <div className="mt-2 text-2xl font-bold">{loading ? "-" : stats?.total_responses || 0}</div>
            </div>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </div>
          {!loading && stats?.user_growth_rate && (
            <div className="mt-4 flex items-center text-sm text-green-500">
              <TrendingUp className="mr-1 h-4 w-4" />
              <span>+{stats.user_growth_rate}% {t('from_last_month', 'from last month')}</span>
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('analytics.completion', 'Completion Rate')}</div>
              <div className="mt-2 text-2xl font-bold">
                {loading ? "-" : `${stats?.survey_completion_rate || 0}%`}
              </div>
            </div>
            <div className="h-4 w-4 text-muted-foreground">%</div>
          </div>
          {!loading && stats?.user_growth_rate && (
            <div className="mt-4 flex items-center text-sm text-green-500">
              <TrendingUp className="mr-1 h-4 w-4" />
              <span>+{stats.user_growth_rate}% {t('from_last_month', 'from last month')}</span>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      
      {loading && status === "authenticated" && (
        <div className="rounded-lg border p-4 text-sm">
          {t('loading_data', 'Loading dashboard data...')}
        </div>
      )}
      
      {!loading && stats?.recent_activity && stats.recent_activity.length > 0 && (
        <div className="rounded-lg border w-full">
          <div className="p-6">
            <h2 className="text-lg font-semibold">{t('recent', 'Recent Activity')}</h2>
            <div className="mt-4 space-y-4">
              {stats.recent_activity.map((activity, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="rounded-full bg-muted p-2">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 