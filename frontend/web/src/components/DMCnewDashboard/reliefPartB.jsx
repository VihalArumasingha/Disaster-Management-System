import { useState } from 'react'
export default function AssignBox({ item, onClose, onSave }) {
  const r = item || {}
  const u = r?.reporterId && typeof r.reporterId === 'object' ? r.reporterId : {}
  const [team, setTeam] = useState('Army')
  const [name, setName] = useState('')
  const [urg, setUrg] = useState('Medium')
  const [dmo, setDmo] = useState('')
  const [sp, setSp] = useState('')
  const [er, setEr] = useState('')
  const [notes, setNotes] = useState('Victim: ' + (u.name || '—') + '\nPhone: ' + (u.phone || '—') + '\nDisaster: ' + String(r?.hazardType || '—') + '\nDetails: ' + (r?.description || '—'))
  const go = () => { if (!name.trim()) { setEr('Team name required.'); return } if (!dmo.trim()) { setEr('DMO contact required.'); return } onSave({ team, teamName: name.trim(), urgent: urg, dmoContact: dmo.trim(), notes, special: sp }) }
  const inp = 'mt-1 w-full rounded-xl border px-3 py-2.5 text-sm'
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between"><h2 className="text-xl font-extrabold">Assign Response Team</h2><button type="button" onClick={onClose} className="rounded-lg border border-blue-500 px-4 py-1 text-sm text-blue-600">Close</button></div>
        <label className="mt-4 block text-xs font-bold text-slate-500">Select Team</label>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={inp}>{['Army', 'Police', 'Fire Brigade'].map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <label className="mt-4 block text-xs font-bold text-slate-500">Team Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alpha Squad" className={inp} />
        <label className="mt-4 block text-xs font-bold text-slate-500">Urgent Level</label>
        <select value={urg} onChange={(e) => setUrg(e.target.value)} className={inp}>{['Low', 'Medium', 'High', 'Critical'].map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <label className="mt-4 block text-xs font-bold text-slate-500">DMO Contact No</label>
        <input value={dmo} onChange={(e) => setDmo(e.target.value)} placeholder="e.g., 0712345678" className={inp} />
        <label className="mt-4 block text-xs font-bold text-slate-500">Deployment Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className={inp} />
        <label className="mt-4 block text-xs font-bold text-slate-500">Special Instructions</label>
        <textarea value={sp} onChange={(e) => setSp(e.target.value)} rows={3} placeholder="Any special orders for the team" className={inp} />
        {er && <p className="mt-2 text-sm font-semibold text-red-600">{er}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-500 px-4 py-1.5 text-sm text-blue-600">Cancel</button>
          <button type="button" onClick={go} className="rounded-lg border px-5 py-1.5 text-sm font-semibold">Assign</button>
        </div>
      </div>
    </div>
  )
}
