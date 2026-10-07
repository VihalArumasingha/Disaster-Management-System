const fs = require('fs');
const f = 'C:/Users/DS/Desktop/NGO/frontend/mobile/src/CitizenDashboard.jsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const o = '<div className="mt-5">' + NL + '                <NgoPastHighlights />' + NL + '            </div>' + NL + NL + '            {/* Recent warnings preview */}';
const n = '{/* Recent warnings preview */}';
if (!s.includes(o)) { console.error('MISS dashboard-top'); process.exit(1); }
s = s.split(o).join(n);
fs.writeFileSync(f, s, 'utf8');
console.log('dashboard top removed len=' + s.length);
