
import React, { useState } from 'react';
import { GlobalVariables } from '../types';
import { Save, Settings, Tag, Globe, MapPin, Briefcase, User, Layers, HelpCircle } from 'lucide-react';

interface VariablesPageProps {
  config: GlobalVariables;
  onSave: (newConfig: GlobalVariables) => void;
}

const VariablesPage: React.FC<VariablesPageProps> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<GlobalVariables>(config);
  const [saved, setSaved] = useState(false);

  const handleChange = (key: keyof GlobalVariables, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="h-16 border-b border-slate-800 flex items-center px-8 bg-slate-950 sticky top-0 z-10">
         <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Settings className="w-5 h-5 text-purple-500" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">Global Configuration</h2>
                <p className="text-sm text-slate-500">Define naming conventions and tags applied to all scripts</p>
            </div>
        </div>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Naming Convention Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    Naming Convention
                </h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Project Prefix</label>
                        <input 
                            type="text" 
                            value={formData.projectPrefix}
                            onChange={(e) => handleChange('projectPrefix', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            placeholder="e.g., contoso"
                        />
                        <p className="text-xs text-slate-500 mt-1">Used in resource names (e.g., <strong>{formData.projectPrefix || 'proj'}</strong>-app-01)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Environment</label>
                         <select
                            value={formData.environment}
                            onChange={(e) => handleChange('environment', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none"
                        >
                            <option value="dev">Development (dev)</option>
                            <option value="test">Test (test)</option>
                            <option value="uat">UAT (uat)</option>
                            <option value="prod">Production (prod)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Default Location</label>
                         <div className="relative">
                             <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                             <select
                                value={formData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none"
                            >
                                <option value="eastus">East US</option>
                                <option value="westus">West US</option>
                                <option value="northeurope">North Europe</option>
                                <option value="westeurope">West Europe</option>
                                <option value="australiaeast">Australia East</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tagging Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-400" />
                    Standard Tags
                </h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Cost Center</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={formData.costCenter}
                                onChange={(e) => handleChange('costCenter', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="e.g., IT-001"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Owner / Contact</label>
                         <div className="relative">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={formData.owner}
                                onChange={(e) => handleChange('owner', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="e.g., admin@company.com"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Advanced Performance Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                Advanced Performance (Compute)
            </h3>
            <div className="flex items-start gap-6">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                        Proximity Placement Group (PPG) Name
                        <span className="group relative">
                            <HelpCircle className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-help" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-xs text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
                                Logically groups VMs to reduce network latency
                            </span>
                        </span>
                    </label>
                    <input 
                        type="text" 
                        value={formData.proximityPlacementGroup || ''}
                        onChange={(e) => handleChange('proximityPlacementGroup', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-700"
                        placeholder="Optional (e.g., ppg-app-prod)"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        If set, VM and AKS deployments will attempt to join this group to ensure low latency.
                    </p>
                </div>
                <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        <span className="text-amber-500 font-semibold">Note:</span> Configuring a PPG ensures that your Azure Compute resources are physically located close to each other within the same datacenter. This is critical for workloads requiring microsecond latency but may limit allocation capacity.
                    </p>
                </div>
            </div>
        </div>

        <div className="mt-8 flex justify-end pb-8">
            <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${saved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
                {saved ? <div className="flex items-center gap-2">Configuration Saved!</div> : <div className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Global Config</div>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default VariablesPage;
