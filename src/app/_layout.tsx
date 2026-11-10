
import { Stack } from 'expo-router';
import AppStripeProvider from '../components/AppStripeProvider';
import { AuthProvider } from '../context/auth-context';
import { CartProvider } from '../context/cart-context';

export default function RootLayout() {
  return (
    <AppStripeProvider>
      <AuthProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="order-details" />
            <Stack.Screen name="seller-dashboard" />
          </Stack>
        </CartProvider>
      </AuthProvider>
    </AppStripeProvider>
  );
}
