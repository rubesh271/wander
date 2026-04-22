import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { fmt, nights, catStyle } from './utils.js';
import { MapModal, Avatar, StatusBadge, TypeBadge, AttachmentChips, CategoryBadge } from './components/ui.jsx';

// ── CSV Parser ─────────────────────────────────────────────────────────────

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

async function fetchTab(sheetId, tabName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url + '&_=' + Date.now()); // cache-bust
    if (!res.ok) return [];
    return parseCSV(await res.text());
  } catch { return []; }
}

async function loadAllData(sheetId) {
  const [trips, days, docs, otherDocs, stays, places, personnels] = await Promise.all([
    fetchTab(sheetId, 'Trips'),
    fetchTab(sheetId, 'Days'),
    fetchTab(sheetId, 'Documents'),
    fetchTab(sheetId, 'OtherDocs'),
    fetchTab(sheetId, 'Stays'),
    fetchTab(sheetId, 'Places'),
    fetchTab(sheetId, 'Personnels'),
  ]);
  return { trips, days, docs, otherDocs, stays, places, personnels };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parsePeriod(text) {
  if (!text) return [];
  return text.split('·').map(seg => {
    const s = seg.trim();
    const m = s.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m ? { time: m[1], content: m[2] } : { time: '', content: s };
  }).filter(x => x.content);
}

const CAT_ICONS = {
  Passport:'🛂', Visa:'📋', 'Travel Insurance':'🛡️',
  'Health / Vaccination':'💉', Receipt:'🧾',
  'Booking Confirmation':'✅', Itinerary:'🗺️',
  'Emergency Contact':'🆘', Other:'📄'
};

// ── Day Card ───────────────────────────────────────────────────────────────

function DayCard({ day, places }) {
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const dayPlaces = places
    .filter(p => p.dayId === day.id)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const mapItems = dayPlaces.map(p => ({
    ...p, subtitle: p.time, badge: p.category,
    dotBg: catStyle(p.category).bg, dotColor: catStyle(p.category).color,
  }));

  return (
    <div className="day-card">
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
                      {place.mapsUrl && (
                        <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link">
                          <ExternalLink size={13}/>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="map-view-btn" style={{ marginTop:10, width:'100%', justifyContent:'center' }}
                onClick={() => setMapOpen(true)}>
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
        <MapModal
          title={`Day ${day.dayNumber} — ${day.title || 'Map'}`}
          subtitle={`${mapItems.length} places · ${fmt(day.date)}`}
          items={mapItems}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}

// ── Stay Card ──────────────────────────────────────────────────────────────

function StayCard({ stay, personnels }) {
  const [mapOpen, setMapOpen] = useState(false);
  const stayPersons = (stay.belongsTo || '').split(',').map(n => n.trim()).filter(Boolean);

  return (
    <div className="card" style={{ padding:'16px 18px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:600, color:'var(--ink)' }}>{stay.name}</div>
          <div style={{ fontSize:12, color:'var(--ink-light)', marginTop:2 }}>
            {fmt(stay.checkIn)} → {fmt(stay.checkOut)} · {nights(stay.checkIn, stay.checkOut)} nights
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <TypeBadge type={stay.type}/>
          {(stay.lat || stay.mapsUrl) && (
            <button className="stay-map-btn" onClick={() => setMapOpen(true)}><MapPin size={12}/> Map</button>
          )}
          {stay.mapsUrl && (
            <a href={stay.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={13}/>
            </a>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12, color:'var(--ink-mid)' }}>
        {stay.address && <div><span style={{color:'var(--ink-light)'}}>Address</span><br/>{stay.address}</div>}
        {stay.ref && <div><span style={{color:'var(--ink-light)'}}>Confirmation</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{stay.ref}</span></div>}
        {stay.cost && <div><span style={{color:'var(--ink-light)'}}>Cost</span><br/>{stay.cost} · {stay.paid === 'Yes' ? '✓ Prepaid' : 'Pay on arrival'}</div>}
        {stay.extras && <div><span style={{color:'var(--ink-light)'}}>Extras</span><br/>{stay.extras}</div>}
      </div>

      {stayPersons.length > 0 && (
        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'var(--ink-light)' }}>Staying:</span>
          {stayPersons.map((name, i) => (
            <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--ink-mid)' }}>
              <Avatar name={name} size={18} index={i}/>{name}
            </span>
          ))}
        </div>
      )}

      {stay.checkInNotes && (
        <div style={{ marginTop:10, padding:'8px 12px', background:'var(--amber-light)', borderRadius:8, fontSize:12, color:'var(--amber)' }}>
          <strong>Check-in:</strong> {stay.checkInNotes}
        </div>
      )}

      {mapOpen && (
        <MapModal
          title={stay.name}
          subtitle={`${fmt(stay.checkIn)} → ${fmt(stay.checkOut)} · ${nights(stay.checkIn, stay.checkOut)} nights`}
          items={[{ id:stay.id, name:stay.name, subtitle:stay.address, badge:stay.type, mapsUrl:stay.mapsUrl, lat:stay.lat, lng:stay.lng, notes:stay.checkInNotes, dotBg:'var(--teal-light)', dotColor:'var(--teal)' }]}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}

// ── Trip Detail ────────────────────────────────────────────────────────────

function TripDetail({ trip, data, onBack }) {
  const [tab, setTab] = useState('itinerary');
  const { days, docs, otherDocs, stays, places, personnels } = data;
  const n = nights(trip.startDate, trip.endDate);

  const tripDays      = days.filter(d => d.tripId === trip.id).sort((a,b) => Number(a.dayNumber)-Number(b.dayNumber));
  const tripDocs      = docs.filter(d => d.tripId === trip.id).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const tripOtherDocs = otherDocs.filter(d => d.tripId === trip.id);
  const tripStays     = stays.filter(s => s.tripId === trip.id).sort((a,b) => (a.checkIn||'').localeCompare(b.checkIn||''));
  const tripPersons   = personnels.filter(p => p.tripId === trip.id);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="back-btn" onClick={onBack}>← All trips</button>
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
        {/* Summary */}
        <div className="summary-row">
          {[
            ['Days', tripDays.length, `of ${n} nights`],
            ['Tickets', tripDocs.length, 'travel docs'],
            ['Stays', tripStays.length, 'bookings'],
            ['People', tripPersons.length, 'travelling'],
          ].map(([label, val, sub]) => (
            <div key={label} className="summary-card">
              <div className="summary-label">{label}</div>
              <div className="summary-value">{val}</div>
              <div className="summary-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['tickets','🎫 Tickets & docs'],['stays','🏨 Stays'],['people','👥 People']].map(([key, label]) => (
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {/* Itinerary */}
        {tab === 'itinerary' && (
          tripDays.length === 0
            ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days planned yet</h3></div>
            : <div className="days-list">
              {tripDays.map(day => <DayCard key={day.id} day={day} places={places}/>)}
            </div>
        )}

        {/* Tickets & docs — two sub-tabs */}
        {tab === 'tickets' && (
          <>
            <div className="sub-tab-bar" style={{ marginBottom:16 }}>
              <button className="sub-tab active" style={{ cursor:'default' }}>✈️ Travel docs</button>
            </div>

            {/* Travel docs table */}
            {tripDocs.length === 0
              ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>No tickets yet</h3></div>
              : <div className="card" style={{ overflow:'hidden', marginBottom:20 }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Belongs to</th><th>Cost</th><th>Status</th></tr></thead>
                  <tbody>
                    {tripDocs.map(doc => {
                      const pIdx = tripPersons.findIndex(p => p.name === doc.belongsTo);
                      return (
                        <tr key={doc.id}>
                          <td>
                            <div className="td-primary">{doc.name}</div>
                            <div style={{ marginTop:3, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                              <TypeBadge type={doc.type}/>
                              <AttachmentChips fileData={doc.fileData} fileLabel={doc.fileLabel} link={doc.link}/>
                            </div>
                          </td>
                          <td>{fmt(doc.date)}{doc.time ? ` · ${doc.time}` : ''}</td>
                          <td>{doc.fromTo || '—'}</td>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{doc.ref || '—'}</td>
                          <td>{doc.belongsTo
                            ? <span style={{display:'flex',alignItems:'center',gap:5}}><Avatar name={doc.belongsTo} size={20} index={pIdx}/><span style={{fontSize:12}}>{doc.belongsTo}</span></span>
                            : <span style={{fontSize:12,color:'var(--ink-faint)'}}>Everyone</span>}
                          </td>
                          <td>{doc.cost || '—'}</td>
                          <td><span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:doc.status==='Confirmed'?'var(--teal-light)':'var(--paper-warm)',color:doc.status==='Confirmed'?'var(--teal)':'var(--ink-mid)'}}>{doc.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }

            {/* Other docs */}
            {tripOtherDocs.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--ink-mid)', marginBottom:12 }}>📁 Other documents</div>
                <div className="other-docs-grid">
                  {tripOtherDocs.map(doc => (
                    <div key={doc.id} className="other-doc-card">
                      <div className="doc-icon">{CAT_ICONS[doc.category] || '📄'}</div>
                      <div className="doc-title">{doc.name}</div>
                      <div className="doc-meta">
                        <CategoryBadge cat={doc.category} label={doc.category}/>
                        {doc.expiryDate && (
                          <span style={{ marginLeft:6, fontSize:11, color: new Date(doc.expiryDate) < new Date() ? 'var(--rose)' : 'var(--ink-light)' }}>
                            Expires {fmt(doc.expiryDate)}
                          </span>
                        )}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12, color:'var(--ink-mid)', marginBottom:8 }}>
                        {doc.ref && <div><span style={{color:'var(--ink-light)'}}>Ref</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{doc.ref}</span></div>}
                        {doc.issuedBy && <div><span style={{color:'var(--ink-light)'}}>Issued by</span><br/>{doc.issuedBy}</div>}
                        {doc.belongsTo && <div><span style={{color:'var(--ink-light)'}}>Belongs to</span><br/>{doc.belongsTo}</div>}
                      </div>
                      {doc.notes && <div style={{ fontSize:12, color:'var(--ink-mid)', marginBottom:6, lineHeight:1.5 }}>{doc.notes}</div>}
                      <AttachmentChips fileData={doc.fileData} fileLabel={doc.fileLabel} link={doc.link}/>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Stays */}
        {tab === 'stays' && (
          tripStays.length === 0
            ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>No stays yet</h3></div>
            : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {tripStays.map(stay => <StayCard key={stay.id} stay={stay} personnels={tripPersons}/>)}
            </div>
        )}

        {/* People */}
        {tab === 'people' && (
          tripPersons.length === 0
            ? <div className="empty-state"><div className="empty-icon">👥</div><h3>No people listed</h3></div>
            : <div className="personnel-grid">
              {tripPersons.map((p, i) => {
                const { bg, color } = { bg:'#e8f5f0', color:'#1a7a5e', ...[{bg:'#e8f5f0',color:'#1a7a5e'},{bg:'#f0edf8',color:'#5a4a8a'},{bg:'#fdf3e3',color:'#c47a1e'},{bg:'#fdf0ef',color:'#c0524a'}][i%4] };
                const ini = p.name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
                return (
                  <div key={p.id} className="personnel-card">
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div className="personnel-avatar-lg" style={{ background:bg, color }}>{ini}</div>
                      <div>
                        <div className="personnel-name">{p.name}</div>
                        <div className="personnel-role">{p.role}</div>
                      </div>
                    </div>
                    {p.email && <div className="personnel-detail" style={{marginTop:8}}>✉️ {p.email}</div>}
                    {p.phone && <div className="personnel-detail">📞 {p.phone}</div>}
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
  const [error, setError]     = useState(null);
  const [data, setData]       = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [filter, setFilter]   = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await loadAllData(sheetId);
      if (result.trips.length === 0) {
        setError('No trips found. Make sure your Google Sheet is published (File → Share → Publish to web) and has data in the Trips tab.');
      } else {
        setData(result);
        // Refresh selected trip if open
        if (selectedTrip) {
          const updated = result.trips.find(t => t.id === selectedTrip.id);
          if (updated) setSelectedTrip(updated);
          else setSelectedTrip(null); // deleted
        }
      }
    } catch {
      setError('Could not load data. Check that your Google Sheet is published to the web.');
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [sheetId]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, color:'var(--ink-light)' }}>
      <div style={{ fontSize:40 }}>✈️</div>
      <div style={{ fontSize:14 }}>Loading trips…</div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, color:'var(--ink-light)', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:36 }}>⚠️</div>
      <div style={{ fontSize:14, maxWidth:420, lineHeight:1.6 }}>{error}</div>
      <button className="btn" onClick={() => load()}>Try again</button>
    </div>
  );

  const { trips } = data;
  const filtered = trips.filter(t => filter === 'all' || t.status === filter);

  return (
    <div style={{ minHeight:'100vh', background:'var(--paper)' }}>
      {/* Header */}
      <div style={{ background:'var(--ink)', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--paper)', cursor: selectedTrip ? 'pointer' : 'default' }}
          onClick={() => setSelectedTrip(null)}>
          ✈ Wander
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', textTransform:'uppercase' }}>View only</span>
          <button onClick={() => load(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:4, fontSize:12, padding:'4px 8px', borderRadius:6 }}
            title="Refresh data from Sheet">
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/> Refresh
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {selectedTrip ? (
        <div className="main" style={{ height:'calc(100vh - 49px)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <TripDetail trip={selectedTrip} data={data} onBack={() => setSelectedTrip(null)}/>
        </div>
      ) : (
        <div style={{ maxWidth:960, margin:'0 auto', padding:'28px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ fontFamily:'var(--font-display)', fontSize:24, color:'var(--ink)', marginBottom:3 }}>All trips</h1>
              <p style={{ fontSize:13, color:'var(--ink-light)' }}>{trips.length} trip{trips.length !== 1 ? 's' : ''}</p>
            </div>
            {/* Filter pills */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[['all','All'],['upcoming','Upcoming'],['planning','Planning'],['dream','Dream'],['done','Done']].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, border:'1px solid var(--border-mid)', background: filter===key ? 'var(--ink)' : 'var(--paper-card)', color: filter===key ? 'var(--paper)' : 'var(--ink-mid)', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0
            ? <div className="empty-state"><div className="empty-icon">🌍</div><h3>No trips in this category</h3></div>
            : <div className="trips-grid">
              {filtered.map(trip => (
                <div key={trip.id} className="trip-card" onClick={() => setSelectedTrip(trip)}>
                  <div className={`trip-card-header ${trip.status}`}>
                    <span className="trip-flag">{trip.emoji}</span>
                    <StatusBadge status={trip.status}/>
                  </div>
                  <div className="trip-card-body">
                    <div className="trip-card-name">{trip.name}</div>
                    <div className="trip-card-dates">
                      {trip.startDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)}` : 'No dates set'}
                    </div>
                    <div className="trip-chips">
                      {data.days.filter(d=>d.tripId===trip.id).length > 0 && <span className="chip">📅 {data.days.filter(d=>d.tripId===trip.id).length} days</span>}
                      {data.docs.filter(d=>d.tripId===trip.id).length > 0 && <span className="chip">🎫 {data.docs.filter(d=>d.tripId===trip.id).length} tickets</span>}
                      {data.stays.filter(s=>s.tripId===trip.id).length > 0 && <span className="chip">🏨 {data.stays.filter(s=>s.tripId===trip.id).length} stays</span>}
                      {trip.budget && <span className="chip">💰 {trip.budget}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}
