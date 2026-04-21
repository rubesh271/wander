// useSheets.js — reads from a published Google Sheet (CSV export)
// Sheets must be published: File > Share > Publish to web > CSV

import { useState, useEffect, useCallback } from 'react';

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue; }
      if (line[i] === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += line[i];
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

async function fetchSheet(sheetUrl) {
  try {
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error('Failed to fetch sheet');
    const text = await res.text();
    return parseCSV(text);
  } catch (e) {
    console.error('Sheet fetch error:', e);
    return null;
  }
}

// Build CSV export URL from a published Google Sheets URL
// Published URL format: https://docs.google.com/spreadsheets/d/ID/pub?gid=GID&single=true&output=csv
export function buildSheetUrl(spreadsheetId, gid = '0') {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?gid=${gid}&single=true&output=csv`;
}

export function useSheets(sheetUrls) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!sheetUrls || Object.keys(sheetUrls).length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = {};
      await Promise.all(
        Object.entries(sheetUrls).map(async ([key, url]) => {
          const rows = await fetchSheet(url);
          results[key] = rows;
        })
      );
      setData(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(sheetUrls)]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
