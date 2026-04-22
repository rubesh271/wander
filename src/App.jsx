import { useState, useMemo } from 'react';
import { Map, Settings, ChevronLeft, Plus, MapPin, ExternalLink } from 'lucide-react';
import {
  DEMO_TRIPS, DEMO_DAYS, DEMO_DOCS, DEMO_STAYS,
  DEMO_PLACES, DEMO_PERSONNELS, DEMO_OTHER_DOCS
} from './demoData';
import {
  Modal, Field, Avatar, StatusBadge, TypeBadge, CategoryBadge,
  SearchFilterBar, MapModal, AttachmentField, AttachmentChips, InlineEditWrapper
} from './components/ui.jsx';
import { fmt, nights, matchesSearch, catStyle, OTHER_DOC_CATEGORIES, fileToBase64, avatarColor, initials, pushToSheet, deleteFromSheet, setupSheet, APPS_SCRIPT_CODE } from './utils.js';
import SharedView from './SharedView.jsx';
import './index.css';

// Detect shared view mode — URL has ?sheet=SPREADSHEET_ID
const urlParams = new URLSearchParams(window.location.search);
const SHARED_SHEET_ID = urlParams.get('sheet');

// If shared mode, render SharedView immediately — don't load the full app
if (SHARED_SHEET_ID) {
  // Dynamically swap root render — handled in main.jsx via App export
}

// ─────────────────────────────────────────────────────────────────────────────
// DAYS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function parsePeriod(text) {
  if (!text) return [];
  return text.split('·').map(seg => {
    const s = seg.trim();
    const m = s.match(/^(\d{2}:\d{2})\s*(.*)/);
    return m ? { time:m[1], content:m[2] } : { time:'', content:s };
  }).filter(x => x.content);
}

function DayEditForm({ day, onChange }) {
  const s = k => e => onChange({ ...day, [k]: e.target.value });
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="edit-form-grid">
        <Field label="Day number"><input className="form-input" value={day.dayNumber||''} onChange={s('dayNumber')}/></Field>
        <Field label="Date"><input className="form-input" type="date" value={day.date||''} onChange={s('date')}/></Field>
        <Field label="Title" ><input className="form-input" value={day.title||''} onChange={s('title')}/></Field>
        <Field label="Location"><input className="form-input" value={day.location||''} onChange={s('location')}/></Field>
        <div className="full-width"><Field label="☀️ Morning"><textarea className="form-textarea" value={day.morning||''} onChange={s('morning')}/></Field></div>
        <div className="full-width"><Field label="🌤 Afternoon"><textarea className="form-textarea" value={day.afternoon||''} onChange={s('afternoon')}/></Field></div>
        <div className="full-width"><Field label="🌙 Evening"><textarea className="form-textarea" value={day.evening||''} onChange={s('evening')}/></Field></div>
        <div className="full-width"><Field label="Transport"><input className="form-input" value={day.transport||''} onChange={s('transport')}/></Field></div>
        <div className="full-width"><Field label="Notes"><textarea className="form-textarea" value={day.notes||''} onChange={s('notes')}/></Field></div>
      </div>
    </div>
  );
}

function PlaceRow({ place, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(place);
  const cs = catStyle(place.category);
  const s = k => e => setDraft(p => ({...p,[k]:e.target.value}));

  return (
    <div className="place-row" style={{ alignItems: editing ? 'flex-start' : 'center', flexDirection: editing ? 'column' : 'row', gap: editing ? 10 : undefined }}>
      {editing ? (
        <>
          <div className="edit-form-grid" style={{ width:'100%' }}>
            <Field label="Name"><input className="form-input" value={draft.name||''} onChange={s('name')}/></Field>
            <Field label="Time"><input className="form-input" type="time" value={draft.time||''} onChange={s('time')}/></Field>
            <Field label="Category">
              <select className="form-select" value={draft.category||'Other'} onChange={s('category')}>
                {Object.keys({Food:1,Sights:1,Activity:1,Transport:1,Shopping:1,Stay:1,Other:1}).map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Google Maps URL"><input className="form-input" value={draft.mapsUrl||''} onChange={s('mapsUrl')}/></Field>
            <Field label="Latitude"><input className="form-input" value={draft.lat||''} onChange={s('lat')}/></Field>
            <Field label="Longitude"><input className="form-input" value={draft.lng||''} onChange={s('lng')}/></Field>
            <div className="full-width"><Field label="Notes"><input className="form-input" value={draft.notes||''} onChange={s('notes')}/></Field></div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', width:'100%' }}>
            <button className="btn btn-sm" style={{ color:'var(--rose)' }} onClick={onDelete}>Delete</button>
            <button className="btn btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={()=>{ onSave(draft); setEditing(false); }}>Save</button>
          </div>
        </>
      ) : (
        <>
          <span className="place-time">{place.time||'—'}</span>
          <span className="place-dot" style={{ background:cs.dot }}/>
          <div className="place-info">
            <div className="place-name">{place.name}</div>
            {place.notes && <div className="place-note">{place.notes}</div>}
          </div>
          <span className="place-cat" style={{ background:cs.bg, color:cs.color }}>{place.category}</span>
          {place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="place-link"><ExternalLink size={13}/></a>}
          <button className="card-edit-btn" style={{ display:'flex' }} onClick={()=>{ setDraft(place); setEditing(true); }}>✏️</button>
        </>
      )}
    </div>
  );
}

function DaysView({ tripId, days, places, onAddDay, onUpdateDay, onDeleteDay, onAddPlace, onUpdatePlace, onDeletePlace }) {
  const tripDays = days.filter(d=>d.tripId===tripId).sort((a,b)=>Number(a.dayNumber)-Number(b.dayNumber));
  const [showAdd, setShowAdd] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [mapDay, setMapDay] = useState(null);
  const [newPlace, setNewPlace] = useState({ name:'', time:'', category:'Food', mapsUrl:'', lat:'', lng:'', notes:'' });

  const mapItems = mapDay ? places.filter(p=>p.dayId===mapDay.id).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).map(p=>({ ...p, subtitle:p.time, badge:p.category, dotBg:catStyle(p.category).bg, dotColor:catStyle(p.category).color })) : [];

  function parseMapUrl(url, cur) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    return m ? { ...cur, mapsUrl:url, lat:m[1], lng:m[2] } : { ...cur, mapsUrl:url };
  }

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add day</button>
      </div>
      {tripDays.length===0
        ? <div className="empty-state"><div className="empty-icon">📅</div><h3>No days yet</h3></div>
        : <div className="days-list">
          {tripDays.map(day => {
            const dayPlaces = places.filter(p=>p.dayId===day.id).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
            const isEditing = editing===day.id;
            return (
              <div key={day.id} className="day-card" style={{ position:'relative' }}>
                <div className="day-card-header" onClick={()=>{ if(!isEditing) setExpanded(expanded===day.id?null:day.id); }} style={{ cursor:'pointer' }}>
                  <div className="day-number">{day.dayNumber}</div>
                  <div className="day-card-meta">
                    <div className="day-card-title">{day.title||`Day ${day.dayNumber}`}</div>
                    <div className="day-card-date">{fmt(day.date)}{day.location?` · ${day.location}`:''}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
                    {dayPlaces.length>0 && !isEditing && <button className="map-view-btn" onClick={e=>{e.stopPropagation();setMapDay(day);}} style={{ padding:'5px 10px',fontSize:12 }}><MapPin size={13}/> Map ({dayPlaces.length})</button>}
                    {!isEditing && <>
                      <button className="card-edit-btn" onClick={e=>{e.stopPropagation();setDraft({...day});setEditing(day.id);setExpanded(day.id);}}>✏️</button>
                      <button className="card-edit-btn card-delete-btn" onClick={e=>{e.stopPropagation();onDeleteDay(day.id);}}>🗑</button>
                    </>}
                    <span style={{ fontSize:12, color:'var(--ink-faint)', paddingLeft:4 }}>{(expanded===day.id||isEditing)?'▲':'▼'}</span>
                  </div>
                </div>
                {(expanded===day.id || isEditing) && (
                  <div className="day-card-body">
                    {isEditing ? (
                      <>
                        <DayEditForm day={draft} onChange={setDraft}/>
                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                          <button className="btn btn-sm" onClick={()=>setEditing(null)}>Cancel</button>
                          <button className="btn btn-teal btn-sm" onClick={()=>{ onUpdateDay(draft); setEditing(null); }}>Save changes</button>
                        </div>
                      </>
                    ) : (
                      <>
                        {[['☀️ Morning',day.morning],['🌤 Afternoon',day.afternoon],['🌙 Evening',day.evening]].map(([label,text])=>
                          text ? (<div key={label}><div className="period-label">{label}</div>{parsePeriod(text).map((slot,i)=>(
                            <div key={i} className="time-slot"><span className="time-label">{slot.time}</span><span className="time-content">{slot.content}</span></div>
                          ))}</div>) : null
                        )}
                        <div style={{ marginTop:12 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                            <div className="period-label" style={{ margin:0, flex:1 }}>📍 Places</div>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'3px 8px', marginLeft:8 }} onClick={()=>setShowAddPlace(day.id)}><Plus size={11}/> Add place</button>
                          </div>
                          {dayPlaces.length===0
                            ? <div style={{ fontSize:12, color:'var(--ink-faint)', padding:'6px 0' }}>No places yet.</div>
                            : <div className="places-list">
                              {dayPlaces.map(place=>(
                                <PlaceRow key={place.id} place={place}
                                  onSave={updated=>onUpdatePlace(updated)}
                                  onDelete={()=>onDeletePlace(place.id)}/>
                              ))}
                            </div>
                          }
                          {dayPlaces.length>0 && <button className="map-view-btn" style={{ marginTop:10, width:'100%', justifyContent:'center' }} onClick={()=>setMapDay(day)}><MapPin size={14}/> View all {dayPlaces.length} places on map</button>}
                        </div>
                        {(day.transport||day.notes) && <div style={{ marginTop:12, padding:'10px 12px', background:'var(--paper-warm)', borderRadius:8, fontSize:12, color:'var(--ink-mid)', lineHeight:1.6 }}>{day.transport&&<div><strong>Transport:</strong> {day.transport}</div>}{day.notes&&<div style={{marginTop:4}}><strong>Notes:</strong> {day.notes}</div>}</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
      {/* Add Day Modal */}
      {showAdd && (
        <Modal title="New day" onClose={()=>setShowAdd(false)} onSave={()=>{
          const f = { dayNumber:'', date:'', title:'', location:'', morning:'', afternoon:'', evening:'', transport:'', notes:'' };
          setShowAdd('form'); // handled below
        }}>
          <AddDayForm tripId={tripId} onAdd={d=>{onAddDay(d);setShowAdd(false);}} onClose={()=>setShowAdd(false)}/>
        </Modal>
      )}
      {/* Add Place inline Modal */}
      {showAddPlace && (
        <Modal title="Add place" onClose={()=>setShowAddPlace(null)} onSave={async ()=>{
          onAddPlace({ ...newPlace, id:Date.now().toString(), tripId, dayId:showAddPlace });
          setNewPlace({ name:'', time:'', category:'Food', mapsUrl:'', lat:'', lng:'', notes:'' });
          setShowAddPlace(null);
        }}>
          <Field label="Place name"><input className="form-input" value={newPlace.name} onChange={e=>setNewPlace(p=>({...p,name:e.target.value}))} placeholder="Meiji Shrine"/></Field>
          <div className="form-row">
            <Field label="Time"><input className="form-input" type="time" value={newPlace.time} onChange={e=>setNewPlace(p=>({...p,time:e.target.value}))}/></Field>
            <Field label="Category"><select className="form-select" value={newPlace.category} onChange={e=>setNewPlace(p=>({...p,category:e.target.value}))}>{Object.keys({Food:1,Sights:1,Activity:1,Transport:1,Shopping:1,Stay:1,Other:1}).map(c=><option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="Google Maps URL"><input className="form-input" value={newPlace.mapsUrl} onChange={e=>setNewPlace(p=>parseMapUrl(e.target.value,p))} placeholder="Paste Google Maps URL"/></Field>
          {(newPlace.lat||newPlace.lng)&&<div style={{fontSize:12,color:'var(--teal)',background:'var(--teal-light)',padding:'6px 10px',borderRadius:'var(--radius)'}}>✓ Coordinates: {newPlace.lat}, {newPlace.lng}</div>}
          <div className="form-row">
            <Field label="Latitude"><input className="form-input" value={newPlace.lat} onChange={e=>setNewPlace(p=>({...p,lat:e.target.value}))}/></Field>
            <Field label="Longitude"><input className="form-input" value={newPlace.lng} onChange={e=>setNewPlace(p=>({...p,lng:e.target.value}))}/></Field>
          </div>
          <Field label="Notes"><textarea className="form-textarea" value={newPlace.notes} onChange={e=>setNewPlace(p=>({...p,notes:e.target.value}))}/></Field>
        </Modal>
      )}
      {mapDay && mapItems.length>0 && <MapModal title={`Day ${mapDay.dayNumber} — ${mapDay.title||'Map'}`} subtitle={`${mapItems.length} places · ${fmt(mapDay.date)}`} items={mapItems} onClose={()=>setMapDay(null)}/>}
    </>
  );
}

function AddDayForm({ tripId, onAdd, onClose }) {
  const [f, setF] = useState({ dayNumber:'', date:'', title:'', location:'', morning:'', afternoon:'', evening:'', transport:'', notes:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <>
      <div className="form-row"><Field label="Day number"><input className="form-input" value={f.dayNumber} onChange={s('dayNumber')} placeholder="1"/></Field><Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field></div>
      <Field label="Title"><input className="form-input" value={f.title} onChange={s('title')} placeholder="Arrival — Shinjuku"/></Field>
      <Field label="Location"><input className="form-input" value={f.location} onChange={s('location')} placeholder="Tokyo"/></Field>
      <Field label="☀️ Morning"><textarea className="form-textarea" value={f.morning} onChange={s('morning')} placeholder="09:00 Shrine · 10:30 Market..."/></Field>
      <Field label="🌤 Afternoon"><textarea className="form-textarea" value={f.afternoon} onChange={s('afternoon')}/></Field>
      <Field label="🌙 Evening"><textarea className="form-textarea" value={f.evening} onChange={s('evening')}/></Field>
      <Field label="Transport"><input className="form-input" value={f.transport} onChange={s('transport')}/></Field>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')}/></Field>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-teal" onClick={()=>onAdd({...f,id:Date.now().toString(),tripId})}>Save</button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKETS & DOCS — Travel Docs + Other Docs sub-tabs
// ─────────────────────────────────────────────────────────────────────────────

const TRAVEL_DOC_FIELDS = ['name','type','date','time','fromTo','operator','ref','details','cost','status','belongsTo'];

function TravelDocRow({ doc, persons, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc);
  const s = k => e => setDraft(p=>({...p,[k]:e.target.value}));
  const personIdx = persons.findIndex(p=>p.name===doc.belongsTo);

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const data = await fileToBase64(file);
    setDraft(p=>({...p, fileData:data, fileLabel:file.name}));
  }

  if (editing) {
    return (
      <tr className="table-row-editing">
        <td colSpan={7} style={{padding:'12px 14px'}}>
          <div className="edit-form-grid">
            <Field label="Name"><input className="form-input" value={draft.name||''} onChange={s('name')}/></Field>
            <Field label="Type"><select className="form-select" value={draft.type||'Flight'} onChange={s('type')}>{['Flight','Train','Bus','Ferry','Visa','Pass','Other'].map(t=><option key={t}>{t}</option>)}</select></Field>
            <Field label="Date"><input className="form-input" type="date" value={draft.date||''} onChange={s('date')}/></Field>
            <Field label="Time"><input className="form-input" type="time" value={draft.time||''} onChange={s('time')}/></Field>
            <Field label="From → To"><input className="form-input" value={draft.fromTo||''} onChange={s('fromTo')}/></Field>
            <Field label="Operator"><input className="form-input" value={draft.operator||''} onChange={s('operator')}/></Field>
            <Field label="Ref"><input className="form-input" value={draft.ref||''} onChange={s('ref')}/></Field>
            <Field label="Cost"><input className="form-input" value={draft.cost||''} onChange={s('cost')}/></Field>
            <Field label="Status"><select className="form-select" value={draft.status||'Confirmed'} onChange={s('status')}>{['Pending','Confirmed','Checked in','Used'].map(t=><option key={t}>{t}</option>)}</select></Field>
            <Field label="Belongs to">
              <select className="form-select" value={draft.belongsTo||''} onChange={s('belongsTo')}>
                <option value="">Everyone</option>
                {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </Field>
            <div className="full-width"><Field label="Seat / details"><input className="form-input" value={draft.details||''} onChange={s('details')}/></Field></div>
          </div>
          <div style={{marginTop:10}}>
            <AttachmentField fileData={draft.fileData} fileLabel={draft.fileLabel} link={draft.link||''} onFileChange={handleFile} onLinkChange={v=>setDraft(p=>({...p,link:v}))}/>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
            <button className="btn btn-sm card-delete-btn" onClick={onDelete}>🗑 Delete</button>
            <button className="btn btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={()=>{onSave(draft);setEditing(false);}}>Save changes</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <div className="td-primary">{doc.name}</div>
        <div style={{marginTop:3,display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          <TypeBadge type={doc.type}/>
          <AttachmentChips fileData={doc.fileData} fileLabel={doc.fileLabel} link={doc.link}/>
        </div>
      </td>
      <td>{fmt(doc.date)}{doc.time?` · ${doc.time}`:''}</td>
      <td>{doc.fromTo||'—'}</td>
      <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{doc.ref||'—'}</td>
      <td>{doc.belongsTo ? <span style={{display:'flex',alignItems:'center',gap:5}}><Avatar name={doc.belongsTo} size={20} index={personIdx}/><span style={{fontSize:12}}>{doc.belongsTo}</span></span> : <span style={{fontSize:12,color:'var(--ink-faint)'}}>Everyone</span>}</td>
      <td>{doc.cost||'—'}</td>
      <td>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          <span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:doc.status==='Confirmed'?'var(--teal-light)':'var(--paper-warm)',color:doc.status==='Confirmed'?'var(--teal)':'var(--ink-mid)'}}>{doc.status}</span>
          <button className="card-edit-btn" style={{display:'flex'}} onClick={()=>{setDraft(doc);setEditing(true);}}>✏️</button>
        </div>
      </td>
    </tr>
  );
}

function AddTravelDocModal({ tripId, persons, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', type:'Flight', date:'', time:'', ref:'', fromTo:'', operator:'', details:'', cost:'', status:'Confirmed', belongsTo:'', link:'', fileData:'', fileLabel:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const data = await fileToBase64(file);
    setF(p=>({...p, fileData:data, fileLabel:file.name}));
  }
  return (
    <Modal title="New travel document" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}} wide>
      <div className="form-row">
        <Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>{['Flight','Train','Bus','Ferry','Visa','Pass','Other'].map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>{['Pending','Confirmed','Checked in','Used'].map(t=><option key={t}>{t}</option>)}</select></Field>
      </div>
      <Field label="Name / description"><input className="form-input" value={f.name} onChange={s('name')} placeholder="BA178 — London to Tokyo"/></Field>
      <div className="form-row">
        <Field label="Date"><input className="form-input" type="date" value={f.date} onChange={s('date')}/></Field>
        <Field label="Time"><input className="form-input" type="time" value={f.time} onChange={s('time')}/></Field>
      </div>
      <div className="form-row">
        <Field label="From → To"><input className="form-input" value={f.fromTo} onChange={s('fromTo')} placeholder="LHR → NRT"/></Field>
        <Field label="Operator"><input className="form-input" value={f.operator} onChange={s('operator')} placeholder="British Airways"/></Field>
      </div>
      <div className="form-row">
        <Field label="Confirmation ref"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="XY7GH2"/></Field>
        <Field label="Cost"><input className="form-input" value={f.cost} onChange={s('cost')} placeholder="£680"/></Field>
      </div>
      <Field label="Seat / details"><input className="form-input" value={f.details} onChange={s('details')} placeholder="Seat 34A · 1 checked bag"/></Field>
      <Field label="Belongs to">
        <select className="form-select" value={f.belongsTo} onChange={s('belongsTo')}>
          <option value="">— Everyone —</option>
          {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </Field>
      <AttachmentField fileData={f.fileData} fileLabel={f.fileLabel} link={f.link} onFileChange={handleFile} onLinkChange={v=>setF(p=>({...p,link:v}))}/>
    </Modal>
  );
}

// OTHER DOCS

function OtherDocCard({ doc, persons, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc);
  const s = k => e => setDraft(p=>({...p,[k]:e.target.value}));
  const personIdx = persons.findIndex(p=>p.name===doc.belongsTo);

  const CAT_ICONS = { Passport:'🛂', Visa:'📋', 'Travel Insurance':'🛡️', 'Health / Vaccination':'💉', Receipt:'🧾', 'Booking Confirmation':'✅', Itinerary:'🗺️', 'Emergency Contact':'🆘', Other:'📄' };

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const data = await fileToBase64(file);
    setDraft(p=>({...p, fileData:data, fileLabel:file.name}));
  }

  return (
    <div className="other-doc-card" style={{ position:'relative' }}>
      {!editing && (
        <div className="card-edit-bar" style={{ display:'flex' }}>
          <button className="card-edit-btn" onClick={()=>{setDraft(doc);setEditing(true);}}>✏️</button>
          <button className="card-edit-btn card-delete-btn" onClick={onDelete}>🗑</button>
        </div>
      )}
      {editing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div className="edit-form-grid">
            <Field label="Name"><input className="form-input" value={draft.name||''} onChange={s('name')}/></Field>
            <Field label="Category">
              <select className="form-select" value={draft.category||'Other'} onChange={s('category')}>
                {OTHER_DOC_CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Reference / number"><input className="form-input" value={draft.ref||''} onChange={s('ref')}/></Field>
            <Field label="Issued by"><input className="form-input" value={draft.issuedBy||''} onChange={s('issuedBy')}/></Field>
            <Field label="Expiry date"><input className="form-input" type="date" value={draft.expiryDate||''} onChange={s('expiryDate')}/></Field>
            <Field label="Belongs to">
              <select className="form-select" value={draft.belongsTo||''} onChange={s('belongsTo')}>
                <option value="">— Everyone —</option>
                {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </Field>
            <div className="full-width"><Field label="Notes"><textarea className="form-textarea" value={draft.notes||''} onChange={s('notes')}/></Field></div>
          </div>
          <AttachmentField
            fileData={draft.fileData} fileLabel={draft.fileLabel} link={draft.link}
            onFileChange={handleFile}
            onLinkChange={v=>setDraft(p=>({...p,link:v}))}
          />
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={()=>{onSave(draft);setEditing(false);}}>Save changes</button>
          </div>
        </div>
      ) : (
        <>
          <div className="doc-icon">{CAT_ICONS[doc.category]||'📄'}</div>
          <div className="doc-title">{doc.name}</div>
          <div className="doc-meta">
            <CategoryBadge cat={doc.category} label={doc.category}/>
            {doc.expiryDate && <span style={{ marginLeft:6, fontSize:11, color: new Date(doc.expiryDate) < new Date() ? 'var(--rose)' : 'var(--ink-light)' }}>Expires {fmt(doc.expiryDate)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12, color:'var(--ink-mid)', marginBottom:8 }}>
            {doc.ref && <div><span style={{color:'var(--ink-light)'}}>Ref</span><br/><span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{doc.ref}</span></div>}
            {doc.issuedBy && <div><span style={{color:'var(--ink-light)'}}>Issued by</span><br/>{doc.issuedBy}</div>}
            {doc.belongsTo && <div><span style={{color:'var(--ink-light)'}}>Belongs to</span><br/><span style={{display:'flex',alignItems:'center',gap:4}}><Avatar name={doc.belongsTo} size={16} index={personIdx}/>{doc.belongsTo}</span></div>}
          </div>
          {doc.notes && <div style={{ fontSize:12, color:'var(--ink-mid)', marginBottom:6, lineHeight:1.5 }}>{doc.notes}</div>}
          <AttachmentChips fileData={doc.fileData} fileLabel={doc.fileLabel} link={doc.link}/>
        </>
      )}
    </div>
  );
}

function AddOtherDocModal({ tripId, persons, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', category:'Passport', ref:'', issuedBy:'', expiryDate:'', belongsTo:'', notes:'', fileData:'', fileLabel:'', link:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
  async function handleFile(e) {
    const file = e.target.files[0]; if(!file) return;
    const data = await fileToBase64(file);
    setF(p=>({...p,fileData:data,fileLabel:file.name}));
  }
  return (
    <Modal title="New document" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}} wide>
      <div className="form-row">
        <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="UK Passport — Rubes"/></Field>
        <Field label="Category"><select className="form-select" value={f.category} onChange={s('category')}>{OTHER_DOC_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <div className="form-row">
        <Field label="Reference / number"><input className="form-input" value={f.ref} onChange={s('ref')} placeholder="Passport number, policy ref…"/></Field>
        <Field label="Issued by"><input className="form-input" value={f.issuedBy} onChange={s('issuedBy')} placeholder="UK Home Office, AXA…"/></Field>
      </div>
      <div className="form-row">
        <Field label="Expiry date"><input className="form-input" type="date" value={f.expiryDate} onChange={s('expiryDate')}/></Field>
        <Field label="Belongs to">
          <select className="form-select" value={f.belongsTo} onChange={s('belongsTo')}>
            <option value="">— Everyone —</option>
            {persons.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')} placeholder="Emergency numbers, important instructions…"/></Field>
      <AttachmentField fileData={f.fileData} fileLabel={f.fileLabel} link={f.link} onFileChange={handleFile} onLinkChange={v=>setF(p=>({...p,link:v}))}/>
    </Modal>
  );
}

function DocsView({ tripId, docs, otherDocs, persons, onAddDoc, onUpdateDoc, onDeleteDoc, onAddOtherDoc, onUpdateOtherDoc, onDeleteOtherDoc }) {
  const [subTab, setSubTab] = useState('travel');
  const [showAddTravel, setShowAddTravel] = useState(false);
  const [showAddOther, setShowAddOther] = useState(false);
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('');

  const tripDocs = useMemo(()=>{
    let d = docs.filter(d=>d.tripId===tripId);
    if (personFilter) d = d.filter(d=>(d.belongsTo||'').toLowerCase().includes(personFilter.toLowerCase()));
    if (query) d = d.filter(d=>matchesSearch(d,query));
    return d.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  },[docs,tripId,query,personFilter]);

  const tripOtherDocs = useMemo(()=>{
    let d = otherDocs.filter(d=>d.tripId===tripId);
    if (personFilter) d = d.filter(d=>(d.belongsTo||'').toLowerCase().includes(personFilter.toLowerCase()));
    if (query) d = d.filter(d=>matchesSearch(d,query));
    return d;
  },[otherDocs,tripId,query,personFilter]);

  return (
    <>
      <div className="sub-tab-bar">
        <button className={`sub-tab ${subTab==='travel'?'active':''}`} onClick={()=>setSubTab('travel')}>✈️ Travel docs</button>
        <button className={`sub-tab ${subTab==='other'?'active':''}`} onClick={()=>setSubTab('other')}>📁 Other docs</button>
      </div>

      <SearchFilterBar query={query} onQuery={setQuery} persons={persons} activePerson={personFilter} onPerson={setPersonFilter}/>

      {subTab==='travel' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span className="result-count">{tripDocs.length} result{tripDocs.length!==1?'s':''}</span>
            <button className="btn btn-teal btn-sm" onClick={()=>setShowAddTravel(true)}><Plus size={14}/> Add ticket</button>
          </div>
          {tripDocs.length===0
            ? <div className="empty-state"><div className="empty-icon">🎫</div><h3>{query||personFilter?'No results':'No travel docs yet'}</h3></div>
            : <div className="card" style={{ overflow:'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Date</th><th>Route</th><th>Ref</th><th>Belongs to</th><th>Cost</th><th>Status</th></tr></thead>
                <tbody>
                  {tripDocs.map(doc=>(
                    <TravelDocRow key={doc.id} doc={doc} persons={persons}
                      onSave={updated=>onUpdateDoc(updated)}
                      onDelete={()=>onDeleteDoc(doc.id)}/>
                  ))}
                </tbody>
              </table>
            </div>
          }
          {showAddTravel && <AddTravelDocModal tripId={tripId} persons={persons} onClose={()=>setShowAddTravel(false)} onAdd={onAddDoc}/>}
        </>
      )}

      {subTab==='other' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span className="result-count">{tripOtherDocs.length} result{tripOtherDocs.length!==1?'s':''}</span>
            <button className="btn btn-teal btn-sm" onClick={()=>setShowAddOther(true)}><Plus size={14}/> Add document</button>
          </div>
          {tripOtherDocs.length===0
            ? <div className="empty-state"><div className="empty-icon">📁</div><h3>{query||personFilter?'No results':'No documents yet'}</h3><p>Add passports, visas, insurance, receipts and more.</p></div>
            : <div className="other-docs-grid">
              {tripOtherDocs.map(doc=>(
                <OtherDocCard key={doc.id} doc={doc} persons={persons}
                  onSave={updated=>onUpdateOtherDoc(updated)}
                  onDelete={()=>onDeleteOtherDoc(doc.id)}/>
              ))}
            </div>
          }
          {showAddOther && <AddOtherDocModal tripId={tripId} persons={persons} onClose={()=>setShowAddOther(false)} onAdd={onAddOtherDoc}/>}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAYS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function StayCard({ stay, persons, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stay);
  const [mapOpen, setMapOpen] = useState(false);
  const s = k => e => setDraft(p=>({...p,[k]:e.target.value}));
  const stayPersons = (stay.belongsTo||'').split(',').map(n=>n.trim()).filter(Boolean);

  function parseMapUrl(url) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) setDraft(p=>({...p,mapsUrl:url,lat:m[1],lng:m[2]}));
    else setDraft(p=>({...p,mapsUrl:url}));
  }

  return (
    <div className="card" style={{ padding:'16px 18px', position:'relative' }}>
      {!editing && (
        <div className="card-edit-bar" style={{ display:'flex' }}>
          <button className="card-edit-btn" onClick={()=>{setDraft(stay);setEditing(true);}}>✏️</button>
          <button className="card-edit-btn card-delete-btn" onClick={onDelete}>🗑</button>
        </div>
      )}
      {editing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div className="edit-form-grid">
            <Field label="Name"><input className="form-input" value={draft.name||''} onChange={s('name')}/></Field>
            <Field label="Type"><select className="form-select" value={draft.type||'Hotel'} onChange={s('type')}>{['Hotel','Airbnb','Hostel','Rental','Other'].map(t=><option key={t}>{t}</option>)}</select></Field>
            <Field label="Check-in"><input className="form-input" type="date" value={draft.checkIn||''} onChange={s('checkIn')}/></Field>
            <Field label="Check-out"><input className="form-input" type="date" value={draft.checkOut||''} onChange={s('checkOut')}/></Field>
            <div className="full-width"><Field label="Address"><input className="form-input" value={draft.address||''} onChange={s('address')}/></Field></div>
            <div className="full-width">
              <Field label="Google Maps link">
                <input className="form-input" value={draft.mapsUrl||''} onChange={e=>parseMapUrl(e.target.value)} placeholder="Paste URL — coordinates auto-extracted"/>
              </Field>
            </div>
            <Field label="Lat"><input className="form-input" value={draft.lat||''} onChange={s('lat')}/></Field>
            <Field label="Lng"><input className="form-input" value={draft.lng||''} onChange={s('lng')}/></Field>
            <Field label="Confirmation ref"><input className="form-input" value={draft.ref||''} onChange={s('ref')}/></Field>
            <Field label="Cost"><input className="form-input" value={draft.cost||''} onChange={s('cost')}/></Field>
            <Field label="Prepaid?"><select className="form-select" value={draft.paid||'No'} onChange={s('paid')}><option value="Yes">Yes — prepaid</option><option value="No">Pay on arrival</option></select></Field>
            <Field label="Belongs to (comma-separated)"><input className="form-input" value={draft.belongsTo||''} onChange={s('belongsTo')} placeholder="Rubes, Aisha"/></Field>
            <div className="full-width"><Field label="Check-in notes"><textarea className="form-textarea" value={draft.checkInNotes||''} onChange={s('checkInNotes')}/></Field></div>
            <div className="full-width"><Field label="Extras (wifi, breakfast…)"><input className="form-input" value={draft.extras||''} onChange={s('extras')}/></Field></div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={()=>{onSave(draft);setEditing(false);}}>Save changes</button>
          </div>
        </div>
      ) : (
        <>
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
          {stayPersons.length>0 && <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--ink-light)' }}>Staying:</span>
            {stayPersons.map((name,i)=><span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--ink-mid)' }}><Avatar name={name} size={18} index={i}/>{name}</span>)}
          </div>}
          {stay.checkInNotes && <div style={{ marginTop:10, padding:'8px 12px', background:'var(--amber-light)', borderRadius:8, fontSize:12, color:'var(--amber)' }}><strong>Check-in:</strong> {stay.checkInNotes}</div>}
        </>
      )}
      {mapOpen && <MapModal
        title={stay.name}
        subtitle={`${fmt(stay.checkIn)} → ${fmt(stay.checkOut)} · ${nights(stay.checkIn,stay.checkOut)} nights`}
        items={[{ id:stay.id, name:stay.name, subtitle:stay.address, badge:stay.type, mapsUrl:stay.mapsUrl, lat:stay.lat, lng:stay.lng, notes:stay.checkInNotes, dotBg:'var(--teal-light)', dotColor:'var(--teal)' }]}
        onClose={()=>setMapOpen(false)}/>}
    </div>
  );
}

function AddStayModal({ tripId, persons, onClose, onAdd }) {
  const [f, setF] = useState({ name:'', type:'Hotel', checkIn:'', checkOut:'', address:'', mapsUrl:'', lat:'', lng:'', ref:'', cost:'', paid:'No', checkInNotes:'', extras:'', belongsTo:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
  function parseMapUrl(url) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) setF(p=>({...p,mapsUrl:url,lat:m[1],lng:m[2]}));
    else setF(p=>({...p,mapsUrl:url}));
  }
  return (
    <Modal title="New stay" onClose={onClose} onSave={()=>{onAdd({...f,id:Date.now().toString(),tripId});onClose();}} wide>
      <div className="form-row"><Field label="Type"><select className="form-select" value={f.type} onChange={s('type')}>{['Hotel','Airbnb','Hostel','Rental','Other'].map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Prepaid?"><select className="form-select" value={f.paid} onChange={s('paid')}><option value="Yes">Yes</option><option value="No">Pay on arrival</option></select></Field></div>
      <Field label="Name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Ace Hotel Tokyo"/></Field>
      <div className="form-row"><Field label="Check-in"><input className="form-input" type="date" value={f.checkIn} onChange={s('checkIn')}/></Field><Field label="Check-out"><input className="form-input" type="date" value={f.checkOut} onChange={s('checkOut')}/></Field></div>
      <Field label="Address"><input className="form-input" value={f.address} onChange={s('address')}/></Field>
      <Field label="Google Maps link"><input className="form-input" value={f.mapsUrl} onChange={e=>parseMapUrl(e.target.value)} placeholder="Paste URL — coordinates auto-extracted"/></Field>
      {(f.lat||f.lng)&&<div style={{fontSize:12,color:'var(--teal)',background:'var(--teal-light)',padding:'6px 10px',borderRadius:'var(--radius)'}}>✓ Coordinates: {f.lat}, {f.lng}</div>}
      <div className="form-row"><Field label="Confirmation ref"><input className="form-input" value={f.ref} onChange={s('ref')}/></Field><Field label="Total cost"><input className="form-input" value={f.cost} onChange={s('cost')}/></Field></div>
      <Field label="Belongs to (comma-separated)"><input className="form-input" value={f.belongsTo} onChange={s('belongsTo')} placeholder="Rubes, Aisha, Marco"/></Field>
      <Field label="Check-in notes"><textarea className="form-textarea" value={f.checkInNotes} onChange={s('checkInNotes')}/></Field>
      <Field label="Extras"><input className="form-input" value={f.extras} onChange={s('extras')} placeholder="Wifi: GuestNet · Breakfast included"/></Field>
    </Modal>
  );
}

function StaysView({ tripId, stays, persons, onAddStay, onUpdateStay, onDeleteStay }) {
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const filtered = useMemo(()=>{
    let s = stays.filter(s=>s.tripId===tripId);
    if (personFilter) s = s.filter(s=>(s.belongsTo||'').toLowerCase().includes(personFilter.toLowerCase()));
    if (query) s = s.filter(s=>matchesSearch(s,query));
    return s.sort((a,b)=>(a.checkIn||'').localeCompare(b.checkIn||''));
  },[stays,tripId,query,personFilter]);

  return (
    <>
      <SearchFilterBar query={query} onQuery={setQuery} persons={persons} activePerson={personFilter} onPerson={setPersonFilter}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span className="result-count">{filtered.length} result{filtered.length!==1?'s':''}</span>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add stay</button>
      </div>
      {filtered.length===0
        ? <div className="empty-state"><div className="empty-icon">🏨</div><h3>{query||personFilter?'No results':'No stays yet'}</h3></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(stay=><StayCard key={stay.id} stay={stay} persons={persons} onSave={onUpdateStay} onDelete={()=>onDeleteStay(stay.id)}/>)}
        </div>
      }
      {showAdd && <AddStayModal tripId={tripId} persons={persons} onClose={()=>setShowAdd(false)} onAdd={s=>{onAddStay(s);setShowAdd(false);}}/>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONNELS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function PersonnelCard({ person, index, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person);
  const ac = avatarColor(person.name, index);
  const s = k => e => setDraft(p=>({...p,[k]:e.target.value}));

  return (
    <div className="personnel-card" style={{ position:'relative' }}>
      {!editing && (
        <div className="card-edit-bar" style={{ display:'flex' }}>
          <button className="card-edit-btn" onClick={()=>{setDraft(person);setEditing(true);}}>✏️</button>
          <button className="card-edit-btn card-delete-btn" onClick={onDelete}>🗑</button>
        </div>
      )}
      {editing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Field label="Full name"><input className="form-input" value={draft.name||''} onChange={s('name')}/></Field>
          <Field label="Role"><select className="form-select" value={draft.role||'Traveller'} onChange={s('role')}>{['Trip organiser','Traveller','Local contact','Emergency contact'].map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Email"><input className="form-input" type="email" value={draft.email||''} onChange={s('email')}/></Field>
          <Field label="Phone"><input className="form-input" value={draft.phone||''} onChange={s('phone')}/></Field>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={()=>{onSave(draft);setEditing(false);}}>Save changes</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div className="personnel-avatar-lg" style={{ background:ac.bg, color:ac.color }}>{initials(person.name)}</div>
            <div><div className="personnel-name">{person.name}</div><div className="personnel-role">{person.role}</div></div>
          </div>
          {person.email && <div className="personnel-detail" style={{ marginTop:8 }}>✉️ {person.email}</div>}
          {person.phone && <div className="personnel-detail">📞 {person.phone}</div>}
        </>
      )}
    </div>
  );
}

function PersonnelsView({ tripId, personnels, onAddPersonnel, onUpdatePersonnel, onDeletePersonnel }) {
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ name:'', role:'Traveller', email:'', phone:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
  const tripPersons = personnels.filter(p=>p.tripId===tripId);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-teal btn-sm" onClick={()=>setShowAdd(true)}><Plus size={14}/> Add person</button>
      </div>
      {tripPersons.length===0
        ? <div className="empty-state"><div className="empty-icon">👥</div><h3>No people yet</h3><p>Add travel companions to enable person filters in all tabs.</p></div>
        : <div className="personnel-grid">
          {tripPersons.map((p,i)=><PersonnelCard key={p.id} person={p} index={i} onSave={onUpdatePersonnel} onDelete={()=>onDeletePersonnel(p.id)}/>)}
        </div>
      }
      {showAdd && (
        <Modal title="Add person" onClose={()=>setShowAdd(false)} onSave={()=>{onAddPersonnel({...f,id:Date.now().toString(),tripId});setShowAdd(false);}}>
          <Field label="Full name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Aisha Patel"/></Field>
          <Field label="Role"><select className="form-select" value={f.role} onChange={s('role')}>{['Trip organiser','Traveller','Local contact','Emergency contact'].map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Email"><input className="form-input" type="email" value={f.email} onChange={s('email')}/></Field>
          <Field label="Phone"><input className="form-input" value={f.phone} onChange={s('phone')}/></Field>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP DETAIL
// ─────────────────────────────────────────────────────────────────────────────

function TripDetail({ trip, days, docs, otherDocs, stays, places, personnels, onBack, handlers }) {
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
          {[['Days',days.filter(d=>d.tripId===trip.id).length,`of ${n} nights`],['Tickets',docs.filter(d=>d.tripId===trip.id).length,'travel docs'],['Stays',stays.filter(s=>s.tripId===trip.id).length,'bookings'],['People',tripPersons.length,'travelling']].map(([label,val,sub])=>(
            <div key={label} className="summary-card"><div className="summary-label">{label}</div><div className="summary-value">{val}</div><div className="summary-sub">{sub}</div></div>
          ))}
        </div>
        <div className="tab-bar">
          {[['itinerary','📅 Itinerary'],['docs','🎫 Tickets & docs'],['stays','🏨 Stays'],['people','👥 People']].map(([key,label])=>(
            <button key={key} className={`tab ${tab===key?'active':''}`} onClick={()=>setTab(key)}>{label}</button>
          ))}
        </div>
        {tab==='itinerary' && <DaysView tripId={trip.id} days={days} places={places} onAddDay={handlers.addDay} onUpdateDay={handlers.updateDay} onDeleteDay={handlers.deleteDay} onAddPlace={handlers.addPlace} onUpdatePlace={handlers.updatePlace} onDeletePlace={handlers.deletePlace}/>}
        {tab==='docs'      && <DocsView tripId={trip.id} docs={docs} otherDocs={otherDocs} persons={tripPersons} onAddDoc={handlers.addDoc} onUpdateDoc={handlers.updateDoc} onDeleteDoc={handlers.deleteDoc} onAddOtherDoc={handlers.addOtherDoc} onUpdateOtherDoc={handlers.updateOtherDoc} onDeleteOtherDoc={handlers.deleteOtherDoc}/>}
        {tab==='stays'     && <StaysView tripId={trip.id} stays={stays} persons={tripPersons} onAddStay={handlers.addStay} onUpdateStay={handlers.updateStay} onDeleteStay={handlers.deleteStay}/>}
        {tab==='people'    && <PersonnelsView tripId={trip.id} personnels={personnels} onAddPersonnel={handlers.addPersonnel} onUpdatePersonnel={handlers.updatePersonnel} onDeletePersonnel={handlers.deletePersonnel}/>}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIPS LIST
// ─────────────────────────────────────────────────────────────────────────────

function TripsView({ trips, days, docs, stays, onSelect, onAdd }) {
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ name:'', emoji:'✈️', status:'planning', destinations:'', startDate:'', endDate:'', budget:'', notes:'' });
  const s = k => e => setF(p=>({...p,[k]:e.target.value}));
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
      {showAdd && (
        <Modal title="New trip" onClose={()=>setShowAdd(false)} onSave={()=>{onAdd({...f,id:Date.now().toString()});setShowAdd(false);}}>
          <div className="form-row"><Field label="Flag / emoji"><input className="form-input" value={f.emoji} onChange={s('emoji')} placeholder="🇯🇵"/></Field><Field label="Status"><select className="form-select" value={f.status} onChange={s('status')}>{['dream','planning','upcoming','done'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}</select></Field></div>
          <Field label="Trip name"><input className="form-input" value={f.name} onChange={s('name')} placeholder="Japan — Tokyo & Kyoto"/></Field>
          <Field label="Destinations"><input className="form-input" value={f.destinations} onChange={s('destinations')} placeholder="Tokyo, Kyoto"/></Field>
          <div className="form-row"><Field label="Start date"><input className="form-input" type="date" value={f.startDate} onChange={s('startDate')}/></Field><Field label="End date"><input className="form-input" type="date" value={f.endDate} onChange={s('endDate')}/></Field></div>
          <Field label="Budget"><input className="form-input" value={f.budget} onChange={s('budget')} placeholder="£2,500"/></Field>
          <Field label="Notes"><textarea className="form-textarea" value={f.notes} onChange={s('notes')}/></Field>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE LINK BOX
// ─────────────────────────────────────────────────────────────────────────────

function ShareLinkBox({ sheetId }) {
  const [copied, setCopied] = useState(false);
  const base = window.location.origin + window.location.pathname;
  const shareUrl = `${base}?sheet=${sheetId}`;

  function copy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ background:'var(--teal-light)', border:'1px solid rgba(26,122,94,0.2)', borderRadius:'var(--radius)', padding:'14px 16px' }}>
      <div style={{ fontSize:12, color:'var(--teal)', marginBottom:8, fontWeight:500 }}>Your share link:</div>
      <div style={{ display:'flex', gap:8 }}>
        <input
          readOnly value={shareUrl}
          style={{ flex:1, padding:'8px 10px', fontSize:11, fontFamily:'var(--font-mono)', border:'1px solid rgba(26,122,94,0.3)', borderRadius:'var(--radius)', background:'white', color:'var(--ink-mid)', outline:'none' }}
          onClick={e => e.target.select()}
        />
        <button className="btn btn-teal btn-sm" onClick={copy}>{copied ? '✓ Copied!' : 'Copy link'}</button>
      </div>
      <div style={{ fontSize:11, color:'var(--teal)', marginTop:8, opacity:0.8 }}>
        Anyone with this link can view your trips. They cannot edit anything. Make sure your Google Sheet is published to the web (File → Share → Publish to web).
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

function SettingsView({ sheetsId, scriptUrl, onSave, onSetupSheet }) {
  const [id, setId] = useState(sheetsId||'');
  const [url, setUrl] = useState(scriptUrl||'');
  const [copied, setCopied] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [testing, setTesting] = useState(false);

  function copy() { navigator.clipboard.writeText(APPS_SCRIPT_CODE); setCopied(true); setTimeout(()=>setCopied(false),2500); }

  async function handleSetup() {
    setTesting(true);
    await onSetupSheet();
    setTimeout(()=>{ setSetupDone(true); setTesting(false); }, 1500);
  }

  return (
    <>
      <div className="topbar"><div className="topbar-left"><h1>Settings</h1><p>Connect Google Sheets for full two-way sync</p></div></div>
      <div className="content-area">
        <div className="setup-wrap">
          <div className="setup-card">

            <h2>Step 1 — Set up the Apps Script</h2>
            <p>This script lets the app write data back to your Google Sheet automatically. You only need to do this once.</p>
            <div className="step-list">
              {[
                ['1','Open your Google Sheet → click Extensions in the top menu → Apps Script'],
                ['2','Delete any existing code in the editor (Ctrl+A then Delete)'],
                ['3','Click Copy script below, then paste it into the Apps Script editor'],
                ['4','Click Save (floppy disk icon or Ctrl+S)'],
                ['5','Click Deploy → New deployment → set type to Web app'],
                ['6','Set "Who has access" to Anyone → click Deploy → copy the Web app URL'],
              ].map(([n,t])=>(
                <div key={n} className="step-item"><div className="step-num">{n}</div><div className="step-text">{t}</div></div>
              ))}
            </div>
            <div style={{ position:'relative', marginBottom:16 }}>
              <pre style={{ background:'var(--paper-warm)', borderRadius:'var(--radius)', padding:'14px', fontSize:11, fontFamily:'var(--font-mono)', overflowX:'auto', lineHeight:1.6, color:'var(--ink-mid)', maxHeight:140, whiteSpace:'pre-wrap' }}>{APPS_SCRIPT_CODE.slice(0,280)}…</pre>
              <button className="btn btn-teal btn-sm" style={{ position:'absolute', top:8, right:8 }} onClick={copy}>{copied?'✓ Copied!':'Copy script'}</button>
            </div>

            <div style={{ height:1, background:'var(--border)', margin:'20px 0' }}/>

            <h2>Step 2 — Connect your Google Sheet</h2>
            <p>Paste the spreadsheet ID from your Sheet URL — it's the long string between <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper-warm)',padding:'1px 5px',borderRadius:4}}>/d/</code> and <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper-warm)',padding:'1px 5px',borderRadius:4}}>/edit</code>.</p>
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Spreadsheet ID</label>
              <input className="form-input" value={id} onChange={e=>setId(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"/>
            </div>

            <div style={{ height:1, background:'var(--border)', margin:'20px 0' }}/>

            <h2>Step 3 — Paste the Apps Script URL</h2>
            <p>Paste the web app URL from Step 1 here. This enables the app to save data directly to your Sheet.</p>
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Apps Script web app URL</label>
              <input className="form-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"/>
            </div>
            <button className="btn btn-teal" style={{ width:'100%', justifyContent:'center', marginBottom:20 }} onClick={()=>onSave(id,url)}>
              Save connection
            </button>

            {url && <>
              <div style={{ height:1, background:'var(--border)', margin:'0 0 20px' }}/>
              <h2>Step 4 — Create sheet tabs automatically</h2>
              <p>Click below and Wander will create all 7 tabs in your Google Sheet with the correct column headers — no manual work needed.</p>
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleSetup} disabled={testing}>
                {testing ? '⏳ Creating tabs…' : setupDone ? '✓ All tabs created!' : '🚀 Auto-create all sheet tabs'}
              </button>
              {setupDone && <div style={{ marginTop:10, padding:'12px 14px', background:'var(--teal-light)', borderRadius:'var(--radius)', fontSize:13, color:'var(--teal)', lineHeight:1.6 }}>
                ✓ Done! Your sheet now has 7 tabs ready: Trips, Days, TravelTickets, Stays, Places, Personnels, OtherDocs. Everything you add or edit in the app will now appear in your Sheet instantly.
              </div>}
            </>}

            {id && <>
              <div style={{ height:1, background:'var(--border)', margin:'20px 0' }}/>
              <h2>🔗 Share your trips (view only)</h2>
              <p>Send this link to friends or travel companions. They can browse all your trips, itineraries, stays and tickets — but cannot edit anything.</p>
              <ShareLinkBox sheetId={id}/>
            </>}

            <div style={{ height:1, background:'var(--border)', margin:'20px 0' }}/>
            <details>
              <summary style={{ fontSize:13, fontWeight:500, cursor:'pointer', color:'var(--ink-mid)', userSelect:'none' }}>▶ View column headers (manual reference)</summary>
              <div style={{ background:'var(--paper-warm)', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:12, color:'var(--ink-mid)', lineHeight:2, marginTop:10 }}>
                <div><strong>Trips:</strong> id, name, emoji, status, destinations, startDate, endDate, budget, notes</div>
                <div><strong>Days:</strong> id, tripId, dayNumber, date, title, location, morning, afternoon, evening, transport, notes</div>
                <div><strong>TravelTickets:</strong> id, tripId, name, type, date, time, ref, fromTo, operator, details, cost, status, belongsTo, link, fileLabel</div>
                <div><strong>Stays:</strong> id, tripId, name, type, checkIn, checkOut, address, mapsUrl, lat, lng, ref, cost, paid, checkInNotes, extras, belongsTo, bookingLink</div>
                <div><strong>Places:</strong> id, tripId, dayId, name, time, category, mapsUrl, lat, lng, notes</div>
                <div><strong>Personnels:</strong> id, tripId, name, role, email, phone</div>
                <div><strong>OtherDocs:</strong> id, tripId, name, category, ref, issuedBy, expiryDate, belongsTo, notes, link, fileLabel</div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

// Stable key — never change this again or data will be lost on refresh
const STORAGE_KEY = 'wander_data';

function loadLocal() {
  try {
    // Try current key first
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return JSON.parse(current);
    // Migrate from any previous version keys
    for (const old of ['wander_v5','wander_v4','wander_v3','wander_v2','wander_v1']) {
      const prev = localStorage.getItem(old);
      if (prev) {
        const parsed = JSON.parse(prev);
        localStorage.setItem(STORAGE_KEY, prev); // migrate to new key
        localStorage.removeItem(old);
        return parsed;
      }
    }
    return null;
  } catch { return null; }
}

function saveLocal(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

// Only fall back to demo data if there is truly nothing saved at all
function orDemo(saved, key, demo) {
  if (!saved) return demo;
  // If key exists in saved (even as empty array), use it
  if (key in saved) return saved[key];
  return demo;
}

// Map data keys to their Google Sheet tab names
const SHEET_MAP = {
  trips: 'Trips', days: 'Days', docs: 'Documents',
  stays: 'Stays', places: 'Places', personnels: 'Personnels', otherDocs: 'OtherDocs',
};

export default function App() {
  const saved = loadLocal();
  const isFirstLoad = !saved; // true only on very first visit ever

  const [trips,      setTrips]      = useState(orDemo(saved, 'trips',      isFirstLoad ? DEMO_TRIPS      : []));
  const [days,       setDays]       = useState(orDemo(saved, 'days',       isFirstLoad ? DEMO_DAYS       : []));
  const [docs,       setDocs]       = useState(orDemo(saved, 'docs',       isFirstLoad ? DEMO_DOCS       : []));
  const [otherDocs,  setOtherDocs]  = useState(orDemo(saved, 'otherDocs',  isFirstLoad ? DEMO_OTHER_DOCS : []));
  const [stays,      setStays]      = useState(orDemo(saved, 'stays',      isFirstLoad ? DEMO_STAYS      : []));
  const [places,     setPlaces]     = useState(orDemo(saved, 'places',     isFirstLoad ? DEMO_PLACES     : []));
  const [personnels, setPersonnels] = useState(orDemo(saved, 'personnels', isFirstLoad ? DEMO_PERSONNELS : []));
  const [sheetsId,   setSheetsId]   = useState(saved?.sheetsId  || '');
  const [scriptUrl,  setScriptUrl]  = useState(saved?.scriptUrl || '');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [view, setView]             = useState('trips');
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Read scriptUrl from ref so CRUD closures always have the latest value
  const scriptUrlRef = { current: scriptUrl };

  async function syncToSheet(sheetKey, item, action='upsert') {
    const url = scriptUrlRef.current;
    if (!url) return;
    setSyncStatus('syncing');
    try {
      await pushToSheet(url, SHEET_MAP[sheetKey], item, action);
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }

  async function syncDelete(sheetKey, id) {
    const url = scriptUrlRef.current;
    if (!url) return;
    setSyncStatus('syncing');
    try {
      await deleteFromSheet(url, SHEET_MAP[sheetKey], id);
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
    }
  }

  function persist(u) {
    const next = { trips, days, docs, otherDocs, stays, places, personnels, sheetsId, scriptUrl, ...u };
    saveLocal(next);
    // Use explicit undefined check so empty arrays [] are preserved
    if ('trips'      in u) setTrips(u.trips);
    if ('days'       in u) setDays(u.days);
    if ('docs'       in u) setDocs(u.docs);
    if ('otherDocs'  in u) setOtherDocs(u.otherDocs);
    if ('stays'      in u) setStays(u.stays);
    if ('places'     in u) setPlaces(u.places);
    if ('personnels' in u) setPersonnels(u.personnels);
    if ('sheetsId'   in u) { setSheetsId(u.sheetsId); scriptUrlRef.current = u.sheetsId; }
    if ('scriptUrl'  in u) { setScriptUrl(u.scriptUrl); scriptUrlRef.current = u.scriptUrl; }
  }

  function clearDemoData() {
    if (window.confirm('This will delete all demo data and start fresh. Your real trips will not be affected once you start adding them. Continue?')) {
      persist({ trips:[], days:[], docs:[], otherDocs:[], stays:[], places:[], personnels:[] });
    }
  }

  // CRUD factory with automatic sheet write-back
  function crud(key, getter) {
    return {
      add: item => {
        persist({ [key]: [...getter(), item] });
        syncToSheet(key, item, 'upsert');
      },
      update: item => {
        persist({ [key]: getter().map(x => x.id===item.id ? item : x) });
        syncToSheet(key, item, 'upsert');
      },
      delete: id => {
        persist({ [key]: getter().filter(x => x.id!==id) });
        syncDelete(key, id);
      },
    };
  }

  const tripCrud      = crud('trips',      ()=>trips);
  const dayCrud       = crud('days',       ()=>days);
  const docCrud       = crud('docs',       ()=>docs);
  const otherDocCrud  = crud('otherDocs',  ()=>otherDocs);
  const stayCrud      = crud('stays',      ()=>stays);
  const placeCrud     = crud('places',     ()=>places);
  const personnelCrud = crud('personnels', ()=>personnels);

  const handlers = {
    addDay:           dayCrud.add,        updateDay:       dayCrud.update,       deleteDay:       dayCrud.delete,
    addDoc:           docCrud.add,        updateDoc:       docCrud.update,       deleteDoc:       docCrud.delete,
    addOtherDoc:      otherDocCrud.add,   updateOtherDoc:  otherDocCrud.update,  deleteOtherDoc:  otherDocCrud.delete,
    addStay:          stayCrud.add,       updateStay:      stayCrud.update,      deleteStay:      stayCrud.delete,
    addPlace:         placeCrud.add,      updatePlace:     placeCrud.update,     deletePlace:     placeCrud.delete,
    addPersonnel:     personnelCrud.add,  updatePersonnel: personnelCrud.update, deletePersonnel: personnelCrud.delete,
  };

  const navTo = v => { setView(v); setSelectedTrip(null); };
  const activeTrips = trips.filter(t=>t.status==='upcoming'||t.status==='planning');

  const syncLabel = syncStatus==='syncing' ? '⏳ Syncing to Sheet…'
    : syncStatus==='ok'    ? '✓ Saved to Sheet'
    : syncStatus==='error' ? '⚠️ Sheet sync failed'
    : scriptUrl            ? '✓ Sheet connected'
    : '💾 Saved locally';

  const isDemo = trips.length > 0 && trips[0]?.id === '1' && trips[0]?.name?.includes('Japan');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-wordmark">Wander</div>
          <div className="logo-tagline">Your travel space</div>
        </div>
        <div className="nav-section-label">Navigate</div>
        <button className={`nav-item ${view==='trips'&&!selectedTrip?'active':''}`} onClick={()=>navTo('trips')}><Map size={15}/>All trips</button>
        <button className={`nav-item ${view==='settings'?'active':''}`} onClick={()=>navTo('settings')}><Settings size={15}/>Settings & Sheets</button>
        {activeTrips.length>0 && <>
          <div className="nav-section-label">Active trips</div>
          {activeTrips.slice(0,5).map(t=>(
            <button key={t.id} className={`nav-item ${selectedTrip?.id===t.id?'active':''}`} onClick={()=>{setSelectedTrip(t);setView('trip');}}>
              <span style={{fontSize:14}}>{t.emoji}</span>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
            </button>
          ))}
        </>}
        <div className="sidebar-footer">
          <div style={{ color: syncStatus==='error'?'rgba(192,82,74,0.8)':syncStatus==='ok'?'rgba(45,168,130,0.9)':'rgba(255,255,255,0.3)', marginBottom:6, fontSize:11 }}>
            {syncLabel}
          </div>
          {isDemo && (
            <button onClick={clearDemoData} style={{ fontSize:10, color:'rgba(255,255,255,0.25)', background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'var(--font-body)', width:'100%' }}>
              Clear demo data
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        {selectedTrip
          ? <TripDetail trip={selectedTrip} days={days} docs={docs} otherDocs={otherDocs} stays={stays} places={places} personnels={personnels}
              onBack={()=>{setSelectedTrip(null);setView('trips');}} handlers={handlers}/>
          : view==='trips'
            ? <TripsView trips={trips} days={days} docs={docs} stays={stays} onSelect={t=>{setSelectedTrip(t);setView('trip');}} onAdd={tripCrud.add}/>
            : view==='settings'
              ? <SettingsView sheetsId={sheetsId} scriptUrl={scriptUrl} onSave={(id,url)=>{ persist({sheetsId:id,scriptUrl:url}); }}
                  onSetupSheet={()=>setupSheet(scriptUrl)}/>
              : null
        }
      </main>
    </div>
  );
}
