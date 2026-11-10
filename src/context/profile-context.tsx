
import { supabase } from '../lib/supabase';

export type CustomerProfile = {
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  updated_at?: string;
};

export function emptyCustomerProfile(
  userId: string
): CustomerProfile {
  return {
    user_id: userId,
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
  };
}

export async function getCustomerProfile(
  userId: string
): Promise<CustomerProfile> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load profile: ${error.message}`);
  }

  return data
    ? {
        ...emptyCustomerProfile(userId),
        ...data,
      }
    : emptyCustomerProfile(userId);
}

export async function saveCustomerProfile(
  profile: CustomerProfile
): Promise<CustomerProfile> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .upsert(
      {
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`Could not save profile: ${error.message}`);
  }

  return {
    ...emptyCustomerProfile(profile.user_id),
    ...data,
  };
}