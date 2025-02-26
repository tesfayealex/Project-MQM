"use client"

import { BarChart, ClipboardList, Home, LogOut, Settings, Users } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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

interface User {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string
}

// Menu items with role-based access
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["user", "admin", "moderator"],
  },
  {
    title: "Surveys",
    url: "/dashboard/surveys",
    icon: ClipboardList,
    roles: ["user", "admin", "moderator"],
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: BarChart,
    roles: ["user", "admin", "moderator"], //["admin", "moderator"],
  },
  {
    title: "Users",
    url: "/dashboard/users",
    icon: Users,
    roles: ["user", "admin", "moderator"], //["admin"],
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
    roles: ["user", "admin", "moderator"],
  },
]

export function AppSidebar() {
  const { data: session, status } = useSession()
  const userRole = session?.user?.role || "user"
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
                  myQuickMessage
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

  // Filter items based on user role
  const filteredItems = items.filter(item => 
    item.roles.includes(userRole)
  )

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
                myQuickMessage
              </span>
            </div>
            <SidebarTrigger className="h-8 w-8 p-0 shrink-0" />
          </div>
          <SidebarSeparator />
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
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
                            {item.title}
                          </span>
                        </SidebarMenuButton>
                      </Link>
                    </TooltipTrigger>
                    {state === "collapsed" && (
                      <TooltipContent side="right" align="center">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarFooter className="mt-auto">
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton 
                    onClick={() => signOut({ callbackUrl: '/login' })}
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
                      Logout
                    </span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" align="center">
                    Logout
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
