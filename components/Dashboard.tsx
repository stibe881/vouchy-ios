
import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Pressable, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { Voucher, Family, AppNotification } from '../types';
import Icon from './Icon';

interface DashboardProps {
  vouchers: Voucher[];
  families: Family[];
  notifications: AppNotification[];
  onUpdateVoucher: (v: Voucher) => Promise<void>;
  onSelectVoucher: (v: Voucher) => void;
  onOpenNotifications: () => void;
  onRefresh?: () => Promise<void>;
  loadError?: string | null;
  userEmail?: string;
  userName?: string;
}

type SortOption = 'newest' | 'alphabetical' | 'amount' | 'expiry';

const Dashboard: React.FC<DashboardProps> = ({ vouchers, families, notifications, onUpdateVoucher, onSelectVoucher, onOpenNotifications, onRefresh, loadError, userEmail, userName }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterFamily, setFilterFamily] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Redemption Modal State
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemVoucher, setRedeemVoucher] = useState<Voucher | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Convert YYYY-MM-DD to DD.MM.YYYY for display
  const displayDateDE = (isoDate: string | null | undefined): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return isoDate;
  };

  const filteredAndSortedVouchers = useMemo(() => {
    let result = vouchers.filter(v =>
      (v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.store.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!filterFamily || v.family_id === filterFamily) &&
      (!filterCategory || v.category === filterCategory)
    );

    switch (sortBy) {
      case 'alphabetical':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'amount':
        result.sort((a, b) => b.remaining_amount - a.remaining_amount);
        break;
      case 'expiry':
        result.sort((a, b) => {
          if (!a.expiry_date) return 1;
          if (!b.expiry_date) return -1;
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        });
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
    }

    return result;
  }, [vouchers, searchQuery, sortBy, filterFamily, filterCategory]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  const handleRedeem = (voucher: Voucher) => {
    setRedeemVoucher(voucher);
    setRedeemAmount('');
    setShowRedeemModal(true);
  };

  const processRedemption = async () => {
    if (!redeemVoucher || !redeemAmount.trim()) return;

    const val = parseFloat(redeemAmount.replace(',', '.'));
    const remaining = Number(redeemVoucher.remaining_amount || 0);

    if (isNaN(val) || val <= 0) {
      alert("Bitte einen gültigen Betrag eingeben.");
      return;
    }

    if (val > remaining) {
      alert("Betrag ist höher als das Restguthaben.");
      return;
    }

    setIsProcessing(redeemVoucher.id);
    setShowRedeemModal(false);

    try {
      const newAmount = Math.max(0, remaining - val);

      const newRedemption = {
        id: Date.now().toString(),
        voucher_id: redeemVoucher.id,
        amount: val, // This number is correctly passed
        timestamp: new Date().toISOString(),
        user_name: userName || 'Ich'
      };

      await onUpdateVoucher({
        ...redeemVoucher,
        remaining_amount: newAmount,
        history: [newRedemption, ...(redeemVoucher.history || [])]
      });
    } catch (err) {
      alert("Konnte den Betrag nicht aktualisieren.");
    } finally {
      setIsProcessing(null);
      setRedeemVoucher(null);
      setRedeemAmount('');
    }
  };

  const activeFiltersCount = (filterFamily ? 1 : 0) + (filterCategory ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Gutscheine</Text>
          <Text style={styles.date}>{vouchers.length} Verfügbar</Text>
        </View>
        <TouchableOpacity style={styles.notificationBtn} onPress={onOpenNotifications}>
          <Icon name="notifications-outline" size={24} color="#0f172a" />
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search-outline" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Suchen..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TouchableOpacity
            style={[styles.filterToggleBtn, (showFilters || activeFiltersCount > 0) && styles.filterToggleBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon name="options-outline" size={20} color={showFilters || activeFiltersCount > 0 ? "#fff" : "#64748b"} />
            {activeFiltersCount > 0 && !showFilters && (
              <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFiltersCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterSectionLabel}>Sortierung</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterGroupScroll}>
              {[
                { id: 'newest', label: 'Neueste', icon: 'time-outline' },
                { id: 'alphabetical', label: 'A-Z', icon: 'text-outline' },
                { id: 'amount', label: 'Betrag', icon: 'card-outline' },
                { id: 'expiry', label: 'Ablauf', icon: 'calendar-outline' }
              ].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setSortBy(opt.id as SortOption)}
                  style={[styles.sortChip, sortBy === opt.id && styles.sortChipActive]}
                >
                  <Icon name={opt.icon} size={14} color={sortBy === opt.id ? '#fff' : '#64748b'} />
                  <Text style={[styles.sortChipText, sortBy === opt.id && styles.sortChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterSectionLabel}>Familie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterGroupScroll}>
              <TouchableOpacity
                style={[styles.sortChip, !filterFamily && styles.sortChipActive]}
                onPress={() => setFilterFamily(null)}
              >
                <Text style={[styles.sortChipText, !filterFamily && styles.sortChipTextActive]}>Alle</Text>
              </TouchableOpacity>
              {families.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.sortChip, filterFamily === f.id && styles.sortChipActive]}
                  onPress={() => setFilterFamily(filterFamily === f.id ? null : f.id)}
                >
                  <Text style={[styles.sortChipText, filterFamily === f.id && styles.sortChipTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterSectionLabel}>Kategorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterGroupScroll}>
              <TouchableOpacity
                style={[styles.sortChip, !filterCategory && styles.sortChipActive]}
                onPress={() => setFilterCategory(null)}
              >
                <Text style={[styles.sortChipText, !filterCategory && styles.sortChipTextActive]}>Alle</Text>
              </TouchableOpacity>
              {['Shopping', 'Lebensmittel', 'Wohnen', 'Reisen', 'Freizeit', 'Sonstiges'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.sortChip, filterCategory === cat && styles.sortChipActive]}
                  onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
                >
                  <Text style={[styles.sortChipText, filterCategory === cat && styles.sortChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
      >
        {loadError && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={20} color="#ef4444" style={{ marginRight: 10 }} />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        )}

        <View style={styles.list}>
          {filteredAndSortedVouchers.map(voucher => {
            const family = families.find(f => f.id === voucher.family_id);
            const remaining = Number(voucher.remaining_amount || 0);
            const initial = Number(voucher.initial_amount || 0);
            const progress = initial > 0 ? (remaining / initial) * 100 : 0;
            const processing = isProcessing === voucher.id;

            return (
              <TouchableOpacity key={voucher.id} style={styles.card} activeOpacity={0.9} onPress={() => onSelectVoucher(voucher)}>
                {family && (
                  <View style={styles.familyBadge}>
                    <Icon name="people" size={10} color="#2563eb" style={{ marginRight: 4 }} />
                    <Text style={styles.familyBadgeText}>{family.name}</Text>
                  </View>
                )}
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}><Icon name={voucher.type === 'VALUE' ? 'card-outline' : 'list-outline'} size={22} color="#2563eb" /></View>
                  <View style={styles.titleBox}>
                    <Text style={styles.voucherTitle} numberOfLines={1}>{voucher.title}</Text>
                    <Text style={styles.voucherStore} numberOfLines={1}>{voucher.store}</Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountText}>{remaining.toFixed(2)}{voucher.type === 'VALUE' && <Text style={styles.currencyText}> {voucher.currency}</Text>}</Text>
                  </View>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${Math.min(100, progress)}%`, backgroundColor: progress < 20 ? '#ef4444' : '#2563eb' }]} />
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.footerLabel}>GÜLTIG BIS</Text>
                    <Text style={[styles.footerValue, voucher.expiry_date && styles.expiryHighlight]}>{displayDateDE(voucher.expiry_date) || 'Unbegrenzt'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.useButton, (remaining <= 0 || processing) && { opacity: 0.3 }]}
                    onPress={(e: any) => { e.stopPropagation(); if (remaining > 0 && !processing) useVoucher(voucher); }}
                  >
                    <Text style={styles.useButtonText}>{processing ? '...' : 'Abziehen'}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredAndSortedVouchers.length === 0 && (
            <View style={styles.emptyContainer}>
              <Icon name="search-outline" size={60} color="#e2e8f0" />
              <Text style={styles.emptyText}>Nichts gefunden</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Redemption Modal */}
      {showRedeemModal && redeemVoucher && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {redeemVoucher.type === 'VALUE' ? 'Betrag abziehen' : 'Anzahl abziehen'}
            </Text>
            <Text style={styles.modalSubtitle}>{redeemVoucher.title}</Text>

            <TextInput
              style={styles.modalInput}
              value={redeemAmount}
              onChangeText={setRedeemAmount}
              placeholder={redeemVoucher.type === 'VALUE' ? "Betrag (z.B. 20.00)" : "Anzahl"}
              keyboardType="numeric"
              autoFocus
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRedeemModal(false)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={processRedemption}>
                <Text style={styles.modalConfirmText}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  date: { fontSize: 24, fontWeight: '900', color: '#0f172a' },

  // Header Action Buttons
  notificationBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#f9fafb' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  filterContainer: { paddingHorizontal: 20, marginBottom: 15 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1e293b' },
  filterToggleBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  filterToggleBtnActive: { backgroundColor: '#2563eb' },
  filterBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#f9fafb' },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  filtersPanel: { backgroundColor: '#fff', borderRadius: 20, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  filterSectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  filterGroupScroll: { marginBottom: 15 },

  sortScroll: { marginBottom: 0 },
  sortChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8 },
  sortChipActive: { backgroundColor: '#2563eb' },
  sortChipText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginLeft: 6 },
  sortChipTextActive: { color: '#fff' },

  list: { paddingHorizontal: 20, gap: 15 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  familyBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  familyBadgeText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  amountText: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  currencyText: { fontSize: 12, color: '#94a3b8' },

  titleBox: { flex: 1, paddingHorizontal: 15 },
  voucherTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  voucherStore: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  progressBarContainer: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 20, overflow: 'hidden' },
  progressBar: { height: '100%' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },
  footerValue: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 },
  expiryHighlight: { color: '#2563eb' },
  useButton: { backgroundColor: '#0f172a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  useButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 10 },
  errorBox: { flexDirection: 'row', backgroundColor: '#fff1f2', padding: 15, borderRadius: 16, marginBottom: 20, alignItems: 'center' },
  errorText: { color: '#e11d48', fontSize: 13, fontWeight: '600' },

  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  modalInput: { height: 56, backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 20, fontSize: 20, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: '#f1f5f9' },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  modalConfirmBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: '#2563eb' },
  modalConfirmText: { fontSize: 16, fontWeight: '800', color: '#fff' }
});

export default Dashboard;
