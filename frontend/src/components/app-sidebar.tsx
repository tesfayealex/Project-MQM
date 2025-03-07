"use client"

import { BarChart, ClipboardList, Home, LogOut, Settings, Users } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from 'react-i18next'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LanguageSelector } from "@/components/language-selector"

interface User {
  name?: string | null
  email?: string | null
  image?: string | null
  groups?: Array<{
    id: number
    name: string
  }>
}

// Menu items with role-based access
const items = [
  {
    titleKey: "sidebar.dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["Admin", "Organizer", "Moderator"],
  },
  {
    titleKey: "sidebar.surveys",
    url: "/dashboard/surveys",
    icon: ClipboardList,
    roles: ["Admin", "Organizer", "Moderator"],
  },
  // {
  //   titleKey: "sidebar.analytics",
  //   url: "/dashboard/analytics",
  //   icon: BarChart,
  //   roles: ["Admin", "Organizer", "Moderator"],
  // },
  {
    titleKey: "sidebar.users",
    url: "/dashboard/users",
    icon: Users,
    roles: ["Admin", "Organizer"],
  },
  {
    titleKey: "sidebar.settings",
    url: "/dashboard/settings",
    icon: Settings,
    roles: ["Admin", "Organizer", "Moderator"],
  },
]

export function AppSidebar() {
  const { data: session, status } = useSession()
  const { t } = useTranslation('common')
  const userGroups = session?.user?.groups || []
  const userRoles = userGroups.map(group => group.name)
  const pathname = usePathname()
  const { state } = useSidebar()

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <ClipboardList className="h-5 w-5 shrink-0" />
                <span className="overflow-hidden text-lg font-semibold transition-all duration-300 group-[[data-state=collapsed]]:w-0 group-[[data-state=collapsed]]:opacity-0">
                  {t('app.name')}
                </span>
              </div>
              <SidebarTrigger className="h-8 w-8 p-0 shrink-0" />
            </div>
            <SidebarSeparator />
            <SidebarGroupContent>
              <SidebarMenu>
                <div className="animate-pulse space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded-md bg-muted"></div>
                  ))}
                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    )
  }

  // Filter menu items based on user roles
  const filteredItems = items.filter(item => 
    item.roles.some(role => userRoles.includes(role))
  )

  console.log("filteredItems")
  console.log(filteredItems)
  console.log(userRoles)
  console.log(session)

  const handleLogout = async () => {
    try {
      // First, call Django logout endpoint
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Then call NextAuth signOut
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Error during logout:', error);
      // Still try to sign out from NextAuth even if Django logout fails
      await signOut({ callbackUrl: '/login' });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col justify-between h-full">
        <SidebarGroup>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardList className="h-5 w-5 shrink-0" />
              <span className={cn(
                "overflow-hidden text-lg font-semibold transition-all duration-300",
                state === "collapsed" && "w-0 opacity-0"
              )}>
                {t('app.name')}
              </span>
            </div>
            <SidebarTrigger className="h-8 w-8 p-0 shrink-0" />
          </div>
          <SidebarSeparator />
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={item.url} passHref legacyBehavior>
                        <SidebarMenuButton
                          className={cn(
                            "flex items-center gap-3",
                            pathname === item.url && "bg-accent text-accent-foreground",
                            state === "collapsed" && "justify-center"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className={cn(
                            "overflow-hidden transition-all duration-300",
                            state === "collapsed" && "w-0 opacity-0"
                          )}>
                            {t(item.titleKey)}
                          </span>
                        </SidebarMenuButton>
                      </Link>
                    </TooltipTrigger>
                    {state === "collapsed" && (
                      <TooltipContent side="right" align="center">
                        {t(item.titleKey)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarFooter className="mt-auto">
          <LanguageSelector />
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton 
                    onClick={handleLogout}
                    className={cn(
                      "flex items-center gap-3 text-destructive hover:bg-destructive/10",
                      state === "collapsed" && "justify-center"
                    )}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className={cn(
                      "overflow-hidden transition-all duration-300",
                      state === "collapsed" && "w-0 opacity-0"
                    )}>
                      {t('sidebar.logout')}
                    </span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" align="center">
                    {t('sidebar.logout')}
                  </TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  )
}
