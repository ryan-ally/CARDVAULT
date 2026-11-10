
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCart } from '../../context/cart-context';
import { supabase } from '../../lib/supabase';

type StockMap = Record<string, number | null>;

export default function CartScreen() {
  const {
    items,
    count,
    subtotal,
    isLoaded,
    changeQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [stockById, setStockById] = useState<StockMap>({});
  const [checkingStock, setCheckingStock] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const fetchStock = useCallback(async (): Promise<StockMap> => {
    const ids = items.map(item => item.id);

    if (ids.length === 0) {
      return {};
    }

    const { data, error } = await supabase
      .from('inventory')
      .select('id,quantity')
      .in('id', ids);

    if (error) {
      throw error;
    }

    const result: StockMap = {};

    for (const id of ids) {
      const listing = data?.find(row => row.id === id);

      result[id] =
        listing && typeof listing.quantity === 'number'
          ? listing.quantity
          : null;
    }

    return result;
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refresh() {
        if (!isLoaded) {
          setCheckingStock(true);
          return;
        }

        setCheckingStock(true);

        try {
          const stock = await fetchStock();

          if (active) {
            setStockById(stock);
          }
        } catch (error) {
          console.error('Stock refresh failed:', error);

          if (active) {
            const unavailable: StockMap = {};

            items.forEach(item => {
              unavailable[item.id] = null;
            });

            setStockById(unavailable);
          }
        } finally {
          if (active) {
            setCheckingStock(false);
          }
        }
      }

      refresh();

      return () => {
        active = false;
      };
    }, [fetchStock, isLoaded])
  );

  const increaseQuantity = async (id: string) => {
    if (updatingId || checkingStock || checkingOut) return;

    const item = items.find(cartItem => cartItem.id === id);
    if (!item) return;

    setUpdatingId(id);

    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      const available =
        typeof data?.quantity === 'number'
          ? data.quantity
          : 0;

      setStockById(current => ({
        ...current,
        [id]: available,
      }));

      if (available <= 0) {
        Alert.alert(
          'Sold Out',
          'This card is no longer available.'
        );
        return;
      }

      if (item.quantity >= available) {
        Alert.alert(
          'Stock Limit Reached',
          `Only ${available} ${available === 1 ? 'copy is' : 'copies are'
          } available.`
        );
        return;
      }

      changeQuantity(id, 1);
    } catch (error) {
      console.error('Quantity check failed:', error);

      Alert.alert(
        'Stock Check Failed',
        'Could not verify availability. Please try again.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCheckout = async () => {
    if (!isLoaded || checkingStock || checkingOut) return;
    if (items.length === 0) return;

    setCheckingOut(true);

    try {
      const currentStock = await fetchStock();
      setStockById(currentStock);

      const invalidItems = items.filter(item => {
        const available = currentStock[item.id];

        return (
          available === null ||
          available === undefined ||
          available < item.quantity
        );
      });

      if (invalidItems.length > 0) {
        Alert.alert(
          'Update Your Cart',
          invalidItems
            .map(item => {
              const available = currentStock[item.id];

              if (available === null || available === undefined) {
                return `${item.name}: listing unavailable.`;
              }

              if (available <= 0) {
                return `${item.name}: sold out.`;
              }

              return `${item.name}: only ${available} available, but you have ${item.quantity} in your cart.`;
            })
            .join('\n\n')
        );

        return;
      }

      router.push('/checkout');
    } catch (error) {
      console.error('Checkout stock check failed:', error);

      Alert.alert(
        'Could Not Verify Stock',
        'Please try again before proceeding to checkout.'
      );
    } finally {
      setCheckingOut(false);
    }
  };

  const checkoutDisabled =
    !isLoaded ||
    checkingStock ||
    checkingOut ||
    updatingId !== null ||
    items.length === 0;

  return (
    <SafeAreaView style= { styles.safe } >
    <ScrollView contentContainerStyle={ styles.content }>
      <View style={ styles.header }>
        <View>
        <Text style={ styles.title }> Your Cart </Text>
          < Text style = { styles.subtitle } >
            { count } { count === 1 ? 'item' : 'items' } in your cart
              </Text>
              </View>

  {
    items.length > 0 && (
      <Pressable
              onPress={
      () =>
        Alert.alert(
          'Clear Cart?',
          'Remove all items from your cart?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear All',
              style: 'destructive',
              onPress: clearCart,
            },
          ]
        )
    }
            >
      <Text style={ styles.remove }> Clear all </Text>
        </Pressable>
          )
  }
  </View>

  {
    !isLoaded ? (
      <ActivityIndicator size= "large" color = "#A78BFA" />
        ) : items.length === 0 ? (
      <View style= { styles.empty } >
      <Text style={ styles.emptyIcon }>🛒</Text>
        < Text style = { styles.emptyTitle } >
          Your cart is empty
            </Text>
            < Text style = { styles.subtitle } >
              Explore the marketplace to find cards.
            </Text>

                < Pressable
    style = { styles.primary }
    onPress = {() => router.push('/(tabs)/marketplace')
  }
            >
    <Text style={ styles.primaryText }>
      SHOP MARKETPLACE
        </Text>
        </Pressable>
        </View>
        ) : (
    <>
    {
      items.map(item => {
        const stock = stockById[item.id];

        const soldOut = stock === 0;
        const unavailable =
          stock === null || stock === undefined;

        const overStock =
          typeof stock === 'number' &&
          item.quantity > stock;

        const cannotIncrease =
          checkingStock ||
          checkingOut ||
          updatingId !== null ||
          unavailable ||
          item.quantity >= stock;

        return (
          <View key= { item.id } style = { styles.item } >
          {
            item.image ? (
              <Image
                      source= {{ uri: item.image }
      }
                      style = { styles.image }
                      resizeMode = "contain"
        />
                  ) : (
          <View style={ styles.imagePlaceholder } >
        <Text style={ styles.placeholderText } >
        No Photo
        </Text>
        </View>
        )}

<View style={ styles.details }>
  <Text style={ styles.name }> { item.name } </Text>

    < Text style = { styles.subtitle } >
      { item.set } · { item.number }
</Text>

  < Text style = { styles.price } >
    ${ Number(item.price).toFixed(2) }
</Text>

{
  checkingStock ? (
    <Text style= { styles.stockWarning } >
    Checking availability…
  </Text>
                    ) : soldOut ? (
    <Text style= { styles.stockWarning } >
    Sold out — remove this item
      </Text>
                    ) : unavailable ? (
    <Text style= { styles.stockWarning } >
    Stock could not be verified
      </Text>
                    ) : (
    <Text style= { styles.stockText } >
    { stock } { stock === 1 ? 'copy' : 'copies' } available
      </Text>
                    )
}

{
  overStock && (
    <Text style={ styles.stockWarning }>
      Quantity exceeds available stock.
                      </Text>
                    )
}

<View style={ styles.quantityRow }>
  <Pressable
                        style={ styles.qtyButton }
onPress = {() => changeQuantity(item.id, -1)}
disabled = { checkingOut }
  >
  <Text style={ styles.qtyText }>−</Text>
    </Pressable>

    < Text style = { styles.quantity } >
      { item.quantity }
      </Text>

      < Pressable
style = {
  [
  styles.qtyButton,
  cannotIncrease && styles.disabledButton,
                        ]}
disabled = { cannotIncrease }
onPress = {() => increaseQuantity(item.id)}
                      >
  <Text style={ styles.qtyText }> +</Text>
    </Pressable>

    < Pressable
onPress = {() => removeFromCart(item.id)}
disabled = { checkingOut }
  >
  <Text style={ styles.remove }> Remove </Text>
    </Pressable>
    </View>
    </View>
    </View>
              );
            })}

<View style={ styles.summary }>
  <Text style={ styles.summaryTitle }>
    Order Summary
      </Text>

      < View style = { styles.summaryRow } >
        <Text style={ styles.subtitle }> Subtotal </Text>
          < Text style = { styles.summaryValue } >
            ${ subtotal.toFixed(2) }
</Text>
  </View>

  < View style = { styles.summaryRow } >
    <Text style={ styles.subtitle }> Shipping </Text>
      < Text style = { styles.summaryValue } >
        Calculated at checkout
          </Text>
          </View>

          < View style = { styles.line } />

            <View style={ styles.summaryRow }>
              <Text style={ styles.totalLabel }>
                Estimated total
                  </Text>
                  < Text style = { styles.total } >
                    ${ subtotal.toFixed(2) }
</Text>
  </View>

  < Text style = { styles.disclaimer } >
    Taxes and shipping are not included.
                Payments are not connected yet.
              </Text>

  < Pressable
style = { styles.primary }
onPress = {() =>
router.push('/(tabs)/marketplace')
                }
              >
  <Text style={ styles.primaryText }>
    CONTINUE SHOPPING
      </Text>
      </Pressable>
      </View>

      < Pressable
style = {
  [
  styles.primary,
  checkoutDisabled && styles.disabledCheckout,
              ]}
disabled = { checkoutDisabled }
onPress = { handleCheckout }
  >
  <Text style={ styles.primaryText }>
  {
    checkingOut
    ? 'Checking stock…'
      : 'Proceed to Checkout'
  }
    </Text>
    </Pressable>
    </>
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
    padding: 20,
    paddingBottom: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: 'blueviolet',
  },
  subtitle: {
    color: 'white',
    fontSize: 13,
    marginTop: 5,
  },
  remove: {
    color: '#D93025',
    fontWeight: '800',
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 65,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  item: {
    flexDirection: 'row',
    gap: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: 'lightblue',
    backgroundColor: 'blueviolet',
    borderRadius: 16,
    marginBottom: 13,
  },
  image: {
    width: 95,
    height: 130,
    backgroundColor: '#F5F7FB',
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: 95,
    height: 130,
    backgroundColor: '#333347',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  price: {
    color: 'dodgerblue',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  stockText: {
    color: '#D9FDD3',
    fontSize: 12,
    marginTop: 7,
    fontWeight: '700',
  },
  stockWarning: {
    color: '#FFD2D2',
    fontSize: 12,
    marginTop: 7,
    fontWeight: '800',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  qtyButton: {
    width: 29,
    height: 29,
    backgroundColor: '#EAF1FF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.35,
  },
  qtyText: {
    color: '#146EF5',
    fontSize: 20,
    fontWeight: '900',
  },
  quantity: {
    color: 'white',
    fontWeight: '800',
  },
  summary: {
    borderWidth: 1,
    borderColor: 'lightblue',
    borderRadius: 18,
    padding: 17,
    marginTop: 8,
    backgroundColor: '#25243D',
  },
  summaryTitle: {
    color: 'white',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  summaryValue: {
    color: 'white',
    fontSize: 13,
    textAlign: 'right',
  },
  line: {
    height: 1,
    backgroundColor: '#E6E9EF',
    marginVertical: 10,
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  total: {
    color: 'ghostwhite',
    fontSize: 22,
    fontWeight: '900',
  },
  disclaimer: {
    color: 'white',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  primary: {
    backgroundColor: 'teal',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    borderColor: 'lightblue',
  },
  disabledCheckout: {
    opacity: 0.5,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});