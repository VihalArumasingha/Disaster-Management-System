import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, LoaderCircle, Search } from 'lucide-react'
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '../../auth/hooks'
import api from '../../services/api'

const emptyFilters = { district: '', hazardType: '', disasterEvent: '', dateFrom: '', dateTo: '', organization: '' }
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const chartColors = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777']
const quantity = new Intl.NumberFormat()
const formatNumber = (value) => value === null || value === undefined || value === ''
    ? '—'
    : quantity.format(Number(value) || 0)
const formatPercent = (value) => value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : `${Number(value).toFixed(1)}%`
const formatMoney = (value) => `LKR ${formatNumber(value)}`
const toCsvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

// Single source of truth: which sections exist, their label, and their column order.
const REPORT_SECTIONS = [
    { key: 'alerts', label: 'Alerts', columns: ['issuedAt', 'event', 'hazardType', 'district', 'severity', 'status', 'issueElapsedMinutes', 'recipients', 'reached'] },
    { key: 'hazardReports', label: 'Hazard reports', columns: ['capturedAt', 'hazardType', 'status', 'district', 'event', 'reporter', 'description'] },
    { key: 'shelters', label: 'Shelters', columns: ['shelterId', 'shelterName', 'district', 'event', 'capacity', 'occupancy', 'available', 'overCapacity', 'utilization', 'capacityStatus', 'status'] },
    { key: 'supplies', label: 'Relief supplies', columns: ['supplyId', 'supplyName', 'organization', 'event', 'category', 'received', 'distributed', 'remaining', 'stockShortage', 'unit', 'status'] },
    { key: 'distributions', label: 'Distributions and audit', columns: ['distributionId', 'event', 'organization', 'supply', 'district', 'destinationType', 'affectedArea', 'quantity', 'auditStatus', 'verifiedBy', 'verifiedAt', 'verificationNotes'] },
    { key: 'contributions', label: 'Organization contributions', columns: ['organization', 'type', 'description', 'amount', 'currency', 'quantity', 'event', 'date'] },
    { key: 'impacts', label: 'District impact', columns: ['event', 'district', 'affectedPopulation', 'evacuatedPopulation', 'peopleInShelters', 'injured', 'deaths', 'housesDamaged', 'schoolsAffected', 'roadsBlocked', 'hospitalsAffected', 'otherImpact', 'date'] }
]

const isDateKey = (key) => /At$|Date$|date$/i.test(key)
const isNumberKey = (key) =>
    ['total', 'reached', 'capacity', 'occupancy', 'available', 'overCapacity', 'utilization',
     'issueElapsedMinutes', 'recipients', 'received', 'distributed', 'remaining', 'stockShortage',
     'quantity', 'amount', 'affectedPopulation', 'evacuatedPopulation', 'peopleInShelters', 'injured',
     'deaths', 'housesDamaged', 'schoolsAffected', 'roadsBlocked', 'hospitalsAffected'].includes(key)

function friendlyLabel(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
}

function formatCellValue(key, value) {
    if (value === null || value === undefined || value === '') return '—'
    if (isDateKey(key) && typeof value === 'string') {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString()
    }
    if (key === 'utilization') return `${Number(value).toFixed(1)}%`
    if (isNumberKey(key)) return formatNumber(value)
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

// Flatten analytics.records into a section -> rows structure with a stable column order.
function buildReportData(analytics) {
    if (!analytics) return []
    return REPORT_SECTIONS.map((section) => {
        const sourceRows = analytics.records[section.key] || []
        const presentColumns = section.columns.filter((column) =>
            sourceRows.some((row) => row[column] !== undefined && row[column] !== null && row[column] !== '')
        )
        const columns = presentColumns.length ? presentColumns : section.columns.slice(0, 4)
        const rows = sourceRows.map((record) =>
            columns.map((column) => formatCellValue(column, record[column]))
        )
        return {
            key: section.key,
            label: section.label,
            columns: columns.map(friendlyLabel),
            rows
        }
    }).filter((section) => section.rows.length > 0)
}

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
            if (format === 'CSV') downloadCsv()
            else downloadPdf()
            await api.post(`${apiBase}/analytics/exports`, {
                format,
                filters: analytics.filters,
                generatedAt: analytics.generatedAt
            })
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

    const selectedFilters = analytics ? [
        ['District', analytics.filters.district || 'All districts'],
        ['Hazard type', analytics.filters.hazardType || 'All hazards'],
        ['Disaster event', analytics.filters.disasterEvent || 'All events'],
        ['Date from', analytics.filters.dateFrom || 'Any date'],
        ['Date to', analytics.filters.dateTo || 'Any date'],
        ['Organization', selectedOrganization]
    ] : []

    const summaryRows = analytics ? [
        ['Report data status', analytics.dataQuality?.status === 'partial' ? 'Partial Data' : 'Complete'],
        ['Known missing metrics and sources', [
            ...(analytics.dataQuality?.missingMetrics || []).map(({ metric, reason }) => `${metric}: ${reason}`),
            ...(analytics.dataQuality?.missingSources || []).map(({ source, reason }) => `${source}: ${reason}`)
        ].join(' | ') || 'None reported'],
        ['Disclaimer', analytics.dataQuality?.disclaimer || ''],
        ['Total alerts', formatNumber(analytics.summary.totalAlerts)],
        ['Citizen reach / reach rate', `${formatNumber(analytics.summary.citizenReach)} / ${formatPercent(analytics.summary.reachRate)}`],
        ['Shelter capacity / occupancy / utilization', `${formatNumber(analytics.summary.shelterCapacity)} / ${formatNumber(analytics.summary.shelterOccupancy)} / ${formatPercent(analytics.summary.shelterUtilization)}`],
        ['Over-capacity shelters', formatNumber(analytics.summary.overcrowdedShelters)],
        ['Supplies received / distributed / remaining', `${formatNumber(analytics.summary.suppliesReceived)} / ${formatNumber(analytics.summary.suppliesDistributed)} / ${formatNumber(analytics.summary.remainingInventory)}`],
        ['Organization financial contributions', formatMoney(analytics.summary.organizationContributions)],
        ['Contributions by currency', Object.entries(analytics.summary.organizationContributionsByCurrency || {}).map(([c, v]) => `${c}: ${formatNumber(v)}`).join(' · ') || '—'],
        ['Affected population', formatNumber(analytics.summary.districtImpact.affectedPopulation)],
        ['Deaths', formatNumber(analytics.summary.districtImpact.deaths)],
        ['Injured', formatNumber(analytics.summary.districtImpact.injured)],
        ['Distribution verification status', Object.entries(analytics.summary.distributionAudit || {}).map(([k, v]) => `${k}: ${formatNumber(v)}`).join(' · ') || '—']
    ] : []

    const reportData = useMemo(() => buildReportData(analytics), [analytics])

    // ---------- CSV ----------
    function downloadCsv() {
        const rows = []

        // Header block
        rows.push(['Post-event impact analysis and relief audit report'])
        rows.push(['Generated at', analytics.generatedAt])
        rows.push(['Generated by', analytics.generatedBy || user?.name || user?.email || ''])
        rows.push([])

        // Filters
        rows.push(['Selected filters'])
        selectedFilters.forEach(([label, value]) => rows.push([label, value]))
        rows.push([])

        // Summary
        rows.push(['Executive summary', 'Value'])
        summaryRows.forEach((row) => rows.push(row))
        rows.push([])

        // One block per section, with a blank row between them for readability
        reportData.forEach((section) => {
            rows.push([`${section.label} (${section.rows.length})`])
            rows.push(section.columns)
            section.rows.forEach((row) => rows.push(row))
            rows.push([])
        })

        const content = `\uFEFF${rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')}`
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `post-event-impact-relief-audit-${new Date().toISOString().slice(0, 10)}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    // ---------- PDF ----------
    function downloadPdf() {
        const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        const pageWidth = document.internal.pageSize.getWidth()
        const pageHeight = document.internal.pageSize.getHeight()
        const marginX = 40
        let cursorY = 50

        // Title block
        document.setFontSize(18)
        document.setTextColor(15, 23, 42)
        document.text('Post-Event Impact Analysis & Relief Audit', marginX, cursorY)
        cursorY += 22

        document.setFontSize(10)
        document.setTextColor(71, 85, 105)
        document.text(`Generated: ${new Date(analytics.generatedAt).toLocaleString()}`, marginX, cursorY)
        cursorY += 14
        document.text(`Generated by: ${analytics.generatedBy || user?.name || user?.email || 'Unknown'}`, marginX, cursorY)
        cursorY += 22

        // Filters table
        autoTable(document, {
            startY: cursorY,
            head: [['Selected filter', 'Value']],
            body: selectedFilters,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 5 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255 },
            margin: { left: marginX, right: marginX }
        })
        cursorY = document.lastAutoTable.finalY + 20

        // Summary table
        autoTable(document, {
            startY: cursorY,
            head: [['Executive summary', 'Value']],
            body: summaryRows,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 5 },
            headStyles: { fillColor: [15, 118, 110], textColor: 255 },
            margin: { left: marginX, right: marginX }
        })
        cursorY = document.lastAutoTable.finalY + 24

        // Detailed sections
        reportData.forEach((section) => {
            if (cursorY > pageHeight - 120) {
                document.addPage()
                cursorY = 50
            }
            document.setFontSize(13)
            document.setTextColor(15, 23, 42)
            document.text(`${section.label} (${section.rows.length})`, marginX, cursorY)
            cursorY += 8

            autoTable(document, {
                startY: cursorY,
                head: [section.columns],
                body: section.rows,
                theme: 'striped',
                styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: marginX, right: marginX }
            })
            cursorY = document.lastAutoTable.finalY + 24
        })

        // Footer with page numbers
        const pageCount = document.internal.getNumberOfPages()
        document.setFontSize(8)
        document.setTextColor(148, 163, 184)
        for (let i = 1; i <= pageCount; i += 1) {
            document.setPage(i)
            document.text(
                `Page ${i} of ${pageCount}`,
                pageWidth - marginX,
                pageHeight - 20,
                { align: 'right' }
            )
        }

        document.save(`post-event-impact-relief-audit-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    const summaryCards = analytics ? [
        ['Total alerts', formatNumber(analytics.summary.totalAlerts), 'Warnings issued in the selected period'],
        ['Citizen reach', formatNumber(analytics.summary.citizenReach), `${formatPercent(analytics.summary.reachRate)} of targeted deliveries reached`],
        ['Shelter utilization', formatPercent(analytics.summary.shelterUtilization), `${formatNumber(analytics.summary.shelterOccupancy)} occupied / ${formatNumber(analytics.summary.shelterCapacity)} capacity`],
        ['Relief inventory', formatNumber(analytics.summary.remainingInventory), `${formatNumber(analytics.summary.suppliesReceived)} received · ${formatNumber(analytics.summary.suppliesDistributed)} distributed; per-supply shortage shown in details`],
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
                <div className="mb-5">
                    <h2 className="font-semibold text-slate-900">Analysis Filters</h2>
                    <p className="text-sm text-slate-500">Choose any combination of filters; blank fields include all matching records. Hazard filters apply to alerts and hazard reports; organization filters apply to relief and contribution records.</p>
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
                    {analytics.dataQuality?.status === 'partial' && (
                        <section aria-label="Partial data notice" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                            <h2 className="font-semibold">Partial Data</h2>
                            <p className="mt-1">{analytics.dataQuality.disclaimer}</p>
                            <ul className="mt-2 list-inside list-disc space-y-1">
                                {[...(analytics.dataQuality.missingMetrics || []), ...(analytics.dataQuality.missingSources || [])]
                                    .map((item) => (
                                        <li key={item.metric || item.source}>
                                            <strong>{item.metric || item.source}:</strong> {item.reason}
                                        </li>
                                    ))}
                            </ul>
                        </section>
                    )}
                    {!hasData ? (
                        <div role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <h2 className="font-semibold text-amber-900">No matching records</h2>
                            <p className="mt-1 text-sm text-amber-800">This is a valid empty result for the selected filters. You can change the filters and generate the analysis again.</p>
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
        ['Alert and response timing information', analytics.records.alerts, ['event', 'district', 'hazardType', 'severity', 'status', 'issuedAt', 'issueElapsedMinutes', 'recipients', 'reached']],
        ['Shelter information', analytics.records.shelters, ['shelterName', 'district', 'event', 'capacity', 'occupancy', 'available', 'overCapacity', 'utilization', 'capacityStatus', 'status']],
        ['Relief supply information', analytics.records.supplies, ['supplyName', 'organization', 'event', 'category', 'received', 'distributed', 'remaining', 'stockShortage', 'unit']],
        ['Distribution and audit information', analytics.records.distributions, ['distributionId', 'event', 'organization', 'supply', 'district', 'destinationType', 'affectedArea', 'quantity', 'auditStatus', 'verifiedBy', 'verifiedAt', 'verificationNotes']],
        ['Organization contributions', analytics.records.contributions, ['organization', 'type', 'description', 'amount', 'currency', 'quantity', 'event', 'date']],
        ['District impact', analytics.records.impacts, ['event', 'district', 'affectedPopulation', 'evacuatedPopulation', 'peopleInShelters', 'injured', 'deaths', 'housesDamaged', 'schoolsAffected', 'roadsBlocked', 'hospitalsAffected', 'otherImpact', 'date']],
        ['Verified citizen hazard reports', analytics.records.hazardReports, ['hazardType', 'status', 'capturedAt', 'district']]
    ]
    return (
        <section className="mt-6 space-y-4">
            {sections.map(([title, rows, columns]) => (
                <article key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {title} <span className="text-xs font-normal text-slate-500">({rows.length})</span>
                    </h2>
                    {rows.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{humanize(column)}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row, index) => (
                                        <tr key={row.distributionId || row.supplyId || row.shelterId || `${row.event}-${row.district}-${index}`}>
                                            {columns.map((column) => <td key={column} className="max-w-64 px-3 py-2 text-slate-700">{formatCell(row[column], column)}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="px-4 py-5 text-sm text-slate-500">No matching records.</p>
                    )}
                </article>
            ))}
        </section>
    )
}

function formatCell(value, key) {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'object') return new Date(value).toLocaleString()
    if (key === 'utilization') return `${Number(value).toFixed(1)}%`
    return String(value)
}

function humanize(value) {
    return String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export default AnalyticsReports