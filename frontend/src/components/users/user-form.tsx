'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';
import { User, Group } from '@/types/user';
import { getGroups, createUser, updateUser } from '@/lib/services/user-service';

// Define the form schema
const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  is_active: z.boolean().default(true),
  group_ids: z.array(z.number()).optional(),
});

const updateUserSchema = createUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

interface UserFormProps {
  initialData?: User;
  onSuccess?: () => void;
}

export default function UserForm({ initialData, onSuccess }: UserFormProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const schema = initialData ? updateUserSchema : createUserSchema;
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialData?.email || '',
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      is_active: initialData?.is_active ?? true,
      group_ids: initialData?.groups?.map(g => g.id) || [],
    },
  });

  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await getGroups();
        setGroups(data);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load groups",
          variant: "destructive",
        });
      }
    }
    loadGroups();
  }, [toast]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      if (initialData?.id) {
        // For updates, only include password if it was provided
        const updateData = { ...data };
        if (!updateData.password) {
          delete updateData.password;
        }
        await updateUser(initialData.id.toString(), updateData);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } else {
        await createUser(data);
        toast({
          title: "Success",
          description: "User created successfully",
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard/users');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            disabled={isLoading}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Password {initialData && "(leave blank to keep current)"}
          </Label>
          <Input
            id="password"
            type="password"
            disabled={isLoading}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            disabled={isLoading}
            {...form.register("first_name")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            disabled={isLoading}
            {...form.register("last_name")}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            disabled={isLoading}
            checked={form.watch("is_active")}
            onCheckedChange={(checked) => form.setValue("is_active", checked)}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="space-y-2">
          <Label>Groups</Label>
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`group-${group.id}`}
                  disabled={isLoading}
                  checked={form.watch("group_ids")?.includes(group.id)}
                  onCheckedChange={(checked) => {
                    const currentGroups = form.watch("group_ids") || [];
                    if (checked) {
                      form.setValue("group_ids", [...currentGroups, group.id]);
                    } else {
                      form.setValue(
                        "group_ids",
                        currentGroups.filter((id) => id !== group.id)
                      );
                    }
                  }}
                />
                <Label htmlFor={`group-${group.id}`}>{group.name}</Label>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update User" : "Create User"}
        </Button>
      </form>
    </Card>
  );
} 