import { useState } from 'react';

export default function Setup() {
  const [id, setId] = useState('');
  const [error, setError] = useState('');

  function connect() {
    const clean = id.trim();
    if (!clean) { setError('Please paste your spreadsheet ID.'); return; }
    // Strip full URL if pasted by mistake
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const finalId = match ? match[1] : clean;
    localStorage.setItem('wander_sheet_id', finalId);
    window.location.reload();
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--paper)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:32, color:'var(--ink)', marginBottom:8 }}>✈ Wander</div>
      <p style={{ fontSize:14, color:'var(--ink-light)', marginBottom:32, textAlign:'center' }}>Connect your Google Sheet to view your trips</p>

      <div style={{ background:'var(--paper-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28, maxWidth:480, width:'100%' }}>
        <div style={{ fontSize:15, fontWeight:500, color:'var(--ink)', marginBottom:6 }}>Spreadsheet ID</div>
        <p style={{ fontSize:13, color:'var(--ink-light)', marginBottom:14, lineHeight:1.6 }}>
          Paste the ID from your Google Sheet URL — the string between <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper-warm)',padding:'1px 5px',borderRadius:4}}>/d/</code> and <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper-warm)',padding:'1px 5px',borderRadius:4}}>/edit</code>. You can also paste the full URL.
        </p>
        <div style={{ display:'flex', gap:8 }}>
          <input
            className="form-input" value={id}
            onChange={e => { setId(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            style={{ flex:1 }}
          />
          <button className="btn btn-teal" onClick={connect}>Connect</button>
        </div>
        {error && <p style={{ fontSize:12, color:'var(--rose)', marginTop:8 }}>{error}</p>}
        <p style={{ fontSize:11, color:'var(--ink-faint)', marginTop:14, lineHeight:1.6 }}>
          Make sure your Google Sheet is published to the web: File → Share → Publish to web → Entire document → Publish.
        </p>
      </div>
    </div>
  );
}
