
import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Voucher, Family, VoucherType } from '../types';
import { supabaseService } from '../services/supabase';
import Icon from './Icon';

interface AddVoucherProps {
  families: Family[];
  onCancel: () => void;
  onSave: (v: Omit<Voucher, 'id'>) => void;
}

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

const AddVoucher: React.FC<AddVoucherProps> = ({ families, onCancel, onSave }) => {
  const [title, setTitle] = useState('');
  const [store, setStore] = useState('');
  const [type, setType] = useState<VoucherType>('VALUE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [expiry, setExpiry] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [website, setWebsite] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const [showScanModal, setShowScanModal] = useState(false);
  const [scannedData, setScannedData] = useState<{
    title: string;
    store: string;
    amount: string;
    currency: string;
    type: VoucherType;
    expiry?: string;
    code?: string;
    pin?: string;
  } | null>(null);

  const formatDate = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
    let res = cleaned;
    if (cleaned.length > 2) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2);
    if (cleaned.length > 4) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2, 4) + '.' + cleaned.substring(4);
    return res;
  };

  const handleSubmit = () => {
    if (!title.trim() || !store.trim() || !amount.trim()) {
      alert("Fehler: Titel, Geschäft und Betrag sind erforderlich.");
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount)) {
      alert("Fehler: Bitte einen gültigen Betrag eingeben.");
      return;
    }

    onSave({
      title: title.trim(),
      store: store.trim(),
      type,
      initial_amount: numericAmount,
      remaining_amount: numericAmount,
      currency: type === 'VALUE' ? currency : 'x',
      expiry_date: expiry.trim() || null,
      code: code.trim(),
      pin: pin.trim(),
      website: website.trim(),
      family_id: familyId,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      user_id: '',
      history: []
    });
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') {
          alert('Kamerazugriff erforderlich');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri && asset.base64) {
          processImage(asset.base64, asset.uri, asset.fileName || 'voucher.jpg');
        }
      }
    } catch (e) {
      console.error("Fehler beim Bildwählen:", e);
      alert("Fehler beim Laden des Bildes.");
    }
  };

  const processImage = async (base64: string, uri: string, fileName: string = 'voucher.jpg') => {
    setIsAnalyzing(true);
    try {
      // Use URI for upload (more robust on Native), base64 for AI analysis
      const uploadedUrl = await supabaseService.uploadVoucherImage(uri, fileName, 'image/jpeg');
      if (uploadedUrl) setImageUrl(uploadedUrl);
      else setImageUrl(uri);

      // Use direct REST API to avoid environment issues with @google/genai SDK in React Native
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Extrahiere store, title, amount, currency, voucherType ('VALUE' oder 'QUANTITY'), expiryDate (Format DD.MM.YYYY), code (Gutscheinnummer) und pin. Antworte NUR im JSON Format." },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });

      const data = await response.json();
      console.log('AI API Response:', JSON.stringify(data, null, 2));

      let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      console.log('AI Result Text:', resultText);

      const result = JSON.parse(resultText);
      console.log('Parsed Result:', result);

      setScannedData({
        title: result.title || '',
        store: result.store || '',
        amount: result.amount ? result.amount.toString() : '',
        currency: (result.currency || 'CHF').toUpperCase(),
        type: (result.voucherType as VoucherType) || 'VALUE',
        expiry: result.expiryDate || '',
        code: result.code || '',
        pin: result.pin || ''
      });
      setShowScanModal(true);

    } catch (error) {
      console.error("AI Scan Error:", error);
      alert("KI Scan: Daten konnten nicht automatisch erkannt werden.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.backButton}>
            <Icon name="chevron-back" size={24} color="#4b5563" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hinzufügen</Text>
        </View>

        <View style={styles.scanSection}>
          <View style={styles.scanActions}>
            <TouchableOpacity style={[styles.scanActionBtn, isAnalyzing && styles.scanButtonDisabled]} onPress={() => pickImage('camera')} disabled={isAnalyzing}>
              <View style={[styles.scanIconBox, { backgroundColor: '#eff6ff' }]}>
                {isAnalyzing ? <ActivityIndicator color="#2563eb" /> : <Icon name="camera" size={28} color="#2563eb" />}
              </View>
              <Text style={styles.scanActionLabel}>KI Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scanActionBtn, isAnalyzing && styles.scanButtonDisabled]} onPress={() => pickImage('gallery')} disabled={isAnalyzing}>
              <View style={[styles.scanIconBox, { backgroundColor: '#f0fdf4' }]}>
                <Icon name="images" size={28} color="#10b981" />
              </View>
              <Text style={styles.scanActionLabel}>Galerie</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bezeichnung</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Gutschein Name" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Geschäft</Text>
            <TextInput style={styles.input} value={store} onChangeText={setStore} placeholder="z.B. Migros, Zalando" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gutscheintyp</Text>
            <View style={styles.familySelect}>
              <TouchableOpacity style={[styles.familyItem, type === 'VALUE' && styles.familyItemActive]} onPress={() => setType('VALUE')}>
                <Text style={[styles.familyItemText, type === 'VALUE' && styles.familyItemTextActive]}>Wert-Gutschein</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.familyItem, type === 'QUANTITY' && styles.familyItemActive]} onPress={() => setType('QUANTITY')}>
                <Text style={[styles.familyItemText, type === 'QUANTITY' && styles.familyItemTextActive]}>Anzahl-Gutschein</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>{type === 'VALUE' ? 'Guthaben' : 'Anzahl'}</Text>
              <View style={styles.amountInputContainer}>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={type === 'VALUE' ? '0.00' : '0'} placeholderTextColor="#9ca3af" />
                {type === 'VALUE' && (
                  <TouchableOpacity style={styles.currencyBadge} onPress={() => setShowCurrencyPicker(true)}>
                    <Text style={styles.currencyBadgeText}>{currency}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ablaufdatum</Text>
              <TextInput style={styles.input} value={expiry} onChangeText={(t) => setExpiry(formatDate(t))} placeholder="TT.MM.JJJJ" keyboardType="numeric" placeholderTextColor="#9ca3af" maxLength={10} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Nummer</Text>
              <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Nummer" placeholderTextColor="#9ca3af" />
            </View>
            <View style={[styles.inputGroup, { flex: 0.5 }]}>
              <Text style={styles.label}>PIN</Text>
              <TextInput style={styles.input} value={pin} onChangeText={setPin} placeholder="PIN" placeholderTextColor="#9ca3af" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Webseite</Text>
            <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="https://example.com" placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="url" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gruppe (Teilen)</Text>
            <View style={styles.familySelect}>
              <TouchableOpacity style={[styles.familyItem, familyId === null && styles.familyItemActive]} onPress={() => setFamilyId(null)}>
                <Text style={[styles.familyItemText, familyId === null && styles.familyItemTextActive]}>Privat</Text>
              </TouchableOpacity>
              {families.map(f => (
                <TouchableOpacity key={f.id} style={[styles.familyItem, familyId === f.id && styles.familyItemActive]} onPress={() => setFamilyId(f.id)}>
                  <Text style={[styles.familyItemText, familyId === f.id && styles.familyItemTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
            <Text style={styles.saveButtonText}>Gutschein speichern</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCurrencyPicker(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Währung wählen</Text>
            {CURRENCIES.map(cur => (
              <TouchableOpacity key={cur} style={styles.pickerItem} onPress={() => { setCurrency(cur); setShowCurrencyPicker(false); }}>
                <Text style={[styles.pickerItemText, currency === cur && { color: '#2563eb', fontWeight: '800' }]}>{cur}</Text>
                {currency === cur && <Icon name="checkmark" size={18} color="#2563eb" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Scan Preview Modal */}
      <Modal visible={showScanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>KI Scan Ergebnis</Text>
            {scannedData && (
              <View>
                <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 15 }}>Gefundene Daten:</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Titel:</Text> {scannedData.title}</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Geschäft:</Text> {scannedData.store}</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Betrag:</Text> {scannedData.amount} {scannedData.currency}</Text>
                {scannedData.expiry && <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Ablauf:</Text> {scannedData.expiry}</Text>}
                {scannedData.code && <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Nummer:</Text> {scannedData.code}</Text>}
                {scannedData.pin && <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>PIN:</Text> {scannedData.pin}</Text>}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 50, backgroundColor: '#f1f5f9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => { setShowScanModal(false); setScannedData(null); }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 50, backgroundColor: '#2563eb', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  if (scannedData) {
                    setTitle(scannedData.title);
                    setStore(scannedData.store);
                    setAmount(scannedData.amount);
                    setCurrency(scannedData.currency);
                    setType(scannedData.type);
                    if (scannedData.expiry) setExpiry(scannedData.expiry);
                    if (scannedData.code) setCode(scannedData.code);
                    if (scannedData.pin) setPin(scannedData.pin);
                  }
                  setShowScanModal(false);
                  setScannedData(null);
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Übernehmen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '900', marginLeft: 16, color: '#111827' },
  scanSection: { marginBottom: 20 },
  scanActions: { flexDirection: 'row', gap: 12 },
  scanActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 16, shadowOpacity: 0.05, shadowRadius: 5 },
  scanIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  scanActionLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  form: { paddingBottom: 20 },
  inputGroup: { marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 4 },
  input: { height: 56, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 20, borderWidth: 1, borderColor: '#f1f5f9', fontSize: 16, color: '#1e293b' },
  row: { flexDirection: 'row' },
  amountInputContainer: { position: 'relative' },
  currencyBadge: { position: 'absolute', right: 10, top: 10, backgroundColor: '#eff6ff', paddingHorizontal: 12, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  currencyBadgeText: { fontSize: 13, fontWeight: '800', color: '#2563eb' },
  familySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  familyItem: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  familyItemActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  familyItemText: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  familyItemTextActive: { color: '#fff' },
  saveButton: { height: 62, backgroundColor: '#111827', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  scanButtonDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#fff', width: '80%', borderRadius: 24, padding: 20 },
  pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 16, fontWeight: '600' }
});

export default AddVoucher;
