
import { ServiceHealth, ServiceStatusLevel } from '../types';

// List of core Azure services to monitor
const CORE_SERVICES = [
    { name: 'Virtual Machines', category: 'Compute' },
    { name: 'App Service', category: 'Web' },
    { name: 'Azure Functions', category: 'Compute' },
    { name: 'Azure Kubernetes Service (AKS)', category: 'Containers' },
    { name: 'Virtual Network', category: 'Networking' },
    { name: 'Azure DNS', category: 'Networking' },
    { name: 'VPN Gateway', category: 'Networking' },
    { name: 'Blob Storage', category: 'Storage' },
    { name: 'Azure SQL Database', category: 'Database' },
    { name: 'Cosmos DB', category: 'Database' },
    { name: 'Azure Active Directory', category: 'Identity' },
    { name: 'Azure Key Vault', category: 'Security' },
    { name: 'Azure Monitor', category: 'Management' },
    { name: 'Cost Management', category: 'Management' },
    { name: 'Azure Portal', category: 'General' },
    { name: 'Azure DevOps', category: 'DevOps' }
];

/**
 * Simulates fetching status from Azure Status API.
 * Note: A direct fetch to status.azure.com is blocked by CORS in browser apps,
 * so we simulate a realistic response.
 */
export const fetchAzureStatus = async (): Promise<ServiceHealth[]> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const now = new Date().toISOString();
    
    // "Spurious errors" fix: Forced status to be healthy/available.
    // Previously simulated random outages were causing confusion.
    const hasIssues = false; 

    return CORE_SERVICES.map(service => {
        let status: ServiceStatusLevel = 'Available';
        let message = 'Operating normally';

        if (hasIssues) {
            // Randomly degrade services (Disabled)
            const rand = Math.random();
            if (rand > 0.95) {
                status = 'Critical';
                message = 'Major outage in East US region';
            } else if (rand > 0.85) {
                status = 'Warning';
                message = 'Intermittent latency observed';
            }
        }

        return {
            name: service.name,
            category: service.category,
            region: 'Global/East US',
            status: status,
            updated: now,
            message: message
        };
    });
};

/**
 * Sorts services so that Critical/Warning appear at the top.
 */
export const sortServiceHealth = (services: ServiceHealth[]): ServiceHealth[] => {
    const priorityMap: Record<ServiceStatusLevel, number> = {
        'Critical': 0,
        'Warning': 1,
        'Information': 2,
        'Available': 3
    };

    return [...services].sort((a, b) => {
        return priorityMap[a.status] - priorityMap[b.status];
    });
};
