import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Restaurant, Category, Product, Table } from '@/types/database'
import { ShoppingCart, Plus, Minus, Bell, X, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface CartItem {
  product: Product
  quantity: number
  notes?: string
  variant_id?: string
  options?: string[]
}

type Language = 'it' | 'en'

const translations = {
  it: {
    orderPlacedTitle: 'Ordine Inviato!',
    orderPlacedMessage: 'Il tuo ordine è stato ricevuto e verrà preparato a breve.',
    orderNumberLabel: 'Numero ordine:',
    orderAgain: 'Ordina Ancora',
    ayceBannerTitle: 'Modalità All You Can Eat attiva',
    ayceBannerSubtitle: 'Ordina pure dal menu: ogni piatto è incluso nel prezzo fisso.',
    ayceBannerLimits:
      'Alcuni piatti prevedono un limite di pezzi per persona. Controlla le note nella scheda prodotto.',
    ayceBannerLunch: 'Prezzo pranzo: {price}',
    ayceBannerDinner: 'Prezzo cena: {price}',
    allCategories: 'Tutte',
    noProducts: 'Nessun prodotto disponibile in questa categoria',
    included: 'Incluso',
    includedInFormula: 'Incluso nella formula',
    ayceLimitLabel: 'Limite AYCE: {limit} pezzi a persona{reached}',
    ayceLimitReachedSuffix: ' (limite raggiunto)',
    addToCart: 'Aggiungi al Carrello',
    cartTitle: 'Il Tuo Ordine',
    cartEmpty: 'Il carrello è vuoto',
    orderNotesLabel: "Note per l'ordine (opzionale)",
    orderNotesPlaceholder: 'Es: Siamo allergici ai crostacei',
    totalLabel: 'Totale',
    ayceCheckoutNotice:
      'Il conto verrà calcolato in base alla formula All You Can Eat scelta (pranzo/cena).',
    placeOrder: 'Invia Ordine',
    callWaiterTitle: 'Chiama il cameriere',
    partySizeLabel: 'Persone al tavolo:',
    partySizeNotSet: 'Non impostato',
    edit: 'Modifica',
    set: 'Imposta',
    setPartySize: 'Imposta numero persone',
    partySizeModalTitle: 'Quante persone siete al tavolo?',
    partySizeModalDescription:
      'Inserisci il numero di persone presenti al tavolo. Puoi modificarlo in qualsiasi momento.',
    confirm: 'Conferma',
    partySizePlaceholder: 'Es. 3',
    addToCartSuccess: 'Aggiunto al carrello',
    addToCartLimit:
      'Puoi ordinare al massimo {limit} pezzi di {product} in formula All You Can Eat.',
    addToCartLimitReached: 'Limite raggiunto: massimo {limit} pezzi di {product}.',
    partySizeLimit:
      'Il limite per {product} è di {limit} pezzi a persona in formula All You Can Eat.',
    orderSuccess: 'Ordine #{id} inviato con successo!',
    menuLoadError: 'Errore nel caricamento del menu',
    orderError: "Errore durante l'invio dell'ordine",
    callWaiterSuccess: 'Chiamata cameriere inviata!',
    callWaiterError: 'Errore durante la chiamata',
    partySizeMissing: 'Indica quante persone sono al tavolo prima di inviare l\'ordine.',
    partySizeInvalid: 'Inserisci un numero di persone valido (minimo 1).',
    partySizeTooLarge: 'Per favore contatta lo staff per tavoli superiori a 20 persone.',
    partySizeSaved: '{count} {label} registrate al tavolo.',
    personSingular: 'persona',
    personPlural: 'persone',
    productPriceEach: '€{price} cad.',
    cartLimitLabel: 'Limite: {limit} pezzi a persona{reached}',
    cartLimitReachedSuffix: ' (limite raggiunto)',
    languageTooltip: 'Cambia lingua',
    languageItalian: 'Italiano',
    languageEnglish: 'Inglese',
    tableFallback: 'Tavolo #{id}',
    tokenInvalidTitle: 'QR non valido',
    tokenMissing: 'Questo QR non è valido. Richiedi un nuovo codice al personale del ristorante.',
    tokenInvalid: 'Questo QR è scaduto oppure è stato rigenerato. Richiedi un nuovo codice al personale.',
    tokenValidationError: 'Impossibile convalidare il QR. Riprova o chiedi assistenza allo staff.',
    tokenRetry: 'Riprova',
    restaurantNotFoundTitle: 'Ristorante non trovato',
    restaurantNotFoundSubtitle: 'Verifica che il QR code sia corretto',
  },
  en: {
    orderPlacedTitle: 'Order Sent!',
    orderPlacedMessage: 'We received your order and will prepare it shortly.',
    orderNumberLabel: 'Order number:',
    orderAgain: 'Order Again',
    ayceBannerTitle: 'All You Can Eat mode is active',
    ayceBannerSubtitle: 'Order anything from the menu: every dish is included in the fixed price.',
    ayceBannerLimits:
      'Some dishes have a per-guest limit. Check the notes on each product card.',
    ayceBannerLunch: 'Lunch price: {price}',
    ayceBannerDinner: 'Dinner price: {price}',
    allCategories: 'All',
    noProducts: 'No products available in this category',
    included: 'Included',
    includedInFormula: 'Included in the plan',
    ayceLimitLabel: 'AYCE limit: {limit} pieces per guest{reached}',
    ayceLimitReachedSuffix: ' (limit reached)',
    addToCart: 'Add to Cart',
    cartTitle: 'Your Order',
    cartEmpty: 'Your cart is empty',
    orderNotesLabel: 'Order notes (optional)',
    orderNotesPlaceholder: 'Eg: We are allergic to shellfish',
    totalLabel: 'Total',
    ayceCheckoutNotice:
      'The bill will be calculated according to the All You Can Eat plan (lunch/dinner).',
    placeOrder: 'Send Order',
    callWaiterTitle: 'Call the waiter',
    partySizeLabel: 'Guests at the table:',
    partySizeNotSet: 'Not set',
    edit: 'Edit',
    set: 'Set',
    setPartySize: 'Set number of guests',
    partySizeModalTitle: 'How many guests are at the table?',
    partySizeModalDescription:
      'Enter the number of guests. You can change it at any time.',
    confirm: 'Confirm',
    partySizePlaceholder: 'Eg. 3',
    addToCartSuccess: 'Added to cart',
    addToCartLimit:
      'You can order at most {limit} pieces of {product} with the All You Can Eat plan.',
    addToCartLimitReached: 'Limit reached: maximum {limit} pieces of {product}.',
    partySizeLimit:
      'The limit for {product} is {limit} pieces per guest with the All You Can Eat plan.',
    orderSuccess: 'Order #{id} sent successfully!',
    menuLoadError: 'Error loading the menu',
    orderError: 'Error while sending the order',
    callWaiterSuccess: 'Waiter called!',
    callWaiterError: 'Error while calling the waiter',
    partySizeMissing: 'Please tell us how many guests are at the table before sending the order.',
    partySizeInvalid: 'Enter a valid number of guests (minimum 1).',
    partySizeTooLarge: 'Please contact the staff for tables with more than 20 guests.',
    partySizeSaved: '{count} {label} registered at the table.',
    personSingular: 'guest',
    personPlural: 'guests',
    productPriceEach: '€{price} each',
    cartLimitLabel: 'Limit: {limit} pieces per guest{reached}',
    cartLimitReachedSuffix: ' (limit reached)',
    languageTooltip: 'Change language',
    languageItalian: 'Italian',
    languageEnglish: 'English',
    tableFallback: 'Table #{id}',
    tokenInvalidTitle: 'Invalid QR code',
    tokenMissing: 'This QR code is not valid. Please ask the staff for a new one.',
    tokenInvalid: 'This QR code has expired or has been regenerated. Please ask the staff for a new one.',
    tokenValidationError: 'Unable to validate the QR code. Try again or ask the staff for assistance.',
    tokenRetry: 'Try again',
    restaurantNotFoundTitle: 'Restaurant not found',
    restaurantNotFoundSubtitle: 'Check that the QR code is correct',
  },
} as const

type TranslationKey = keyof typeof translations.it

const languageOrder: Language[] = ['it', 'en']

function LanguageFlag({
  lang,
  size = 'md',
  className = '',
}: {
  lang: Language
  size?: 'sm' | 'md'
  className?: string
}) {
  const dimension = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  if (lang === 'it') {
    return (
      <span
        className={`flex ${dimension} overflow-hidden rounded-full border border-white/50 shadow-sm ${className}`}
        aria-hidden="true"
      >
        <span className="flex-1 bg-[#009246]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#CE2B37]" />
      </span>
    )
  }

  return (
    <span
      className={`relative flex ${dimension} items-center justify-center overflow-hidden rounded-full border border-white/50 bg-[#012169] shadow-sm ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 bg-white" />
      <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-white" />
      <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#C8102E]" />
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[#C8102E]" />
    </span>
  )
}

export function CustomerMenu() {
  const { restaurantId, tableId } = useParams<{ restaurantId: string; tableId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [table, setTable] = useState<Pick<Table, 'id' | 'name'> | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState<number | null>(null)
  const [partySizeInput, setPartySizeInput] = useState('')
  const [showPartySizeModal, setShowPartySizeModal] = useState(false)
  const [isPartySizeMandatory, setIsPartySizeMandatory] = useState(false)
  const [language, setLanguage] = useState<Language>('it')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const languageButtonRef = useRef<HTMLButtonElement | null>(null)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'pending' | 'valid' | 'invalid'>('pending')
  const [tokenErrorKey, setTokenErrorKey] = useState<TranslationKey | null>(null)

  const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
    const dictionary = translations[language] ?? translations.it
    let template = dictionary[key] ?? translations.it[key]
    if (!template) return key
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (match, token) => {
      const value = vars[token]
      if (value === undefined || value === null) return match
      return String(value)
    })
  }
  const isAllYouCanEatActive =
    !!restaurant?.all_you_can_eat_enabled &&
    (restaurant.all_you_can_eat_lunch_price !== null || restaurant.all_you_can_eat_dinner_price !== null)
  const hasAyceLimits =
    isAllYouCanEatActive &&
    products.some(product => product.ayce_limit_enabled && product.ayce_limit_quantity && product.ayce_limit_quantity > 0)
  const tokenErrorMessage = tokenErrorKey ? t(tokenErrorKey) : t('tokenValidationError')

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return `€${value.toFixed(2)}`
  }

  useEffect(() => {
    if (!restaurantId || !tableId) return
    if (!token) {
      setTokenStatus('invalid')
      setTokenErrorKey('tokenMissing')
      setLoading(false)
      return
    }

    const safeToken = token as string

    let ignore = false
    setTokenStatus('pending')
    setTokenErrorKey(null)
    setLoading(true)

    async function validate() {
      try {
        const { data, error } = await supabase.rpc('validate_table_token', { p_token: safeToken })

        if (ignore) return

        if (error) {
          console.error('validate_table_token error', error)
          setTokenStatus('invalid')
          setTokenErrorKey('tokenValidationError')
          setLoading(false)
          return
        }

        const record = Array.isArray(data) ? data[0] : null

        if (
          !record ||
          record.table_id !== tableId ||
          record.restaurant_id !== restaurantId
        ) {
          setTokenStatus('invalid')
          setTokenErrorKey('tokenInvalid')
          setLoading(false)
          return
        }

        setTokenStatus('valid')
        setTokenErrorKey(null)
      } catch (error) {
        console.error('validate_table_token exception', error)
        setTokenStatus('invalid')
        setTokenErrorKey('tokenValidationError')
        setLoading(false)
      }
    }

    validate()

    return () => {
      ignore = true
    }
  }, [restaurantId, tableId, token])

  useEffect(() => {
    if (restaurantId && tableId && tokenStatus === 'valid') {
      loadData()
    }
  }, [restaurantId, tableId, tokenStatus])

  useEffect(() => {
    try {
      const storedLanguage = localStorage.getItem('customerLanguage')
      if (storedLanguage === 'en') {
        setLanguage('en')
      }
    } catch (error) {
      console.warn('Unable to load language preference', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('customerLanguage', language)
    } catch (error) {
      console.warn('Unable to persist language preference', error)
    }
  }, [language])

  useEffect(() => {
    if (!showLanguageMenu) return
    function handleClick(event: MouseEvent) {
      const target = event.target as Node
      if (
        (languageButtonRef.current && languageButtonRef.current.contains(target)) ||
        (languageMenuRef.current && languageMenuRef.current.contains(target))
      ) {
        return
      }
      setShowLanguageMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [showLanguageMenu])

  useEffect(() => {
    if (!tableId) return
    try {
      const stored = localStorage.getItem(`partySize:${tableId}`)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!Number.isNaN(parsed) && parsed > 0) {
          setPartySize(parsed)
          setPartySizeInput(parsed.toString())
        }
      }
    } catch (error) {
      console.warn('Unable to load party size from storage', error)
    }
  }, [tableId])

  useEffect(() => {
    if (tokenStatus !== 'valid') return
    if (!loading && (!partySize || partySize <= 0)) {
      setPartySizeInput(prev => (prev ? prev : ''))
      setIsPartySizeMandatory(true)
      setShowPartySizeModal(true)
    }
  }, [loading, partySize, tokenStatus])

  async function loadData() {
    if (!restaurantId || !tableId || tokenStatus !== 'valid') {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      // Load restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      if (restaurantError) throw restaurantError
      setRestaurant(restaurantData)

      // Load table info
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('id, name')
        .eq('id', tableId)
        .single()

      if (tableError) {
        console.warn('Errore nel caricamento del tavolo:', tableError)
      } else {
        setTable(tableData)
      }

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
      toast.error(t('menuLoadError'))
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
          t('addToCartLimit', { limit: product.ayce_limit_quantity, product: product.name })
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
    toast.success(t('addToCartSuccess'))
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
        t('partySizeLimit', { product: item.product.name, limit: item.product.ayce_limit_quantity })
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

  const activePartySize = useMemo(() => partySize ?? null, [partySize])
  const tableLabel = useMemo(() => {
    if (table?.name) return table.name
    if (!tableId) return ''
    return t('tableFallback', { id: tableId.slice(0, 4).toUpperCase() })
  }, [table, tableId, language])
  const partySizeLabelText = useMemo(() => {
    if (!activePartySize) return t('partySizeNotSet')
    const label = t(activePartySize === 1 ? 'personSingular' : 'personPlural')
    return `${activePartySize} ${label}`
  }, [activePartySize, language])
  const languageOptionLabel = (code: Language) =>
    code === 'it' ? t('languageItalian') : t('languageEnglish')
  const currentLanguageLabel = useMemo(
    () => languageOptionLabel(language),
    [language]
  )

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage)
    setShowLanguageMenu(false)
  }

  function ensurePartySize(): boolean {
    if (activePartySize && activePartySize > 0) {
      return true
    }
    setPartySizeInput(partySizeInput || '')
    setIsPartySizeMandatory(true)
    setShowPartySizeModal(true)
    return false
  }

  async function placeOrder() {
    if (!restaurantId || !tableId || cart.length === 0) return

    if (!ensurePartySize()) {
      toast.error(t('partySizeMissing'))
      return
    }

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
            party_size: activePartySize,
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
      if (activePartySize) {
        try {
          localStorage.setItem(`partySize:${tableId}`, activePartySize.toString())
        } catch (error) {
          console.warn('Unable to persist party size', error)
        }
      }
      toast.success(t('orderSuccess', { id: orderData.id.slice(0, 8) }))
    } catch (error: any) {
      toast.error(error.message || t('orderError'))
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
      toast.success(t('callWaiterSuccess'))
    } catch (error: any) {
      toast.error(t('callWaiterError'))
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

  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('tokenInvalidTitle')}</h1>
          <p className="text-gray-600 mb-6">{tokenErrorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full"
          >
            {t('tokenRetry')}
          </button>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('restaurantNotFoundTitle')}</h1>
          <p className="text-gray-600">{t('restaurantNotFoundSubtitle')}</p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('orderPlacedTitle')}</h2>
          <p className="text-gray-600 mb-2">{t('orderPlacedMessage')}</p>
          {currentOrderId && (
            <p className="text-sm text-gray-500 mb-6">
              {t('orderNumberLabel')} #{currentOrderId.slice(0, 8)}
            </p>
          )}
          <button
            onClick={() => {
              setOrderPlaced(false)
              setCurrentOrderId(null)
            }}
            className="btn btn-primary w-full"
          >
            {t('orderAgain')}
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{restaurant.name}</h1>
              {restaurant.address && (
                <p className="text-sm opacity-90">{restaurant.address}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                  {tableLabel}
                </span>
                {activePartySize ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                    {partySizeLabelText}
                    <button
                      type="button"
                      onClick={() => {
                        setPartySizeInput(activePartySize.toString())
                        setIsPartySizeMandatory(false)
                        setShowPartySizeModal(true)
                      }}
                      className="underline text-sm"
                    >
                      {t('edit')}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPartySizeInput('')
                      setIsPartySizeMandatory(true)
                      setShowPartySizeModal(true)
                    }}
                    className="underline font-medium"
                  >
                    {t('setPartySize')}
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <button
                ref={languageButtonRef}
                type="button"
                onClick={() => setShowLanguageMenu(prev => !prev)}
                className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent"
                aria-haspopup="menu"
                aria-expanded={showLanguageMenu}
                aria-label={t('languageTooltip')}
              >
                <LanguageFlag lang={language} />
                <span className="hidden sm:inline">{currentLanguageLabel}</span>
              </button>
              {showLanguageMenu && (
                <div
                  ref={languageMenuRef}
                  className="absolute right-0 mt-2 w-48 rounded-lg bg-white/95 p-2 text-gray-900 shadow-lg ring-1 ring-black/5 backdrop-blur"
                  role="menu"
                >
                  {languageOrder.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleLanguageChange(option)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-primary-50 ${
                        option === language ? 'font-semibold text-primary-700' : 'font-medium'
                      }`}
                      role="menuitem"
                    >
                      <LanguageFlag lang={option} size="sm" />
                      <span>{languageOptionLabel(option)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {isAllYouCanEatActive && (
        <div className="bg-primary-50 border-b border-primary-100 text-primary-700">
          <div className="px-4 py-3 text-sm">
            <p className="font-semibold">{t('ayceBannerTitle')}</p>
            <p className="mt-1">
              {t('ayceBannerLunch', { price: formatPrice(restaurant?.all_you_can_eat_lunch_price) })}{' '}
              &bull;{' '}
              {t('ayceBannerDinner', { price: formatPrice(restaurant?.all_you_can_eat_dinner_price) })}
            </p>
            <p className="mt-1 text-xs text-primary-600">{t('ayceBannerSubtitle')}</p>
            {hasAyceLimits && (
              <p className="mt-2 text-xs font-semibold text-primary-700">{t('ayceBannerLimits')}</p>
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
            {t('allCategories')}
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
                        {t('ayceLimitLabel', {
                          limit: limitQuantity,
                          reached: limitReached ? t('ayceLimitReachedSuffix') : '',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-primary-600">
                      {isAllYouCanEatActive ? t('included') : `€${product.price.toFixed(2)}`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (limitReached) {
                          toast.error(
                            t('addToCartLimitReached', {
                              limit: limitQuantity,
                              product: product.name,
                            })
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
            <p className="text-gray-500">{t('noProducts')}</p>
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
                  {isAllYouCanEatActive ? t('includedInFormula') : `€${selectedProduct.price.toFixed(2)}`}
                </span>
              </div>
              {selectedProductHasLimit && (
                <p className="text-sm text-primary-600 mb-4">
                  {t('ayceLimitLabel', {
                    limit: selectedProductLimitQuantity,
                    reached: selectedProductLimitReached ? t('ayceLimitReachedSuffix') : '',
                  })}
                </p>
              )}
              <button
                onClick={() => {
                  if (selectedProductLimitReached) {
                    toast.error(
                      t('addToCartLimitReached', {
                        limit: selectedProductLimitQuantity,
                        product: selectedProduct?.name ?? '',
                      })
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
                {t('addToCart')}
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
              <h2 className="text-xl font-bold">{t('cartTitle')}</h2>
              <button onClick={() => setShowCart(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('cartEmpty')}</p>
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
                            {isAllYouCanEatActive
                              ? t('included')
                              : t('productPriceEach', {
                                  price: item.product.price.toFixed(2),
                                })}
                          </p>
                          {limitActive && (
                            <p className="text-xs text-primary-600 mt-1">
                              {t('cartLimitLabel', {
                                limit: limitQuantity,
                                reached: limitReached ? t('cartLimitReachedSuffix') : '',
                              })}
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
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {t('partySizeLabel')}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">
                    {activePartySize ? partySizeLabelText : t('partySizeNotSet')}
                  </span>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary-600 underline"
                    onClick={() => {
                      setPartySizeInput(activePartySize ? activePartySize.toString() : '')
                      setIsPartySizeMandatory(false)
                      setShowPartySizeModal(true)
                    }}
                  >
                    {t(activePartySize ? 'edit' : 'set')}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orderNotesLabel')}
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder={t('orderNotesPlaceholder')}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">{t('totalLabel')}:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {isAllYouCanEatActive ? t('included') : `€${getCartTotal().toFixed(2)}`}
                </span>
              </div>
              {isAllYouCanEatActive && (
                <p className="text-xs text-primary-600">{t('ayceCheckoutNotice')}</p>
              )}
              <button
                onClick={placeOrder}
                disabled={cart.length === 0}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('placeOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Waiter Button */}
      <button
        onClick={callWaiter}
        className="fixed bottom-4 left-4 bg-white text-gray-700 rounded-full p-4 shadow-lg z-40 border"
        title={t('callWaiterTitle')}
        aria-label={t('callWaiterTitle')}
      >
        <Bell className="h-6 w-6" />
      </button>

      {/* Party Size Modal */}
      {showPartySizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('partySizeModalTitle')}</h3>
              {!isPartySizeMandatory && (
                <button
                  onClick={() => setShowPartySizeModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">{t('partySizeModalDescription')}</p>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              className="input w-full"
              value={partySizeInput}
              onChange={(event) => setPartySizeInput(event.target.value)}
              placeholder={t('partySizePlaceholder')}
            />
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const parsed = parseInt(partySizeInput, 10)
                  if (Number.isNaN(parsed) || parsed <= 0) {
                    toast.error(t('partySizeInvalid'))
                    return
                  }
                  if (parsed > 20) {
                    toast.error(t('partySizeTooLarge'))
                    return
                  }
                  setPartySize(parsed)
                  setPartySizeInput(parsed.toString())
                  setIsPartySizeMandatory(false)
                  try {
                    localStorage.setItem(`partySize:${tableId}`, parsed.toString())
                  } catch (error) {
                    console.warn('Unable to persist party size', error)
                  }
                  setShowPartySizeModal(false)
                  const guestsLabel = t(parsed === 1 ? 'personSingular' : 'personPlural')
                  toast.success(t('partySizeSaved', { count: parsed, label: guestsLabel }))
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}










