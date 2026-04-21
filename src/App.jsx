import { useState, useMemo } from 'react';
import { Map, Settings, ChevronLeft, Plus, X, ExternalLink, MapPin, Navigation, Search, Users } from 'lucide-react';
import { DEMO_TRIPS, DEMO_DAYS, DEMO_DOCS, DEMO_STAYS, DEMO_PLACES, DEMO_PERSONNELS } from './demoData';
import './index.css';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}
function nights(a, b) {
  if (!a || !b) return '?';
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return isNaN(n) ? '?' : n;
}
function matchesSearch(obj, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return Object.values(obj).some(v => String(v).toLowerCase().includes(lower));
}

const AVATAR_COLORS = [
  { bg:'#e8f5f0', color:'#1a7a5e' },
  { bg:'#f0edf8', color:'#5a4a8a' },
  { bg:'#fdf3e3', color:'#c47a1e' },
  { bg:'#fdf0ef', color:'#c0524a' },
  { bg:'#e6f1fb', color:'#185fa5' },
];
function avatarColor(name, i) { return AVATAR_COLORS[(name?.charCodeAt(0) || i) % AVATAR_COLORS.length]; }
function initials(name) { return name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?'; }

const CAT_COLORS = {
  Food:      { bg:'#fdf3e3', color:'#c47a1e', dot:'#c47a1e' },
  Sights:    { bg:'#e8f5f0', color:'#1a7a5e', dot:'#1a7a5e' },
  Activity:  { bg:'#f0edf8', color:'#5a4a8a', dot:'#5a4a8a' },
  Transport: { bg:'#f1efe8', color:'#8a8480', dot:'#8a8480' },
  Shopping:  { bg:'#fdf0ef', color:'#c0524a', dot:'#c0524a' },
  Stay:      { bg:'#e6f1fb', color:'#185fa5', dot:'#185fa5' },
  Other:     { bg:'#f3efe8', color:'#4a4640', dot:'#4a4640' },
};
function catStyle(cat) { return CAT_COLORS[cat] || CAT_COLORS.Other; }

// ── UI Atoms ───────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = { upcoming:['badge-upcoming','Upcoming'], planning:['badge-planning','Planning'], dream:['badge-dream','Dream trip'], done:['badge-done','Done'] };
  const [cls, label] = m[status] || ['badge-done', status];
  return <span className={`trip-status-badge ${cls}`}>{label}</span>;
}
function TypeBadge({ type }) {
  const c = { Flight:'var(--teal-light)', Train:'var(--amber-light)', Pass:'var(--rose-light)', Visa:'var(--rose-light)', Hotel:'var(--teal-light)', Airbnb:'var(--purple-light)' };
  return <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:c[type]||'var(--paper-warm)', color:'var(--ink-mid)' }}>{type}</span>;
}
function Avatar({ name, size=24, index=0 }) {
  const ac = avatarColor(name, index);
  return <span className="person-avatar" style={{ width:size, height:size, background:ac.bg, color:ac.color, fontSize: size*0.38 }}>{initials(name)}</span>;
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

// ── Search + Person Filter Bar ─────────────────────────────────────────────

function SearchFilterBar({ query, onQuery, persons, activePerson, onPerson }) {
  return (
    <div className="search-filter-bar">
      <div className="search-input-wrap">
        <Search size={14}/>
        <input className="search-input" placeholder="Search anything…" value={query} onChange={e => onQuery(e.target.value)}/>
      </div>
      {persons.length > 0 && (
        <div className="person-filter-pills">
          <button className={`person-pill ${!activePerson ? 'active' : ''}`} onClick={() => onPerson('')}>All</button>
          {persons.map((p, i) => (
            <button key={p.id} className={`person-pill ${activePerson===p.name ? 'active' : ''}`} onClick={() => onPerson(activePerson===p.name ? '' : p.name)}>
              <Avatar name={p.name} size={18} index={i}/> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Map Modal (shared) ─────────────────────────────────────────────────────

function MapModal({ title, subtitle, items, onClose }) {
  // items: [{ id, name, subtitle, lat, lng, mapsUrl, badge }]
  const [active, setActive] = useState(items[0]?.id || null);
  const activeItem = items.find(p => p.id === active);

  function buildEmbedUrl(item) {
    if (!item) return null;
    if (item.lat && item.lng) return `https://maps.google.com/maps?q=${item.lat},${item.lng}&z=15&output=embed`;
    if (item.mapsUrl) return `https://maps.google.com/maps?q=${encodeURIComponent(item.name)}&output=embed`;
    return null;
  }
  function buildDirectionsUrl() {
    const pts = items.filter(p => p.lat && p.lng);
    if (pts.length === 0) return null;
    if (pts.length === 1) return pts[0].mapsUrl || `https://maps.google.com/?q=${pts[0].lat},${pts[0].lng}`;
    const origin = `${pts[0].lat},${pts[0].lng}`;
    const dest = `${pts[pts.length-1].lat},${pts[pts.length-1].lng}`;
    const wps = pts.slice(1,-1).map(p=>`${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps?`&waypoints=${wps}`:''}`;
  }

  const embedUrl = buildEmbedUrl(activeItem);
  const directionsUrl = buildDirectionsUrl();

  return (
    <div className="map-modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="map-modal">
        <div className="map-modal-header">
          <div>
            <div className="map-modal-title">{title}</div>
            <div className="map-modal-sub">{subtitle}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn btn-teal btn-sm"><Navigation size={13}/> Route</a>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
          </div>
        </div>
        <div className="map-modal-body">
          <div className="map-sidebar">
            {items.map((item, i) => (
              <div key={item.id} className={`map-place-item ${active===item.id?'active':''}`} onClick={() => setActive(item.id)}>
                <div className="map-place-num" style={{ background: item.dotBg||'var(--teal-light)', color: item.dotColor||'var(--teal)' }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="map-place-name">{item.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    {item.subtitle && <span className="map-place-time">{item.subtitle}</span>}
                    {item.badge && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background: item.dotBg||'var(--teal-light)', color: item.dotColor||'var(--teal)', fontWeight:500 }}>{item.badge}</span>}
                  </div>
                  {item.notes && <div style={{ fontSize:11, color:'var(--ink-light)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.notes}</div>}
                </div>
                {item.mapsUrl && (
                  <a href={item.mapsUrl} target="_blank" rel="noreferrer" className="place-link" onClick={e=>e.stopPropagation()}><ExternalLink size={12}/></a>
                )}
              </div>
            ))}
          </div>
          <div className="map-frame-wrap">
            {embedUrl
              ? <iframe title="map" src={embedUrl} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
              : <div className="map-placeholder">
                  <div className="map-icon">🗺️</div>
                  <p>{activeItem
                    ? <>No coordinates for <strong>{activeItem.name}</strong>.<br/>{activeItem.mapsUrl && <a href={activeItem.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>}</>
                    : 'Select a location to view its map.'
                  }</p>
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Place Modal ────────────────────────────────────────────────────────

function AddPlaceModal({ tripId, dayId, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', time:'', category:'Food', mapsUrl:'', lat:'', lng:'', notes:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  function parseMapUrl(url) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) setF(p => ({...p, mapsUrl:url, lat:m[1], lng:m[2]}));
    else setF(p => ({...p, mapsUrl:url}));
  }
  return (
    <Modal title="Add place" onClose={onClose} onSave={() => { onAdd({...f, id:Date.now().toString(), tripId, dayId}); onClose(); }}>
      <Field label="Place name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Meiji Shrine"/></Field>
      <div className="form-row">
        <Field label="Time"><input className="form-input" type="time" value={f.time} onChange={s('time')}/></Field>
        <Field label="Category"><select className="form-select" value={f.category} onChange={s('category')}>{Object.keys(CAT_COLORS).map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <Field label="Google Maps link">
        <input className="form-input" value={f.mapsUrl} onChange={e=>parseMapUrl(e.target.value)} placeholder="Paste Google Maps URL — lat/lng auto-extracted"/>
      </Field>
      {(f.lat||f.lng) && <div style={{ fontSize:12, color:'var(--teal)', background:'var(--teal-light)', padding:'6px 10px', borderRadius:'var(--radius)' }}>✓ Coordinates found: {f.lat}, {f.lng}</div>}
      <div className="form-row">
        <Field label="Latitude"><input className="form-input" value={f.lat} onChange={s('lat')} placeholder="35.6764"/></Field>
        <Field label="Longitude"><input className="form-input" value={f.lng} onChange={s('lng')} placeholder="139.6993"/></Field>
      </div>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Book ahead, opening hours…"/></Field>
    </Modal>
  );
}

// ── Days View ──────────────────────────────────────────────────────────────

function parsePeriod(text) {
  if (!text) return [];
  return text.split('·').map(seg => {
    const seg2 = seg.trim();
    const m = seg2.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m ? { time:m[1], content:m[2] } : { time:'', content:seg2 };
  }).filter(x => x.content);
}

function DaysView({ tripId, days, places, onAddDay, onAddPlace }) {
  const tripDays = days.filter(d=>d.tripId===tripId).sort((a,b)=>Number(a.dayNumber)-Number(b.dayNumber));
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [mapDay, setMapDay] = useState(null);
  const mapItems = mapDay ? places.filter(p=>p.dayId===mapDay.id).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).map(p=>({ ...p, subtitle:p.time, badge:p.category, dotBg:catStyle(p.category).bg, dotColor:catStyle(p.category).color })) : [];

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add day</button>
      </div>
      {tripDays.length===0
        ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days yet</h3><p>Add your day-by-day itinerary above.</p></div>
        : <div className="days-list">
          {tripDays.map(day => {
            const dayPlaces = places.filter(p=>p.dayId===day.id).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
            return (
              <div key={day.id} className="day-card">
                <div className="day-card-header" onClick={()=>setExpanded(expanded===day.id?null:day.id)} style={{cursor:'pointer'}}>
                  <div className="day-number">{day.dayNumber}</div>
                  <div className="day-card-meta">
                    <div className="day-card-title">{day.title||`Day ${day.dayNumber}`}</div>
                    <div className="day-card-date">{fmt(day.date)}{day.location?` · ${day.location}`:''}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
                    {dayPlaces.length>0 && <button className="map-view-btn" onClick={e=>{e.stopPropagation();setMapDay(day);}} style={{ padding:'5px 10px', fontSize:12 }}><MapPin size={13}/> Map ({dayPlaces.length})</button>}
                    <span style={{ fontSize:12, color:'var(--ink-faint)' }}>{expanded===day.id?'▲':'▼'}</span>
                  </div>
                </div>
                {expanded===day.id && (
                  <div className="day-card-body">
                    {[['☀️ Morning',day.morning],['🌤 Afternoon',day.afternoon],['🌙 Evening',day.evening]].map(([label,text])=>
                      text ? (<div key={label}><div className="period-label">{label}</div>{parsePeriod(text).map((slot,i)=>(
                        <div key={i} className="time-slot"><span className="time-label">{slot.time}</span><span className="time-content">{slot.content}</span></div>
                      ))}</div>) : null
                    )}
                    <div style={{ marginTop:(day.morning||day.afternoon||day.evening)?16:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div className="period-label" style={{ margin:0, flex:1 }}>📍 Places</div>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'3px 8px', marginLeft:8 }} onClick={()=>setShowAdd({dayId:day.id})}><Plus size={11}/> Add place</button>
                      </div>
                      {dayPlaces.length===0
                        ? <div style={{ fontSize:12, color:'var(--ink-faint)', padding:'8px 0' }}>No places yet — add them to see on map.</div>
                        : <div className="places-list">
                          {dayPlaces.map(place => {
                            const cs = catStyle(place.category);
                            return (
                              <div key={place.id} className="place-row">
                                <span className="place-time">{place.time||'—'}</span>
                                <span className="place-dot" style={{ background:cs.dot }}/>
                                <div className="place-info">
                                  <div className="place-name">{place.name}</div>
                                  {place.notes && <div className="place-note">{place.notes}</div>}
                                </div>
                                <span className="place-cat" style={{ background:cs.bg, color:cs.color }}>{place.category}</span>
                                {place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link"><ExternalLink size={13}/></a>}
                              </div>
                            );
                          })}
                        </div>
                      }
                      {dayPlaces.length>0 && <button className="map-view-btn" style={{ marginTop:10, width:'100%', justifyContent:'center' }} onClick={()=>setMapDay(day)}><MapPin size={14}/> View all {dayPlaces.length} places on map</button>}
                    </div>
                    {(day.transport||day.notes) && <div style={{ marginTop:12, padding:'10px 12px', background:'var(--paper-warm)', borderRadius:8, fontSize:12, color:'var(--ink-mid)', lineHeight:1.6 }}>{day.transport&&<div><strong>Transport:</strong> {day.transport}</div>}{day.notes&&<div style={{marginTop:4}}><strong>Notes:</strong> {day.notes}</div>}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
      {showAdd===true && <AddDayModal tripId={tripId} onClose={()=>setShowAdd(false)} onAdd={d=>{onAddDay(d);setShowAdd(false);}}/>}
      {showAdd&&showAdd.dayId && <AddPlaceModal tripId={tripId} dayId={showAdd.dayId} onClose={()=>setShowAdd(false)} onAdd={p=>{onAddPlace(p);setShowAdd(false);}}/>}
      {mapDay && mapItems.length>0 && <MapModal title={`Day ${mapDay.dayNumber} — ${mapDay.title||'Map'}`} subtitle={`${mapItems.length} places · ${fmt(mapDay.date)}`} items={mapItems} onClose={()=>setMapDay(null)}/>}
    </>
  );
}

function AddDayModal({ tripId, onClose, onAdd }) {
  const [f, setF] = useState({ dayNumber:'', date:'', title:'', location:'', morning:'', afternoon:'', evening:'', transport:'', notes:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New day" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}}>
      <div className="form-row">
        <Field label="Day number"><input className="form-input" value={f.dayNumber} onChange={s('dayNumber')} placeholder="1"/></Field>
        <Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field>
      </div>
      <Field label="Day title"><input className="form-input" value={f.title} onChange={s('title')} placeholder="Arrival — Shinjuku"/></Field>
      <Field label="City / location"><input className="form-input" value={f.location} onChange={s('location')} placeholder="Tokyo"/></Field>
      <Field label="☀️ Morning"><textarea className="form-textarea" value={f.morning} onChange={s('morning')} placeholder="09:00 Meiji Shrine · 10:30 Harajuku..."/></Field>
      <Field label="🌤 Afternoon"><textarea className="form-textarea" value={f.afternoon} onChange={s('afternoon')} placeholder="13:00 Lunch · 15:00 Shibuya..."/></Field>
      <Field label="🌙 Evening"><textarea className="form-textarea" value={f.evening} onChange={s('evening')} placeholder="19:00 Dinner..."/></Field>
      <Field label="Transport"><input className="form-input" value={f.transport} onChange={s('transport')} placeholder="Yamanote Line day pass"/></Field>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Opening hours, pre-book..."/></Field>
    </Modal>
  );
}

// ── Documents View — with search, person filter, belongsTo ─────────────────

function AddDocModal({ tripId, onClose, onAdd, persons }) {
  const [f, setF] = useState({ name:'', type:'Flight', date:'', time:'', ref:'', fromTo:'', operator:'', details:'', cost:'', status:'Confirmed', belongsTo:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New ticket / document" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}}>
      <div className="form-row">
        <Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>{['Flight','Train','Bus','Ferry','Visa','Pass','Other'].map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>{['Pending','Confirmed','Checked in','Used'].map(t=><option key={t}>{t}</option>)}</select></Field>
      </div>
      <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="BA178 — London to Tokyo"/></Field>
      <div className="form-row">
        <Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field>
        <Field label="Time"><input className="form-input" type="time" value={f.time} onChange={s('time')}/></Field>
      </div>
      <Field label="From → To"><input className="form-input" value={f.fromTo} onChange={s('fromTo')} placeholder="LHR → NRT"/></Field>
      <div className="form-row">
        <Field label="Operator"><input className="form-input" value={f.operator} onChange={s('operator')} placeholder="British Airways"/></Field>
        <Field label="Confirmation ref"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="XY7GH2"/></Field>
      </div>
      <Field label="Seat / details"><input className="form-input" value={f.details} onChange={s('details')} placeholder="Seat 34A · 1 checked bag"/></Field>
      <div className="form-row">
        <Field label="Cost"><input className="form-input" value={f.cost} onChange={s('cost')} placeholder="£680"/></Field>
        <Field label="Belongs to">
          <select className="form-select" value={f.belongsTo} onChange={s('belongsTo')}>
            <option value="">— Everyone —</option>
            {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function DocsView({ tripId, docs, persons, onAddDoc }) {
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('');

  const tripDocs = useMemo(() => {
    let d = docs.filter(d=>d.tripId===tripId);
    if (personFilter) d = d.filter(d => (d.belongsTo||'').toLowerCase().includes(personFilter.toLowerCase()));
    if (query) d = d.filter(d => matchesSearch(d, query));
    return d.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  }, [docs, tripId, query, personFilter]);

  return (
    <>
      <SearchFilterBar query={query} onQuery={setQuery} persons={persons} activePerson={personFilter} onPerson={setPersonFilter}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span className="result-count">{tripDocs.length} result{tripDocs.length!==1?'s':''}</span>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add ticket</button>
      </div>
      {tripDocs.length===0
        ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>{query||personFilter?'No results':'No documents yet'}</h3><p>{query||personFilter?'Try a different search or filter.':'Add flights, trains, passes and visas here.'}</p></div>
        : <div className="card" style={{ overflow:'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Belongs to</th><th>Cost</th><th>Status</th></tr></thead>
            <tbody>
              {tripDocs.map(doc => {
                const personIdx = persons.findIndex(p=>p.name===doc.belongsTo);
                return (
                  <tr key={doc.id}>
                    <td><div className="td-primary">{doc.name}</div><div style={{marginTop:3}}><TypeBadge type={doc.type}/></div></td>
                    <td>{fmt(doc.date)}{doc.time?` · ${doc.time}`:''}</td>
                    <td>{doc.fromTo||'—'}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{doc.ref||'—'}</td>
                    <td>
                      {doc.belongsTo
                        ? <span style={{ display:'flex', alignItems:'center', gap:5 }}><Avatar name={doc.belongsTo} size={20} index={personIdx}/><span style={{fontSize:12}}>{doc.belongsTo}</span></span>
                        : <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Everyone</span>}
                    </td>
                    <td>{doc.cost||'—'}</td>
                    <td><span style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background:doc.status==='Confirmed'?'var(--teal-light)':'var(--paper-warm)', color:doc.status==='Confirmed'?'var(--teal)':'var(--ink-mid)' }}>{doc.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
      {showAdd && <AddDocModal tripId={tripId} onClose={()=>setShowAdd(false)} onAdd={d=>{onAddDoc(d);setShowAdd(false);}} persons={persons}/>}
    </>
  );
}

// ── Stays View — with map, search, person filter ───────────────────────────

function AddStayModal({ tripId, onClose, onAdd, persons }) {
  const [f, setF] = useState({ name:'', type:'Hotel', checkIn:'', checkOut:'', address:'', mapsUrl:'', lat:'', lng:'', ref:'', cost:'', paid:'No', checkInNotes:'', extras:'', belongsTo:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  function parseMapUrl(url) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) setF(p => ({...p, mapsUrl:url, lat:m[1], lng:m[2]}));
    else setF(p => ({...p, mapsUrl:url}));
  }
  return (
    <Modal title="New stay" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}}>
      <div className="form-row">
        <Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>{['Hotel','Airbnb','Hostel','Rental','Other'].map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Prepaid?"><select className="form-select" value={f.paid} onChange={s('paid')}><option value="Yes">Yes — prepaid</option><option value="No">Pay on arrival</option></select></Field>
      </div>
      <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Ace Hotel Tokyo"/></Field>
      <div className="form-row">
        <Field label="Check-in"><input className="form-input" type="date" value={f.checkIn} onChange={s('checkIn')}/></Field>
        <Field label="Check-out"><input className="form-input" type="date" value={f.checkOut} onChange={s('checkOut')}/></Field>
      </div>
      <Field label="Address"><input className="form-input" value={f.address} onChange={s('address')} placeholder="Full address"/></Field>
      <Field label="Google Maps link">
        <input className="form-input" value={f.mapsUrl} onChange={e=>parseMapUrl(e.target.value)} placeholder="Paste Google Maps URL — lat/lng auto-extracted"/>
      </Field>
      {(f.lat||f.lng) && <div style={{ fontSize:12, color:'var(--teal)', background:'var(--teal-light)', padding:'6px 10px', borderRadius:'var(--radius)' }}>✓ Coordinates: {f.lat}, {f.lng}</div>}
      <div className="form-row">
        <Field label="Confirmation ref"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="ACE-449012"/></Field>
        <Field label="Total cost"><input className="form-input" value={f.cost} onChange={s('cost')} placeholder="£860"/></Field>
      </div>
      <Field label="Belongs to">
        <select className="form-select" value={f.belongsTo} onChange={s('belongsTo')}>
          <option value="">— Everyone —</option>
          {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Check-in notes"><textarea className="form-textarea" value={f.checkInNotes} onChange={s('checkInNotes')} placeholder="Key code, self check-in..."/></Field>
      <Field label="Extras"><input className="form-input" value={f.extras} onChange={s('extras')} placeholder="Wifi: GuestNet · Breakfast included"/></Field>
    </Modal>
  );
}

function StaysView({ tripId, stays, persons, onAddStay }) {
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [mapStay, setMapStay] = useState(null);

  const tripStays = useMemo(() => {
    let s = stays.filter(s=>s.tripId===tripId);
    if (personFilter) s = s.filter(s => (s.belongsTo||'').toLowerCase().includes(personFilter.toLowerCase()));
    if (query) s = s.filter(s => matchesSearch(s, query));
    return s.sort((a,b)=>(a.checkIn||'').localeCompare(b.checkIn||''));
  }, [stays, tripId, query, personFilter]);

  return (
    <>
      <SearchFilterBar query={query} onQuery={setQuery} persons={persons} activePerson={personFilter} onPerson={setPersonFilter}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span className="result-count">{tripStays.length} result{tripStays.length!==1?'s':''}</span>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add stay</button>
      </div>
      {tripStays.length===0
        ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>{query||personFilter?'No results':'No stays yet'}</h3><p>{query||personFilter?'Try a different search or filter.':'Add your hotels and Airbnbs here.'}</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {tripStays.map(stay => {
            const stayPersons = (stay.belongsTo||'').split(',').map(n=>n.trim()).filter(Boolean);
            return (
              <div key={stay.id} className="card" style={{ padding:'16px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:600, color:'var(--ink)' }}>{stay.name}</div>
                    <div style={{ fontSize:12, color:'var(--ink-light)', marginTop:2 }}>{fmt(stay.checkIn)} → {fmt(stay.checkOut)} · {nights(stay.checkIn,stay.checkOut)} nights</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <TypeBadge type={stay.type}/>
                    {(stay.lat||stay.mapsUrl) && (
                      <button className="stay-map-btn" onClick={()=>setMapStay(stay)}><MapPin size={12}/> Map</button>
                    )}
                    {stay.mapsUrl && <a href={stay.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open in Maps"><ExternalLink size={13}/></a>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12, color:'var(--ink-mid)' }}>
                  {stay.address && <div><span style={{color:'var(--ink-light)'}}>Address</span><br/>{stay.address}</div>}
                  {stay.ref && <div><span style={{color:'var(--ink-light)'}}>Confirmation</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{stay.ref}</span></div>}
                  {stay.cost && <div><span style={{color:'var(--ink-light)'}}>Cost</span><br/>{stay.cost} · {stay.paid==='Yes'?'✓ Prepaid':'Pay on arrival'}</div>}
                  {stay.extras && <div><span style={{color:'var(--ink-light)'}}>Extras</span><br/>{stay.extras}</div>}
                </div>
                {stayPersons.length>0 && (
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'var(--ink-light)' }}>Staying:</span>
                    {stayPersons.map((name,i)=>(
                      <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--ink-mid)' }}>
                        <Avatar name={name} size={18} index={i}/> {name}
                      </span>
                    ))}
                  </div>
                )}
                {stay.checkInNotes && <div style={{ marginTop:10, padding:'8px 12px', background:'var(--amber-light)', borderRadius:8, fontSize:12, color:'var(--amber)' }}><strong>Check-in:</strong> {stay.checkInNotes}</div>}
              </div>
            );
          })}
        </div>
      }
      {showAdd && <AddStayModal tripId={tripId} onClose={()=>setShowAdd(false)} onAdd={s=>{onAddStay(s);setShowAdd(false);}} persons={persons}/>}
      {mapStay && (
        <MapModal
          title={mapStay.name}
          subtitle={`${fmt(mapStay.checkIn)} → ${fmt(mapStay.checkOut)} · ${nights(mapStay.checkIn,mapStay.checkOut)} nights`}
          items={[{ id:mapStay.id, name:mapStay.name, subtitle:mapStay.address, badge:mapStay.type, mapsUrl:mapStay.mapsUrl, lat:mapStay.lat, lng:mapStay.lng, notes:mapStay.checkInNotes, dotBg:'var(--teal-light)', dotColor:'var(--teal)' }]}
          onClose={()=>setMapStay(null)}
        />
      )}
    </>
  );
}

// ── Personnels View ────────────────────────────────────────────────────────

function AddPersonnelModal({ tripId, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', role:'Traveller', email:'', phone:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="Add person" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}}>
      <Field label="Full name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Aisha Patel"/></Field>
      <Field label="Role"><select className="form-select" value={f.role} onChange={s('role')}>{['Trip organiser','Traveller','Local contact','Emergency contact'].map(r=><option key={r}>{r}</option>)}</select></Field>
      <Field label="Email"><input className="form-input" type="email" value={f.email} onChange={s('email')} placeholder="aisha@email.com"/></Field>
      <Field label="Phone"><input className="form-input" value={f.phone} onChange={s('phone')} placeholder="+44 7700 900001"/></Field>
    </Modal>
  );
}

function PersonnelsView({ tripId, personnels, onAddPersonnel }) {
  const [showAdd, setShowAdd] = useState(false);
  const tripPersons = personnels.filter(p=>p.tripId===tripId);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add person</button>
      </div>
      {tripPersons.length===0
        ? <div className="empty-state"><div className="empty-icon">👥</div><h3>No people yet</h3><p>Add your travel companions to sort tickets and stays by person.</p></div>
        : <div className="personnel-grid">
          {tripPersons.map((p,i) => {
            const ac = avatarColor(p.name, i);
            return (
              <div key={p.id} className="personnel-card">
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div className="personnel-avatar-lg" style={{ background:ac.bg, color:ac.color }}>{initials(p.name)}</div>
                  <div>
                    <div className="personnel-name">{p.name}</div>
                    <div className="personnel-role">{p.role}</div>
                  </div>
                </div>
                {p.email && <div className="personnel-detail">✉️ {p.email}</div>}
                {p.phone && <div className="personnel-detail">📞 {p.phone}</div>}
              </div>
            );
          })}
        </div>
      }
      {showAdd && <AddPersonnelModal tripId={tripId} onClose={()=>setShowAdd(false)} onAdd={p=>{onAddPersonnel(p);setShowAdd(false);}}/>}
    </>
  );
}

// ── Trip Detail ────────────────────────────────────────────────────────────

function TripDetail({ trip, days, docs, stays, places, personnels, onBack, onAddDay, onAddDoc, onAddStay, onAddPlace, onAddPersonnel }) {
  const [tab, setTab] = useState('itinerary');
  const n = nights(trip.startDate, trip.endDate);
  const tripPersons = personnels.filter(p=>p.tripId===trip.id);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="back-btn" onClick={onBack}><ChevronLeft size={15}/> All trips</button>
            <span style={{ fontSize:28 }}>{trip.emoji}</span>
            <div>
              <div className="detail-title">{trip.name}</div>
              <div className="detail-meta">{trip.startDate?`${fmt(trip.startDate)} — ${fmt(trip.endDate)} · ${n} nights`:'No dates set'}{trip.budget?` · ${trip.budget}`:''}</div>
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
            ['People', tripPersons.length, 'travelling'],
          ].map(([label,val,sub])=>(
            <div key={label} className="summary-card">
              <div className="summary-label">{label}</div>
              <div className="summary-value">{val}</div>
              <div className="summary-sub">{sub}</div>
            </div>
          ))}
        </div>
        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['tickets','🎫 Tickets & docs'],['stays','🏨 Stays'],['people','👥 People']].map(([key,label])=>(
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={()=>setTab(key)}>{label}</button>
          ))}
        </div>
        {tab==='itinerary' && <DaysView tripId={trip.id} days={days} places={places} onAddDay={onAddDay} onAddPlace={onAddPlace}/>}
        {tab==='tickets'   && <DocsView tripId={trip.id} docs={docs} persons={tripPersons} onAddDoc={onAddDoc}/>}
        {tab==='stays'     && <StaysView tripId={trip.id} stays={stays} persons={tripPersons} onAddStay={onAddStay}/>}
        {tab==='people'    && <PersonnelsView tripId={trip.id} personnels={personnels} onAddPersonnel={onAddPersonnel}/>}
      </div>
    </>
  );
}

// ── Trips List ─────────────────────────────────────────────────────────────

function AddTripModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name:'', emoji:'✈️', status:'planning', destinations:'', startDate:'', endDate:'', budget:'', notes:'' });
  const s = k => e => setF(p => ({...p,[k]:e.target.value}));
  return (
    <Modal title="New trip" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString()});onClose();}}>
      <div className="form-row">
        <Field label="Flag / emoji"><input className="form-input" value={f.emoji} onChange={s('emoji')} placeholder="🇯🇵"/></Field>
        <Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>{['dream','planning','upcoming','done'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}</select></Field>
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

function TripsView({ trips, days, docs, stays, onSelect, onAdd }) {
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const filtered = trips.filter(t=>filter==='all'||t.status===filter);
  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><h1>All trips</h1><p>{trips.length} trips total</p></div>
        <div className="topbar-actions"><button className="btn btn-primary" onClick={()=>setShowAdd(true)}><Plus size={14}/> New trip</button></div>
      </div>
      <div className="content-area">
        <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
          {[['all','All'],['upcoming','Upcoming'],['planning','Planning'],['dream','Dream'],['done','Done']].map(([key,label])=>(
            <button key={key} onClick={()=>setFilter(key)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, border:'1px solid var(--border-mid)', background:filter===key?'var(--ink)':'var(--paper-card)', color:filter===key?'var(--paper)':'var(--ink-mid)', cursor:'pointer', fontFamily:'var(--font-body)' }}>{label}</button>
          ))}
        </div>
        {filtered.length===0
          ? <div className="empty-state"><div className="empty-icon">🌍</div><h3>No trips yet</h3><p>Add your first trip to get started.</p></div>
          : <div className="trips-grid">
            {filtered.map(trip=>(
              <div key={trip.id} className="trip-card" onClick={()=>onSelect(trip)}>
                <div className={`trip-card-header ${trip.status}`}><span className="trip-flag">{trip.emoji}</span><StatusBadge status={trip.status}/></div>
                <div className="trip-card-body">
                  <div className="trip-card-name">{trip.name}</div>
                  <div className="trip-card-dates">{trip.startDate?`${fmt(trip.startDate)} — ${fmt(trip.endDate)}`:'No dates set'}</div>
                  <div className="trip-chips">
                    {days.filter(d=>d.tripId===trip.id).length>0&&<span className="chip">📅 {days.filter(d=>d.tripId===trip.id).length} days</span>}
                    {docs.filter(d=>d.tripId===trip.id).length>0&&<span className="chip">🎫 {docs.filter(d=>d.tripId===trip.id).length} tickets</span>}
                    {stays.filter(s=>s.tripId===trip.id).length>0&&<span className="chip">🏨 {stays.filter(s=>s.tripId===trip.id).length} stays</span>}
                    {trip.budget&&<span className="chip">💰 {trip.budget}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
      {showAdd&&<AddTripModal onClose={()=>setShowAdd(false)} onAdd={t=>{onAdd(t);setShowAdd(false);}}/>}
    </>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

function SettingsView({ sheetsId, onSave }) {
  const [id, setId] = useState(sheetsId||'');
  return (
    <>
      <div className="topbar"><div className="topbar-left"><h1>Settings</h1><p>Connect Google Sheets for cross-device sync</p></div></div>
      <div className="content-area">
        <div className="setup-wrap">
          <div className="setup-card">
            <h2>Connect Google Sheets</h2>
            <p>Your data lives in a Google Sheet you own. Create 6 tabs and publish each as CSV.</p>
            <div className="step-list">
              {[['1','Create a spreadsheet at sheets.google.com named Wander'],['2','Create 6 tabs: Trips, Days, Documents, Stays, Places, Personnels'],['3','Add the exact column headers listed below to each tab'],['4','File → Share → Publish to web → each tab → CSV → Publish'],['5','Copy the spreadsheet ID from the URL and paste below']].map(([n,t])=>(
                <div key={n} className="step-item"><div className="step-num">{n}</div><div className="step-text">{t}</div></div>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Spreadsheet ID</label>
              <div className="url-input-row">
                <input className="form-input" value={id} onChange={e=>setId(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"/>
                <button className="btn btn-teal" onClick={()=>onSave(id)}>Connect</button>
              </div>
            </div>
            <div style={{ background:'var(--paper-warm)', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:12, color:'var(--ink-mid)', lineHeight:2 }}>
              <strong style={{ display:'block', marginBottom:6 }}>Column headers per sheet:</strong>
              <div><strong>Trips:</strong> id, name, emoji, status, destinations, startDate, endDate, budget, notes</div>
              <div><strong>Days:</strong> id, tripId, dayNumber, date, title, location, morning, afternoon, evening, transport, notes</div>
              <div><strong>Documents:</strong> id, tripId, name, type, date, time, ref, fromTo, operator, details, cost, status, <span style={{color:'var(--teal)',fontWeight:600}}>belongsTo</span></div>
              <div><strong>Stays:</strong> id, tripId, name, type, checkIn, checkOut, address, mapsUrl, <span style={{color:'var(--teal)',fontWeight:600}}>lat, lng</span>, ref, cost, paid, checkInNotes, extras, <span style={{color:'var(--teal)',fontWeight:600}}>belongsTo</span></div>
              <div><strong>Places:</strong> id, tripId, dayId, name, time, category, mapsUrl, lat, lng, notes</div>
              <div style={{ padding:'6px 10px', background:'var(--teal-light)', borderRadius:6, color:'var(--teal)', marginTop:4 }}><strong>Personnels (new!):</strong> id, tripId, name, role, email, phone</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wander_v3';
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

export default function App() {
  const saved = loadLocal();
  const [trips,      setTrips]      = useState(saved?.trips      || DEMO_TRIPS);
  const [days,       setDays]       = useState(saved?.days       || DEMO_DAYS);
  const [docs,       setDocs]       = useState(saved?.docs       || DEMO_DOCS);
  const [stays,      setStays]      = useState(saved?.stays      || DEMO_STAYS);
  const [places,     setPlaces]     = useState(saved?.places     || DEMO_PLACES);
  const [personnels, setPersonnels] = useState(saved?.personnels || DEMO_PERSONNELS);
  const [sheetsId,   setSheetsId]   = useState(saved?.sheetsId   || '');
  const [view, setView] = useState('trips');
  const [selectedTrip, setSelectedTrip] = useState(null);

  function persist(u) {
    const next = { trips, days, docs, stays, places, personnels, sheetsId, ...u };
    saveLocal(next);
    if (u.trips)      setTrips(u.trips);
    if (u.days)       setDays(u.days);
    if (u.docs)       setDocs(u.docs);
    if (u.stays)      setStays(u.stays);
    if (u.places)     setPlaces(u.places);
    if (u.personnels) setPersonnels(u.personnels);
    if (u.sheetsId !== undefined) setSheetsId(u.sheetsId);
  }

  const addTrip      = t => persist({ trips:      [...trips, t] });
  const addDay       = d => persist({ days:       [...days, d] });
  const addDoc       = d => persist({ docs:       [...docs, d] });
  const addStay      = s => persist({ stays:      [...stays, s] });
  const addPlace     = p => persist({ places:     [...places, p] });
  const addPersonnel = p => persist({ personnels: [...personnels, p] });
  const navTo        = v => { setView(v); setSelectedTrip(null); };

  const activeTrips = trips.filter(t=>t.status==='upcoming'||t.status==='planning');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-wordmark">Wander</div>
          <div className="logo-tagline">Your travel space</div>
        </div>
        <div className="nav-section-label">Navigate</div>
        <button className={`nav-item ${view==='trips'&&!selectedTrip?'active':''}`} onClick={()=>navTo('trips')}><Map size={15}/>All trips</button>
        <button className={`nav-item ${view==='settings'?'active':''}`} onClick={()=>navTo('settings')}><Settings size={15}/>Google Sheets</button>
        {activeTrips.length>0 && <>
          <div className="nav-section-label">Active trips</div>
          {activeTrips.slice(0,5).map(t=>(
            <button key={t.id} className={`nav-item ${selectedTrip?.id===t.id?'active':''}`} onClick={()=>{setSelectedTrip(t);setView('trip');}}>
              <span style={{fontSize:14}}>{t.emoji}</span>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
            </button>
          ))}
        </>}
        <div className="sidebar-footer">Data saved locally<br/>+ Google Sheets sync</div>
      </aside>
      <main className="main">
        {selectedTrip
          ? <TripDetail trip={selectedTrip} days={days} docs={docs} stays={stays} places={places} personnels={personnels}
              onBack={()=>{setSelectedTrip(null);setView('trips');}}
              onAddDay={addDay} onAddDoc={addDoc} onAddStay={addStay} onAddPlace={addPlace} onAddPersonnel={addPersonnel}/>
          : view==='trips'
            ? <TripsView trips={trips} days={days} docs={docs} stays={stays} onSelect={t=>{setSelectedTrip(t);setView('trip');}} onAdd={addTrip}/>
            : view==='settings'
              ? <SettingsView sheetsId={sheetsId} onSave={id=>persist({sheetsId:id})}/>
              : null
        }
      </main>
    </div>
  );
}
