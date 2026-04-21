import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharedView from './SharedView.jsx'
import './index.css'

// Check if this is a shared view link (?sheet=SPREADSHEET_ID)
const urlParams = new URLSearchParams(window.location.search);
const sharedSheetId = urlParams.get('sheet');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sharedSheetId
      ? <SharedView sheetId={sharedSheetId} />
      : <App />
    }
  </StrictMode>
)
