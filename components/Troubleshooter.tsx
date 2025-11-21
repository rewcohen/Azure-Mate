import React, { useState, useEffect, useRef } from 'react';
import { GlobalVariables, AzureContext, ResourceNode, AuditIssue } from '../types';
import { mockSearchGraph } from '../services/mockResourceGraph.ts';
import Mermaid from './Mermaid';
import { 
  AlertTriangle, 
  CheckCircle2, 
  FileJson, 
  RefreshCw, 
  Download, 
  Link, 
  Unlink,
  Search,
  ShieldAlert,
  Terminal,
  Copy,
  X,
  HelpCircle,
  Zap,
  Cloud,
  List,
  ChevronRight
} from 'lucide-react';

interface TroubleshooterProps {
  globalVars: GlobalVariables;
  azureContext: AzureContext;
}

const Troubleshooter: React.FC<TroubleshooterProps> = ({ globalVars, azureContext }) => {
  const [rawConfig, setRawConfig] = useState<string>('');
  const [resources, setResources] = useState<ResourceNode[]>([]);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [filter, setFilter] = useState('');
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Live Scan State
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'console' | 'resources' | 'raw'>('console');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [consoleLogs]);

  // Parse JSON when raw config changes (Offline Mode)
  useEffect(() => {
    if (!azureContext.isConnected && rawConfig) {
        try {
        const parsed = JSON.parse(rawConfig);
        if (Array.isArray(parsed)) {
            setResources(parsed);
        }
        } catch (e) {
        // Allow user to type
        }
    }
  }, [rawConfig, azureContext.isConnected]);

  // --- Analysis Logic ---
  const runAudit = () => {
    const foundIssues: AuditIssue[] = [];
    const resourceMap = new Map<string, ResourceNode>();
    const validSubnetIds = new Set<string>();

    // 1. Indexing Pass
    resources.forEach(r => {
      resourceMap.set(r.id.toLowerCase(), r);
      
      if (r.type === 'Microsoft.Network/virtualNetworks' && r.properties.subnets) {
        r.properties.subnets.forEach((s: any) => {
            if (s.id) validSubnetIds.add(s.id.toLowerCase());
        });
      }
    });

    // 2. Validation Pass
    resources.forEach(r => {
      const rId = r.id.toLowerCase();

      // Rule: Orphaned Disks
      if (r.type === 'Microsoft.Compute/disks') {
        if (r.properties.diskState === 'Unattached') {
          foundIssues.push({
            severity: 'warning',
            resourceId: r.id,
            message: `Disk is unattached. This is incurring costs ($${(r.properties.diskSizeGB || 0) * 0.05}/mo est) without being used.`,
            code: 'COST_ORPHANED_DISK'
          });
        }
      }

      // Rule: NIC Subnet Integrity
      if (r.type === 'Microsoft.Network/networkInterfaces') {
        r.properties.ipConfigurations?.forEach((ip: any) => {
          const subnetId = ip.properties.subnet?.id?.toLowerCase();
          if (subnetId && !validSubnetIds.has(subnetId)) {
            foundIssues.push({
              severity: 'critical',
              resourceId: r.id,
              message: `NIC references a Subnet that does not exist in this configuration: ${ip.properties.subnet.id}`,
              code: 'LINK_BROKEN_SUBNET',
              metadata: { targetId: ip.properties.subnet.id }
            });
          }
        });
      }

      // Rule: VM -> NIC Integrity
      if (r.type === 'Microsoft.Compute/virtualMachines') {
        r.properties.networkProfile?.networkInterfaces?.forEach((nicRef: any) => {
           const nicId = nicRef.id?.toLowerCase();
           if (nicId && !resourceMap.has(nicId)) {
             foundIssues.push({
               severity: 'critical',
               resourceId: r.id,
               message: `VM references a Network Interface that does not exist: ${nicRef.id}`,
               code: 'LINK_BROKEN_NIC',
               metadata: { targetId: nicRef.id }
             });
           } else if (nicId) {
             // Check Region Mismatch
             const nic = resourceMap.get(nicId);
             if (nic && nic.location !== r.location) {
                foundIssues.push({
                    severity: 'warning',
                    resourceId: r.id,
                    message: `Region Mismatch: VM is in '${r.location}' but NIC is in '${nic.location}'. This configuration is generally invalid or high latency.`,
                    code: 'GEO_MISMATCH',
                    metadata: { 
                        targetId: nicId,
                        expectedLocation: r.location,
                        actualLocation: nic.location
                    }
                });
             }
           }
        });
      }

      // Rule: Global Config Compliance (Location)
      if (globalVars && globalVars.location && r.location.toLowerCase() !== globalVars.location.toLowerCase()) {
         foundIssues.push({
             severity: 'info',
             resourceId: r.id,
             message: `Resource location '${r.location}' differs from global preference '${globalVars.location}'.`,
             code: 'POLICY_LOCATION_DIFF'
         });
      }
    });

    setIssues(foundIssues);
  };

  // Run audit when resources change
  useEffect(() => {
    runAudit();
  }, [resources, globalVars]);

  // --- Live Scan Simulation ---
  const handleLiveScan = async () => {
      if (!azureContext.isConnected) return;
      
      setScanStatus('scanning');
      setViewMode('console');
      setResources([]);
      setIssues([]);
      setConsoleLogs([]);

      const addLog = (msg: string) => setConsoleLogs(prev => [...prev, msg]);

      try {
          addLog(`> Connect-AzAccount -Identity -TenantId "${azureContext.tenantId}"`);
          await new Promise(r => setTimeout(r, 600));
          addLog(`> Authenticated as ${azureContext.userDisplayName} (${azureContext.username})`);
          addLog(`> Select-AzSubscription -SubscriptionId "${azureContext.subscriptionId}"`);
          
          await new Promise(r => setTimeout(r, 800));
          addLog(`> Search-AzGraph -Query "Resources | project id, name, type, location, tags, properties" -First 1000`);
          addLog(`> Querying Azure Resource Graph... (Estimated time: 2s)`);
          
          // Fetch Mock Data
          const data = await mockSearchGraph(azureContext.subscriptionId, globalVars.environment);
          
          addLog(`> Success. Retrieved ${data.length} resources.`);
          addLog(`> Starting Analysis Engine v2.4...`);
          await new Promise(r => setTimeout(r, 400));
          addLog(`> Analyzing topology relationships...`);
          addLog(`> Checking compliance with '${globalVars.projectPrefix}' standards...`);
          
          setResources(data);
          // Populate raw config for expert view
          setRawConfig(JSON.stringify(data, null, 2));
          
          addLog(`> Audit Complete.`);
          setScanStatus('complete');
          setViewMode('resources');

      } catch (e) {
          addLog(`> Error: Connection timed out or permission denied.`);
          setScanStatus('error');
      }
  };

  // --- Helper for Diagrams ---
  const getDiagramCode = (issue: AuditIssue): string | null => {
    const resource = resources.find(r => r.id.toLowerCase() === issue.resourceId.toLowerCase());
    if (!resource) return null;

    const rName = resource.name;

    if (issue.code === 'LINK_BROKEN_SUBNET') {
        const targetId = issue.metadata?.targetId || 'Unknown';
        const targetName = targetId.split('/').pop() || 'Unknown-Subnet';
        return `graph LR
    NIC["${rName} (NIC)"]
    Subnet["${targetName}?"]
    style NIC fill:#ef4444,stroke:#7f1d1d,color:white
    style Subnet fill:#1e293b,stroke:#64748b,stroke-dasharray: 5 5,color:#94a3b8
    NIC -.->|Broken Ref| Subnet`;
    }

    if (issue.code === 'LINK_BROKEN_NIC') {
        const targetId = issue.metadata?.targetId || 'Unknown';
        const targetName = targetId.split('/').pop() || 'Unknown-NIC';
        return `graph LR
    VM["${rName} (VM)"]
    NIC["${targetName}?"]
    style VM fill:#ef4444,stroke:#7f1d1d,color:white
    style NIC fill:#1e293b,stroke:#64748b,stroke-dasharray: 5 5,color:#94a3b8
    VM -.->|Broken Ref| NIC`;
    }

    if (issue.code === 'GEO_MISMATCH') {
        const targetId = issue.metadata?.targetId;
        const target = resources.find(r => r.id.toLowerCase() === targetId?.toLowerCase());
        const targetName = target ? target.name : 'Target-NIC';
        const loc1 = issue.metadata?.expectedLocation || resource.location;
        const loc2 = issue.metadata?.actualLocation || target?.location || 'Unknown';

        return `graph TB
    subgraph "${loc1}"
      VM["${rName}"]
    end
    subgraph "${loc2}"
      NIC["${targetName}"]
    end
    style VM fill:#f59e0b,stroke:#78350f,color:white
    style NIC fill:#f59e0b,stroke:#78350f,color:white
    VM <-->|Latency Risk| NIC`;
    }

    return null;
  };

  const handleDownload = () => {
    const blob = new Blob([rawConfig], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azure-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const extractScript = `
# Connect to Azure
Connect-AzAccount

# Run Resource Graph Query
$query = "Resources | project id, name, type, location, tags, properties"
$resources = Search-AzGraph -Query $query -First 5000

# Convert to JSON and save
$json = $resources | ConvertTo-Json -Depth 10
$json | Set-Content -Path "azure_snapshot.json" -Encoding utf8

Write-Host "Exported azure_snapshot.json"
`.trim();

  const handleCopyScript = () => {
      navigator.clipboard.writeText(extractScript);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
  };

  const filteredIssues = issues.filter(i => 
    i.message.toLowerCase().includes(filter.toLowerCase()) || 
    i.resourceId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      {/* Import Guide Modal Overlay */}
      {showImportGuide && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-blue-400" />
                          Manual Data Import
                      </h3>
                      <button onClick={() => setShowImportGuide(false)} className="text-slate-400 hover:text-white">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="mb-4 space-y-2 text-sm text-slate-300">
                          <p>Use this method if you cannot connect the app directly to Azure.</p>
                      </div>
                      <div className="relative group">
                          <div className="absolute top-2 right-2">
                              <button onClick={handleCopyScript} className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded">
                                  {copiedScript ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {copiedScript ? "Copied" : "Copy"}
                              </button>
                          </div>
                          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-emerald-400 overflow-x-auto">{extractScript}</pre>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <ShieldAlert className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
                {azureContext.isConnected ? 'Live Infrastructure Auditor' : 'Offline Infrastructure Auditor'}
            </h2>
            <p className="text-sm text-slate-500">
                {azureContext.isConnected 
                 ? `Connected: ${azureContext.subscriptionId}` 
                 : 'Static analysis of Azure Resource Graph exports.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {!azureContext.isConnected && (
                 <button 
                    onClick={() => setShowImportGuide(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                    <HelpCircle className="w-4 h-4" /> Import JSON
                </button>
            )}
            
            {azureContext.isConnected && (
                <button 
                    onClick={handleLiveScan}
                    disabled={scanStatus === 'scanning'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        scanStatus === 'scanning' 
                        ? 'bg-blue-500/20 text-blue-300 cursor-wait' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                    }`}
                >
                    <Zap className={`w-4 h-4 ${scanStatus === 'scanning' ? 'animate-pulse' : 'fill-current'}`} />
                    {scanStatus === 'scanning' ? 'Scanning...' : 'Run Live Audit'}
                </button>
            )}

            {resources.length > 0 && (
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-sm transition-colors"
                >
                    <Download className="w-4 h-4" /> Export Report
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANE: Audit Results */}
        <div className="w-1/2 flex flex-col border-r border-slate-800">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        Validation Results
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400">{issues.length} Issues</span>
                    </h3>
                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Filter issues..." 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex gap-4 text-xs">
                     <div className="flex items-center gap-1.5 text-red-400">
                         <AlertTriangle className="w-3.5 h-3.5" />
                         <span className="font-mono font-bold">{issues.filter(i => i.severity === 'critical').length}</span> Critical
                     </div>
                     <div className="flex items-center gap-1.5 text-amber-400">
                         <AlertTriangle className="w-3.5 h-3.5" />
                         <span className="font-mono font-bold">{issues.filter(i => i.severity === 'warning').length}</span> Warnings
                     </div>
                     <div className="flex items-center gap-1.5 text-emerald-400">
                         <CheckCircle2 className="w-3.5 h-3.5" />
                         <span className="font-mono font-bold">{resources.length}</span> Scanned
                     </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950">
                {scanStatus === 'scanning' ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                        <p className="text-sm">Running Analysis Engine...</p>
                    </div>
                ) : filteredIssues.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500/20" />
                        <p>No issues detected {resources.length > 0 ? 'in current config' : ''}.</p>
                        {!azureContext.isConnected && resources.length === 0 && (
                            <p className="text-xs mt-2">Connect to Azure or Import JSON to start.</p>
                        )}
                    </div>
                ) : (
                    filteredIssues.map((issue, idx) => {
                        const diagram = getDiagramCode(issue);
                        return (
                            <div key={idx} className={`p-4 rounded-lg border ${
                                issue.severity === 'critical' 
                                    ? 'bg-red-950/10 border-red-900/30' 
                                    : (issue.severity === 'warning' ? 'bg-amber-950/10 border-amber-900/30' : 'bg-blue-950/10 border-blue-900/30')
                            } transition-colors`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 p-1.5 rounded-md ${
                                        issue.severity === 'critical' ? 'bg-red-900/30 text-red-400' : (issue.severity === 'warning' ? 'bg-amber-900/30 text-amber-400' : 'bg-blue-900/30 text-blue-400')
                                    }`}>
                                        {issue.severity === 'critical' ? <Unlink className="w-4 h-4" /> : (issue.severity === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Search className="w-4 h-4" />)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${
                                                issue.severity === 'critical' ? 'text-red-400' : (issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400')
                                            }`}>
                                                {issue.code}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed mb-2">
                                            {issue.message}
                                        </p>
                                        
                                        {diagram && (
                                            <div className="mb-3 rounded overflow-hidden opacity-90">
                                                <Mermaid chart={diagram} />
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                                            <Link className="w-3 h-3 text-slate-500" />
                                            <code className="text-xs text-slate-400 font-mono truncate flex-1" title={issue.resourceId}>
                                                {issue.resourceId.split('/').pop()}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

        {/* RIGHT PANE: Data Viewer */}
        <div className="w-1/2 flex flex-col h-full bg-[#0d1117]">
             <div className="flex items-center border-b border-slate-800 bg-slate-900">
                <button 
                    onClick={() => setViewMode('console')}
                    className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                        viewMode === 'console' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <Terminal className="w-4 h-4" /> Console
                </button>
                <button 
                    onClick={() => setViewMode('resources')}
                    disabled={resources.length === 0}
                    className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                        viewMode === 'resources' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-50'
                    }`}
                >
                    <List className="w-4 h-4" /> Detected Resources ({resources.length})
                </button>
                <button 
                    onClick={() => setViewMode('raw')}
                    className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ml-auto ${
                        viewMode === 'raw' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <FileJson className="w-4 h-4" /> Raw JSON
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                
                {/* Console View */}
                {viewMode === 'console' && (
                    <div ref={scrollRef} className="absolute inset-0 p-4 overflow-y-auto font-mono text-xs space-y-1">
                        <div className="text-slate-500 mb-4"># Azure PowerShell / Resource Graph Output</div>
                        {consoleLogs.length === 0 && !azureContext.isConnected && (
                            <div className="text-slate-600 italic">Waiting for connection... Use "Import JSON" for offline mode.</div>
                        )}
                        {consoleLogs.map((log, i) => (
                            <div key={i} className={`${log.startsWith('>') ? 'text-emerald-400' : 'text-slate-300'} break-all`}>
                                {log}
                            </div>
                        ))}
                        {scanStatus === 'scanning' && (
                            <div className="text-blue-500 animate-pulse">_</div>
                        )}
                    </div>
                )}

                {/* Resource Explorer View */}
                {viewMode === 'resources' && (
                    <div className="absolute inset-0 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-900 text-slate-500 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 font-medium border-b border-slate-800">Name</th>
                                    <th className="p-3 font-medium border-b border-slate-800">Type</th>
                                    <th className="p-3 font-medium border-b border-slate-800">Location</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300 divide-y divide-slate-800">
                                {resources.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30">
                                        <td className="p-3 font-medium text-blue-300 truncate max-w-[150px]" title={r.name}>
                                            {r.name}
                                        </td>
                                        <td className="p-3 text-slate-400 truncate max-w-[150px]" title={r.type}>
                                            {r.type.split('/').pop()}
                                        </td>
                                        <td className="p-3 font-mono text-slate-500">
                                            {r.location}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Raw Editor */}
                {viewMode === 'raw' && (
                    <textarea 
                        value={rawConfig}
                        onChange={(e) => setRawConfig(e.target.value)}
                        className="w-full h-full bg-[#0d1117] text-slate-300 font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed"
                        spellCheck={false}
                        placeholder={azureContext.isConnected ? "Scan results will appear here..." : "Paste your azure_snapshot.json content here..."}
                    />
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Troubleshooter;