# The Childkeeper's Log

A whimsical web app for tracking childcare work hours, managing family rates, and generating monthly reports.

## Features

- **User Authentication**: Secure sign-up and sign-in with Firebase
- **Family Management**: Add families and configure hourly rates based on number of children
- **Time Entry Logging**: Log hours with start/end times, automatically calculates earnings
- **Reports & Export**: Generate monthly summaries and export to PDF
- **Responsive Design**: Works beautifully on mobile, tablet, and desktop

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **Testing**: Vitest + React Testing Library
- **PDF Export**: jsPDF + html2canvas

## Setup

### Prerequisites

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
