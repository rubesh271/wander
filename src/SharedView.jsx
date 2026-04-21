import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { fmt, nights, catStyle } from './utils.js';
import { MapModal, Avatar, StatusBadge, TypeBadge, AttachmentChips } from './components/ui.jsx';

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === ',' && !inQ) { values.push(cur.trim()); cur = ''; continue; }
      cur += line[i];
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// Fetch a single sheet tab as CSV
async function fetchTab(sheetId, tabName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    return parseCSV(text);
  } catch { return []; }
}

// ── Read-only Trip Card ────────────────────────────────────────────────────

function RODayCard({ day, places }) {
  const [open, setOpen] = useState(false);
  const dayPlaces = places.filter(p => p.dayId === day.id).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const [mapOpen, setMapOpen] = useState(false);
  const mapItems = dayPlaces.map(p => ({ ...p, subtitle: p.time, badge: p.category, dotBg: catStyle(p.category).bg, dotColor: catStyle(p.category).color }));

  function parsePeriod(text) {
    if (!text) return [];
    return text.split('·').map(seg => {
      const s = seg.trim();
      const m = s.match(/^(\d{2}:\d{2})\s*(.*)/);
      return m ? { time: m[1], content: m[2] } : { time: '', content: s };
    }).filter(x => x.content);
  }

  return (
    <div className="day-card" style={{ cursor:'default' }}>
      <div className="day-card-header" onClick={() => setOpen(!open)} style={{ cursor:'pointer' }}>
        <div className="day-number">{day.dayNumber}</div>
        <div className="day-card-meta">
          <div className="day-card-title">{day.title || `Day ${day.dayNumber}`}</div>
          <div className="day-card-date">{fmt(day.date)}{day.location ? ` · ${day.location}` : ''}</div>
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
          {dayPlaces.length > 0 && (
            <button className="map-view-btn" style={{ padding:'5px 10px', fontSize:12 }}
              onClick={e => { e.stopPropagation(); setMapOpen(true); }}>
              <MapPin size={13}/> Map ({dayPlaces.length})
            </button>
          )}
          {open ? <ChevronUp size={14} color="var(--ink-faint)"/> : <ChevronDown size={14} color="var(--ink-faint)"/>}
        </div>
      </div>
      {open && (
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
          {dayPlaces.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="period-label">📍 Places</div>
              <div className="places-list">
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
                      {place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link"><ExternalLink size={13}/></a>}
                    </div>
                  );
                })}
              </div>
              <button className="map-view-btn" style={{ marginTop:10, width:'100%', justifyContent:'center' }} onClick={() => setMapOpen(true)}>
                <MapPin size={14}/> View all {dayPlaces.length} places on map
              </button>
            </div>
          )}
          {(day.transport || day.notes) && (
            <div style={{ marginTop:12, padding:'10px 12px', background:'var(--paper-warm)', borderRadius:8, fontSize:12, color:'var(--ink-mid)', lineHeight:1.6 }}>
              {day.transport && <div><strong>Transport:</strong> {day.transport}</div>}
              {day.notes && <div style={{ marginTop:4 }}><strong>Notes:</strong> {day.notes}</div>}
            </div>
          )}
        </div>
      )}
      {mapOpen && mapItems.length > 0 && (
        <MapModal title={`Day ${day.dayNumber} — ${day.title || 'Map'}`} subtitle={`${mapItems.length} places · ${fmt(day.date)}`} items={mapItems} onClose={() => setMapOpen(false)}/>
      )}
    </div>
  );
}

function ROTripDetail({ trip, days, docs, stays, places, personnels, onBack }) {
  const [tab, setTab] = useState('itinerary');
  const n = nights(trip.startDate, trip.endDate);
  const tripDays = days.filter(d => d.tripId === trip.id).sort((a,b) => Number(a.dayNumber)-Number(b.dayNumber));
  const tripDocs = docs.filter(d => d.tripId === trip.id).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const tripStays = stays.filter(s => s.tripId === trip.id).sort((a,b) => (a.checkIn||'').localeCompare(b.checkIn||''));

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="back-btn" onClick={onBack}>← All trips</button>
            <span style={{ fontSize:28 }}>{trip.emoji}</span>
            <div>
              <div className="detail-title">{trip.name}</div>
              <div className="detail-meta">{trip.startDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)} · ${n} nights` : 'No dates set'}{trip.budget ? ` · ${trip.budget}` : ''}</div>
            </div>
          </div>
        </div>
        <StatusBadge status={trip.status}/>
      </div>
      <div className="content-area">
        <div className="summary-row">
          {[['Days', tripDays.length, `of ${n} nights`], ['Tickets', tripDocs.length, 'travel docs'], ['Stays', tripStays.length, 'bookings']].map(([label,val,sub]) => (
            <div key={label} className="summary-card">
              <div className="summary-label">{label}</div>
              <div className="summary-value">{val}</div>
              <div className="summary-sub">{sub}</div>
            </div>
          ))}
        </div>
        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['tickets','🎫 Tickets'],['stays','🏨 Stays']].map(([key,label]) => (
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === 'itinerary' && (
          <div className="days-list">
            {tripDays.length === 0
              ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days planned yet</h3></div>
              : tripDays.map(day => <RODayCard key={day.id} day={day} places={places}/>)
            }
          </div>
        )}

        {tab === 'tickets' && (
          tripDocs.length === 0
            ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>No tickets yet</h3></div>
            : <div className="card" style={{ overflow:'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Belongs to</th><th>Cost</th></tr></thead>
                <tbody>
                  {tripDocs.map(doc => {
                    const pIdx = personnels.findIndex(p => p.name === doc.belongsTo);
                    return (
                      <tr key={doc.id}>
                        <td><div className="td-primary">{doc.name}</div><div style={{marginTop:3}}><TypeBadge type={doc.type}/></div>
                          <AttachmentChips fileData={doc.fileData} fileLabel={doc.fileLabel} link={doc.link}/>
                        </td>
                        <td>{fmt(doc.date)}{doc.time ? ` · ${doc.time}` : ''}</td>
                        <td>{doc.fromTo || '—'}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{doc.ref || '—'}</td>
                        <td>{doc.belongsTo ? <span style={{display:'flex',alignItems:'center',gap:5}}><Avatar name={doc.belongsTo} size={18} index={pIdx}/><span style={{fontSize:12}}>{doc.belongsTo}</span></span> : <span style={{fontSize:12,color:'var(--ink-faint)'}}>Everyone</span>}</td>
                        <td>{doc.cost || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        )}

        {tab === 'stays' && (
          tripStays.length === 0
            ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>No stays yet</h3></div>
            : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {tripStays.map(stay => {
                const [mapOpen, setMapOpen] = useState(false);
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
                        {(stay.lat||stay.mapsUrl) && <button className="stay-map-btn" onClick={()=>setMapOpen(true)}><MapPin size={12}/> Map</button>}
                        {stay.mapsUrl && <a href={stay.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13}/></a>}
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12, color:'var(--ink-mid)' }}>
                      {stay.address && <div><span style={{color:'var(--ink-light)'}}>Address</span><br/>{stay.address}</div>}
                      {stay.ref && <div><span style={{color:'var(--ink-light)'}}>Confirmation</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{stay.ref}</span></div>}
                      {stay.cost && <div><span style={{color:'var(--ink-light)'}}>Cost</span><br/>{stay.cost} · {stay.paid==='Yes'?'✓ Prepaid':'Pay on arrival'}</div>}
                      {stay.extras && <div><span style={{color:'var(--ink-light)'}}>Extras</span><br/>{stay.extras}</div>}
                    </div>
                    {stayPersons.length > 0 && (
                      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'var(--ink-light)' }}>Staying:</span>
                        {stayPersons.map((name,i) => <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}><Avatar name={name} size={16} index={i}/>{name}</span>)}
                      </div>
                    )}
                    {mapOpen && <MapModal title={stay.name} subtitle={stay.address} items={[{ id:stay.id, name:stay.name, subtitle:stay.address, badge:stay.type, mapsUrl:stay.mapsUrl, lat:stay.lat, lng:stay.lng, dotBg:'var(--teal-light)', dotColor:'var(--teal)' }]} onClose={()=>setMapOpen(false)}/>}
                  </div>
                );
              })}
            </div>
        )}
      </div>
    </>
  );
}

// ── Main SharedView ────────────────────────────────────────────────────────

export default function SharedView({ sheetId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [trips, days, docs, stays, places, personnels] = await Promise.all([
          fetchTab(sheetId, 'Trips'),
          fetchTab(sheetId, 'Days'),
          fetchTab(sheetId, 'Documents'),
          fetchTab(sheetId, 'Stays'),
          fetchTab(sheetId, 'Places'),
          fetchTab(sheetId, 'Personnels'),
        ]);
        if (trips.length === 0) {
          setError('No trips found. Make sure your Google Sheet is published and has data in the Trips tab.');
        } else {
          setData({ trips, days, docs, stays, places, personnels });
        }
      } catch (e) {
        setError('Could not load sheet data. Make sure it is published to the web.');
      }
      setLoading(false);
    }
    load();
  }, [sheetId]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, color:'var(--ink-light)' }}>
      <div style={{ fontSize:32 }}>✈️</div>
      <div style={{ fontSize:14 }}>Loading trip data…</div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, color:'var(--ink-light)', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:32 }}>⚠️</div>
      <div style={{ fontSize:14, maxWidth:400 }}>{error}</div>
    </div>
  );

  const { trips, days, docs, stays, places, personnels } = data;

  return (
    <div style={{ minHeight:'100vh', background:'var(--paper)' }}>
      {/* Read-only header banner */}
      <div style={{ background:'var(--ink)', padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--paper)' }}>✈ Wander</div>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em', textTransform:'uppercase' }}>View only</span>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'24px 20px' }}>
        {selectedTrip ? (
          <ROTripDetail
            trip={selectedTrip} days={days} docs={docs} stays={stays}
            places={places} personnels={personnels}
            onBack={() => setSelectedTrip(null)}
          />
        ) : (
          <>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--ink)', marginBottom:4 }}>All trips</h1>
              <p style={{ fontSize:13, color:'var(--ink-light)' }}>{trips.length} trip{trips.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="trips-grid">
              {trips.map(trip => (
                <div key={trip.id} className="trip-card" onClick={() => setSelectedTrip(trip)}>
                  <div className={`trip-card-header ${trip.status}`}>
                    <span className="trip-flag">{trip.emoji}</span>
                    <StatusBadge status={trip.status}/>
                  </div>
                  <div className="trip-card-body">
                    <div className="trip-card-name">{trip.name}</div>
                    <div className="trip-card-dates">{trip.startDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)}` : 'No dates set'}</div>
                    <div className="trip-chips">
                      {days.filter(d=>d.tripId===trip.id).length > 0 && <span className="chip">📅 {days.filter(d=>d.tripId===trip.id).length} days</span>}
                      {docs.filter(d=>d.tripId===trip.id).length > 0 && <span className="chip">🎫 {docs.filter(d=>d.tripId===trip.id).length} tickets</span>}
                      {stays.filter(s=>s.tripId===trip.id).length > 0 && <span className="chip">🏨 {stays.filter(s=>s.tripId===trip.id).length} stays</span>}
                      {trip.budget && <span className="chip">💰 {trip.budget}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
