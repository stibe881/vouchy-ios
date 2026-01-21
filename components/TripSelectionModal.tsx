import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, SafeAreaView, Image } from 'react-native';
import { Trip } from '../types';
import Icon from './Icon';

interface TripSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (trip: Trip | null) => void;
    trips: Trip[];
    selectedTripId: number | null;
}

const TripSelectionModal: React.FC<TripSelectionModalProps> = ({ visible, onClose, onSelect, trips, selectedTripId }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredTrips, setFilteredTrips] = useState<Trip[]>(trips);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredTrips(trips);
        } else {
            const lower = searchQuery.toLowerCase();
            setFilteredTrips(trips.filter(t =>
                t.title.toLowerCase().includes(lower) ||
                t.destination.toLowerCase().includes(lower)
            ));
        }
    }, [searchQuery, trips]);

    const renderItem = ({ item }: { item: Trip }) => (
        <TouchableOpacity
            style={[styles.item, selectedTripId === item.id && styles.itemSelected]}
            onPress={() => {
                onSelect(item);
                onClose();
            }}
        >
            <View style={styles.iconBox}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.tripImage} resizeMode="cover" />
                ) : (
                    <Icon name="map-outline" size={20} color={selectedTripId === item.id ? "#fff" : "#64748b"} />
                )}
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.itemTitle, selectedTripId === item.id && styles.itemTextSelected]}>{item.title}</Text>
                    {item.status && item.status !== 'published' && (
                        <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{item.status}</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.itemSubtitle, selectedTripId === item.id && styles.itemTextSelected]}>{item.destination}</Text>
            </View>
            {selectedTripId === item.id && <Icon name="checkmark" size={20} color="#fff" />}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Ausflug wählen</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Icon name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Ausflug suchen..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={filteredTrips}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <TouchableOpacity
                            style={[styles.item, selectedTripId === null && styles.itemSelected]}
                            onPress={() => {
                                onSelect(null);
                                onClose();
                            }}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                                <Icon name="close" size={20} color="#64748b" />
                            </View>
                            <Text style={[styles.itemTitle, selectedTripId === null && styles.itemTextSelected]}>Kein Ausflug</Text>
                            {selectedTripId === null && <Icon name="checkmark" size={20} color="#fff" />}
                        </TouchableOpacity>
                    }
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    closeButton: { padding: 4 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 16, height: 50, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: '#0f172a', height: '100%' },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    item: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    itemSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' }, // Increased size slightly
    tripImage: { width: '100%', height: '100%' },
    itemTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    itemSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    itemTextSelected: { color: '#fff' }
});

export default TripSelectionModal;
