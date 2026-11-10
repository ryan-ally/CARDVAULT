
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useCart } from '../context/cart-context';
import { useAuth } from '../context/auth-context';
import { getCustomerProfile } from '../context/profile-context';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:4242';

export default function CheckoutScreen() {
  const { items, count, subtotal } = useCart();
  const { session, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const [startingPayment, setStartingPayment] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function loadProfile() {
      if (!session?.user) return;

      setEmail(session.user.email || '');
      setLoadingProfile(true);

      try {
        const profile = await getCustomerProfile();

        if (cancelled || !profile) return;

        setName(profile.full_name || '');
        setAddress(profile.address_line1 || '');
        setCity(profile.city || '');
        setState(profile.state || '');
        setZip(profile.postal_code || '');
      } catch (error) {
        console.warn('Profile prefill unavailable:', error);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, authLoading]);

  function showError(message: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
    } else {
      Alert.alert('Checkout', message);
    }
  }

  async function handlePayment() {
    if (startingPayment) return;

    if (!session?.access_token) {
      showError('Please sign in before checkout.');
      return;
    }

    if (items.length === 0) {
      showError('Your cart is empty.');
      return;
    }

    if (
      !name.trim() ||
      !email.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !zip.trim()
    ) {
      showError('Please complete all shipping fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showError('Enter a valid email address.');
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) {
      showError('Enter a valid US ZIP code.');
      return;
    }

    if (Platform.OS !== 'web') {
      showError(
        'This checkout currently supports the CardVault website.'
      );
      return;
    }

    setStartingPayment(true);

    try {
      const response = await fetch(
        `${BACKEND_URL.replace(/\/$/, '')}/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            items: items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
            })),
            customer: {
              name: name.trim(),
              email: email.trim(),
              address: address.trim(),
              city: city.trim(),
              state: state.trim().toUpperCase(),
              zip: zip.trim(),
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Could not create Stripe Checkout session.'
        );
      }

      if (
        typeof data?.url !== 'string' ||
        !data.url.startsWith('https://checkout.stripe.com/')
      ) {
        throw new Error('Invalid Stripe Checkout URL.');
      }

      if (typeof window !== 'undefined') {
        window.location.assign(data.url);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not start payment.';

      console.error('Stripe checkout:', message);
      showError(message);
    } finally {
      setStartingPayment(false);
    }
  }

  const shipping = 0;
  const total = subtotal + shipping;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#146EF5"
          />
          <Text style={styles.backText}>Back to cart</Text>
        </Pressable>

        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>
          Complete your order securely with Stripe.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person-outline" size={20} />{' '}
            Contact information
          </Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#8993A5"
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#8993A5"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={20} />{' '}
            Shipping address
          </Text>

          <Text style={styles.label}>Street address</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main Street"
            placeholderTextColor="#8993A5"
            value={address}
            onChangeText={setAddress}
            autoComplete="street-address"
          />

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor="#8993A5"
            value={city}
            onChangeText={setCity}
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="CA"
                placeholderTextColor="#8993A5"
                value={state}
                onChangeText={setState}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>

            <View style={styles.half}>
              <Text style={styles.label}>ZIP code</Text>
              <TextInput
                style={styles.input}
                placeholder="93505"
                placeholderTextColor="#8993A5"
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {loadingProfile && (
            <Text style={styles.muted}>
              Loading saved shipping details...
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="bag-outline" size={20} />{' '}
            Order summary
          </Text>

          <Text style={styles.muted}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>

          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>
                  {item.name}
                </Text>
                <Text style={styles.muted}>
                  Qty: {item.quantity}
                </Text>
              </View>

              <Text style={styles.price}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.price}>
              ${subtotal.toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Shipping</Text>
            <Text style={styles.price}>Free</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total before tax</Text>
            <Text style={styles.total}>
              ${total.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.taxNote}>
            Any applicable tax is calculated during Stripe Checkout.
          </Text>
        </View>

        <Pressable
          style={[
            styles.payButton,
            (startingPayment ||
              authLoading ||
              loadingProfile ||
              items.length === 0) &&
              styles.disabledButton,
          ]}
          onPress={handlePayment}
          disabled={
            startingPayment ||
            authLoading ||
            loadingProfile ||
            items.length === 0
          }
        >
          {startingPayment ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.payText}>
                Continue to secure payment
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.secureText}>
          <Ionicons
            name="shield-checkmark-outline"
            size={15}
          />{' '}
          Secure checkout powered by Stripe
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7FC',
  },
  container: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 8,
  },
  backText: {
    color: '#146EF5',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#14213D',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E7ECF5',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#14213D',
    marginBottom: 18,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE3EF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#14213D',
    backgroundColor: '#FFFFFF',
    marginBottom: 17,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  muted: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14213D',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14213D',
  },
  divider: {
    height: 1,
    backgroundColor: '#E7ECF5',
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14213D',
  },
  total: {
    fontSize: 23,
    fontWeight: '800',
    color: '#146EF5',
  },
  taxNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
  },
  payButton: {
    backgroundColor: '#146EF5',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  payText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  secureText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    marginTop: 16,
  },
});
