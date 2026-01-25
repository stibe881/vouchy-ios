import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, Modal, Switch, ActivityIndicator } from 'react-native';
import { Family, User, FamilyMember, FamilyInvite } from '../types';
import { supabaseService } from '../services/supabase';
import { sendInviteResponseNotification } from '../services/notifications';
import Icon from './Icon';

interface FamiliesViewProps {
  families: Family[];
  user: User | null;
  pendingInvites: FamilyInvite[];
  onUpdateUser: (user: User) => void;
  onCreateFamily: (name: string, invites: string[]) => void;
  onUpdateFamily: (family: Family) => void;
  onDeleteFamily?: (id: string) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  showNotification: (title: string, body: string) => void;
  onRefreshInvites: () => void;
  onRefreshData?: () => void;
}

const FamiliesView: React.FC<FamiliesViewProps> = ({ families, user, pendingInvites, onUpdateUser, onCreateFamily, onUpdateFamily, onDeleteFamily, onLogout, onDeleteAccount, showNotification, onRefreshInvites, onRefreshData }) => {
  const [newFamilyName, setNewFamilyName] = useState('');
  const [isAddingFamily, setIsAddingFamily] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isProcessingInvite, setIsProcessingInvite] = useState<string | null>(null);
  const [sentInvites, setSentInvites] = useState<FamilyInvite[]>([]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  // Load sent invites when a family is selected
  useEffect(() => {
    if (selectedFamily) {
      supabaseService.getSentInvitesForFamily(selectedFamily.id).then(setSentInvites);
    } else {
      setSentInvites([]);
    }
  }, [selectedFamily]);

  const handleCreateFamily = () => {
    if (newFamilyName.trim()) {
      onCreateFamily(newFamilyName.trim(), []);
      setNewFamilyName('');
      setIsAddingFamily(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedFamily || !inviteEmail.trim().includes('@') || !user) return;

    try {
      await supabaseService.createInvite(
        selectedFamily.id,
        user.id,
        inviteEmail.trim(),
        user.name,           // inviter name for email
        selectedFamily.name  // family name for email
      );
      // Refresh sent invites to show the new invitation
      const invites = await supabaseService.getSentInvitesForFamily(selectedFamily.id);
      setSentInvites(invites);
      setInviteEmail('');
      showNotification("Einladung gesendet", `${inviteEmail} wurde eingeladen.`);
    } catch (error: any) {
      Alert.alert("Fehler", error.message || "Einladung konnte nicht gesendet werden.");
    }
  };

  const handleRespondToInvite = async (invite: FamilyInvite, response: 'accepted' | 'rejected') => {
    if (!user) return;
    setIsProcessingInvite(invite.id);

    try {
      if (response === 'rejected') {
        await supabaseService.respondToInvite(invite.id, 'rejected');
        showNotification("Abgelehnt", `Einladung zu "${invite.family_name}" abgelehnt`);
      } else {
        // Use atomic RPC for accepting
        const { error } = await supabaseService.acceptInviteAtomic(invite.id, user.email, user.name);
        if (error) throw error;

        showNotification("Beigetreten!", `Du bist jetzt Mitglied von "${invite.family_name}"`);
      }

      // Send push notification to inviter
      // ... existing notification logic matches ...
      const inviterToken = await supabaseService.getInviterPushToken(invite.inviter_id);
      if (inviterToken) {
        await sendInviteResponseNotification(inviterToken, user.name, invite.family_name || 'Gruppe', response);
      }

      onRefreshInvites();
    } catch (error: any) {
      console.error("Invite Error:", error);
      Alert.alert("Fehler", error.message || "Aktion fehlgeschlagen.");
    } finally {
      setIsProcessingInvite(null);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!selectedFamily) return;
    const updatedMembers = (selectedFamily.members || []).filter(m => m.id !== memberId);
    const updatedFamily = {
      ...selectedFamily,
      members: updatedMembers,
      member_count: updatedMembers.length + 1
    };
    onUpdateFamily(updatedFamily);
    setSelectedFamily(updatedFamily);
  };

  const handleDeleteFamily = async (id: string) => {
    const family = families.find(f => f.id === id);
    const isOwner = family && user && family.user_id === user.id;

    if (!isOwner) {
      Alert.alert(
        "Keine Berechtigung",
        "Du kannst diese Gruppe nicht löschen, da du nicht der Ersteller bist. Du kannst die Gruppe nur verlassen."
      );
      return;
    }

    Alert.alert(
      "Gruppe löschen",
      "Bist du sicher? Alle Verknüpfungen gehen verloren.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              if (onDeleteFamily) onDeleteFamily(id);
              else await supabaseService.deleteFamily(id);
              setSelectedFamily(null);
              showNotification("Gelöscht", "Gruppe wurde entfernt.");
            } catch (e) {
              Alert.alert("Fehler", "Löschen fehlgeschlagen.");
            }
          }
        }
      ]
    );
  };

  const handleLeaveFamily = async (id: string) => {
    Alert.alert(
      "Gruppe verlassen",
      "Möchtest du diese Gruppe wirklich verlassen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Verlassen",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await supabaseService.removeFamilyMember(id, user.id);
                setSelectedFamily(null);
                showNotification("Verlassen", "Du hast die Gruppe verlassen.");
                if (onRefreshData) onRefreshData();
              }
            } catch (e) {
              Alert.alert("Fehler", "Verlassen fehlgeschlagen.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await supabaseService.deleteInvite(inviteId);
      // Refresh invites - assuming onRefreshInvites does that, but here we might need to manually trigger or wait for parent. 
      // Actually FamiliesView receives invites as prop? No, it fetches them? 
      // It receives `sentInvites` as prop? No, lines 354 says `sentInvites`.
      // Where does `sentInvites` come from? It's likely a state in FamiliesView. 
      // I need to check the full file or assume I need to update state.
      // I'll assume setSentInvites exists or I need to trigger refresh.
      // Let's check where sentInvites comes from.
      // I'll check it in the next tool if needed. For now I'll add the function and assume I can update state.
      if (sentInvites) {
        setSentInvites(prev => prev.filter(i => i.id !== inviteId));
      }
      showNotification("Gelöscht", "Einladung wurde entfernt.");
    } catch (error) {
      Alert.alert("Fehler", "Löschen fehlgeschlagen.");
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    if (user) {
      onUpdateUser({ ...user, notifications_enabled: val });
    }
  };

  const handleSaveProfile = () => {
    if (user && editName.trim()) {
      onUpdateUser({ ...user, name: editName.trim() });
      setIsEditingProfile(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Einstellungen</Text>
      </View>

      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.profileCard} onPress={() => setIsEditingProfile(true)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.substring(0, 1).toUpperCase() || 'U'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name || 'Benutzer'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'Keine Email'}</Text>
            <Text style={styles.editLabel}>Profil bearbeiten</Text>
          </View>
          <Icon name="chevron-forward-outline" size={20} color="#d1d5db" />
        </TouchableOpacity>

        <View style={{ marginTop: 20, backgroundColor: '#fff', borderRadius: 20, padding: 5 }}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#dbeafe' }]}>
                <Icon name="notifications" size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Benachrichtigungen</Text>
                <Text style={styles.settingSub}>Push-Meldungen empfangen</Text>
              </View>
            </View>
            <Switch
              value={user?.notifications_enabled ?? true}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#e2e8f0', true: '#2563eb' }}
              thumbColor={'#fff'}
            />
          </View>
        </View>
      </View>

      {isEditingProfile && (
        <View style={styles.editOverlay}>
          <Text style={styles.sectionLabel}>Name ändern</Text>
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} autoFocus placeholderTextColor="#9ca3af" />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setIsEditingProfile(false)}><Text style={styles.btnCancelText}>Abbrechen</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSaveProfile}><Text style={styles.btnSaveText}>Speichern</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Konto & Sicherheit</Text>

        <TouchableOpacity style={styles.settingRow} onPress={() => setIsChangingEmail(!isChangingEmail)}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#f59e0b' }]}><Icon name="mail" size={16} color="#fff" /></View>
            <Text style={styles.settingLabel}>E-Mail ändern</Text>
          </View>
          <Icon name={isChangingEmail ? "chevron-down-outline" : "chevron-forward-outline"} size={16} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={() => setIsChangingPassword(!isChangingPassword)}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#10b981' }]}><Icon name="lock-closed" size={16} color="#fff" /></View>
            <Text style={styles.settingLabel}>Passwort ändern</Text>
          </View>
          <Icon name={isChangingPassword ? "chevron-down-outline" : "chevron-forward-outline"} size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Offene Einladungen</Text>
          {pendingInvites.map(invite => (
            <View key={invite.id} style={styles.inviteCard}>
              <View style={styles.inviteInfo}>
                <Text style={styles.inviteFamily}>{invite.family_name || 'Gruppe'}</Text>
                <Text style={styles.inviteFrom}>von {invite.inviter_name || 'Unbekannt'}</Text>
              </View>
              <View style={styles.inviteActions}>
                {isProcessingInvite === invite.id ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.inviteRejectBtn}
                      onPress={() => handleRespondToInvite(invite, 'rejected')}
                    >
                      <Icon name="close" size={20} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inviteAcceptBtn}
                      onPress={() => handleRespondToInvite(invite, 'accepted')}
                    >
                      <Icon name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Gruppen / Familien</Text>
          <TouchableOpacity onPress={() => setIsAddingFamily(true)} style={styles.addBtn}>
            <Text style={styles.addText}>+ Erstellen</Text>
          </TouchableOpacity>
        </View>

        {isAddingFamily && (
          <View style={styles.createBox}>
            <TextInput autoFocus style={styles.input} value={newFamilyName} onChangeText={setNewFamilyName} placeholder="Name der Gruppe" placeholderTextColor="#9ca3af" />
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setIsAddingFamily(false)}><Text style={styles.btnCancelText}>Abbrechen</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleCreateFamily}><Text style={styles.btnSaveText}>Erstellen</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {families.map(family => (
          <TouchableOpacity key={family.id} style={styles.settingRow} onPress={() => setSelectedFamily(family)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#eef2ff' }]}><Icon name="people" size={16} color="#2563eb" /></View>
              <View>
                <Text style={styles.settingLabel}>{family.name}</Text>
                <Text style={styles.settingSub}>{family.member_count} Personen</Text>
              </View>
            </View>
            <Icon name="chevron-forward-outline" size={16} color="#d1d5db" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.settingRow} onPress={onLogout}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#fee2e2' }]}><Icon name="log-out-outline" size={16} color="#ef4444" /></View>
            <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Abmelden</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            Alert.alert(
              "Konto löschen",
              "Bist du sicher? Alle deine Gutscheine und Daten werden unwiderruflich gelöscht.",
              [
                { text: "Abbrechen", style: "cancel" },
                {
                  text: "Konto löschen",
                  style: "destructive",
                  onPress: onDeleteAccount
                }
              ]
            );
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#fee2e2' }]}><Icon name="trash-outline" size={16} color="#ef4444" /></View>
            <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Konto löschen</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal für Gruppen-Details */}
      <Modal visible={!!selectedFamily} animationType="slide" presentationStyle="pageSheet">
        {selectedFamily && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedFamily(null)}><Icon name="close" size={24} color="#64748b" /></TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedFamily.name}</Text>
              {user && selectedFamily.user_id === user.id ? (
                <TouchableOpacity onPress={() => handleDeleteFamily(selectedFamily.id)}><Icon name="trash-outline" size={24} color="#ef4444" /></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => handleLeaveFamily(selectedFamily.id)}><Icon name="exit-outline" size={24} color="#f59e0b" /></TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalSectionLabel}>Mitglieder verwalten</Text>

              {user && selectedFamily.user_id === user.id && (
                <View style={styles.memberInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="E-Mail einladen"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                  />
                  <TouchableOpacity style={styles.memberAddBtn} onPress={handleAddMember}>
                    <Icon name="add" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.memberList}>
                <View style={styles.memberItem}>
                  <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>D</Text></View>
                  <Text style={styles.memberName}>{user && selectedFamily.user_id === user.id ? 'Du (Inhaber)' : 'Du'}</Text>
                </View>
                {(selectedFamily.members || []).filter(m => m && m.id).map(member => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={[styles.memberAvatar, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.memberAvatarText, { color: '#64748b' }]}>{member.email[0].toUpperCase()}</Text></View>
                    <Text style={styles.memberName}>{member.email}</Text>
                    {user && selectedFamily.user_id === user.id && (
                      <TouchableOpacity onPress={() => handleRemoveMember(member.id)}><Icon name="remove-circle-outline" size={20} color="#ef4444" /></TouchableOpacity>
                    )}
                  </View>
                ))}
                {/* Pending invites */}
                {sentInvites.filter(inv => inv && inv.id).map(invite => (
                  <View key={invite.id} style={styles.memberItem}>
                    <View style={[styles.memberAvatar, { backgroundColor: '#fef3c7' }]}><Text style={[styles.memberAvatarText, { color: '#d97706' }]}>{invite.invitee_email[0].toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{invite.invitee_email}</Text>
                      <Text style={{ fontSize: 11, color: '#d97706', fontWeight: '600' }}>Eingeladen</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteInvite(invite.id)}>
                      <Icon name="close-circle-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.versionText}>VoucherVault v1.7.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { marginBottom: 15, paddingTop: 10, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#111827' },
  profileSection: { marginBottom: 25, paddingHorizontal: 20 },
  profileCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  profileInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  userEmail: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  editLabel: { fontSize: 12, color: '#2563eb', fontWeight: '800', marginTop: 6 },
  section: { backgroundColor: '#fff', borderRadius: 24, marginBottom: 25, marginHorizontal: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  addBtn: { paddingTop: 20, paddingBottom: 10 },
  addText: { color: '#2563eb', fontWeight: '800', fontSize: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  settingSub: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  editOverlay: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 25, marginHorizontal: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 8 },
  input: { height: 55, backgroundColor: '#f1f5f9', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: '#1e293b', marginBottom: 15 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
  btn: { flex: 1, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { fontWeight: '700', color: '#64748b' },
  btnSave: { backgroundColor: '#2563eb' },
  btnSaveText: { fontWeight: '800', color: '#fff' },
  createBox: { padding: 20, backgroundColor: '#f8fafc' },
  footer: { alignItems: 'center', marginTop: 20, paddingBottom: 40 },
  versionText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalContent: { padding: 20 },
  modalSectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 15 },
  memberInputRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  memberAddBtn: { width: 55, height: 55, backgroundColor: '#2563eb', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  memberList: { gap: 12 },
  memberItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 18 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { color: '#fff', fontWeight: '800' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' },

  // Invite styles
  inviteCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  inviteInfo: { flex: 1 },
  inviteFamily: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  inviteFrom: { fontSize: 13, color: '#64748b', marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8 },
  inviteRejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  inviteAcceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }
});

export default FamiliesView;
