import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Search, Compass, Navigation } from 'lucide-react';
import { fmt, fmtDay, fmtShort, nights, catStyle } from './utils.js';
import { MapModal, Avatar, StatusBadge, TypeBadge, AttachmentChips, CategoryBadge } from './components/ui.jsx';

function parseTime(t) {
  if (!t) return 9999;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ── CSV ────────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
  return lines.slice(1).map(line => {
    const values = []; let cur='', inQ=false;
    for (let i=0;i<line.length;i++) {
      if (line[i]==='"'){inQ=!inQ;continue;}
      if (line[i]===','&&!inQ){values.push(cur.trim());cur='';continue;}
      cur+=line[i];
    }
    values.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{obj[h]=values[i]||'';});
    return obj;
  }).filter(r=>Object.values(r).some(v=>v));
}

async function fetchTab(sheetId, tab) {
  try {
    const url=`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;
    const res=await fetch(url);
    if(!res.ok) return [];
    return parseCSV(await res.text());
  } catch { return []; }
}

async function loadAll(sheetId) {
  const [trips,days,docs,otherDocs,stays,places,personnels]=await Promise.all([
    fetchTab(sheetId,'Trips'), fetchTab(sheetId,'Days'),
    fetchTab(sheetId,'TravelTickets'), fetchTab(sheetId,'OtherDocs'),
    fetchTab(sheetId,'Stays'), fetchTab(sheetId,'Places'),
    fetchTab(sheetId,'Personnels'),
  ]);
  return {trips,days,docs,otherDocs,stays,places,personnels};
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parsePeriod(text) {
  if(!text) return [];
  return text.split('·').map(seg=>{
    const s=seg.trim(), m=s.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m?{time:m[1],content:m[2]}:{time:'',content:s};
  }).filter(x=>x.content);
}

function getTripProgress(trip) {
  if(!trip.startDate||!trip.endDate) return null;
  const now=new Date(), start=new Date(trip.startDate), end=new Date(trip.endDate);
  if(now<start||now>end) return null;
  const total=end-start, elapsed=now-start;
  const dayNum=Math.ceil(elapsed/86400000);
  const totalDays=Math.round(total/86400000);
  return {dayNum,totalDays,pct:Math.min(100,Math.round(elapsed/total*100))};
}

function isToday(dateStr) {
  if(!dateStr) return false;
  const d=new Date(dateStr), n=new Date();
  return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
}

function isFuture(dateStr) { return dateStr && new Date(dateStr) > new Date(); }

const CAT_ICONS={Passport:'🛂',Visa:'📋','Travel Insurance':'🛡️','Health / Vaccination':'💉',Receipt:'🧾','Booking Confirmation':'✅',Itinerary:'🗺️','Emergency Contact':'🆘',Other:'📄'};

// ── Transport mode helpers ─────────────────────────────────────────────────

const MODES = [
  { key:'walking',  label:'Walk',    icon:'🚶', gMode:'walking'  },
  { key:'transit',  label:'Transit', icon:'🚇', gMode:'transit'  },
  { key:'driving',  label:'Drive',   icon:'🚗', gMode:'driving'  },
];

function buildLegUrl(from, to, mode) {
  function pointStr(place) {
    if (place.lat && place.lng) return `${place.lat},${place.lng}`;
    if (place.mapsUrl) {
      const qMatch = place.mapsUrl.match(/[?&]q=([^&]+)/);
      if (qMatch) return decodeURIComponent(qMatch[1]);
    }
    return encodeURIComponent(place.name);
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${pointStr(from)}&destination=${pointStr(to)}&travelmode=${mode}`;
}

function buildFullRouteUrl(places, mode='walking') {
  const pts = places.filter(p => p.name);
  if (pts.length < 2) return null;
  function pointStr(place) {
    if (place.lat && place.lng) return `${place.lat},${place.lng}`;
    if (place.mapsUrl) {
      const qMatch = place.mapsUrl.match(/[?&]q=([^&]+)/);
      if (qMatch) return decodeURIComponent(qMatch[1]);
    }
    return encodeURIComponent(place.name);
  }
  const origin = pointStr(pts[0]);
  const dest   = pointStr(pts[pts.length-1]);
  const wps    = pts.slice(1,-1).map(pointStr).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps?`&waypoints=${wps}`:''}&travelmode=${mode}`;
}

// ── Day Plan Panel ─────────────────────────────────────────────────────────

function DayPlanPanel({ places, onClose }) {
  const [fullMode, setFullMode] = useState('walking');
  const fullUrl = buildFullRouteUrl(places, fullMode);

  return (
    <div style={{ background:'var(--paper-warm)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginTop:12, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'var(--paper-card)' }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)', display:'flex', alignItems:'center', gap:6 }}>
          <Navigation size={14} color="var(--teal)"/> Day plan
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Full route mode selector */}
          <div style={{ display:'flex', gap:4 }}>
            {MODES.map(m => (
              <button key={m.key} onClick={()=>setFullMode(m.key)}
                style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background: fullMode===m.key ? 'var(--teal)' : 'var(--paper-card)', color: fullMode===m.key ? 'white' : 'var(--ink-mid)', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.12s' }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          {fullUrl && (
            <a href={fullUrl} target="_blank" rel="noreferrer"
              style={{ fontSize:12, padding:'5px 12px', borderRadius:'var(--radius)', background:'var(--teal)', color:'white', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:500, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}>
              <Navigation size={12}/> Full route ↗
            </a>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'2px 6px' }}>✕</button>
        </div>
      </div>

      {/* Leg-by-leg plan */}
      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:0 }}>
        {places.map((place, i) => {
          const next = places[i+1];
          const cs = catStyle(place.category);
          return (
            <div key={place.id}>
              {/* Place row */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:cs.bg, color:cs.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{place.name}</div>
                  <div style={{ fontSize:11, color:'var(--ink-light)', display:'flex', gap:6, alignItems:'center' }}>
                    {place.time && <span style={{ fontFamily:'var(--font-mono)' }}>{place.time}</span>}
                    <span style={{ background:cs.bg, color:cs.color, padding:'1px 6px', borderRadius:8, fontSize:10, fontWeight:500 }}>{place.category}</span>
                  </div>
                </div>
                {place.mapsUrl && (
                  <a href={place.mapsUrl} target="_blank" rel="noreferrer" title="Open in Maps"
                    style={{ color:'var(--teal)', display:'flex', alignItems:'center', flexShrink:0 }}>
                    <ExternalLink size={13}/>
                  </a>
                )}
              </div>

              {/* Transport leg to next place */}
              {next && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0 4px 14px', marginLeft:14, borderLeft:'2px dashed var(--border-mid)' }}>
                  <div style={{ display:'flex', gap:4, marginLeft:8 }}>
                    {MODES.map(m => (
                      <a key={m.key}
                        href={buildLegUrl(place, next, m.gMode)}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border-mid)', background:'var(--paper-card)', color:'var(--ink-mid)', cursor:'pointer', fontFamily:'var(--font-body)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3, transition:'all 0.12s' }}
                        title={`${m.label} from ${place.name} to ${next.name}`}>
                        {m.icon} {m.label} ↗
                      </a>
                    ))}
                  </div>
                  <span style={{ fontSize:11, color:'var(--ink-faint)' }}>→ {next.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Drive Button ───────────────────────────────────────────────────────────

function DriveBtn({ link, label='View document' }) {
  if (!link) return null;
  const isDrive = link.includes('drive.google') || link.includes('docs.google');
  const isDropbox = link.includes('dropbox');
  const icon = isDrive ? '📄' : isDropbox ? '📦' : '🔗';
  const name = isDrive ? 'Google Drive' : isDropbox ? 'Dropbox' : 'View file';
  return (
    <a href={link} target="_blank" rel="noreferrer" className="drive-btn">
      {icon} {name} ↗
    </a>
  );
}

// ── Today Banner ───────────────────────────────────────────────────────────

function TodayBanner({ data, onTripClick }) {
  const { trips, days, stays, docs } = data;
  const today = new Date();

  // Find active trip
  const activeTrip = trips.find(t => {
    if (!t.startDate || !t.endDate) return false;
    return new Date(t.startDate) <= today && new Date(t.endDate) >= today;
  });

  if (!activeTrip) {
    // Check if there's an upcoming trip in the next 7 days
    const upcoming = trips
      .filter(t => t.startDate && new Date(t.startDate) > today)
      .sort((a,b) => new Date(a.startDate)-new Date(b.startDate))[0];
    if (!upcoming) return null;
    const daysUntil = Math.ceil((new Date(upcoming.startDate)-today)/86400000);
    return (
      <div className="today-banner" style={{ background:'linear-gradient(135deg, #5a4a8a 0%, #3c3270 100%)' }} onClick={() => onTripClick(upcoming)}>
        <div className="today-label">Coming up</div>
        <div className="today-title">{upcoming.emoji} {upcoming.name}</div>
        <div className="today-meta">Starts in {daysUntil} day{daysUntil!==1?'s':''} · {fmt(upcoming.startDate)}</div>
      </div>
    );
  }

  const progress = getTripProgress(activeTrip);
  const todayDay = days.find(d => d.tripId === activeTrip.id && isToday(d.date));
  const tonightStay = stays.find(s => s.tripId === activeTrip.id && new Date(s.checkIn) <= today && new Date(s.checkOut) >= today);
  const nextFlight = docs.find(d => d.tripId === activeTrip.id && d.type === 'Flight' && isFuture(d.date));

  return (
    <div className="today-banner fade-in" onClick={() => onTripClick(activeTrip)} style={{ cursor:'pointer' }}>
      <div className="today-label">✈ You are currently travelling</div>
      <div className="today-title">{activeTrip.emoji} {activeTrip.name}</div>
      {progress && <div className="today-meta">Day {progress.dayNum} of {progress.totalDays} · {progress.pct}% complete</div>}
      <div className="today-chips">
        {todayDay && <span className="today-chip">📅 Today: {todayDay.title}</span>}
        {tonightStay && <span className="today-chip">🏨 {tonightStay.name}</span>}
        {nextFlight && <span className="today-chip">✈ {nextFlight.fromTo} on {fmt(nextFlight.date)}</span>}
      </div>
      {progress && (
        <div style={{ marginTop:12 }}>
          <div style={{ height:3, background:'rgba(255,255,255,0.2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress.pct}%`, background:'rgba(255,255,255,0.7)', borderRadius:2, transition:'width 1s ease' }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day Card ───────────────────────────────────────────────────────────────

function DayCard({ day, places }) {
  const [open, setOpen] = useState(isToday(day.date));
  const [mapOpen, setMapOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const dayPlaces = places.filter(p=>p.dayId===day.id).sort((a,b)=>parseTime(a.time)-parseTime(b.time));
  const mapItems = dayPlaces.map(p=>({...p,subtitle:p.time,badge:p.category,dotBg:catStyle(p.category).bg,dotColor:catStyle(p.category).color}));
  const isActiveDay = isToday(day.date);

  return (
    <div className="day-card fade-in" style={{ border: isActiveDay ? '2px solid var(--teal)' : undefined }}>
      <div className="day-card-header" onClick={()=>setOpen(!open)} style={{ cursor:'pointer' }}>
        <div className="day-number" style={{ color: isActiveDay ? 'var(--teal)' : undefined }}>{day.dayNumber}</div>
        <div className="day-card-meta">
          <div className="day-card-title">
            {isActiveDay && <span style={{ fontSize:10, background:'var(--teal)', color:'white', padding:'2px 6px', borderRadius:10, marginRight:6, verticalAlign:'middle' }}>TODAY</span>}
            {day.title || `Day ${day.dayNumber}`}
          </div>
          <div className="day-card-date">{fmtDay(day.date)}{day.location ? ` · ${day.location}` : ''}</div>
        </div>
        <div style={{ display:'flex', gap:5, marginLeft:'auto', alignItems:'center', flexShrink:0 }}>
          {dayPlaces.length > 1 && (
            <button className="map-view-btn"
              style={{ padding:'5px 9px', fontSize:11, background:'var(--purple)', cursor:'pointer' }}
              onClick={e=>{ e.stopPropagation(); setPlanOpen(!planOpen); setOpen(true); }}>
              <Navigation size={12}/> Day plan
            </button>
          )}
          {dayPlaces.length > 0 && (
            <button className="map-view-btn"
              style={{ padding:'5px 9px', fontSize:11 }}
              onClick={e=>{ e.stopPropagation(); setMapOpen(true); }}>
              <MapPin size={12}/> Map
            </button>
          )}
          {open ? <ChevronUp size={14} color="var(--ink-faint)"/> : <ChevronDown size={14} color="var(--ink-faint)"/>}
        </div>
      </div>

      {open && (
        <div className="day-card-body">
          {[['☀️ Morning',day.morning],['🌤 Afternoon',day.afternoon],['🌙 Evening',day.evening]].map(([label,text])=>
            text ? (<div key={label}><div className="period-label">{label}</div>{parsePeriod(text).map((slot,i)=>(
              <div key={i} className="time-slot"><span className="time-label">{slot.time}</span><span className="time-content">{slot.content}</span></div>
            ))}</div>) : null
          )}

          {dayPlaces.length > 0 && (
            <div style={{marginTop:12}}>
              <div className="period-label">📍 Places</div>
              <div className="places-list">
                {dayPlaces.map(place=>{
                  const cs=catStyle(place.category);
                  return (
                    <div key={place.id} className="place-row">
                      <span className="place-time">{place.time||'—'}</span>
                      <span className="place-dot" style={{background:cs.dot}}/>
                      <div className="place-info">
                        <div className="place-name">{place.name}</div>
                        {place.notes&&<div className="place-note">{place.notes}</div>}
                      </div>
                      <span className="place-cat" style={{background:cs.bg,color:cs.color}}>{place.category}</span>
                      {place.mapsUrl&&<a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link"><ExternalLink size={13}/></a>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button className="map-view-btn" style={{ flex:1, justifyContent:'center' }} onClick={()=>setMapOpen(true)}>
                  <MapPin size={13}/> View on map
                </button>
                {dayPlaces.length > 1 && (
                  <button className="map-view-btn" style={{ flex:1, justifyContent:'center', background:'var(--purple)' }} onClick={()=>setPlanOpen(!planOpen)}>
                    <Navigation size={13}/> {planOpen ? 'Hide' : 'Day plan'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Day Plan Panel */}
          {planOpen && dayPlaces.length > 1 && (
            <DayPlanPanel places={dayPlaces} onClose={()=>setPlanOpen(false)}/>
          )}

          {(day.transport||day.notes)&&<div style={{marginTop:12,padding:'10px 12px',background:'var(--paper-warm)',borderRadius:8,fontSize:12,color:'var(--ink-mid)',lineHeight:1.6}}>{day.transport&&<div><strong>Transport:</strong> {day.transport}</div>}{day.notes&&<div style={{marginTop:4}}><strong>Notes:</strong> {day.notes}</div>}</div>}
        </div>
      )}
      {mapOpen&&mapItems.length>0&&<MapModal title={`Day ${day.dayNumber} — ${day.title||'Map'}`} subtitle={`${mapItems.length} places · ${fmtDay(day.date)}`} items={mapItems} onClose={()=>setMapOpen(false)}/>}
    </div>
  );
}

// ── Stay Card ──────────────────────────────────────────────────────────────

function StayCard({ stay, personnels }) {
  const [mapOpen, setMapOpen] = useState(false);
  const stayPersons = (stay.belongsTo||'').split(',').map(n=>n.trim()).filter(Boolean);
  const isActive = stay.checkIn && stay.checkOut && new Date(stay.checkIn)<=new Date() && new Date(stay.checkOut)>=new Date();

  return (
    <div className="card fade-in" style={{ padding:'16px 18px', border: isActive ? '2px solid var(--teal)' : undefined }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          {isActive && <span style={{fontSize:10,background:'var(--teal)',color:'white',padding:'2px 6px',borderRadius:10,marginBottom:4,display:'inline-block'}}>TONIGHT</span>}
          <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--ink)'}}>{stay.name}</div>
          <div style={{fontSize:12,color:'var(--ink-light)',marginTop:2}}>{fmt(stay.checkIn)} → {fmt(stay.checkOut)} · {nights(stay.checkIn,stay.checkOut)} nights</div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
          <TypeBadge type={stay.type}/>
          {(stay.lat||stay.mapsUrl)&&<button className="stay-map-btn" onClick={()=>setMapOpen(true)}><MapPin size={12}/> Map</button>}
          {stay.mapsUrl&&<a href={stay.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13}/></a>}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:12,color:'var(--ink-mid)'}}>
        {stay.address&&<div><span style={{color:'var(--ink-light)'}}>Address</span><br/>{stay.address}</div>}
        {stay.ref&&<div><span style={{color:'var(--ink-light)'}}>Confirmation</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{stay.ref}</span></div>}
        {stay.cost&&<div><span style={{color:'var(--ink-light)'}}>Cost</span><br/>{stay.cost} · {stay.paid==='Yes'?'✓ Prepaid':'Pay on arrival'}</div>}
        {stay.extras&&<div><span style={{color:'var(--ink-light)'}}>Extras</span><br/>{stay.extras}</div>}
      </div>
      {stayPersons.length>0&&<div style={{marginTop:10,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><span style={{fontSize:11,color:'var(--ink-light)'}}>Staying:</span>{stayPersons.map((name,i)=><span key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'var(--ink-mid)'}}><Avatar name={name} size={18} index={i}/>{name}</span>)}</div>}
      {stay.checkInNotes&&<div style={{marginTop:10,padding:'8px 12px',background:'var(--amber-light)',borderRadius:8,fontSize:12,color:'var(--amber)'}}><strong>Check-in:</strong> {stay.checkInNotes}</div>}
      {stay.bookingLink&&<div style={{marginTop:10}}><DriveBtn link={stay.bookingLink} label="View booking confirmation"/></div>}
      {stay.link&&<div style={{marginTop:6}}><DriveBtn link={stay.link} label="View document"/></div>}
      {mapOpen&&<MapModal title={stay.name} subtitle={`${fmt(stay.checkIn)} → ${fmt(stay.checkOut)}`} items={[{id:stay.id,name:stay.name,subtitle:stay.address,badge:stay.type,mapsUrl:stay.mapsUrl,lat:stay.lat,lng:stay.lng,notes:stay.checkInNotes,dotBg:'var(--teal-light)',dotColor:'var(--teal)'}]} onClose={()=>setMapOpen(false)}/>}
    </div>
  );
}

// ── Trip Detail ────────────────────────────────────────────────────────────

function TripDetail({ trip, data, onBack }) {
  const [tab, setTab] = useState('itinerary');
  const [docSubTab, setDocSubTab] = useState('travel');
  const [search, setSearch] = useState('');
  const { days, docs, otherDocs, stays, places, personnels } = data;
  const n = nights(trip.startDate, trip.endDate);

  const tripDays = days.filter(d=>d.tripId===trip.id).sort((a,b)=>Number(a.dayNumber)-Number(b.dayNumber));
  const tripDocs = docs.filter(d=>d.tripId===trip.id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const tripOtherDocs = otherDocs.filter(d=>d.tripId===trip.id);
  const tripStays = stays.filter(s=>s.tripId===trip.id).sort((a,b)=>(a.checkIn||'').localeCompare(b.checkIn||''));
  const tripPersons = personnels.filter(p=>p.tripId===trip.id);

  const q = search.toLowerCase();
  const filteredDocs = tripDocs.filter(d => !q || Object.values(d).some(v=>String(v).toLowerCase().includes(q)));
  const filteredOtherDocs = tripOtherDocs.filter(d => !q || Object.values(d).some(v=>String(v).toLowerCase().includes(q)));
  const filteredStays = tripStays.filter(s => !q || Object.values(s).some(v=>String(v).toLowerCase().includes(q)));

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 53px)',overflow:'hidden'}}>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
          <button className="back-btn" onClick={onBack}>← Trips</button>
          <span style={{fontSize:24,flexShrink:0}}>{trip.emoji}</span>
          <div style={{minWidth:0}}>
            <div className="detail-title" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trip.name}</div>
            <div className="detail-meta">{trip.startDate?`${fmt(trip.startDate)} — ${fmt(trip.endDate)} · ${n} nights`:'No dates set'}{trip.budget?` · ${trip.budget}`:''}</div>
          </div>
        </div>
        <StatusBadge status={trip.status}/>
      </div>

      <div className="content-area">
        <div className="summary-row">
          {[['📅 Days',tripDays.length,`of ${n} nights`],['🎫 Tickets',tripDocs.length,'travel docs'],['🏨 Stays',tripStays.length,'bookings'],['👥 People',tripPersons.length,'travelling']].map(([label,val,sub])=>(
            <div key={label} className="summary-card"><div className="summary-label">{label}</div><div className="summary-value">{val}</div><div className="summary-sub">{sub}</div></div>
          ))}
        </div>

        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['tickets','🎫 Tickets & docs'],['stays','🏨 Stays'],['people','👥 People']].map(([key,label])=>(
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={()=>{setTab(key);setSearch('');}}>{label}</button>
          ))}
        </div>

        {/* Search — shown on tickets and stays */}
        {(tab==='tickets'||tab==='stays') && (
          <div className="search-bar-wrap">
            <Search size={15}/>
            <input className="search-input" placeholder="Search anything…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        )}

        {/* ITINERARY */}
        {tab==='itinerary' && (
          tripDays.length===0
            ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days planned yet</h3><p>Add days to the Days tab in your Google Sheet.</p></div>
            : <div className="days-list">{tripDays.map(day=><DayCard key={day.id} day={day} places={places}/>)}</div>
        )}

        {/* TICKETS */}
        {tab==='tickets' && (
          <>
            <div className="sub-tab-bar">
              <button className={`sub-tab ${docSubTab==='travel'?'active':''}`} onClick={()=>setDocSubTab('travel')}>✈️ Travel docs</button>
              <button className={`sub-tab ${docSubTab==='other'?'active':''}`} onClick={()=>setDocSubTab('other')}>📁 Other docs</button>
            </div>

            {docSubTab==='travel' && (
              filteredDocs.length===0
                ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>{q?'No results':'No travel docs yet'}</h3></div>
                : <div className="card" style={{overflow:'hidden'}}>
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Belongs to</th><th>Cost</th><th>Doc</th></tr></thead>
                    <tbody>
                      {filteredDocs.map(doc=>{
                        const pIdx=tripPersons.findIndex(p=>p.name===doc.belongsTo);
                        return (
                          <tr key={doc.id}>
                            <td><div className="td-primary">{doc.name}</div><div style={{marginTop:3}}><TypeBadge type={doc.type}/></div></td>
                            <td>{fmt(doc.date)}{doc.time?` · ${doc.time}`:''}</td>
                            <td>{doc.fromTo||'—'}</td>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{doc.ref||'—'}</td>
                            <td>{doc.belongsTo?<span style={{display:'flex',alignItems:'center',gap:5}}><Avatar name={doc.belongsTo} size={18} index={pIdx}/><span style={{fontSize:12}}>{doc.belongsTo}</span></span>:<span style={{fontSize:12,color:'var(--ink-faint)'}}>Everyone</span>}</td>
                            <td>{doc.cost||'—'}</td>
                            <td>{doc.link?<DriveBtn link={doc.link}/>:<span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:doc.status==='Confirmed'?'var(--teal-light)':'var(--paper-warm)',color:doc.status==='Confirmed'?'var(--teal)':'var(--ink-mid)'}}>{doc.status}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            )}

            {docSubTab==='other' && (
              filteredOtherDocs.length===0
                ? <div className="empty-state"><div className="empty-icon">📁</div><h3>{q?'No results':'No documents yet'}</h3><p>Add passports, visas, insurance and more to the OtherDocs sheet tab.</p></div>
                : <div className="other-docs-grid">
                  {filteredOtherDocs.map(doc=>(
                    <div key={doc.id} className="other-doc-card fade-in">
                      <div className="doc-icon">{CAT_ICONS[doc.category]||'📄'}</div>
                      <div className="doc-title">{doc.name}</div>
                      <div className="doc-meta">
                        <CategoryBadge cat={doc.category} label={doc.category}/>
                        {doc.expiryDate&&<span style={{fontSize:11,color:new Date(doc.expiryDate)<new Date()?'var(--rose)':'var(--ink-light)'}}>Expires {fmt(doc.expiryDate)}</span>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,color:'var(--ink-mid)',marginBottom:8}}>
                        {doc.ref&&<div><span style={{color:'var(--ink-light)'}}>Ref</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{doc.ref}</span></div>}
                        {doc.issuedBy&&<div><span style={{color:'var(--ink-light)'}}>Issued by</span><br/>{doc.issuedBy}</div>}
                        {doc.belongsTo&&<div><span style={{color:'var(--ink-light)'}}>Belongs to</span><br/>{doc.belongsTo}</div>}
                      </div>
                      {doc.notes&&<div style={{fontSize:12,color:'var(--ink-mid)',marginBottom:8,lineHeight:1.5}}>{doc.notes}</div>}
                      {doc.link&&<DriveBtn link={doc.link}/>}
                    </div>
                  ))}
                </div>
            )}
          </>
        )}

        {/* STAYS */}
        {tab==='stays' && (
          filteredStays.length===0
            ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>{q?'No results':'No stays yet'}</h3></div>
            : <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {filteredStays.map(stay=><StayCard key={stay.id} stay={stay} personnels={tripPersons}/>)}
            </div>
        )}

        {/* PEOPLE */}
        {tab==='people' && (
          tripPersons.length===0
            ? <div className="empty-state"><div className="empty-icon">👥</div><h3>No people listed</h3><p>Add people to the Personnels tab in your Sheet.</p></div>
            : <div className="personnel-grid">
              {tripPersons.map((p,i)=>{
                const colors=[{bg:'#e8f5f0',color:'#1a7a5e'},{bg:'#f0edf8',color:'#5a4a8a'},{bg:'#fdf3e3',color:'#c47a1e'},{bg:'#fdf0ef',color:'#c0524a'},{bg:'#e6f1fb',color:'#185fa5'}];
                const {bg,color}=colors[i%colors.length];
                const ini=p.name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
                return (
                  <div key={p.id} className="personnel-card fade-in">
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div className="personnel-avatar-lg" style={{background:bg,color}}>{ini}</div>
                      <div><div className="personnel-name">{p.name}</div><div className="personnel-role">{p.role}</div></div>
                    </div>
                    {p.email&&<div className="personnel-detail" style={{marginTop:8}}>✉️ {p.email}</div>}
                    {p.phone&&<div className="personnel-detail">📞 {p.phone}</div>}
                  </div>
                );
              })}
            </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function SharedView({ sheetId }) {
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [data,     setData]     = useState(null);
  const [cached,   setCached]   = useState(null); // offline fallback
  const [offline,  setOffline]  = useState(!navigator.onLine);
  const [trip,     setTrip]     = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mobileTab, setMobileTab] = useState('trips');

  const CACHE_KEY = `wander_cache_${sheetId}`;

  async function load(silent=false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await loadAll(sheetId);
      if (result.trips.length===0 && !navigator.onLine) {
        // Use cache
        const c = localStorage.getItem(CACHE_KEY);
        if (c) { setData(JSON.parse(c)); setOffline(true); }
        else setError('No internet connection and no cached data found.');
      } else if (result.trips.length===0) {
        setError('No trips found. Make sure your Sheet is published (File → Share → Publish to web) and has data in the Trips tab.');
      } else {
        setData(result);
        localStorage.setItem(CACHE_KEY, JSON.stringify(result)); // cache for offline
        if (trip) {
          const updated = result.trips.find(t=>t.id===trip.id);
          setTrip(updated||null);
        }
      }
    } catch {
      const c = localStorage.getItem(CACHE_KEY);
      if (c) { setData(JSON.parse(c)); setOffline(true); }
      else setError('Could not load data. Check your internet connection and that the Sheet is published.');
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(()=>{ load(); },[sheetId]);

  useEffect(()=>{
    const on=()=>setOffline(false), off=()=>setOffline(true);
    window.addEventListener('online',on); window.addEventListener('offline',off);
    return()=>{ window.removeEventListener('online',on); window.removeEventListener('offline',off); };
  },[]);

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16,background:'var(--paper)'}}>
      <div style={{fontSize:48}}>✈️</div>
      <div style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--ink)'}}>Wander</div>
      <div style={{fontSize:13,color:'var(--ink-light)'}}>Loading your trips…</div>
    </div>
  );

  if (error) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:12,color:'var(--ink-light)',padding:24,textAlign:'center'}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:14,maxWidth:440,lineHeight:1.7,color:'var(--ink-mid)'}}>{error}</div>
      <button className="btn btn-teal" onClick={()=>load()}>Try again</button>
    </div>
  );

  const { trips } = data;
  const q = search.toLowerCase();
  const filtered = trips.filter(t=>(filter==='all'||t.status===filter) && (!q||t.name?.toLowerCase().includes(q)||t.destinations?.toLowerCase().includes(q)));

  return (
    <div style={{minHeight:'100vh',background:'var(--paper)'}}>
      {offline && <div className="offline-banner">⚠️ You're offline — showing cached data from your last visit</div>}

      {/* Header */}
      <div style={{background:'var(--ink)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--paper)',cursor:trip?'pointer':'default',letterSpacing:'0.02em'}} onClick={()=>setTrip(null)}>
          ✈ Wander
        </div>
        <button onClick={()=>load(true)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',gap:5,fontSize:12,padding:'5px 10px',borderRadius:6,transition:'color 0.15s'}}
          title="Refresh from Sheet">
          <RefreshCw size={13} style={{animation:refreshing?'spin 1s linear infinite':'none'}}/> Refresh
        </button>
      </div>

      {trip ? (
        <TripDetail trip={trip} data={data} onBack={()=>setTrip(null)}/>
      ) : (
        <div style={{maxWidth:960,margin:'0 auto',padding:'24px 20px 90px'}}>
          {/* Today banner */}
          <TodayBanner data={data} onTripClick={setTrip}/>

          {/* Search */}
          <div className="search-bar-wrap">
            <Search size={15}/>
            <input className="search-input" placeholder="Search trips by name or destination…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          {/* Filter pills */}
          <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
            {[['all','All'],['upcoming','Upcoming'],['planning','Planning'],['dream','Dream'],['done','Done']].map(([key,label])=>(
              <button key={key} onClick={()=>setFilter(key)} style={{padding:'5px 12px',borderRadius:20,fontSize:12,border:'1px solid var(--border-mid)',background:filter===key?'var(--ink)':'var(--paper-card)',color:filter===key?'var(--paper)':'var(--ink-mid)',cursor:'pointer',fontFamily:'var(--font-body)',transition:'all 0.15s'}}>
                {label}
              </button>
            ))}
          </div>

          {filtered.length===0
            ? <div className="empty-state"><div className="empty-icon">🌍</div><h3>No trips found</h3><p>{q?'Try a different search.':'No trips in this category yet.'}</p></div>
            : <div className="trips-grid">
              {filtered.map(trip=>{
                const progress = getTripProgress(trip);
                const tripDays = data.days.filter(d=>d.tripId===trip.id);
                const tripDocs = data.docs.filter(d=>d.tripId===trip.id);
                const tripStays = data.stays.filter(s=>s.tripId===trip.id);
                return (
                  <div key={trip.id} className="trip-card fade-in" onClick={()=>setTrip(trip)}>
                    <div className={`trip-card-header ${trip.status}`}>
                      <span className="trip-flag">{trip.emoji}</span>
                      <StatusBadge status={trip.status}/>
                    </div>
                    <div className="trip-card-body">
                      <div className="trip-card-name">{trip.name}</div>
                      <div className="trip-card-dates">{trip.startDate?`${fmt(trip.startDate)} — ${fmt(trip.endDate)}`:'No dates set'}</div>
                      <div className="trip-chips">
                        {tripDays.length>0&&<span className="chip">📅 {tripDays.length} days</span>}
                        {tripDocs.length>0&&<span className="chip">🎫 {tripDocs.length} tickets</span>}
                        {tripStays.length>0&&<span className="chip">🏨 {tripStays.length} stays</span>}
                        {trip.budget&&<span className="chip">💰 {trip.budget}</span>}
                      </div>
                      {progress && (
                        <div className="trip-progress">
                          <div className="progress-label">Day {progress.dayNum} of {progress.totalDays} · travelling now</div>
                          <div className="progress-bar"><div className="progress-fill" style={{width:`${progress.pct}%`}}/></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {/* Mobile bottom nav — only on trips list */}
      {!trip && (
        <div className="mobile-nav">
          <div className="mobile-nav-inner">
            <button className="mobile-nav-btn active"><Compass size={20}/> Trips</button>
            <button className="mobile-nav-btn" onClick={()=>load(true)}><RefreshCw size={20}/> Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}
