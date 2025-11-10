import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { Category, Product, Restaurant } from '@/types/database'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function RestaurantMenu() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    status: 'available' as 'available' | 'unavailable',
    image_url: '',
    ayceLimitEnabled: false,
    ayceLimitQuantity: '',
  })
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
  const [allYouCanEatSettings, setAllYouCanEatSettings] = useState({
    enabled: false,
    lunchPrice: '',
    dinnerPrice: '',
  })
  const [savingAllYouCanEat, setSavingAllYouCanEat] = useState(false)

  const revokePreview = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  async function loadImage(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = (error) => {
        URL.revokeObjectURL(url)
        reject(error)
      }
      img.src = url
    })
  }

  async function optimizeImage(file: File, maxSize = 600, quality = 0.6) {
    const image = await loadImage(file)
    const { width, height } = image
    const scale = Math.min(1, maxSize / Math.max(width, height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Impossibile elaborare l\'immagine')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('Elaborazione immagine fallita'))
        },
        'image/webp',
        quality
      )
    })

    return { blob, extension: 'webp' as const }
  }

  function extractStoragePath(url: string) {
    const marker = '/storage/v1/object/public/restaurant-assets/'
    const index = url.indexOf(marker)
    if (index === -1) return null
    return url.substring(index + marker.length)
  }

  useEffect(() => {
    return () => {
      if (productImagePreview && productImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(productImagePreview)
      }
    }
  }, [productImagePreview])

  useEffect(() => {
    async function loadData() {
      try {
        const user = await getCurrentUser()
        console.log('Current user:', user)
        
        if (!user) {
          toast.error('Utente non trovato. Effettua il login.')
          setLoading(false)
          return
        }

        if (!user.restaurant_id) {
          toast.error('Nessun ristorante assegnato. Contatta l\'amministratore.')
          setLoading(false)
          return
        }

        setRestaurantId(user.restaurant_id)
        await fetchRestaurantSettings(user.restaurant_id)
        await fetchCategories(user.restaurant_id)
        await fetchProducts(user.restaurant_id)
      } catch (error: any) {
        toast.error('Errore nel caricamento dei dati')
        console.error('Load data error:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  async function fetchCategories(restId: string) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restId)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('Categories fetch error:', error)
        throw error
      }
      
      console.log('Categories loaded:', data?.length || 0)
      setCategories(data || [])
    } catch (error: any) {
      console.error('Error fetching categories:', error)
      toast.error(`Errore nel caricamento delle categorie: ${error.message}`)
      throw error
    }
  }

  async function fetchRestaurantSettings(restId: string) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('all_you_can_eat_enabled, all_you_can_eat_lunch_price, all_you_can_eat_dinner_price')
        .eq('id', restId)
        .single<Pick<Restaurant, 'all_you_can_eat_enabled' | 'all_you_can_eat_lunch_price' | 'all_you_can_eat_dinner_price'>>()

      if (error) {
        console.error('Restaurant settings fetch error:', error)
        throw error
      }

      if (data) {
        setAllYouCanEatSettings({
          enabled: data.all_you_can_eat_enabled,
          lunchPrice: data.all_you_can_eat_lunch_price !== null ? data.all_you_can_eat_lunch_price.toString() : '',
          dinnerPrice: data.all_you_can_eat_dinner_price !== null ? data.all_you_can_eat_dinner_price.toString() : '',
        })
      }
    } catch (error: any) {
      console.error('Error fetching restaurant settings:', error)
      toast.error(`Errore nel caricamento delle impostazioni: ${error.message}`)
    }
  }

  async function handleSaveAllYouCanEat() {
    if (!restaurantId) return

    try {
      setSavingAllYouCanEat(true)

      if (!allYouCanEatSettings.enabled) {
        console.log('Saving AYCE: disabling for restaurant', restaurantId)
        const { error } = await supabase
          .from('restaurants')
          .update({
            all_you_can_eat_enabled: false,
            all_you_can_eat_lunch_price: null,
            all_you_can_eat_dinner_price: null,
          })
          .eq('id', restaurantId)

        if (error) {
          console.error('Error updating All You Can Eat settings:', error)
          throw error
        }

        setAllYouCanEatSettings({
          enabled: false,
          lunchPrice: '',
          dinnerPrice: '',
        })

        toast.success('Modalità All You Can Eat disattivata')
        await fetchRestaurantSettings(restaurantId)
        return
      }

      if (!allYouCanEatSettings.lunchPrice || !allYouCanEatSettings.dinnerPrice) {
        toast.error('Inserisci sia il prezzo pranzo che il prezzo cena')
        return
      }

      const normalizedLunch = allYouCanEatSettings.lunchPrice.replace(',', '.').trim()
      const normalizedDinner = allYouCanEatSettings.dinnerPrice.replace(',', '.').trim()

      const lunchValue = parseFloat(normalizedLunch)
      const dinnerValue = parseFloat(normalizedDinner)

      if (Number.isNaN(lunchValue) || Number.isNaN(dinnerValue)) {
        toast.error('I prezzi inseriti non sono validi. Usa il punto come separatore decimale (es. 15.90).')
        return
      }

      if (lunchValue < 0 || dinnerValue < 0) {
        toast.error('I prezzi devono essere maggiori o uguali a zero.')
        return
      }

      console.log('Saving AYCE: enabling', {
        restaurantId,
        lunchValue,
        dinnerValue,
        rawLunch: allYouCanEatSettings.lunchPrice,
        rawDinner: allYouCanEatSettings.dinnerPrice,
      })

      const { error } = await supabase
        .from('restaurants')
        .update({
          all_you_can_eat_enabled: allYouCanEatSettings.enabled,
          all_you_can_eat_lunch_price: lunchValue,
          all_you_can_eat_dinner_price: dinnerValue,
        })
        .eq('id', restaurantId)

      if (error) {
        console.error('Error updating All You Can Eat settings:', error)
        throw error
      }

      setAllYouCanEatSettings((prev) => ({
        ...prev,
        enabled: true,
        lunchPrice: normalizedLunch,
        dinnerPrice: normalizedDinner,
      }))

      toast.success('Impostazioni aggiornate')
      await fetchRestaurantSettings(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio delle impostazioni')
    } finally {
      setSavingAllYouCanEat(false)
    }
  }

  async function fetchProducts(restId: string) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restId)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('Products fetch error:', error)
        throw error
      }
      
      console.log('Products loaded:', data?.length || 0)
      setProducts(data || [])
      setLoading(false)
    } catch (error: any) {
      console.error('Error fetching products:', error)
      toast.error(`Errore nel caricamento dei prodotti: ${error.message}`)
      throw error
    }
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryForm.name,
            description: categoryForm.description,
          })
          .eq('id', editingCategory.id)

        if (error) throw error
        toast.success('Categoria aggiornata')
      } else {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) : 0
        const { error } = await supabase
          .from('categories')
          .insert([{
            ...categoryForm,
            restaurant_id: restaurantId,
            display_order: maxOrder + 1,
          }])

        if (error) throw error
        toast.success('Categoria creata')
      }

      setShowCategoryModal(false)
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
      fetchCategories(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'operazione')
    }
  }

  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId || !productForm.category_id) return

    try {
      const priceValue = parseFloat(productForm.price)
      if (Number.isNaN(priceValue)) {
        toast.error('Il prezzo inserito non è valido.')
        return
      }

      const limitEnabled =
        (allYouCanEatSettings.enabled || productForm.ayceLimitEnabled) && productForm.ayceLimitEnabled
      let limitQuantityValue: number | null = null

      if (limitEnabled) {
        const parsedLimit = parseInt(productForm.ayceLimitQuantity, 10)
        if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
          toast.error('Inserisci un limite valido maggiore di zero.')
          return
        }
        limitQuantityValue = parsedLimit
      }

      let imageUrl = productForm.image_url?.trim() ? productForm.image_url.trim() : null
      let previousImageUrl: string | null = null

      if (productImageFile && restaurantId) {
        const { blob, extension } = await optimizeImage(productImageFile)
        const filePath = `products/${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from('restaurant-assets')
          .upload(filePath, blob, { upsert: true, contentType: blob.type })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('restaurant-assets')
          .getPublicUrl(filePath)

        imageUrl = publicUrlData.publicUrl
        if (editingProduct?.image_url && editingProduct.image_url !== imageUrl) {
          previousImageUrl = editingProduct.image_url
        }
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            name: productForm.name,
            description: productForm.description,
            price: priceValue,
            category_id: productForm.category_id,
            status: productForm.status,
            image_url: imageUrl,
            ayce_limit_enabled: limitEnabled,
            ayce_limit_quantity: limitQuantityValue,
          })
          .eq('id', editingProduct.id)

        if (error) throw error
        toast.success('Prodotto aggiornato')
        if (previousImageUrl) {
          const path = extractStoragePath(previousImageUrl)
          if (path) {
            const { error: removeError } = await supabase.storage.from('restaurant-assets').remove([path])
            if (removeError) {
              console.warn('Errore nel rimuovere l\'immagine precedente:', removeError)
            }
          }
        }
      } else {
        const maxOrder = products.filter(p => p.category_id === productForm.category_id).length
        const { error } = await supabase
          .from('products')
          .insert([{
            restaurant_id: restaurantId,
            price: priceValue,
            display_order: maxOrder + 1,
            name: productForm.name,
            description: productForm.description,
            category_id: productForm.category_id,
            status: productForm.status,
            image_url: imageUrl,
            ayce_limit_enabled: limitEnabled,
            ayce_limit_quantity: limitQuantityValue,
          }])

        if (error) throw error
        toast.success('Prodotto creato')
      }

      setShowProductModal(false)
      setEditingProduct(null)
      setProductForm({
        name: '',
        description: '',
        price: '',
        category_id: selectedCategory || '',
        status: 'available',
        image_url: '',
        ayceLimitEnabled: false,
        ayceLimitQuantity: '',
      })
      setProductImageFile(null)
      revokePreview(productImagePreview)
      setProductImagePreview(null)
      fetchProducts(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'operazione')
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Sei sicuro? Verranno eliminati anche tutti i prodotti della categoria.')) return

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      toast.success('Categoria eliminata')
      if (restaurantId) {
        fetchCategories(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'eliminazione')
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return

    try {
      const productToDelete = products.find(p => p.id === id)
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      if (productToDelete?.image_url) {
        const path = extractStoragePath(productToDelete.image_url)
        if (path) {
          const { error: removeError } = await supabase.storage.from('restaurant-assets').remove([path])
          if (removeError) {
            console.warn('Errore nella rimozione dell\'immagine:', removeError)
          }
        }
      }
      toast.success('Prodotto eliminato')
      if (restaurantId) {
        fetchProducts(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'eliminazione')
    }
  }

  function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    revokePreview(productImagePreview)
    setProductImageFile(file)
    setProductImagePreview(URL.createObjectURL(file))
    setProductForm((prev) => ({
      ...prev,
      image_url: '',
    }))
    event.target.value = ''
  }

  function handleRemoveProductImage() {
    revokePreview(productImagePreview)
    setProductImageFile(null)
    setProductImagePreview(null)
    setProductForm((prev) => ({
      ...prev,
      image_url: '',
    }))
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  const canEditAyceLimit = allYouCanEatSettings.enabled || productForm.ayceLimitEnabled

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Menu</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setEditingCategory(null)
              setCategoryForm({ name: '', description: '' })
              setShowCategoryModal(true)
            }}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuova Categoria
          </button>
          <button
            onClick={() => {
              setEditingProduct(null)
              setProductForm({
                name: '',
                description: '',
                price: '',
                category_id: selectedCategory || categories[0]?.id || '',
                status: 'available',
                image_url: '',
                ayceLimitEnabled: false,
                ayceLimitQuantity: '',
              })
              setProductImageFile(null)
              revokePreview(productImagePreview)
              setProductImagePreview(null)
              setShowProductModal(true)
            }}
            className="btn btn-primary inline-flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Prodotto
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Modalità All You Can Eat</h2>
            <p className="text-sm text-gray-600">
              Attiva questa modalità per applicare un prezzo fisso a pranzo e cena.
            </p>
          </div>
          <label className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Disattiva</span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only"
                checked={allYouCanEatSettings.enabled}
                onChange={(event) => {
                  const enabled = event.target.checked
                  setAllYouCanEatSettings((prev) => ({
                    ...prev,
                    enabled,
                    lunchPrice: enabled ? prev.lunchPrice : '',
                    dinnerPrice: enabled ? prev.dinnerPrice : '',
                  }))
                }}
              />
              <div
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  allYouCanEatSettings.enabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-1 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    allYouCanEatSettings.enabled ? 'translate-x-6' : ''
                  }`}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700">Attiva</span>
          </label>
        </div>

        {allYouCanEatSettings.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prezzo pranzo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input mt-1"
                placeholder="Es. 15.90"
                value={allYouCanEatSettings.lunchPrice}
                onChange={(event) =>
                  setAllYouCanEatSettings((prev) => ({
                    ...prev,
                    lunchPrice: event.target.value,
                  }))
                }
                disabled={savingAllYouCanEat}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prezzo cena (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input mt-1"
                placeholder="Es. 22.50"
                value={allYouCanEatSettings.dinnerPrice}
                onChange={(event) =>
                  setAllYouCanEatSettings((prev) => ({
                    ...prev,
                    dinnerPrice: event.target.value,
                  }))
                }
                disabled={savingAllYouCanEat}
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAllYouCanEat}
            className="btn btn-primary"
            disabled={savingAllYouCanEat}
          >
            {savingAllYouCanEat ? 'Salvataggio...' : 'Salva impostazioni'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Categorie</h2>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-4 py-2 rounded-lg ${
                  selectedCategory === null ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                }`}
              >
                Tutte
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between group">
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-1 text-left px-4 py-2 rounded-lg ${
                      selectedCategory === cat.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {cat.name}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-600 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Prodotti</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.category_id)
                return (
                  <div key={product.id} className="border rounded-lg p-4">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded-md mb-3"
                      />
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        {category && (
                          <p className="text-sm text-gray-500">{category.name}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-primary-600">€{product.price.toFixed(2)}</span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                    )}
                    {product.ayce_limit_enabled && product.ayce_limit_quantity && (
                      <p className="text-xs font-medium text-primary-600 mb-2">
                        Limite AYCE: {product.ayce_limit_quantity} pezzi a persona
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          product.status === 'available'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.status === 'available' ? 'Disponibile' : 'Non disponibile'}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product)
                            setProductForm({
                              name: product.name,
                              description: product.description || '',
                              price: product.price.toString(),
                              category_id: product.category_id,
                              status: product.status as 'available' | 'unavailable',
                              image_url: product.image_url || '',
                              ayceLimitEnabled: product.ayce_limit_enabled,
                              ayceLimitQuantity: product.ayce_limit_quantity ? product.ayce_limit_quantity.toString() : '',
                            })
                            setProductImageFile(null)
                            revokePreview(productImagePreview)
                            setProductImagePreview(product.image_url || null)
                            setShowProductModal(true)
                          }}
                          className="text-primary-600 hover:text-primary-800"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {filteredProducts.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nessun prodotto disponibile</p>
            )}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
            </h3>
            <form onSubmit={handleCategorySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    className="input mt-1"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrizione</label>
                  <textarea
                    className="input mt-1"
                    rows={3}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategory(null)
                  }}
                  className="btn btn-secondary"
                >
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingProduct ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
            </h3>
            <form onSubmit={handleProductSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    className="input mt-1"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrizione</label>
                  <textarea
                    className="input mt-1"
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Prezzo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input mt-1"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoria</label>
                  <select
                    required
                    className="input mt-1"
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stato</label>
                  <select
                    className="input mt-1"
                    value={productForm.status}
                    onChange={(e) =>
                      setProductForm({ ...productForm, status: e.target.value as 'available' | 'unavailable' })
                    }
                  >
                    <option value="available">Disponibile</option>
                    <option value="unavailable">Non disponibile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Foto (opzionale)</label>
                  {(productImagePreview || productForm.image_url) && (
                    <div className="mt-2 relative">
                      <img
                        src={productImagePreview || productForm.image_url}
                        alt={productForm.name || 'Anteprima prodotto'}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveProductImage}
                        className="absolute top-2 right-2 bg-white/80 text-gray-700 px-2 py-1 text-xs rounded shadow-sm hover:bg-white"
                      >
                        Rimuovi
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProductImageChange}
                    className="mt-2 w-full text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 8 MB. Formati consigliati: JPG o PNG.</p>
                </div>
                {canEditAyceLimit && (
                  <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary-700">Limita pezzi in formula AYCE</span>
                      <label className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          checked={productForm.ayceLimitEnabled}
                          onChange={(event) =>
                            setProductForm((prev) => ({
                              ...prev,
                              ayceLimitEnabled: event.target.checked,
                              ayceLimitQuantity: event.target.checked ? prev.ayceLimitQuantity : '',
                            }))
                          }
                        />
                        <span className="text-sm text-primary-700">Attiva limite</span>
                      </label>
                    </div>
                    {productForm.ayceLimitEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-primary-700">
                          Numero massimo pezzi per persona
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="input mt-1"
                          value={productForm.ayceLimitQuantity}
                          onChange={(event) =>
                            setProductForm((prev) => ({
                              ...prev,
                              ayceLimitQuantity: event.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-primary-600 mt-1">
                          Il limite si applica solo agli ordini effettuati in modalità All You Can Eat.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false)
                    setEditingProduct(null)
                    setProductForm({
                      name: '',
                      description: '',
                      price: '',
                      category_id: selectedCategory || '',
                      status: 'available',
                      image_url: '',
                      ayceLimitEnabled: false,
                      ayceLimitQuantity: '',
                    })
                    setProductImageFile(null)
                    revokePreview(productImagePreview)
                    setProductImagePreview(null)
                  }}
                  className="btn btn-secondary"
                >
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

