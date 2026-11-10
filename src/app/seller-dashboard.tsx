
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/auth-context';
import { supabase } from '../lib/supabase';

type OrderStatus =
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

type SellerOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;
};

const statuses: OrderStatus[] = [
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export default function SellerDashboardScreen() {
  const { session, loading: authLoading } = useAuth();
 
const sendTestEmail = async () => {
  if (!session?.access_token) {
    Alert.alert('Sign in required', 'Please sign in again.');
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      'shipping-notification',
      {
        body: { test_mode: true },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    Alert.alert(
      'Test email accepted',
      `Resend accepted the test email for ${session.user.email}. Check your inbox and spam folder.`
    );

} catch (error: unknown) {
  const details = error as {
    message?: string;
    context?: {
      status?: number;
      clone?: () => { text: () => Promise<string> };
      text?: () => Promise<string>;
    };
  };

  let message = details?.message ?? 'Unknown error';

  try {
    const response = details?.context;

    if (response) {
      let responseText = '';

      if (typeof response.clone === 'function') {
        responseText = await response.clone().text();
      } else if (typeof response.text === 'function') {
        responseText = await response.text();
      }

      message =
        `HTTP status: ${response.status ?? 'unknown'}\n` +
        `Response: ${responseText || '(empty response)'}\n` +
        `Error: ${message}`;
    }
  } catch (readError) {
    console.log('Could not read function response:', readError);
  }

  console.log('CardVault shipping diagnostic:', message);

  Alert.alert('Shipping diagnostic', message);
}
}

  const sendShippingNotification = async (order: SellerOrder) => {
    if (!session?.access_token) {
      Alert.alert('Sign in required', 'Please sign in again.');
      return;
    }

    if (
      order.status !== 'shipped' ||
      order.payment_status !== 'paid'
    ) {
      Alert.alert(
        'Order not ready',
        'Only paid orders marked as shipped can receive a shipping email.'
      );
      return;
    }

    if (!order.tracking_number || !order.shipping_carrier) {
      Alert.alert(
        'Missing tracking details',
        'Save the shipping carrier and tracking number first.'
      );
      return;
    }

    Alert.alert(
      'Send shipping email?',
      `Send a shipping notification to ${order.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send email',
          onPress: () => {
            void (async () => {
              try {
                const { data, error } =
                  await supabase.functions.invoke(
                    'shipping-notification',
                    {
                      body: { order_number: order.order_number },
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    }
                  );

                if (error) {
                  throw error;
                }

                if (data?.error) {
                  throw new Error(data.error);
                }

                Alert.alert(
                  'Email sent',
                  'The shipping notification was accepted by the email service.'
                );
              } catch (error) {
                console.error('Shipping notification error:', error);

                Alert.alert(
                  'Email not sent',
                  error instanceof Error
                    ? error.message
                    : 'Please check the Edge Function logs and try again.'
                );
              }
            })();
          },
        },
      ]
    );
  };
  
<Pressable
  style={styles.button}
  onPress={() => sendShippingNotification(item)}
>
  <Text style={styles.buttonText}>
    SEND SHIPPING EMAIL
  </Text>
</Pressable>

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerAuthorized, setSellerAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [carrierInputs, setCarrierInputs] = useState<
    Record<string, string>
  >({});
  const [trackingInputs, setTrackingInputs] = useState<
    Record<string, string>
  >({});

  const loadOrders = useCallback(async (refresh = false) => {
    if (authLoading) return;

    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      if (!session?.user.id) {
        setSellerAuthorized(false);
        setOrders([]);
        setError('Sign in to your authorized seller account.');
        return;
      }

      const { data: access, error: accessError } = await supabase
        .from('seller_access')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (accessError) throw accessError;

      if (!access) {
        setSellerAuthorized(false);
        setOrders([]);
        setError('This account is not authorized to manage orders.');
        return;
      }

      setSellerAuthorized(true);

      const { data, error: ordersError } = await supabase
        .from('orders')
        .select(
          'id, order_number, customer_name, email, total, status, payment_status, created_at, tracking_number, shipping_carrier, shipped_at'
        )
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const loadedOrders = (data ?? []) as SellerOrder[];

      setOrders(loadedOrders);

      setCarrierInputs(
        Object.fromEntries(
          loadedOrders.map(order => [
            order.id,
            order.shipping_carrier ?? '',
          ])
        )
      );

      setTrackingInputs(
        Object.fromEntries(
          loadedOrders.map(order => [
            order.id,
            order.tracking_number ?? '',
          ])
        )
      );
    } catch (err) {
      console.error('Seller dashboard load failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load seller orders.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id, authLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders])
  );

const saveShippingDetails = async (order: SellerOrder) => {
  if (!sellerAuthorized || !session?.user.id) {
    Alert.alert('Access denied', 'Seller access is required.');
    return;
  }

  if (order.payment_status !== 'paid') {
    Alert.alert(
      'Payment required',
      'Shipping details can only be saved for paid orders.'
    );
    return;
  }

  const carrier = carrierInputs[order.id]?.trim() ?? '';
  const trackingNumber = trackingInputs[order.id]?.trim() ?? '';

  if (!carrier || !trackingNumber) {
    Alert.alert(
      'Missing details',
      'Enter both the shipping carrier and tracking number.'
    );
    return;
  }

  setUpdatingId(order.id);

  try {
    const { data: access, error: accessError } = await supabase
      .from('seller_access')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (accessError) throw accessError;
    if (!access) throw new Error('Seller access could not be verified.');

    const { data, error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_carrier: carrier,
        tracking_number: trackingNumber,
      })
      .eq('id', order.id)
      .select('id, shipping_carrier, tracking_number')
      .single();

    if (updateError) throw updateError;

    setOrders(current =>
      current.map(existing =>
        existing.id === order.id
          ? {
            ...existing,
            shipping_carrier: data.shipping_carrier,
            tracking_number: data.tracking_number,
          }
          : existing
      )
    );

    Alert.alert('Saved', 'Shipping details have been saved.');
  } catch (err) {
    Alert.alert(
      'Save failed',
      err instanceof Error ? err.message : 'Could not save shipping details.'
    );
  } finally {
    setUpdatingId(null);
  }
};

const updateStatus = async (
  order: SellerOrder,
  newStatus: OrderStatus
) => {
  if (!sellerAuthorized || !session?.user.id) {
    Alert.alert('Access denied', 'Seller access is required.');
    return;
  }

  if (order.payment_status !== 'paid') {
    Alert.alert(
      'Payment required',
      'Only paid orders can be updated through shipping management. Test and unpaid orders cannot be shipped.'
    );
    return;
  }

  if (newStatus === 'shipped' && order.status !== 'processing') {
    Alert.alert(
      'Invalid status',
      'Only processing orders can be marked as shipped.'
    );
    return;
  }

  if (newStatus === 'delivered' && order.status !== 'shipped') {
    Alert.alert(
      'Order not shipped',
      'Mark the order as shipped before marking it delivered.'
    );
    return;
  }

  const carrier = carrierInputs[order.id]?.trim() ?? '';
  const trackingNumber = trackingInputs[order.id]?.trim() ?? '';

  if (newStatus === 'shipped' && (!carrier || !trackingNumber)) {
    Alert.alert(
      'Shipping details required',
      'Enter the shipping carrier and tracking number before marking this order as shipped.'
    );
    return;
  }

  Alert.alert(
    'Update order status',
    `Change ${order.order_number} to ${newStatus.toUpperCase()}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          void (async () => {
            setUpdatingId(order.id);

            try {
              const { data: access, error: accessError } = await supabase
                .from('seller_access')
                .select('user_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (accessError) throw accessError;
              if (!access) {
                throw new Error('Seller access could not be verified.');
              }

              const updateValues =
                newStatus === 'shipped'
                  ? {
                    status: newStatus,
                    shipping_carrier: carrier,
                    tracking_number: trackingNumber,
                    shipped_at: new Date().toISOString(),
                  }
                  : { status: newStatus };

              const { data, error: updateError } = await supabase
                .from('orders')
                .update(updateValues)
                .eq('id', order.id)
                .select(
                  'id, status, tracking_number, shipping_carrier, shipped_at'
                )
                .single();

              if (updateError) throw updateError;

              setOrders(current =>
                current.map(existing =>
                  existing.id === order.id
                    ? {
                      ...existing,
                      status: data.status,
                      tracking_number: data.tracking_number,
                      shipping_carrier: data.shipping_carrier,
                      shipped_at: data.shipped_at,
                    }
                    : existing
                )
              );

              Alert.alert(
                'Order updated',
                newStatus === 'shipped'
                  ? 'Order status and shipping details saved.'
                  : `Order is now ${newStatus}.`
              );
            } catch (err) {
              Alert.alert(
                'Update failed',
                err instanceof Error
                  ? err.message
                  : 'Could not update order status.'
              );
            } finally {
              setUpdatingId(null);
            }
          })();
        },
      },
    ]
  );
};


  const formatPrice = (price: number) =>
    `$${Number(price).toFixed(2)}`;

  const readableStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B7AEFF" />
          <Text style={styles.muted}>
            Loading seller dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sellerAuthorized ? orders : []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadOrders(true)}
            tintColor="#B7AEFF"
          />
        }
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.back}>← Back</Text>
            </Pressable>

            <Text style={styles.title}>Seller Dashboard</Text>
            <Text style={styles.subtitle}>
              Manage CardVault customer orders and shipping
            </Text>

            <View style={styles.summary}>
              <Ionicons
                name="shield-checkmark-outline"
                size={25}
                color="#B7AEFF"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>
                  Private seller access
                </Text>
                <Text style={styles.muted}>
                  Signed in as {session?.user.email ?? 'Guest'}
                </Text>
              </View>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.error}>{error}</Text>
                {!session?.user.id && (
                  <Pressable
                    style={styles.button}
                    onPress={() => router.push('/auth')}
                  >
                    <Text style={styles.buttonText}>SIGN IN</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.button}
                  onPress={() => void loadOrders(true)}
                >
                  <Text style={styles.buttonText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            )}

            {sellerAuthorized && (
              <Text style={styles.sectionTitle}>
                Orders ({orders.length})
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          sellerAuthorized && !error ? (
            <Text style={styles.muted}>No customer orders yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <Text style={styles.orderNumber}>
              {item.order_number}
            </Text>
            <Text style={styles.customer}>
              {item.customer_name}
            </Text>
            <Text style={styles.muted}>{item.email}</Text>
            <Text style={styles.total}>
              {formatPrice(item.total)}
            </Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {readableStatus(item.status)}
              </Text>
            </View>

            <Text style={styles.muted}>
              Payment: {readableStatus(item.payment_status)}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.label}>SHIPPING DETAILS</Text>

            <TextInput
              style={styles.shippingInput}
              placeholder="Carrier (USPS, UPS, FedEx)"
              placeholderTextColor="#A9A5C5"
              value={carrierInputs[item.id] ?? ''}
              onChangeText={value =>
                setCarrierInputs(current => ({
                  ...current,
                  [item.id]: value,
                }))
              }
              autoCapitalize="words"
            />

            <TextInput
              style={styles.shippingInput}
              placeholder="Tracking number"
              placeholderTextColor="#A9A5C5"
              value={trackingInputs[item.id] ?? ''}
              onChangeText={value =>
                setTrackingInputs(current => ({
                  ...current,
                  [item.id]: value,
                }))
              }
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {item.tracking_number && (
              <Text style={styles.muted}>
                Saved: {item.shipping_carrier} · {item.tracking_number}
              </Text>
            )}
<Pressable
  style={[
    styles.button,
    updatingId === item.id && styles.disabledButton,
  ]}
  disabled={updatingId === item.id}
  onPress={() => void saveShippingDetails(item)}
>
  <Text style={styles.buttonText}>
    {updatingId === item.id
      ? 'SAVING...'
      : 'SAVE SHIPPING DETAILS'}
  </Text>
</Pressable>
            {item.shipped_at && (
              <Text style={styles.muted}>
                Marked shipped:{' '}
                {new Date(item.shipped_at).toLocaleDateString()}
              </Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.label}>CHANGE ORDER STATUS</Text>

            <View style={styles.statusButtons}>
              {statuses.map(status => (
                <Pressable
                  key={status}
                  disabled={
                    updatingId === item.id ||
                    item.status === status
                  }
                  style={[
                    styles.statusButton,
                    item.status === status && styles.selectedStatus,
                    updatingId === item.id && styles.disabledButton,
                  ]}
                  onPress={() => void updateStatus(item, status)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      item.status === status &&
                        styles.selectedStatusText,
                    ]}
                  >
                    {readableStatus(status)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {updatingId === item.id && (
              <ActivityIndicator color="#B7AEFF" />
            )}
            
<Pressable
  style={styles.button}
  onPress={() => sendShippingNotification(item)}
>
  <Text style={styles.buttonText}>
    SEND SHIPPING EMAIL
  </Text>
</Pressable>


<Pressable
  style={styles.button}
  onPress={() => void sendTestEmail()}
>
  <Text style={styles.buttonText}>
    SEND TEST EMAIL
  </Text>
</Pressable>

          </View>
   



        )}
      />
      

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#25243D' },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    color: '#B7AEFF',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 18,
  },
  title: { color: '#FFFFFF', fontSize: 29, fontWeight: '900' },
  subtitle: {
    color: '#D0CDDF',
    marginTop: 6,
    marginBottom: 20,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#302E4D',
    marginBottom: 20,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#302E4D',
    borderColor: '#514D70',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  orderNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  customer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  total: {
    color: '#B7AEFF',
    fontSize: 21,
    fontWeight: '900',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#444064',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { color: '#FFFFFF', fontWeight: '800' },
  muted: { color: '#D0CDDF', fontSize: 12, lineHeight: 18 },
  divider: {
    height: 1,
    backgroundColor: '#514D70',
    marginVertical: 8,
  },
  label: {
    color: '#B7AEFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shippingInput: {
    backgroundColor: '#25243D',
    borderWidth: 1,
    borderColor: '#706B91',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#706B91',
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  selectedStatus: {
    backgroundColor: '#B7AEFF',
    borderColor: '#B7AEFF',
  },
  disabledButton: { opacity: 0.5 },
  statusButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedStatusText: { color: '#25243D' },
  errorBox: {
    backgroundColor: '#3D2D45',
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    gap: 12,
  },
  error: { color: '#FFB4B4', fontSize: 14 },
  button:{  backgroundColor:'teal', borderRadius: 12, padding: 14,},
  buttonText: { color:'white', },
});