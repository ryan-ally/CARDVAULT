import { useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCart, type Product } from '../../context/cart-context';

const products: Product[] = [
  { id: 'base1-4', name: 'Charizard', set: 'Base Set', number: '4/102', price: 249.99, image: 'https://images.pokemontcg.io/base1/4.png', condition: 'Near Mint', category: 'Vintage' },
  { id: 'base1-2', name: 'Blastoise', set: 'Base Set', number: '2/102', price: 119.99, image: 'https://images.pokemontcg.io/base1/2.png', condition: 'Near Mint', category: 'Vintage' },
  { id: 'base1-15', name: 'Venusaur', set: 'Base Set', number: '15/102', price: 99.99, image: 'https://images.pokemontcg.io/base1/15.png', condition: 'Lightly Played', category: 'Vintage' },
  { id: 'base1-58', name: 'Pikachu', set: 'Base Set', number: '58/102', price: 14.99, image: 'https://images.pokemontcg.io/base1/58.png', condition: 'Near Mint', category: 'Vintage' },
  { id: 'sv-charizard', name: 'Charizard ex', set: 'Scarlet & Violet', number: '125', price: 34.99, image: 'https://images.pokemontcg.io/sv3pt5/6.png', condition: 'Near Mint', category: 'Modern' },
  { id: 'sv-pikachu', name: 'Pikachu', set: 'Scarlet & Violet', number: '025', price: 4.99, image: 'https://images.pokemontcg.io/sv1/25.png', condition: 'Near Mint', category: 'Modern' },
];

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Vintage' | 'Modern'>('All');
  const { addToCart, count } = useCart();

  const filtered = useMemo(() => products.filter(product => {
    const matchesSearch = `${product.name} ${product.set}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'All' || product.category === filter);
  }), [search, filter]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Explore</Text>
            <Text style={styles.subtitle}>Find your next favorite card.</Text>
          </View>
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>Cart {count}</Text></View>
        </View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search Pokémon or sets..." placeholderTextColor="#858B98" style={styles.search} />
        <View style={styles.filters}>
          {(['All', 'Vintage', 'Modern'] as const).map(value => (
            <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>Trading Cards</Text>
          <Text style={styles.muted}>{filtered.length} listings</Text>
        </View>
        <View style={styles.grid}>
          {filtered.map(product => (
            <View key={product.id} style={styles.product}>
              <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
              <View style={styles.productInfo}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.muted}>{product.set}</Text>
                <Text style={styles.condition}>{product.condition}</Text>
                <Text style={styles.price}>${product.price.toFixed(2)}</Text>
                <Pressable style={styles.addButton} onPress={() => addToCart(product)}>
                  <Text style={styles.addButtonText}>ADD TO CART</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {filtered.length === 0 && <Text style={styles.empty}>No cards found. Try a different search.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 18, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#202124' },
  subtitle: { color: '#777E8B', marginTop: 4 },
  cartBadge: { backgroundColor: '#EAF1FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  cartBadgeText: { color: '#146EF5', fontWeight: '800' },
  search: { height: 50, borderRadius: 13, backgroundColor: '#F4F6F9', borderWidth: 1, borderColor: '#E5E8EF', paddingHorizontal: 14, color: '#202124' },
  filters: { flexDirection: 'row', gap: 9, marginTop: 16, marginBottom: 24 },
  filter: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#F0F2F5' },
  filterActive: { backgroundColor: '#146EF5' },
  filterText: { color: '#555D6B', fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#202124' },
  muted: { color: '#7A8190', fontSize: 12, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  product: { width: '48%', borderRadius: 16, borderWidth: 1, borderColor: '#E6E9EF', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  image: { width: '100%', height: 190, backgroundColor: '#F5F7FB' },
  productInfo: { padding: 11 },
  name: { fontSize: 16, fontWeight: '900', color: '#202124' },
  condition: { color: '#178344', fontSize: 11, fontWeight: '700', marginTop: 5 },
  price: { color: '#146EF5', fontSize: 18, fontWeight: '900', marginTop: 10, marginBottom: 10 },
  addButton: { backgroundColor: '#202124', borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  empty: { textAlign: 'center', padding: 30, color: '#777E8B' },
});
