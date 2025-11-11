import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../src/types/supabase'

export const config = {
  runtime: 'edge',
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2 // 2 hours

export default async function handler(
  req: Request,
  context: { params: { restaurantId?: string; tableId?: string } }
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Supabase environment variables missing', { status: 500 })
  }

  const restaurantId = context.params.restaurantId
  const tableId = context.params.tableId

  if (!restaurantId || !tableId) {
    return new Response('Missing restaurant or table id', { status: 400 })
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const token =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${tableId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  // Revoke previous tokens for this table (optional but keeps sessions unique)
  await supabase
    .from('table_tokens')
    .update({ revoked: true })
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)

  const { error: insertError } = await supabase.from('table_tokens').insert([
    {
      restaurant_id: restaurantId,
      table_id: tableId,
      token,
      expires_at: expiresAt,
      revoked: false,
    },
  ])

  if (insertError) {
    console.error('Failed to create table token', insertError)
    return new Response('Unable to generate token', { status: 500 })
  }

  const requestUrl = new URL(req.url)
  const destination = new URL(`/${restaurantId}/${tableId}`, requestUrl.origin)
  destination.searchParams.set('token', token)

  return Response.redirect(destination.toString(), 302)
}

