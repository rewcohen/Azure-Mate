import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  PublicClientApplication,
  EventType,
  EventMessage,
  AuthenticationResult,
} from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import SetupWizard from './components/SetupWizard';
import { msalConfig, isConfigured } from './config/authConfig';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
msalInstance
  .initialize()
  .then(() => {
    // Handle redirect callback if returning from a redirect login
    msalInstance
      .handleRedirectPromise()
      .then((response) => {
        if (response) {
          msalInstance.setActiveAccount(response.account);
        }
      })
      .catch((error) => {
        console.error('Redirect error:', error);
      });

    // Set active account on login success
    msalInstance.addEventCallback((event: EventMessage) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const payload = event.payload as AuthenticationResult;
        msalInstance.setActiveAccount(payload.account);
      }
    });

    // Check for existing accounts and set active if found
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    // Render the app
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Could not find root element to mount to');
    }

    const root = ReactDOM.createRoot(rootElement);

    // Show SetupWizard if not configured, otherwise render the main app
    if (isConfigured()) {
      root.render(
        <React.StrictMode>
          <MsalProvider instance={msalInstance}>
            <App />
          </MsalProvider>
        </React.StrictMode>
      );
    } else {
      // Show setup wizard for first-time configuration
      root.render(
        <React.StrictMode>
          <SetupWizard onComplete={() => window.location.reload()} />
        </React.StrictMode>
      );
    }
  })
  .catch((error) => {
    console.error('MSAL initialization error:', error);
    // Render error state
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #e2e8f0; font-family: system-ui;">
        <h1 style="color: #ef4444;">Authentication Error</h1>
        <p>Failed to initialize authentication. Please check the console for details.</p>
        <pre style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; max-width: 600px; overflow: auto;">${error.message || error}</pre>
      </div>
    `;
    }
  });
