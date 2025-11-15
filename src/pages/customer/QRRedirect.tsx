import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2 // 2 hours

export function QRRedirect() {
  const { restaurantId, tableId } = useParams<{ restaurantId: string; tableId: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function generateTokenAndRedirect() {
      if (!restaurantId || !tableId) {
        setError('Missing restaurant or table id')
        setLoading(false)
        return
      }

      try {
        const isProduction = import.meta.env.PROD
        
        if (isProduction) {
          // In produzione, chiama l'API edge function
          // L'API farà un redirect 302, ma dobbiamo seguirlo manualmente
          try {
            const response = await fetch(`/api/qr/${restaurantId}/${tableId}`, {
              method: 'GET',
              redirect: 'manual', // Non seguire automaticamente i redirect
            })
            
            // Se c'è un redirect (status 302), prendi l'URL dal header Location
            if (response.status === 302 || response.status === 301) {
              const location = response.headers.get('Location')
              if (location) {
                window.location.href = location
                return
              }
            }
            
            // Se non c'è redirect ma la risposta è OK, potrebbe essere un errore JSON
            if (response.ok) {
              const data = await response.json().catch(() => null)
              if (data?.error) {
                throw new Error(data.error)
              }
            }
            
            // Se non c'è Location header, prova a costruire l'URL manualmente
            // Questo è un fallback nel caso l'edge function non funzioni
            throw new Error('Redirect non ricevuto dall\'API')
          } catch (fetchError: any) {
            console.error('Error calling API:', fetchError)
            // Fallback: genera il token lato client (richiede service role key in env)
            // Ma in produzione non dovremmo avere la service role key nel frontend
            setError('Impossibile generare il token. Verifica la configurazione del server.')
            setLoading(false)
            return
          }
        }

        // In sviluppo, genera il token direttamente
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl) {
          setError('VITE_SUPABASE_URL non configurato')
          setLoading(false)
          return
        }

        if (!serviceRoleKey) {
          // Se non abbiamo la service role key, proviamo a chiamare l'API locale
          // o mostriamo un errore
          setError('SUPABASE_SERVICE_ROLE_KEY non configurato. In sviluppo, aggiungi VITE_SUPABASE_SERVICE_ROLE_KEY al .env.local')
          setLoading(false)
          return
        }

        const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false },
        })

        // Genera token
        const token =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${tableId}-${Date.now()}-${Math.random().toString(36).slice(2)}`

        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

        // Revoke previous tokens for this table
        await supabase
          .from('table_tokens')
          .update({ revoked: true })
          .eq('restaurant_id', restaurantId)
          .eq('table_id', tableId)

        // Insert new token
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
          setError('Impossibile generare il token')
          setLoading(false)
          return
        }

        // Redirect to customer menu with token
        navigate(`/${restaurantId}/${tableId}?token=${token}`, { replace: true })
      } catch (err: any) {
        console.error('Error generating token', err)
        setError(err.message || 'Errore durante la generazione del token')
        setLoading(false)
      }
    }

    generateTokenAndRedirect()
  }, [restaurantId, tableId, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generazione token...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Errore</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full"
          >
            Riprova
          </button>
        </div>
      </div>
    )
  }

  return null
}

