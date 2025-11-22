import React, { useState, useEffect, useCallback } from 'react';
import { useMsal, useAccount } from '@azure/msal-react';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { AzureContext } from '../types';
import {
  ShieldCheck,
  Loader2,
  User,
  CheckCircle2,
  X,
  Globe,
  Lock,
  ChevronRight,
  AlertCircle,
  UserPlus,
  LogIn,
  Building2,
  RefreshCw,
  Copy,
  ExternalLink,
  Terminal,
  FileCode,
  BookOpen,
  ChevronLeft,
  Zap,
  Settings,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import {
  loginRequest,
  adminConsentRequest,
  isConfigured,
  buildAdminConsentUrl,
} from '../config/authConfig';
import {
  listSubscriptions,
  getUserProfile,
  AzureSubscription,
  validateSubscriptionAccess,
} from '../services/azureService';
import {
  generateAppRegistrationScript,
  generateAzureCliScript,
  manualSetupInstructions,
  isValidClientIdFormat,
  getCloudShellLink,
  getAppRegistrationPortalLink,
  defaultAppConfig,
} from '../services/appRegistrationService';

interface ConnectWizardProps {
  onClose: () => void;
  onConnect: (ctx: AzureContext) => void;
  onAutoPopulate: (location: string, env: string, owner: string) => void;
}

type WizardStep =
  | 'setup-choice'
  | 'setup-script'
  | 'setup-manual'
  | 'setup-clientid'
  | 'accounts'
  | 'authenticating'
  | 'subscriptions'
  | 'verifying'
  | 'success'
  | 'error';
type ScriptType = 'powershell' | 'bash';

const ConnectWizard: React.FC<ConnectWizardProps> = ({
  onClose,
  onConnect,
  onAutoPopulate,
}) => {
  const { instance, accounts, inProgress } = useMsal();
  const [step, setStep] = useState<WizardStep>('accounts');
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(
    null
  );
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [userProfile, setUserProfile] = useState<{
    displayName: string;
    email: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Setup state
  const [scriptType, setScriptType] = useState<ScriptType>('powershell');
  const [customClientId, setCustomClientId] = useState('');
  const [clientIdError, setClientIdError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Verification state
  const [verificationStatus, setVerificationStatus] = useState<{
    tokenAcquisition: 'pending' | 'success' | 'error';
    graphApi: 'pending' | 'success' | 'error';
    azureApi: 'pending' | 'success' | 'error';
  }>({
    tokenAcquisition: 'pending',
    graphApi: 'pending',
    azureApi: 'pending',
  });

  // Check if app is configured
  const configured = isConfigured();

  // Determine initial step based on configuration
  useEffect(() => {
    if (!configured) {
      setStep('setup-choice');
    } else {
      setStep('accounts');
    }
  }, [configured]);

  // Get all cached accounts from MSAL
  const cachedAccounts = accounts;

  // Copy script to clipboard
  const handleCopyScript = async () => {
    const script =
      scriptType === 'powershell'
        ? generateAppRegistrationScript(defaultAppConfig)
        : generateAzureCliScript(defaultAppConfig);

    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Validate and save custom client ID
  const handleSaveClientId = () => {
    const trimmedId = customClientId.trim();

    if (!trimmedId) {
      setClientIdError('Please enter a Client ID');
      return;
    }

    if (!isValidClientIdFormat(trimmedId)) {
      setClientIdError(
        'Invalid Client ID format. It should be a GUID (e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'
      );
      return;
    }

    // Save to localStorage for the app to use
    localStorage.setItem('azure_client_id_override', trimmedId);

    // Show message and prompt refresh
    setClientIdError(null);
    alert(
      'Client ID saved! The page will now refresh to apply the new configuration.'
    );
    window.location.reload();
  };

  // Handle account selection and login
  const handleAccountSelect = useCallback(
    async (account: AccountInfo | null, isNewLogin: boolean = false) => {
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

        // Start verification
        setStep('verifying');
        setVerificationStatus({
          tokenAcquisition: 'success',
          graphApi: 'pending',
          azureApi: 'pending',
        });

        // Fetch user profile
        try {
          const profile = await getUserProfile(instance, activeAccount);
          setUserProfile({
            displayName: profile.displayName,
            email:
              profile.userPrincipalName ||
              profile.mail ||
              activeAccount.username ||
              '',
          });
          setVerificationStatus((prev) => ({ ...prev, graphApi: 'success' }));
        } catch {
          // Fallback to account info if Graph call fails
          setUserProfile({
            displayName: activeAccount.name || 'User',
            email: activeAccount.username || '',
          });
          setVerificationStatus((prev) => ({ ...prev, graphApi: 'error' }));
        }

        // Fetch subscriptions
        try {
          const subs = await listSubscriptions(instance, activeAccount);
          setSubscriptions(subs);
          setVerificationStatus((prev) => ({ ...prev, azureApi: 'success' }));

          if (subs.length > 0) {
            setSelectedSub(subs[0].subscriptionId);
            setStep('subscriptions');
          } else {
            setError(
              'No Azure subscriptions found. Please ensure your account has access to Azure subscriptions.'
            );
            setStep('error');
          }
        } catch (apiError: any) {
          setVerificationStatus((prev) => ({ ...prev, azureApi: 'error' }));
          throw apiError;
        }
      } catch (err: any) {
        console.error('Authentication error:', err);

        // Handle specific errors
        if (err.errorCode === 'user_cancelled') {
          setStep('accounts');
          setError(null);
        } else if (
          err.errorCode === 'consent_required' ||
          err.message?.includes('AADSTS65001')
        ) {
          setError(
            'Admin consent required. Please have a Global Administrator sign in and approve the permissions, or use the Admin Consent link below.'
          );
          setStep('error');
        } else if (err.errorCode === 'interaction_in_progress') {
          setError(
            'Another sign-in is already in progress. Please wait or refresh the page.'
          );
          setStep('error');
        } else {
          setError(err.message || 'Authentication failed. Please try again.');
          setStep('error');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [instance]
  );

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

    const sub = subscriptions.find((s) => s.subscriptionId === selectedSub);
    if (sub) {
      onConnect({
        isConnected: true,
        subscriptionId: sub.subscriptionId,
        tenantId: sub.tenantId,
        userDisplayName:
          userProfile?.displayName || selectedAccount.name || 'User',
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
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate progress
  const getProgress = (): number => {
    switch (step) {
      case 'setup-choice':
        return 5;
      case 'setup-script':
        return 15;
      case 'setup-manual':
        return 15;
      case 'setup-clientid':
        return 25;
      case 'accounts':
        return 30;
      case 'authenticating':
        return 50;
      case 'verifying':
        return 70;
      case 'subscriptions':
        return 90;
      case 'success':
        return 100;
      case 'error':
        return 50;
      default:
        return 0;
    }
  };

  // Get script content
  const getScriptContent = () => {
    return scriptType === 'powershell'
      ? generateAppRegistrationScript(defaultAppConfig)
      : generateAzureCliScript(defaultAppConfig);
  };

  // Render verification status icon
  const renderStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2">
            {step.startsWith('setup') ? (
              <>
                <Settings className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">
                  Setup Azure Connection
                </h3>
              </>
            ) : (
              <>
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Connect to Azure</h3>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 min-h-[400px] max-h-[70vh] overflow-y-auto flex flex-col">
          {/* Setup Choice Step */}
          {step === 'setup-choice' && (
            <div className="space-y-4 flex-1">
              <div className="text-center space-y-2 mb-6">
                <div className="w-14 h-14 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="w-7 h-7 text-purple-500" />
                </div>
                <h4 className="text-lg font-medium text-white">
                  One-Time Setup Required
                </h4>
                <p className="text-sm text-slate-400">
                  To connect to Azure, you need to create an App Registration.
                  Choose your preferred setup method:
                </p>
              </div>

              <div className="space-y-3">
                {/* Automated Script Option */}
                <button
                  onClick={() => setStep('setup-script')}
                  className="w-full flex items-start gap-4 p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-purple-500 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-colors">
                    <Terminal className="w-5 h-5 text-purple-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        Automated Script
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Run a PowerShell or Azure CLI script to automatically
                      create the App Registration
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 mt-2" />
                </button>

                {/* Manual Setup Option */}
                <button
                  onClick={() => setStep('setup-manual')}
                  className="w-full flex items-start gap-4 p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <BookOpen className="w-5 h-5 text-blue-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      Manual Setup
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Follow step-by-step instructions to create the App
                      Registration in Azure Portal
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 mt-2" />
                </button>

                {/* Already Have Client ID */}
                <button
                  onClick={() => setStep('setup-clientid')}
                  className="w-full flex items-start gap-4 p-4 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <FileCode className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-300">
                      I already have a Client ID
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter your existing App Registration Client ID
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Setup Script Step */}
          {step === 'setup-script' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <button
                onClick={() => setStep('setup-choice')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white self-start"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center space-y-2">
                <h4 className="text-lg font-medium text-white">
                  Run Setup Script
                </h4>
                <p className="text-sm text-slate-400">
                  Copy this script and run it in Azure Cloud Shell
                </p>
              </div>

              {/* Script Type Toggle */}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setScriptType('powershell')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    scriptType === 'powershell'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  PowerShell
                </button>
                <button
                  onClick={() => setScriptType('bash')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    scriptType === 'bash'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Azure CLI (Bash)
                </button>
              </div>

              {/* Script Display */}
              <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50">
                  <span className="text-xs text-slate-500 font-mono">
                    {scriptType === 'powershell'
                      ? 'setup-azuremate.ps1'
                      : 'setup-azuremate.sh'}
                  </span>
                  <button
                    onClick={handleCopyScript}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="flex-1 p-3 text-xs text-slate-300 font-mono overflow-auto max-h-[200px]">
                  {getScriptContent()}
                </pre>
              </div>

              {/* Instructions */}
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <h5 className="text-sm font-semibold text-white">
                  How to run:
                </h5>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Click the button below to open Azure Cloud Shell</li>
                  <li>Paste the copied script and press Enter</li>
                  <li>
                    Copy the <strong className="text-white">Client ID</strong>{' '}
                    from the output
                  </li>
                  <li>Come back here and enter the Client ID</li>
                </ol>
                <a
                  href={getCloudShellLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Azure Cloud Shell
                </a>
              </div>

              <button
                onClick={() => setStep('setup-clientid')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
              >
                I have my Client ID
              </button>
            </div>
          )}

          {/* Manual Setup Step */}
          {step === 'setup-manual' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <button
                onClick={() => setStep('setup-choice')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white self-start"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center space-y-2">
                <h4 className="text-lg font-medium text-white">
                  Manual Setup Guide
                </h4>
                <p className="text-sm text-slate-400">
                  Follow these steps in Azure Portal
                </p>
              </div>

              {/* Steps */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {manualSetupInstructions.map((instruction) => (
                  <div
                    key={instruction.step}
                    className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {instruction.step}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-white">
                          {instruction.title}
                        </h5>
                        <p className="text-xs text-slate-400 mt-1">
                          {instruction.description}
                        </p>
                        {instruction.details && (
                          <ul className="text-xs text-slate-300 mt-2 space-y-1 list-disc list-inside">
                            {instruction.details.map((detail, idx) => (
                              <li key={idx}>{detail}</li>
                            ))}
                          </ul>
                        )}
                        {instruction.link && (
                          <a
                            href={instruction.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                          >
                            Open in Azure Portal
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep('setup-clientid')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                I have my Client ID
              </button>
            </div>
          )}

          {/* Enter Client ID Step */}
          {step === 'setup-clientid' && (
            <div className="space-y-4 flex-1">
              <button
                onClick={() => setStep('setup-choice')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                  <FileCode className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-lg font-medium text-white">
                  Enter Client ID
                </h4>
                <p className="text-sm text-slate-400">
                  Paste the Application (Client) ID from your App Registration
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Application (Client) ID
                </label>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => {
                    setCustomClientId(e.target.value);
                    setClientIdError(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 transition-all ${
                    clientIdError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-blue-500/50 focus:border-blue-500'
                  }`}
                />
                {clientIdError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {clientIdError}
                  </p>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  The Client ID is saved locally in your browser. You can find
                  it on the Overview page of your App Registration in Azure
                  Portal.
                </p>
              </div>

              <button
                onClick={handleSaveClientId}
                disabled={!customClientId.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Save & Continue
              </button>
            </div>
          )}

          {/* Step 1: Account Selection */}
          {step === 'accounts' && (
            <div className="space-y-4 flex-1">
              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-lg font-medium text-white">
                  Sign in with Microsoft
                </h4>
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
                        <div className="text-sm font-medium text-white">
                          {account.name || 'User'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {account.username}
                        </div>
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
                    <div className="text-sm font-medium text-white">
                      Sign in with another account
                    </div>
                    <div className="text-xs text-slate-400">
                      Use a different Microsoft 365 account
                    </div>
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
                    <div className="text-sm font-medium text-white">
                      Admin Consent
                    </div>
                    <div className="text-xs text-slate-400">
                      Global Admin: Approve for your organization
                    </div>
                  </div>
                </button>
              </div>

              {/* Reconfigure option */}
              {configured && (
                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setStep('setup-choice')}
                    className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Need to reconfigure App Registration?
                  </button>
                </div>
              )}
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
                <h4 className="text-lg font-medium text-white">
                  Authenticating...
                </h4>
                <p className="text-sm text-slate-400">
                  Please complete sign-in in the popup window.
                </p>
              </div>
            </div>
          )}

          {/* Verifying Connection Step */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative z-10" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-white">
                  Verifying Connection...
                </h4>
                <p className="text-sm text-slate-400">
                  Testing access to Azure services
                </p>
              </div>

              {/* Verification Status */}
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-sm text-slate-300">
                    Token Acquisition
                  </span>
                  {renderStatusIcon(verificationStatus.tokenAcquisition)}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-sm text-slate-300">
                    Microsoft Graph API
                  </span>
                  {renderStatusIcon(verificationStatus.graphApi)}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-sm text-slate-300">
                    Azure Management API
                  </span>
                  {renderStatusIcon(verificationStatus.azureApi)}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Subscription Selection */}
          {step === 'subscriptions' && selectedAccount && (
            <div className="flex flex-col flex-1 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {getInitials(
                    userProfile?.displayName || selectedAccount.name || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">
                    {userProfile?.displayName || selectedAccount.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {userProfile?.email || selectedAccount.username}
                  </div>
                </div>
                <button
                  onClick={() => setStep('accounts')}
                  className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Switch
                </button>
              </div>

              {/* Connection Verified Badge */}
              <div className="flex items-center gap-2 p-2 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-400 font-medium">
                  Connection verified successfully
                </span>
              </div>

              <div className="space-y-2 flex-1 overflow-auto">
                <label className="text-sm font-medium text-slate-300">
                  Select Subscription
                </label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {subscriptions.map((sub) => (
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
                        <div className="text-sm font-medium text-white">
                          {sub.displayName}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">
                        {sub.subscriptionId}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            sub.state === 'Enabled'
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
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
                <h4 className="text-xl font-bold text-white">
                  Connected Successfully
                </h4>
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
                <h4 className="text-lg font-bold text-white">
                  Connection Failed
                </h4>
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
              step === 'error'
                ? 'bg-red-500'
                : step.startsWith('setup')
                  ? 'bg-purple-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${getProgress()}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ConnectWizard;
