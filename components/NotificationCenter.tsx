
import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { AppNotification } from '../types';
import Icon from './Icon';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onBack: () => void;
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onBack, onClearAll, onMarkAsRead }) => {
  const getIconForType = (type: string) => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#10b981' };
      case 'warning': return { name: 'alert-circle', color: '#ef4444' };
      default: return { name: 'information-circle', color: '#3b82f6' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.circleBtn} activeOpacity={0.7}>
          <Icon name="chevron-back-outline" size={24} color="#4b5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Benachrichtigungen</Text>
        <TouchableOpacity onPress={onClearAll} style={styles.clearBtn} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>Löschen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="notifications-off-outline" size={80} color="#e2e8f0" />
            <Text style={styles.emptyText}>Alles erledigt!</Text>
            <Text style={styles.emptySubText}>Du hast zurzeit keine neuen Benachrichtigungen.</Text>
          </View>
        ) : (
          notifications.map(item => {
            const icon = getIconForType(item.type);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationCard, !item.read && styles.unreadCard]}
                onPress={() => onMarkAsRead(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: icon.color + '10' }]}>
                  <Icon name={icon.name} size={22} color={icon.color} />
                </View>
                <View style={styles.contentBox}>
                  <View style={styles.titleRow}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.notifBody}>{item.body}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  list: { padding: 20, paddingBottom: 60 },
  notificationCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2, position: 'relative' },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  contentBox: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  timestamp: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  notifBody: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  unreadDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 20, fontWeight: '900', color: '#334155', marginTop: 20 },
  emptySubText: { fontSize: 15, color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 22 }
});

export default NotificationCenter;
