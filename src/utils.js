export function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}

export function nights(a, b) {
  if (!a || !b) return '?';
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return isNaN(n) ? '?' : n;
}

export function matchesSearch(obj, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return Object.values(obj).some(v => String(v).toLowerCase().includes(lower));
}

export const AVATAR_COLORS = [
  { bg:'#e8f5f0', color:'#1a7a5e' },
  { bg:'#f0edf8', color:'#5a4a8a' },
  { bg:'#fdf3e3', color:'#c47a1e' },
  { bg:'#fdf0ef', color:'#c0524a' },
  { bg:'#e6f1fb', color:'#185fa5' },
  { bg:'#f3efe8', color:'#4a4640' },
];

export function avatarColor(name, i=0) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || i) % AVATAR_COLORS.length];
}

export function initials(name) {
  return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
}

export const CAT_COLORS = {
  Food:      { bg:'#fdf3e3', color:'#c47a1e', dot:'#c47a1e' },
  Sights:    { bg:'#e8f5f0', color:'#1a7a5e', dot:'#1a7a5e' },
  Activity:  { bg:'#f0edf8', color:'#5a4a8a', dot:'#5a4a8a' },
  Transport: { bg:'#f1efe8', color:'#8a8480', dot:'#8a8480' },
  Shopping:  { bg:'#fdf0ef', color:'#c0524a', dot:'#c0524a' },
  Stay:      { bg:'#e6f1fb', color:'#185fa5', dot:'#185fa5' },
  Other:     { bg:'#f3efe8', color:'#4a4640', dot:'#4a4640' },
};

export function catStyle(cat) { return CAT_COLORS[cat] || CAT_COLORS.Other; }

export const OTHER_DOC_CATEGORIES = [
  'Passport', 'Visa', 'Travel Insurance', 'Health / Vaccination',
  'Receipt', 'Booking Confirmation', 'Itinerary', 'Emergency Contact', 'Other'
];

// Google Sheets Apps Script write-back
// Sends a row append to a deployed Apps Script web app
export async function pushToSheet(scriptUrl, sheetName, row) {
  if (!scriptUrl) return false;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, row }),
    });
    return true;
  } catch { return false; }
}

// Convert file to base64 for local storage
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
