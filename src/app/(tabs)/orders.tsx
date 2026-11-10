
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getOrders,
  getCustomerOrders,
  type Order,
} from '../../context/order-context';
import { useAuth } from '../../context/auth-context';

export default function OrdersScreen() {
  const { session, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (authLoading) return;

    try {
      setError('');

      if (session?.user.id) {
        // Signed-in customers see only orders belonging to their account.
        const customerOrders = await getCustomerOrders(session.user.id);
        setOrders(customerOrders);
      } else {
        // Preserve existing on-device order history for guests.
        const savedOrders = await getOrders();
        setOrders(savedOrders);
      }
    } catch (err) {
      console.error('Could not load orders:', err);
      setError('Could not load your orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id, authLoading]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      setLoading(true);
      loadOrders();
    }, [loadOrders, authLoading])
  );

  const formatDate = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Date unavailable';

    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;


  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      style={styles.orderCard}
      onPress={() =>
        router.push({
          pathname: '/order-details',
          params: { orderId: item.id },
        })
      }
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.id}</Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>

        <View style={styles.testBadge}>
          <Text style={styles.testBadgeText}>TEST ORDER</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {item.items.map((card, index) => (
        <View
          key={`${item.id}-${card.id}-${index}`}
          style={styles.itemRow}
        >
          <View style={styles.cardIcon}>
            <Ionicons
              name="albums-outline"
              size={22}
              color="#146EF5"
            />
          </View>

          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{card.name}</Text>
            <Text style={styles.itemSubtext}>
              {card.set} · Qty: {card.quantity}
            </Text>
          </View>

          <Text style={styles.itemPrice}>
            {formatPrice(card.price * card.quantity)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Order total</Text>
        <Text style={styles.totalPrice}>
          {formatPrice(item.total)}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color="#946200"
        />
        <Text style={styles.statusText}>
          Test order · No payment charged
        </Text>
      </View>
    </Pressable>
  );
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
        <Text style={styles.subtitle}>
          Your saved CardVault orders
        </Text>
      </View>

      {loading || authLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#146EF5" />
          <Text style={styles.helperText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={
            orders.length === 0 ? styles.emptyList : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders();
              }}
              tintColor="#146EF5"
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="receipt-outline"
                size={58}
                color="#AAB2C0"
              />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>
                Your saved orders will appear here after you complete checkout.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'teal',
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: 'black',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  helperText: {
    marginTop: 12,
    color: 'white',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'ghostwhite',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: 'black',
  },
  date: {
    marginTop: 5,
    fontSize: 12,
    color: 'blue',
  },
  testBadge: {
    backgroundColor: 'ghostwhite',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  testBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'blueviolet',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF0F5',
    marginVertical: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'ghostwhite',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  itemSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: 'black',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: 'dodgerblue',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'black',
    fontWeight: '600',
  },
  totalPrice: {
    fontSize: 19,
    fontWeight: '800',
    color: 'red',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 9,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    color: 'black',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: '800',
    color: 'black',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: 'teal',
    textAlign: 'center',
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    fontSize: 14,
  },
});