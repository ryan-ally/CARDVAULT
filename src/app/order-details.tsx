
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getOrders,
  getCustomerOrders,
  type Order,
} from '../context/order-context';
import { useAuth } from '../context/auth-context';
import { supabase } from '../lib/supabase';

export default function OrderDetailsScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { session, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (authLoading) return;

      setLoading(true);
      setError('');

      try {
        let savedOrders: Order[];

        if (session?.user.id) {
          savedOrders = await getCustomerOrders(session.user.id);
        } else {
          savedOrders = await getOrders();
        }

        if (cancelled) return;

        const matchingOrder = savedOrders.find(
          (savedOrder) => savedOrder.id === orderId
        );

        if (!matchingOrder) {
          setError('This order could not be found in your order history.');
          setOrder(null);
        } else {
          setOrder(matchingOrder);
        }
      } catch (err) {
        console.error('Could not load order details:', err);

        if (!cancelled) {
          setError('Could not load this order. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId, session?.user.id, authLoading]);

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const formatDate = (date: string) => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }

    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const readableStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  const canCancel =
    !!session?.user.id &&
    order?.status === 'test' &&
    order?.paymentStatus === 'not_charged';

  async function performCancellation() {
    if (!order || !session?.user.id || cancelling) return;

    setCancelling(true);

    try {
      const { data, error: cancelError } = await supabase.rpc(
        'cancel_cardvault_test_order',
        {
          p_order_number: order.id,
        }
      );

      if (cancelError) {
        throw new Error(cancelError.message);
      }

      if (!data?.success) {
        throw new Error('CardVault could not confirm the cancellation.');
      }

      setOrder({
        ...order,
        status: 'cancelled',
      });

      Alert.alert(
        'Order Cancelled',
        data.already_cancelled
          ? 'This order was already cancelled. Inventory was not restored a second time.'
          : 'Your test order has been cancelled and its card quantities have been returned to inventory.'
      );
    } catch (err) {
      console.error('Could not cancel test order:', err);

      Alert.alert(
        'Cancellation Failed',
        err instanceof Error
          ? err.message
          : 'The order could not be cancelled. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  }

  function confirmCancellation() {
    if (!order || !canCancel || cancelling) return;

    Alert.alert(
      'Cancel This Test Order?',
      'The order will be marked cancelled and the card quantities will be returned to inventory. This action is only for unpaid test orders.',
      [
        {
          text: 'Keep Order',
          style: 'cancel',
        },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: () => {
            void performCancellation();
          },
        },
      ]
    );
  }

  const trackingSteps = [
    {
      title: 'Order received',
      description: 'The order has been recorded.',
    },
    {
      title: 'Shipped',
      description: 'The seller has marked the order as shipped.',
    },
    {
      title: 'Delivered',
      description: 'The order has been marked as delivered.',
    },
  ];

  const currentStep =
    order?.status === 'test'
      ? -1
      : order?.status === 'processing'
        ? 0
        : order?.status === 'shipped'
          ? 1
          : order?.status === 'delivered'
            ? 2
            : -1;

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B7AEFF" />
          <Text style={styles.muted}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back to Orders</Text>
          </Pressable>
          <Text style={styles.title}>Order Details</Text>
          <Text style={styles.error}>
            {error || 'Order not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back to Orders</Text>
        </Pressable>

        <Text style={styles.title}>Order Details</Text>
        <Text style={styles.subtitle}>
          Your CardVault order information
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>ORDER NUMBER</Text>
          <Text style={styles.orderNumber}>{order.id}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>ORDER DATE</Text>
          <Text style={styles.value}>{formatDate(order.createdAt)}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>ORDER STATUS</Text>
          <Text style={styles.value}>
            {readableStatus(order.status)}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.label}>PAYMENT STATUS</Text>
          <Text style={styles.value}>
            {order.paymentStatus === 'not_charged'
              ? 'Not charged — test checkout'
              : readableStatus(order.paymentStatus)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Order Tracking</Text>

        <View style={styles.card}>
          <Text style={styles.label}>CURRENT STATUS</Text>
          <Text style={styles.value}>
            {readableStatus(order.status)}
          </Text>

          {order.status === 'test' ? (
            <Text style={styles.disclaimer}>
              This is a test order. No payment was collected, and shipping
              has not been arranged.
            </Text>
          ) : order.status === 'cancelled' ? (
            <Text style={styles.disclaimer}>
              This order has been cancelled. Its inventory restoration
              was handled by CardVault.
            </Text>
          ) : (
            <View style={styles.trackingList}>
              {trackingSteps.map((step, index) => {
                const completed = index <= currentStep;
                const current = index === currentStep;

                return (
                  <View key={step.title} style={styles.trackingStep}>
                    <View style={styles.trackingIcon}>
                      <Ionicons
                        name={
                          completed
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={25}
                        color={completed ? '#8FE3B0' : '#8B88A8'}
                      />
                    </View>

                    <View style={styles.trackingText}>
                      <Text style={styles.itemName}>
                        {step.title}
                        {current ? ' · Current' : ''}
                      </Text>
                      <Text style={styles.muted}>
                        {step.description}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {order.status === 'shipped' || order.status === 'delivered' ? (
          <>
            <Text style={styles.sectionTitle}>Shipping Information</Text>

            <View style={styles.card}>
              <Text style={styles.label}>SHIPPING CARRIER</Text>
              <Text style={styles.value}>
                {order.shippingCarrier || 'Not provided'}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.label}>TRACKING NUMBER</Text>

              <Pressable
                disabled={!order.trackingNumber || !order.shippingCarrier}
                onPress={() => {
                  const carrier =
                    order.shippingCarrier?.toLowerCase() ?? '';
                  const tracking = encodeURIComponent(
                    order.trackingNumber ?? ''
                  );

                  let url = '';

                  if (carrier.includes('ups')) {
                    url = `https://www.ups.com/track?tracknum=${tracking}`;
                  } else if (carrier.includes('fedex')) {
                    url = `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
                  } else if (
                    carrier.includes('usps') ||
                    carrier.includes('postal')
                  ) {
                    url = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
                  } else if (carrier.includes('dhl')) {
                    url = `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${tracking}`;
                  }

                  if (url) {
                    void Linking.openURL(url).catch((err) => {
                      console.error('Could not open tracking link:', err);
                      Alert.alert(
                        'Unable to Open Tracking',
                        'Please try opening the carrier website manually.'
                      );
                    });
                  }
                }}
              >
                <Text
                  selectable
                  style={[
                    styles.value,
                    order.trackingNumber && order.shippingCarrier
                      ? {
                          color: '#B7AEFF',
                          textDecorationLine: 'underline',
                        }
                      : null,
                  ]}
                >
                  {order.trackingNumber || 'Not provided'}
                </Text>
              </Pressable>

              <View style={styles.divider} />

              <Text style={styles.label}>SHIPPED DATE</Text>
              <Text style={styles.value}>
                {order.shippedAt
                  ? formatDate(order.shippedAt)
                  : 'Not provided'}
              </Text>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Items in This Order</Text>

        <View style={styles.card}>
          {order.items.map((item, index) => (
            <View key={`${item.id}-${index}`} style={styles.itemRow}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="albums-outline"
                  size={24}
                  color="#B7AEFF"
                />
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.muted}>{item.set}</Text>
                <Text style={styles.muted}>Card #: {item.number}</Text>
                <Text style={styles.muted}>
                  Condition: {item.condition || 'Not specified'}
                </Text>
                <Text style={styles.muted}>
                  {formatPrice(item.price)} × {item.quantity}
                </Text>
              </View>

              <Text style={styles.itemPrice}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalPrice}>
              {formatPrice(order.total)}
            </Text>
          </View>

          <Text style={styles.disclaimer}>
            This is a test order. No payment was collected, and no shipping
            has been arranged.
          </Text>
        </View>

        {canCancel ? (
          <Pressable
            style={[
              styles.cancelButton,
              cancelling && styles.disabledButton,
            ]}
            onPress={confirmCancellation}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.cancelButtonText}>
                CANCEL TEST ORDER
              </Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={() => router.replace('/(tabs)/orders')}
        >
          <Text style={styles.buttonText}>BACK TO ORDER HISTORY</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  back: {
    color: '#B7AEFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
  },
  subtitle: {
    color: '#D0CDDF',
    fontSize: 14,
    marginTop: 7,
    marginBottom: 22,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#302E4D',
    borderColor: '#514D70',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },
  label: {
    color: '#B7AEFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  orderNumber: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#514D70',
    marginVertical: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#444064',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 5,
  },
  muted: {
    color: '#D0CDDF',
    fontSize: 12,
    lineHeight: 18,
  },
  itemPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackingList: {
    marginTop: 18,
  },
  trackingStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  trackingIcon: {
    width: 30,
    alignItems: 'center',
  },
  trackingText: {
    flex: 1,
    gap: 4,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  totalPrice: {
    color: '#B7AEFF',
    fontSize: 22,
    fontWeight: '900',
  },
  disclaimer: {
    color: '#D0CDDF',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  button: {
    backgroundColor: '#7867F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cancelButton: {
    backgroundColor: '#C83F58',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  error: {
    color: '#FFB4B4',
    fontSize: 15,
    marginTop: 20,
  },
});
