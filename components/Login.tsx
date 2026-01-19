
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabaseService } from '../services/supabase';
import Icon from './Icon';

interface LoginProps {
  onLogin: (email: string) => void;
}

const STORED_CREDENTIALS_KEY = 'vouchervault_credentials';

const Login: React.FC<LoginProps> = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  // Check biometric availability and stored credentials on mount
  useEffect(() => {
    const checkBiometricAndCredentials = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      // Check if we have stored credentials
      const stored = await SecureStore.getItemAsync(STORED_CREDENTIALS_KEY);
      if (stored) {
        setHasStoredCredentials(true);
        // Auto-trigger Face ID login
        if (compatible && enrolled) {
          handleBiometricLogin();
        }
      }
    };
    checkBiometricAndCredentials();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Anmelden mit Biometrie',
        cancelLabel: 'Abbrechen',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const stored = await SecureStore.getItemAsync(STORED_CREDENTIALS_KEY);
        if (stored) {
          setLoading(true);
          const { email: storedEmail, password: storedPassword } = JSON.parse(stored);
          await supabaseService.signIn(storedEmail, storedPassword);
        }
      }
    } catch (err: any) {
      setError('Biometrie fehlgeschlagen');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || (isRegister && (!firstName || !lastName))) {
      setError('Bitte fülle alle Felder aus.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        await supabaseService.signUp(email, password, fullName);
      } else {
        await supabaseService.signIn(email, password);

        // After successful login, offer to enable biometric login
        if (biometricAvailable && !hasStoredCredentials) {
          Alert.alert(
            'Biometrie aktivieren?',
            'Möchtest du dich zukünftig mit Fingerabdruck anmelden?',
            [
              { text: 'Nein', style: 'cancel' },
              {
                text: 'Ja, aktivieren',
                onPress: async () => {
                  await SecureStore.setItemAsync(
                    STORED_CREDENTIALS_KEY,
                    JSON.stringify({ email, password })
                  );
                }
              }
            ]
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="ticket" size={32} color="#fff" />
          </View>
          <Text style={styles.title}>{isRegister ? 'Konto erstellen' : 'Willkommen zurück'}</Text>
          <Text style={styles.subtitle}>Deine Gutscheine sicher in der Cloud.</Text>
        </View>

        <View style={styles.form}>
          {/* Face ID Button */}
          {!isRegister && hasStoredCredentials && biometricAvailable && (
            <TouchableOpacity
              style={styles.faceIdButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Icon name="finger-print-outline" size={28} color="#2563eb" />
              <Text style={styles.faceIdButtonText}>Mit Biometrie anmelden</Text>
            </TouchableOpacity>
          )}

          {!isRegister && hasStoredCredentials && biometricAvailable && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oder</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {isRegister && (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Vorname</Text>
                <TextInput style={styles.input} placeholder="Max" placeholderTextColor="#9ca3af" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nachname</Text>
                <TextInput style={styles.input} placeholder="Mustermann" placeholderTextColor="#9ca3af" value={lastName} onChangeText={setLastName} />
              </View>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="beispiel@email.ch"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Passwort</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegister ? 'Jetzt registrieren' : 'Anmelden'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleMode} onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.toggleModeText}>
              {isRegister ? 'Bereits ein Konto? Hier anmelden' : 'Noch kein Konto? Jetzt registrieren'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 70, height: 70, backgroundColor: '#2563eb', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 26, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  form: { width: '100%' },
  row: { flexDirection: 'row', width: '100%' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginLeft: 4 },
  input: { height: 50, backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, marginBottom: 16, fontSize: 16, color: '#1f2937' },
  button: { height: 55, backgroundColor: '#2563eb', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: '600' },
  toggleMode: { marginTop: 20, alignItems: 'center' },
  toggleModeText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  faceIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2563eb',
    gap: 12,
    marginBottom: 20
  },
  faceIdButtonText: { color: '#2563eb', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { color: '#9ca3af', fontSize: 13, marginHorizontal: 12 }
});

export default Login;
