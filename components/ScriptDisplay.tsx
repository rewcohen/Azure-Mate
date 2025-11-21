
import React, { useState } from 'react';
import { Copy, Check, Terminal, BookOpen, Share2, Layout, Plus, Play, ExternalLink, ArrowRight, X, AlertTriangle, CheckCircle2, ShoppingCart, Box } from 'lucide-react';
import { GeneratedResult, LearnLink, DeploymentStatus, AzureContext, ViewState } from '../types';
import Mermaid from './Mermaid';
import TerminalOutput from './TerminalOutput';
import { runMockDeployment } from '../services/mockDeployment';

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
    onReturnToCatalog
}) => {
  const [copied, setCopied] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'diagram' | 'resources'>('script');
  const [showNextSteps, setShowNextSteps] = useState(false);
  
  // Deployment State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployment, setDeployment] = useState<DeploymentStatus>({
      state: 'idle',
      progress: 0,
      logs: []
  });

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
          alert("Please connect to your Azure Tenant using the sidebar wizard before running live deployments.");
          return;
      }
      setShowConfirmModal(true);
  };

  const executeDeployment = () => {
      setShowConfirmModal(false);
      setShowDeployModal(true);
      setDeployment({ state: 'running', progress: 0, logs: [] });

      runMockDeployment(
          result.script,
          (log) => setDeployment(prev => ({ ...prev, logs: [...prev.logs, log] })),
          (success) => setDeployment(prev => ({ ...prev, state: success ? 'completed' : 'failed' }))
      );
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
               <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 border-l-4 border-l-amber-500">
                   <div className="flex items-start gap-4 mb-4">
                       <div className="p-3 bg-amber-500/10 rounded-full">
                           <AlertTriangle className="w-6 h-6 text-amber-500" />
                       </div>
                       <div>
                           <h3 className="text-lg font-bold text-white">Confirm Deployment</h3>
                           <p className="text-sm text-slate-400 mt-1">
                               You are about to execute a deployment script against a live environment.
                           </p>
                       </div>
                   </div>
                   
                   <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 mb-6">
                       <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Target Subscription</div>
                       <div className="text-sm font-mono text-white break-all">{azureContext?.subscriptionId}</div>
                   </div>

                   <p className="text-xs text-slate-500 mb-6">
                       This process simulates resource creation. Verify your subscription context before proceeding to avoid unintended changes.
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
                           className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 flex items-center gap-2"
                       >
                           <Play className="w-3 h-3 fill-current" />
                           Yes, Deploy
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
                       <div className={`p-2 rounded-lg ${deployment.state === 'running' ? 'bg-blue-500/20 text-blue-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
                           <Terminal className="w-5 h-5" />
                       </div>
                       <div>
                           <h3 className="text-lg font-bold text-white">Deploying Resources</h3>
                           <p className="text-xs text-slate-400">Target Subscription: {azureContext?.subscriptionId}</p>
                       </div>
                   </div>
                   <button 
                    onClick={() => setShowDeployModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"
                   >
                       <X className="w-5 h-5" />
                   </button>
               </div>

               <div className="flex-1 overflow-hidden flex flex-col">
                   <TerminalOutput 
                        logs={deployment.logs} 
                        isComplete={deployment.state === 'completed' || deployment.state === 'failed'} 
                        className="flex-1"
                   />
               </div>

               {deployment.state === 'completed' && (
                   <div className="mt-4 flex justify-end gap-3 animate-in slide-in-from-bottom-2">
                       <button onClick={() => setShowDeployModal(false)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">
                           Close
                       </button>
                       <button onClick={() => window.open(`https://portal.azure.com/#resource/subscriptions/${azureContext?.subscriptionId}/resourcegroups`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2">
                           Verify in Portal <ExternalLink className="w-4 h-4" />
                       </button>
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
                      <h4 className="text-sm font-bold text-emerald-100">Added to End-State Plan</h4>
                      <p className="text-xs text-emerald-400/70">This configuration is staged for deployment.</p>
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
                    {addedToCart ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {addedToCart ? 'Added' : (projectName ? `Add to ${projectName}` : 'Add to Project')}
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
                        <span className="text-sm font-mono text-slate-200">deploy.ps1</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {!azureContext?.isConnected && (
                            <span className="text-[10px] text-amber-500 flex items-center gap-1 mr-2">
                                <ExternalLink className="w-3 h-3" /> Connect to run directly
                            </span>
                        )}
                        <button 
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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
                    <h3 className="text-lg font-semibold text-white mb-4">Microsoft Learn References</h3>
                    <div className="grid gap-4">
                        {learnLinks.map((link, idx) => (
                            <a 
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group"
                            >
                                <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">{link.title}</span>
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
              <Layout className="w-4 h-4 text-emerald-500" /> Deployment Variables
            </h3>
            <div className="space-y-2">
              {result.variables && Object.entries(result.variables).length > 0 ? (
                Object.entries(result.variables).map(([key, value]) => (
                  <div key={key} className="flex flex-col text-xs border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                    <span className="text-slate-500">{key}</span>
                    <span className="text-blue-400 font-mono truncate">{String(value)}</span>
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
                  <h4 className="text-xs font-bold text-blue-400 mb-2">Execution Options</h4>
                  <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-xs text-slate-400">
                          <Play className="w-3 h-3 text-emerald-400 mt-0.5" />
                          <span><strong>Run Code Now:</strong> Simulates execution against your connected tenant immediately.</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-slate-400">
                          <Terminal className="w-3 h-3 text-slate-400 mt-0.5" />
                          <span><strong>Cloud Shell:</strong> Opens Azure Portal terminal. Script is copied to clipboard for pasting.</span>
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
