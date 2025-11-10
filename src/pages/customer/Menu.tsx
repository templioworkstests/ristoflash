import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Restaurant, Category, Product } from '@/types/database'
import { ShoppingCart, Plus, Minus, Bell, X, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface CartItem {
  product: Product
  quantity: number
  notes?: string
  variant_id?: string
  options?: string[]
}

export function CustomerMenu() {
  const { restaurantId, tableId } = useParams<{ restaurantId: string; tableId: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const isAllYouCanEatActive =
    !!restaurant?.all_you_can_eat_enabled &&
    (restaurant.all_you_can_eat_lunch_price !== null || restaurant.all_you_can_eat_dinner_price !== null)
  const hasAyceLimits =
    isAllYouCanEatActive &&
    products.some(product => product.ayce_limit_enabled && product.ayce_limit_quantity && product.ayce_limit_quantity > 0)

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return `€${value.toFixed(2)}`
  }

  useEffect(() => {
    if (restaurantId && tableId) {
      loadData()
    }
  }, [restaurantId, tableId])

  async function loadData() {
    if (!restaurantId || !tableId) {
      setLoading(false)
      return
    }
    try {
      // Load restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      if (restaurantError) throw restaurantError
      setRestaurant(restaurantData)

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true })

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available')
        .order('display_order', { ascending: true })

      if (productsError) throw productsError
      setProducts(productsData || [])

      if (categoriesData && categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id)
      }
    } catch (error: any) {
      toast.error('Errore nel caricamento del menu')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function addToCart(product: Product) {
    const existingItem = cart.find(item => item.product.id === product.id)

    if (
      isAllYouCanEatActive &&
      product.ayce_limit_enabled &&
      product.ayce_limit_quantity &&
      product.ayce_limit_quantity > 0
    ) {
      const currentQuantity = existingItem ? existingItem.quantity : 0
      if (currentQuantity >= product.ayce_limit_quantity) {
        toast.error(
          `Puoi ordinare al massimo ${product.ayce_limit_quantity} pezzi di ${product.name} in formula All You Can Eat.`
        )
        return
      }
    }
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
    
    setSelectedProduct(null)
    toast.success('Aggiunto al carrello')
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = cart.find(entry => entry.product.id === productId)
    if (!item) return

    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    
    if (
      isAllYouCanEatActive &&
      item.product.ayce_limit_enabled &&
      item.product.ayce_limit_quantity &&
      item.product.ayce_limit_quantity > 0 &&
      quantity > item.product.ayce_limit_quantity
    ) {
      toast.error(
        `Il limite per ${item.product.name} è di ${item.product.ayce_limit_quantity} pezzi a persona in formula All You Can Eat.`
      )
      return
    }
    
    setCart(cart.map(entry =>
      entry.product.id === productId
        ? { ...entry, quantity }
        : entry
    ))
  }

  function getCartTotal() {
    if (isAllYouCanEatActive) return 0
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  }

  async function placeOrder() {
    if (!restaurantId || !tableId || cart.length === 0) return

    try {
      // Create order
      const totalAmount = isAllYouCanEatActive ? 0 : getCartTotal()
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            restaurant_id: restaurantId,
            table_id: tableId,
            status: 'pending',
            total_amount: totalAmount,
            notes: orderNotes || null,
          },
        ])
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: isAllYouCanEatActive ? 0 : item.product.price,
        total_price: isAllYouCanEatActive ? 0 : item.product.price * item.quantity,
        notes: item.notes || null,
        status: 'pending',
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      setCurrentOrderId(orderData.id)
      setOrderPlaced(true)
      setCart([])
      setOrderNotes('')
      toast.success(`Ordine #${orderData.id.slice(0, 8)} inviato con successo!`)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'invio dell\'ordine')
      console.error(error)
    }
  }

  async function callWaiter() {
    if (!restaurantId || !tableId) return

    try {
      const { error } = await supabase
        .from('waiter_calls')
        .insert([
          {
            restaurant_id: restaurantId,
            table_id: tableId,
            status: 'active',
          },
        ])

      if (error) throw error
      toast.success('Chiamata cameriere inviata!')
    } catch (error: any) {
      toast.error('Errore durante la chiamata')
      console.error(error)
    }
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  const selectedProductLimitQuantity = selectedProduct?.ayce_limit_quantity ?? 0
  const selectedProductHasLimit =
    !!selectedProduct &&
    isAllYouCanEatActive &&
    selectedProduct.ayce_limit_enabled &&
    selectedProductLimitQuantity > 0
  const selectedProductLimitReached =
    selectedProductHasLimit &&
    cart.some(
      item =>
        item.product.id === selectedProduct.id && item.quantity >= selectedProductLimitQuantity
    )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ristorante non trovato</h1>
          <p className="text-gray-600">Verifica che il QR code sia corretto</p>
        </div>
      </div>
    )
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <Check className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ordine Inviato!</h2>
          <p className="text-gray-600 mb-2">
            Il tuo ordine è stato ricevuto e verrà preparato a breve.
          </p>
          {currentOrderId && (
            <p className="text-sm text-gray-500 mb-6">
              Numero ordine: #{currentOrderId.slice(0, 8)}
            </p>
          )}
          <button
            onClick={() => {
              setOrderPlaced(false)
              setCurrentOrderId(null)
            }}
            className="btn btn-primary w-full"
          >
            Ordina Ancora
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header
        className="bg-white shadow-sm sticky top-0 z-10"
        style={{
          backgroundColor: restaurant.primary_color || '#ef4444',
          color: 'white',
        }}
      >
        <div className="px-4 py-4">
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-12 mb-2" />
          )}
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="text-sm opacity-90">{restaurant.address}</p>
          )}
        </div>
      </header>
      {isAllYouCanEatActive && (
        <div className="bg-primary-50 border-b border-primary-100 text-primary-700">
          <div className="px-4 py-3 text-sm">
            <p className="font-semibold">Modalità All You Can Eat attiva</p>
            <p className="mt-1">
              Prezzo pranzo: {formatPrice(restaurant?.all_you_can_eat_lunch_price)} &bull; Prezzo cena: {formatPrice(restaurant?.all_you_can_eat_dinner_price)}
            </p>
            <p className="mt-1 text-xs text-primary-600">
              Ordina pure dal menu: ogni piatto è incluso nel prezzo fisso.
            </p>
            {hasAyceLimits && (
              <p className="mt-2 text-xs font-semibold text-primary-700">
                Alcuni piatti prevedono un limite di pezzi per persona. Controlla le note nella scheda prodotto.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="bg-white border-b sticky top-[88px] z-10 overflow-x-auto">
        <div className="flex space-x-2 px-4 py-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              selectedCategory === null
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Tutte
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === category.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const currentItem = cart.find(item => item.product.id === product.id)
            const limitQuantity = product.ayce_limit_quantity ?? 0
            const ayceLimitActive =
              isAllYouCanEatActive && product.ayce_limit_enabled && limitQuantity > 0
            const limitReached =
              ayceLimitActive && currentItem ? currentItem.quantity >= limitQuantity : false

            return (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4 space-y-2">
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    {ayceLimitActive && (
                      <p className="text-xs font-medium text-primary-600">
                        Limite AYCE: {limitQuantity} pezzi a persona
                        {limitReached ? ' (limite raggiunto)' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-primary-600">
                      {isAllYouCanEatActive ? 'Incluso' : `€${product.price.toFixed(2)}`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (limitReached) {
                          toast.error(
                            `Limite raggiunto: massimo ${limitQuantity} pezzi di ${product.name}.`
                          )
                          return
                        }
                        addToCart(product)
                      }}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        limitReached
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                      disabled={limitReached}
                    >
                      <Plus className="h-4 w-4 inline" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nessun prodotto disponibile in questa categoria</p>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
              <button onClick={() => setSelectedProduct(null)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              {selectedProduct.image_url && (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
              )}
              {selectedProduct.description && (
                <p className="text-gray-600 mb-4">{selectedProduct.description}</p>
              )}
              <div className="flex justify-between items-center mb-6">
                <span className="text-2xl font-bold text-primary-600">
                  {isAllYouCanEatActive ? 'Incluso nella formula' : `€${selectedProduct.price.toFixed(2)}`}
                </span>
              </div>
              {selectedProductHasLimit && (
                <p className="text-sm text-primary-600 mb-4">
                  Limite AYCE: {selectedProductLimitQuantity} pezzi a persona
                  {selectedProductLimitReached ? '. Limite raggiunto.' : '.'}
                </p>
              )}
              <button
                onClick={() => {
                  if (selectedProductLimitReached) {
                    toast.error(
                      `Limite raggiunto: massimo ${selectedProductLimitQuantity} pezzi di ${selectedProduct?.name}.`
                    )
                    return
                  }
                  if (selectedProduct) {
                    addToCart(selectedProduct)
                  }
                }}
                className="btn btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={selectedProductLimitReached}
              >
                Aggiungi al Carrello
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 right-4 bg-primary-600 text-white rounded-full p-4 shadow-lg z-40"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        </button>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Il Tuo Ordine</h2>
              <button onClick={() => setShowCart(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Il carrello è vuoto</p>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => {
                    const limitQuantity = item.product.ayce_limit_quantity ?? 0
                    const limitActive =
                      isAllYouCanEatActive && item.product.ayce_limit_enabled && limitQuantity > 0
                    const limitReached = limitActive && item.quantity >= limitQuantity

                    return (
                      <div key={item.product.id} className="flex items-start space-x-4">
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.product.name}</h3>
                          <p className="text-sm text-gray-600">
                            {isAllYouCanEatActive ? 'Incluso' : `€${item.product.price.toFixed(2)} cad.`}
                          </p>
                          {limitActive && (
                            <p className="text-xs text-primary-600 mt-1">
                              Limite: {limitQuantity} pezzi a persona
                              {limitReached ? ' (limite raggiunto)' : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="bg-gray-200 rounded-full p-1"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-semibold w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className={`rounded-full p-1 ${
                              limitReached ? 'bg-gray-200 cursor-not-allowed opacity-60' : 'bg-gray-200'
                            }`}
                            disabled={limitReached}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-600 ml-2"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note per l'ordine (opzionale)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Es: Siamo allergici ai crostacei"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Totale:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {isAllYouCanEatActive ? 'Incluso' : `€${getCartTotal().toFixed(2)}`}
                </span>
              </div>
              {isAllYouCanEatActive && (
                <p className="text-xs text-primary-600">
                  Il conto verrà calcolato in base alla formula All You Can Eat scelta (pranzo/cena).
                </p>
              )}
              <button
                onClick={placeOrder}
                disabled={cart.length === 0}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Invia Ordine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Waiter Button */}
      <button
        onClick={callWaiter}
        className="fixed bottom-4 left-4 bg-white text-gray-700 rounded-full p-4 shadow-lg z-40 border"
        title="Chiama il cameriere"
      >
        <Bell className="h-6 w-6" />
      </button>
    </div>
  )
}










