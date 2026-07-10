# The Childkeeper's Log

A whimsical web app for tracking childcare work hours, managing family rates, and generating monthly reports.

## Features

- **Progressive Web App (PWA)**: Installable on desktop/mobile with offline shell caching
- **Offline Sync Support**: Firestore persists local writes and syncs automatically when back online

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **Testing**: Vitest + React Testing Library
- **PDF Export**: jsPDF + html2canvas

PWA build artifacts are generated in `dist`:

- `manifest.webmanifest`
- `sw.js`
- `workbox-*.js`

## Setup

### Prerequisites

## PWA Notes

- The app is installable on Chromium browsers and iOS Safari (Add to Home Screen).
- Supported browsers show an in-app install prompt when installation is available.
- On iOS Safari, an in-app hint explains how to use Share > Add to Home Screen.
- App shell/static assets are cached for offline startup after first load.
- Uncached navigation requests fall back to a dedicated offline page (`/offline.html`).
- Firestore uses persistent local cache with multi-tab support; writes made offline are queued locally and synced when reconnected.
- A connectivity banner indicates offline mode and pending reconnect sync state.
- When a new service worker is available, an in-app update prompt appears.

### PWA Verification Checklist

1. Run `npm run build` and confirm `manifest.webmanifest` and `sw.js` exist in `dist`.
2. Run `npm run preview`, open app, then switch to offline mode in browser devtools.
3. Refresh and verify the app shell still loads.
4. Create or edit records while offline and verify they appear and then sync after reconnecting.
5. Run Lighthouse PWA audit against preview/deployed URL.

- Node.js 16+ and npm
- Firebase project (get credentials from console.firebase.google.com)

### Installation

1. Clone or download the project
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` file in the root with Firebase credentials:

   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   App opens at `http://localhost:3000`

## Development

### Run Tests

```bash
npm run test          # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Build for Production

```bash
npm run build
npm run preview
```

## Deployment

### Firebase Hosting

1. Install Firebase CLI:

   ```bash
   npm install -g firebase-tools
   ```

2. Initialize Firebase:

   ```bash
   firebase login
   firebase init hosting
   ```

3. Deploy:
   ```bash
   npm run build
   firebase deploy
   ```

Your app will be live at `https://your-project.web.app`

## Usage

1. **Sign Up**: Create a new account with email and password
2. **Add Families**: Go to Families page and add each family with rates for 1, 2, 3 children
3. **Log Hours**: Click "Log Hours" to record start/end times. Earnings calculated automatically
4. **Generate Reports**: View Reports page, select date range, and export monthly summary as PDF

## Project Structure

```
src/
├── context/          # Auth context for user state
├── services/         # Business logic (families, time entries, reports, PDF)
├── pages/            # Page components (Dashboard, Families, LogHours, Reports)
├── components/       # Reusable components (Navbar, ProtectedRoute)
├── test/             # Test setup and utilities
├── App.jsx           # Main app with routing
├── main.jsx          # Entry point
└── index.css         # Global styles
```

## Testing

All services and components are tested with Vitest. Tests verify:

- Input validation
- Calculation accuracy
- Error handling
- Firebase integration

Run `npm run test` to execute the full test suite.
