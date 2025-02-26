'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@heroicons/react/24/outline"
import UserTableClient from './user-table-client';

export default function UsersPage() {
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Link href="/dashboard/users/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </Link>
      </div>
      
      <UserTableClient />
    </div>
  )
} 