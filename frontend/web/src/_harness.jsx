import { createRoot } from 'react-dom/client'
import InventoryPage from './components/NGODashboard/inventory page.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(<InventoryPage />)

/* TEMP diagnostics: dump computed styles of the chart into the DOM for --dump-dom */
setTimeout(() => {
    try {
        const h2 = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Most Needed Now'))
        const section = h2?.closest('section')
        const yCol = section?.querySelector('.h-60')
        const plot = section?.querySelectorAll('.h-60')[1]
        const rotated = section?.querySelector('[class*="rotate"]')
        const barWrap = section?.querySelector('.items-end')
        const col = barWrap?.children[0]
        const bar = col?.children[1]
        const cssAll = [...document.styleSheets].map((s) => {
            try { return [...s.cssRules].map((r) => r.cssText).join('\n') } catch { return '' }
        }).join('\n')
        const info = {
            yColClasses: yCol?.className ?? 'NOT FOUND',
            yColHeight: yCol ? getComputedStyle(yCol).height : '-',
            plotHeight: plot ? getComputedStyle(plot).height : '-',
            rotatedClass: rotated?.className ?? 'NOT FOUND',
            rotatedStyle: rotated ? (getComputedStyle(rotated).rotate || getComputedStyle(rotated).transform) : '-',
            barWrapPosition: barWrap ? getComputedStyle(barWrap).position : '-',
            barWrapHeight: barWrap ? getComputedStyle(barWrap).height : '-',
            barHeight: bar ? getComputedStyle(bar).height : '-',
            barBg: bar ? getComputedStyle(bar).backgroundColor : '-',
            hasH60Rule: cssAll.includes('.h-60'),
            hasRotateRule: cssAll.includes('rotate-90'),
            hasBgBlue500: cssAll.includes('.bg-blue-500'),
            hasBgBlue600: cssAll.includes('.bg-blue-600'),
            hasFromPurple500: cssAll.includes('.from-purple-500'),
            hasFromViolet600: cssAll.includes('.from-violet-600'),
            hasRotate30: cssAll.includes('rotate-\\[-30deg\\]'),
            ruleCount: cssAll.split('\n').length
        }
        const d = document.createElement('pre')
        d.id = 'DIAG'
        d.textContent = 'DIAG:' + JSON.stringify(info, null, 1)
        document.body.appendChild(d)
    } catch (e) {
        const d = document.createElement('pre')
        d.id = 'DIAG'
        d.textContent = 'DIAG-ERR:' + e.message
        document.body.appendChild(d)
    }
}, 4000)

