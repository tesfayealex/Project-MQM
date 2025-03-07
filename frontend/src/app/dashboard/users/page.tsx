'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@heroicons/react/24/outline"
import UserTableClient from './user-table-client';
import { RouteGuard } from '@/components/route-guard';
import { useTranslation } from 'react-i18next';

export default function UsersPage() {
  const { t } = useTranslation('users');
  
  return (
    <RouteGuard allowedRoles={['Admin', 'Organizer']}>
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('list.title')}</h1>
            <p className="text-muted-foreground">
              {t('list.description')}
            </p>
          </div>
          <Link href="/dashboard/users/new">
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              {t('list.create')}
            </Button>
          </Link>
        </div>
        
        <UserTableClient />
      </div>
    </RouteGuard>
  )
} 