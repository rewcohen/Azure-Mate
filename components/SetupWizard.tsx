import React, { useState } from 'react';
import { Shield, Key, CheckCircle, AlertCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { bootstrapAuth, CreatedApplication, APP_CLIENT_ID_KEY } from '../services/bootstrapAuth';

interface SetupWizardProps {
  onComplete: () => void;
}

type SetupStep = 'welcome' | 'authenticating' | 'creating' | 'success' | 'error' | 'manual';

interface SetupState {
  step: SetupStep;
  error: string | null;
  application: CreatedApplication | null;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [state, setState] = useState<SetupState>({
    step: 'welcome',
    error: null,
    application: null,
  });

  const [manualClientId, setManualClientId] = useState('');

  const handleAutoSetup = async () => {
    setState({ step: 'authenticating', error: null, application: null });

    try {
      // Step 1: Authenticate
      setState(prev => ({ ...prev, step: 'authenticating' }));

      // Step 2: Create app registration
      setState(prev => ({ ...prev, step: 'creating' }));
      const application = await bootstrapAuth.bootstrapApplication();

      setState({
        step: 'success',
        error: null,
        application,
      });
    } catch (error) {
      console.error('Setup failed:', error);
      setState({
        step: 'error',
        error: error instanceof Error ? error.message : String(error),
        application: null,
      });
    }
  };

  const handleManualSetup = () => {
    setState({ step: 'manual', error: null, application: null });
  };

  const handleManualSubmit = () => {
    const trimmedId = manualClientId.trim();

    // Basic GUID validation
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(trimmedId)) {
      setState(prev => ({
        ...prev,
        error: 'Please enter a valid Client ID (GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
      }));
      return;
    }

    localStorage.setItem(APP_CLIENT_ID_KEY, trimmedId);
    setState({
      step: 'success',
      error: null,
      application: { id: '', appId: trimmedId, displayName: 'Manual Entry' },
    });
  };

  const handleRetry = () => {
    setState({ step: 'welcome', error: null, application: null });
  };

  const handleComplete = () => {
    // Reload the page to reinitialize MSAL with the new client ID
    window.location.reload();
  };

  const renderWelcome = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Shield className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Azure Architect Mate</h1>
        <p className="text-slate-400">
          Let's set up Azure authentication to get started.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Quick Setup (Recommended)</h2>
        <p className="text-slate-400 text-sm">
          We'll automatically create an Azure AD App Registration for you using your admin credentials.
          This is the fastest way to get started.
        </p>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">Requirements:</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• You must be signed in as a Global Administrator or Application Administrator</li>
            <li>• Your tenant must allow app registrations (most do by default)</li>
            <li>• You'll need to grant the <code className="text-blue-300">Application.ReadWrite.All</code> permission</li>
          </ul>
        </div>
        <button
          onClick={handleAutoSetup}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Key className="w-5 h-5" />
          Set Up Automatically
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-900 text-slate-500">or</span>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Manual Setup</h2>
        <p className="text-slate-400 text-sm">
          If you already have an App Registration or prefer to create one manually in the Azure Portal.
        </p>
        <button
          onClick={handleManualSetup}
          className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all duration-200"
        >
          Enter Client ID Manually
        </button>
      </div>
    </div>
  );

  const renderAuthenticating = () => (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Authenticating...</h2>
        <p className="text-slate-400">
          Please sign in with your Azure AD administrator account in the popup window.
        </p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4">
        <p className="text-sm text-slate-500">
          You'll need to grant permission to create app registrations on your behalf.
        </p>
      </div>
    </div>
  );

  const renderCreating = () => (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Creating App Registration...</h2>
        <p className="text-slate-400">
          Setting up Azure Architect Mate in your tenant.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Authentication successful</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span>Creating app registration...</span>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
        <p className="text-slate-400">
          Azure Architect Mate has been registered in your Azure AD tenant.
        </p>
      </div>
      {state.application && (
        <div className="bg-slate-800/50 rounded-xl p-4 text-left">
          <h3 className="text-sm font-medium text-slate-400 mb-2">App Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Application Name:</span>
              <span className="text-white font-mono">{state.application.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client ID:</span>
              <span className="text-white font-mono text-xs">{state.application.appId}</span>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={handleComplete}
        className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-5 h-5" />
        Launch Azure Architect Mate
      </button>
    </div>
  );

  const renderError = () => (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Setup Failed</h2>
        <p className="text-slate-400">
          There was an error during the setup process.
        </p>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-left">
        <h3 className="text-red-400 font-medium mb-2">Error Details:</h3>
        <p className="text-sm text-slate-400 font-mono break-words">{state.error}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 text-left">
        <h3 className="text-slate-300 font-medium mb-2">Troubleshooting:</h3>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>• Ensure you're signed in as a Global Admin or Application Admin</li>
          <li>• Check that your tenant allows app registrations</li>
          <li>• Verify you have the required permissions</li>
          <li>• Try the manual setup option instead</li>
        </ul>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleRetry}
          className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all duration-200"
        >
          Try Again
        </button>
        <button
          onClick={handleManualSetup}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200"
        >
          Manual Setup
        </button>
      </div>
    </div>
  );

  const renderManual = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
          <Key className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Manual Setup</h2>
        <p className="text-slate-400">
          Enter your existing Azure AD App Registration Client ID.
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-blue-400 font-medium mb-2">How to create an App Registration:</h3>
        <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
          <li>Go to Azure Portal &gt; Azure Active Directory</li>
          <li>Navigate to App registrations &gt; New registration</li>
          <li>Name: "Azure Architect Mate"</li>
          <li>Supported account types: "Accounts in any organizational directory"</li>
          <li>Redirect URI: Single-page application (SPA) &gt; <code className="text-blue-300">{window.location.origin}</code></li>
          <li>Copy the Application (client) ID from the Overview page</li>
        </ol>
        <a
          href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
        >
          Open Azure Portal App Registrations
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">
          Application (Client) ID
        </label>
        <input
          type="text"
          value={manualClientId}
          onChange={(e) => setManualClientId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
        />
        {state.error && (
          <p className="text-red-400 text-sm">{state.error}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRetry}
          className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all duration-200"
        >
          Back
        </button>
        <button
          onClick={handleManualSubmit}
          disabled={!manualClientId.trim()}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200"
        >
          Save & Continue
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-800">
        {state.step === 'welcome' && renderWelcome()}
        {state.step === 'authenticating' && renderAuthenticating()}
        {state.step === 'creating' && renderCreating()}
        {state.step === 'success' && renderSuccess()}
        {state.step === 'error' && renderError()}
        {state.step === 'manual' && renderManual()}
      </div>
    </div>
  );
};

export default SetupWizard;
