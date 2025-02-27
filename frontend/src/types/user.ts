export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  date_joined: string;
  is_active: boolean;
  groups: Group[];
}

export interface Group {
  id: number;
  name: string;
}

export interface UserFormValues {
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  group_ids?: number[];
} 