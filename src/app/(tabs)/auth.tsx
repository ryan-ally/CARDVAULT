import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth-context';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    if (isSignUp && password.length < 8) {
      Alert.alert(
        'Password too short',
        'Use a password with at least 8 characters.'
      );
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }

    setBusy(true);

    try {
      if (isSignUp) {
        const result = await signUp(normalizedEmail, password);

        if (result.error) {
          Alert.alert('Sign-up failed', result.error.message);
          return;
        }

        if (result.needsEmailConfirmation) {
          Alert.alert(
            'Check your email',
            'Your account request was received. Confirm your email using the link Supabase sent before signing in.',
            [
              {
                text: 'OK',
                onPress: () => setIsSignUp(false),
              },
            ]
          );
          return;
        }

        Alert.alert('Account created', 'You are now signed in.');
        router.replace('/(tabs)');
      } else {
        const result = await signIn(normalizedEmail, password);

        if (result.error) {
          Alert.alert('Sign-in failed', result.error.message);
          return;
        }

        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('CardVault authentication error:', error);
      Alert.alert(
        'Something went wrong',
        'Unable to complete your request. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Return to CardVault"
            >
              <Ionicons name="arrow-back" size={22} color="#172033" />
            </Pressable>
          </View>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="layers" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>CardVault</Text>
            <Text style={styles.tagline}>Your collection. Your marketplace.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.description}>
              {isSignUp
                ? 'Join CardVault to manage your Pokémon card collection.'
                : 'Sign in to continue to your CardVault account.'}
            </Text>

            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#7A8190" />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9AA2B1"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
                accessibilityLabel="Email address"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#7A8190" />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                placeholderTextColor="#9AA2B1"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                editable={!busy}
                accessibilityLabel="Password"
              />
              <Pressable
                onPress={() => setPasswordVisible(!passwordVisible)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                  color="#7A8190"
                />
              </Pressable>
            </View>

            {isSignUp && (
              <View>
                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#7A8190"
                  />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#9AA2B1"
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!busy}
                    accessibilityLabel="Confirm password"
                  />
                </View>
              </View>
            )}

            <Pressable
              style={[styles.primaryButton, busy && styles.disabledButton]}
              onPress={handleAuth}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <Pressable
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setPassword('');
                  setConfirmPassword('');
                }}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.switchAction}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footer}>
            Your account is protected by Supabase authentication.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 30,
  },
  topBar: {
    height: 48,
    justifyContent: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#25243D',
    borderWidth: 1
  },
  brand: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 28,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: 'teal',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    marginTop: 12,
    fontSize: 29,
    fontWeight: '900',
    color: '#25243D',
  },
  tagline: {
    marginTop: 5,
    fontSize: 13,
    color: 'teal',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  description: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: 'black',
  },
  label: {
    marginBottom: 8,
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: 'blueviolet',
  },
  inputContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E0E5EE',
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 15,
    color: '#172033',
  },
  primaryButton: {
    minHeight: 53,
    marginTop: 24,
    borderRadius: 13,
    backgroundColor: 'ghostwhite',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 21,
  },
  switchText: {
    fontSize: 13,
    color: '#7A8190',
  },
  switchAction: {
    fontSize: 13,
    color: 'dodgerblue',
    fontWeight: '800',
  },
  footer: {
    marginTop: 22,
    fontSize: 12,
    color: 'teal',
    textAlign: 'center',
  },
});
