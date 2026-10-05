import { ArrowLeft, Gift, Truck, Package, Heart, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

const ITEM_OPTIONS = [
  { value: 'dry_rations', label: 'Dry rations', unit: 'packs' },
  { value: 'water', label: 'Water', unit: 'liters' },
  { value: 'bedding', label: 'Bedding', unit: 'sets' },
  { value: 'medical', label: 'Medical kits', unit: 'kits' },
  { value: 'clothing', label: 'Clothing', unit: 'sets' },
  { value: 'hygiene', label: 'Hygiene packs', unit: 'packs' }
]

const getCoverageColor = (coverage) => {
  if (coverage >= 80) return '#22c55e'
  if (coverage >= 60) return '#f59e0b'
  if (coverage >= 30) return '#f97316'
  return '#ef4444'
}

export default function DonationMobileView() {
  const navigate = useNavigate()
  const [inventoryData, setInventoryData] = useState([])
  const [targetInventory, setTargetInventory] = useState({})
  const [loading, setLoading] = useState(true)

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
  const INVENTORY_API = `${API_BASE}/api/inventory`
  const TARGET_INVENTORY_API = `${API_BASE}/api/targetinventories`

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [inventoryRes, targetRes] = await Promise.all([
          fetch(INVENTORY_API),
          fetch(TARGET_INVENTORY_API)
        ])

        const inventoryData = await inventoryRes.json()
        const targetData = await targetRes.json()

        setInventoryData(inventoryData.items || [])
        
        const { _id, __v, createdAt, updatedAt, ...cleanTargets } = targetData || {}
        setTargetInventory(cleanTargets)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setTargetInventory({
          dry_rations: 100,
          water: 100,
          bedding: 50,
          medical: 50,
          clothing: 50,
          hygiene: 100
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const inventoryAnalytics = ITEM_OPTIONS.map((type) => {
    const total = inventoryData
      .filter((item) => item.item === type.value)
      .reduce((sum, item) => sum + (item.quantity || 0), 0)
    
    const target = targetInventory[type.value] || 0
    const coverage = target > 0 ? Math.min((total / target) * 100, 100) : 0
    
    return {
      ...type,
      have: total,
      target,
      coverage,
      color: getCoverageColor(coverage)
    }
  }).sort((a, b) => a.coverage - b.coverage)

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-24 shadow-xl">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition"
        >
          <ArrowLeft size={20} />
          <span className="font-semibold">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white">
            <Heart size={20} />
          </span>
          <span className="font-bold text-slate-900">Support</span>
        </div>
        <button className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Hero Section */}
      <section className="px-5 py-8 bg-gradient-to-b from-green-50 to-white">
        <div className="flex justify-center gap-6 mb-6">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <Gift size={32} className="text-green-600" />
            </div>
            <span className="text-xs text-slate-600">Donate</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Truck size={32} className="text-blue-600" />
            </div>
            <span className="text-xs text-slate-600">Distribute</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
              <Package size={32} className="text-purple-600" />
            </div>
            <span className="text-xs text-slate-600">Support</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-3">
          Support Disaster Relief
        </h1>
        <p className="text-center text-sm text-slate-600 mb-6 px-4">
          Help families with food, medicine, shelter and recovery. Your contribution matters.
        </p>

        <div className="flex flex-col gap-3 px-4">
          <button
            className="w-full py-3 bg-green-600 text-white font-medium rounded-2xl shadow-sm hover:bg-green-700 transition active:scale-[0.98] flex items-center justify-center gap-2"
            onClick={() => navigate('/donation/fundraise')}
          >
            <Heart size={18} />
            Start Fundraising
          </button>
          <button
            className="w-full py-3 bg-white text-slate-700 font-medium rounded-2xl border border-slate-300 hover:bg-slate-50 transition active:scale-[0.98] flex items-center justify-center gap-2"
            onClick={() => navigate('/donation/volunteer')}
          >
            <User size={18} />
            Become a volunteer
          </button>
          <button
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-2xl shadow-sm hover:bg-blue-700 transition active:scale-[0.98] flex items-center justify-center gap-2"
            onClick={() => {
              document.getElementById('donate-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <Package size={18} />
            Donate Items
          </button>
        </div>
      </section>

      {/* Most Needed Now Section */}
      <section id="donate-section" className="px-5 py-4">
        <h2 className="text-base font-bold text-slate-900 mb-3">Most Needed Now</h2>

        {loading ? (
          <div className="text-center py-4 text-slate-500 text-sm">Loading inventory data...</div>
        ) : (
          <div className="space-y-2">
            {inventoryAnalytics.map((item) => (
              <div key={item.value} className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-slate-900">
                    {item.label}
                    <span className="text-slate-500 font-normal text-xs ml-1">({item.unit})</span>
                  </span>
                  <span className="font-bold text-sm text-slate-900">{Math.round(item.coverage)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${item.coverage}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
