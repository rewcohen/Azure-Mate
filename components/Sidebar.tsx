import React, { useState } from 'react';
import { AzureCategory, ViewState, AzureContext } from '../types';
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
  Webhook
} from 'lucide-react';

interface SidebarProps {
  currentCategory: AzureCategory | null;
  onSelectCategory: (cat: AzureCategory) => void;
  currentView: ViewState;
  onSelectView: (view: ViewState) => void;
  azureContext: AzureContext;
  onUpdateContext: (ctx: AzureContext) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentCategory, 
  onSelectCategory,
  currentView,
  onSelectView,
  azureContext,
  onUpdateContext
}) => {
  const [showConnect, setShowConnect] = useState(false);
  const [subId, setSubId] = useState('');
  const [tenId, setTenId] = useState('');

  const handleConnect = () => {
    if (subId && tenId) {
        onUpdateContext({
            subscriptionId: subId,
            tenantId: tenId,
            isConnected: true
        });
        setShowConnect(false);
    }
  };

  const handleDisconnect = () => {
      onUpdateContext({
          subscriptionId: '',
          tenantId: '',
          isConnected: false
      });
      setSubId('');
      setTenId('');
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
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-blue-400">
          <Shield className="w-6 h-6" />
          <h1 className="font-bold text-lg tracking-tight text-white">AzureMate</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Architect Assistant</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        
        {/* Azure Context Section */}
        <div className="px-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Context</p>
            {azureContext.isConnected ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold">Connected</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate" title={azureContext.subscriptionId}>
                        Sub: {azureContext.subscriptionId.substring(0, 18)}...
                    </p>
                    <button 
                        onClick={handleDisconnect}
                        className="mt-2 flex items-center gap-2 text-xs text-red-400 hover:text-red-300"
                    >
                        <LogOut className="w-3 h-3" /> Disconnect
                    </button>
                </div>
            ) : (
                showConnect ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                        <input 
                            type="text" 
                            placeholder="Subscription ID" 
                            value={subId}
                            onChange={(e) => setSubId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                         <input 
                            type="text" 
                            placeholder="Tenant ID" 
                            value={tenId}
                            onChange={(e) => setTenId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={handleConnect}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 rounded"
                            >
                                Save
                            </button>
                            <button 
                                onClick={() => setShowConnect(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1 rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setShowConnect(true)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 border border-dashed border-slate-800 hover:border-blue-500 hover:text-blue-400 transition-all"
                    >
                        <Cloud className="w-4 h-4" />
                        Connect Tenant
                    </button>
                )
            )}
        </div>

        <div className="px-4 mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tools</p>
          <button 
            onClick={() => onSelectView(ViewState.CATALOG)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${currentView === ViewState.CATALOG ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Box className="w-4 h-4" />
            Config Library
          </button>
          <button 
            onClick={() => onSelectView(ViewState.VARIABLES)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.VARIABLES ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" />
            Global Config
          </button>
          <button 
             onClick={() => onSelectView(ViewState.TROUBLESHOOTER)}
             className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm mt-1 transition-colors ${currentView === ViewState.TROUBLESHOOTER ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Wrench className="w-4 h-4" />
            Troubleshoot
          </button>
        </div>

        <div className="mt-6 px-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories</p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectView(ViewState.CATALOG);
                  onSelectCategory(cat.id);
                }}
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

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
          <p className="text-xs text-slate-400 mb-2">System Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-emerald-500 font-medium">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
