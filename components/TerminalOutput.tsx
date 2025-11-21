
import React, { useEffect, useRef } from 'react';
import { DeploymentLog } from '../types';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Terminal, ChevronRight } from 'lucide-react';

interface TerminalOutputProps {
  logs: DeploymentLog[];
  className?: string;
  isComplete?: boolean;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({ logs, className = '', isComplete }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`flex flex-col bg-[#0d1117] border border-slate-800 rounded-lg overflow-hidden font-mono text-xs shadow-2xl ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400 font-semibold">Azure Cloud Shell (PowerShell 7.3)</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-700"></div>
          <div className="w-3 h-3 rounded-full bg-slate-700"></div>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1.5 min-h-[300px] max-h-[500px]">
        <div className="text-slate-500 mb-4">
          Microsoft Azure PowerShell<br/>
          Cloud Shell instance: <span className="text-yellow-600">East US</span><br/>
          Requesting Cloud Shell... Succeeded.<br/>
          Connecting terminal...
        </div>
        
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-100">
             <span className="text-slate-600 select-none min-w-[60px]">{log.timestamp}</span>
             <div className="flex-1 break-all">
                {log.type === 'command' && (
                    <div className="flex items-center gap-2 text-blue-400 font-bold mt-1">
                        <ChevronRight className="w-3 h-3" /> {log.message}
                    </div>
                )}
                {log.type === 'info' && <span className="text-slate-300">{log.message}</span>}
                {log.type === 'success' && (
                    <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> {log.message}
                    </span>
                )}
                {log.type === 'error' && (
                    <span className="text-red-400 flex items-center gap-1.5 font-bold bg-red-950/10 p-1 rounded">
                        <XCircle className="w-3 h-3" /> {log.message}
                    </span>
                )}
                {log.type === 'warning' && (
                    <span className="text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> {log.message}
                    </span>
                )}
             </div>
          </div>
        ))}

        {!isComplete && (
            <div className="flex items-center gap-2 text-slate-500 mt-2 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
            </div>
        )}
        
        {isComplete && (
             <div className="text-slate-500 mt-4 pt-2 border-t border-slate-800/50">
                PS Azure:\&gt; <span className="animate-pulse">_</span>
             </div>
        )}
      </div>
    </div>
  );
};

export default TerminalOutput;
