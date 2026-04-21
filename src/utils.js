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

// Sheet headers for each tab — order must match what Apps Script expects
export const SHEET_HEADERS = {
  Trips:      ['id','name','emoji','status','destinations','startDate','endDate','budget','notes'],
  Days:       ['id','tripId','dayNumber','date','title','location','morning','afternoon','evening','transport','notes'],
  Documents:  ['id','tripId','name','type','date','time','ref','fromTo','operator','details','cost','status','belongsTo','link','fileLabel'],
  Stays:      ['id','tripId','name','type','checkIn','checkOut','address','mapsUrl','lat','lng','ref','cost','paid','checkInNotes','extras','belongsTo'],
  Places:     ['id','tripId','dayId','name','time','category','mapsUrl','lat','lng','notes'],
  Personnels: ['id','tripId','name','role','email','phone'],
  OtherDocs:  ['id','tripId','name','category','ref','issuedBy','expiryDate','belongsTo','notes','link','fileLabel'],
};

// Push a row to the Apps Script web app (add or update)
export async function pushToSheet(scriptUrl, sheetName, row, action='upsert') {
  if (!scriptUrl) return false;
  // Strip fileData (base64) from sheet rows — too large, just store link/label
  const safeRow = { ...row };
  delete safeRow.fileData;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, row: safeRow, action }),
    });
    return true;
  } catch { return false; }
}

// Delete a row from the sheet by id
export async function deleteFromSheet(scriptUrl, sheetName, id) {
  if (!scriptUrl) return false;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, action: 'delete', id }),
    });
    return true;
  } catch { return false; }
}

// Setup sheet headers via Apps Script
export async function setupSheet(scriptUrl) {
  if (!scriptUrl) return false;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup', headers: SHEET_HEADERS }),
    });
    return true;
  } catch { return false; }
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
export const APPS_SCRIPT_CODE = `// Wander — Google Sheets Apps Script
// Paste this into Extensions > Apps Script, then Deploy as Web App

const SHEET_HEADERS = {
  Trips:      ['id','name','emoji','status','destinations','startDate','endDate','budget','notes'],
  Days:       ['id','tripId','dayNumber','date','title','location','morning','afternoon','evening','transport','notes'],
  Documents:  ['id','tripId','name','type','date','time','ref','fromTo','operator','details','cost','status','belongsTo','link','fileLabel'],
  Stays:      ['id','tripId','name','type','checkIn','checkOut','address','mapsUrl','lat','lng','ref','cost','paid','checkInNotes','extras','belongsTo'],
  Places:     ['id','tripId','dayId','name','time','category','mapsUrl','lat','lng','notes'],
  Personnels: ['id','tripId','name','role','email','phone'],
  OtherDocs:  ['id','tripId','name','category','ref','issuedBy','expiryDate','belongsTo','notes','link','fileLabel'],
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Setup: create all tabs with headers
    if (data.action === 'setup') {
      Object.entries(data.headers).forEach(([name, headers]) => {
        let sheet = ss.getSheetByName(name);
        if (!sheet) sheet = ss.insertSheet(name);
        if (sheet.getLastRow() === 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
          sheet.setFrozenRows(1);
        }
      });
      return ok('Setup complete');
    }

    const sheet = ss.getSheetByName(data.sheet);
    if (!sheet) return ok('Sheet not found: ' + data.sheet);

    // Delete a row by id
    if (data.action === 'delete') {
      const idCol = 1;
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return ok('Nothing to delete');
      const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat().map(String);
      const idx = ids.indexOf(String(data.id));
      if (idx >= 0) sheet.deleteRow(idx + 2);
      return ok('Deleted');
    }

    // Upsert: add or update
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(h => data.row[h] !== undefined ? String(data.row[h]) : '');
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
      const idx = ids.indexOf(String(data.row.id));
      if (idx >= 0) {
        sheet.getRange(idx + 2, 1, 1, headers.length).setValues([row]);
        return ok('Updated row ' + (idx + 2));
      }
    }
    sheet.appendRow(row);
    return ok('Appended');

  } catch(err) {
    return ContentService.createTextOutput('Error: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Wander script is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function ok(msg) {
  return ContentService.createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}`;
