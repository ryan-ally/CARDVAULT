import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  const respond = (body: object, status = 200) => {
    console.log(
      'delete-account response:',
      status,
      JSON.stringify(body),
    );

    return Response.json(body, {
      status,
      headers: corsHeaders,
    });
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return respond({
        error: 'Server configuration is incomplete.',
      }, 500);
    }

    if (!authorization?.startsWith('Bearer ')) {
      return respond({
        error: 'Authentication required.',
      }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return respond({
        error: 'Invalid session.',
        details: authError?.message,
      }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

  const { error: inventoryError } = await admin
  .from('inventory')
  .update({ is_active: false, status: 'inactive' })
  .eq('owner_id', user.id);

if (inventoryError) {
  return respond({
    error: 'Could not deactivate inventory.',
    details: inventoryError.message,
  }, 500);
}
    if (inventoryError) {
      return respond({
        error: 'Could not deactivate inventory. Account was not deleted.',
        details: inventoryError.message,
      }, 500);
    }

    // Clear ownership while preserving inventory records.
    const { error: clearOwnerError } = await admin
      .from('inventory')
      .update({ owner_id: null })
      .eq('owner_id', user.id);

    if (clearOwnerError) {
      return respond({
        error: 'Could not clear inventory ownership. Account was not deleted.',
        details: clearOwnerError.message,
      }, 500);
    }

    const { error: sellerError } = await admin
      .from('seller_access')
      .delete()
      .eq('user_id', user.id);

    if (sellerError) {
      return respond({
        error: 'Could not remove seller access. Account was not deleted.',
        details: sellerError.message,
      }, 500);
    }

    const { error: profileError } = await admin
      .from('customer_profiles')
      .delete()
      .eq('user_id', user.id);

    if (profileError) {
      return respond({
        error: 'Could not remove customer profile. Account was not deleted.',
        details: profileError.message,
      }, 500);
    }

    const { error: deleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return respond({
        error: 'Account deletion failed.',
        details: deleteError.message,
      }, 500);
    }

    return respond({
      success: true,
      message: 'Account deleted; matching inventory deactivated.',
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : String(error);

    console.error('delete-account exception:', details);

    return respond({
      error: 'Unexpected server error.',
      details,
    }, 500);
  }
});
