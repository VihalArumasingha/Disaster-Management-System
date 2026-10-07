import { ArrowLeft, Gift, Truck, Package, Heart, User, MapPin, AlertTriangle, Search, Navigation, Clock, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import DistributionPlanModal from './DistributionPlanModal'
import NgoPastHighlights from './NgoPastHighlights'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const INVENTORY_API = `${API_BASE}/api/inventory`
const TARGET_INVENTORY_API = `${API_BASE}/api/targetinventories`
const DISASTERS_API = `${API_BASE}/api/activedisasters`

const CENTERS_API = API_BASE + '/api/collectingcenters'
const OPERATIONS_API = `${API_BASE}/api/operations`
const VOLUNTEERS_API = `${API_BASE}/api/volunteers`
const DISTRIBUTION_RECORDS_API = `${API_BASE}/api/distributionrecords`

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

// Great-circle distance between two points, in km (haversine)
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// "0812234567" -> "+94 81 223 4567"; anything unexpected is returned as-is
const formatPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return '+94 ' + digits.slice(1, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6)
  }
  return phone || ''
}

// Google Maps deep-link for the "Get Directions" button
const directionsUrl = (center) => {
  const lat = Number(center.latitude)
  const lng = Number(center.longitude)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
  const destination = hasCoords
    ? lat + ',' + lng
    : [center.address, center.city].filter(Boolean).join(', ')
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination)
}

// Sort centers by distance from the user (centers without coords go last)
const sortNearby = (list, coords) => {
  if (!coords) return list
  return list
    .map((center) => {
      const lat = Number(center.latitude)
      const lng = Number(center.longitude)
      const distance =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? distanceKm(coords.lat, coords.lng, lat, lng)
          : null
      return { ...center, distance }
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
}

const CATEGORY_STYLES = {
  Food: 'border-amber-200 bg-amber-100 text-amber-700',
  Medical: 'border-blue-200 bg-blue-100 text-blue-700',
  Clothing: 'border-purple-200 bg-purple-100 text-purple-700',
  Shelter: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  Water: 'border-cyan-200 bg-cyan-100 text-cyan-700'
}

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
  // Find nearby center panel
  const [centersOpen, setCentersOpen] = useState(false)
  const [centers, setCenters] = useState([])
  const [centersLoading, setCentersLoading] = useState(false)
  const [centersError, setCentersError] = useState('')
  const [centerMode, setCenterMode] = useState('hometown')
  const [hometown, setHometown] = useState('')
  const [searchedCity, setSearchedCity] = useState('')
  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [operations, setOperations] = useState([])
  const [activeOperation, setActiveOperation] = useState(null)
  const [planVolunteers, setPlanVolunteers] = useState([])
  const [planVolunteersLoading, setPlanVolunteersLoading] = useState(false)
  const [distributionRecords, setDistributionRecords] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [inventoryRes, targetRes, disastersRes, distRecordsRes] = await Promise.all([
          fetch(INVENTORY_API),
          fetch(TARGET_INVENTORY_API),
          fetch(DISASTERS_API),
          fetch(DISTRIBUTION_RECORDS_API).catch(() => null)
        ])

        // Active disasters are non-fatal: the rest of the page still works
        if (disastersRes.ok) {
          const disastersData = await disastersRes.json()
        let distRecordsData = { records: [] }
        try {
          if (distRecordsRes) distRecordsData = await distRecordsRes.json()
        } catch { distRecordsData = { records: [] } }
        setDistributionRecords(
          Array.isArray(distRecordsData.records) ? distRecordsData.records : []
        )
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
  const loadCenters = async (q = '', coords = userPos) => {
    try {
      setCentersLoading(true)
      setCentersError('')
      const url = q ? CENTERS_API + '?q=' + encodeURIComponent(q) : CENTERS_API
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load collecting centers.')
      }
      setCenters(sortNearby(data.centers || [], coords))
      setSearchedCity(q)
    } catch (err) {
      setCenters([])
      setCentersError(err.message || 'Could not reach the server. Please try again.')
    } finally {
      setCentersLoading(false)
    }
  }

  const findNearMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Location is not supported on this device. Try the hometown search instead.')
      return
    }
    setGeoStatus('Getting your location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserPos(coords)
        setGeoStatus('Sorted by distance from your current location.')
        loadCenters('', coords)
      },
      () => {
        setUserPos(null)
        setGeoStatus('Location permission denied. Try the hometown search instead.')
        loadCenters('')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const selectCenterMode = (mode) => {
    setCenterMode(mode)
    if (mode === 'nearme') findNearMe()
  }

  const handleHometownSearch = (event) => {
    event.preventDefault()
    loadCenters(hometown.trim())
  }

  const handleToggleCenters = () => {
    if (!centersOpen) {
      setCentersOpen(true)
      if (centerMode === 'nearme') findNearMe()
      else loadCenters(hometown.trim())
    }
    // Bring the panel (bottom of the page) into view when the button is tapped
    setTimeout(() => {
      document.getElementById('center-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // Small "Find center" button inside each disaster card: opens the panel
  // pre-filtered with that disaster's city and scrolls to it.
  const openCentersForCity = (city) => {
    const q = (city || '').trim()
    setCentersOpen(true)
    setCenterMode('hometown')
    if (q) setHometown(q)
    loadCenters(q, userPos)
    setTimeout(() => {
      document.getElementById('center-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // Today's Progress — live from /api/distributionrecords (Relief Distribution page)
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayRecord = distributionRecords.find((r) => String(r.date || '').slice(0, 10) === todayKey)
  const todayFamilies = Number(todayRecord?.familiesAssisted) || 0
  const todayResources = Number(todayRecord?.resourcesDistributed) || 0
  const totalFamiliesAllTime = distributionRecords.reduce(
    (sum, r) => sum + (Number(r.familiesAssisted) || 0),
    0
  )
  const todayOverallPct = totalFamiliesAllTime > 0
    ? Math.min(100, Math.round((todayFamilies / totalFamiliesAllTime) * 100))
    : (todayFamilies > 0 || todayResources > 0 ? 100 : 0)

  const inventoryByKey = {}
  allAnalytics.forEach((a) => { inventoryByKey[a.value] = a.have })

  const openDistributionPlan = async () => {
    setPlanOpen(true)
    setPlanVolunteersLoading(true)
    try {
      const [opsRes, volsRes] = await Promise.all([fetch(OPERATIONS_API), fetch(VOLUNTEERS_API)])
      const opsData = await opsRes.json().catch(() => ({}))
      const volsData = await volsRes.json().catch(() => ({}))
      const ops = Array.isArray(opsData.operations) ? opsData.operations : (Array.isArray(opsData.data) ? opsData.data : [])
      const rank = (s) => (s === 'ACTIVE' ? 0 : s === 'PENDING' ? 1 : 2)
      ops.sort((a, b) => rank(String(a.status || '').toUpperCase()) - rank(String(b.status || '').toUpperCase()))
      setOperations(ops)
      setActiveOperation((prev) => prev || ops[0] || null)
      const vols = Array.isArray(volsData.volunteers) ? volsData.volunteers : (Array.isArray(volsData.data) ? volsData.data : [])
      setPlanVolunteers(vols)
    } catch (e) { console.error('Failed to load distribution plan:', e) } finally { setPlanVolunteersLoading(false) }
  }

  // Collapsed card shown at the bottom of the page while the panel is closed.
  const findCentersButton = (
    <button
      type="button"
      onClick={handleToggleCenters}
      className="w-full rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
          <MapPin size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-900">Find nearby center</span>
          <span className="block text-xs text-slate-500">
            Search donation centers by city or use your location
          </span>
        </span>
        <Navigation size={18} className="text-teal-600" />
      </div>
    </button>
  )

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
                    <button
                      type="button"
                      onClick={() => openCentersForCity(disaster.city)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-teal-200 bg-teal-50 py-1.5 text-xs font-bold text-teal-700 transition hover:bg-teal-100 active:scale-[0.98]"
                    >
                      <MapPin size={13} />
                      Find center
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Today's Progress + Distribution plan button */}
      <section className="px-5 py-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-sky-100 p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900">Today&apos;s Progress</h2>
          <p className="text-xs text-slate-500">In progress</p>
          <p className="mt-2 text-sm text-slate-700">Families assisted: <span className="font-bold text-slate-900">{todayFamilies}</span></p>
          <p className="mt-1 text-sm text-slate-700">Resources distributed: <span className="font-bold text-slate-900">{todayResources}</span></p>
          <p className="mt-1 text-sm text-slate-700">Overall progress <span className="font-bold text-slate-900">{todayOverallPct}%</span></p>
          <button type="button" onClick={openDistributionPlan} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]">
            <Package size={15} /> Distribution plan
          </button>
        </div>
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

      {/* Find Nearby Center Section */}
      <section id="center-search" className="px-5 py-4 pb-10">
        {!centersOpen ? (
          findCentersButton
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                  <MapPin size={17} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Donation Centers</h2>
                  <p className="text-[11px] text-slate-500">Find a center to drop off your donation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCentersOpen(false)}
                aria-label="Close center search"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => selectCenterMode('hometown')}
                className={
                  'flex-1 rounded-full px-3 py-2 text-xs font-bold transition ' +
                  (centerMode === 'hometown'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600')
                }
              >
                Search by hometown
              </button>
              <button
                type="button"
                onClick={() => selectCenterMode('nearme')}
                className={
                  'flex-1 rounded-full px-3 py-2 text-xs font-bold transition ' +
                  (centerMode === 'nearme'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600')
                }
              >
                Near me
              </button>
            </div>

            {centerMode === 'hometown' ? (
              <form onSubmit={handleHometownSearch} className="mb-3">
                <label htmlFor="hometown" className="mb-1 block text-xs font-bold text-slate-700">
                  Hometown / city
                </label>
                <div className="flex gap-2">
                  <input
                    id="hometown"
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    placeholder="e.g., Matara"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-[0.97]"
                  >
                    <Search size={14} className="mr-1 inline-block -translate-y-px" />
                    Search
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Tip: type a city/name/address to filter the list.
                </p>
              </form>
            ) : (
              <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs text-teal-800">
                  {geoStatus ||
                    (userPos
                      ? 'Sorted by distance from your current location.'
                      : 'Finding the centers closest to you...')}
                </p>
                <button
                  type="button"
                  onClick={findNearMe}
                  className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-teal-700 active:scale-[0.97]"
                >
                  Use my location
                </button>
              </div>
            )}

            {/* Results */}
            {centersLoading ? (
              <div className="py-4 text-center text-sm text-slate-500">Loading centers...</div>
            ) : centersError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
                {centersError}
              </div>
            ) : centers.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">
                No collecting centers found
                {searchedCity ? ' matching "' + searchedCity + '"' : ''}.
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-500">
                  {centers.length +
                    (centers.length === 1 ? ' center' : ' centers') +
                    (searchedCity ? ' matching "' + searchedCity + '"' : '')}
                </p>
                {centers.map((center) => (
                  <article
                    key={center._id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{center.name}</h3>
                      {typeof center.distance === 'number' && (
                        <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                          {center.distance < 1
                            ? Math.round(center.distance * 1000) + ' m'
                            : center.distance.toFixed(1) + ' km'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {center.address}
                      {center.city ? ', ' + center.city : ''}
                      {center.phone && (
                        <>
                          {' '}
                          •{' '}
                          <a
                            href={'tel:' + center.phone}
                            className="font-medium text-blue-600 underline"
                          >
                            {formatPhone(center.phone)}
                          </a>
                        </>
                      )}
                    </p>
                    {center.openingHours && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock size={12} />
                        {center.openingHours}
                      </p>
                    )}
                    {center.categories && center.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {center.categories.map((cat) => (
                          <span
                            key={cat}
                            className={
                              'rounded-full border px-2 py-0.5 text-[11px] font-semibold ' +
                              (CATEGORY_STYLES[cat] ||
                                'border-slate-200 bg-slate-100 text-slate-600')
                            }
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    <a
                      href={directionsUrl(center)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98]"
                    >
                      <Navigation size={14} />
                      Get Directions
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* NGO Past activity - bottom of page */}
      <section className="px-5 pb-10"><NgoPastHighlights /></section>
      {planOpen && (
        <DistributionPlanModal operation={activeOperation || operations[0] || null} operations={operations} inventoryByKey={inventoryByKey} volunteers={planVolunteers} volunteersLoading={planVolunteersLoading} onSelect={setActiveOperation} onClose={() => setPlanOpen(false)} />
      )}
    </div>
  )
}
