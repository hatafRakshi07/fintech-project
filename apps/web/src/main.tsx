import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './index.css';
import { log } from '../../../utils/log';
const appName = 'bissi-app';
const originalConsoleLog = console.log;
console.log = (...args) => log(appName, ...args);
import { setBaseUrl } from "@workspace/api-client-react";

// Set default API base URL for customFetch calls
setBaseUrl("/api");

// Ensure demo token & user are pre-set so no login screen is required
if (!localStorage.getItem("auth_token")) {
  localStorage.setItem("auth_token", "demo-presentation-token");
}
if (!localStorage.getItem("collector_token")) {
  localStorage.setItem("collector_token", "demo-presentation-token");
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
