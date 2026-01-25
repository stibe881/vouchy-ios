
import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Voucher, Family, VoucherType, Trip, User } from '../types';
import { supabaseService } from '../services/supabase';
import Icon from './Icon';
import TripSelectionModal from './TripSelectionModal';

// Dynamic import to prevent crash in Expo Go
let DocumentScanner: any = null;
try {
  DocumentScanner = require('react-native-document-scanner-plugin').default;
} catch (e) {
  console.error('DocumentScanner loading failed:', e);
}

interface AddVoucherProps {
  families: Family[];
  currentUser: User | null;
  onCancel: () => void;
  onSave: (v: Omit<Voucher, 'id'>) => void;
}

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

const AddVoucher: React.FC<AddVoucherProps> = ({ families, currentUser, onCancel, onSave }) => {
  const [title, setTitle] = useState('');
  const [store, setStore] = useState('');
  const [category, setCategory] = useState('Shopping');
  const [type, setType] = useState<VoucherType>('VALUE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [expiry, setExpiry] = useState('');
  const [code, setCode] = useState('');
  const [codeList, setCodeList] = useState(''); // NEW: Multi-code input for QUANTITY
  const [pin, setPin] = useState('');
  const [website, setWebsite] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUrl2, setImageUrl2] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showSecondPageModal, setShowSecondPageModal] = useState(false);
  const [pendingFirstImage, setPendingFirstImage] = useState<{ base64: string, uri: string } | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]); // New Trip State
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);

  // Load trips on mount
  React.useEffect(() => {
    if (currentUser?.id) {
      console.log('Loading trips for user:', currentUser.id);
      supabaseService.getTrips(currentUser.id).then(data => {
        console.log('Loaded trips:', data.length);
        setTrips(data);
      });
    }
  }, [currentUser]);

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
    website?: string;
  } | null>(null);

  const formatDate = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
    let res = cleaned;
    if (cleaned.length > 2) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2);
    if (cleaned.length > 4) res = cleaned.substring(0, 2) + '.' + cleaned.substring(2, 4) + '.' + cleaned.substring(4);
    return res;
  };

  // Convert DD.MM.YYYY to YYYY-MM-DD for Supabase
  const convertDateToISO = (dateStr: string): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (day && month && year && year.length === 4) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return null;
  };

  const handleSubmit = () => {
    if (!title.trim() || !store.trim()) {
      alert("Fehler: Titel und Geschäft sind erforderlich.");
      return;
    }

    // Handle QUANTITY type with code pool
    let finalAmount = 0;
    let codePool = undefined;

    if (type === 'QUANTITY' && codeList.trim()) {
      // Parse codes from textarea (one per line)
      const codes = codeList
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      // Validate: no duplicates
      const uniqueCodes = new Set(codes);
      if (uniqueCodes.size !== codes.length) {
        alert("Fehler: Codes müssen eindeutig sein (keine Duplikate).");
        return;
      }

      // Create code pool
      codePool = codes.map(code => ({
        code,
        used: false
      }));

      finalAmount = codes.length;
    } else {
      // Regular single amount
      if (!amount.trim()) {
        alert("Fehler: Betrag/Anzahl ist erforderlich.");
        return;
      }
      finalAmount = parseFloat(amount.replace(',', '.'));
      if (isNaN(finalAmount)) {
        alert("Fehler: Bitte einen gültigen Betrag eingeben.");
        return;
      }
    }

    onSave({
      title: title.trim(),
      store: store.trim(),
      type,
      initial_amount: finalAmount,
      remaining_amount: finalAmount,
      currency: type === 'VALUE' ? currency : 'x',
      expiry_date: convertDateToISO(expiry),
      category,
      code: code.trim(),
      pin: pin.trim(),
      website: website.trim(),
      family_id: familyId,
      image_url: imageUrl,
      image_url_2: imageUrl2,
      created_at: new Date().toISOString(),
      user_id: '',
      history: [],
      trip_id: selectedTripId,
      code_pool: codePool // NEW: Add code pool if exists
    });
  };

  // Document scanner function for camera (with automatic edge detection)
  const scanDocument = async (isSecondPage: boolean = false) => {
    // Fallback to regular camera if DocumentScanner not available
    if (!DocumentScanner) {
      alert('Dokumenten-Scanner nicht verfügbar. Bitte erstelle einen Development Build oder nutze die Galerie.');
      return;
    }

    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 80,
      });

      if (result?.scannedImages && result.scannedImages.length > 0) {
        // If user scanned multiple pages in one go
        if (result.scannedImages.length >= 2) {
          const uri1 = result.scannedImages[0];
          const uri2 = result.scannedImages[1];

          const FileSystem = require('expo-file-system/legacy'); // or 'expo-file-system'
          const base64_1 = await FileSystem.readAsStringAsync(uri1, { encoding: 'base64' });
          const base64_2 = await FileSystem.readAsStringAsync(uri2, { encoding: 'base64' });

          await processMultipleImages(base64_1, base64_2, uri1, uri2);
          return;
        }

        const scannedUri = result.scannedImages[0];

        // Read base64 from scanned image
        const FileSystem = require('expo-file-system/legacy');
        const base64 = await FileSystem.readAsStringAsync(scannedUri, {
          encoding: 'base64' as any,
        });

        if (isSecondPage && pendingFirstImage) {
          // Process both images together
          setShowSecondPageModal(false);
          await processMultipleImages(pendingFirstImage.base64, base64, pendingFirstImage.uri, scannedUri);
          setPendingFirstImage(null);
        } else {
          // First image - ask if there's a second page
          setPendingFirstImage({ base64: base64, uri: scannedUri });
          setShowSecondPageModal(true);
        }
      }
    } catch (e: any) {
      console.error("Scan error:", e);
      // Fallback to regular camera if scanner fails (e.g., in Expo Go)
      if (e.message?.includes('native module') || e.message?.includes('null')) {
        alert('Dokumenten-Scanner nicht verfügbar. Bitte erstelle einen Development Build oder nutze die Galerie.');
      } else {
        alert("Fehler beim Scannen: " + (e.message || 'Unbekannter Fehler'));
      }
    }
  };

  const pickImage = async (source: 'camera' | 'gallery', isSecondPage: boolean = false) => {
    try {
      console.log('Picking image details:', { source, hasScanner: !!DocumentScanner });

      // PERMISSION CHECK
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          alert('Kamera-Berechtigung ist erforderlich, um Gutscheine zu scannen.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Galerie-Berechtigung ist erforderlich, um Bilder auszuwählen.');
          return;
        }
      }

      // Use document scanner for camera on native if available
      if (source === 'camera') {
        if (DocumentScanner) {
          await scanDocument(isSecondPage);
          return;
        } else {
          // Optional: Notify user that scanner is missing
          console.log('DocumentScanner is null, falling back to standard camera');
        }
      }

      // Fallback to regular camera or gallery picker
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri && asset.base64) {
          if (isSecondPage && pendingFirstImage) {
            // Process both images together
            setShowSecondPageModal(false);
            await processMultipleImages(pendingFirstImage.base64, asset.base64, pendingFirstImage.uri, asset.uri);
            setPendingFirstImage(null);
          } else {
            // First image - ask if there's a second page
            setPendingFirstImage({ base64: asset.base64, uri: asset.uri });
            setShowSecondPageModal(true);
          }
        }
      }
    } catch (e: any) {
      console.error("Fehler beim Bildwählen:", e);
      alert("Fehler beim Laden des Bildes: " + (e.message || 'Unbekannt'));
    }
  };

  const processMultipleImages = async (base64_1: string, base64_2: string | null, uri_1: string, uri_2: string | null) => {
    setIsAnalyzing(true);
    try {
      // Upload first image
      const uploadedUrl1 = await supabaseService.uploadVoucherImage(uri_1, 'voucher-front.jpg', 'image/jpeg');
      if (uploadedUrl1) setImageUrl(uploadedUrl1);
      else setImageUrl(uri_1);

      // Upload second image if exists
      if (uri_2) {
        const uploadedUrl2 = await supabaseService.uploadVoucherImage(uri_2, 'voucher-back.jpg', 'image/jpeg');
        if (uploadedUrl2) setImageUrl2(uploadedUrl2);
        else setImageUrl2(uri_2);
      }

      // Build image parts for API
      const imageParts = [
        { inline_data: { mime_type: 'image/jpeg', data: base64_1 } }
      ];
      if (base64_2) {
        imageParts.push({ inline_data: { mime_type: 'image/jpeg', data: base64_2 } });
      }

      // Use direct REST API with website extraction
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Du bist ein Experte für Gutschein-Analyse. Analysiere dieses Gutschein-Bild SEHR SORGFÄLTIG und extrahiere ALLE Informationen.

WICHTIG: Suche besonders nach:
- LANGE ZAHLENKETTEN (das ist meist der Gutschein-Code/Kartennummer)
- Kurze 4-6 stellige Zahlen (das ist meist der PIN)
- URLs oder Webseiten

Antworte NUR mit diesem JSON-Format:
{
  "store": "Name des Geschäfts (z.B. Migros, Coop, IKEA)",
  "title": "Beschreibung des Gutscheins",
  "amount": "Betrag als Zahl ohne Währung",
  "currency": "CHF, EUR oder USD",
  "voucherType": "VALUE",
  "expiryDate": "Ablaufdatum als DD.MM.YYYY oder leer",
  "code": "DIE LÄNGSTE ZAHLENKETTE auf dem Gutschein (z.B. 1234-5678-9012-3456 oder 19-stellige Nummer)",
  "pin": "Kurzer numerischer Code (4-6 Ziffern), oft als PIN, Sicherheitscode oder unter Rubbelfeld bezeichnet",
  "website": "URL falls vorhanden"
}

ACHTE BESONDERS AUF:
1. Kartennummern haben oft 12-19 Ziffern
2. PINs haben meist 4-6 Ziffern und stehen oft unter einem Rubbelfeld
3. Alle sichtbaren Nummern müssen erfasst werden!` },
              ...imageParts
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

      const parsed = JSON.parse(resultText);
      console.log('Parsed Result:', parsed);

      // Handle both array and object response formats
      const result = Array.isArray(parsed) ? parsed[0] : parsed;

      setScannedData({
        title: result?.title || '',
        store: result?.store || '',
        amount: result?.amount ? result.amount.toString() : '',
        currency: (result?.currency || 'CHF').toUpperCase(),
        type: (result?.voucherType as VoucherType) || 'VALUE',
        expiry: result?.expiryDate || '',
        code: result?.code || '',
        pin: result?.pin || '',
        website: result?.website || ''
      });
      setShowScanModal(true);

    } catch (error) {
      console.error("AI Scan Error:", error);
      alert("KI Scan: Daten konnten nicht automatisch erkannt werden.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processSingleImage = async () => {
    if (pendingFirstImage) {
      setShowSecondPageModal(false);
      await processMultipleImages(pendingFirstImage.base64, null, pendingFirstImage.uri, null);
      setPendingFirstImage(null);
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
            <Text style={styles.label}>Kategorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['Shopping', 'Lebensmittel', 'Wohnen', 'Reisen', 'Freizeit', 'Gastro', 'Sonstiges'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.familyItem, category === cat && styles.familyItemActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.familyItemText, category === cat && styles.familyItemTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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

          {/* QUANTITY with codes OR regular amount */}
          {type === 'QUANTITY' && !codeList.trim() ? (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Anzahl</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#9ca3af" />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ablaufdatum</Text>
                <TextInput style={styles.input} value={expiry} onChangeText={(t) => setExpiry(formatDate(t))} placeholder="TT.MM.JJJJ" keyboardType="numeric" placeholderTextColor="#9ca3af" maxLength={10} />
              </View>
            </View>
          ) : type === 'VALUE' ? (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Guthaben</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#9ca3af" />
                  <TouchableOpacity style={styles.currencyBadge} onPress={() => setShowCurrencyPicker(true)}>
                    <Text style={styles.currencyBadgeText}>{currency}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ablaufdatum</Text>
                <TextInput style={styles.input} value={expiry} onChangeText={(t) => setExpiry(formatDate(t))} placeholder="TT.MM.JJJJ" keyboardType="numeric" placeholderTextColor="#9ca3af" maxLength={10} />
              </View>
            </View>
          ) : null}

          {/* Multi-code input for QUANTITY type */}
          {type === 'QUANTITY' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Codes (einer pro Zeile) {codeList.trim() && `• ${codeList.split('\n').filter(c => c.trim()).length} Stk.`}</Text>
                <TextInput
                  style={[styles.input, { height: 120, textAlignVertical: 'top', paddingTop: 15 }]}
                  value={codeList}
                  onChangeText={setCodeList}
                  placeholder="ABC123\nDEF456\nGHI789"
                  placeholderTextColor="#9ca3af"
                  multiline
                />
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>💡 Bei mehreren Codes wird die Anzahl automatisch gesetzt</Text>
              </View>
              <View style={[styles.inputGroup]}>
                <Text style={styles.label}>Ablaufdatum</Text>
                <TextInput style={styles.input} value={expiry} onChangeText={(t) => setExpiry(formatDate(t))} placeholder="TT.MM.JJJJ" keyboardType="numeric" placeholderTextColor="#9ca3af" maxLength={10} />
              </View>
            </>
          )}

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

          {/* New Trip Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ausflug verknüpfen</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: selectedTripId ? 10 : 20 }]}
              onPress={() => setShowTripModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {selectedTripId && (
                  (() => {
                    const trip = trips.find(t => t.id === selectedTripId);
                    if (trip && trip.image) {
                      return <Image source={{ uri: trip.image }} style={{ width: 32, height: 32, borderRadius: 6, marginRight: 10 }} />;
                    }
                    return <Icon name="map" size={20} color="#2563eb" style={{ marginRight: 10 }} />;
                  })()
                )}
                <Text style={{ color: selectedTripId ? '#1e293b' : '#94a3b8', fontSize: 16, flex: 1 }} numberOfLines={1}>
                  {selectedTripId ? trips.find(t => t.id === selectedTripId)?.title : 'Ausflug wählen...'}
                </Text>
              </View>
              <Icon name="chevron-down" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <TripSelectionModal
            visible={showTripModal}
            onClose={() => setShowTripModal(false)}
            onSelect={(trip) => setSelectedTripId(trip ? trip.id : null)}
            trips={trips}
            selectedTripId={selectedTripId}
          />


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
      </Modal >

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
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Ablauf:</Text> {scannedData.expiry || '-'}</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Nummer:</Text> {scannedData.code || '-'}</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>PIN:</Text> {scannedData.pin || '-'}</Text>
                <Text style={{ fontSize: 13, marginBottom: 5 }}><Text style={{ fontWeight: '700' }}>Webseite:</Text> {scannedData.website || '-'}</Text>
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
                    if (scannedData.website) setWebsite(scannedData.website);
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
      </Modal >

      {/* Second Page Modal */}
      <Modal visible={showSecondPageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Zweite Seite scannen?</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>Hat der Gutschein eine Rückseite mit weiteren Informationen?</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 50, backgroundColor: '#f1f5f9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                onPress={processSingleImage}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b' }}>Nein, weiter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 50, backgroundColor: '#2563eb', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => pickImage('camera', true)}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Ja, scannen</Text>
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
