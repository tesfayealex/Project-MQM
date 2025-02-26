import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import EditUserFormClient from './edit-form-client';

export const metadata = {
  title: 'Edit User | myQuickMessage',
  description: 'Edit user details and permissions',
};

export default async function EditUserPage({ params }: { params: { id: string } }) {
  // Since this is a server component, we can directly use params.id
  const id = params.id;

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/users">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Edit User</h1>
        </div>
      </div>
      
      <Card className="p-6">
        <EditUserFormClient id={id} />
      </Card>
    </div>
  );
} 