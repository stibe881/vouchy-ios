
import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { Voucher, Family, User, AppNotification, FamilyInvite, Trip } from '../types';

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

  deleteAccount: async (userId: string) => {
    // Delete all user's vouchers (including their images)
    const { data: vouchers } = await supabase
      .from('vouchers')
      .select('id, image_url, image_url_2')
      .eq('user_id', userId);

    if (vouchers) {
      for (const voucher of vouchers) {
        // Delete images from storage
        if (voucher.image_url) {
          const fileName = voucher.image_url.split('/').pop()?.split('?')[0];
          if (fileName) await supabase.storage.from('vouchers').remove([fileName]);
        }
        if (voucher.image_url_2) {
          const fileName = voucher.image_url_2.split('/').pop()?.split('?')[0];
          if (fileName) await supabase.storage.from('vouchers').remove([fileName]);
        }
      }
    }

    // Delete vouchers
    await supabase.from('vouchers').delete().eq('user_id', userId);

    // Delete families created by user
    await supabase.from('families').delete().eq('user_id', userId);

    // Delete family invites
    await supabase.from('family_invites').delete().eq('inviter_id', userId);

    // Delete notifications
    await supabase.from('notifications').delete().eq('user_id', userId);

    // Delete profile
    await supabase.from('profiles').delete().eq('id', userId);

    // Sign out (user deletion requires admin API which is not available on client)
    await supabase.auth.signOut();
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
    // trip_id sollte number oder null sein
    if (!payload.trip_id) payload.trip_id = null;

    const { data, error } = await supabase.from('vouchers').insert([payload]).select();
    if (error) throw error;
    return data[0] as Voucher;
  },

  updateVoucher: async (voucher: Voucher) => {
    // history is now allowed (requires SQL migration)
    const { id, created_at, user_id, ...updateFields } = voucher;

    // Datenbereinigung vor dem Senden an Supabase
    if (!isUUID(updateFields.family_id)) (updateFields as any).family_id = null;
    if (!updateFields.trip_id) (updateFields as any).trip_id = null;

    const { data, error } = await supabase.from('vouchers').update(updateFields).eq('id', id).select();
    if (error) {
      console.error("Supabase Update Error:", error);
      throw error;
    }
    return data[0] as Voucher;
  },

  deleteVoucher: async (voucherId: string, imageUrl?: string | null, imageUrl2?: string | null) => {
    // Delete images from storage if they exist
    const deleteImage = async (url: string | null | undefined) => {
      if (!url) return;
      try {
        // Extract filename from public URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/vouchers/voucher-123.jpg
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1]?.split('?')[0]; // Remove query params if any

        if (fileName && fileName.startsWith('voucher-')) {
          console.log('Deleting image from storage:', fileName);
          const { error } = await supabase.storage.from('vouchers').remove([fileName]);
          if (error) {
            console.error('Error deleting image:', error);
          } else {
            console.log('Image deleted successfully:', fileName);
          }
        } else {
          console.log('Not a storage image, skipping:', url);
        }
      } catch (e) {
        console.error('Error deleting image:', e);
      }
    };

    await deleteImage(imageUrl);
    await deleteImage(imageUrl2);

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

  uploadVoucherImage: async (uri: string, fileName: string, mimeType: string) => {
    try {
      console.log('Upload attempt:', { uri: uri.substring(0, 50), fileName });

      // Use expo-file-system to properly read the file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });
      console.log('Base64 read, length:', base64.length);

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const filePath = `voucher-${Date.now()}.jpg`;
      console.log('Uploading to path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('vouchers')
        .upload(filePath, bytes, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('vouchers').getPublicUrl(filePath);
      console.log('Upload success, public URL:', data.publicUrl);
      return data.publicUrl;
    } catch (e) {
      console.error("Storage upload error", e);
      return null;
    }
  },

  // ===== FAMILY INVITATIONS =====

  sendInviteEmail: async (inviteeEmail: string, inviterName: string, familyName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-email', {
        body: { inviteeEmail, inviterName, familyName }
      });
      if (error) console.error('Email send error:', error);
      return data;
    } catch (e) {
      console.error('Failed to send invite email:', e);
    }
  },

  createInvite: async (familyId: string, inviterId: string, inviteeEmail: string, inviterName?: string, familyName?: string) => {
    const { data, error } = await supabase
      .from('family_invites')
      .insert([{
        family_id: familyId,
        inviter_id: inviterId,
        invitee_email: inviteeEmail.toLowerCase().trim(),
        status: 'pending'
      }])
      .select()
      .single();
    if (error) throw error;

    // Send email notification to invitee
    if (familyName) {
      await supabaseService.sendInviteEmail(inviteeEmail, inviterName || 'Jemand', familyName);
    }

    // Attempt to create in-app notification if user exists
    try {
      // We need to find the user ID by email. Since we can't query auth.users from client,
      // we check the public profiles table which should mirror users.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteeEmail.toLowerCase().trim())
        .single();

      if (profile) {
        await supabaseService.saveNotification(profile.id, {
          title: 'Einladung erhalten',
          body: `${inviterName || 'Jemand'} hat dich zur Gruppe "${familyName}" eingeladen.`,
          type: 'info'
        });
      }
    } catch (e) {
      // Ignore error if profile lookup fails (user might not exist yet)
    }

    return data as FamilyInvite;
  },

  deleteInvite: async (inviteId: string) => {
    const { error } = await supabase.from('family_invites').delete().eq('id', inviteId);
    if (error) throw error;
  },

  getPendingInvitesForUser: async (email: string): Promise<FamilyInvite[]> => {
    // Fetch invites first
    const { data: invites, error } = await supabase
      .from('family_invites')
      .select('*, families:family_id (name)')
      .eq('invitee_email', email.toLowerCase())
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching invites:', error);
      return [];
    }

    if (!invites || invites.length === 0) return [];

    // Manually fetch missing inviter names if relation not found
    // Or just use the ones we have? The error said FK missing.
    // We can try to fetch profiles for the inviter_ids
    const inviterIds = [...new Set(invites.map((i: any) => i.inviter_id).filter(Boolean))];

    let profilesMap: Record<string, string> = {};
    if (inviterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', inviterIds);

      if (profiles) {
        profiles.forEach((p: any) => {
          profilesMap[p.id] = p.name;
        });
      }
    }

    return invites.map((invite: any) => ({
      ...invite,
      family_name: invite.families?.name,
      inviter_name: profilesMap[invite.inviter_id] || 'Jemand'
    })) as FamilyInvite[];
  },

  getSentInvitesForFamily: async (familyId: string): Promise<FamilyInvite[]> => {
    const { data, error } = await supabase
      .from('family_invites')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching sent invites:', error);
      return [];
    }

    return (data || []) as FamilyInvite[];
  },

  respondToInvite: async (inviteId: string, response: 'accepted' | 'rejected'): Promise<FamilyInvite> => {
    const { data, error } = await supabase
      .from('family_invites')
      .update({
        status: response,
        updated_at: new Date().toISOString()
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (error) throw error;
    return data as FamilyInvite;
  },

  getInviterPushToken: async (inviterId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', inviterId)
      .single();

    if (error || !data) return null;
    return data.push_token;
  },

  addMemberToFamily: async (familyId: string, userEmail: string, userName: string) => {
    // Get the family
    const { data: family, error: fetchError } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single();

    if (fetchError || !family) throw fetchError || new Error('Family not found');

    const newMember = {
      id: Math.random().toString(36).substr(2, 9),
      email: userEmail.toLowerCase(),
      name: userName || userEmail.split('@')[0]
    };

    const updatedMembers = [...(family.members || []), newMember];

    const { error: updateError } = await supabase
      .from('families')
      .update({
        members: updatedMembers,
        member_count: updatedMembers.length + 1
      })
      .eq('id', familyId);

    if (updateError) throw updateError;
  },

  removeMemberFromFamily: async (familyId: string, memberId: string) => {
    // Get the family
    const { data: family, error: fetchError } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single();

    if (fetchError || !family) throw fetchError || new Error('Family not found');

    const updatedMembers = (family.members || []).filter((m: any) => m.id !== memberId);

    const { error: updateError } = await supabase
      .from('families')
      .update({
        members: updatedMembers,
        member_count: updatedMembers.length
      })
      .eq('id', familyId);

    if (updateError) throw updateError;
  },


  // ===== TRIPS Integration =====
  getTrips: async (userId: string) => {
    // Da wir in derselben DB sind, können wir direkt auf trips zugreifen.
    // FK-Relationship scheint nicht via REST exposed zu sein, daher erstmal ohne Fotos um Crash zu fixen
    const { data: trips, error } = await supabase
      .from('ausfluege')
      .select('id, title:name, destination:adresse')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching trips:", error);
      return [];
    }

    // Manueller Fetch der Fotos für diese Trips (Workaround für fehlenden FK)
    const tripIds = trips.map((t: any) => t.id);
    let photoMap: Record<number, string> = {};

    if (tripIds.length > 0) {
      const { data: photos } = await supabase
        .from('ausfluege_fotos')
        .select('ausflug_id, full_url')
        .in('ausflug_id', tripIds)
        .eq('is_primary', true);

      if (photos) {
        photos.forEach((p: any) => {
          photoMap[p.ausflug_id] = p.full_url;
        });
      }
    }

    // Map result to Trip type
    return (trips || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      destination: t.destination,
      image: photoMap[t.id] || null
    })) as Trip[];
  }
};
