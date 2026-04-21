import { useState } from 'react';
import { Map, Settings, ChevronLeft, Plus, X, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { DEMO_TRIPS, DEMO_DAYS, DEMO_DOCS, DEMO_STAYS, DEMO_PLACES } from './demoData';
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

const CAT_COLORS = {
  Food:      { bg: '#fdf3e3', color: '#c47a1e', dot: '#c47a1e' },
  Sights:    { bg: '#e8f5f0', color: '#1a7a5e', dot: '#1a7a5e' },
  Activity:  { bg: '#f0edf8', color: '#5a4a8a', dot: '#5a4a8a' },
  Transport: { bg: '#f1efe8', color: '#8a8480', dot: '#8a8480' },
  Shopping:  { bg: '#fdf0ef', color: '#c0524a', dot: '#c0524a' },
  Stay:      { bg: '#e6f1fb', color: '#185fa5', dot: '#185fa5' },
  Other:     { bg: '#f3efe8', color: '#4a4640', dot: '#4a4640' },
};

function catStyle(cat) { return CAT_COLORS[cat] || CAT_COLORS.Other; }

function StatusBadge({ status }) {
  const m = { upcoming:['badge-upcoming','Upcoming'], planning:['badge-planning','Planning'], dream:['badge-dream','Dream trip'], done:['badge-done','Done'] };
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

// ── Map Modal ──────────────────────────────────────────────────────────────

function MapModal({ day, places, onClose }) {
  const [active, setActive] = useState(places[0]?.id || null);
  const activePlace = places.find(p => p.id === active);

  // Build Google Maps embed URL showing all pins
  // Uses the first place as center, others as waypoints
  function buildMapUrl(place) {
    if (!place) return null;
    if (place.lat && place.lng) {
      return `https://maps.google.com/maps?q=${place.lat},${place.lng}&z=15&output=embed`;
    }
    if (place.mapsUrl) {
      // Convert regular maps URL to embed
      const q = encodeURIComponent(place.name);
      return `https://maps.google.com/maps?q=${q}&output=embed`;
    }
    return null;
  }

  // Build a Google Maps directions URL for all places in order
  function buildDirectionsUrl() {
    const withCoords = places.filter(p => p.lat && p.lng);
    if (withCoords.length === 0) return null;
    if (withCoords.length === 1) return withCoords[0].mapsUrl || `https://maps.google.com/?q=${withCoords[0].lat},${withCoords[0].lng}`;
    const origin = `${withCoords[0].lat},${withCoords[0].lng}`;
    const dest = `${withCoords[withCoords.length-1].lat},${withCoords[withCoords.length-1].lng}`;
    const waypoints = withCoords.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ''}`;
  }

  const embedUrl = buildMapUrl(activePlace);
  const directionsUrl = buildDirectionsUrl();

  return (
    <div className="map-modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="map-modal">
        <div className="map-modal-header">
          <div>
            <div className="map-modal-title">Day {day.dayNumber} — {day.title || 'Itinerary map'}</div>
            <div className="map-modal-sub">{places.length} places · {fmt(day.date)}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn btn-teal btn-sm">
                <Navigation size={13}/> Full route
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
          </div>
        </div>
        <div className="map-modal-body">
          {/* Sidebar — place list */}
          <div className="map-sidebar">
            {places.map((place, i) => {
              const cs = catStyle(place.category);
              return (
                <div key={place.id} className={`map-place-item ${active===place.id?'active':''}`} onClick={() => setActive(place.id)}>
                  <div className="map-place-num" style={{ background: cs.bg, color: cs.color }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="map-place-name">{place.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                      {place.time && <span className="map-place-time">{place.time}</span>}
                      <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background: cs.bg, color: cs.color, fontWeight:500 }}>{place.category}</span>
                    </div>
                    {place.notes && <div style={{ fontSize:11, color:'var(--ink-light)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{place.notes}</div>}
                  </div>
                  {place.mapsUrl && (
                    <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link" onClick={e => e.stopPropagation()} title="Open in Google Maps">
                      <ExternalLink size={12}/>
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Map frame */}
          <div className="map-frame-wrap">
            {embedUrl ? (
              <iframe
                title="map"
                src={embedUrl}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="map-placeholder">
                <div className="map-icon">🗺️</div>
                <p>
                  {activePlace
                    ? <>No coordinates for <strong>{activePlace.name}</strong>.<br/>Add lat/lng in the Places sheet, or <a href={activePlace.mapsUrl} target="_blank" rel="noreferrer">open in Google Maps ↗</a></>
                    : 'Select a place on the left to view its map.'}
                </p>
              </div>
            )}
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

  // Auto-extract lat/lng from a Google Maps URL
  function parseMapUrl(url) {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                  url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                  url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) setF(p => ({...p, mapsUrl: url, lat: match[1], lng: match[2]}));
    else setF(p => ({...p, mapsUrl: url}));
  }

  return (
    <Modal title="Add place" onClose={onClose} onSave={() => { onAdd({...f, id: Date.now().toString(), tripId, dayId}); onClose(); }}>
      <Field label="Place name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Meiji Shrine"/></Field>
      <div className="form-row">
        <Field label="Time"><input className="form-input" type="time" value={f.time} onChange={s('time')}/></Field>
        <Field label="Category">
          <select className="form-select" value={f.category} onChange={s('category')}>
            {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Google Maps link">
        <input className="form-input" value={f.mapsUrl}
          onChange={e => parseMapUrl(e.target.value)}
          placeholder="Paste a Google Maps URL — lat/lng auto-extracted"/>
      </Field>
      {(f.lat || f.lng) && (
        <div style={{ fontSize:12, color:'var(--teal)', background:'var(--teal-light)', padding:'6px 10px', borderRadius:'var(--radius)' }}>
          ✓ Coordinates found: {f.lat}, {f.lng}
        </div>
      )}
      <div className="form-row">
        <Field label="Latitude (optional)"><input className="form-input" value={f.lat} onChange={s('lat')} placeholder="35.6764"/></Field>
        <Field label="Longitude (optional)"><input className="form-input" value={f.lng} onChange={s('lng')} placeholder="139.6993"/></Field>
      </div>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Book ahead, opening hours, tips..."/></Field>
    </Modal>
  );
}

// ── Days View with Places ──────────────────────────────────────────────────

function parsePeriod(text) {
  if (!text) return [];
  return text.split('·').map(seg => {
    const seg2 = seg.trim();
    const m = seg2.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m ? { time: m[1], content: m[2] } : { time: '', content: seg2 };
  }).filter(x => x.content);
}

function DaysView({ tripId, days, places, onAddDay, onAddPlace }) {
  const tripDays = days.filter(d => d.tripId === tripId).sort((a,b) => Number(a.dayNumber)-Number(b.dayNumber));
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [mapDay, setMapDay] = useState(null);

  const mapDayPlaces = mapDay ? places.filter(p => p.dayId === mapDay.id).sort((a,b) => (a.time||'').localeCompare(b.time||'')) : [];

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={() => setShowAdd(true)}><Plus size={14}/> Add day</button>
      </div>
      {tripDays.length === 0
        ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days yet</h3><p>Add your day-by-day itinerary above.</p></div>
        : <div className="days-list">
          {tripDays.map(day => {
            const dayPlaces = places.filter(p => p.dayId === day.id).sort((a,b) => (a.time||'').localeCompare(b.time||''));
            return (
              <div key={day.id} className="day-card">
                <div className="day-card-header" onClick={() => setExpanded(expanded===day.id ? null : day.id)} style={{ cursor:'pointer' }}>
                  <div className="day-number">{day.dayNumber}</div>
                  <div className="day-card-meta">
                    <div className="day-card-title">{day.title || `Day ${day.dayNumber}`}</div>
                    <div className="day-card-date">{fmt(day.date)}{day.location ? ` · ${day.location}` : ''}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
                    {dayPlaces.length > 0 && (
                      <button className="map-view-btn" onClick={e => { e.stopPropagation(); setMapDay(day); }}
                        style={{ padding:'5px 10px', fontSize:12 }}>
                        <MapPin size={13}/> Map ({dayPlaces.length})
                      </button>
                    )}
                    <span style={{ fontSize:12, color:'var(--ink-faint)' }}>{expanded===day.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded===day.id && (
                  <div className="day-card-body">
                    {/* Timeline from morning/afternoon/evening text */}
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

                    {/* Places section */}
                    <div style={{ marginTop: (day.morning || day.afternoon || day.evening) ? 16 : 0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div className="period-label" style={{ margin:0, flex:1 }}>📍 Places</div>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'3px 8px', marginLeft:8 }}
                          onClick={() => setShowAdd({ dayId: day.id })}>
                          <Plus size={11}/> Add place
                        </button>
                      </div>

                      {dayPlaces.length === 0
                        ? <div style={{ fontSize:12, color:'var(--ink-faint)', padding:'8px 0' }}>No places yet — add them to see on map.</div>
                        : <div className="places-list">
                          {dayPlaces.map(place => {
                            const cs = catStyle(place.category);
                            return (
                              <div key={place.id} className="place-row">
                                <span className="place-time">{place.time || '—'}</span>
                                <span className="place-dot" style={{ background: cs.dot }}/>
                                <div className="place-info">
                                  <div className="place-name">{place.name}</div>
                                  {place.notes && <div className="place-note">{place.notes}</div>}
                                </div>
                                <span className="place-cat" style={{ background: cs.bg, color: cs.color }}>{place.category}</span>
                                {place.mapsUrl && (
                                  <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link" title="Open in Google Maps">
                                    <ExternalLink size={13}/>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      }

                      {dayPlaces.length > 0 && (
                        <button className="map-view-btn" style={{ marginTop:10, width:'100%', justifyContent:'center' }}
                          onClick={() => setMapDay(day)}>
                          <MapPin size={14}/> View all {dayPlaces.length} places on map
                        </button>
                      )}
                    </div>

                    {(day.transport || day.notes) && (
                      <div style={{ marginTop:12, padding:'10px 12px', background:'var(--paper-warm)', borderRadius:8, fontSize:12, color:'var(--ink-mid)', lineHeight:1.6 }}>
                        {day.transport && <div><strong>Transport:</strong> {day.transport}</div>}
                        {day.notes && <div style={{ marginTop:4 }}><strong>Notes:</strong> {day.notes}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }

      {/* Add day modal */}
      {showAdd === true && (
        <AddDayModal tripId={tripId} onClose={() => setShowAdd(false)}
          onAdd={d => { onAddDay(d); setShowAdd(false); }}/>
      )}

      {/* Add place modal — triggered per-day */}
      {showAdd && showAdd.dayId && (
        <AddPlaceModal tripId={tripId} dayId={showAdd.dayId}
          onClose={() => setShowAdd(false)}
          onAdd={p => { onAddPlace(p); setShowAdd(false); }}/>
      )}

      {/* Map modal */}
      {mapDay && mapDayPlaces.length > 0 && (
        <MapModal day={mapDay} places={mapDayPlaces} onClose={() => setMapDay(null)}/>
      )}
    </>
  );
}

// ── Add Day Modal ──────────────────────────────────────────────────────────

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

// ── Documents view ─────────────────────────────────────────────────────────

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

// ── Stays view ─────────────────────────────────────────────────────────────

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

// ── Trip Detail ────────────────────────────────────────────────────────────

function TripDetail({ trip, days, docs, stays, places, onBack, onAddDay, onAddDoc, onAddStay, onAddPlace }) {
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
        {tab==='itinerary' && <DaysView tripId={trip.id} days={days} places={places} onAddDay={onAddDay} onAddPlace={onAddPlace}/>}
        {tab==='tickets'   && <DocsView tripId={trip.id} docs={docs} onAddDoc={onAddDoc}/>}
        {tab==='stays'     && <StaysView tripId={trip.id} stays={stays} onAddStay={onAddStay}/>}
      </div>
    </>
  );
}

// ── Trips List ─────────────────────────────────────────────────────────────

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
            <p>Your data lives in a Google Sheet you own — nothing stored elsewhere. Same sheet works on any device.</p>
            <div className="step-list">
              {[
                ['1','Go to sheets.google.com and create a new spreadsheet named Wander'],
                ['2','Create 5 tabs named exactly: Trips, Days, Documents, Stays, Places'],
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
              <div style={{ marginTop:6, padding:'8px 10px', background:'var(--teal-light)', borderRadius:6, color:'var(--teal)' }}>
                <strong>Places (new!):</strong> id, tripId, dayId, name, time, category, mapsUrl, lat, lng, notes
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wander_v2';
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

export default function App() {
  const saved = loadLocal();
  const [trips,  setTrips]  = useState(saved?.trips   || DEMO_TRIPS);
  const [days,   setDays]   = useState(saved?.days    || DEMO_DAYS);
  const [docs,   setDocs]   = useState(saved?.docs    || DEMO_DOCS);
  const [stays,  setStays]  = useState(saved?.stays   || DEMO_STAYS);
  const [places, setPlaces] = useState(saved?.places  || DEMO_PLACES);
  const [sheetsId, setSheetsId] = useState(saved?.sheetsId||'');
  const [view, setView] = useState('trips');
  const [selectedTrip, setSelectedTrip] = useState(null);

  function persist(u) {
    const next = { trips, days, docs, stays, places, sheetsId, ...u };
    saveLocal(next);
    if (u.trips)   setTrips(u.trips);
    if (u.days)    setDays(u.days);
    if (u.docs)    setDocs(u.docs);
    if (u.stays)   setStays(u.stays);
    if (u.places)  setPlaces(u.places);
    if (u.sheetsId !== undefined) setSheetsId(u.sheetsId);
  }

  const addTrip  = t => persist({ trips:  [...trips,  t] });
  const addDay   = d => persist({ days:   [...days,   d] });
  const addDoc   = d => persist({ docs:   [...docs,   d] });
  const addStay  = s => persist({ stays:  [...stays,  s] });
  const addPlace = p => persist({ places: [...places, p] });
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
          ? <TripDetail trip={selectedTrip} days={days} docs={docs} stays={stays} places={places}
              onBack={() => { setSelectedTrip(null); setView('trips'); }}
              onAddDay={addDay} onAddDoc={addDoc} onAddStay={addStay} onAddPlace={addPlace}/>
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
