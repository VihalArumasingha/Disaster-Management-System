import { useEffect, useMemo, useState } from 'react'
import { Activity, FileSpreadsheet, FileText, Filter, LoaderCircle, Search } from 'lucide-react'
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '../../auth/hooks'
import api from '../../services/api'

const emptyFilters = { district: '', hazardType: '', disasterEvent: '', dateFrom: '', dateTo: '', organization: '' }
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const chartColors = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777']
const quantity = new Intl.NumberFormat()
const formatNumber = (value) => quantity.format(Number(value) || 0)
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`
const formatMoney = (value) => `LKR ${formatNumber(value)}`
const toCsvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const reportSections = [
    ['Alerts', 'alerts'],
    ['Hazard reports', 'hazardReports'],
    ['Shelters', 'shelters'],
    ['Relief supplies', 'supplies'],
    ['Distributions and audit', 'distributions'],
    ['Organization contributions', 'contributions'],
    ['District impact', 'impacts']
]

function AnalyticsReports({ apiBase = '/dmcofficer' }) {
    const { user } = useAuth()
    const [filters, setFilters] = useState(emptyFilters)
    const [options, setOptions] = useState({ districts: [], hazardTypes: [], disasterEvents: [], organizations: [] })
    const [analytics, setAnalytics] = useState(null)
    const [hasData, setHasData] = useState(false)
    const [loadingOptions, setLoadingOptions] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    useEffect(() => {
        let active = true
        api.get(`${apiBase}/analytics/options`)
            .then(({ data }) => {
                if (active) setOptions(data)
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load analytics filter options.')
            })
            .finally(() => {
                if (active) setLoadingOptions(false)
            })
        return () => { active = false }
    }, [apiBase])

    const organizationNames = useMemo(
        () => new Map(options.organizations.map((organization) => [organization._id, organization.organizationName])),
        [options.organizations]
    )

    const generate = async (event) => {
        event.preventDefault()
        setError('')
        setNotice('')
        if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
            setError('Date From cannot be later than Date To.')
            return
        }
        setAnalytics(null)
        setHasData(false)
        setGenerating(true)
        try {
            const { data } = await api.post(`${apiBase}/analytics/generate`, filters)
            setAnalytics(data.analytics)
            setHasData(data.hasData)
        } catch (requestError) {
            setAnalytics(null)
            setHasData(false)
            setError(requestError.response?.data?.message || 'Could not generate analytics.')
        } finally {
            setGenerating(false)
        }
    }

    const exportReport = async (format) => {
        if (!analytics) return
        setExporting(true)
        setError('')
        setNotice('')
        try {
            await api.post(`${apiBase}/analytics/exports`, {
                format,
                filters: analytics.filters,
                generatedAt: analytics.generatedAt
            })
            if (format === 'CSV') downloadCsv()
            else downloadPdf()
            setNotice(`${format} audit report downloaded.`)
        } catch (requestError) {
            setError(requestError.response?.data?.message || `Could not export the ${format} report.`)
        } finally {
            setExporting(false)
        }
    }

    const selectedOrganization = analytics?.filters.organization
        ? organizationNames.get(analytics.filters.organization) || analytics.filters.organization
        : 'All organizations'
    const selectedFilters = analytics && [
        ['District', analytics.filters.district || 'All districts'],
        ['Hazard type', analytics.filters.hazardType || 'All hazards'],
        ['Disaster event', analytics.filters.disasterEvent || 'All events'],
        ['Date from', analytics.filters.dateFrom || 'Any date'],
        ['Date to', analytics.filters.dateTo || 'Any date'],
        ['Organization', selectedOrganization]
    ]

    const detailCsvRows = analytics ? reportSections.flatMap(([section, key]) => (
        analytics.records[key].map((record) => ({
            section,
            id: record.shelterId || record.supplyId || record.distributionId || '',
            event: record.event || '',
            district: record.district || '',
            organization: record.organization || '',
            item: record.supply || record.supplyName || record.shelterName || record.description || '',
            quantity: record.quantity ?? record.received ?? record.affectedPopulation ?? '',
            status: record.auditStatus || record.status || '',
            date: record.date || record.issuedAt || '',
            details: JSON.stringify(record)
        }))
    )) : []

    function downloadCsv() {
        const rows = [
            ['Post-event impact analysis and relief audit report'],
            ['Generated at', analytics.generatedAt],
            ['Generated by', analytics.generatedBy || user?.name || user?.email || ''],
            ['Selected filters'],
            ...selectedFilters.map(([label, value]) => [label, value]),
            ['Summary', 'Value'],
            ['Total alerts', analytics.summary.totalAlerts],
            ['Unique citizen reach', analytics.summary.citizenReach],
            ['Citizen reach rate', `${analytics.summary.reachRate}%`],
            ['Shelter capacity', analytics.summary.shelterCapacity],
            ['Shelter occupancy', analytics.summary.shelterOccupancy],
            ['Shelter utilization', `${analytics.summary.shelterUtilization}%`],
            ['Supplies received', analytics.summary.suppliesReceived],
            ['Supplies distributed', analytics.summary.suppliesDistributed],
            ['Remaining inventory', analytics.summary.remainingInventory],
            ['Organization financial contributions', analytics.summary.organizationContributions],
            ['Organization contributions by currency', JSON.stringify(analytics.summary.organizationContributionsByCurrency)],
            ['Hazard reports', analytics.summary.hazardReports],
            ['District impact summary', JSON.stringify(analytics.summary.districtImpact)],
            ['Distribution verification status', JSON.stringify(analytics.summary.distributionAudit)],
            [],
            ['Section', 'ID', 'Event', 'District', 'Organization', 'Item / description', 'Quantity / affected', 'Audit / status', 'Date', 'Details'],
            ...detailCsvRows.map((row) => [row.section, row.id, row.event, row.district, row.organization, row.item, row.quantity, row.status, row.date, row.details])
        ]
        const content = `\uFEFF${rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')}`
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'post-event-impact-relief-audit.csv'
        anchor.click()
        URL.revokeObjectURL(url)
    }

    function downloadPdf() {
        const document = new jsPDF({ orientation: 'landscape' })
        document.setFontSize(16)
        document.text('Post-Event Impact Analysis & Relief Audit Report', 14, 16)
        document.setFontSize(9)
        document.text(`Generated: ${new Date(analytics.generatedAt).toLocaleString()}`, 14, 23)
        document.text(`Generated by: ${analytics.generatedBy || user?.name || user?.email || 'Unknown'}`, 14, 29)
        autoTable(document, {
            startY: 34,
            head: [['Selected filter', 'Value']],
            body: selectedFilters,
            theme: 'grid',
            styles: { fontSize: 8 }
        })
        autoTable(document, {
            startY: document.lastAutoTable.finalY + 5,
            head: [['Summary', 'Value']],
            body: [
                ['Total alerts', formatNumber(analytics.summary.totalAlerts)],
                ['Citizen reach / reach rate', `${formatNumber(analytics.summary.citizenReach)} / ${formatPercent(analytics.summary.reachRate)}`],
                ['Shelter capacity / occupancy / utilization', `${formatNumber(analytics.summary.shelterCapacity)} / ${formatNumber(analytics.summary.shelterOccupancy)} / ${formatPercent(analytics.summary.shelterUtilization)}`],
                ['Supplies received / distributed / remaining', `${formatNumber(analytics.summary.suppliesReceived)} / ${formatNumber(analytics.summary.suppliesDistributed)} / ${formatNumber(analytics.summary.remainingInventory)}`],
                ['Organization contributions', formatMoney(analytics.summary.organizationContributions)],
                ['Contributions by currency', JSON.stringify(analytics.summary.organizationContributionsByCurrency)],
                ['District impact totals', JSON.stringify(analytics.summary.districtImpact)],
                ['Distribution verification status', JSON.stringify(analytics.summary.distributionAudit)]
            ],
            theme: 'grid',
            styles: { fontSize: 8 }
        })
        for (const [title, key] of reportSections) {
            const records = analytics.records[key]
            if (!records.length) continue
            autoTable(document, {
                startY: document.lastAutoTable.finalY + 8,
                head: [[title]],
                body: records.map((record) => [JSON.stringify(record)]),
                theme: 'striped',
                styles: { fontSize: 7, cellWidth: 'wrap' },
                margin: { left: 14, right: 14 }
            })
        }
        document.save('post-event-impact-relief-audit.pdf')
    }

    const summaryCards = analytics ? [
        ['Total alerts', formatNumber(analytics.summary.totalAlerts), 'Warnings issued in the selected period'],
        ['Citizen reach', formatNumber(analytics.summary.citizenReach), `${formatPercent(analytics.summary.reachRate)} of targeted deliveries reached`],
        ['Shelter utilization', formatPercent(analytics.summary.shelterUtilization), `${formatNumber(analytics.summary.shelterOccupancy)} occupied / ${formatNumber(analytics.summary.shelterCapacity)} capacity`],
        ['Relief inventory', formatNumber(analytics.summary.remainingInventory), `${formatNumber(analytics.summary.suppliesReceived)} received · ${formatNumber(analytics.summary.suppliesDistributed)} distributed`],
        ['Organization contributions', formatMoney(analytics.summary.organizationContributions), 'Recorded financial contributions'],
        ['Affected population', formatNumber(analytics.summary.districtImpact.affectedPopulation), `${formatNumber(analytics.summary.districtImpact.deaths)} deaths · ${formatNumber(analytics.summary.districtImpact.injured)} injured`]
    ] : []

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Post-event reporting</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Impact Analysis & Relief Reports</h1>
                    <p className="mt-2 max-w-3xl text-slate-600">Generate filterable analytics and audit reports from recorded alerts, shelter, relief, organization, and district impact data.</p>
                </div>
                {analytics && (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={exporting} onClick={() => exportReport('CSV')} className="inline-flex items-center gap-2 rounded-xl border border-blue-700 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Export CSV
                        </button>
                        <button type="button" disabled={exporting} onClick={() => exportReport('PDF')} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />} Export PDF
                        </button>
                    </div>
                )}
            </header>

            {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

            <form onSubmit={generate} className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-2">
                    <Filter size={19} className="text-blue-700" />
                    <div>
                        <h2 className="font-semibold text-slate-900">Analysis filters</h2>
                        <p className="text-sm text-slate-500">Choose any combination of filters; blank fields include all matching records. Hazard filters apply to alerts and hazard reports; organization filters apply to relief and contribution records.</p>
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <SelectField label="District" value={filters.district} disabled={loadingOptions} onChange={(value) => setFilters({ ...filters, district: value })}>
                        <option value="">All districts</option>
                        {options.districts.map((district) => <option key={district}>{district}</option>)}
                    </SelectField>
                    <SelectField label="Hazard type" value={filters.hazardType} disabled={loadingOptions} onChange={(value) => setFilters({ ...filters, hazardType: value })}>
                        <option value="">All hazard types</option>
                        {options.hazardTypes.map((hazard) => <option key={hazard} value={hazard}>{humanize(hazard)}</option>)}
                    </SelectField>
                    <SelectField label="Disaster event" value={filters.disasterEvent} disabled={loadingOptions} onChange={(value) => setFilters({ ...filters, disasterEvent: value })}>
                        <option value="">All disaster events</option>
                        {options.disasterEvents.map((eventName) => <option key={eventName}>{eventName}</option>)}
                    </SelectField>
                    <InputField label="Date from" type="date" value={filters.dateFrom} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
                    <InputField label="Date to" type="date" value={filters.dateTo} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
                    <SelectField label="Organization" value={filters.organization} disabled={loadingOptions} onChange={(value) => setFilters({ ...filters, organization: value })}>
                        <option value="">All organizations</option>
                        {options.organizations.map((organization) => <option key={organization._id} value={organization._id}>{organization.organizationName}</option>)}
                    </SelectField>
                </div>
                <button type="submit" disabled={generating || loadingOptions} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {generating ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}
                    {generating ? 'Generating…' : 'Generate Analytics'}
                </button>
            </form>

            {!analytics && !generating && (
                <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                    <Activity className="mx-auto text-slate-400" size={34} />
                    <h2 className="mt-3 font-semibold text-slate-800">Generate an analysis to view results</h2>
                    <p className="mt-1 text-sm text-slate-500">Analytics and reports are calculated from matching database records.</p>
                </div>
            )}

            {analytics && (
                <>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                        <span>Generated {new Date(analytics.generatedAt).toLocaleString()} by {analytics.generatedBy || user?.name || 'Unknown user'}</span>
                        <span>{selectedFilters.map(([label, value]) => `${label}: ${value}`).join(' · ')}</span>
                    </div>
                    {!hasData ? (
                        <div role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <h2 className="font-semibold text-amber-900">No data matches these filters</h2>
                            <p className="mt-1 text-sm text-amber-800">Change or clear one or more filters and generate the analysis again.</p>
                        </div>
                    ) : (
                        <>
                            <section aria-label="Analytics summary" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {summaryCards.map(([label, value, caption]) => <SummaryCard key={label} label={label} value={value} caption={caption} />)}
                            </section>
                            <section className="mt-5 grid gap-4 xl:grid-cols-2">
                                <ChartCard title="Alert and citizen reach trend">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics.charts.alertReachTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="total" name="Alerts" stroke="#2563eb" /><Line type="monotone" dataKey="reached" name="Reached recipients" stroke="#0f766e" /></LineChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                                <ChartCard title="Shelter occupancy trend">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics.charts.shelterOccupancyTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="occupancy" name="Recorded occupancy" stroke="#d97706" /></LineChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                                <ChartCard title="Relief distribution by category">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.charts.distributionByCategory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="quantity" name="Quantity distributed" fill="#2563eb" /></BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                                <ChartCard title="Organization contributions">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.charts.organizationContributions}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis yAxisId="amount" /><YAxis yAxisId="quantity" orientation="right" /><Tooltip /><Legend /><Bar yAxisId="amount" dataKey="contributionAmount" name="Financial contribution (LKR)" fill="#0f766e" /><Bar yAxisId="quantity" dataKey="supplyQuantity" name="Supply quantity received" fill="#d97706" /></BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                                <ChartCard title="District impact analysis">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.charts.districtImpact}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="affected" name="Affected population" fill="#7c3aed" /><Bar dataKey="injured" name="Injured" fill="#d97706" /><Bar dataKey="deaths" name="Deaths" fill="#dc2626" /></BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                                <ChartCard title="Distribution verification status">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart><Pie data={Object.entries(analytics.summary.distributionAudit).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={100} label>{Object.keys(analytics.summary.distributionAudit).map((key, index) => <Cell key={key} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </section>
                            <ReportDetails analytics={analytics} />
                            <div className="sr-only" aria-hidden="true">{formatNumber(detailCsvRows.length)} report records prepared.</div>
                        </>
                    )}
                </>
            )}
        </main>
    )
}

function SelectField({ label, value, disabled, onChange, children }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<select className={fieldClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select></label>
}

function InputField({ label, type, value, onChange }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input className={fieldClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function SummaryCard({ label, value, caption }) {
    return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></article>
}

function ChartCard({ title, children }) {
    return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 font-semibold text-slate-900">{title}</h2><div className="h-72">{children}</div></article>
}

function ReportDetails({ analytics }) {
    const sections = [
        ['Shelter information', analytics.records.shelters, ['shelterName', 'district', 'event', 'capacity', 'occupancy', 'available', 'status']],
        ['Relief supply information', analytics.records.supplies, ['supplyName', 'organization', 'event', 'category', 'received', 'distributed', 'remaining', 'unit']],
        ['Distribution and audit information', analytics.records.distributions, ['distributionId', 'event', 'organization', 'supply', 'district', 'quantity', 'auditStatus', 'verifiedBy', 'verifiedAt', 'verificationNotes', 'auditHistory']],
        ['Organization contributions', analytics.records.contributions, ['organization', 'type', 'description', 'amount', 'currency', 'quantity', 'event', 'date']],
        ['District impact', analytics.records.impacts, ['event', 'district', 'affectedPopulation', 'evacuatedPopulation', 'peopleInShelters', 'injured', 'deaths', 'housesDamaged', 'schoolsAffected', 'roadsBlocked', 'hospitalsAffected', 'otherImpact', 'date']],
        ['Hazard reports', analytics.records.hazardReports, ['hazardType', 'status', 'capturedAt']]
    ]
    return <section className="mt-6 space-y-4">{sections.map(([title, rows, columns]) => <article key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">{title} <span className="text-xs font-normal text-slate-500">({rows.length})</span></h2>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{humanize(column)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row.distributionId || row.supplyId || row.shelterId || `${row.event}-${row.district}-${index}`}>{columns.map((column) => <td key={column} className="max-w-64 px-3 py-2 text-slate-700">{formatCell(row[column])}</td>)}</tr>)}</tbody></table></div> : <p className="px-4 py-5 text-sm text-slate-500">No matching records.</p>}</article>)}</section>
}

function formatCell(value) {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'object') return new Date(value).toLocaleString()
    return String(value)
}

function humanize(value) {
    return String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export default AnalyticsReports
