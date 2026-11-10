
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCart, type Product } from '../../context/cart-context';

type StoreProduct = Product & {
  stock: number;
  isDemo: boolean;
};

type InventoryRow = {
  id: string;
  name: string;
  set_name: string;
  card_number: string;
  price: number;
  image: string | null;
  condition: string;
  category: 'Vintage' | 'Modern';
  quantity: number;
};

const demoProducts: StoreProduct[] = [
  {
    id: 'base1-4',
    name: 'Charizard',
    set: 'Base Set',
    number: '4/102',
    price: 249.99,
    image: 'https://images.pokemontcg.io/base1/4.png',
    condition: 'Near Mint',
    category: 'Vintage',
    stock: 0,
    isDemo: true,
  },
  {
    id: 'base1-2',
    name: 'Blastoise',
    set: 'Base Set',
    number: '2/102',
    price: 119.99,
    image: 'https://images.pokemontcg.io/base1/2.png',
    condition: 'Near Mint',
    category: 'Vintage',
    stock: 0,
    isDemo: true,
  },
  {
    id: 'base1-15',
    name: 'Venusaur',
    set: 'Base Set',
    number: '15/102',
    price: 99.99,
    image: 'https://images.pokemontcg.io/base1/15.png',
    condition: 'Lightly Played',
    category: 'Vintage',
    stock: 0,
    isDemo: true,
  },
  {
    id: 'base1-58',
    name: 'Pikachu',
    set: 'Base Set',
    number: '58/102',
    price: 14.99,
    image: 'https://images.pokemontcg.io/base1/58.png',
    condition: 'Near Mint',
    category: 'Vintage',
    stock: 0,
    isDemo: true,
  },
  {
    id: 'sv-charizard',
    name: 'Charizard ex',
    set: 'Scarlet & Violet',
    number: '125',
    price: 34.99,
    image: 'https://images.pokemontcg.io/sv3pt5/6.png',
    condition: 'Near Mint',
    category: 'Modern',
    stock: 0,
    isDemo: true,
  },
  {
    id: 'sv-pikachu',
    name: 'Pikachu',
    set: 'Scarlet & Violet',
    number: '025',
    price: 4.99,
    image: 'https://images.pokemontcg.io/sv1/25.png',
    condition: 'Near Mint',
    category: 'Modern',
    stock: 0,
    isDemo: true,
  },
];

type CategoryFilter = 'All' | 'Vintage' | 'Modern';
type ConditionFilter = 'All' | 'Near Mint' | 'Lightly Played';
type SetFilter = 'All Sets' | 'Base Set' | 'Scarlet & Violet';
type SortOption =
  | 'Featured'
  | 'Price: Low to High'
  | 'Price: High to Low';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [condition, setCondition] = useState<ConditionFilter>('All');
  const [cardSet, setCardSet] = useState<SetFilter>('All Sets');
  const [sort, setSort] = useState<SortOption>('Featured');
  const [inventory, setInventory] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { addToCart, count, items } = useCart();

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const { data, error } = await supabase
      .from('inventory')
      .select(
        'id, name, set_name, card_number, price, image, condition, category, quantity'
      )
      .gt('quantity', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Could not load store inventory:', error.message);
      setLoadError(true);
      setInventory([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as InventoryRow[];

    setInventory(
      rows.map((card) => ({
        id: card.id,
        name: card.name,
        set: card.set_name,
        number: card.card_number,
        price: Number(card.price),
        image: card.image ?? '',
        condition: card.condition,
        category: card.category,
        stock: card.quantity,
        isDemo: false,
      }))
    );

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [loadInventory])
  );

  // Demo cards remain visible but cannot be purchased.
  const products = useMemo(
    () => [...inventory, ...demoProducts],
    [inventory]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = products.filter((product) => {
      const matchesSearch = [
        product.name,
        product.set,
        product.number,
        product.condition,
        product.category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);

      const matchesCategory =
        category === 'All' || product.category === category;

      const matchesCondition =
        condition === 'All' || product.condition === condition;

      const matchesSet =
        cardSet === 'All Sets' || product.set === cardSet;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesCondition &&
        matchesSet
      );
    });

    if (sort === 'Price: Low to High') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort === 'Price: High to Low') {
      results.sort((a, b) => b.price - a.price);
    }

    return results;
  }, [products, search, category, condition, cardSet, sort]);

  function resetFilters() {
    setSearch('');
    setCategory('All');
    setCondition('All');
    setCardSet('All Sets');
    setSort('Featured');
  }

  function handleAddToCart(product: StoreProduct) {
    if (product.isDemo) {
      Alert.alert(
        'Demo card',
        'This sample card is for display only. Add your own card in the Sell tab to make it available for purchase.'
      );
      return;
    }

    const alreadyInCart =
      items.find((item) => item.id === product.id)?.quantity ?? 0;

    if (product.stock <= 0 || alreadyInCart >= product.stock) {
      Alert.alert(
        'Not enough stock',
        'Your cart already contains the available quantity of this card.'
      );
      return;
    }

    addToCart(product);
    Alert.alert('Added to cart', `${product.name} was added to your cart.`);
  }

  function chip<T extends string>(
    label: T,
    selected: T,
    onSelect: (value: T) => void
  ) {
    return (
      <Pressable
        key={label}
        onPress={() => onSelect(label)}
        style={[
          styles.chip,
          selected === label && styles.chipActive,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            selected === label && styles.chipTextActive,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Explore</Text>
            <Text style={styles.subtitle}>
              Find your next favorite card.
            </Text>
          </View>

          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>Cart {count}</Text>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search Pokémon, sets, number..."
          placeholderTextColor="#858B98"
          style={styles.search}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />

        <Text style={styles.filterTitle}>CARD ERA</Text>
        <View style={styles.filters}>
          {(['All', 'Vintage', 'Modern'] as const).map((value) =>
            chip(value, category, setCategory)
          )}
        </View>

        <Text style={styles.filterTitle}>CARD SET</Text>
        <View style={styles.filters}>
          {(
            ['All Sets', 'Base Set', 'Scarlet & Violet'] as const
          ).map((value) => chip(value, cardSet, setCardSet))}
        </View>

        <Text style={styles.filterTitle}>CONDITION</Text>
        <View style={styles.filters}>
          {(
            ['All', 'Near Mint', 'Lightly Played'] as const
          ).map((value) => chip(value, condition, setCondition))}
        </View>

        <Text style={styles.filterTitle}>SORT BY PRICE</Text>
        <View style={styles.filters}>
          {(
            [
              'Featured',
              'Price: Low to High',
              'Price: High to Low',
            ] as const
          ).map((value) => chip(value, sort, setSort))}
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>Trading Cards</Text>
          <Text style={styles.muted}>
            {filtered.length} listings
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color="#B7AEFF"
            size="large"
            style={styles.loader}
          />
        ) : loadError ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>
              Could not load your inventory.
            </Text>
            <Pressable
              style={styles.resetButton}
              onPress={loadInventory}
            >
              <Text style={styles.resetButtonText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((product) => {
              const cartQuantity =
                items.find((item) => item.id === product.id)?.quantity ?? 0;

              const unavailable =
                product.isDemo ||
                product.stock <= 0 ||
                cartQuantity >= product.stock;

              return (
                <View key={product.id} style={styles.product}>
                  {product.image ? (
                    <Image
                      source={{ uri: product.image }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.image, styles.noImage]}>
                      <Text style={styles.muted}>No Photo</Text>
                    </View>
                  )}

                  <View style={styles.productInfo}>
                    <Text style={styles.name}>{product.name}</Text>
                    <Text style={styles.muted}>{product.set}</Text>
                    <Text style={styles.muted}>
                      Card #{product.number}
                    </Text>
                    <Text style={styles.condition}>
                      {product.condition}
                    </Text>

                    {product.isDemo ? (
                      <Text style={styles.stockDemo}>
                        DEMO · NOT FOR SALE
                      </Text>
                    ) : (
                      <Text style={styles.stock}>
                        {product.stock - cartQuantity} available
                      </Text>
                    )}

                    <Text style={styles.price}>
                      ${product.price.toFixed(2)}
                    </Text>

                    <Pressable
                      style={[
                        styles.addButton,
                        unavailable && styles.addButtonDisabled,
                      ]}
                      disabled={unavailable}
                      onPress={() => handleAddToCart(product)}
                    >
                      <Text style={styles.addButtonText}>
                        {product.isDemo
                          ? 'DEMO ONLY'
                          : product.stock <= 0
                            ? 'SOLD OUT'
                            : cartQuantity >= product.stock
                              ? 'STOCK LIMIT'
                              : 'ADD TO CART'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No cards found.</Text>
            <Text style={styles.emptyHint}>
              Try changing your search or filters.
            </Text>
            <Pressable
              style={styles.resetButton}
              onPress={resetFilters}
            >
              <Text style={styles.resetButtonText}>
                CLEAR ALL FILTERS
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1, 
    backgroundColor: '#25243D', 
  },
  
  content: { 
    padding: 18, 
    paddingBottom: 30
            },
            
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  title: { 
    fontSize: 32, 
    fontWeight: '900',
    color: 'teal', 
    },
    
  subtitle: { 
    color: 'teal',
    marginTop: 4,
    },
    
  cartBadge: {
    backgroundColor: '#EAF1FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  cartBadgeText: { 
    color: '#25243D', 
    fontWeight: '800' 
  },
  
  search: {
    height: 50,
    borderRadius: 13,
    backgroundColor: '#F4F6F9',
    borderWidth: 1,
    borderColor: '#E5E8EF',
    paddingHorizontal: 14,
    color: '#202124',
  },
  
  filterTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 1,
  },
  
  filters: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 9,
  },
  
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'white',
  },
  
  chipActive: { 
    backgroundColor: 'ghostwhite', 
    borderColor: 'ghostwhite',
  },
  
  chipText: { 
    color: 'red', 
    fontWeight: '700', 
    fontSize: 12 
  },
    
  chipTextActive: { 
    color: '#25243D', 
  },
  
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: 'teal' 
  },
  
  muted: { 
    color: '#C4C2D5', 
    fontSize: 12, 
    marginTop: 4,
  },
  
  loader: { 
    marginVertical: 30, 
  },
  
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  product: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'white',
    overflow: 'hidden',
    backgroundColor: '#25243D',
  },
  
  image: { 
    width: '100%', 
    height: 190 

  },
  
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  productInfo: { 
    padding: 11, 
  },
  
  name: { 
    fontSize: 16, 
    fontWeight: '900', 
    color: 'white',
  },
  
  condition: {
    color: '#75D99A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },
  
  stock: {
    color: 'red',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },
  
  stockDemo: {
    color: 'red',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 7,
  },
  
  price: {
    color: 'dodgerblue',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 10,
  },
  
  addButton: {
    borderWidth: 1,
    backgroundColor: 'ghostwhite',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  
  addButtonDisabled: { backgroundColor: 'white' },
  addButtonText: {
    color: 'blueviolet',
    fontSize: 10,
    fontWeight: '900',
  },
  
  emptyContainer: { alignItems: 'center', paddingVertical: 35 },
  empty: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  
  emptyHint: { 
    textAlign: 'center', 
    color: '#C4C2D5', 
    marginTop: 8 
  },
  
  resetButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#B7AEFF',
  }, safeArea: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    color: '#146EF5',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: 'teal',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: 'white',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  testBanner: {
    backgroundColor: '#FFF4D8',
    borderColor: '#F1D38A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  testBannerTitle: {
    color: '#765000',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  testBannerText: {
    color: '#765000',
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E7EAF0',
  },
  sectionTitle: {
    color: 'blueviolet',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
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
    color: '#171B26',
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
  resetButtonText: {
    color: '#25243D',
    fontSize: 12,
    fontWeight: '900',
  }
});
