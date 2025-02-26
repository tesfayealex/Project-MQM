'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import UserForm from '@/components/users/UserForm';
import { getUser, updateUser } from '@/lib/services/user-service';
import { handleAuthError } from '@/lib/auth-utils';
import { User, UserFormValues } from '@/types/user';

interface EditUserFormClientProps {
  id: string;
}

export default function EditUserFormClient({ id }: EditUserFormClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await getUser(id);
        setUser(data);
      } catch (error: any) {
        console.error('Error fetching user:', error);
        
        const isAuthError = await handleAuthError(error);
        if (!isAuthError) {
          toast({
            title: "Error",
            description: "Failed to load user. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [id]);

  const handleSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      console.log('Updating user:', data);
      const response = await updateUser(id, data);
      console.log('User updated:', response);
      
      toast({
        title: "Success",
        description: "User updated successfully.",
      });
      
      router.push('/dashboard/users');
      router.refresh();
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          title: "Error",
          description: error.message || "Failed to update user. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user && isLoading) {
    return <div className="py-8 text-center">Loading user...</div>;
  }

  if (!user) {
    return <div className="py-8 text-center">User not found</div>;
  }

  return (
    <UserForm
      initialData={user}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
} 