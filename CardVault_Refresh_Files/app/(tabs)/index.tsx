import { router } from 'expo-router';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCart } from '../../context/cart-context';

const featured = {
  id: 'base1-4',
  name: 'Charizard',
  set: 'Base Set',
  number: '4/102',
  price: 249.99,
  image: 'https://images.pokemontcg.io/base1/4.png',
  condition: 'Near Mint',
  category: 'Vintage' as const,
};

export default function HomeScreen() {
  const { addToCart } = useCart();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>CARDVAULT</Text>
        <Text style={styles.subtitle}>Your Pokémon card marketplace</Text>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>BUILD YOUR COLLECTION</Text>
          <Text style={styles.heroTitle}>Find your next{'\n'}favorite card.</Text>
          <Text style={styles.heroCopy}>Discover vintage classics and modern Pokémon hits.</Text>
          <Pressable style={styles.yellowButton} onPress={() => router.push('/explore')}>
            <Text style={styles.yellowButtonText}>SHOP CARDS</Text>
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Featured Card</Text>
          <Pressable onPress={() => router.push('/explore')}><Text style={styles.link}>View all</Text></Pressable>
        </View>

        <View style={styles.card}>
          <Image source={{ uri: featured.image }} style={styles.cardImage} resizeMode="contain" />
          <View style={styles.cardDetails}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{featured.name}</Text>
                <Text style={styles.muted}>{featured.set} · Holo Rare</Text>
              </View>
              <Text style={styles.price}>$249.99</Text>
            </View>
            <Text style={styles.condition}>{featured.condition} · #{featured.number}</Text>
            <Pressable style={styles.darkButton} onPress={() => addToCart(featured)}>
              <Text style={styles.darkButtonText}>ADD TO CART</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 30 },
  brand: { fontSize: 32, fontWeight: '900', letterSpacing: -1, color: '#202124' },
  subtitle: { color: '#777E8B', fontSize: 15, marginTop: 4, marginBottom: 24 },
  hero: { backgroundColor: '#146EF5', borderRadius: 24, padding: 24, marginBottom: 28 },
  eyebrow: { color: '#FFE36E', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  heroCopy: { color: '#EAF1FF', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 20 },
  yellowButton: { backgroundColor: '#FFD84D', padding: 15, borderRadius: 13, alignItems: 'center' },
  yellowButtonText: { color: '#202124', fontWeight: '900' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 23, fontWeight: '900', color: '#202124' },
  link: { color: '#146EF5', fontWeight: '800' },
  card: { borderWidth: 1, borderColor: '#E7E9EF', borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  cardImage: { width: '100%', height: 260, backgroundColor: '#F4F6FA' },
  cardDetails: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 22, fontWeight: '900', color: '#202124' },
  muted: { color: '#777E8B', fontSize: 13, marginTop: 4 },
  price: { fontSize: 19, fontWeight: '900', color: '#146EF5' },
  condition: { color: '#178344', fontWeight: '700', marginTop: 12 },
  darkButton: { backgroundColor: '#202124', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  darkButtonText: { color: '#FFFFFF', fontWeight: '900' },
});
