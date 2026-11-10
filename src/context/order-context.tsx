
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { CartItem } from './cart-context';

export type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  email: string;
  items: CartItem[];
  total: number;
  status: 'test' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'not_charged' | 'pending' | 'paid' | 'failed';
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
};

const ORDERS_KEY = '@cardvault_orders_v1';

export async function getOrders(): Promise<Order[]> {
  const saved = await AsyncStorage.getItem(ORDERS_KEY);

  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);

  if (!Array.isArray(parsed)) {
    throw new Error('Saved order data is invalid.');
  }

  return parsed as Order[];
}

export async function saveOrder(order: Order): Promise<void> {
  const orders = await getOrders();

  if (orders.some(existing => existing.id === order.id)) {
    throw new Error('This order has already been saved.');
  }

  await AsyncStorage.setItem(
    ORDERS_KEY,
    JSON.stringify([order, ...orders])
  );
}

export async function saveCustomerOrder(
  order: Order,
  userId: string
): Promise<void> {
  const { data: savedOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      order_number: order.id,
      customer_name: order.customerName,
      email: order.email,
      total: order.total,
      status: order.status,
      payment_status: order.paymentStatus,
      created_at: order.createdAt,
    })
    .select('id')
    .single();

  if (orderError) {
    throw new Error(`Could not save customer order: ${orderError.message}`);
  }

  const orderItems = order.items.map(item => ({
    order_id: savedOrder.id,
    product_id: item.id,
    name: item.name,
    set_name: item.set,
    card_number: item.number,
    price: item.price,
    quantity: item.quantity,
    image: item.image,
    condition: item.condition,
    category: item.category,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    throw new Error(
      `The order was created, but its card details could not be saved: ${itemsError.message}`
    );
  }

  try {
    await saveOrder(order);
  } catch (error) {
    console.error('Could not save a local order-history copy:', error);
  }
}

export async function getCustomerOrders(
  userId: string
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      order_number,
      customer_name,
      email,
      total,
      status,
      payment_status,
      created_at,
      shipping_carrier,
      tracking_number,
      shipped_at,
      order_items (
        product_id,
        name,
        set_name,
        card_number,
        price,
        quantity,
        image,
        condition,
        category
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Could not load customer orders: ${error.message}`);
  }

  return (data ?? []).map(row => ({
    id: row.order_number,
    createdAt: row.created_at,
    customerName: row.customer_name,
    email: row.email,
    total: Number(row.total),
    status: row.status as Order['status'],
    paymentStatus: row.payment_status as Order['paymentStatus'],
    shippingCarrier: row.shipping_carrier,
    trackingNumber: row.tracking_number,
    shippedAt: row.shipped_at,
    items: (row.order_items ?? []).map(item => ({
      id: item.product_id,
      name: item.name,
      set: item.set_name,
      number: item.card_number,
      price: Number(item.price),
      quantity: item.quantity,
      image: item.image,
      condition: item.condition,
      category: item.category === 'Vintage' ? 'Vintage' : 'Modern',
    })),
  }));
}
