import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';

import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import './index.css';

// Ensure demo token is pre-set so no login screen is required
if (!localStorage.getItem("auth_token")) {
  localStorage.setItem("auth_token", "demo-presentation-token");
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_bGl2ZS1tb25rZXktMjcuY2xlcmsuYWNjb3VudHMuZGV2JA";

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </ErrorBoundary>
);
