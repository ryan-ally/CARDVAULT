import { router } from 'expo-router';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCart } from '../../context/cart-context';

export default function CartScreen() {
  const { items, count, subtotal, changeQuantity, removeFromCart, clearCart } = useCart();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Your Cart</Text>
            <Text style={styles.subtitle}>{count} {count === 1 ? 'item' : 'items'} in your cart</Text>
          </View>
          {items.length > 0 && <Pressable onPress={clearCart}><Text style={styles.remove}>Clear all</Text></Pressable>}
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.subtitle}>Explore the marketplace to find cards.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/explore')}>
              <Text style={styles.primaryText}>EXPLORE CARDS</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {items.map(item => (
              <View key={item.id} style={styles.item}>
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
                <View style={styles.details}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.subtitle}>{item.set} · {item.number}</Text>
                  <Text style={styles.price}>${item.price.toFixed(2)}</Text>
                  <View style={styles.quantityRow}>
                    <Pressable style={styles.qtyButton} onPress={() => changeQuantity(item.id, -1)}><Text style={styles.qtyText}>−</Text></Pressable>
                    <Text style={styles.quantity}>{item.quantity}</Text>
                    <Pressable style={styles.qtyButton} onPress={() => changeQuantity(item.id, 1)}><Text style={styles.qtyText}>+</Text></Pressable>
                    <Pressable onPress={() => removeFromCart(item.id)}><Text style={styles.remove}>Remove</Text></Pressable>
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}><Text style={styles.subtitle}>Subtotal</Text><Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.subtitle}>Shipping</Text><Text style={styles.summaryValue}>Calculated at checkout</Text></View>
              <View style={styles.line} />
              <View style={styles.summaryRow}><Text style={styles.totalLabel}>Estimated total</Text><Text style={styles.total}>${subtotal.toFixed(2)}</Text></View>
              <Text style={styles.disclaimer}>Taxes and shipping are not included. Checkout and payments are not connected yet.</Text>
              <Pressable style={styles.primary} onPress={() => router.push('/explore')}>
                <Text style={styles.primaryText}>CONTINUE SHOPPING</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 32, fontWeight: '900', color: '#202124' },
  subtitle: { color: '#777E8B', fontSize: 13, marginTop: 5 },
  remove: { color: '#D93025', fontWeight: '800', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 65 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 23, fontWeight: '900', color: '#202124' },
  item: { flexDirection: 'row', gap: 13, padding: 12, borderWidth: 1, borderColor: '#E6E9EF', borderRadius: 16, marginBottom: 13 },
  image: { width: 95, height: 130, backgroundColor: '#F5F7FB', borderRadius: 8 },
  details: { flex: 1, justifyContent: 'center' },
  name: { color: '#202124', fontSize: 18, fontWeight: '900' },
  price: { color: '#146EF5', fontSize: 18, fontWeight: '900', marginTop: 8 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  qtyButton: { width: 29, height: 29, backgroundColor: '#EAF1FF', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: '#146EF5', fontSize: 20, fontWeight: '900' },
  quantity: { color: '#202124', fontWeight: '800' },
  summary: { borderWidth: 1, borderColor: '#E6E9EF', borderRadius: 18, padding: 17, marginTop: 8 },
  summaryTitle: { color: '#202124', fontSize: 21, fontWeight: '900', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginVertical: 8 },
  summaryValue: { color: '#202124', fontSize: 13, textAlign: 'right' },
  line: { height: 1, backgroundColor: '#E6E9EF', marginVertical: 10 },
  totalLabel: { color: '#202124', fontSize: 16, fontWeight: '900' },
  total: { color: '#146EF5', fontSize: 22, fontWeight: '900' },
  disclaimer: { color: '#777E8B', fontSize: 11, lineHeight: 16, marginTop: 12 },
  primary: { backgroundColor: '#146EF5', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
