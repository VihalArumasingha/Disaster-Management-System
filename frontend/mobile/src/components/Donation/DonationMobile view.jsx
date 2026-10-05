import { ArrowLeft, Gift, Truck, Package, Heart, User, MapPin, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const INVENTORY_API = `${API_BASE}/api/inventory`
const TARGET_INVENTORY_API = `${API_BASE}/api/targetinventories`
const DISASTERS_API = `${API_BASE}/api/activedisasters`

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

// Maps free-text "top needs" from active disasters
// (e.g. "Water, Dry rations, Medical supplies") to the inventory
// item keys used by /api/inventory so the two can be joined.
const NEED_MATCHERS = [
  { key: 'dry_rations', patterns: ['dry ration', 'ration', 'food', 'meal'] },
  { key: 'water', patterns: ['water', 'drinking'] },
  { key: 'bedding', patterns: ['bedding', 'blanket', 'shelter', 'mattress'] },
  { key: 'medical', patterns: ['medical', 'medicine', 'medication', 'health'] },
  { key: 'clothing', patterns: ['clothing', 'clothes', 'apparel'] },
  { key: 'hygiene', patterns: ['hygiene', 'sanitary', 'sanitation', 'toiletries'] }
]

const NEED_SEPARATOR = /[,\n·/&]+|\band\b/i

const parseTopNeeds = (topNeeds) =>
  String(topNeeds || '')
    .split(NEED_SEPARATOR)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((label) => {
      const lower = label.toLowerCase()
      const match = NEED_MATCHERS.find(({ patterns }) =>
        patterns.some((pattern) => lower.includes(pattern))
      )
      return match ? { key: match.key, label } : null
    })
    .filter(Boolean)
    // one entry per inventory key (a disaster only "needs" an item once)
    .filter((entry, index, list) => list.findIndex((e) => e.key === entry.key) === index)

const SEVERITY_STYLES = {
  Low: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700'
}

// Cloudinary absolute URL, or legacy local upload path
const disasterImageUrl = (image, apiBase) => {
  const url = image?.url
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `${apiBase}/${String(url).replace(/\\/g, '')}`
}

export default function DonationMobileView() {
  const navigate = useNavigate()
  const [inventoryData, setInventoryData] = useState([])
  const [targetInventory, setTargetInventory] = useState({})
  const [disasters, setDisasters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [inventoryRes, targetRes, disastersRes] = await Promise.all([
          fetch(INVENTORY_API),
          fetch(TARGET_INVENTORY_API),
          fetch(DISASTERS_API)
        ])

        // Active disasters are non-fatal: the rest of the page still works
        if (disastersRes.ok) {
          const disastersData = await disastersRes.json()
          setDisasters(Array.isArray(disastersData.disasters) ? disastersData.disasters : [])
        } else {
          console.error('Failed to fetch active disasters:', disastersRes.status)
        }

        if (!inventoryRes.ok || !targetRes.ok) {
          throw new Error(`Inventory service unreachable (${inventoryRes.status}/${targetRes.status})`)
        }

        const inventoryData = await inventoryRes.json()
        const targetData = await targetRes.json()

        setInventoryData(Array.isArray(inventoryData.items) ? inventoryData.items : [])

        const cleanTargets = { ...targetData }
        delete cleanTargets._id
        delete cleanTargets.__v
        delete cleanTargets.createdAt
        delete cleanTargets.updatedAt
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

  // Parse each active disaster's free-text "topNeeds" into inventory item keys
  const activeDisasters = disasters.map((disaster) => ({
    ...disaster,
    parsedNeeds: parseTopNeeds(disaster.topNeeds)
  }))

  // Which items does each active disaster request?
  const needsByItem = {}
  activeDisasters.forEach((disaster) => {
    disaster.parsedNeeds.forEach(({ key, label }) => {
      if (!needsByItem[key]) needsByItem[key] = []
      if (!needsByItem[key].some((entry) => entry.id === disaster._id)) {
        needsByItem[key].push({
          id: disaster._id,
          title: disaster.title,
          city: disaster.city,
          label
        })
      }
    })
  })

  const allAnalytics = ITEM_OPTIONS.map((type) => {
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
      color: getCoverageColor(coverage),
      neededBy: needsByItem[type.value] || []
    }
  })

  // While disasters are active, list what they actually need first —
  // ranked by how many disasters request the item, then by lowest coverage.
  const neededAnalytics = allAnalytics.filter((item) => item.neededBy.length > 0)
  const inventoryAnalytics = (neededAnalytics.length > 0 ? neededAnalytics : allAnalytics)
    .slice()
    .sort((a, b) => {
      if (b.neededBy.length !== a.neededBy.length) return b.neededBy.length - a.neededBy.length
      return a.coverage - b.coverage
    })

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

      {/* Active Disasters Section */}
      <section className="px-5 pt-6 pb-2">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Active Disasters</h2>
          <span className="text-xs text-slate-500">Choose a cause to support directly</span>
        </div>

        {loading ? (
          <div className="py-4 text-center text-sm text-slate-500">Loading active disasters...</div>
        ) : activeDisasters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
            No active disasters right now — your donation still helps communities prepare.
          </div>
        ) : (
          <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-3">
            {activeDisasters.map((disaster) => {
              const coverImage = disasterImageUrl(disaster.images?.[0], API_BASE)
              return (
                <article
                  key={disaster._id}
                  className="w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative h-28 bg-slate-200">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={disaster.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300">
                        <AlertTriangle size={26} className="text-slate-500" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                      <MapPin size={12} className="text-red-400" />
                      {disaster.city}
                    </span>
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        SEVERITY_STYLES[disaster.severity] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {disaster.severity}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-slate-900">{disaster.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{disaster.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {disaster.parsedNeeds.slice(0, 3).map(({ key, label }) => (
                        <span
                          key={key}
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        >
                          {label}
                        </span>
                      ))}
                      {disaster.parsedNeeds.length > 3 && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          +{disaster.parsedNeeds.length - 3} more
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/donation/fundraise', {
                          state: {
                            cause: {
                              id: disaster._id,
                              title: disaster.title,
                              area: disaster.city
                            }
                          }
                        })
                      }
                      className="mt-3 w-full rounded-xl bg-green-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98]"
                    >
                      Support this cause
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Most Needed Now Section */}
      <section id="donate-section" className="px-5 py-4">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Most Needed Now</h2>
          <span className="text-xs text-slate-500">Actual stock vs. targets</span>
        </div>

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
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {item.have} / {item.target}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{Math.round(item.coverage)}%</span>
                  </span>
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
                {item.neededBy.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Requested by:{' '}
                    {item.neededBy.map((d) => `${d.title} (${d.city})`).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
