
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, Modal, Dimensions } from 'react-native';
import { Voucher, User, Family, Redemption } from '../types';
import Icon from './Icon';

interface VoucherDetailProps {
  voucher: Voucher;
  owner: User | null;
  family: Family | null;
  families: Family[];
  onBack: () => void;
  onUpdateVoucher: (v: Voucher) => Promise<void> | void;
  onDeleteVoucher: (id: string) => Promise<void> | void;
}

const { width } = Dimensions.get('window');

const VoucherDetail: React.FC<VoucherDetailProps> = ({ voucher, owner, family, families, onBack, onUpdateVoucher, onDeleteVoucher }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');

  // Form states for editing
  const [editTitle, setEditTitle] = useState(voucher.title || '');
  const [editStore, setEditStore] = useState(voucher.store || '');
  const [editAmount, setEditAmount] = useState(voucher.remaining_amount?.toString() || '0');
  const [editCurrency, setEditCurrency] = useState(voucher.currency || 'CHF');
  const [editCode, setEditCode] = useState(voucher.code || '');
  const [editPin, setEditPin] = useState(voucher.pin || '');
  const [editExpiry, setEditExpiry] = useState(voucher.expiry_date || '');
  const [editWebsite, setEditWebsite] = useState(voucher.website || '');
  const [editType, setEditType] = useState(voucher.type || 'VALUE');
  const [editFamilyId, setEditFamilyId] = useState<string | null>(voucher.family_id);

  useEffect(() => {
    setEditTitle(voucher.title || '');
    setEditStore(voucher.store || '');
    setEditAmount(voucher.remaining_amount?.toString() || '0');
    setEditCurrency(voucher.currency || 'CHF');
    setEditCode(voucher.code || '');
    setEditPin(voucher.pin || '');
    setEditExpiry(voucher.expiry_date || '');
    setEditWebsite(voucher.website || '');
    setEditType(voucher.type || 'VALUE');
    setEditFamilyId(voucher.family_id);
  }, [voucher, isEditing]);

  const remaining = Number(voucher.remaining_amount || 0);
  const initial = Number(voucher.initial_amount || 1);
  const progress = Math.min(100, Math.max(0, (remaining / initial) * 100));

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editStore.trim()) {
      Alert.alert("Fehler", "Titel und Geschäft dürfen nicht leer sein.");
      return;
    }
    setIsProcessing(true);
    try {
      await onUpdateVoucher({
        ...voucher,
        title: editTitle.trim(),
        store: editStore.trim(),
        remaining_amount: parseFloat(editAmount.replace(',', '.')) || 0,
        currency: editCurrency,
        code: editCode.trim(),
        pin: editPin.trim(),
        expiry_date: editExpiry.trim(),
        website: editWebsite.trim(),
        type: editType,
        family_id: editFamilyId
      });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Fehler", "Speichern fehlgeschlagen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRedemption = async () => {
    const val = parseFloat(redeemInput.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert("Fehler", "Bitte einen gültigen Betrag eingeben.");
      return;
    }
    if (val > remaining) {
      Alert.alert("Fehler", "Der Betrag ist höher als das Restguthaben.");
      return;
    }

    setIsProcessing(true);
    setShowRedeemModal(false);
    try {
      const newAmount = Math.max(0, remaining - val);

      const newHistoryEntry: Redemption = {
        id: Date.now().toString(),
        voucher_id: voucher.id,
        amount: val,
        timestamp: new Date().toISOString(),
        user_name: owner?.name || 'Benutzer'
      };

      await onUpdateVoucher({
        ...voucher,
        remaining_amount: newAmount,
        history: [newHistoryEntry, ...(voucher.history || [])]
      });
    } catch (err: any) {
      Alert.alert("Fehler", "Update fehlgeschlagen.");
    } finally {
      setIsProcessing(false);
      setRedeemInput('');
    }
  };

  const formatDate = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
    let res = cleaned;
    if (cleaned.length > 2) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2);
    if (cleaned.length > 4) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2, 4) + '.' + cleaned.substring(4);
    return res;
  };

  if (isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.circleBtn}><Icon name="close-outline" size={24} color="#4b5563" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Bearbeiten</Text>
          <TouchableOpacity onPress={handleSaveEdit} style={styles.saveHeaderBtn} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>OK</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}><Text style={styles.label}>Bezeichnung</Text><TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="z.B. Shopping Gutschein" /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>Geschäft</Text><TextInput style={styles.input} value={editStore} onChangeText={setEditStore} placeholder="z.B. Zalando" /></View>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: editType === 'VALUE' ? 12 : 0 }}><Text style={styles.label}>{editType === 'VALUE' ? 'Restbetrag' : 'Restanzahl'}</Text><TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" /></View>
            {editType === 'VALUE' && (
              <View style={{ flex: 1 }}><Text style={styles.label}>Währung</Text><TextInput style={styles.input} value={editCurrency} onChangeText={setEditCurrency} /></View>
            )}
          </View>
          <View style={styles.inputGroup}><Text style={styles.label}>Ablaufdatum (TT.MM.JJJJ)</Text><TextInput style={styles.input} value={editExpiry} onChangeText={(t) => setEditExpiry(formatDate(t))} maxLength={10} keyboardType="numeric" placeholder="31.12.2025" /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>Gutscheinnummer</Text><TextInput style={styles.input} value={editCode} onChangeText={setEditCode} placeholder="Gutschein-Code" /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>PIN</Text><TextInput style={styles.input} value={editPin} onChangeText={setEditPin} placeholder="PIN-Code" /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>Webseite</Text><TextInput style={styles.input} value={editWebsite} onChangeText={setEditWebsite} placeholder="https://example.com" autoCapitalize="none" keyboardType="url" /></View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gutscheintyp</Text>
            <View style={styles.familySelect}>
              <TouchableOpacity style={[styles.familyItem, editType === 'VALUE' && styles.familyItemActive]} onPress={() => setEditType('VALUE')}>
                <Text style={[styles.familyItemText, editType === 'VALUE' && styles.familyItemTextActive]}>Wert-Gutschein</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.familyItem, editType === 'QUANTITY' && styles.familyItemActive]} onPress={() => setEditType('QUANTITY')}>
                <Text style={[styles.familyItemText, editType === 'QUANTITY' && styles.familyItemTextActive]}>Anzahl-Gutschein</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teilen mit Gruppe</Text>
            <View style={styles.familySelect}>
              <TouchableOpacity style={[styles.familyItem, editFamilyId === null && styles.familyItemActive]} onPress={() => setEditFamilyId(null)}>
                <Text style={[styles.familyItemText, editFamilyId === null && styles.familyItemTextActive]}>Privat</Text>
              </TouchableOpacity>
              {families.map(f => (
                <TouchableOpacity key={f.id} style={[styles.familyItem, editFamilyId === f.id && styles.familyItemActive]} onPress={() => setEditFamilyId(f.id)}>
                  <Text style={[styles.familyItemText, editFamilyId === f.id && styles.familyItemTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.circleBtn}><Icon name="chevron-back-outline" size={24} color="#4b5563" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Gutschein Details</Text>
        <TouchableOpacity style={styles.circleBtn} onPress={() => setIsEditing(true)}><Icon name="create-outline" size={24} color="#2563eb" /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          {voucher.image_url ? (
            <Image source={{ uri: voucher.image_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: '#2563eb' }]}>
              <Icon name="ticket-outline" size={100} color="rgba(255,255,255,0.3)" />
              <Text style={styles.placeholderStore}>{voucher.store}</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.storeName}>{voucher.store}</Text>
              <Text style={styles.voucherTitle}>{voucher.title}</Text>
            </View>
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerText}>Von: {owner?.name || 'Unbekannt'}</Text>
            </View>
          </View>

          <View style={styles.balanceContainer}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>{remaining.toFixed(2)}<Text style={styles.balanceCurrency}> {voucher.currency}</Text></Text>
              <Text style={styles.initialText}>von {Number(voucher.initial_amount || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: progress < 20 ? '#ef4444' : '#2563eb' }]} />
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>NUMMER</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{voucher.code || '–'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>PIN</Text>
              <View style={styles.pinContainer}>
                <Text style={styles.infoValue}>{showPin ? (voucher.pin || '–') : (voucher.pin ? '••••' : '–')}</Text>
                {voucher.pin && (
                  <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.pinToggle}>
                    <Icon name={showPin ? "eye-off-outline" : "eye-outline"} size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>ABLAUFDATUM</Text>
              <Text style={[styles.infoValue, { color: '#2563eb' }]}>{voucher.expiry_date || 'Unbegrenzt'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>GETEILT</Text>
              <Text style={styles.infoValue}>{family?.name || 'Privat'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Transaktionsverlauf</Text>
            {(!voucher.history || voucher.history.length === 0) ? (
              <View style={styles.emptyHistory}>
                <Icon name="receipt-outline" size={32} color="#e2e8f0" />
                <Text style={styles.noHistory}>Bisher keine Einlösungen erfasst.</Text>
              </View>
            ) : (
              voucher.history.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <View style={[styles.historyIcon, { backgroundColor: '#fef2f2' }]}><Icon name="remove" size={16} color="#ef4444" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyUser}>{entry.user_name}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(entry.timestamp).toLocaleDateString('de-DE')} • {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount}>– {Number(entry.amount || 0).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.useButton, remaining <= 0 && styles.useButtonDisabled]}
              onPress={() => setShowRedeemModal(true)}
              disabled={remaining <= 0}
            >
              <Text style={styles.useButtonText}>Betrag abziehen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => setShowConfirmDelete(true)}>
              <Icon name="trash-outline" size={20} color="#ef4444" />
              <Text style={styles.deleteBtnText}>Löschen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Redeem Modal */}
      <Modal visible={showRedeemModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Einlösen</Text>
            <Text style={styles.modalSubtitle}>Wieviel möchtest du vom Gutschein abziehen?</Text>
            <View style={styles.modalInputWrapper}>
              <TextInput
                style={styles.modalInput}
                value={redeemInput}
                onChangeText={setRedeemInput}
                keyboardType="numeric"
                autoFocus
                placeholder="0.00"
              />
              <Text style={styles.modalCurrency}>{voucher.currency}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowRedeemModal(false); setRedeemInput(''); }}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={executeRedemption}>
                <Text style={styles.modalConfirmText}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showConfirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.deleteIconCircle}>
              <Icon name="trash" size={30} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Gutschein löschen?</Text>
            <Text style={styles.modalSubtitle}>Diese Aktion kann nicht rückgängig gemacht werden. Möchtest du wirklich fortfahren?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfirmDelete(false)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: '#ef4444' }]} onPress={() => onDeleteVoucher(voucher.id)}>
                <Text style={styles.modalConfirmText}>Ja, löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    zIndex: 10
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  saveHeaderBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 14 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  hero: { width: '100%', height: 280, backgroundColor: '#e2e8f0', position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  placeholderStore: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 10, opacity: 0.8 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0)' },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -30,
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 40
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  storeName: { fontSize: 12, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
  voucherTitle: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 4 },
  ownerBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ownerText: { fontSize: 10, fontWeight: '700', color: '#64748b' },

  balanceContainer: { marginBottom: 25 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  balanceValue: { fontSize: 42, fontWeight: '900', color: '#111827' },
  balanceCurrency: { fontSize: 20, color: '#94a3b8' },
  initialText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  progressBarContainer: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  infoBox: { width: (width - 80) / 2, backgroundColor: '#f8fafc', padding: 14, borderRadius: 18 },
  infoLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 4, letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  pinContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinToggle: { padding: 2 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 24 },

  historySection: { marginBottom: 30 },
  historyTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 16 },
  emptyHistory: { alignItems: 'center', paddingVertical: 10 },
  noHistory: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginTop: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  historyIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyUser: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  historyDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  historyAmount: { fontSize: 16, fontWeight: '900', color: '#ef4444' },

  actionRow: { marginTop: 10 },
  useButton: { height: 60, backgroundColor: '#111827', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  useButtonDisabled: { opacity: 0.3 },
  useButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  deleteButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14, marginLeft: 8 },

  // Edit Mode Styles
  formContent: { padding: 20, paddingBottom: 100 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8, marginLeft: 4 },
  input: { height: 56, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, fontSize: 16, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row' },
  familySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  familyItem: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  familyItemActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  familyItemText: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  familyItemTextActive: { color: '#fff' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', width: '100%', maxWidth: 340, borderRadius: 28, padding: 24, alignItems: 'center' },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 12, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 20, height: 70, marginBottom: 24, width: '100%' },
  modalInput: { flex: 1, fontSize: 32, fontWeight: '900', color: '#111827', textAlign: 'center' },
  modalCurrency: { fontSize: 18, fontWeight: '800', color: '#94a3b8', marginLeft: 10 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: { flex: 1, height: 54, justifyContent: 'center', alignItems: 'center', borderRadius: 18, backgroundColor: '#f1f5f9' },
  modalCancelText: { fontWeight: '700', color: '#64748b' },
  modalConfirm: { flex: 1, height: 54, backgroundColor: '#2563eb', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
});

export default VoucherDetail;
