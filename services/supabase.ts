
import { createClient } from '@supabase/supabase-js';
import { Voucher, Family, User, AppNotification } from '../types';

const supabaseUrl = 'https://iopejcjkmuievlaclecn.supabase.co/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvcGVqY2prbXVpZXZsYWNsZWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzU5MTMsImV4cCI6MjA4MTgxMTkxM30.JX9jp8tGCZ9oDMYfTFt3KF6h0P5UxzaTPUERgtV7G3Y';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const isUUID = (str: string | null | undefined) => {
  if (!str) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

export const supabaseService = {
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw error;
    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name: name,
          email: email,
          notifications_enabled: true
        });
      } catch (e) {
        console.warn("Profiles Tabelle Fehler");
      }
    }
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await supabase.auth.signOut();
    // window.localStorage.clear(); // Removed for React Native compatibility
  },

  getVouchers: async (userId: string) => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Voucher[];
  },

  saveVoucher: async (voucherData: any) => {
    // history is now allowed (requires SQL migration)
    const { id, created_at, ...payload } = voucherData;
    // Sicherstellen, dass family_id null ist, wenn nicht valide
    if (!isUUID(payload.family_id)) payload.family_id = null;

    const { data, error } = await supabase.from('vouchers').insert([payload]).select();
    if (error) throw error;
    return data[0] as Voucher;
  },

  updateVoucher: async (voucher: Voucher) => {
    // history is now allowed (requires SQL migration)
    const { id, created_at, user_id, ...updateFields } = voucher;

    // Datenbereinigung vor dem Senden an Supabase
    if (!isUUID(updateFields.family_id)) (updateFields as any).family_id = null;

    const { data, error } = await supabase.from('vouchers').update(updateFields).eq('id', id).select();
    if (error) {
      console.error("Supabase Update Error:", error);
      throw error;
    }
    return data[0] as Voucher;
  },

  deleteVoucher: async (voucherId: string) => {
    const { error } = await supabase.from('vouchers').delete().eq('id', voucherId);
    if (error) throw error;
  },

  getFamilies: async (userId: string) => {
    if (!userId) return [];
    const { data, error } = await supabase.from('families').select('*').eq('user_id', userId);
    if (error) return [];
    return (data || []) as Family[];
  },

  saveFamily: async (familyData: any) => {
    const { data, error } = await supabase.from('families').insert([familyData]).select();
    if (error) throw error;
    return data[0] as Family;
  },

  updateFamily: async (family: Family) => {
    const { id, user_id, ...updateFields } = family;
    const { data, error } = await supabase.from('families').update(updateFields).eq('id', id).select();
    if (error) throw error;
    return data[0] as Family;
  },

  deleteFamily: async (familyId: string) => {
    const { error } = await supabase.from('families').delete().eq('id', familyId);
    if (error) throw error;
  },

  getProfile: async (userId: string) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data as User;
  },

  updateProfile: async (user: User) => {
    await supabase.from('profiles').upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      notifications_enabled: user.notifications_enabled
    });
  },

  getNotifications: async (userId: string) => {
    if (!userId) return [];
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
    if (error) return [];
    return (data || []) as AppNotification[];
  },

  saveNotification: async (userId: string, notification: Partial<AppNotification>) => {
    if (!userId) return;
    await supabase.from('notifications').insert([{ ...notification, user_id: userId }]);
  },

  markNotificationsAsRead: async (userId: string) => {
    if (!userId) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  },

  updatePassword: async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  updateEmail: async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
  },

  uploadVoucherImage: async (uriOrBase64: string, fileName: string, mimeType: string) => {
    try {
      let blob;
      // If it's a URI (file:// or content://), fetch it as a blob
      if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('content://') || uriOrBase64.startsWith('http')) {
        const response = await fetch(uriOrBase64);
        blob = await response.blob();
      } else {
        // Fallback for base64 string (less efficient on native but kept for compatibility logic)
        // Note: atob is not available in RN without polyfill. 
        // Assuming this branch might not be hit if we pass URI, or we need 'base-64' package.
        // Better to rely on URI upload.
        return null;
      }

      const filePath = `voucher-${Date.now()}.${fileName.split('.').pop() || 'jpg'}`;
      const { error: uploadError } = await supabase.storage.from('vouchers').upload(filePath, blob);

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('vouchers').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.error("Storage upload error", e);
      return null;
    }
  }
};
