import React, { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  Copy,
  Check,
  Terminal,
  BookOpen,
  Share2,
  Layout,
  Plus,
  Play,
  ExternalLink,
  ArrowRight,
  X,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Box,
  Cloud,
  Monitor,
  Loader2,
  Square,
  Settings,
  Download,
} from 'lucide-react';
import {
  GeneratedResult,
  LearnLink,
  DeploymentStatus,
  AzureContext,
  ViewState,
} from '../types';
import Mermaid from './Mermaid';
import TerminalOutput from './TerminalOutput';
import CloudShellSession from '../services/cloudShellService';
import {
  isElectron as checkIsElectron,
  hasElectronIPC,
  checkPowerShellEnvironment,
  executePowerShellScript,
  connectAzureWithToken,
  installAzModule,
  stopExecution,
  PowerShellEnvironment,
} from '../services/powershellService';
import { azureManagementScopes } from '../config/authConfig';

// Execution method types
type ExecutionMethod = 'local' | 'cloudshell';

interface ScriptDisplayProps {
  result: GeneratedResult;
  diagramCode?: string;
  learnLinks?: LearnLink[];
  onAddToCart?: () => void;
  projectName?: string;
  azureContext?: AzureContext;
  onNavigate?: (view: ViewState) => void;
  onReturnToCatalog?: () => void;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
  result,
  diagramCode,
  learnLinks,
  onAddToCart,
  projectName,
  azureContext,
  onNavigate,
  onReturnToCatalog,
}) => {
  const { instance, accounts } = useMsal();

  const [copied, setCopied] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'script' | 'diagram' | 'resources'
  >('script');
  const [showNextSteps, setShowNextSteps] = useState(false);

  // Deployment State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployment, setDeployment] = useState<DeploymentStatus>({
    state: 'idle',
    progress: 0,
    logs: [],
  });

  // Execution method state
  const [executionMethod, setExecutionMethod] =
    useState<ExecutionMethod>('cloudshell');
  const [psEnvironment, setPsEnvironment] =
    useState<PowerShellEnvironment | null>(null);
  const [checkingEnvironment, setCheckingEnvironment] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [cloudShellSession, setCloudShellSession] =
    useState<CloudShellSession | null>(null);
  const isElectronApp = checkIsElectron() && hasElectronIPC();

  // Check PowerShell environment on mount (Electron only)
  useEffect(() => {
    if (isElectronApp) {
      setCheckingEnvironment(true);
      checkPowerShellEnvironment().then((env) => {
        setPsEnvironment(env);
        // Default to local if PowerShell is available with Az module
        if (env.powershellAvailable && env.azModuleInstalled) {
          setExecutionMethod('local');
        }
        setCheckingEnvironment(false);
      });
    }
  }, [isElectronApp]);

  // Defensive check: If result is null, do not render to prevent crashes
  if (!result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = () => {
    if (onAddToCart) {
      onAddToCart();
      setAddedToCart(true);
      setShowNextSteps(true);
      // We keep the "Added" state for visual feedback but also show the persistent next steps
      setTimeout(() => setAddedToCart(false), 3000);
    }
  };

  const handleRunDeployment = () => {
    if (!azureContext?.isConnected) {
      alert(
        'Please connect to your Azure Tenant using the sidebar wizard before running live deployments.'
      );
      return;
    }
    setShowConfirmModal(true);
  };

  // Get access token for Azure Management
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (accounts.length === 0) return null;
    try {
      const response = await instance.acquireTokenSilent({
        scopes: azureManagementScopes.userImpersonation,
        account: accounts[0],
      });
      return response.accessToken;
    } catch {
      try {
        const response = await instance.acquireTokenPopup({
          scopes: azureManagementScopes.userImpersonation,
        });
        return response.accessToken;
      } catch {
        return null;
      }
    }
  }, [instance, accounts]);

  // Add log entry helper
  const addLog = useCallback(
    (
      message: string,
      type: 'info' | 'output' | 'error' | 'success' = 'info'
    ) => {
      // Map 'output' to 'command' for terminal output
      const logType = type === 'output' ? 'command' : type;
      setDeployment((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message,
            type: logType as
              | 'info'
              | 'success'
              | 'error'
              | 'warning'
              | 'command',
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    },
    []
  );

  // Install Az module handler
  const handleInstallAzModule = async () => {
    setIsInstalling(true);
    addLog('Starting Azure PowerShell module installation...', 'info');

    const success = await installAzModule((output, type) => {
      if (type === 'error') {
        addLog(output, 'error');
      } else if (type === 'success') {
        addLog(output, 'success');
      } else {
        addLog(output, 'output');
      }
    });

    if (success) {
      addLog('Az module installed successfully!', 'success');
      // Refresh environment
      const env = await checkPowerShellEnvironment();
      setPsEnvironment(env);
    } else {
      addLog('Failed to install Az module', 'error');
    }
    setIsInstalling(false);
  };

  // Execute deployment - real implementation
  const executeDeployment = async () => {
    setShowConfirmModal(false);
    setShowDeployModal(true);
    setDeployment({ state: 'running', progress: 0, logs: [] });

    const accessToken = await getAccessToken();
    if (!accessToken) {
      addLog('Failed to acquire access token. Please sign in again.', 'error');
      setDeployment((prev) => ({ ...prev, state: 'failed' }));
      return;
    }

    if (executionMethod === 'local' && isElectronApp) {
      // Local PowerShell execution via Electron IPC
      await executeLocalPowerShell(accessToken);
    } else {
      // Cloud Shell execution
      await executeCloudShell(accessToken);
    }
  };

  // Execute via local PowerShell (Electron)
  const executeLocalPowerShell = async (accessToken: string) => {
    addLog('Connecting to Azure with your credentials...', 'info');

    // First connect to Azure
    const connected = await connectAzureWithToken(
      accessToken,
      azureContext?.subscriptionId || '',
      azureContext?.tenantId || '',
      (output, type) => {
        if (type === 'error') {
          addLog(output, 'error');
        } else if (type === 'success') {
          addLog(output, 'success');
        } else {
          addLog(output, 'output');
        }
      }
    );

    if (!connected) {
      addLog('Failed to connect to Azure', 'error');
      setDeployment((prev) => ({ ...prev, state: 'failed' }));
      return;
    }

    addLog('Connected to Azure successfully!', 'success');
    addLog('Executing PowerShell script...', 'info');

    // Execute the script (use scriptContent to avoid naming conflict with result prop)
    const scriptContent = result.script;
    const execResult = await executePowerShellScript(
      scriptContent,
      (output, type) => {
        if (type === 'error') {
          addLog(output, 'error');
        } else if (type === 'success') {
          addLog(output, 'success');
        } else {
          addLog(output, 'output');
        }
      }
    );

    if (execResult.success) {
      addLog('Script execution completed successfully!', 'success');
      setDeployment((prev) => ({ ...prev, state: 'completed' }));
    } else {
      addLog(
        `Script execution failed with exit code ${execResult.exitCode}`,
        'error'
      );
      if (execResult.error) {
        addLog(execResult.error, 'error');
      }
      setDeployment((prev) => ({ ...prev, state: 'failed' }));
    }
  };

  // Execute via Azure Cloud Shell
  const executeCloudShell = async (_accessToken: string) => {
    addLog('Initializing Azure Cloud Shell session...', 'info');

    if (accounts.length === 0) {
      addLog('No authenticated account found. Please sign in first.', 'error');
      setDeployment((prev) => ({ ...prev, state: 'failed' }));
      return;
    }

    try {
      const session = new CloudShellSession(instance, accounts[0]);
      setCloudShellSession(session);

      // Initialize session with output handler
      await session.initialize(
        (output: string, type: 'stdout' | 'stderr' | 'info' | 'error') => {
          if (type === 'error') {
            addLog(output, 'error');
          } else if (type === 'info') {
            addLog(output, 'info');
          } else {
            addLog(output, 'output');
          }
        }
      );

      addLog('Connected to Cloud Shell successfully!', 'success');
      addLog('Executing script...', 'info');

      // Execute the script
      await session.executeScript(result.script);

      addLog(
        'Script sent to Cloud Shell. Check the output above for results.',
        'success'
      );
      setDeployment((prev) => ({ ...prev, state: 'completed' }));
    } catch (error: any) {
      addLog(`Cloud Shell error: ${error.message}`, 'error');
      addLog(
        'Tip: You may need to set up Cloud Shell first at shell.azure.com',
        'info'
      );
      setDeployment((prev) => ({ ...prev, state: 'failed' }));
    }
  };

  // Stop execution handler
  const handleStopExecution = async () => {
    if (executionMethod === 'local' && isElectronApp) {
      await stopExecution();
    } else if (cloudShellSession) {
      cloudShellSession.close();
    }
    addLog('Execution stopped by user', 'info');
    setDeployment((prev) => ({ ...prev, state: 'failed' }));
  };

  const handleOpenCloudShell = () => {
    handleCopy(); // Auto-copy script for convenience
    window.open('https://shell.azure.com', '_blank');
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="absolute inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 rounded-lg">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 border-l-4 border-l-amber-500">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Confirm Deployment
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  You are about to execute a deployment script against a live
                  environment.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 mb-4">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                Target Subscription
              </div>
              <div className="text-sm font-mono text-white break-all">
                {azureContext?.subscriptionId}
              </div>
            </div>

            {/* Execution Method Selector */}
            <div className="mb-4">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
                Execution Method
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Cloud Shell Option */}
                <button
                  onClick={() => setExecutionMethod('cloudshell')}
                  className={`p-3 rounded-lg border transition-all ${
                    executionMethod === 'cloudshell'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Cloud className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">Cloud Shell</div>
                  <div className="text-[10px] opacity-70">Azure-hosted</div>
                </button>

                {/* Local PowerShell Option (Electron only) */}
                <button
                  onClick={() => setExecutionMethod('local')}
                  disabled={!isElectronApp}
                  className={`p-3 rounded-lg border transition-all ${
                    executionMethod === 'local'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                      : isElectronApp
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Monitor className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">Local PowerShell</div>
                  <div className="text-[10px] opacity-70">
                    {isElectronApp ? 'Desktop app' : 'Desktop only'}
                  </div>
                </button>
              </div>
            </div>

            {/* PowerShell Environment Status (for local execution) */}
            {executionMethod === 'local' && isElectronApp && (
              <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 mb-4">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
                  PowerShell Environment
                </div>
                {checkingEnvironment ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking environment...
                  </div>
                ) : psEnvironment ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">PowerShell</span>
                      <span
                        className={
                          psEnvironment.powershellAvailable
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }
                      >
                        {psEnvironment.powershellAvailable
                          ? `v${psEnvironment.powershellVersion}`
                          : 'Not found'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Az Module</span>
                      {psEnvironment.azModuleInstalled ? (
                        <span className="text-emerald-400">
                          v{psEnvironment.azModuleVersion}
                        </span>
                      ) : (
                        <button
                          onClick={handleInstallAzModule}
                          disabled={isInstalling}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          {isInstalling ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              Install
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Unable to check environment
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-4">
              This will execute PowerShell commands against your Azure
              subscription. Verify your subscription context before proceeding.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeployment}
                disabled={
                  executionMethod === 'local' &&
                  !!psEnvironment &&
                  !psEnvironment.azModuleInstalled
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                {executionMethod === 'local'
                  ? 'Run Locally'
                  : 'Run in Cloud Shell'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Modal Overlay */}
      {showDeployModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in duration-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  deployment.state === 'running'
                    ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                    : deployment.state === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {deployment.state === 'running' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Terminal className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {deployment.state === 'running'
                    ? 'Executing Script...'
                    : deployment.state === 'completed'
                      ? 'Execution Complete'
                      : deployment.state === 'failed'
                        ? 'Execution Failed'
                        : 'Deploying Resources'}
                </h3>
                <p className="text-xs text-slate-400">
                  {executionMethod === 'local'
                    ? 'Local PowerShell'
                    : 'Azure Cloud Shell'}{' '}
                  | {azureContext?.subscriptionId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {deployment.state === 'running' && (
                <button
                  onClick={handleStopExecution}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop
                </button>
              )}
              <button
                onClick={() => setShowDeployModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <TerminalOutput
              logs={deployment.logs}
              isComplete={
                deployment.state === 'completed' ||
                deployment.state === 'failed'
              }
              executionMethod={executionMethod}
              className="flex-1"
            />
          </div>

          {(deployment.state === 'completed' ||
            deployment.state === 'failed') && (
            <div className="mt-4 flex justify-end gap-3 animate-in slide-in-from-bottom-2">
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white font-medium"
              >
                Close
              </button>
              {deployment.state === 'completed' && (
                <button
                  onClick={() =>
                    window.open(
                      `https://portal.azure.com/#resource/subscriptions/${azureContext?.subscriptionId}/resourcegroups`
                    )
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  Verify in Portal <ExternalLink className="w-4 h-4" />
                </button>
              )}
              {deployment.state === 'failed' && (
                <button
                  onClick={() => {
                    setShowDeployModal(false);
                    setShowConfirmModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <Play className="w-3 h-3 fill-current" /> Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Post-Add Workflow Navigation */}
      {showNextSteps && (
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/30 rounded-full">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-100">
                Added to End-State Plan
              </h4>
              <p className="text-xs text-emerald-400/70">
                This configuration is staged for deployment.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onReturnToCatalog && (
              <button
                onClick={onReturnToCatalog}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Configure Another Resource
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate(ViewState.END_STATE)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-colors group"
              >
                Review Plan & Deploy
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 pb-1">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('script')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'script' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Terminal className="w-4 h-4" /> PowerShell
          </button>
          {diagramCode && (
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'diagram' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Share2 className="w-4 h-4" /> Architecture
            </button>
          )}
          {learnLinks && learnLinks.length > 0 && (
            <button
              onClick={() => setActiveTab('resources')}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'resources' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <BookOpen className="w-4 h-4" /> Resources
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {azureContext?.isConnected ? (
            <button
              onClick={handleRunDeployment}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95"
              title="Execute this script directly against your connected Azure subscription"
            >
              <Play className="w-3 h-3 fill-current" /> Run Code Now
            </button>
          ) : (
            <button
              onClick={handleOpenCloudShell}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all"
              title="Open Azure Cloud Shell to run this script"
            >
              <Terminal className="w-3 h-3" /> Open Cloud Shell
            </button>
          )}

          {onAddToCart && (
            <button
              onClick={handleAdd}
              disabled={addedToCart}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${
                addedToCart
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
              }`}
            >
              {addedToCart ? (
                <Check className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              {addedToCart
                ? 'Added'
                : projectName
                  ? `Add to ${projectName}`
                  : 'Add to Project'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Main Content Area */}
        <div className="lg:col-span-2 flex flex-col h-full min-h-[500px]">
          {activeTab === 'script' && (
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-lg flex flex-col flex-1">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-mono text-slate-200">
                    deploy.ps1
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!azureContext?.isConnected && (
                    <span className="text-[10px] text-amber-500 flex items-center gap-1 mr-2">
                      <ExternalLink className="w-3 h-3" /> Connect to run
                      directly
                    </span>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
                <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {result.script}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'diagram' && diagramCode && (
            <div className="flex flex-col flex-1">
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 h-full">
                <Mermaid chart={diagramCode} />
              </div>
            </div>
          )}

          {activeTab === 'resources' && learnLinks && (
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 flex-1">
              <h3 className="text-lg font-semibold text-white mb-4">
                Microsoft Learn References
              </h3>
              <div className="grid gap-4">
                {learnLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group"
                  >
                    <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">
                      {link.title}
                    </span>
                    <Share2 className="w-4 h-4 text-slate-500 group-hover:text-white" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-6 h-fit">
          {/* Variables */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Layout className="w-4 h-4 text-emerald-500" /> Deployment
              Variables
            </h3>
            <div className="space-y-2">
              {result.variables &&
              Object.entries(result.variables).length > 0 ? (
                Object.entries(result.variables).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col text-xs border-b border-slate-800 last:border-0 pb-2 last:pb-0"
                  >
                    <span className="text-slate-500">{key}</span>
                    <span className="text-blue-400 font-mono truncate">
                      {String(value)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No variables defined.</p>
              )}
            </div>
          </div>

          {/* Quick Action Explanation */}
          {activeTab === 'script' && (
            <div className="bg-blue-950/20 rounded-lg border border-blue-900/30 p-4">
              <h4 className="text-xs font-bold text-blue-400 mb-2">
                Execution Options
              </h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-xs text-slate-400">
                  <Play className="w-3 h-3 text-emerald-400 mt-0.5" />
                  <span>
                    <strong>Run Code Now:</strong> Simulates execution against
                    your connected tenant immediately.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-400">
                  <Terminal className="w-3 h-3 text-slate-400 mt-0.5" />
                  <span>
                    <strong>Cloud Shell:</strong> Opens Azure Portal terminal.
                    Script is copied to clipboard for pasting.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptDisplay;
