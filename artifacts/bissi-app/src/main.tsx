import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import './index.css';

// Ensure demo token is pre-set so no login screen is required
if (!localStorage.getItem("auth_token")) {
  localStorage.setItem("auth_token", "demo-presentation-token");
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
