
import { DeploymentLog } from "../types";

/**
 * Simulates the execution of a PowerShell script against Azure.
 * Parses lines to generate realistic log events.
 */
export const runMockDeployment = async (
    script: string, 
    onLog: (log: DeploymentLog) => void,
    onComplete: (success: boolean) => void
) => {
    const lines = script.split('\n');
    const commands = lines.map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    
    const createLog = (msg: string, type: DeploymentLog['type'] = 'info') => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        onLog({
            id: crypto.randomUUID(),
            timestamp: timeStr,
            message: msg,
            type
        });
    };

    try {
        createLog("Authenticating to Azure with Managed Identity...", 'info');
        await new Promise(r => setTimeout(r, 800));
        createLog("Authentication Successful. Context: Subscription-1", 'success');
        await new Promise(r => setTimeout(r, 500));

        for (const cmd of commands) {
            // Show the command being executed
            createLog(cmd.length > 60 ? cmd.substring(0, 60) + "..." : cmd, 'command');
            
            // Variable assignment is fast
            if (cmd.startsWith('$')) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            // New-AzResourceGroup
            if (cmd.toLowerCase().includes('new-azresourcegroup')) {
                createLog("Creating Resource Group...", 'info');
                await new Promise(r => setTimeout(r, 1500));
                createLog("Resource Group created successfully.", 'success');
                continue;
            }

            // New-AzVirtualNetwork
            if (cmd.toLowerCase().includes('new-azvirtualnetwork')) {
                createLog("Allocating address space 10.0.0.0/16...", 'info');
                await new Promise(r => setTimeout(r, 2000));
                createLog("Virtual Network created.", 'success');
                continue;
            }

            // New-AzVM
            if (cmd.toLowerCase().includes('new-azvm')) {
                createLog("Starting Virtual Machine deployment (Standard_DS1_v2)...", 'info');
                createLog("This operation may take several minutes...", 'warning');
                
                // Simulate long wait steps
                await new Promise(r => setTimeout(r, 1500));
                createLog("Provisioning Network Interfaces...", 'info');
                await new Promise(r => setTimeout(r, 1500));
                createLog("Creating OS Disk...", 'info');
                await new Promise(r => setTimeout(r, 2500));
                createLog("Virtual Machine is running.", 'success');
                continue;
            }
            
            // Generic New-Az...
            if (cmd.toLowerCase().startsWith('new-az')) {
                const resourceType = cmd.split(' ')[0].replace('New-Az', '');
                createLog(`Provisioning ${resourceType}...`, 'info');
                await new Promise(r => setTimeout(r, 1200));
                createLog(`${resourceType} provisioned.`, 'success');
                continue;
            }

            // Write-Host output
            if (cmd.toLowerCase().includes('write-host')) {
                const msg = cmd.replace(/Write-Host/i, '').replace(/["']/g, '').trim();
                createLog(msg, 'info');
                await new Promise(r => setTimeout(r, 200));
            }
            
            // Default small delay for other commands
            await new Promise(r => setTimeout(r, 400));
        }
        
        onComplete(true);
        
    } catch (e) {
        createLog("An unexpected error occurred during deployment.", 'error');
        onComplete(false);
    }
};
