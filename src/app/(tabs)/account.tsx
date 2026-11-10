
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '../../context/auth-context';
import {
  getCustomerProfile,
  saveCustomerProfile,
  type CustomerProfile
} from '../../context/profile-context';
import { supabase } from '../../lib/supabase';

export default function AccountScreen() {
  const { session, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const userId = session?.user.id;

  const handleDeleteAccount = () => {
    Alert.alert(
      'Permanently Delete Account?',
      'This action cannot be undone. Your account will be deleted, your seller listings deactivated, and your inventory records preserved where possible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);

            try {
              const { data, error } =
                await supabase.functions.invoke('delete-account', {
                  method: 'POST',
                });

              if (error || !data?.success) {
                Alert.alert(
                  'Deletion Failed',
                  data?.error ||
                    error?.message ||
                    'Could not delete your account. Please try again.'
                );
                return;
              }

              await signOut();
              router.replace('/auth');

              Alert.alert(
                'Account Deleted',
                'Your CardVault account has been deleted.'
              );
            } catch (error) {
              Alert.alert(
                'Deletion Failed',
                error instanceof Error
                  ? error.message
                  : 'Please try again later.'
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }

    setLoadingProfile(true);

    try {
      const savedProfile = await getCustomerProfile(userId);
      setProfile(savedProfile);
    } catch (error) {
      console.error('Could not load profile:', error);
      Alert.alert(
        'Profile unavailable',
        'Could not load your profile. Please try again.'
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateField = (
    field: keyof CustomerProfile,
    value: string
  ) => {
    setProfile((current) =>
      current ? { ...current, [field]: value } : current
    );
  };

  const handleSaveProfile = async () => {
    if (!profile || !userId) return;

    if (!profile.full_name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setSavingProfile(true);

    try {
      const saved = await saveCustomerProfile({
        ...profile,
        user_id: userId,
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
        address_line1: profile.address_line1.trim(),
        address_line2: profile.address_line2.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        postal_code: profile.postal_code.trim(),
        country: profile.country.trim() || 'United States',
      });

      setProfile(saved);
      Alert.alert('Profile saved', 'Your customer profile was updated.');
    } catch (error) {
      console.error('Could not save profile:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Could not save your profile. Please try again.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);

    try {
      const { error } = await signOut();

      if (error) {
        Alert.alert('Sign out failed', error.message);
        return;
      }

      router.replace('/auth');
    } catch {
      Alert.alert('Error', 'Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#A78BFA" />
          <Text style={styles.muted}>Loading account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Your CardVault account</Text>
          <Text style={styles.subtitle}>
            Sign in to manage your account and saved shipping address.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.primaryButtonText}>Sign In or Sign Up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>My Account</Text>
            <Text style={styles.subtitle}>
              Manage your CardVault profile
            </Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.profileLabel}>SIGNED IN AS</Text>
            <Text style={styles.email}>{session.user.email}</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Account active</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color="#FFFFFF"
            />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Secure customer profile</Text>
              <Text style={styles.infoDescription}>
                Your saved details are linked to your account.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Customer Profile</Text>
            <Text style={styles.sectionDescription}>
              Save your information for faster checkout.
            </Text>

            {loadingProfile || !profile ? (
              <View style={styles.profileLoading}>
                <ActivityIndicator size="large" color="#A78BFA" />
                <Text style={styles.muted}>Loading your profile...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Full name *</Text>
                <TextInput
                  style={styles.input}
                  value={profile.full_name}
                  onChangeText={(value) => updateField('full_name', value)}
                  placeholder="Your full name"
                  placeholderTextColor="#8D91A5"
                  autoCapitalize="words"
                  autoComplete="name"
                />

                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={(value) => updateField('phone', value)}
                  placeholder="Phone number"
                  placeholderTextColor="#8D91A5"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />

                <Text style={styles.sectionTitle}>Shipping Address</Text>
                <Text style={styles.fieldLabel}>Address line 1</Text>
                <TextInput
                  style={styles.input}
                  value={profile.address_line1}
                  onChangeText={(value) => updateField('address_line1', value)}
                  placeholder="Street address"
                  placeholderTextColor="#8D91A5"
                  autoComplete="street-address"
                />

                <Text style={styles.fieldLabel}>Address line 2</Text>
                <TextInput
                  style={styles.input}
                  value={profile.address_line2}
                  onChangeText={(value) => updateField('address_line2', value)}
                  placeholder="Apartment, unit, etc. (optional)"
                  placeholderTextColor="#8D91A5"
                  autoComplete="off"
                />

                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  value={profile.city}
                  onChangeText={(value) => updateField('city', value)}
                  placeholder="City"
                  placeholderTextColor="#8D91A5"
                  autoCapitalize="words"
                />

                <View style={styles.fieldRow}>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>State</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.state}
                      onChangeText={(value) => updateField('state', value)}
                      placeholder="CA"
                      placeholderTextColor="#8D91A5"
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>ZIP / Postal code</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.postal_code}
                      onChangeText={(value) =>
                        updateField('postal_code', value)
                      }
                      placeholder="Postal code"
                      placeholderTextColor="#8D91A5"
                      keyboardType="numbers-and-punctuation"
                      autoComplete="postal-code"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Country</Text>
                <TextInput
                  style={styles.input}
                  value={profile.country}
                  onChangeText={(value) => updateField('country', value)}
                  placeholder="Country"
                  placeholderTextColor="#8D91A5"
                  autoCapitalize="words"
                />

                <Pressable
                  style={[
                    styles.primaryButton,
                    savingProfile && styles.disabledButton,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="save-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryButtonText}>
                        Save Profile
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

<Pressable
  style={styles.sellerButton}
  onPress={() => router.push('/seller-dashboard')}
>
  <Ionicons
    name="shield-checkmark-outline"
    size={22}
    color="#FFFFFF"
  />
  <View style={styles.sellerButtonTextContainer}>
    <Text style={styles.sellerButtonTitle}>
      Seller Dashboard
    </Text>
    <Text style={styles.sellerButtonSubtitle}>
      Manage orders and shipping statuses
    </Text>
  </View>
  <Ionicons
    name="chevron-forward"
    size={21}
    color="#FFFFFF"
  />
</Pressable>

  <Pressable
    style={[
      styles.deleteAccountButton,
      busy && styles.disabledButton,
    ]}
    onPress={handleDeleteAccount}
    disabled={busy}
  >
    <Ionicons
      name="trash-outline"
      size={21}
      color="#FFFFFF"
    />
    <Text style={styles.deleteAccountText}>
      Delete Account
    </Text>
  </Pressable>

          <Pressable
            style={[styles.signOutButton, busy && styles.disabledButton]}
            onPress={handleSignOut}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={21} color="#FFFFFF" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'blueviolet',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: 'white',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    marginTop: 12,
    color: '#D0CEE0',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'blueviolet',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  profileCard: {
    marginHorizontal: 18,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#302E4B',
    borderWidth: 1,
    borderColor: '#55516F',
    alignItems: 'center',
  },
  profileLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'white',
  },
  email: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EAF8EF',
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#23964D',
  },
  statusText: {
    color: '#237A42',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    marginHorizontal: 18,
    marginTop: 16,
    padding: 16,
    borderRadius: 15,
    backgroundColor: 'teal',
    borderWidth: 1,
    borderColor: '#397F7C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  infoDescription: {
    marginTop: 4,
    fontSize: 12,
    color: 'white',
  },
  formCard: {
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#302E4B',
    borderWidth: 1,
    borderColor: '#55516F',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#D0CEE0',
    marginBottom: 14,
  },
  profileLoading: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#65617F',
    backgroundColor: '#25243D',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: 'blueviolet',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
sellerButton: {
  marginHorizontal: 18,
  marginTop: 20,
  padding: 16,
  minHeight: 76,
  borderRadius: 14,
  backgroundColor: '#444064',
  borderWidth: 1,
  borderColor: '#7867F5',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
sellerButtonTextContainer: {
  flex: 1,
},
sellerButtonTitle: {
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: '800',
},
sellerButtonSubtitle: {
  color: '#D0CEE0',
  fontSize: 12,
  marginTop: 5,
},

  signOutButton: {
    marginHorizontal: 18,
    marginTop: 20,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#65617F',
    backgroundColor: 'blueviolet',
  },
  signOutText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  deleteAccountButton: {
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FF7777',
    backgroundColor: '#A52235',
  },
  deleteAccountText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  disabledButton: {
    opacity: 0.6,
  },
});
