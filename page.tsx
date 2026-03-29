'use client'
// app/page.tsx
// Main Dento Egypt clinic app - connects to real Supabase database

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../lib/supabase'

const supabase = createClient()

type Patient = {
  id: string; first_name: string; last_name: string
  phone: string; age: number; status: string; notes: string; created_at: string
}
type Appointment = {
  id: string; patient_id: string; date: string; time: string
  treatment: string; doctor: string; status: string
  patients?: { first_name: string; last_name: string; phone: string }
}
type Payment = {
  id: string; patient_id: string; treatment: string
  amount: number; status: string; date: string
  patients?: { first_name: string; last_name: string }
}

const DOCTORS = ['Dr. Ahmed Samy', 'Dr. Hana Nour', 'Dr. Omar Fares']
const TREATMENTS = ['Routine Checkup','Teeth Cleaning','Filling','Root Canal','Extraction','Crown','Braces Adjustment','Whitening']
const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00']

function today() { return new Date().toISOString().slice(0, 10) }
function pname(p?: { first_name: string; last_name: string }) { return p ? `${p.first_name} ${p.last_name}` : '—' }
function initials(fn = '', ln = '') { return (fn[0] || '') + (ln[0] || '') }

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800', Inactive: 'bg-amber-100 text-amber-800',
    Confirmed: 'bg-emerald-100 text-emerald-800', Pending: 'bg-amber-100 text-amber-800',
    Cancelled: 'bg-red-100 text-red-800', Paid: 'bg-emerald-100 text-emerald-800', Partial: 'bg-amber-100 text-amber-800',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-blue-100 text-blue-800'}`}>{status}</span>
}

export default function DentoApp() {
  const [page, setPage] = useState('dashboard')
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<Appointment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [search, setSearch] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [modal, setModal] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [smsStatus, setSmsStatus] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [p, a, pay] = await Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, patients(first_name, last_name, phone)').order('date').order('time'),
      supabase.from('payments').select('*, patients(first_name, last_name)').order('date', { ascending: false }),
    ])
    if (p.data) setPatients(p.data)
    if (a.data) setAppts(a.data)
    if (pay.data) setPayments(pay.data)
  }, [])

  useEffect(() => { load() }, [load])

  function goTo(p: string, id?: string) {
    setPage(p)
    if (id) setProfileId(id)
    setSearch('')
  }

  function openModal(type: string, item?: any) {
    setModal(type)
    setEditItem(item || null)
    setForm(item ? { ...item } : { status: type === 'patient' ? 'Active' : type === 'appt' ? 'Pending' : 'Pending', date: today(), doctor: DOCTORS[0], treatment: TREATMENTS[0], time: TIMES[0] })
  }
  function closeModal() { setModal(null); setEditItem(null); setForm({}) }

  async function savePatient() {
    if (!form.first_name || !form.last_name) return
    setLoading(true)
    if (editItem) {
      await supabase.from('patients').update({ first_name: form.first_name, last_name: form.last_name, phone: form.phone, age: form.age, status: form.status, notes: form.notes }).eq('id', editItem.id)
    } else {
      await supabase.from('patients').insert({ first_name: form.first_name, last_name: form.last_name, phone: form.phone, age: form.age, status: form.status || 'Active', notes: form.notes || '' })
    }
    await load(); closeModal(); setLoading(false)
  }

  async function saveAppt() {
    if (!form.patient_id) return
    setLoading(true)
    if (editItem) {
      await supabase.from('appointments').update({ patient_id: form.patient_id, date: form.date, time: form.time, treatment: form.treatment, doctor: form.doctor, status: form.status }).eq('id', editItem.id)
    } else {
      await supabase.from('appointments').insert({ patient_id: form.patient_id, date: form.date, time: form.time, treatment: form.treatment, doctor: form.doctor, status: form.status || 'Pending' })
    }
    await load(); closeModal(); setLoading(false)
  }

  async function savePayment() {
    if (!form.patient_id || !form.amount) return
    setLoading(true)
    if (editItem) {
      await supabase.from('payments').update({ patient_id: form.patient_id, treatment: form.treatment, amount: form.amount, status: form.status }).eq('id', editItem.id)
    } else {
      await supabase.from('payments').insert({ patient_id: form.patient_id, treatment: form.treatment, amount: Number(form.amount), status: form.status || 'Pending', date: today() })
    }
    await load(); closeModal(); setLoading(false)
  }

  async function deleteItem(table: string, id: string) {
    if (!confirm('Delete this record?')) return
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  async function sendSMS(apptId: string) {
    setSmsStatus(s => ({ ...s, [apptId]: 'sending' }))
    const res = await fetch('/api/sms-reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: apptId })
    })
    setSmsStatus(s => ({ ...s, [apptId]: res.ok ? 'sent' : 'failed' }))
    setTimeout(() => setSmsStatus(s => { const n = { ...s }; delete n[apptId]; return n }), 3000)
  }

  function printInvoice(p: Payment) {
    const pat = patients.find(x => x.id === p.patient_id)
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>Invoice</title><style>
      body{font-family:sans-serif;padding:40px;max-width:520px;margin:auto;color:#111}
      h2{margin-bottom:4px}.sub{color:#888;font-size:13px;margin-bottom:24px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
      .total{font-weight:600;font-size:16px}.badge{background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:20px;font-size:12px}
    </style></head><body>
      <h2>Dento Egypt</h2><div class="sub">Dental Clinic — Cairo, Egypt</div>
      <div class="row"><span>Invoice #</span><span>#INV-${p.id.slice(-6).toUpperCase()}</span></div>
      <div class="row"><span>Date</span><span>${p.date}</span></div>
      <div class="row"><span>Patient</span><span>${pname(pat)}</span></div>
      <div class="row"><span>Phone</span><span>${pat?.phone || ''}</span></div>
      <div class="row"><span>Treatment</span><span>${p.treatment}</span></div>
      <div class="row total"><span>Total</span><span>${Number(p.amount).toLocaleString()} EGP</span></div>
      <div style="margin-top:12px"><span class="badge">${p.status}</span></div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  // Derived data
  const todayAppts = appts.filter(a => a.date === today())
  const profile = patients.find(p => p.id === profileId)
  const filteredPatients = patients.filter(p => (p.first_name + ' ' + p.last_name).toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search))

  const F = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--color-background-tertiary, #f5f5f3)' }}>

      {/* SIDEBAR */}
      <div style={{ width: 200, background: 'var(--color-background-secondary)', borderRight: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 20px', fontSize: 15, fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 8 }}>
          Dento Egypt<span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginTop: 2 }}>Clinic Manager</span>
        </div>
        {[['dashboard','⊟','Dashboard'],['patients','✎','Patients'],['appointments','📅','Appointments'],['payments','💵','Payments']].map(([id, icon, label]) => (
          <div key={id} onClick={() => goTo(id)} style={{ padding: '9px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: page === id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: page === id ? 500 : 400, background: page === id ? 'var(--color-background-primary)' : 'transparent', borderRight: page === id ? '2px solid #1D9E75' : 'none' }}>
            {icon} {label}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* DASHBOARD */}
        {page === 'dashboard' && <>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Today's Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[['Total Patients', patients.length], ["Today's Appointments", todayAppts.length], ['Monthly Revenue', payments.filter(p => p.status === 'Paid').reduce((s, p) => s + Number(p.amount), 0).toLocaleString() + ' EGP'], ['Pending Payments', payments.filter(p => p.status === 'Pending').length]].map(([label, val]) => (
              <div key={label as string} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Today's Schedule</div>
            {todayAppts.length === 0 ? <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 20 }}>No appointments today</div>
              : todayAppts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, minWidth: 50 }}>{a.time}</span>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>{initials(a.patients?.first_name, a.patients?.last_name)}</div>
                  <span style={{ flex: 1 }}>{pname(a.patients)}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{a.treatment}</span>
                  <Badge status={a.status} />
                </div>
              ))}
          </div>
        </>}

        {/* PATIENTS */}
        {page === 'patients' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Patients</div>
            <button onClick={() => openModal('patient')} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>+ Add Patient</button>
          </div>
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, marginBottom: 12, fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>{['Name','Phone','Age','Status','Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--color-text-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', fontWeight: 400 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredPatients.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <span onClick={() => goTo('profile', p.id)} style={{ color: '#1D9E75', cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>{initials(p.first_name, p.last_name)}</span>
                      {p.first_name} {p.last_name}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{p.phone}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{p.age}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}><Badge status={p.status} /></td>
                  <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openModal('patient', p)} style={btnStyle}>Edit</button>
                      <button onClick={() => deleteItem('patients', p.id)} style={{ ...btnStyle, color: '#A32D2D', borderColor: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        {/* PROFILE */}
        {page === 'profile' && profile && <>
          <div onClick={() => goTo('patients')} style={{ color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>← Back to Patients</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500 }}>{initials(profile.first_name, profile.last_name)}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{profile.first_name} {profile.last_name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>{profile.phone} · Age {profile.age} · <Badge status={profile.status} /></div>
              {profile.notes && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>{profile.notes}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Treatment History</div>
              {appts.filter(a => a.patient_id === profileId).sort((a, b) => b.date.localeCompare(a.date)).map((a, i, arr) => (
                <div key={a.id} style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75', marginTop: 4, flexShrink: 0 }} />
                    {i < arr.length - 1 && <div style={{ width: 1, background: 'var(--color-border-tertiary)', flex: 1, marginTop: 4 }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{a.treatment}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{a.date} · {a.doctor}</div>
                    <div style={{ marginTop: 3 }}><Badge status={a.status} /></div>
                  </div>
                </div>
              ))}
              {appts.filter(a => a.patient_id === profileId).length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No treatments yet</div>}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Invoices</div>
              {payments.filter(p => p.patient_id === profileId).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.treatment}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 500 }}>{Number(p.amount).toLocaleString()} EGP</div>
                    <Badge status={p.status} />
                  </div>
                </div>
              ))}
              {payments.filter(p => p.patient_id === profileId).length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No invoices yet</div>}
            </div>
          </div>
        </>}

        {/* APPOINTMENTS */}
        {page === 'appointments' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Appointments</div>
            <button onClick={() => openModal('appt')} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>+ New Appointment</button>
          </div>
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>{['Date','Time','Patient','Treatment','Doctor','Status','SMS','Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--color-text-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', fontWeight: 400 }}>{h}</th>)}</tr></thead>
              <tbody>{appts.map(a => (
                <tr key={a.id}>
                  {[a.date, a.time].map((v, i) => <td key={i} style={tdStyle}>{v}</td>)}
                  <td style={tdStyle}><span onClick={() => goTo('profile', a.patient_id)} style={{ color: '#1D9E75', cursor: 'pointer', textDecoration: 'underline' }}>{pname(a.patients)}</span></td>
                  {[a.treatment, a.doctor].map((v, i) => <td key={i} style={tdStyle}>{v}</td>)}
                  <td style={tdStyle}><Badge status={a.status} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => sendSMS(a.id)} style={{ ...btnStyle, fontSize: 11 }}>
                      {smsStatus[a.id] === 'sending' ? '...' : smsStatus[a.id] === 'sent' ? '✓ Sent' : smsStatus[a.id] === 'failed' ? '✗ Failed' : '📱 Send'}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openModal('appt', a)} style={btnStyle}>Edit</button>
                      <button onClick={() => deleteItem('appointments', a.id)} style={{ ...btnStyle, color: '#A32D2D', borderColor: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        {/* PAYMENTS */}
        {page === 'payments' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Payments</div>
            <button onClick={() => openModal('payment')} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>+ New Invoice</button>
          </div>
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: 16 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>{['Invoice #','Patient','Treatment','Amount','Status','Date','Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--color-text-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', fontWeight: 400 }}>{h}</th>)}</tr></thead>
              <tbody>{payments.map(p => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>#INV-{p.id.slice(-6).toUpperCase()}</td>
                  <td style={tdStyle}><span onClick={() => goTo('profile', p.patient_id)} style={{ color: '#1D9E75', cursor: 'pointer', textDecoration: 'underline' }}>{pname(p.patients)}</span></td>
                  <td style={tdStyle}>{p.treatment}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{Number(p.amount).toLocaleString()} EGP</td>
                  <td style={tdStyle}><Badge status={p.status} /></td>
                  <td style={tdStyle}>{p.date}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => printInvoice(p)} style={btnStyle}>PDF</button>
                      <button onClick={() => openModal('payment', p)} style={btnStyle}>Edit</button>
                      <button onClick={() => deleteItem('payments', p.id)} style={{ ...btnStyle, color: '#A32D2D', borderColor: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}
      </div>

      {/* MODALS */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ background: 'var(--color-background-primary)', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)', padding: 20, width: 480, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>

            {modal === 'patient' && <>
              <div style={modalTitle}>{editItem ? 'Edit Patient' : 'Add New Patient'}</div>
              <div style={formGrid}>
                <Field label="First Name"><input value={form.first_name || ''} onChange={F('first_name')} style={inputStyle} /></Field>
                <Field label="Last Name"><input value={form.last_name || ''} onChange={F('last_name')} style={inputStyle} /></Field>
                <Field label="Phone"><input value={form.phone || ''} onChange={F('phone')} style={inputStyle} /></Field>
                <Field label="Age"><input type="number" value={form.age || ''} onChange={F('age')} style={inputStyle} /></Field>
                <Field label="Status">
                  <select value={form.status || 'Active'} onChange={F('status')} style={inputStyle}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
                <Field label="Notes" full><textarea value={form.notes || ''} onChange={F('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              </div>
              <div style={footerStyle}>
                <button onClick={closeModal} style={btnStyle}>Cancel</button>
                <button onClick={savePatient} disabled={loading} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Patient'}</button>
              </div>
            </>}

            {modal === 'appt' && <>
              <div style={modalTitle}>{editItem ? 'Edit Appointment' : 'New Appointment'}</div>
              <div style={formGrid}>
                <Field label="Patient">
                  <select value={form.patient_id || ''} onChange={F('patient_id')} style={inputStyle}>
                    <option value="">Select patient...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </Field>
                <Field label="Doctor">
                  <select value={form.doctor || DOCTORS[0]} onChange={F('doctor')} style={inputStyle}>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Date"><input type="date" value={form.date || today()} onChange={F('date')} style={inputStyle} /></Field>
                <Field label="Time">
                  <select value={form.time || TIMES[0]} onChange={F('time')} style={inputStyle}>
                    {TIMES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Treatment" full>
                  <select value={form.treatment || TREATMENTS[0]} onChange={F('treatment')} style={inputStyle}>
                    {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Status" full>
                  <select value={form.status || 'Pending'} onChange={F('status')} style={inputStyle}>
                    <option>Pending</option><option>Confirmed</option><option>Cancelled</option>
                  </select>
                </Field>
              </div>
              <div style={footerStyle}>
                <button onClick={closeModal} style={btnStyle}>Cancel</button>
                <button onClick={saveAppt} disabled={loading} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Appointment'}</button>
              </div>
            </>}

            {modal === 'payment' && <>
              <div style={modalTitle}>{editItem ? 'Edit Invoice' : 'New Invoice'}</div>
              <div style={formGrid}>
                <Field label="Patient">
                  <select value={form.patient_id || ''} onChange={F('patient_id')} style={inputStyle}>
                    <option value="">Select patient...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </Field>
                <Field label="Treatment">
                  <select value={form.treatment || TREATMENTS[0]} onChange={F('treatment')} style={inputStyle}>
                    {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Amount (EGP)"><input type="number" value={form.amount || ''} onChange={F('amount')} style={inputStyle} /></Field>
                <Field label="Status">
                  <select value={form.status || 'Pending'} onChange={F('status')} style={inputStyle}>
                    <option>Paid</option><option>Pending</option><option>Partial</option>
                  </select>
                </Field>
              </div>
              <div style={footerStyle}>
                <button onClick={closeModal} style={btnStyle}>Cancel</button>
                <button onClick={savePayment} disabled={loading} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Invoice'}</button>
              </div>
            </>}

          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1/-1' : undefined }}>
      <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
const btnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 12, cursor: 'pointer' }
const tdStyle: React.CSSProperties = { padding: '9px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-primary)' }
const modalTitle: React.CSSProperties = { fontSize: 15, fontWeight: 500, marginBottom: 16 }
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }
