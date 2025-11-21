import React, { useState, useEffect } from 'react';
import { AzureCategory, ViewState, AzureContext, ServiceHealth } from '../types';
import { fetchAzureStatus, sortServiceHealth } from '../services/azureStatusService';
import ConnectWizard from './ConnectWizard';
import { 
  Server, 
  Network, 
  Database, 
  Shield, 
  Activity, 
  Box, 
  Terminal, 
  Users,
  Wrench,
  Cloud,
  LogOut,
  CheckCircle2,
  Settings,
  Container,
  Webhook,
  ShoppingCart,
  AlertTriangle,
  XCircle,
  Loader2,
  ShieldCheck,
  Trash2,
  Home
} from 'lucide-react';

interface SidebarProps {
  currentCategory: AzureCategory | null;
  onSelectCategory: (cat: AzureCategory) => void;
  currentView: ViewState;
  onSelectView: (view: ViewState) => void;
  azureContext: AzureContext;
  onUpdateContext: (ctx: AzureContext) => void;
  isWizardActive: boolean;
  onResetWizard: () => void;
  projectName?: string;
  projectItemCount?: number;
  onAutoPopulate: (location: string, env: string, owner: string) => void;
  onStartOver: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentCategory, 
  onSelectCategory,
  currentView,
  onSelectView,
  azureContext,
  onUpdateContext,
  isWizardActive,
  onResetWizard,
  projectName,
  projectItemCount,
  onAutoPopulate,
  onStartOver
}) => {
  const [showWizard, setShowWizard] = useState(false);
  
  // System Status State
  const [serviceStatuses, setServiceStatuses] = useState<ServiceHealth[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
      const loadStatus = async () => {
          try {
              const data = await fetchAzureStatus();
              setServiceStatuses(sortServiceHealth(data));
          } catch (e) {
              console.error("Failed to load status", e);
          } finally {
              setStatusLoading(false);
          }
      };
      loadStatus();
      
      // Refresh status every 5 minutes
      const interval = setInterval(loadStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
  }, []);

  // Calculate aggregate status
  const criticalCount = serviceStatuses.filter(s => s.status === 'Critical').length;
  const warningCount = serviceStatuses.filter(s => s.status === 'Warning').length;
  
  let overallStatus: 'Available' | 'Warning' | 'Critical' = 'Available';
  if (criticalCount > 0) overallStatus = 'Critical';
  else if (warningCount > 0) overallStatus = 'Warning';

  const handleDisconnect = () => {
      onUpdateContext({
          subscriptionId: '',
          tenantId: '',
          isConnected: false,
          userDisplayName: undefined,
          username: undefined
      });
  };

  // Helpers for Safe Navigation
  const handleNavClick = (action: () => void) => {
    if (!isWizardActive) {
        onResetWizard();
        action();
    }
    // If wizard is active, ignore single click
  };

  const handleNavDoubleClick = (action: () => void) => {
      if (isWizardActive) {
          if (window.confirm("You have unsaved changes in the wizard. Leave page?")) {
              onResetWizard();
              action();
          }
      }
  };

  const categories = [
    { id: AzureCategory.COMPUTE, icon: Server, label: 'Compute' },
    { id: AzureCategory.NETWORKING, icon: Network, label: 'Networking' },
    { id: AzureCategory.STORAGE, icon: Box, label: 'Storage' },
    { id: AzureCategory.CONTAINERS, icon: Container, label: 'Containers' },
    { id: AzureCategory.SERVERLESS, icon: Terminal, label: 'Serverless' },
    { id: AzureCategory.DATABASE, icon: Database, label: 'Databases' },
    { id: AzureCategory.INTEGRATION, icon: Webhook, label: 'Integration' },
    { id: AzureCategory.IDENTITY, icon: Users, label: 'Identity' },
    { id: AzureCategory.SECURITY, icon: Shield, label: 'Security' },
    { id: AzureCategory.MONITORING, icon: Activity, label: 'Monitoring' },
  ];

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full relative z-50">
      {showWizard && (
          <ConnectWizard 
              onClose={() => setShowWizard(false)} 
              onConnect={onUpdateContext}
              onAutoPopulate={onAutoPopulate}
          />
      )}

      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-blue-400">
          <Shield className="w-6 h-6" />
          <h1 className="font-bold text-lg tracking-tight text-white">AzureMate</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Architect Assistant</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        
        {/* Azure Context Section */}
        <div className="px-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Context</p>
            {azureContext.isConnected ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-bold">Connected</span>
                        </div>
                         <div title="Authenticated via Entra ID">
                             <ShieldCheck className="w-3 h-3 text-slate-500" />
                         </div>
                    </div>
                    
                    <div className="mb-2 pb-2 border-b border-slate-800">
                        <p className="text-xs text-white font-medium truncate">{azureContext.userDisplayName || 'User'}</p>
                        <p className="text-[10px] text-slate-500 truncate">{azureContext.username}</p>
                    </div>

                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Subscription</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono" title={azureContext.subscriptionId}>
                        {azureContext.subscriptionId}
                    </p>
                    
                    <button 
                        onClick={handleDisconnect}
                        className="mt-3 w-full flex items-center justify-center gap-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 rounded transition-colors"
                    >
                        <LogOut className="w-3 h-3" /> Disconnect
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setShowWizard(true)}
                    className="w-full group flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-lg text-sm text-slate-400 border border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-900 transition-all"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-blue-600 transition-colors flex items-center justify-center">
                        <Cloud className="w-5 h-5 text-slate-400 group-hover:text-white" />
                    </div>
                    <span className="font-medium group-hover:text-white">Connect Entra ID</span>
                    <span className="text-[10px] text-slate-500 text-center">Syncs subscriptions & settings</span>
                </button>
            )}
        </div>

        <div className="px-4 mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tools</p>
          <button 
            onClick={() => handleNavClick(() => onSelectView(ViewState.HOME))}
            onDoubleClick={() => handleNavDoubleClick(() => onSelectView(ViewState.HOME))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${currentView === ViewState.HOME ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          
          <button 
            onClick={() => handleNavClick(() => onSelectView(ViewState.CATALOG))}
            onDoubleClick={() => handleNavDoubleClick(() => onSelectView(ViewState.CATALOG))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.CATALOG ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Box className="w-4 h-4" />
            Config Library
          </button>

          <button 
             onClick={() => handleNavClick(() => onSelectView(ViewState.END_STATE))}
             onDoubleClick={() => handleNavDoubleClick(() => onSelectView(ViewState.END_STATE))}
             className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.END_STATE ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <ShoppingCart className="w-4 h-4" />
            <div className="flex-1 flex items-center justify-between">
                <span>End-State Plan</span>
                {projectItemCount !== undefined && projectItemCount > 0 && (
                    <span className="bg-white text-emerald-700 text-[10px] font-bold px-1.5 rounded-full min-w-[1.25rem] text-center">
                        {projectItemCount}
                    </span>
                )}
            </div>
          </button>

          <button 
             onClick={() => handleNavClick(() => onSelectView(ViewState.TROUBLESHOOTER))}
             onDoubleClick={() => handleNavDoubleClick(() => onSelectView(ViewState.TROUBLESHOOTER))}
             className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.TROUBLESHOOTER ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Wrench className="w-4 h-4" />
            Troubleshoot
          </button>

          <button 
            onClick={() => handleNavClick(() => onSelectView(ViewState.VARIABLES))}
            onDoubleClick={() => handleNavDoubleClick(() => onSelectView(ViewState.VARIABLES))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.VARIABLES ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" />
            Global Config
          </button>
        </div>

        <div className="mt-6 px-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories</p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleNavClick(() => {
                    onSelectView(ViewState.CATALOG);
                    onSelectCategory(cat.id);
                })}
                onDoubleClick={() => handleNavDoubleClick(() => {
                    onSelectView(ViewState.CATALOG);
                    onSelectCategory(cat.id);
                })}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentView === ViewState.CATALOG && currentCategory === cat.id 
                    ? 'bg-slate-800 text-blue-400 border-l-2 border-blue-400' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Start Over Button */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/20">
          <button 
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStartOver();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all border border-transparent hover:border-red-900/50 group cursor-pointer"
            title="Reset all application state and data"
          >
            <Trash2 className="w-4 h-4 group-hover:animate-bounce" />
            Start Over
          </button>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800 relative group">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 hover:bg-slate-900 transition-colors cursor-default">
          <p className="text-xs text-slate-400 mb-2 font-semibold">Azure System Status</p>
          {statusLoading ? (
              <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span className="text-xs text-slate-500">Checking services...</span>
              </div>
          ) : (
              <div className="flex items-center gap-2">
                  {overallStatus === 'Available' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                  {overallStatus === 'Warning' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                  {overallStatus === 'Critical' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>}
                  
                  <span className={`text-xs font-medium ${
                      overallStatus === 'Available' ? 'text-emerald-500' : 
                      overallStatus === 'Warning' ? 'text-amber-500' : 'text-red-500'
                  }`}>
                      {criticalCount > 0 ? `${criticalCount} Critical Outages` : 
                       warningCount > 0 ? `${warningCount} Services Warning` : 
                       'All Systems Operational'}
                  </span>
              </div>
          )}
        </div>

        {/* Hover Expanded Details */}
        {!statusLoading && (
            <div className="absolute bottom-full left-4 right-[-200px] mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-50 pointer-events-none group-hover:pointer-events-auto">
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-80">
                    <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Azure Service Health</h3>
                        <span className="text-[10px] text-slate-400">Global / East US</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-0">
                        {serviceStatuses.map((service, idx) => (
                            <div key={idx} className={`px-4 py-3 border-b border-slate-800 last:border-0 flex items-start gap-3 hover:bg-slate-800/50 transition-colors ${
                                service.status === 'Critical' ? 'bg-red-950/20' : 
                                service.status === 'Warning' ? 'bg-amber-950/20' : ''
                            }`}>
                                <div className="mt-0.5">
                                    {service.status === 'Available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                    {service.status === 'Warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                    {service.status === 'Critical' && <XCircle className="w-4 h-4 text-red-500" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-medium ${
                                            service.status === 'Critical' ? 'text-red-200' :
                                            service.status === 'Warning' ? 'text-amber-200' : 'text-slate-200'
                                        }`}>
                                            {service.name}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{service.category}</span>
                                    </div>
                                    <p className={`text-[10px] mt-0.5 ${
                                        service.status !== 'Available' ? 'text-slate-300 font-medium' : 'text-slate-500'
                                    }`}>
                                        {service.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 text-center">
                        <a href="https://status.azure.com/en-us/status" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">
                            View Official Status Page &rarr;
                        </a>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;