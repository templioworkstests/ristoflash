import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Restaurant } from '@/types/database'

export function RestaurantDashboard() {
  const [stats, setStats] = useState({
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    activeWaiterCalls: 0,
  })
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [saving, setSaving] = useState(false)
  const [ayceEnabled, setAyceEnabled] = useState<boolean>(false)
  const [ayceLunchPrice, setAyceLunchPrice] = useState<string>('')
  const [ayceDinnerPrice, setAyceDinnerPrice] = useState<string>('')
  const [cooldownEnabled, setCooldownEnabled] = useState<boolean>(false)
  const [cooldownMinutes, setCooldownMinutes] = useState<string>('15')

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        fetchStats(user.restaurant_id)
        fetchRestaurant(user.restaurant_id)
      }
    }
    loadData()
  }, [])

  async function fetchRestaurant(restId: string) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restId)
        .single()
      if (error) throw error
      setRestaurant(data as Restaurant)
      setAyceEnabled(!!(data as Restaurant).all_you_can_eat_enabled)
      setAyceLunchPrice(
        (data as Restaurant).all_you_can_eat_lunch_price != null
          ? String((data as Restaurant).all_you_can_eat_lunch_price)
          : ''
      )
      setAyceDinnerPrice(
        (data as Restaurant).all_you_can_eat_dinner_price != null
          ? String((data as Restaurant).all_you_can_eat_dinner_price)
          : ''
      )
      setCooldownEnabled(!!(data as Restaurant).order_cooldown_enabled)
      setCooldownMinutes(
        (data as Restaurant).order_cooldown_minutes != null
          ? String((data as Restaurant).order_cooldown_minutes)
          : '15'
      )
    } catch (error: any) {
      console.error('Errore caricamento ristorante:', error)
      toast.error('Errore nel caricamento delle impostazioni')
    }
  }

  async function fetchStats(restId: string) {
    try {
      // Get orders by status
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('status')
        .eq('restaurant_id', restId)
        .in('status', ['pending', 'preparing', 'ready'])

      if (ordersError) throw ordersError

      // Get waiter calls
      const { data: waiterCalls, error: callsError } = await supabase
        .from('waiter_calls')
        .select('id')
        .eq('restaurant_id', restId)
        .eq('status', 'active')

      if (callsError) throw callsError

      setStats({
        pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
        preparingOrders: orders?.filter(o => o.status === 'preparing').length || 0,
        readyOrders: orders?.filter(o => o.status === 'ready').length || 0,
        activeWaiterCalls: waiterCalls?.length || 0,
      })
    } catch (error: any) {
      toast.error('Errore nel caricamento delle statistiche')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function togglePrepaymentRequired(nextValue: boolean) {
    if (!restaurant?.id) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('restaurants')
        .update({ prepayment_required: nextValue })
        .eq('id', restaurant.id)
      if (error) throw error
      setRestaurant(prev => (prev ? { ...prev, prepayment_required: nextValue } : prev))
      toast.success('Impostazione aggiornata')
    } catch (error: any) {
      console.error('Errore aggiornamento impostazioni:', error)
      toast.error(error.message || 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function saveAyceSettings() {
    if (!restaurant?.id) return
    try {
      setSaving(true)
      const lunchVal =
        ayceLunchPrice.trim() === '' ? null : Number.parseFloat(ayceLunchPrice.replace(',', '.'))
      const dinnerVal =
        ayceDinnerPrice.trim() === '' ? null : Number.parseFloat(ayceDinnerPrice.replace(',', '.'))
      if (
        (lunchVal !== null && Number.isNaN(lunchVal)) ||
        (dinnerVal !== null && Number.isNaN(dinnerVal))
      ) {
        toast.error('Prezzi non validi')
        return
      }
      const { error } = await supabase
        .from('restaurants')
        .update({
          all_you_can_eat_enabled: ayceEnabled,
          all_you_can_eat_lunch_price: lunchVal,
          all_you_can_eat_dinner_price: dinnerVal,
        })
        .eq('id', restaurant.id)
      if (error) throw error
      setRestaurant(prev =>
        prev
          ? {
              ...prev,
              all_you_can_eat_enabled: ayceEnabled,
              all_you_can_eat_lunch_price: (lunchVal as any) ?? null,
              all_you_can_eat_dinner_price: (dinnerVal as any) ?? null,
            }
          : prev
      )
      toast.success('Impostazioni AYCE aggiornate')
    } catch (error: any) {
      console.error('Errore salvataggio AYCE:', error)
      toast.error(error.message || 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function saveCooldownSettings() {
    if (!restaurant?.id) return
    try {
      setSaving(true)
      const minutes =
        cooldownMinutes.trim() === '' ? 15 : Number.parseInt(cooldownMinutes, 10)
      if (Number.isNaN(minutes) || minutes <= 0 || minutes > 180) {
        toast.error('Minuti non validi (1-180)')
        return
      }
      const { error } = await supabase
        .from('restaurants')
        .update({
          order_cooldown_enabled: cooldownEnabled,
          order_cooldown_minutes: minutes,
        })
        .eq('id', restaurant.id)
      if (error) throw error
      setRestaurant(prev =>
        prev
          ? {
              ...prev,
              order_cooldown_enabled: cooldownEnabled,
              order_cooldown_minutes: minutes,
            }
          : prev
      )
      toast.success('Impostazioni intervallo ordini aggiornate')
    } catch (error: any) {
      console.error('Errore salvataggio intervallo:', error)
      toast.error(error.message || 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ordini in Attesa</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingOrders}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Preparazione</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.preparingOrders}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pronti</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.readyOrders}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Chiamate Cameriere</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeWaiterCalls}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Impostazioni</h2>
          <p className="text-sm text-gray-600 mb-4">
            Personalizza il comportamento del menu cliente.
          </p>
          <div className="flex items-start justify-between gap-6 rounded-lg border border-gray-200 p-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">Pagamento anticipato ordine</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    restaurant?.prepayment_required
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {restaurant?.prepayment_required ? 'Attivo' : 'Disattivo'}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Se attivo, dopo aver indicato il numero di persone il cliente vedrà un avviso
                che richiede il pagamento alla cassa immediatamente dopo l&apos;invio dell&apos;ordine.
              </p>
            </div>
            <label className="inline-flex select-none items-center gap-3">
              <span className="text-sm text-gray-600">Off</span>
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!restaurant?.prepayment_required}
                  onChange={(e) => togglePrepaymentRequired(e.target.checked)}
                  disabled={saving}
                />
                <span
                  className={`
                    h-7 w-12 rounded-full transition-colors
                    ${restaurant?.prepayment_required ? 'bg-primary-600' : 'bg-gray-300'}
                    ${saving ? 'opacity-60' : ''}
                  `}
                />
                <span
                  className={`
                    pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform
                    ${restaurant?.prepayment_required ? 'translate-x-5' : ''}
                  `}
                />
              </span>
              <span className="text-sm text-gray-600">On</span>
            </label>
          </div>
        </section>
        <section className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">All You Can Eat</h2>
          <p className="text-sm text-gray-600 mb-4">
            Abilita la modalità AYCE e definisci i prezzi fissi.
          </p>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6 rounded-lg border border-gray-200 p-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">Abilita All You Can Eat</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ayceEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ayceEnabled ? 'Attivo' : 'Disattivo'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Applica un prezzo fisso a pranzo e cena. I piatti possono avere limiti per persona.
                </p>
              </div>
              <label className="inline-flex select-none items-center gap-3">
                <span className="text-sm text-gray-600">Off</span>
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={ayceEnabled}
                    onChange={(e) => setAyceEnabled(e.target.checked)}
                    disabled={saving}
                  />
                  <span
                    className={`
                      h-7 w-12 rounded-full transition-colors
                      ${ayceEnabled ? 'bg-primary-600' : 'bg-gray-300'}
                      ${saving ? 'opacity-60' : ''}
                    `}
                  />
                  <span
                    className={`
                      pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform
                      ${ayceEnabled ? 'translate-x-5' : ''}
                    `}
                  />
                </span>
                <span className="text-sm text-gray-600">On</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Prezzo pranzo (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input mt-1"
                  placeholder="Es. 14.90"
                  value={ayceLunchPrice}
                  onChange={(e) => setAyceLunchPrice(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prezzo cena (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input mt-1"
                  placeholder="Es. 19.90"
                  value={ayceDinnerPrice}
                  onChange={(e) => setAyceDinnerPrice(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveAyceSettings}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Salvataggio...' : 'Salva impostazioni'}
              </button>
            </div>
          </div>
        </section>
        <section className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Intervallo tra ordini</h2>
          <p className="text-sm text-gray-600 mb-4">
            Se attivo, dopo aver inviato un ordine il cliente vedr&agrave; un timer a schermo intero e non potr&agrave; fare nuovi ordini finch&eacute; il timer non scade.
          </p>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6 rounded-lg border border-gray-200 p-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">Abilita intervallo tra ordini</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      cooldownEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cooldownEnabled ? 'Attivo' : 'Disattivo'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Nome interno: Finestra di attesa ordini
                </p>
              </div>
              <label className="inline-flex select-none items-center gap-3">
                <span className="text-sm text-gray-600">Off</span>
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={cooldownEnabled}
                    onChange={(e) => setCooldownEnabled(e.target.checked)}
                    disabled={saving}
                  />
                  <span
                    className={`
                      h-7 w-12 rounded-full transition-colors
                      ${cooldownEnabled ? 'bg-primary-600' : 'bg-gray-300'}
                      ${saving ? 'opacity-60' : ''}
                    `}
                  />
                  <span
                    className={`
                      pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform
                      ${cooldownEnabled ? 'translate-x-5' : ''}
                    `}
                  />
                </span>
                <span className="text-sm text-gray-600">On</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Minuti di attesa</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  step={1}
                  className="input mt-1"
                  placeholder="15"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(e.target.value)}
                  disabled={saving || !cooldownEnabled}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveCooldownSettings}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Salvataggio...' : 'Salva impostazioni'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}










