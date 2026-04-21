import { useState } from 'react';
import { Map, Settings, ChevronLeft, Plus, X, ExternalLink } from 'lucide-react';
import { DEMO_TRIPS, DEMO_DAYS, DEMO_DOCS, DEMO_STAYS } from './demoData';
import './index.css';

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function nights(a, b) {
  if (!a || !b) return '?';
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return isNaN(n) ? '?' : n;
}

function StatusBadge({ status }) {
  const m = { upcoming: ['badge-upcoming','Upcoming'], planning: ['badge-planning','Planning'], dream: ['badge-dream','Dream trip'], done: ['badge-done','Done'] };
  const [cls, label] = m[status] || ['badge-done', status];
  return <span className={`trip-status-badge ${cls}`}>{label}</span>;
}

function TypeBadge({ type }) {
  const c = { Flight:'var(--teal-light)', Train:'var(--amber-light)', Pass:'var(--rose-light)', Visa:'var(--rose-light)', Hotel:'var(--teal-light)', Airbnb:'var(--purple-light)' };
  return <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background: c[type]||'var(--paper-warm)', color:'var(--ink-mid)' }}>{type}</span>;
}

function Modal({ title, onClose, onSave, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-teal" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

function AddTripModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name:'', emoji:'✈️', status:'planning', destinations:'', startDate:'', endDate:'', budget:'', notes:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New trip" onClose={onClose} onSave={() => { onAdd({...f, id: Date.now().toString()}); onClose(); }}>
      <div className="form-row">
        <Field label="Flag / emoji"><input className="form-input" value={f.emoji} onChange={s('emoji')} placeholder="🇯🇵"/></Field>
        <Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>
          {['dream','planning','upcoming','done'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
        </select></Field>
      </div>
      <Field label="Trip name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Japan — Tokyo & Kyoto"/></Field>
      <Field label="Destinations"><input className="form-input" value={f.destinations} onChange={s('destinations')} placeholder="Tokyo, Kyoto"/></Field>
      <div className="form-row">
        <Field label="Start date"><input className="form-input" type="date" value={f.startDate} onChange={s('startDate')}/></Field>
        <Field label="End date"><input className="form-input" type="date" value={f.endDate} onChange={s('endDate')}/></Field>
      </div>
      <Field label="Budget"><input className="form-input" value={f.budget} onChange={s('budget')} placeholder="£2,500"/></Field>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Visa info, reminders..."/></Field>
    </Modal>
  );
}

function AddDayModal({ tripId, onClose, onAdd }) {
  const [f, setF] = useState({ dayNumber:'', date:'', title:'', location:'', morning:'', afternoon:'', evening:'', transport:'', notes:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New day" onClose={onClose} onSave={() => { onAdd({...f, id: Date.now().toString(), tripId}); onClose(); }}>
      <div className="form-row">
        <Field label="Day number"><input className="form-input" value={f.dayNumber} onChange={s('dayNumber')} placeholder="1"/></Field>
        <Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field>
      </div>
      <Field label="Day title / theme"><input className="form-input" value={f.title} onChange={s('title')} placeholder="Arrival — Shinjuku"/></Field>
      <Field label="City / location"><input className="form-input" value={f.location} onChange={s('location')} placeholder="Tokyo"/></Field>
      <Field label="☀️ Morning"><textarea className="form-textarea" value={f.morning} onChange={s('morning')} placeholder="09:00 Meiji Shrine · 10:30 Harajuku..."/></Field>
      <Field label="🌤 Afternoon"><textarea className="form-textarea" value={f.afternoon} onChange={s('afternoon')} placeholder="13:00 Lunch at Afuri · 15:00 Shibuya..."/></Field>
      <Field label="🌙 Evening"><textarea className="form-textarea" value={f.evening} onChange={s('evening')} placeholder="19:00 Dinner at Ichiran..."/></Field>
      <Field label="Transport"><input className="form-input" value={f.transport} onChange={s('transport')} placeholder="Yamanote Line day pass"/></Field>
      <Field label="Notes / tips"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Opening hours, pre-book..."/></Field>
    </Modal>
  );
}

function AddDocModal({ tripId, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', type:'Flight', date:'', time:'', ref:'', fromTo:'', operator:'', details:'', cost:'', status:'Confirmed' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New ticket / document" onClose={onClose} onSave={() => { onAdd({...f, id: Date.now().toString(), tripId}); onClose(); }}>
      <div className="form-row">
        <Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>
          {['Flight','Train','Bus','Ferry','Visa','Pass','Other'].map(t => <option key={t}>{t}</option>)}
        </select></Field>
        <Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>
          {['Pending','Confirmed','Checked in','Used'].map(t => <option key={t}>{t}</option>)}
        </select></Field>
      </div>
      <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="BA178 — London to Tokyo"/></Field>
      <div className="form-row">
        <Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field>
        <Field label="Time"><input className="form-input" type="time" value={f.time} onChange={s('time')}/></Field>
      </div>
      <Field label="From → To"><input className="form-input" value={f.fromTo} onChange={s('fromTo')} placeholder="LHR → NRT"/></Field>
      <div className="form-row">
        <Field label="Operator"><input className="form-input" value={f.operator} onChange={s('operator')} placeholder="British Airways"/></Field>
        <Field label="Ref / confirmation"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="XY7GH2"/></Field>
      </div>
      <Field label="Seat / details"><input className="form-input" value={f.details} onChange={s('details')} placeholder="Seat 34A · 1 checked bag"/></Field>
      <Field label="Cost"><input className="form-input" value={f.cost} onChange={s('cost')} placeholder="£680"/></Field>
    </Modal>
  );
}

function AddStayModal({ tripId, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', type:'Hotel', checkIn:'', checkOut:'', address:'', mapsUrl:'', ref:'', cost:'', paid:'No', checkInNotes:'', extras:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New stay" onClose={onClose} onSave={() => { onAdd({...f, id: Date.now().toString(), tripId}); onClose(); }}>
      <div className="form-row">
        <Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>
          {['Hotel','Airbnb','Hostel','Rental','Other'].map(t => <option key={t}>{t}</option>)}
        </select></Field>
        <Field label="Prepaid?"><select className="form-select" value={f.paid} onChange={s('paid')}>
          <option value="Yes">Yes — prepaid</option>
          <option value="No">Pay on arrival</option>
        </select></Field>
      </div>
      <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Ace Hotel Tokyo"/></Field>
      <div className="form-row">
        <Field label="Check-in"><input className="form-input" type="date" value={f.checkIn} onChange={s('checkIn')}/></Field>
        <Field label="Check-out"><input className="form-input" type="date" value={f.checkOut} onChange={s('checkOut')}/></Field>
      </div>
      <Field label="Address"><input className="form-input" value={f.address} onChange={s('address')} placeholder="Full address"/></Field>
      <Field label="Google Maps link"><input className="form-input" value={f.mapsUrl} onChange={s('mapsUrl')} placeholder="https://maps.google.com/..."/></Field>
      <div className="form-row">
        <Field label="Confirmation ref"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="ACE-449012"/></Field>
        <Field label="Total cost"><input className="form-input" value={f.cost} onChange={s('cost')} placeholder="£860"/></Field>
      </div>
      <Field label="Check-in notes"><textarea className="form-textarea" value={f.checkInNotes} onChange={s('checkInNotes')} placeholder="Key code, self check-in..."/></Field>
      <Field label="Extras"><input className="form-input" value={f.extras} onChange={s('extras')} placeholder="Wifi: GuestNet · Breakfast included"/></Field>
    </Modal>
  );
}

function parsePeriod(text) {
  if (!text) return [];
  return text.split('·').map(seg => {
    const seg2 = seg.trim();
    const m = seg2.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m ? { time: m[1], content: m[2] } : { time: '', content: seg2 };
  }).filter(x => x.content);
}

function DaysView({ tripId, days, onAddDay }) {
  const tripDays = days.filter(d => d.tripId === tripId).sort((a,b) => Number(a.dayNumber)-Number(b.dayNumber));
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add day</button>
      </div>
      {tripDays.length === 0
        ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days yet</h3><p>Add your day-by-day itinerary above.</p></div>
        : <div className="days-list">
          {tripDays.map(day => (
            <div key={day.id} className="day-card" onClick={() => setExpanded(expanded===day.id ? null : day.id)}>
              <div className="day-card-header">
                <div className="day-number">{day.dayNumber}</div>
                <div className="day-card-meta">
                  <div className="day-card-title">{day.title || `Day ${day.dayNumber}`}</div>
                  <div className="day-card-date">{fmt(day.date)}{day.location ? ` · ${day.location}` : ''}</div>
                </div>
                <span style={{ fontSize:12, color:'var(--ink-faint)', marginLeft:'auto', paddingLeft:8 }}>{expanded===day.id ? '▲' : '▼'}</span>
              </div>
              {expanded===day.id && (
                <div className="day-card-body">
                  {[['☀️ Morning', day.morning], ['🌤 Afternoon', day.afternoon], ['🌙 Evening', day.evening]].map(([label, text]) =>
                    text ? (
                      <div key={label}>
                        <div className="period-label">{label}</div>
                        {parsePeriod(text).map((slot, i) => (
                          <div key={i} className="time-slot">
                            <span className="time-label">{slot.time}</span>
                            <span className="time-content">{slot.content}</span>
                          </div>
                        ))}
                      </div>
                    ) : null
                  )}
                  {(day.transport || day.notes) && (
                    <div style={{ marginTop:12, padding:'10px 12px', background:'var(--paper-warm)', borderRadius:8, fontSize:12, color:'var(--ink-mid)', lineHeight:1.6 }}>
                      {day.transport && <div><strong>Transport:</strong> {day.transport}</div>}
                      {day.notes && <div style={{ marginTop:4 }}><strong>Notes:</strong> {day.notes}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      }
      {showAdd && <AddDayModal tripId={tripId} onClose={() => setShowAdd(false)} onAdd={d => { onAddDay(d); setShowAdd(false); }}/>}
    </>
  );
}

function DocsView({ tripId, docs, onAddDoc }) {
  const tripDocs = docs.filter(d => d.tripId===tripId).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const [showAdd, setShowAdd] = useState(false);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add ticket</button>
      </div>
      {tripDocs.length === 0
        ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>No documents yet</h3><p>Add flights, trains, passes and visas here.</p></div>
        : <div className="card" style={{ overflow:'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Cost</th><th>Status</th></tr></thead>
            <tbody>
              {tripDocs.map(doc => (
                <tr key={doc.id}>
                  <td><div className="td-primary">{doc.name}</div><div style={{marginTop:3}}><TypeBadge type={doc.type}/></div></td>
                  <td>{fmt(doc.date)}{doc.time ? ` · ${doc.time}` : ''}</td>
                  <td>{doc.fromTo||'—'}</td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{doc.ref||'—'}</td>
                  <td>{doc.cost||'—'}</td>
                  <td><span style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background: doc.status==='Confirmed'?'var(--teal-light)':'var(--paper-warm)', color: doc.status==='Confirmed'?'var(--teal)':'var(--ink-mid)' }}>{doc.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      {showAdd && <AddDocModal tripId={tripId} onClose={() => setShowAdd(false)} onAdd={d => { onAddDoc(d); setShowAdd(false); }}/>}
    </>
  );
}

function StaysView({ tripId, stays, onAddStay }) {
  const tripStays = stays.filter(s => s.tripId===tripId).sort((a,b) => (a.checkIn||'').localeCompare(b.checkIn||''));
  const [showAdd, setShowAdd] = useState(false);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add stay</button>
      </div>
      {tripStays.length === 0
        ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>No stays yet</h3><p>Add your hotels and Airbnbs here.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {tripStays.map(stay => (
            <div key={stay.id} className="card" style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:600, color:'var(--ink)' }}>{stay.name}</div>
                  <div style={{ fontSize:12, color:'var(--ink-light)', marginTop:2 }}>{fmt(stay.checkIn)} → {fmt(stay.checkOut)} · {nights(stay.checkIn, stay.checkOut)} nights</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <TypeBadge type={stay.type}/>
                  {stay.mapsUrl && <a href={stay.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open in Maps"><ExternalLink size={13}/></a>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12, color:'var(--ink-mid)' }}>
                {stay.address && <div><span style={{color:'var(--ink-light)'}}>Address</span><br/>{stay.address}</div>}
                {stay.ref && <div><span style={{color:'var(--ink-light)'}}>Confirmation</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{stay.ref}</span></div>}
                {stay.cost && <div><span style={{color:'var(--ink-light)'}}>Cost</span><br/>{stay.cost} · {stay.paid==='Yes'?'✓ Prepaid':'Pay on arrival'}</div>}
                {stay.extras && <div><span style={{color:'var(--ink-light)'}}>Extras</span><br/>{stay.extras}</div>}
              </div>
              {stay.checkInNotes && (
                <div style={{ marginTop:10, padding:'8px 12px', background:'var(--amber-light)', borderRadius:8, fontSize:12, color:'var(--amber)' }}>
                  <strong>Check-in:</strong> {stay.checkInNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      }
      {showAdd && <AddStayModal tripId={tripId} onClose={() => setShowAdd(false)} onAdd={s => { onAddStay(s); setShowAdd(false); }}/>}
    </>
  );
}

function TripDetail({ trip, days, docs, stays, onBack, onAddDay, onAddDoc, onAddStay }) {
  const [tab, setTab] = useState('itinerary');
  const n = nights(trip.startDate, trip.endDate);
  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="back-btn" onClick={onBack}><ChevronLeft size={15}/> All trips</button>
            <span style={{ fontSize:28 }}>{trip.emoji}</span>
            <div>
              <div className="detail-title">{trip.name}</div>
              <div className="detail-meta">
                {trip.startDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)} · ${n} nights` : 'No dates set'}
                {trip.budget ? ` · ${trip.budget}` : ''}
              </div>
            </div>
          </div>
        </div>
        <StatusBadge status={trip.status}/>
      </div>
      <div className="content-area">
        <div className="summary-row">
          {[
            ['Days planned', days.filter(d=>d.tripId===trip.id).length, `of ${n} nights`],
            ['Tickets', docs.filter(d=>d.tripId===trip.id).length, 'flights, trains & passes'],
            ['Stays', stays.filter(s=>s.tripId===trip.id).length, 'accommodation bookings'],
          ].map(([label, val, sub]) => (
            <div key={label} className="summary-card">
              <div className="summary-label">{label}</div>
              <div className="summary-value">{val}</div>
              <div className="summary-sub">{sub}</div>
            </div>
          ))}
        </div>
        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['tickets','🎫 Tickets & docs'],['stays','🏨 Stays']].map(([key,label]) => (
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {tab==='itinerary' && <DaysView tripId={trip.id} days={days} onAddDay={onAddDay}/>}
        {tab==='tickets'   && <DocsView tripId={trip.id} docs={docs} onAddDoc={onAddDoc}/>}
        {tab==='stays'     && <StaysView tripId={trip.id} stays={stays} onAddStay={onAddStay}/>}
      </div>
    </>
  );
}

function TripsView({ trips, days, docs, stays, onSelect, onAdd }) {
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const filtered = trips.filter(t => filter==='all' || t.status===filter);
  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><h1>All trips</h1><p>{trips.length} trips total</p></div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14}/> New trip</button>
        </div>
      </div>
      <div className="content-area">
        <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
          {[['all','All'],['upcoming','Upcoming'],['planning','Planning'],['dream','Dream'],['done','Done']].map(([key,label]) => (
            <button key={key} onClick={() => setFilter(key)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, border:'1px solid var(--border-mid)', background: filter===key?'var(--ink)':'var(--paper-card)', color: filter===key?'var(--paper)':'var(--ink-mid)', cursor:'pointer', fontFamily:'var(--font-body)' }}>{label}</button>
          ))}
        </div>
        {filtered.length===0
          ? <div className="empty-state"><div className="empty-icon">🌍</div><h3>No trips yet</h3><p>Add your first trip to get started.</p></div>
          : <div className="trips-grid">
            {filtered.map(trip => (
              <div key={trip.id} className="trip-card" onClick={() => onSelect(trip)}>
                <div className={`trip-card-header ${trip.status}`}>
                  <span className="trip-flag">{trip.emoji}</span>
                  <StatusBadge status={trip.status}/>
                </div>
                <div className="trip-card-body">
                  <div className="trip-card-name">{trip.name}</div>
                  <div className="trip-card-dates">{trip.startDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)}` : 'No dates set'}</div>
                  <div className="trip-chips">
                    {days.filter(d=>d.tripId===trip.id).length>0 && <span className="chip">📅 {days.filter(d=>d.tripId===trip.id).length} days</span>}
                    {docs.filter(d=>d.tripId===trip.id).length>0 && <span className="chip">🎫 {docs.filter(d=>d.tripId===trip.id).length} tickets</span>}
                    {stays.filter(s=>s.tripId===trip.id).length>0 && <span className="chip">🏨 {stays.filter(s=>s.tripId===trip.id).length} stays</span>}
                    {trip.budget && <span className="chip">💰 {trip.budget}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
      {showAdd && <AddTripModal onClose={() => setShowAdd(false)} onAdd={t => { onAdd(t); setShowAdd(false); }}/>}
    </>
  );
}

function SettingsView({ sheetsId, onSave }) {
  const [id, setId] = useState(sheetsId||'');
  return (
    <>
      <div className="topbar"><div className="topbar-left"><h1>Settings</h1><p>Connect Google Sheets for cross-device sync</p></div></div>
      <div className="content-area">
        <div className="setup-wrap">
          <div className="setup-card">
            <h2>Connect Google Sheets</h2>
            <p>Your data lives in a Google Sheet you own — nothing stored elsewhere. Same sheet works on any device.</p>
            <div className="step-list">
              {[
                ['1','Go to sheets.google.com and create a new spreadsheet named Wander'],
                ['2','Create 4 tabs named exactly: Trips, Days, Documents, Stays'],
                ['3','Add headers to each sheet — see the column reference below'],
                ['4','File → Share → Publish to web → each sheet → CSV → Publish'],
                ['5','Copy the spreadsheet ID from the URL bar and paste it below'],
              ].map(([n,t]) => (
                <div key={n} className="step-item">
                  <div className="step-num">{n}</div>
                  <div className="step-text">{t}</div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Spreadsheet ID</label>
              <div className="url-input-row">
                <input className="form-input" value={id} onChange={e=>setId(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"/>
                <button className="btn btn-teal" onClick={() => onSave(id)}>Connect</button>
              </div>
            </div>
            <div style={{ background:'var(--paper-warm)', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:12, color:'var(--ink-mid)', lineHeight:1.9 }}>
              <strong style={{ display:'block', marginBottom:6 }}>Column headers per sheet:</strong>
              <div><strong>Trips:</strong> id, name, emoji, status, destinations, startDate, endDate, budget, notes</div>
              <div><strong>Days:</strong> id, tripId, dayNumber, date, title, location, morning, afternoon, evening, transport, notes</div>
              <div><strong>Documents:</strong> id, tripId, name, type, date, time, ref, fromTo, operator, details, cost, status</div>
              <div><strong>Stays:</strong> id, tripId, name, type, checkIn, checkOut, address, mapsUrl, ref, cost, paid, checkInNotes, extras</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const STORAGE_KEY = 'wander_v1';
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

export default function App() {
  const saved = loadLocal();
  const [trips,  setTrips]  = useState(saved?.trips  || DEMO_TRIPS);
  const [days,   setDays]   = useState(saved?.days   || DEMO_DAYS);
  const [docs,   setDocs]   = useState(saved?.docs   || DEMO_DOCS);
  const [stays,  setStays]  = useState(saved?.stays  || DEMO_STAYS);
  const [sheetsId, setSheetsId] = useState(saved?.sheetsId||'');
  const [view, setView] = useState('trips');
  const [selectedTrip, setSelectedTrip] = useState(null);

  function persist(u) {
    const next = { trips, days, docs, stays, sheetsId, ...u };
    saveLocal(next);
    if (u.trips)   setTrips(u.trips);
    if (u.days)    setDays(u.days);
    if (u.docs)    setDocs(u.docs);
    if (u.stays)   setStays(u.stays);
    if (u.sheetsId !== undefined) setSheetsId(u.sheetsId);
  }

  const addTrip  = t => persist({ trips:  [...trips,  t] });
  const addDay   = d => persist({ days:   [...days,   d] });
  const addDoc   = d => persist({ docs:   [...docs,   d] });
  const addStay  = s => persist({ stays:  [...stays,  s] });
  const navTo    = v => { setView(v); setSelectedTrip(null); };

  const activeTrips = trips.filter(t => t.status==='upcoming'||t.status==='planning');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-wordmark">Wander</div>
          <div className="logo-tagline">Your travel space</div>
        </div>
        <div className="nav-section-label">Navigate</div>
        <button className={`nav-item ${view==='trips'&&!selectedTrip?'active':''}`} onClick={() => navTo('trips')}><Map size={15}/>All trips</button>
        <button className={`nav-item ${view==='settings'?'active':''}`} onClick={() => navTo('settings')}><Settings size={15}/>Google Sheets</button>
        {activeTrips.length > 0 && <>
          <div className="nav-section-label">Active trips</div>
          {activeTrips.slice(0,5).map(t => (
            <button key={t.id} className={`nav-item ${selectedTrip?.id===t.id?'active':''}`}
              onClick={() => { setSelectedTrip(t); setView('trip'); }}>
              <span style={{fontSize:14}}>{t.emoji}</span>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
            </button>
          ))}
        </>}
        <div className="sidebar-footer">Data saved locally<br/>+ Google Sheets sync</div>
      </aside>
      <main className="main">
        {selectedTrip
          ? <TripDetail trip={selectedTrip} days={days} docs={docs} stays={stays}
              onBack={() => { setSelectedTrip(null); setView('trips'); }}
              onAddDay={addDay} onAddDoc={addDoc} onAddStay={addStay}/>
          : view==='trips'
            ? <TripsView trips={trips} days={days} docs={docs} stays={stays}
                onSelect={t => { setSelectedTrip(t); setView('trip'); }} onAdd={addTrip}/>
            : view==='settings'
              ? <SettingsView sheetsId={sheetsId} onSave={id => persist({ sheetsId: id })}/>
              : null
        }
      </main>
    </div>
  );
}
