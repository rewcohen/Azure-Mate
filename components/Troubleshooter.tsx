import React, { useState, useEffect, useMemo } from 'react';
import { GlobalVariables } from '../types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  FileJson, 
  RefreshCw, 
  Download, 
  Server, 
  Network, 
  Database, 
  HardDrive,
  Link,
  Unlink,
  Search,
  ShieldAlert,
  Terminal,
  Copy,
  X,
  HelpCircle
} from 'lucide-react';

// --- Types for the Auditor ---

interface ResourceNode {
  id: string;
  name: string;
  type: string;
  location: string;
  tags?: Record<string, string>;
  properties: Record<string, any>;
  dependsOn?: string[]; // IDs of resources this resource depends on
}

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  resourceId: string;
  message: string;
  code: string;
}

interface TroubleshooterProps {
  globalVars: GlobalVariables;
}

// --- Mock Data Generator ---
// Simulates a raw dump from `Get-AzResource` or Azure Resource Graph
const generateMockTenantData = (): ResourceNode[] => {
  return [
    // 1. Valid VNet
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod",
      name: "vnet-prod",
      type: "Microsoft.Network/virtualNetworks",
      location: "eastus",
      properties: {
        addressSpace: { addressPrefixes: ["10.0.0.0/16"] },
        subnets: [
          { name: "default", id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod/subnets/default" },
          { name: "db-subnet", id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod/subnets/db-subnet" }
        ]
      }
    },
    // 2. Valid NIC (Linked to VNet)
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/nic-vm-01",
      name: "nic-vm-01",
      type: "Microsoft.Network/networkInterfaces",
      location: "eastus",
      properties: {
        ipConfigurations: [{
          name: "ipconfig1",
          properties: {
            subnet: { id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod/subnets/default" }
          }
        }]
      }
    },
    // 3. Valid VM (Linked to NIC)
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-app-01",
      name: "vm-app-01",
      type: "Microsoft.Compute/virtualMachines",
      location: "eastus",
      properties: {
        hardwareProfile: { vmSize: "Standard_D2s_v3" },
        networkProfile: {
          networkInterfaces: [{ id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/nic-vm-01" }]
        },
        storageProfile: {
          osDisk: {
            createOption: "FromImage",
            managedDisk: { id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/disks/vm-app-01-osdisk" }
          }
        }
      }
    },
    // 4. Valid OS Disk
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/disks/vm-app-01-osdisk",
      name: "vm-app-01-osdisk",
      type: "Microsoft.Compute/disks",
      location: "eastus",
      properties: {
        diskSizeGB: 128,
        diskState: "Attached"
      }
    },
    // 5. BROKEN NIC (Links to non-existent subnet)
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/nic-broken",
      name: "nic-broken",
      type: "Microsoft.Network/networkInterfaces",
      location: "eastus",
      properties: {
        ipConfigurations: [{
          name: "ipconfig1",
          properties: {
            // This subnet ID does not exist in our list
            subnet: { id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/vnet-prod/subnets/ghost-subnet" }
          }
        }]
      }
    },
    // 6. ORPHANED Disk (Not attached to any VM)
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/disks/disk-orphan-01",
      name: "disk-orphan-01",
      type: "Microsoft.Compute/disks",
      location: "eastus",
      properties: {
        diskSizeGB: 1024,
        diskState: "Unattached" // Logic should flag this as waste
      }
    },
    // 7. VM in Wrong Region (Consistency Check)
    {
      id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-dr-01",
      name: "vm-dr-01",
      type: "Microsoft.Compute/virtualMachines",
      location: "westus", // Different from other resources
      properties: {
        networkProfile: {
           // Links to a NIC in East US (Latency issue/Cross region mismatch)
           networkInterfaces: [{ id: "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/nic-vm-01" }]
        }
      }
    }
  ];
};

const Troubleshooter: React.FC<TroubleshooterProps> = ({ globalVars }) => {
  const [rawConfig, setRawConfig] = useState<string>(JSON.stringify(generateMockTenantData(), null, 2));
  const [resources, setResources] = useState<ResourceNode[]>([]);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [filter, setFilter] = useState('');
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Parse JSON when raw config changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(rawConfig);
      if (Array.isArray(parsed)) {
        setResources(parsed);
      }
    } catch (e) {
      // Allow user to type without constantly clearing state, validation happens on button press or debounce
    }
  }, [rawConfig]);

  // --- Analysis Logic ---
  const runAudit = () => {
    const foundIssues: AuditIssue[] = [];
    const resourceMap = new Map<string, ResourceNode>();
    const validSubnetIds = new Set<string>();

    // 1. Indexing Pass
    resources.forEach(r => {
      resourceMap.set(r.id.toLowerCase(), r);
      
      // Special handling to extract Subnet IDs since they aren't top-level resources usually
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
              code: 'LINK_BROKEN_SUBNET'
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
               code: 'LINK_BROKEN_NIC'
             });
           } else if (nicId) {
             // Check Region Mismatch
             const nic = resourceMap.get(nicId);
             if (nic && nic.location !== r.location) {
                foundIssues.push({
                    severity: 'warning',
                    resourceId: r.id,
                    message: `Region Mismatch: VM is in '${r.location}' but NIC is in '${nic.location}'. This configuration is generally invalid or high latency.`,
                    code: 'GEO_MISMATCH'
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

  // Run audit on mount
  useEffect(() => {
    runAudit();
  }, [resources, globalVars]);

  const handleDownload = () => {
    const blob = new Blob([rawConfig], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azure-tenant-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const extractScript = `
# Connect to Azure
Connect-AzAccount

# Run Resource Graph Query
# This pulls the top 5000 resources with necessary properties for analysis
$query = "Resources | project id, name, type, location, tags, properties"
$resources = Search-AzGraph -Query $query -First 5000

# Convert to JSON and save
$json = $resources | ConvertTo-Json -Depth 10
$json | Set-Content -Path "azure_snapshot.json" -Encoding utf8

Write-Host "Successfully exported azure_snapshot.json" -ForegroundColor Green
Write-Host "Open this file and copy its content into the Azure Architect Mate tool."
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
                          Extract Data from Azure
                      </h3>
                      <button onClick={() => setShowImportGuide(false)} className="text-slate-400 hover:text-white">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="mb-4 space-y-2 text-sm text-slate-300">
                          <p>To audit your actual infrastructure, you need to export a snapshot of your resources using <strong>Azure PowerShell</strong>.</p>
                          <p>Run the following script in your local PowerShell terminal or Azure Cloud Shell:</p>
                      </div>
                      
                      <div className="relative group">
                          <div className="absolute top-2 right-2">
                              <button 
                                  onClick={handleCopyScript}
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                              >
                                  {copiedScript ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {copiedScript ? "Copied" : "Copy Script"}
                              </button>
                          </div>
                          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                              {extractScript}
                          </pre>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800">
                          <h4 className="text-sm font-bold text-white mb-2">Steps:</h4>
                          <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                              <li>Copy the script above.</li>
                              <li>Open PowerShell on your PC (ensure <code>Az.ResourceGraph</code> module is installed).</li>
                              <li>Paste and run the script. It will generate <code>azure_snapshot.json</code>.</li>
                              <li>Open that file, select all text (Ctrl+A), copy it.</li>
                              <li>Paste it into the "Raw Configuration" pane on the right side of this screen.</li>
                          </ol>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                      <button 
                          onClick={() => setShowImportGuide(false)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
                      >
                          Got it, I'll paste the JSON
                      </button>
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
            <h2 className="text-xl font-bold text-white">Offline Infrastructure Auditor</h2>
            <p className="text-sm text-slate-500">Static analysis of Azure Resource Graph exports or ARM definitions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowImportGuide(true)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:text-purple-300 rounded-lg text-sm transition-all"
            >
                <HelpCircle className="w-4 h-4" /> How to Import?
            </button>
            <button 
                onClick={() => setRawConfig(JSON.stringify(generateMockTenantData(), null, 2))}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
                <RefreshCw className="w-4 h-4" /> Reset Data
            </button>
            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors shadow-lg shadow-blue-900/20"
            >
                <Download className="w-4 h-4" /> Save Report
            </button>
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
                         <span className="font-mono font-bold">{resources.length}</span> Resources Scanned
                     </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950">
                {filteredIssues.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500/20" />
                        <p>No issues detected in the current configuration.</p>
                    </div>
                ) : (
                    filteredIssues.map((issue, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border ${
                            issue.severity === 'critical' 
                                ? 'bg-red-950/10 border-red-900/30 hover:border-red-500/50' 
                                : (issue.severity === 'warning' ? 'bg-amber-950/10 border-amber-900/30 hover:border-amber-500/50' : 'bg-blue-950/10 border-blue-900/30 hover:border-blue-500/50')
                        } transition-colors group`}>
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
                                    <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                                        <Link className="w-3 h-3 text-slate-500" />
                                        <code className="text-xs text-slate-400 font-mono truncate flex-1" title={issue.resourceId}>
                                            {issue.resourceId.split('/').pop()}
                                        </code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* RIGHT PANE: Raw Editor */}
        <div className="w-1/2 flex flex-col h-full">
             <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FileJson className="w-4 h-4" /> Raw Configuration (JSON)
                </span>
                <span className="text-[10px] text-slate-600">
                    Paste your Azure Resource Graph export here
                </span>
            </div>
            <textarea 
                value={rawConfig}
                onChange={(e) => setRawConfig(e.target.value)}
                className="flex-1 w-full bg-[#0d1117] text-slate-300 font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed"
                spellCheck={false}
            />
        </div>
      </div>
    </div>
  );
};

export default Troubleshooter;