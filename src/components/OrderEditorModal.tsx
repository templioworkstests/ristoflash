import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { X, Plus as PlusIcon, Trash2 } from 'lucide-react'
import type { Order, OrderItem, Product } from '@/types/database'

type OrderWithItems = Order & { items: OrderItem[] }

interface OrderEditorModalProps {
  order: OrderWithItems
  products: Record<string, Product>
  open: boolean
  onClose: () => void
  tableName?: string
  onUpdated?: () => Promise<void> | void
}

interface EditableOrderItem extends OrderItem {
  tempId: string
  isNew?: boolean
}

const generateTempId = () => {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `temp-${globalThis.crypto.randomUUID()}`
  }
  return `temp-${Math.random().toString(36).slice(2)}`
}

export function OrderEditorModal({
  order,
  products,
  open,
  onClose,
  tableName,
  onUpdated,
}: OrderEditorModalProps) {
  const [items, setItems] = useState<EditableOrderItem[]>([])
  const [orderNotes, setOrderNotes] = useState(order.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([])
  const [isAyce, setIsAyce] = useState(false)

  useEffect(() => {
    if (!open) return

    const editableItems: EditableOrderItem[] = order.items.map(item => ({
      ...item,
      tempId: item.id,
    }))

    setItems(editableItems)
    setOrderNotes(order.notes ?? '')
    setDeletedItemIds([])

    const ayce = order.total_amount === 0 && order.items.every(item => item.total_price === 0)
    setIsAyce(ayce)

    const firstProductId = Object.keys(products)[0] ?? ''
    setSelectedProductId(firstProductId)
  }, [open, order, products])

  const productList = useMemo(() => Object.values(products), [products])

  const calculatedTotal = useMemo(() => {
    if (isAyce) return 0
    return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  }, [items, isAyce])

  function handleQuantityChange(tempId: string, value: number) {
    setItems(prev =>
      prev.map(item =>
        item.tempId === tempId
          ? {
              ...item,
              quantity: Math.max(0, Math.round(value)),
            }
          : item
      )
    )
  }

  function handleNotesChange(tempId: string, value: string) {
    setItems(prev =>
      prev.map(item =>
        item.tempId === tempId
          ? {
              ...item,
              notes: value,
            }
          : item
      )
    )
  }

  function handleRemoveItem(tempId: string) {
    setItems(prev => {
      const item = prev.find(i => i.tempId === tempId)
      if (item?.id) {
        setDeletedItemIds(ids => [...ids, item.id as string])
      }
      return prev.filter(i => i.tempId !== tempId)
    })
  }

  function handleAddProduct() {
    if (!selectedProductId) {
      toast.error('Seleziona un prodotto da aggiungere')
      return
    }

    const product = products[selectedProductId]
    if (!product) {
      toast.error('Prodotto non disponibile')
      return
    }

    setItems(prev => [
      ...prev,
      {
        id: undefined as unknown as string,
        tempId: generateTempId(),
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: isAyce ? 0 : product.price,
        total_price: isAyce ? 0 : product.price,
        status: order.status,
        notes: null,
        options: null,
        variant_id: null,
        created_at: null,
        isNew: true,
      },
    ])
  }

  async function handleSubmit() {
    if (isSubmitting) return

    const remainingItems = items.filter(item => item.quantity > 0)

    if (remainingItems.length === 0) {
      toast.error('Un ordine deve contenere almeno un prodotto')
      return
    }

    setIsSubmitting(true)

    try {
      const finalItems = remainingItems.map(item => {
        const product = products[item.product_id]
        const baseUnitPrice = isAyce ? 0 : item.unit_price ?? product?.price ?? 0
        const totalPrice = isAyce ? 0 : baseUnitPrice * item.quantity

        return {
          ...item,
          unit_price: baseUnitPrice,
          total_price: totalPrice,
        }
      })

      const totalAmount = isAyce
        ? 0
        : finalItems.reduce((sum, item) => sum + item.total_price, 0)

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: totalAmount,
          notes: orderNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (orderError) throw orderError

      if (deletedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', deletedItemIds)

        if (deleteError) throw deleteError
      }

      const itemsToUpdate = finalItems.filter(item => item.id && !item.isNew)
      for (const item of itemsToUpdate) {
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            notes: item.notes || null,
            unit_price: item.unit_price,
            total_price: item.total_price,
            status: order.status,
            variant_id: item.variant_id ?? null,
            options: item.options ?? null,
          })
          .eq('id', item.id)

        if (updateError) throw updateError
      }

      const itemsToInsert = finalItems.filter(item => !item.id || item.isNew)
      if (itemsToInsert.length > 0) {
        const insertPayload = itemsToInsert.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes || null,
          unit_price: item.unit_price,
          total_price: item.total_price,
          status: order.status,
          variant_id: item.variant_id ?? null,
          options: item.options ?? null,
        }))

        const { error: insertError } = await supabase.from('order_items').insert(insertPayload)
        if (insertError) throw insertError
      }

      toast.success('Ordine aggiornato')
      onClose()
      await onUpdated?.()
    } catch (error: any) {
      console.error('Order update error:', error)
      toast.error(error.message || 'Impossibile aggiornare l\'ordine')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Modifica ordine</h2>
            <p className="text-xs text-gray-500">
              Ordine #{order.id.slice(0, 8)}
              {tableName ? ` · Tavolo ${tableName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 transition hover:text-gray-700"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-4">
            {items.map(item => {
              const product = products[item.product_id]
              return (
                <div
                  key={item.tempId}
                  className="rounded-lg border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {product?.name ?? 'Prodotto'}
                        {item.isNew && (
                          <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                            Nuovo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {!isAyce
                          ? `Prezzo unitario: €${(item.unit_price || product?.price || 0).toFixed(2)}`
                          : 'Incluso nella formula AYCE'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.tempId)}
                      className="text-gray-400 transition hover:text-red-500"
                      aria-label="Rimuovi prodotto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[150px,1fr]">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Quantità
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={event => handleQuantityChange(item.tempId, Number(event.target.value))}
                        className="input mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Note
                      </label>
                      <textarea
                        rows={2}
                        value={item.notes ?? ''}
                        onChange={event => handleNotesChange(item.tempId, event.target.value)}
                        className="input mt-1"
                        placeholder="Note per la cucina"
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-right text-sm text-gray-600">
                    {!isAyce ? (
                      <span>
                        Totale riga:{' '}
                        <span className="font-semibold text-gray-900">
                          €{((item.unit_price || product?.price || 0) * item.quantity).toFixed(2)}
                        </span>
                      </span>
                    ) : (
                      <span className="font-semibold text-primary-600">Incluso</span>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="rounded-lg border border-dashed border-gray-300 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Aggiungi prodotto
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={event => setSelectedProductId(event.target.value)}
                    className="input mt-1"
                  >
                    {productList.length === 0 && <option value="">Nessun prodotto disponibile</option>}
                    {productList.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} · €{product.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="btn btn-secondary mt-2 md:mt-6 inline-flex items-center gap-2"
                  disabled={!selectedProductId}
                >
                  <PlusIcon className="h-4 w-4" />
                  Aggiungi
                </button>
              </div>
              {isAyce && (
                <p className="mt-3 text-xs text-primary-600">
                  Gli ordini in formula AYCE non incidono sul totale. I prezzi sono mostrati solo a titolo informativo.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Note ordine
            </label>
            <textarea
              rows={3}
              value={orderNotes}
              onChange={event => setOrderNotes(event.target.value)}
              className="input mt-1"
              placeholder="Note generali per questo ordine"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Articoli totali</span>
              <span className="font-semibold">
                {items.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Totale ordine</span>
              <span className="text-lg font-bold text-primary-600">
                {isAyce ? 'Incluso' : `€${calculatedTotal.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </div>
  )
}

