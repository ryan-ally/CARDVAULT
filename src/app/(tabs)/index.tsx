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
        <Pressable style={styles.darkButton} onPress={() => router.push('/sell')}>
  <Text style={styles.darkButtonText}>Sell Your Cards</Text>
</Pressable>
        <Pressable style={styles.vaultBot} onPress={() => router.push('/chat')}>
  <Text style={styles.vaultBotText}> 🤖 Chat with VaultBot</Text>
</Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#25243D', },
  content: { padding: 20, paddingBottom: 30 },
  brand: { fontSize: 32, fontWeight: '900', letterSpacing: -1, color: 'teal', },
  subtitle: { color: 'ghostwhite', fontSize: 15, marginTop: 4, marginBottom: 24 },
  hero: { backgroundColor: 'teal', borderRadius: 24, padding: 24, marginBottom: 28, color:'black' },
  eyebrow: { color: 'black', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  heroTitle: { color: 'ghostwhite', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  heroCopy: { color: 'ghostwhite', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 20 },
  yellowButton: { backgroundColor: '#25243D', padding: 15, borderRadius: 13, alignItems: 'center', borderColor: '#25243D',color:'ghostwhite',borderWidth: 1, },
  yellowButtonText: { color: 'white', fontWeight: '900' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 23, fontWeight: '900', color: 'white' 
    
  },
  link: { color: 'red', fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden', borderColor:'#25243D', backgroundColor: '#25243D', },
  cardImage: { width: '100%', height: 260, backgroundColor: '#25243D' },
  cardDetails: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 22, fontWeight: '900', color: 'ghostwhite' },
  muted: { color: 'dodgerblue', fontSize: 13, marginTop: 4 },
  price: { fontSize: 19, fontWeight: '900', color: 'dodgerblue' },
  condition: { color: '#178344', fontWeight: '700', marginTop: 12 },
  darkButton: {borderWidth: 1, backgroundColor: 'teal',borderRadius: 13, padding: 4,  alignItems: 'center', marginTop: 12, borderColor:'teal'},
  darkButtonText: { color: 'ghostwhite', fontWeight: '900',backgroundColor:'teal', padding:13, borderRadius: 13},
  buttonText: { backgroundColor:'ghostwhite',borderRadius: 13, color:'red',fontWeight:'900',},
  vaultBot:{  backgroundColor:'#25243D', alignItems:'center', padding: 7, color:'ghostwhite', margin: 5, },  
  vaultBotText:{ borderRadius: 13,alignItems:'center',padding: 7,color:'teal',backgroundColor:'white', borderColor:'teal', borderWidth: 1,},
  

  label: {
    color: '#333A48',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE2EA',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: '#171B26',
    fontSize: 15,
    marginBottom: 15,
  },
  stateZipRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stateColumn: {
    flex: 1,
  },
  zipColumn: {
    flex: 1.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  itemDetails: {
    color: '#6D7482',
    fontSize: 12,
    marginTop: 4,
  },
  itemQuantity: {
    color: '#6D7482',
    fontSize: 12,
    marginTop: 4,
  },
  itemPrice: {
    color: '#171B26',
    fontSize: 15,
    fontWeight: '700',
    paddingTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E7EAF0',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    gap: 12,
  },
  summaryLabel: {
    color: '#6D7482',
    fontSize: 14,
  },
  summaryValue: {
    color: '#171B26',
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: '#146EF5',
    fontSize: 21,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 54,
    backgroundColor: '#146EF5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#777F8D',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  successContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DDF7E8',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  successCheck: {
    color: '#148044',
    fontSize: 38,
    fontWeight: '800',
  },
  successTitle: {
    color: '#171B26',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#6D7482',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderColor: '#E7EAF0',
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  orderNumber: {
    color: '#171B26',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
  },
  testNotice: {
    color: '#765000',
    backgroundColor: '#FFF4D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#146EF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#146EF5',
    fontSize: 15,
    fontWeight: '800',
  },
});
