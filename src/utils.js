export function fmt(d) {
  if (!d) return '—';
  try {
    // Handle YYYY-MM-DD from Google Sheets without timezone shift
    const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = iso
      ? new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3]))
      : new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  } catch { return String(d); }
}

export function fmtShort(d) {
  if (!d) return '—';
  try {
    const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = iso
      ? new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3]))
      : new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  } catch { return String(d); }
}

export function fmtDay(d) {
  if (!d) return '—';
  try {
    const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = iso
      ? new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3]))
      : new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
  } catch { return String(d); }
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

// Sheet headers for each tab — order must match what Apps Script expects
export const SHEET_HEADERS = {
  Trips:      ['id','name','emoji','status','destinations','startDate','endDate','budget','notes'],
  Days:       ['id','tripId','dayNumber','date','title','location','morning','afternoon','evening','transport','notes'],
  Documents:  ['id','tripId','name','type','date','time','ref','fromTo','operator','details','cost','status','belongsTo','link','fileLabel'],
  Stays:      ['id','tripId','name','type','checkIn','checkOut','address','mapsUrl','ref','cost','paid','checkInNotes','extras','belongsTo'],
  Places:     ['id','tripId','dayId','name','time','category','mapsUrl','notes'],
  Personnels: ['id','tripId','name','role','email','phone'],
  OtherDocs:  ['id','tripId','name','category','ref','issuedBy','expiryDate','belongsTo','notes','link','fileLabel'],
};

// Send data to Apps Script via GET request with URL-encoded payload.
// This bypasses CORS — Apps Script handles GET requests without requiring
// special headers, unlike POST which gets blocked by browsers.
async function callScript(scriptUrl, params) {
  if (!scriptUrl) return false;
  try {
    // Encode the entire payload as a single 'data' param to keep URLs clean
    const url = scriptUrl + '?data=' + encodeURIComponent(JSON.stringify(params));
    await fetch(url, { method: 'GET', mode: 'no-cors' });
    return true;
  } catch { return false; }
}

// Push a row to the Apps Script web app (add or update)
export async function pushToSheet(scriptUrl, sheetName, row, action='upsert') {
  if (!scriptUrl) return false;
  const safeRow = { ...row };
  delete safeRow.fileData; // base64 is too large for URL params — only store label/link
  return callScript(scriptUrl, { action, sheet: sheetName, row: safeRow });
}

// Delete a row from the sheet by id
export async function deleteFromSheet(scriptUrl, sheetName, id) {
  if (!scriptUrl) return false;
  return callScript(scriptUrl, { action: 'delete', sheet: sheetName, id });
}

// Setup sheet headers via Apps Script
export async function setupSheet(scriptUrl) {
  if (!scriptUrl) return false;
  return callScript(scriptUrl, { action: 'setup', headers: SHEET_HEADERS });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// The complete Apps Script to paste into Extensions > Apps Script
export const APPS_SCRIPT_CODE = `// Wander — Google Sheets Apps Script v2
// Paste into Extensions > Apps Script, then Deploy as Web App
// Execute as: Me | Who has access: Anyone

const SHEET_HEADERS = {
  Trips:      ['id','name','emoji','status','destinations','startDate','endDate','budget','notes'],
  Days:       ['id','tripId','dayNumber','date','title','location','morning','afternoon','evening','transport','notes'],
  Documents:  ['id','tripId','name','type','date','time','ref','fromTo','operator','details','cost','status','belongsTo','link','fileLabel'],
  Stays:      ['id','tripId','name','type','checkIn','checkOut','address','mapsUrl','ref','cost','paid','checkInNotes','extras','belongsTo'],
  Places:     ['id','tripId','dayId','name','time','category','mapsUrl','notes'],
  Personnels: ['id','tripId','name','role','email','phone'],
  OtherDocs:  ['id','tripId','name','category','ref','issuedBy','expiryDate','belongsTo','notes','link','fileLabel'],
};

function doGet(e) {
  try {
    // Parse the data param sent by the Wander app
    var raw = e.parameter.data;
    if (!raw) return respond('Wander script is live.');
    var data = JSON.parse(decodeURIComponent(raw));
    return handleRequest(data);
  } catch(err) {
    return respond('Error: ' + err.message);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    return handleRequest(data);
  } catch(err) {
    return respond('Error: ' + err.message);
  }
}

function handleRequest(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Setup: create all tabs with headers
  if (data.action === 'setup') {
    var headers = data.headers || SHEET_HEADERS;
    Object.keys(headers).forEach(function(name) {
      var cols = headers[name];
      var sheet = ss.getSheetByName(name);
      if (!sheet) sheet = ss.insertSheet(name);
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
        sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    });
    return respond('Setup complete');
  }

  var sheet = ss.getSheetByName(data.sheet);
  if (!sheet) return respond('Sheet not found: ' + data.sheet);

  // Delete a row by id
  if (data.action === 'delete') {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return respond('Nothing to delete');
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r){ return String(r[0]); });
    var idx = ids.indexOf(String(data.id));
    if (idx >= 0) sheet.deleteRow(idx + 2);
    return respond('Deleted');
  }

  // Upsert: update existing row or append new one
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) {
    return data.row[h] !== undefined ? String(data.row[h]) : '';
  });
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r){ return String(r[0]); });
    var rowIdx = existingIds.indexOf(String(data.row.id));
    if (rowIdx >= 0) {
      sheet.getRange(rowIdx + 2, 1, 1, headers.length).setValues([row]);
      return respond('Updated');
    }
  }
  sheet.appendRow(row);
  return respond('Added');
}

function respond(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}`;
