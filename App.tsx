import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthState, Voucher, Family, User, AppNotification, FamilyInvite } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AddVoucher from './components/AddVoucher';
import FamiliesView from './components/FamiliesView';
import Navigation from './components/Navigation';
import VoucherDetail from './components/VoucherDetail';
import NotificationCenter from './components/NotificationCenter';
import Toast from './components/Toast';
import { supabase, supabaseService } from './services/supabase';
import { registerForPushNotifications, addNotificationResponseListener, scheduleExpiryNotifications } from './services/notifications';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });
  const [view, setView] = useState<'dashboard' | 'add' | 'families' | 'detail' | 'notifications'>('dashboard');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'warning' } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<FamilyInvite[]>([]);
  const [pendingVoucherId, setPendingVoucherId] = useState<string | null>(null);

  const loadingTimerRef = useRef<any>(null);

  const clearData = () => {
    setVouchers([]);
    setFamilies([]);
    setNotifications([]);
    setPendingInvites([]);
    setSelectedVoucher(null);
    setView('dashboard');
  };

  const loadAllUserData = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoadError(null);
    console.log('[App] loadAllUserData called for:', userId);
    try {
      // 1. Get current auth user first to ensure we have email
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userEmail = authUser?.email;

      const [vData, fData, nData, pData] = await Promise.all([
        supabaseService.getVouchers(userId),
        supabaseService.getFamilies(userId),
        supabaseService.getNotifications(userId),
        supabaseService.getProfile(userId)
      ]);

      console.log('[App] Data loaded. Profile found:', !!pData, 'Email:', userEmail);

      setVouchers(vData);
      setFamilies(fData);
      setNotifications(nData);

      let currentUser = pData;
      // If profile is missing but we have authUser, construct a fallback
      if (!currentUser && authUser) {
        currentUser = {
          id: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Benutzer',
          notifications_enabled: true
        };
        // Optional: Create profile if missing? 
        // supabaseService.updateProfile(currentUser); 
      }

      if (currentUser) {
        setAuth(prev => ({ ...prev, user: currentUser }));
      }

      // Load pending invites - Use email from Auth if Profile email is missing
      const emailToUse = currentUser?.email || userEmail;
      if (emailToUse) {
        console.log('[App] Fetching invites for:', emailToUse);
        const invites = await supabaseService.getPendingInvitesForUser(emailToUse);
        setPendingInvites(invites);
      } else {
        console.log('[App] No email found, skipping invite fetch');
      }

    } catch (err: any) {
      console.error("[App] Fehler beim Laden:", err);
      setLoadError("Daten konnten nicht vollständig geladen werden.");
    } finally {
      setAuth(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuth({
          user: { id: session.user.id, email: session.user.email!, name: session.user.user_metadata?.full_name || 'Benutzer' },
          isAuthenticated: true,
          isLoading: true
        });
      } else {
        setAuth({ user: null, isAuthenticated: false, isLoading: false });
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuth({
          user: { id: session.user.id, email: session.user.email!, name: session.user.user_metadata?.full_name || 'Benutzer' },
          isAuthenticated: true,
          isLoading: true
        });
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, isAuthenticated: false, isLoading: false });
        clearData();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id) loadAllUserData(auth.user.id);
  }, [auth.isAuthenticated, auth.user?.id, loadAllUserData]);

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id) {
      registerForPushNotifications(auth.user.id);
    }
  }, [auth.isAuthenticated, auth.user?.id]);

  // Handle notification tap - navigate to voucher
  useEffect(() => {
    const subscription = addNotificationResponseListener((voucherId) => {
      const voucher = vouchers.find(v => v.id === voucherId);
      if (voucher) {
        setSelectedVoucher(voucher);
        setView('detail');
      } else {
        // If called from notification but data not ready, we could also use pending logic
        // But usually app is open. For logic consistency let's rely on standard flow or add pending if crucial.
        // Notification listener is separate.
      }
    });
    return () => subscription.remove();
  }, [vouchers]);

  // Handle deep links (e.g. from Ausflugfinder)
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log("[App] Deep link received:", event.url);
      try {
        const url = event.url;
        // Expected format: vouchervault://voucher/[id]
        if (url.includes('voucher/')) {
          const parts = url.split('voucher/');
          if (parts.length > 1) {
            const voucherId = parts[1];
            console.log("[App] Deep link target ID:", voucherId);

            const voucher = vouchers.find(v => v.id === voucherId);
            if (voucher) {
              console.log("[App] Found voucher immediately, navigating.");
              setSelectedVoucher(voucher);
              setView('detail');
            } else {
              console.log("[App] Voucher not found yet, setting pending ID:", voucherId);
              setPendingVoucherId(voucherId);
            }
          }
        }
      } catch (e) {
        console.error("[App] Error handling deep link:", e);
      }
    };

    const Linking = require('react-native').Linking;

    // Listen for incoming links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial link if app was closed
    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, [vouchers]); // Re-run when vouchers change

  // Process pending deep link/notification once vouchers are loaded
  useEffect(() => {
    if (pendingVoucherId && vouchers.length > 0) {
      console.log("[App] Processing pending voucher ID:", pendingVoucherId);
      const voucher = vouchers.find(v => v.id === pendingVoucherId);
      if (voucher) {
        setSelectedVoucher(voucher);
        setView('detail');
        setPendingVoucherId(null); // Clear pending
      } else {
        console.log("[App] Pending voucher still not found in loaded list.");
      }
    }
  }, [vouchers, pendingVoucherId]);


  const handleLogout = async () => {
    await supabaseService.signOut();
    clearData();
    setPendingVoucherId(null);
  };

  const showNotification = async (title: string, body: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message: body, type });
    if (auth.user) {
      await supabaseService.saveNotification(auth.user.id, { title, body, type });
      const updated = await supabaseService.getNotifications(auth.user.id);
      setNotifications(updated);
    }
  };

  const handleUpdateVoucher = async (v: Voucher) => {
    try {
      const updated = await supabaseService.updateVoucher(v);
      setVouchers(prev => prev.map(item => item.id === v.id ? updated : item));
      if (selectedVoucher?.id === v.id) setSelectedVoucher(updated);
      // Update expiry notifications
      if (updated.expiry_date) {
        scheduleExpiryNotifications(updated.id!, updated.title, updated.expiry_date);
      }
    } catch (e: any) {
      setToast({ message: "Fehler beim Update: " + e.message, type: 'warning' });
      throw e; // Fehler an UI weitergeben
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    const voucherToDelete = vouchers.find(v => v.id === id);
    // Cancel any scheduled notifications for this voucher
    const { cancelExpiryNotifications } = await import('./services/notifications');
    await cancelExpiryNotifications(id);
    await supabaseService.deleteVoucher(id, voucherToDelete?.image_url, voucherToDelete?.image_url_2);
    setVouchers(prev => prev.filter(v => v.id !== id));
    setView('dashboard');
  };

  const handleDeleteFamily = async (id: string) => {
    await supabaseService.deleteFamily(id);
    setFamilies(prev => prev.filter(f => f.id !== id));
  };

  if (auth.isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!auth.isAuthenticated || !auth.user) return <Login onLogin={() => { }} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}
        <View style={styles.content}>
          <View style={{ flex: 1, display: view === 'dashboard' ? 'flex' : 'none' }}>
            <Dashboard
              vouchers={vouchers} families={families} notifications={notifications}
              onUpdateVoucher={handleUpdateVoucher} onSelectVoucher={(v) => { setSelectedVoucher(v); setView('detail'); }}
              onOpenNotifications={() => setView('notifications')} onRefresh={() => loadAllUserData(auth.user!.id)}
              loadError={loadError} userName={auth.user?.name}
            />
          </View>
          {view === 'add' && <AddVoucher families={families} currentUser={auth.user} onCancel={() => setView('dashboard')} onSave={async (v) => {
            try {
              console.log('Saving voucher:', v);
              const saved = await supabaseService.saveVoucher({ ...v, user_id: auth.user!.id });
              console.log('Saved voucher:', saved);
              setVouchers(prev => [saved, ...prev]);
              setView('dashboard');
              showNotification("Erfolgreich", `Gutschein gespeichert.`, 'success');
              // Schedule expiry notifications
              if (saved.expiry_date) {
                scheduleExpiryNotifications(saved.id!, saved.title, saved.expiry_date);
              }
            } catch (error: any) {
              console.error('Save error:', error);
              alert('Fehler beim Speichern: ' + (error?.message || 'Unbekannter Fehler'));
            }
          }} />}
          {view === 'families' && (
            <FamiliesView
              families={families} user={auth.user}
              pendingInvites={pendingInvites}
              onUpdateUser={(u) => { supabaseService.updateProfile(u); setAuth(prev => ({ ...prev, user: u })); }}
              onCreateFamily={async (name) => {
                const f = await supabaseService.saveFamily({ name, user_id: auth.user!.id, member_count: 1 });
                setFamilies(prev => [...prev, f]);
              }}
              onUpdateFamily={async (f) => {
                const up = await supabaseService.updateFamily(f);
                setFamilies(prev => prev.map(item => item.id === f.id ? up : item));
              }}
              onDeleteFamily={handleDeleteFamily}
              onLogout={handleLogout}
              onDeleteAccount={async () => {
                if (auth.user) {
                  try {
                    await supabaseService.deleteAccount(auth.user.id);
                    clearData();
                    setAuth({ user: null, isAuthenticated: false, isLoading: false });
                  } catch (e: any) {
                    console.error('Delete account error:', e);
                  }
                }
              }}
              showNotification={showNotification}
              onRefreshInvites={async () => {
                if (auth.user?.email) {
                  const invites = await supabaseService.getPendingInvitesForUser(auth.user.email);
                  setPendingInvites(invites);
                  loadAllUserData(auth.user.id);
                }
              }}
              onRefreshData={async () => {
                if (auth.user?.id) {
                  await loadAllUserData(auth.user.id);
                }
              }}
            />
          )}
          {view === 'detail' && selectedVoucher && (
            <VoucherDetail
              voucher={selectedVoucher} owner={auth.user}
              family={families.find(f => f.id === selectedVoucher.family_id) || null}
              families={families} onBack={() => setView('dashboard')}
              onUpdateVoucher={handleUpdateVoucher} onDeleteVoucher={handleDeleteVoucher}
            />
          )}
          {view === 'notifications' && (
            <NotificationCenter
              notifications={notifications}
              onBack={() => {
                // Don't mark all as read automatically anymore
                setView('dashboard');
              }}
              onClearAll={() => {
                supabaseService.markNotificationsAsRead(auth.user?.id || ''); // Clear implies read? Or delete? onClearAll sets state to []
                setNotifications([]);
              }}
              onMarkAsRead={async (id) => {
                await supabaseService.markNotificationAsRead(id);
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
              }}
              onAcceptInvite={async (inviteId) => {
                if (!auth.user) return;
                try {
                  const { error } = await supabaseService.acceptInviteAtomic(inviteId, auth.user.email, auth.user.name);
                  if (error) throw new Error(error);
                  showNotification("Erfolg", "Einladung angenommen!", 'success');
                  // Refresh data
                  await loadAllUserData(auth.user.id);
                } catch (err: any) {
                  showNotification("Fehler", err.message || "Fehler beim Annehmen", 'warning');
                }
              }}
              onRejectInvite={async (inviteId) => {
                if (!auth.user) return;
                try {
                  await supabaseService.rejectInvite(inviteId);
                  showNotification("Info", "Einladung abgelehnt", 'info');
                  // Refresh invites
                  if (auth.user.email) {
                    const invites = await supabaseService.getPendingInvitesForUser(auth.user.email);
                    setPendingInvites(invites);
                  }
                } catch (err: any) {
                  showNotification("Fehler", "Fehler beim Ablehnen", 'warning');
                }
              }}
            />
          )}
        </View>
        {view !== 'detail' && view !== 'notifications' && <Navigation currentView={view === 'families' ? 'families' : (view === 'add' ? 'add' : 'dashboard')} setView={setView} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default App;
