
export type VoucherType = 'VALUE' | 'QUANTITY';

export interface User {
  id: string;
  email: string;
  name: string;
  notifications_enabled?: boolean;
}

export interface Redemption {
  id: string;
  voucher_id: string;
  amount: number;
  timestamp: string;
  user_name: string;
}

export interface FamilyMember {
  id: string;
  email: string;
  name: string;
}

export interface Family {
  id: string;
  name: string;
  user_id: string;
  member_count: number;
  members?: FamilyMember[];
}

export interface Voucher {
  id: string;
  title: string;
  store: string;
  type: VoucherType;
  initial_amount: number;
  remaining_amount: number;
  currency: string;
  expiry_date?: string | null;
  family_id: string | null;
  image_url?: string | null;
  created_at: string;
  user_id: string;
  code?: string;
  pin?: string;
  website?: string;
  history?: Redemption[]; // Neu: Verlauf der Einlösungen
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
