import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PortalContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
  customerId: string | null
  isAdmin: boolean
}

export async function getPortalContext(): Promise<PortalContext> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user) return { supabase: userClient as SupabaseClient<any>, customerId: null, isAdmin: false }

  const { data: roleRow } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleRow?.role === 'admin') {
    const cookieStore = await cookies()
    const customerId = cookieStore.get('admin_viewing_as')?.value ?? null
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: createServiceClient() as unknown as SupabaseClient<any>,
      customerId,
      isAdmin: true,
    }
  }

  const { data: customerUser } = await userClient
    .from('customer_user')
    .select('customer_id')
    .eq('auth_user_id', user.id)
    .single()

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: userClient as SupabaseClient<any>,
    customerId: customerUser?.customer_id ?? null,
    isAdmin: false,
  }
}
