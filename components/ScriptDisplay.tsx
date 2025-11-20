import React, { useState } from 'react';
import { Copy, Check, Terminal, BookOpen, Share2, Layout } from 'lucide-react';
import { GeneratedResult, LearnLink } from '../types';
import Mermaid from './Mermaid';

interface ScriptDisplayProps {
  result: GeneratedResult;
  diagramCode?: string;
  learnLinks?: LearnLink[];
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ result, diagramCode, learnLinks }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'diagram' | 'resources'>('script');

  const handleCopy = () => {
    navigator.clipboard.writeText(result.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('script')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'script' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
              <Terminal className="w-4 h-4" /> PowerShell
          </button>
          {diagramCode && (
            <button 
                onClick={() => setActiveTab('diagram')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'diagram' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                <Share2 className="w-4 h-4" /> Architecture Diagram
            </button>
          )}
          {learnLinks && learnLinks.length > 0 && (
             <button 
                onClick={() => setActiveTab('resources')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'resources' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                <BookOpen className="w-4 h-4" /> Learn Resources
            </button>
          )}
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
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
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
              {Object.entries(result.variables).length > 0 ? (
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
        </div>
      </div>
    </div>
  );
};

export default ScriptDisplay;