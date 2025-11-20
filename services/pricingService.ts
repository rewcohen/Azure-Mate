
import { CostBreakdown, CostItem } from "../types";

/**
 * MOCK PRICING DATABASE
 * In a production app, you might fetch this from the Azure Retail Prices API:
 * https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines'
 * 
 * However, due to CORS issues calling that API directly from a browser, 
 * we use a static lookup table for common SKUs in this demo.
 * Prices are estimated based on East US, Pay-as-you-go, Monthly (730 hours).
 */
const PRICING_CATALOG: Record<string, number> = {
    // VMs (Linux)
    'Standard_B1s': 7.59,
    'Standard_B2s': 30.37,
    'Standard_D2s_v3': 70.08,
    'Standard_D4s_v3': 140.16,
    'Standard_F2s_v2': 61.32,
    'Standard_DS2_v2': 83.22,

    // App Service Plans (Linux)
    'Free': 0,
    'Basic (B1)': 12.41,
    'Standard (S1)': 69.35,
    'PremiumV3 (P1v3)': 83.95,

    // Redis
    'Basic C0': 16.06,
    'Standard C0': 40.15,
    'Standard C1': 100.00,

    // SQL / Cosmos
    'Cosmos Asset (400 RU)': 23.36, // roughly $0.008/hour per 100 RU/s
    'SQL Database (Basic)': 4.99,

    // Network
    'Public IP (Standard)': 3.65, // $0.005/hr
    'Bastion (Standard)': 211.70, // $0.29/hr
    'Front Door (Standard Base)': 35.00,
    'Front Door (Data Process 1TB)': 10.00, // Estimate

    // Storage
    'OS Disk (P10 - 128GB)': 19.71,
    'ACR (Premium)': 50.00, // Estimate daily rate x 30
    
    // Storage Capacity
    'Storage Capacity (Hot LRS)': 0.02, // Per GB
    'Storage Capacity (Hot GRS)': 0.04, // Per GB
    'Azure Files (Standard)': 0.06, // Per GB
};

/**
 * Calculates the estimated monthly cost based on the scenario and user inputs.
 */
export const calculateScenarioCost = (
    scenarioId: string, 
    inputs: Record<string, any>
): CostBreakdown => {
    const items: CostItem[] = [];
    
    switch (scenarioId) {
        case 'vm-linux-ssh': {
            const size = inputs['vmSize'] || 'Standard_B2s';
            const price = PRICING_CATALOG[size] || 0;
            
            items.push({
                resourceName: 'Virtual Machine',
                sku: size,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            items.push({
                resourceName: 'OS Disk',
                sku: 'Premium SSD P10',
                unitPrice: PRICING_CATALOG['OS Disk (P10 - 128GB)'],
                quantity: 1,
                total: PRICING_CATALOG['OS Disk (P10 - 128GB)']
            });
            items.push({
                resourceName: 'Public IP',
                sku: 'Standard Static',
                unitPrice: PRICING_CATALOG['Public IP (Standard)'],
                quantity: 1,
                total: PRICING_CATALOG['Public IP (Standard)']
            });
            break;
        }

        case 'aks-managed': {
            const size = inputs['vmSize'] || 'Standard_DS2_v2';
            const count = Number(inputs['nodeCount'] || 3);
            const price = PRICING_CATALOG[size] || 83.22;

            items.push({
                resourceName: 'Agent Nodes',
                sku: size,
                unitPrice: price,
                quantity: count,
                total: price * count
            });
            items.push({
                resourceName: 'OS Disks (Managed)',
                sku: 'P10 (128GB)',
                unitPrice: PRICING_CATALOG['OS Disk (P10 - 128GB)'],
                quantity: count,
                total: PRICING_CATALOG['OS Disk (P10 - 128GB)'] * count
            });
            items.push({
                resourceName: 'Load Balancer',
                sku: 'Standard',
                unitPrice: 0, // Basic LB cost included or negligible for estimation context
                quantity: 1,
                total: 0
            });
            break;
        }

        case 'bastion-vnet': {
            items.push({
                resourceName: 'Azure Bastion',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['Bastion (Standard)'],
                quantity: 1,
                total: PRICING_CATALOG['Bastion (Standard)']
            });
            items.push({
                resourceName: 'Public IP',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['Public IP (Standard)'],
                quantity: 1,
                total: PRICING_CATALOG['Public IP (Standard)']
            });
            break;
        }

        case 'app-service-linux': {
            const sku = inputs['sku'] || 'Standard (S1)';
            const price = PRICING_CATALOG[sku] || 69.35;
            items.push({
                resourceName: 'App Service Plan',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            break;
        }
        
        case 'frontdoor-std': {
            items.push({
                resourceName: 'Front Door Profile',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['Front Door (Standard Base)'],
                quantity: 1,
                total: PRICING_CATALOG['Front Door (Standard Base)']
            });
            break;
        }

        case 'redis-cache': {
            const sku = inputs['sku'] || 'Standard C0';
            const price = PRICING_CATALOG[sku] || 40.15;
            items.push({
                resourceName: 'Redis Cache',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            break;
        }

        case 'acr-premium': {
            items.push({
                resourceName: 'Container Registry',
                sku: 'Premium',
                unitPrice: PRICING_CATALOG['ACR (Premium)'],
                quantity: 1,
                total: PRICING_CATALOG['ACR (Premium)']
            });
            break;
        }
        
        case 'cosmos-sql': {
            items.push({
                resourceName: 'Cosmos DB (Provisoned)',
                sku: '400 RU/s',
                unitPrice: PRICING_CATALOG['Cosmos Asset (400 RU)'],
                quantity: 1,
                total: PRICING_CATALOG['Cosmos Asset (400 RU)']
            });
             break;
        }

        case 'storage-blob-gpv2':
        case 'storage-datalake-gen2': {
             const sku = inputs['sku'] || 'Standard_LRS';
             const isGrs = sku.includes('GRS');
             const unitPrice = isGrs ? PRICING_CATALOG['Storage Capacity (Hot GRS)'] : PRICING_CATALOG['Storage Capacity (Hot LRS)'];
             const estimatedGb = 100; // Baseline assumption for estimating capacity
             
             items.push({
                 resourceName: 'Storage Capacity (Est. 100GB)',
                 sku: sku,
                 unitPrice: unitPrice,
                 quantity: estimatedGb,
                 total: unitPrice * estimatedGb
             });
             items.push({
                 resourceName: 'Transactions (Est.)',
                 sku: 'Write/Read Operations',
                 unitPrice: 5.00, // Flat buffer
                 quantity: 1,
                 total: 5.00
             });
             break;
        }
        
        case 'storage-files': {
            const quota = Number(inputs['quota'] || 100);
            const unitPrice = PRICING_CATALOG['Azure Files (Standard)'];
             items.push({
                 resourceName: 'File Share Capacity',
                 sku: 'Standard Transaction Optimized',
                 unitPrice: unitPrice,
                 quantity: quota,
                 total: unitPrice * quota
             });
             break;
        }

        default:
            // Generic fallback if scenario specific logic isn't mapped
            items.push({
                resourceName: 'Base Resources',
                sku: 'Various',
                unitPrice: 0,
                quantity: 1,
                total: 0
            });
            break;
    }

    const totalMonthly = items.reduce((acc, item) => acc + item.total, 0);

    return {
        items,
        totalMonthly,
        currency: 'USD',
        isEstimated: true
    };
};
