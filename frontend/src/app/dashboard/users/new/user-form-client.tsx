'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import UserForm from '@/components/users/UserForm';
import { createUser } from '@/lib/services/user-service';
import { handleAuthError } from '@/lib/auth-utils';
import { UserFormValues } from '@/types/user';

export default function UserFormClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      console.log('Creating user:', data);
      const response = await createUser(data);
      console.log('User created:', response);
      
      toast({
        title: "Success",
        description: "User created successfully.",
      });
      
      router.push('/dashboard/users');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          title: "Error",
          description: error.message || "Failed to create user. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UserForm
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
} 