import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SharedView from './SharedView.jsx';
import Setup from './Setup.jsx';
import './index.css';

// Get sheet ID — from URL param (?sheet=ID) or from localStorage
const urlParams = new URLSearchParams(window.location.search);
const sheetIdFromUrl = urlParams.get('sheet');
const sheetIdFromStorage = localStorage.getItem('wander_sheet_id');
const sheetId = sheetIdFromUrl || sheetIdFromStorage;

// If a sheet ID was in the URL, save it for next time
if (sheetIdFromUrl) localStorage.setItem('wander_sheet_id', sheetIdFromUrl);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sheetId ? <SharedView sheetId={sheetId}/> : <Setup/>}
  </StrictMode>
);
