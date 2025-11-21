import React, { useState, useEffect, useCallback } from 'react';
import { useMsal, useAccount } from '@azure/msal-react';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { AzureContext } from '../types';
import {
  ShieldCheck, Loader2, User, CheckCircle2, X, Globe, Lock,
  ChevronRight, AlertCircle, UserPlus, LogIn, Building2, RefreshCw
} from 'lucide-react';
import { loginRequest, adminConsentRequest, isConfigured, buildAdminConsentUrl } from '../config/authConfig';
import { listSubscriptions, getUserProfile, AzureSubscription } from '../services/azureService';

interface ConnectWizardProps {
  onClose: () => void;
  onConnect: (ctx: AzureContext) => void;
  onAutoPopulate: (location: string, env: string, owner: string) => void;
}

type WizardStep = 'accounts' | 'authenticating' | 'subscriptions' | 'success' | 'error';

const ConnectWizard: React.FC<ConnectWizardProps> = ({ onClose, onConnect, onAutoPopulate }) => {
  const { instance, accounts, inProgress } = useMsal();
  const [step, setStep] = useState<WizardStep>('accounts');
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [userProfile, setUserProfile] = useState<{ displayName: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if app is configured
  const configured = isConfigured();

  // Get all cached accounts from MSAL
  const cachedAccounts = accounts;

  // Handle account selection and login
  const handleAccountSelect = useCallback(async (account: AccountInfo | null, isNewLogin: boolean = false) => {
    setError(null);
    setIsLoading(true);
    setStep('authenticating');

    try {
      let activeAccount = account;

      if (isNewLogin || !account) {
        // Initiate login with account picker
        const response = await instance.loginPopup({
          ...loginRequest,
          prompt: 'select_account', // Always show account picker for new login
        });
        activeAccount = response.account;
      } else {
        // Use existing account, try silent token acquisition
        instance.setActiveAccount(account);
        try {
          await instance.acquireTokenSilent({
            ...loginRequest,
            account: account,
          });
          activeAccount = account;
        } catch {
          // Silent failed, do interactive login
          const response = await instance.loginPopup({
            ...loginRequest,
            account: account,
          });
          activeAccount = response.account;
        }
      }

      if (!activeAccount) {
        throw new Error('No account selected');
      }

      setSelectedAccount(activeAccount);
      instance.setActiveAccount(activeAccount);

      // Fetch user profile
      try {
        const profile = await getUserProfile(instance, activeAccount);
        setUserProfile({
          displayName: profile.displayName,
          email: profile.userPrincipalName || profile.mail || activeAccount.username || '',
        });
      } catch {
        // Fallback to account info if Graph call fails
        setUserProfile({
          displayName: activeAccount.name || 'User',
          email: activeAccount.username || '',
        });
      }

      // Fetch subscriptions
      const subs = await listSubscriptions(instance, activeAccount);
      setSubscriptions(subs);

      if (subs.length > 0) {
        setSelectedSub(subs[0].subscriptionId);
        setStep('subscriptions');
      } else {
        setError('No Azure subscriptions found. Please ensure your account has access to Azure subscriptions.');
        setStep('error');
      }
    } catch (err: any) {
      console.error('Authentication error:', err);

      // Handle specific errors
      if (err.errorCode === 'user_cancelled') {
        setStep('accounts');
        setError(null);
      } else if (err.errorCode === 'consent_required' || err.message?.includes('AADSTS65001')) {
        setError('Admin consent required. Please have a Global Administrator sign in and approve the permissions, or use the Admin Consent link below.');
        setStep('error');
      } else if (err.errorCode === 'interaction_in_progress') {
        setError('Another sign-in is already in progress. Please wait or refresh the page.');
        setStep('error');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
        setStep('error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [instance]);

  // Handle admin consent flow
  const handleAdminConsent = async () => {
    setError(null);
    setIsLoading(true);
    setStep('authenticating');

    try {
      const response = await instance.loginPopup(adminConsentRequest);
      if (response.account) {
        await handleAccountSelect(response.account, false);
      }
    } catch (err: any) {
      if (err.errorCode === 'user_cancelled') {
        setStep('accounts');
      } else {
        setError(err.message || 'Admin consent failed. Please try again.');
        setStep('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Finalize connection
  const handleFinalize = () => {
    if (!selectedAccount || !selectedSub) return;

    const sub = subscriptions.find(s => s.subscriptionId === selectedSub);
    if (sub) {
      onConnect({
        isConnected: true,
        subscriptionId: sub.subscriptionId,
        tenantId: sub.tenantId,
        userDisplayName: userProfile?.displayName || selectedAccount.name || 'User',
        username: userProfile?.email || selectedAccount.username || '',
      });

      // Auto-populate global variables with subscription info
      // Use the user's email as owner
      const ownerEmail = userProfile?.email || selectedAccount.username || '';
      onAutoPopulate('', '', ownerEmail);

      setStep('success');
      setTimeout(onClose, 1500);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate progress
  const getProgress = (): number => {
    switch (step) {
      case 'accounts': return 10;
      case 'authenticating': return 50;
      case 'subscriptions': return 90;
      case 'success': return 100;
      case 'error': return 50;
      default: return 0;
    }
  };

  // If not configured, show setup instructions
  if (!configured) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Configuration Required</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-slate-300">
              Azure AD App Registration is not configured. Please set up the following environment variable:
            </p>
            <div className="bg-slate-800 p-3 rounded-lg font-mono text-sm text-slate-300">
              VITE_AZURE_CLIENT_ID=your-client-id
            </div>
            <p className="text-sm text-slate-400">
              See <span className="text-blue-400">AZURE_AD_SETUP.md</span> for detailed instructions on creating an App Registration in Azure Portal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Connect to Azure</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" disabled={isLoading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 min-h-[350px] flex flex-col">

          {/* Step 1: Account Selection */}
          {step === 'accounts' && (
            <div className="space-y-4 flex-1">
              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-lg font-medium text-white">Sign in with Microsoft</h4>
                <p className="text-sm text-slate-400">
                  Choose an account to connect to your Azure subscriptions.
                </p>
              </div>

              {/* Existing Accounts */}
              {cachedAccounts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Signed-in Accounts
                  </label>
                  {cachedAccounts.map((account) => (
                    <button
                      key={account.homeAccountId}
                      onClick={() => handleAccountSelect(account, false)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(account.name || 'U')}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-white">{account.name || 'User'}</div>
                        <div className="text-xs text-slate-400">{account.username}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Sign in with new account */}
              <div className="space-y-2">
                {cachedAccounts.length > 0 && (
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Or use a different account
                  </label>
                )}
                <button
                  onClick={() => handleAccountSelect(null, true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <UserPlus className="w-5 h-5 text-slate-300 group-hover:text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">Sign in with another account</div>
                    <div className="text-xs text-slate-400">Use a different Microsoft 365 account</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                </button>
              </div>

              {/* Admin Consent Option */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={handleAdminConsent}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-700 hover:border-amber-500 hover:bg-slate-800/50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">Admin Consent</div>
                    <div className="text-xs text-slate-400">Global Admin: Approve for your organization</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Authenticating */}
          {step === 'authenticating' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative z-10" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-white">Authenticating...</h4>
                <p className="text-sm text-slate-400">Please complete sign-in in the popup window.</p>
              </div>
            </div>
          )}

          {/* Step 3: Subscription Selection */}
          {step === 'subscriptions' && selectedAccount && (
            <div className="flex flex-col flex-1 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {getInitials(userProfile?.displayName || selectedAccount.name || 'U')}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{userProfile?.displayName || selectedAccount.name}</div>
                  <div className="text-xs text-slate-400">{userProfile?.email || selectedAccount.username}</div>
                </div>
                <button
                  onClick={() => setStep('accounts')}
                  className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Switch
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-auto">
                <label className="text-sm font-medium text-slate-300">Select Subscription</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {subscriptions.map(sub => (
                    <button
                      key={sub.subscriptionId}
                      onClick={() => setSelectedSub(sub.subscriptionId)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedSub === sub.subscriptionId
                          ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <div className="text-sm font-medium text-white">{sub.displayName}</div>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{sub.subscriptionId}</div>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          sub.state === 'Enabled'
                            ? 'bg-emerald-900/50 text-emerald-400'
                            : 'bg-slate-900 text-slate-400'
                        }`}>
                          {sub.state}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleFinalize}
                disabled={!selectedSub}
                className="mt-auto w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Connect
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-in zoom-in duration-300" />
              <div>
                <h4 className="text-xl font-bold text-white">Connected Successfully</h4>
                <p className="text-sm text-slate-400 mt-2">
                  Your Azure subscription is now connected.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Connection Failed</h4>
                <p className="text-sm text-red-400 mt-2 max-w-[300px]">
                  {error}
                </p>
              </div>

              {error?.includes('Admin consent') && (
                <a
                  href={buildAdminConsentUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Open Admin Consent Page
                </a>
              )}

              <button
                onClick={() => {
                  setError(null);
                  setStep('accounts');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 w-full">
          <div
            className={`h-full transition-all duration-500 ${
              step === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${getProgress()}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ConnectWizard;
