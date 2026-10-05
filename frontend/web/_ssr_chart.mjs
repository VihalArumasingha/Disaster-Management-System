/* Temporary diagnostic: SSR-render InventoryPage + inline dev CSS -> _charttest.html */
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { writeFileSync } from 'node:fs'

const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error'
})

try {
    const mod = await server.ssrLoadModule('/src/components/NGODashboard/inventory page.jsx')
    const html = renderToStaticMarkup(React.createElement(mod.default))

    const css = await (await fetch('http://localhost:5173/src/index.css?direct')).text()

    const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>chart test</title>
<style>${css}</style>
<style>body{background:#f1f5f9;font-family:var(--font-sans)}</style>
</head><body><div id="root">${html}</div></body></html>`

    writeFileSync('_charttest.html', page)
    console.log('WROTE _charttest.html bytes=' + page.length)
} finally {
    await server.close()
}
