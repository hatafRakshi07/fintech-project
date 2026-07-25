import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';

import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_bGl2ZS1tb25rZXktMjcuY2xlcmsuYWNjb3VudHMuZGV2JA";

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </ErrorBoundary>
);
