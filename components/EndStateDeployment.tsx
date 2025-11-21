import React, { useState } from 'react';
import { ProjectState, SavedDeploymentItem } from '../types';
import Mermaid from './Mermaid';
import { 
  ShoppingCart, 
  DollarSign, 
  List, 
  CheckCircle2, 
  Code, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  ArrowRight, 
  Layers, 
  Trash2, 
  PieChart 
} from 'lucide-react';

interface EndStateDeploymentProps {
  project: ProjectState;
  onRemoveItem: (id: string) => void;
}

const EndStateDeployment: React.FC<EndStateDeploymentProps> = ({ project, onRemoveItem }) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const totalMonthlyCost = project.items.reduce((acc, item) => {
    return acc + (item.costEstimate?.totalMonthly || 0);
  }, 0);

  // Aggregate costs by Resource Name to create a BOM (Bill of Materials)
  const aggregatedCosts = project.items.reduce((acc: Record<string, { count: number; total: number }>, item) => {
    if (item.costEstimate?.items) {
        item.costEstimate.items.forEach(costItem => {
            const key = costItem.resourceName;
            if (!acc[key]) {
                acc[key] = { count: 0, total: 0 };
            }
            acc[key].count += costItem.quantity;
            acc[key].total += costItem.total;
        });
    }
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  if (project.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-950 p-8">
        <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-slate-400 mb-2">Project Cart is Empty</h2>
        <p className="text-sm max-w-md text-center">
          Generate configurations in the library and click "Add to Project Cart" to build your end-state deployment plan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
               <ShoppingCart className="w-5 h-5 text-emerald-500" />
           </div>
           <div>
               <h2 className="text-xl font-bold text-white">{project.name || 'Untitled Project'}</h2>
               <p className="text-sm text-slate-500">End-State Deployment Plan</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Est. Cost</span>
             <span className="text-lg font-bold text-emerald-400">{formatCurrency(totalMonthlyCost)}/mo</span>
           </div>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
        
        {/* 1. Implementation Workflow Guide */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white">Implementation Workflow</h3>
            </div>
            <div className="p-6">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                    {project.items.map((item, idx) => (
                        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-900 group-[.is-active]:bg-blue-600 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                <span className="font-bold text-sm">{idx + 1}</span>
                            </div>
                            
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-700 bg-slate-900 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-200">{item.scenarioTitle}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">Step {idx + 1}</span>
                                </div>
                                <div className="text-xs text-slate-400 mb-2">
                                   Estimated Cost: <span className="text-emerald-400">{formatCurrency(item.costEstimate?.totalMonthly || 0)}</span>
                                </div>
                                {/* Deployment Tips extracted */}
                                {item.deploymentTips.length > 0 && (
                                    <div className="mt-3 p-2 bg-blue-950/30 rounded border border-blue-900/30">
                                        <p className="text-[10px] font-bold text-blue-400 flex items-center gap-1 mb-1">
                                            <Lightbulb className="w-3 h-3" /> Deployment Tip
                                        </p>
                                        <ul className="list-disc list-inside text-[10px] text-slate-300 space-y-1">
                                            {item.deploymentTips.slice(0, 2).map((tip, i) => (
                                                <li key={i}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 2. Code Cart Items (Condensed/Expanded) */}
        <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Code className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-lg">Generated Artifacts</h3>
            </div>
            
            {project.items.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all hover:border-slate-600">
                    {/* Item Header */}
                    <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50"
                        onClick={() => toggleExpand(item.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-1.5 rounded bg-slate-800 text-slate-400`}>
                                {expandedItems[item.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">{item.scenarioTitle}</h4>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                    <span>Added: {new Date(item.timestamp).toLocaleTimeString()}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                    <span>{Object.keys(item.variables).length} Variables Tracked</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             <span className="text-sm font-mono text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
                                 {formatCurrency(item.costEstimate?.totalMonthly || 0)}
                             </span>
                             <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                title="Remove from cart"
                             >
                                 <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedItems[item.id] && (
                        <div className="border-t border-slate-800 bg-black/20">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                                {/* Script View */}
                                <div className="p-0 border-b lg:border-b-0 lg:border-r border-slate-800">
                                    <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 text-xs font-mono text-slate-400 flex justify-between">
                                        <span>PowerShell Script</span>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(item.script);
                                            }}
                                            className="hover:text-white"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <div className="p-4 max-h-96 overflow-auto bg-[#0d1117]">
                                        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{item.script}</pre>
                                    </div>
                                </div>

                                {/* Diagram & Details */}
                                <div className="flex flex-col h-full">
                                    <div className="p-4 space-y-4 flex-1">
                                        {item.diagramCode && (
                                            <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden p-2">
                                                <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold tracking-wider">Architecture</p>
                                                <Mermaid chart={item.diagramCode} />
                                            </div>
                                        )}
                                        
                                        <div>
                                            <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold tracking-wider">Configuration Variables</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(item.variables).map(([k, v]) => (
                                                    <div key={k} className="flex flex-col bg-slate-800/50 p-2 rounded border border-slate-800">
                                                        <span className="text-[10px] text-slate-500 truncate" title={k}>{k}</span>
                                                        <span className="text-xs text-blue-300 font-mono truncate" title={String(v)}>{String(v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Detailed Cost Analysis for Item */}
                                    <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                                        <h5 className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2 mb-3">
                                            <DollarSign className="w-3 h-3" /> Cost Analysis
                                        </h5>
                                        {item.costEstimate?.items && (
                                            <table className="w-full text-xs text-left text-slate-400">
                                                <thead className="uppercase bg-slate-950/50 text-slate-500">
                                                    <tr>
                                                        <th className="pb-2">Resource</th>
                                                        <th className="pb-2 text-right">Rate</th>
                                                        <th className="pb-2 text-right">Qty</th>
                                                        <th className="pb-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {item.costEstimate.items.map((cost, cIdx) => (
                                                        <tr key={cIdx} className="border-b border-slate-800/50 last:border-0">
                                                            <td className="py-1.5 text-slate-300 truncate max-w-[120px]">{cost.resourceName}</td>
                                                            <td className="py-1.5 text-right font-mono">{formatCurrency(cost.unitPrice)}</td>
                                                            <td className="py-1.5 text-right text-slate-500">{cost.quantity}</td>
                                                            <td className="py-1.5 text-right font-mono text-emerald-500/80">{formatCurrency(cost.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>

        <div className="flex justify-end pt-8">
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl">
                 <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
                    <PieChart className="w-5 h-5 text-blue-400" />
                    <h4 className="text-lg font-bold text-white">Project Summary</h4>
                 </div>
                 
                 {/* Aggregated Bill of Materials */}
                 <div className="mb-6">
                     <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Bill of Materials (Aggregated)</h5>
                     <div className="space-y-2">
                         {Object.entries(aggregatedCosts).map(([name, data]) => (
                             <div key={name} className="flex justify-between items-center text-sm">
                                 <span className="text-slate-300 truncate mr-2">{name} <span className="text-slate-600 text-xs">x{data.count}</span></span>
                                 <span className="font-mono text-slate-400">{formatCurrency(data.total)}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                     <span className="font-bold text-white">Total Monthly Estimate</span>
                     <span className="font-bold text-2xl text-emerald-400">{formatCurrency(totalMonthlyCost)}</span>
                 </div>
                 <button 
                    onClick={() => alert("This would export all scripts into a single ZIP or consolidated .ps1 file.")}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                 >
                     <CheckCircle2 className="w-5 h-5" />
                     Finalize & Export Deployment
                 </button>
             </div>
        </div>

      </div>
    </div>
  );
};

export default EndStateDeployment;