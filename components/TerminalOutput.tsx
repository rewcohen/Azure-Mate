
import React, { useEffect, useRef, useState } from 'react';
import { DeploymentLog } from '../types';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Terminal, ChevronRight, Monitor, Cloud, Copy, Check } from 'lucide-react';

interface TerminalOutputProps {
  logs: DeploymentLog[];
  className?: string;
  isComplete?: boolean;
  executionMethod?: 'local' | 'cloudshell';
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({
  logs,
  className = '',
  isComplete,
  executionMethod = 'cloudshell'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  };

  // Copy all output to clipboard
  const handleCopyOutput = async () => {
    const output = logs.map(log => `[${formatTimestamp(log.timestamp)}] ${log.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const isLocal = executionMethod === 'local';

  return (
    <div className={`flex flex-col bg-[#0d1117] border border-slate-800 rounded-lg overflow-hidden font-mono text-xs shadow-2xl ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {isLocal ? (
            <Monitor className="w-4 h-4 text-emerald-500" />
          ) : (
            <Cloud className="w-4 h-4 text-blue-500" />
          )}
          <span className="text-slate-400 font-semibold">
            {isLocal ? 'Local PowerShell' : 'Azure Cloud Shell (PowerShell)'}
          </span>
          {!isComplete && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-2 h-2 animate-spin" />
              Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyOutput}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Copy output"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <div className="flex gap-1.5">
            <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-slate-700' : 'bg-emerald-500 animate-pulse'}`}></div>
            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
          </div>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1.5 min-h-[300px] max-h-[500px]">
        {/* Welcome message based on execution method */}
        <div className="text-slate-500 mb-4 pb-3 border-b border-slate-800/50">
          {isLocal ? (
            <>
              Windows PowerShell<br/>
              Copyright (C) Microsoft Corporation. All rights reserved.<br/>
              <span className="text-emerald-400">Azure PowerShell (Az Module)</span><br/>
              Connecting to Azure...
            </>
          ) : (
            <>
              Microsoft Azure PowerShell<br/>
              Cloud Shell instance: <span className="text-yellow-600">East US</span><br/>
              Requesting Cloud Shell... Succeeded.<br/>
              Connecting terminal...
            </>
          )}
        </div>

        {/* Log entries */}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-100">
            <span className="text-slate-600 select-none min-w-[70px] text-[10px]">
              {formatTimestamp(log.timestamp)}
            </span>
            <div className="flex-1 break-all">
              {log.type === 'command' && (
                <div className="flex items-start gap-2 text-slate-300 font-normal mt-0.5">
                  <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap">{log.message}</pre>
                </div>
              )}
              {log.type === 'info' && (
                <span className="text-slate-400 flex items-start gap-1.5">
                  <Terminal className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-50" />
                  {log.message}
                </span>
              )}
              {log.type === 'success' && (
                <span className="text-emerald-400 flex items-start gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {log.message}
                </span>
              )}
              {log.type === 'error' && (
                <span className="text-red-400 flex items-start gap-1.5 font-bold bg-red-950/20 p-1.5 rounded">
                  <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="whitespace-pre-wrap">{log.message}</span>
                </span>
              )}
              {log.type === 'warning' && (
                <span className="text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {log.message}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {!isComplete && (
          <div className="flex items-center gap-2 text-slate-500 mt-2 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing...</span>
          </div>
        )}

        {/* Completion indicator */}
        {isComplete && (
          <div className="text-slate-500 mt-4 pt-2 border-t border-slate-800/50">
            PS {isLocal ? 'C:\\>' : 'Azure:\\>'} <span className="animate-pulse">_</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/50 border-t border-slate-800 text-[10px] text-slate-500">
        <span>{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</span>
        <span>
          {isComplete ? (
            logs.some(l => l.type === 'error') ? (
              <span className="text-red-400">Completed with errors</span>
            ) : (
              <span className="text-emerald-400">Completed successfully</span>
            )
          ) : (
            <span className="text-blue-400">Executing...</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default TerminalOutput;
