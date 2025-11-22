import React, { useState, useEffect, useRef } from 'react';
import { GlobalVariables, ViewState } from '../types';
import { updateLivePricing } from '../services/pricingService';
import {
  Save,
  Settings,
  Tag,
  Globe,
  MapPin,
  Briefcase,
  User,
  Layers,
  HelpCircle,
  Cpu,
  Loader2,
  Check,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface VariablesPageProps {
  config: GlobalVariables;
  onSave: (newConfig: GlobalVariables) => void;
  onNavigate?: (view: ViewState) => void;
}

const VariablesPage: React.FC<VariablesPageProps> = ({
  config,
  onSave,
  onNavigate,
}) => {
  const [formData, setFormData] = useState<GlobalVariables>(config);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Live Pricing State
  const [pricingStatus, setPricingStatus] = useState<
    'idle' | 'updating' | 'success' | 'error'
  >('idle');
  const [updatedCount, setUpdatedCount] = useState(0);

  // Ref to hold the timeout ID so we can clear it
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when props change (e.g., on "Start Over")
  useEffect(() => {
    setFormData(config);
  }, [config]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (key: keyof GlobalVariables, value: string) => {
    const newConfig = { ...formData, [key]: value };
    setFormData(newConfig);
    setStatus('saving');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-save after 1 second of inactivity
    timeoutRef.current = setTimeout(() => {
      onSave(newConfig);
      setStatus('saved');
      // Reset to idle after showing "Saved" for a bit
      setTimeout(() => setStatus('idle'), 2000);
    }, 1000);
  };

  const handleUpdatePricing = async () => {
    setPricingStatus('updating');
    try {
      const count = await updateLivePricing();
      setUpdatedCount(count);
      setPricingStatus('success');
      setTimeout(() => setPricingStatus('idle'), 5000);
    } catch (e) {
      console.error(e);
      setPricingStatus('error');
      setTimeout(() => setPricingStatus('idle'), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Settings className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Global Configuration
            </h2>
            <p className="text-sm text-slate-500">
              Define naming conventions and tags applied to all scripts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'saving' && (
            <span className="flex items-center gap-2 text-xs text-blue-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving changes...
            </span>
          )}
          {status === 'saved' && (
            <span className="flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in slide-in-from-right-4">
              <Check className="w-3 h-3" /> All changes saved
            </span>
          )}
        </div>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Naming Convention Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Naming Convention
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Project Prefix
                </label>
                <input
                  type="text"
                  value={formData.projectPrefix}
                  onChange={(e) =>
                    handleChange('projectPrefix', e.target.value)
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g., myproject"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Used in resource names (e.g.,{' '}
                  <strong>{formData.projectPrefix || 'proj'}</strong>-app-01)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Environment
                </label>
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
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Default Location
                </label>
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
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Cost Center
                </label>
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
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Owner / Contact
                </label>
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

        {/* Pricing Data Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Cost Estimation Data
          </h3>
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <p className="text-sm text-slate-400 mb-4">
                The application estimates costs using a mix of static data and
                live Azure Retail Prices. Click below to fetch the latest
                Virtual Machine pricing from the official Azure API.
              </p>

              <button
                onClick={handleUpdatePricing}
                disabled={pricingStatus === 'updating'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
              >
                {pricingStatus === 'updating' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {pricingStatus === 'updating'
                  ? 'Updating Catalog...'
                  : 'Update Pricing from Azure API'}
              </button>

              {pricingStatus === 'success' && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-3 h-3" /> Successfully updated{' '}
                  {updatedCount} price records.
                </p>
              )}

              {pricingStatus === 'error' && (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5 animate-in fade-in">
                  <AlertTriangle className="w-3 h-3" /> Update failed. Ensure
                  you have internet access or check console for CORS errors.
                </p>
              )}
            </div>
            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-emerald-500 font-semibold">Source:</span>{' '}
                https://prices.azure.com/api/retail/prices
                <br />
                <span className="text-slate-500 italic block mt-1">
                  Note: Live pricing updates may be blocked by browser CORS
                  policies in some environments. If this fails, the app falls
                  back to the cached static catalog.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* AI Settings Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-pink-500" />
            Local AI (Ollama)
          </h3>
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Ollama Model Name
              </label>
              <input
                type="text"
                value={formData.ollamaModel}
                onChange={(e) => handleChange('ollamaModel', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono text-sm placeholder-slate-700"
                placeholder="llama3"
              />
              <p className="text-xs text-slate-500 mt-2">
                Ensure this model is pulled locally:{' '}
                <code>ollama pull {formData.ollamaModel || 'llama3'}</code>
              </p>
            </div>
            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-pink-500 font-semibold">Note:</span>{' '}
                Ensure Ollama is running at{' '}
                <code className="bg-slate-800 px-1 rounded">
                  http://localhost:11434
                </code>
                . If you are running this app in a container or remote
                environment, update your browser/network settings to allow local
                connection.
              </p>
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
                onChange={(e) =>
                  handleChange('proximityPlacementGroup', e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-700"
                placeholder="Optional (e.g., ppg-app-prod)"
              />
              <p className="text-xs text-slate-500 mt-2">
                If set, VM and AKS deployments will attempt to join this group
                to ensure low latency.
              </p>
            </div>
            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-amber-500 font-semibold">Note:</span>{' '}
                Configuring a PPG ensures that your Azure Compute resources are
                physically located close to each other within the same
                datacenter. This is critical for workloads requiring microsecond
                latency but may limit allocation capacity.
              </p>
            </div>
          </div>
        </div>

        {/* Workflow Footer Navigation */}
        {onNavigate && (
          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => onNavigate(ViewState.CATALOG)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all group"
            >
              Next: Configuration Library
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariablesPage;
