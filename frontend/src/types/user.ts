export interface User {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  groups: Group[];
}

export interface Group {
  id: number;
  name: string;
}

export interface UserFormValues {
  username: string;
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  group_ids?: number[];
} 