
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/cart-context';

type InventoryCard = {
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

export default function MarketplaceScreen() {
    const [cards, setCards] = useState<InventoryCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const { addToCart, items, isLoaded } = useCart();

    const loadCards = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data, error: queryError } = await supabase
                .from('inventory')
                .select(
                    'id,name,set_name,card_number,price,image,condition,category,quantity'
                )
                .gt('quantity', 0);

            if (queryError) {
                throw queryError;
            }

            setCards((data ?? []) as InventoryCard[]);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not load marketplace.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCards();
        }, [loadCards])
    );

    const handleAddToCart = (card: InventoryCard) => {
        if (!isLoaded) {
            Alert.alert('Please wait', 'Your cart is loading.');
            return;
        }

        const existingQuantity =
            items.find(item => item.id === card.id)?.quantity ?? 0;

        if (existingQuantity >= card.quantity) {
            Alert.alert(
                'Stock Limit Reached',
                `Only ${card.quantity} available.`
            );
            return;
        }

        addToCart({
            id: card.id,
            name: card.name,
            set: card.set_name,
            number: card.card_number,
            price: Number(card.price),
            image: card.image ?? '',
            condition: card.condition,
            category: card.category,
        });

        Alert.alert(
            'Added to Cart',
            `${card.name} was added successfully.`,
            [
                {
                    text: 'Keep Shopping',
                    style: 'cancel',
                },
                {
                    text: 'View Cart',
                    onPress: () => router.push('/(tabs)/cart'),
                },
            ]
        );
    };

    const renderCard = ({ item }: { item: InventoryCard }) => {
        const inCart =
            items.find(cartItem => cartItem.id === item.id)?.quantity ?? 0;

        const limitReached = inCart >= item.quantity;

        return (
            <View style= { styles.card } >
            {
                item.image ? (
                    <Image
            source= {{ uri: item.image }
    }
    style = { styles.image }
        />
        ) : (
        <View style= { styles.imagePlaceholder } >
        <Text style={ styles.placeholderText }>
            No Photo
                </Text>
                </View>
                
        )
}

<View style={ styles.details }>
    <Text style={ styles.cardName }> { item.name } </Text>

        < Text style = { styles.detail } >
            { item.set_name }
            </Text>

            < Text style = { styles.detail } >
            #{ item.card_number }
</Text>

    < Text style = { styles.detail } >
        Condition: { item.condition }
</Text>

    < Text style = { styles.price } >
        ${ Number(item.price).toFixed(2) }
</Text>

    < Text style = { styles.stock } >
        { item.quantity } in stock
        </Text>

{
    inCart > 0 && (
        <Text style={ styles.inCart }>
            { inCart } in your cart
                </Text>
          )
}

<Pressable
            style={
    [
        styles.button,
        (!isLoaded || limitReached) &&
        styles.disabledButton,
    ]
}
disabled = {!isLoaded || limitReached}
onPress = {() => handleAddToCart(item)}
          >
    <Text style={ styles.buttonText }>
    {
        limitReached
        ? 'Stock Limit Reached'
            : 'Add to Cart'
    }
        </Text>
        </Pressable>
        </View>
        </View>
    );
  };

return (
    <View style= { styles.container } >
    <Text style={ styles.title }>
        CardVault Marketplace
            </Text>

            < Text style = { styles.subtitle } >
                Buy and sell Pokémon cards
                    </Text>

                    < Pressable
style = { styles.cartShortcut }
onPress = {() => router.push('/(tabs)/cart')}
      >
    <Text style={ styles.cartShortcutText }>
        View Cart({
            items.reduce(
                (sum, item) => sum + item.quantity,
                0
            )
        })
            </Text>
            </Pressable>

{
    loading ? (
        <ActivityIndicator
          size= "large"
          color = "#A78BFA"
        />
      ) : error ? (
        <View style= { styles.center } >
        <Text style={ styles.message }> { error } </Text>

            < Pressable
    style = { styles.retryButton }
    onPress = { loadCards }
        >
        <Text style={ styles.buttonText }>
            Try Again
                </Text>
                </Pressable>
                </View>
      ) : (
        <FlatList
          data= { cards }
    keyExtractor = { item => item.id }
    renderItem = { renderCard }
    contentContainerStyle = { styles.list }
    refreshing = { loading }
    onRefresh = { loadCards }
    ListEmptyComponent = {
            < Text style = { styles.message } >
        No cards available yet.
            </Text>
}
        />
      )}
</View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#25243D',
        paddingTop: 24,
        paddingHorizontal: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    subtitle: {
        color: '#BBBBBB',
        marginTop: 6,
        marginBottom: 12,
    },
    cartShortcut: {
        backgroundColor: '#383252',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    cartShortcutText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
    list: {
        paddingBottom: 40,
    },
    center: {
        alignItems: 'center',
        marginTop: 30,
    },
    message: {
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 30,
    },
    retryButton: {
        backgroundColor: '#514078',
        padding: 12,
        borderRadius: 8,
        marginTop: 15,
    },
    card: {
        backgroundColor: '#191923',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        marginBottom: 12,
    },
    image: {
        width: 110,
        height: 150,
        borderRadius: 8,
        resizeMode: 'contain',
    },
    imagePlaceholder: {
        width: 110,
        height: 150,
        backgroundColor: '#333347',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#BBBBBB',
    },
    details: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    cardName: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: 'bold',
    },
    detail: {
        color: '#BBBBBB',
        marginTop: 4,
        fontSize: 12,
    },
    price: {
        color: '#A78BFA',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 8,
    },
    stock: {
        color: '#4ADE80',
        marginTop: 5,
        fontSize: 12,
    },
    inCart: {
        color: '#FACC15',
        marginTop: 4,
        fontSize: 12,
    },
    button: {
        backgroundColor: '#7C3AED',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#514078',
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
});
