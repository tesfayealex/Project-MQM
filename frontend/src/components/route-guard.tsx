'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from 'next-auth';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check authentication
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${pathname}`);
      return;
    }

    // Check authorization if roles are specified
    if (status === 'authenticated' && allowedRoles?.length) {
      const user = session?.user as User;
      const userGroups = user?.groups || [];
      const userRoles = userGroups.map(group => group.name);
      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router, pathname, allowedRoles]);

  // Show nothing while checking auth
  if (status === 'loading') {
    return null;
  }

  return <>{children}</>;
} 