import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#146EF5',
        tabBarInactiveTintColor: '#7A8190',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8EAF0',
          height: 82,
          paddingTop: 8,
          paddingBottom: 22,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
        
      /> 

  < Tabs.Screen
name = "marketplace"
options = {{
  title: 'Market',
    tabBarIcon: ({ color, size }) => (
      <Ionicons
        name= "storefront-outline"
  color = { color }
  size = { size }
    />
    ),
}}
/>
      <Tabs.Screen
name = "battles"
options = {{
  title: 'Battles',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name= "game-controller-outline" color = { color } size = { size } />
          ),
}}
      />

      
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="albums-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
  name="sell"
  options={{
    title: 'Sell',
    tabBarIcon: ({ color, size }) => (
      <Ionicons
        name="pricetag-outline"
        color={color}
        size={size}
      />
    ),
  }}
/>
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="receipt-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-circle-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
  < Tabs.Screen
name = "auth"
options = {{
  title: 'Login',
    tabBarIcon: ({ color, size }) => (
      <Ionicons
        name= "log-in-outline"
  color = { color }
  size = { size }
    />
    ),
}}
/>
    </Tabs>
  );
}
