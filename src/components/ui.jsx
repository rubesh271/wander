import { X, Navigation, ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import { avatarColor, initials, catStyle } from '../utils.js';

export function Modal({ title, onClose, onSave, saveLabel='Save', children, wide=false }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth:640 } : {}}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-teal" onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{hint && <span style={{ fontWeight:400, color:'var(--ink-faint)', marginLeft:5 }}>{hint}</span>}</label>
      {children}
    </div>
  );
}

export function Avatar({ name, size=24, index=0 }) {
  const ac = avatarColor(name, index);
  return (
    <span className="person-avatar" style={{ width:size, height:size, background:ac.bg, color:ac.color, fontSize:size*0.38, flexShrink:0 }}>
      {initials(name)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const m = { upcoming:['badge-upcoming','Upcoming'], planning:['badge-planning','Planning'], dream:['badge-dream','Dream trip'], done:['badge-done','Done'] };
  const [cls, label] = m[status] || ['badge-done', status];
  return <span className={`trip-status-badge ${cls}`}>{label}</span>;
}

export function TypeBadge({ type }) {
  const c = { Flight:'var(--teal-light)', Train:'var(--amber-light)', Pass:'var(--rose-light)', Visa:'var(--rose-light)', Hotel:'var(--teal-light)', Airbnb:'var(--purple-light)' };
  return <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:c[type]||'var(--paper-warm)', color:'var(--ink-mid)' }}>{type}</span>;
}

export function CategoryBadge({ cat, label }) {
  const cs = catStyle(cat || label);
  return <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:cs.bg, color:cs.color, fontWeight:500 }}>{label || cat}</span>;
}

export function SearchFilterBar({ query, onQuery, persons=[], activePerson, onPerson, placeholder='Search anything…' }) {
  return (
    <div className="search-filter-bar">
      <div className="search-input-wrap">
        <Search size={14}/>
        <input className="search-input" placeholder={placeholder} value={query} onChange={e => onQuery(e.target.value)}/>
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

export function MapModal({ title, subtitle, items, onClose }) {
  const [active, setActive] = useState(items[0]?.id || null);
  const activeItem = items.find(p => p.id === active);

  function buildEmbedUrl(item) {
    if (!item) return null;
    // Use the Maps URL to extract a query, or fall back to place name
    if (item.mapsUrl) {
      const qMatch = item.mapsUrl.match(/[?&]q=([^&]+)/);
      const q = qMatch ? qMatch[1] : encodeURIComponent(item.name);
      return `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
    }
    if (item.name) return `https://maps.google.com/maps?q=${encodeURIComponent(item.name)}&z=15&output=embed`;
    return null;
  }

  function buildDirectionsUrl() {
    const pts = items.filter(p => p.name || p.mapsUrl);
    if (pts.length === 0) return null;
    function pointStr(p) {
      if (p.mapsUrl) {
        const qMatch = p.mapsUrl.match(/[?&]q=([^&]+)/);
        if (qMatch) return qMatch[1];
      }
      return encodeURIComponent(p.name);
    }
    if (pts.length === 1) return pts[0].mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(pts[0].name)}`;
    const origin = pointStr(pts[0]);
    const dest   = pointStr(pts[pts.length-1]);
    const wps    = pts.slice(1,-1).map(pointStr).join('|');
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
                <div className="map-place-num" style={{ background:item.dotBg||'var(--teal-light)', color:item.dotColor||'var(--teal)' }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="map-place-name">{item.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2, flexWrap:'wrap' }}>
                    {item.subtitle && <span className="map-place-time">{item.subtitle}</span>}
                    {item.badge && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:item.dotBg||'var(--teal-light)', color:item.dotColor||'var(--teal)', fontWeight:500 }}>{item.badge}</span>}
                  </div>
                  {item.notes && <div style={{ fontSize:11, color:'var(--ink-light)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.notes}</div>}
                </div>
                {item.mapsUrl && <a href={item.mapsUrl} target="_blank" rel="noreferrer" className="place-link" onClick={e=>e.stopPropagation()}><ExternalLink size={12}/></a>}
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

export function AttachmentField({ fileData, fileLabel, link, onFileChange, onLinkChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div className="form-group">
        <label className="form-label">Attachment link <span style={{ fontWeight:400, color:'var(--ink-faint)' }}>(Google Drive, Dropbox, etc.)</span></label>
        <input className="form-input" value={link||''} onChange={e=>onLinkChange(e.target.value)} placeholder="https://drive.google.com/..."/>
      </div>
      <div className="form-group">
        <label className="form-label">Upload file <span style={{ fontWeight:400, color:'var(--ink-faint)' }}>(PDF or image — stored in browser)</span></label>
        <div className="file-upload-zone" onClick={() => document.getElementById('file-upload-input').click()}>
          {fileData
            ? <span style={{ color:'var(--teal)', fontSize:13, fontWeight:500 }}>📎 {fileLabel || 'File attached'} <span style={{ fontWeight:400, color:'var(--ink-light)' }}>— click to replace</span></span>
            : <span style={{ color:'var(--ink-faint)', fontSize:13 }}>Click to upload a PDF or image</span>
          }
          <input id="file-upload-input" type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={onFileChange}/>
        </div>
      </div>
    </div>
  );
}

export function AttachmentChips({ fileData, fileLabel, link }) {
  if (!fileData && !link) return null;
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
      {link && <a href={link} target="_blank" rel="noreferrer" className="chip" style={{ color:'var(--teal)', textDecoration:'none' }}><ExternalLink size={11}/> {link.includes('drive.google') ? 'Google Drive' : link.includes('dropbox') ? 'Dropbox' : 'Link'}</a>}
      {fileData && <span className="chip" style={{ color:'var(--ink-mid)', cursor:'pointer' }} onClick={() => {
        const a = document.createElement('a'); a.href = fileData; a.download = fileLabel || 'attachment'; a.click();
      }}>📎 {fileLabel || 'Download'}</span>}
    </div>
  );
}

export function InlineEditWrapper({ isEditing, onEdit, onSave, onCancel, onDelete, children, editChildren }) {
  return (
    <div style={{ position:'relative' }}>
      {!isEditing && (
        <div className="card-edit-bar">
          <button className="card-edit-btn" onClick={onEdit} title="Edit">✏️</button>
          {onDelete && <button className="card-edit-btn card-delete-btn" onClick={onDelete} title="Delete">🗑</button>}
        </div>
      )}
      {isEditing ? (
        <div>
          {editChildren}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
            <button className="btn btn-teal btn-sm" onClick={onSave}>Save changes</button>
          </div>
        </div>
      ) : children}
    </div>
  );
}
