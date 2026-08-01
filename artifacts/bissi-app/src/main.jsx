import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './index.css';
import { setBaseUrl } from "@workspace/api-client-react";

// Set default API base URL for customFetch calls
setBaseUrl("/api");

if (typeof window !== "undefined") {
  if (!localStorage.getItem("auth_token")) {
    localStorage.setItem("auth_token", "demo-presentation-token");
  }
  if (!localStorage.getItem("collector_token")) {
    localStorage.setItem("collector_token", "demo-presentation-token");
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
