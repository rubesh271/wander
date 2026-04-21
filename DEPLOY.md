# Deploying Wander to GitHub Pages (free, forever)

## One-time setup (~10 minutes)

### 1. Install Git & Node
- Git: https://git-scm.com/downloads
- Node.js: https://nodejs.org (LTS version)

### 2. Create a GitHub account
Go to https://github.com and sign up (free).

### 3. Create a new repository
- Click the + icon → New repository
- Name it `wander`
- Set to Public
- Don't add README or .gitignore
- Click Create repository

### 4. Upload the code
Open Terminal (Mac/Linux) or Command Prompt (Windows), navigate to this folder, then run:

```bash
npm install
git init
git add .
git commit -m "Initial Wander app"
git remote add origin https://github.com/YOUR_USERNAME/wander.git
git branch -M main
git push -u origin main
```

Replace YOUR_USERNAME with your GitHub username.

### 5. Deploy to GitHub Pages

```bash
npm install gh-pages --save-dev
npm run deploy
```

### 6. Enable GitHub Pages
- Go to your repository on GitHub
- Settings → Pages
- Under "Branch", select `gh-pages` → / (root)
- Click Save

Your site will be live at:
**https://YOUR_USERNAME.github.io/wander/**

(Takes 1-2 minutes to go live after first deploy.)

---

## Updating the app in future

After making changes:
```bash
npm run deploy
```

That's it — builds and deploys automatically.

---

## Connecting Google Sheets

1. Go to sheets.google.com → create a new spreadsheet named `Wander`
2. Create 4 tabs: `Trips`, `Days`, `Documents`, `Stays`
3. Add the headers below to each tab (row 1):

**Trips:** id, name, emoji, status, destinations, startDate, endDate, budget, notes

**Days:** id, tripId, dayNumber, date, title, location, morning, afternoon, evening, transport, notes

**Documents:** id, tripId, name, type, date, time, ref, fromTo, operator, details, cost, status

**Stays:** id, tripId, name, type, checkIn, checkOut, address, mapsUrl, ref, cost, paid, checkInNotes, extras

4. File → Share → Publish to web
   - Publish each sheet as CSV
5. Copy the Spreadsheet ID from the URL
6. In the Wander app → Settings → paste the ID → Connect

---

## Tips

- Data is saved locally in your browser automatically
- Google Sheets sync lets you access from any device
- Share the Google Sheet with travel companions so they can view/edit
- The app works on mobile — add it to your home screen via your browser's "Add to Home Screen" option
