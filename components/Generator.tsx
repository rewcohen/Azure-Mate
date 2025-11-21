
import React, { useState, useEffect } from 'react';
import { Scenario, GeneratedResult, AzureCategory, AzureContext, GlobalVariables, CostBreakdown, SavedDeploymentItem, ViewState } from '../types';
import { SCENARIOS } from '../constants';
import { generateConfig } from '../services/geminiService';
import { generateScriptFromTemplate, processDiagramTemplate } from '../services/templateEngine';
import { calculateScenarioCost } from '../services/pricingService';
import ScriptDisplay from './ScriptDisplay';
import { ArrowRight, Wand2, Loader2, Search, Settings, FileCode, ArrowLeft, CheckCircle2, XCircle, Info, ExternalLink, Box, AlertTriangle, DollarSign, PieChart } from 'lucide-react';

interface GeneratorProps {
  selectedCategory: AzureCategory | null;
  azureContext: AzureContext;
  globalVars: GlobalVariables;
  activeScenario: Scenario | null;
  onScenarioChange: (scenario: Scenario | null) => void;
  onAddToCart: (item: SavedDeploymentItem) => void;
  projectName?: string;
  onNavigate: (view: ViewState) => void;
}

const Generator: React.FC<GeneratorProps> = ({ 
  selectedCategory, 
  azureContext, 
  globalVars,
  activeScenario,
  onScenarioChange,
  onAddToCart,
  projectName,
  onNavigate
}) => {
  // Local state for wizard form
  const [inputValues, setInputValues] = useState<Record<string, string | number | boolean>>({});
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<CostBreakdown | null>(null);

  // Wizard State
  const [step, setStep] = useState<'wizard' | 'result'>('wizard');

  const filteredScenarios = SCENARIOS.filter(s => {
    const matchesCategory = selectedCategory ? s.category === selectedCategory : true;
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (activeScenario) {
      // Initialize inputs with default values
      const initialValues: Record<string, any> = {};
      if (activeScenario.inputs) {
        activeScenario.inputs.forEach(input => {
            initialValues[input.id] = input.defaultValue ?? '';
        });
      }
      setInputValues(initialValues);
      setStep('wizard');
      setResult(null);
      
      // Calculate initial cost
      const initialCost = calculateScenarioCost(activeScenario.id, initialValues);
      setEstimatedCost(initialCost);
    }
  }, [activeScenario]);

  // Recalculate cost when inputs change
  useEffect(() => {
    if (activeScenario && step === 'wizard') {
        const cost = calculateScenarioCost(activeScenario.id, inputValues);
        setEstimatedCost(cost);
    }
  }, [inputValues, activeScenario, step]);

  const handleGenerateCustom = async () => {
    if (!customPrompt) return;
    setLoading(true);
    try {
        // Using Ollama service with configured model
        const res = await generateConfig(
          "Custom Azure Configuration", 
          customPrompt, 
          {}, 
          globalVars.ollamaModel
        );
        setResult(res);
        setStep('result');
    } catch (e) {
        alert(e instanceof Error ? e.message : "An error occurred");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateTemplate = () => {
    if (!activeScenario) return;
    setLoading(true);
    
    // Simulate processing time for UX
    setTimeout(() => {
        const script = generateScriptFromTemplate(
            activeScenario.scriptTemplate, 
            activeScenario.inputs, 
            inputValues, 
            azureContext,
            globalVars
        );

        const processedResult: GeneratedResult = {
            script: script,
            explanation: activeScenario.description,
            variables: { ...globalVars, ...inputValues },
            troubleshootingSteps: ["Check for policy restrictions.", "Validate naming conventions."]
        };
        
        setResult(processedResult);
        setStep('result');
        setLoading(false);
    }, 800);
  };

  const handleInputChange = (id: string, value: string | boolean | number) => {
      setInputValues(prev => ({ ...prev, [id]: value }));
  };
  
  // Helper for safe ID generation
  const generateUniqueId = () => {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
          return crypto.randomUUID();
      }
      // Fallback for non-secure contexts or older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  };

  const handleSaveToCart = () => {
      if (activeScenario && result) {
          const diagram = processDiagramTemplate(activeScenario.diagramCode, activeScenario.inputs, inputValues, globalVars);
          
          const item: SavedDeploymentItem = {
              id: generateUniqueId(),
              timestamp: Date.now(),
              scenarioId: activeScenario.id,
              scenarioTitle: activeScenario.title,
              script: result.script,
              costEstimate: estimatedCost,
              variables: result.variables,
              deploymentTips: activeScenario.commonIssues || [],
              diagramCode: diagram
          };
          onAddToCart(item);
      }
  };

  // Find prerequisite scenario objects
  const getPrerequisites = () => {
      if (!activeScenario?.prerequisites) return [];
      return activeScenario.prerequisites.map(id => SCENARIOS.find(s => s.id === id)).filter(Boolean);
  };

  const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-8">
        <div>
           <h2 className="text-xl font-bold text-white">
             {activeScenario ? activeScenario.title : (selectedCategory || 'Configuration Library')}
           </h2>
           <p className="text-sm text-slate-500">
             {activeScenario ? 'Configure deployment parameters' : 'Select a best-practice scenario'}
           </p>
        </div>
        {activeScenario && (
          <button 
            onClick={() => { onScenarioChange(null); setResult(null); }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Library
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!activeScenario ? (
          // CATALOG VIEW
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search configurations (e.g., 'VM', 'Gateway', 'SQL')..." 
                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-slate-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => onScenarioChange(scenario)}
                  className="group text-left bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/10 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 text-blue-400 border border-slate-700">
                      {scenario.category}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-white">{scenario.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-1">{scenario.description}</p>
                </button>
              ))}
              
              {/* Custom Scenario Card */}
              <button
                  onClick={() => onScenarioChange({
                      id: 'custom',
                      category: AzureCategory.COMPUTE,
                      title: 'Custom AI Configuration',
                      description: 'Describe complex requirements for the AI to generate.',
                      inputs: [],
                      learnLinks: [],
                      whatItDoes: [],
                      limitations: [],
                      commonIssues: [],
                      diagramCode: '',
                      scriptTemplate: ''
                  })}
                  className="group text-left bg-gradient-to-br from-blue-900/20 to-slate-900 border border-dashed border-blue-800/50 hover:border-blue-500 p-5 rounded-xl transition-all duration-200 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-blue-900/30 text-blue-300 border border-blue-800/50">
                      AI Powered ({globalVars.ollamaModel})
                    </span>
                    <Wand2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-200 mb-2">Custom Requirement</h3>
                  <p className="text-sm text-slate-400 flex-1">Generate bespoke scripts using Local Ollama.</p>
              </button>
            </div>
          </div>
        ) : (
          // WIZARD / RESULT VIEW
          <div className="max-w-6xl mx-auto h-full">
             {activeScenario.id === 'custom' ? (
                 // CUSTOM AI FLOW
                 !result ? (
                     <div className="max-w-3xl mx-auto bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                            <Wand2 className="w-5 h-5 text-blue-500" />
                            Describe Requirements
                        </h3>
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="w-full h-40 bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none font-mono text-sm resize-none"
                            placeholder="E.g., I need a VM in East US 2, attached to a new VNet..."
                        />
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleGenerateCustom}
                                disabled={loading || !customPrompt.trim()}
                                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                                Generate with Ollama
                            </button>
                        </div>
                     </div>
                 ) : (
                    // Only render ScriptDisplay if result is not null
                    result && (
                        <ScriptDisplay 
                            result={result} 
                            onAddToCart={handleSaveToCart}
                            projectName={projectName}
                            azureContext={azureContext}
                            onNavigate={onNavigate}
                            onReturnToCatalog={() => { onScenarioChange(null); setResult(null); }}
                        />
                    )
                 )
             ) : (
                 // TEMPLATE WIZARD FLOW
                 step === 'wizard' ? (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         {/* Input Form */}
                         <div className="lg:col-span-1 space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Settings className="w-5 h-5 text-blue-400" />
                                    <h3 className="text-lg font-semibold text-white">Configuration</h3>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-3 bg-blue-900/20 border border-blue-900/30 rounded-lg text-xs text-blue-300 mb-4">
                                        Using global settings: <span className="font-mono">{globalVars.projectPrefix}</span> / <span className="font-mono">{globalVars.environment}</span>
                                        {projectName && <div className="mt-1 pt-1 border-t border-blue-800/50 text-emerald-400">Target Project: {projectName}</div>}
                                    </div>

                                    {activeScenario.inputs.map(input => (
                                        <div key={input.id}>
                                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                                {input.label}
                                            </label>
                                            {input.type === 'select' ? (
                                                <div className="relative">
                                                    <select
                                                        value={String(inputValues[input.id] || '')}
                                                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                                    >
                                                        {input.options?.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                    </div>
                                                </div>
                                            ) : (
                                                <input
                                                    type={input.type}
                                                    value={String(inputValues[input.id] || '')}
                                                    onChange={(e) => handleInputChange(input.id, e.target.value)}
                                                    placeholder={input.placeholder}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-700"
                                                />
                                            )}
                                            {input.description && (
                                                <p className="text-[10px] text-slate-600 mt-1">{input.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-800">
                                    <button
                                        onClick={handleGenerateTemplate}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <FileCode className="w-4 h-4" />
                                                Generate Script
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                         </div>

                         {/* Preview / Info */}
                         <div className="lg:col-span-2 space-y-6">
                             
                             {/* Cost Estimation Card */}
                             <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
                                 <div className="p-6 border-b border-slate-800 bg-slate-800/30">
                                     <div className="flex items-center justify-between">
                                         <h4 className="text-base font-bold text-white flex items-center gap-2">
                                             <PieChart className="w-5 h-5 text-emerald-400" />
                                             Resource Cost Breakdown
                                         </h4>
                                         <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                             Retail Prices (USD)
                                         </span>
                                     </div>
                                 </div>
                                 
                                 <div className="p-6">
                                    {estimatedCost ? (
                                        <div className="space-y-6">
                                            {/* Detailed Table */}
                                            <div className="overflow-hidden rounded-lg border border-slate-800">
                                                <table className="w-full text-sm text-left text-slate-400">
                                                    <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-slate-800">
                                                        <tr>
                                                            <th className="px-4 py-3">Resource Item</th>
                                                            <th className="px-4 py-3 text-right">Unit Cost</th>
                                                            <th className="px-4 py-3 text-right">Qty</th>
                                                            <th className="px-4 py-3 text-right">Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-[#0d1117]">
                                                        {estimatedCost.items.map((item, idx) => (
                                                            <tr key={idx} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/20 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-slate-200">{item.resourceName}</div>
                                                                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{item.sku}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono">
                                                                    {formatCurrency(item.unitPrice)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-500">
                                                                    {item.quantity}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-200">
                                                                    {formatCurrency(item.total)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Total Footer */}
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-lg">
                                                <div className="text-xs text-slate-400 max-w-xs">
                                                    <p className="italic">* Estimates exclude bandwidth, IOPS, and taxes. Actual pricing varies by region.</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Estimated Monthly Total</span>
                                                    <span className="text-3xl font-bold text-emerald-400">{formatCurrency(estimatedCost.totalMonthly)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                            <p>Calculated based on resource selection...</p>
                                        </div>
                                    )}
                                 </div>
                             </div>

                             {/* Description */}
                             <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                 <h4 className="text-base font-bold text-white mb-3">Scenario Overview</h4>
                                 <p className="text-sm text-slate-400 leading-relaxed mb-6">{activeScenario.description}</p>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <h5 className="text-xs font-semibold uppercase text-emerald-500 tracking-wider flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" />
                                            What this automates
                                        </h5>
                                        <ul className="space-y-2">
                                            {activeScenario.whatItDoes?.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-1.5 shrink-0"></span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <h5 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                            <XCircle className="w-4 h-4" />
                                            What is out of scope
                                        </h5>
                                        <ul className="space-y-2">
                                            {activeScenario.limitations?.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0"></span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                 </div>
                             </div>

                             {/* Prerequisites Alert */}
                             {getPrerequisites().length > 0 && (
                                <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                                        <Info className="w-4 h-4" />
                                        Required Infrastructure / Dependencies
                                    </h4>
                                    <p className="text-xs text-slate-400 mb-3">
                                        For a successful deployment, ensuring the following components exist is recommended:
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {getPrerequisites().map((pre, idx) => (
                                            pre && (
                                                <button
                                                    key={idx}
                                                    onClick={() => onScenarioChange(pre)}
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200 transition-colors group"
                                                >
                                                    <Box className="w-3 h-3 text-blue-400" />
                                                    Build {pre.title} first
                                                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white" />
                                                </button>
                                            )
                                        ))}
                                    </div>
                                </div>
                             )}

                             {/* Common Pitfalls Alert */}
                             {activeScenario.commonIssues && activeScenario.commonIssues.length > 0 && (
                                 <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
                                     <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                                         <AlertTriangle className="w-4 h-4" />
                                         Common Pitfalls
                                     </h4>
                                     <ul className="space-y-2">
                                         {activeScenario.commonIssues.map((issue, i) => (
                                             <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                 <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 mt-1.5 shrink-0"></span>
                                                 {issue}
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                             )}
                             
                             {/* Context Info */}
                             {azureContext.isConnected && (
                                 <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 flex items-start gap-3">
                                     <div className="p-1.5 bg-emerald-900/30 rounded-full">
                                         <Search className="w-4 h-4 text-emerald-500" />
                                     </div>
                                     <div>
                                         <h5 className="text-sm font-medium text-emerald-400">Azure Context Active</h5>
                                         <p className="text-xs text-slate-400 mt-1">
                                             Script will be generated for Subscription: <span className="font-mono text-slate-300">{azureContext.subscriptionId}</span>
                                         </p>
                                     </div>
                                 </div>
                             )}

                             {/* PPG Info if active */}
                             {globalVars.proximityPlacementGroup && (
                                 <div className="bg-purple-950/20 border border-purple-900/30 rounded-xl p-4 flex items-start gap-3">
                                    <div className="p-1.5 bg-purple-900/30 rounded-full">
                                        <Settings className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-medium text-purple-400">Proximity Placement Group Active</h5>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Compute resources will be pinned to PPG: <span className="font-mono text-slate-300">{globalVars.proximityPlacementGroup}</span>
                                        </p>
                                    </div>
                                </div>
                             )}
                         </div>
                     </div>
                 ) : (
                     // Guard logic: Ensure result is not null before rendering ScriptDisplay
                     result ? (
                        <ScriptDisplay 
                            result={result} 
                            diagramCode={processDiagramTemplate(activeScenario.diagramCode, activeScenario.inputs, inputValues, globalVars)}
                            learnLinks={activeScenario.learnLinks}
                            onAddToCart={handleSaveToCart}
                            projectName={projectName}
                            azureContext={azureContext}
                            onNavigate={onNavigate}
                            onReturnToCatalog={() => { onScenarioChange(null); setResult(null); }}
                        />
                     ) : (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                            <span className="ml-2">Generating configuration...</span>
                        </div>
                     )
                 )
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
