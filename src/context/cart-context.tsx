
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

export type Product = {
  id: string;
  name: string;
  set: string;
  number: string;
  price: number;
  image: string;
  condition: string;
  category: 'Vintage' | 'Modern';
};

export type CartItem = Product & {
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isLoaded: boolean;
  addToCart: (product: Product) => void;
  changeQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = '@cardvault_cart_v1';

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load the saved cart when the app starts.
  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      try {
        const savedCart = await AsyncStorage.getItem(STORAGE_KEY);

        if (savedCart && !cancelled) {
          const parsed: unknown = JSON.parse(savedCart);

          if (Array.isArray(parsed)) {
            const validItems = parsed.filter(
              (item): item is CartItem =>
                item !== null &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.name === 'string' &&
                typeof item.price === 'number' &&
                Number.isFinite(item.price) &&
                typeof item.quantity === 'number' &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            );

            setItems(validItems);
          }
        }
      } catch (error) {
        console.error('Could not load CardVault cart:', error);
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    loadCart();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save changes only after the initial load finishes.
  useEffect(() => {
    if (!isLoaded) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(
      error => {
        console.error('Could not save CardVault cart:', error);
      }
    );
  }, [items, isLoaded]);

  const addToCart = (product: Product) => {
    setItems(current => {
      const existing = current.find(item => item.id === product.id);

      if (existing) {
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  };

  const changeQuantity = (id: string, delta: number) => {
    setItems(current =>
      current
        .map(item =>
          item.id === id
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
      isLoaded,
      addToCart,
      changeQuantity,
      removeFromCart,
      clearCart,
    }),
    [items, isLoaded]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return context;
}
