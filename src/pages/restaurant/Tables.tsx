import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { Table } from '@/types/database'
import { Plus, Edit, Trash2, Download, QrCode, Eye } from 'lucide-react'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode'

export function RestaurantTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    area: '',
  })
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        setRestaurantId(user.restaurant_id)
        fetchTables(user.restaurant_id)
      }
    }
    loadData()
  }, [])

  async function fetchTables(restId: string) {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restId)
        .order('name', { ascending: true })

      if (error) throw error
      setTables(data || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento dei tavoli')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function generateQRCode(tableId: string) {
    const baseUrl = window.location.origin
    const qrUrl = `${baseUrl}/${restaurantId}/${tableId}`
    
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
      })
      return qrDataUrl
    } catch (error) {
      console.error('Error generating QR code:', error)
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return

    try {
      let tableId: string

      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            name: formData.name,
            area: formData.area || null,
          })
          .eq('id', editingTable.id)

        if (error) throw error
        tableId = editingTable.id
        toast.success('Tavolo aggiornato')
      } else {
        const { data, error } = await supabase
          .from('tables')
          .insert([
            {
              name: formData.name,
              area: formData.area || null,
              restaurant_id: restaurantId,
              is_active: true,
            },
          ])
          .select()
          .single()

        if (error) throw error
        tableId = data.id
        toast.success('Tavolo creato')
      }

      // Generate QR code
      const qrDataUrl = await generateQRCode(tableId)
      if (qrDataUrl) {
        // Store QR code in database (optional - you can also generate it on the fly)
        await supabase
          .from('tables')
          .update({ qr_code: qrDataUrl })
          .eq('id', tableId)
      }

      setShowModal(false)
      setEditingTable(null)
      setFormData({ name: '', area: '' })
      fetchTables(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'operazione')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo tavolo?')) return

    try {
      const { error } = await supabase.from('tables').delete().eq('id', id)
      if (error) throw error
      toast.success('Tavolo eliminato')
      if (restaurantId) {
        fetchTables(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'eliminazione')
    }
  }

  async function handleShowQR(table: Table) {
    let qrDataUrl = table.qr_code

    if (!qrDataUrl) {
      qrDataUrl = await generateQRCode(table.id) || ''
      if (qrDataUrl) {
        await supabase
          .from('tables')
          .update({ qr_code: qrDataUrl })
          .eq('id', table.id)
      }
    }

    setQrPreview(qrDataUrl)
    setSelectedTable(table)
  }

  async function handleDownloadQR() {
    if (!qrPreview || !selectedTable) return

    const link = document.createElement('a')
    link.download = `qr-${selectedTable.name}.png`
    link.href = qrPreview
    link.click()
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Tavoli</h1>
        <button
          onClick={() => {
            setEditingTable(null)
            setFormData({ name: '', area: '' })
            setShowModal(true)
          }}
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Tavolo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{table.name}</h3>
                {table.area && (
                  <p className="text-sm text-gray-500">{table.area}</p>
                )}
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  table.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {table.is_active ? 'Attivo' : 'Inattivo'}
              </span>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const baseUrl = window.location.origin
                    const customerUrl = `${baseUrl}/${restaurantId}/${table.id}`
                    window.open(customerUrl, '_blank')
                  }}
                  className="flex-1 btn btn-primary inline-flex items-center justify-center bg-green-600 hover:bg-green-700"
                  title="Apri interfaccia cliente"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Anteprima Cliente
                </button>
                <button
                  onClick={() => handleShowQR(table)}
                  className="flex-1 btn btn-primary inline-flex items-center justify-center"
                  title="Mostra QR Code"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </button>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingTable(table)
                    setFormData({
                      name: table.name,
                      area: table.area || '',
                    })
                    setShowModal(true)
                  }}
                  className="flex-1 btn btn-secondary inline-flex items-center justify-center"
                  title="Modifica tavolo"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Modifica
                </button>
                <button
                  onClick={() => handleDelete(table.id)}
                  className="btn btn-danger inline-flex items-center"
                  title="Elimina tavolo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">Nessun tavolo configurato</p>
        </div>
      )}

      {/* Table Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingTable ? 'Modifica Tavolo' : 'Nuovo Tavolo'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    className="input mt-1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="es. T1, Balcone 3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Area (opzionale)</label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder="es. Interno, Esterno"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingTable(null)
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

      {/* QR Code Modal */}
      {qrPreview && selectedTable && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">QR Code - {selectedTable.name}</h3>
            <div className="flex flex-col items-center space-y-4">
              <img src={qrPreview} alt="QR Code" className="w-64 h-64" />
              <p className="text-sm text-gray-600 text-center">
                Scansiona questo codice per accedere al menu del tavolo
              </p>
              <button
                onClick={handleDownloadQR}
                className="btn btn-primary inline-flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica QR Code
              </button>
              <button
                onClick={() => {
                  setQrPreview(null)
                  setSelectedTable(null)
                }}
                className="btn btn-secondary"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

