import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'

export const config = {
  runtime: 'edge',
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2 // 2 hours

export default async function handler(req: Request) {
  // Gestisci richieste OPTIONS per CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase environment variables missing' }), 
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }

  // Estrai i parametri dall'URL
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Pattern: /api/qr/restaurantId/tableId
  let restaurantId: string | undefined
  let tableId: string | undefined
  
  const apiIndex = pathParts.indexOf('api')
  const qrIndex = pathParts.indexOf('qr')
  
  if (apiIndex !== -1 && qrIndex !== -1 && qrIndex === apiIndex + 1) {
    // /api/qr/restaurantId/tableId
    if (pathParts.length > qrIndex + 2) {
      restaurantId = pathParts[qrIndex + 1]
      tableId = pathParts[qrIndex + 2]
    }
  } else if (qrIndex !== -1) {
    // /qr/restaurantId/tableId (se viene da rewrite)
    if (pathParts.length > qrIndex + 2) {
      restaurantId = pathParts[qrIndex + 1]
      tableId = pathParts[qrIndex + 2]
    }
  }

  if (!restaurantId || !tableId) {
    return new Response(
      JSON.stringify({ error: 'Missing restaurant or table id' }), 
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const token =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${tableId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  // Revoke previous tokens for this table
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
    return new Response(
      JSON.stringify({ 
        error: 'Unable to generate token', 
        details: insertError.message 
      }), 
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }

  const requestUrl = new URL(req.url)
  const destination = new URL(`/${restaurantId}/${tableId}`, requestUrl.origin)
  destination.searchParams.set('token', token)

  // Se la richiesta viene da fetch (ha header Accept: application/json), restituisci JSON
  // Altrimenti fai un redirect 302 per compatibilità con richieste dirette del browser
  const acceptHeader = req.headers.get('Accept') || ''
  const isJsonRequest = acceptHeader.includes('application/json') || 
                        req.headers.get('X-Requested-With') === 'XMLHttpRequest'

  if (isJsonRequest) {
    return new Response(
      JSON.stringify({ 
        redirectUrl: destination.toString(),
        token 
      }), 
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept'
        }
      }
    )
  }

  // Per richieste dirette del browser, fai un redirect 302
  return Response.redirect(destination.toString(), 302)
}

