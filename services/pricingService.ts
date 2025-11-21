








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
    'VPN Gateway (VpnGw1)': 138.70, // ~$0.19/hr
    'VPN Gateway (VpnGw2)': 262.80, // ~$0.36/hr
    'NAT Gateway (Standard)': 32.85, // ~$0.045/hr
    'NAT Data (Per GB)': 0.045, 
    'VNet Peering (Per GB)': 0.01, 

    // Storage
    'OS Disk (P10 - 128GB)': 19.71,
    'ACR (Premium)': 50.00, // Estimate daily rate x 30
    
    // Storage Capacity
    'Storage Capacity (Hot LRS)': 0.02, // Per GB
    'Storage Capacity (Hot GRS)': 0.04, // Per GB
    'Azure Files (Standard)': 0.06, // Per GB

    // Security
    'Key Vault (Premium Base)': 10.00, // Roughly estimated monthly base if actively used
    'Azure Firewall (Basic)': 288.00, // ~$0.395/hr
    'Azure Firewall (Standard)': 912.00, // ~$1.25/hr
    'Azure Firewall (Premium)': 1277.00, // ~$1.75/hr
    'App Gateway (WAF v2)': 320.00, // ~$0.44/hr fixed
    'Log Analytics (Per GB)': 2.30,
    'Sentinel (Per GB Analysis)': 2.00, // On top of LA

    // Serverless
    'Static Web App (Standard)': 9.00,
    'Container Apps (vCPU)': 25.00, // Approx active monthly 
    'Container Apps (Memory)': 6.00,  // Approx active monthly

    // ACI
    'ACI (vCPU)': 30.00, // Est monthly per core active
    'ACI (Memory)': 3.00, // Est monthly per GB active

    // Integration
    'Logic App (WS1)': 175.00, // Approx
    'Logic App (WS2)': 350.00,
    'Logic App (WS3)': 700.00,
    'APIM (Developer)': 48.00,
    'APIM (Standard)': 147.00,
    'APIM (Premium)': 2795.00,
    'Service Bus (Standard Base)': 10.00, // Base charge
    'Service Bus (Ops 1M)': 0.05,
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

        case 'vm-windows-secure': {
            const size = inputs['vmSize'] || 'Standard_D2s_v3';
            const basePrice = PRICING_CATALOG[size] || 70.08;
            // Estimated Windows License (Usually ~46% of base compute for standard instances)
            const licenseCost = basePrice * 0.46; 
            
            items.push({
                resourceName: 'Virtual Machine (Base)',
                sku: size,
                unitPrice: basePrice,
                quantity: 1,
                total: basePrice
            });
             items.push({
                resourceName: 'Windows Server License',
                sku: 'Pay-as-you-go',
                unitPrice: licenseCost,
                quantity: 1,
                total: licenseCost
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

        case 'vmss-autoscale': {
            const size = inputs['vmSize'] || 'Standard_B1s';
            const minCount = Number(inputs['minCount'] || 1);
            const price = PRICING_CATALOG[size] || 7.59;
            
            // Calculate based on Min Instances (conservative estimate)
            items.push({
                resourceName: 'VMSS Instances (Min)',
                sku: size,
                unitPrice: price,
                quantity: minCount,
                total: price * minCount
            });
            items.push({
                resourceName: 'Load Balancer',
                sku: 'Standard',
                unitPrice: 0.025 * 730, // Approx monthly rule cost if active
                quantity: 1,
                total: 0.025 * 730
            });
            break;
        }

        case 'vm-spot-linux': {
            const size = inputs['vmSize'] || 'Standard_D2s_v3';
            const basePrice = PRICING_CATALOG[size] || 70.08;
            // Spot instances are typically 60-90% cheaper. Using 80% discount as average estimate.
            const spotPrice = basePrice * 0.20; 

            items.push({
                resourceName: 'Spot Virtual Machine',
                sku: `${size} (Spot Priority)`,
                unitPrice: spotPrice,
                quantity: 1,
                total: spotPrice
            });
            items.push({
                resourceName: 'OS Disk',
                sku: 'Standard SSD', // Usually use cheaper disk for spot
                unitPrice: PRICING_CATALOG['OS Disk (P10 - 128GB)'] * 0.6, // Rough diff
                quantity: 1,
                total: PRICING_CATALOG['OS Disk (P10 - 128GB)'] * 0.6
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

        case 'aci-single': {
            const cpu = Number(inputs['cpu'] || 1);
            const mem = Number(inputs['memory'] || 1.5);
            
            items.push({
                resourceName: 'ACI vCPU Duration',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['ACI (vCPU)'],
                quantity: cpu,
                total: PRICING_CATALOG['ACI (vCPU)'] * cpu
            });
             items.push({
                resourceName: 'ACI Memory Duration',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['ACI (Memory)'],
                quantity: mem,
                total: PRICING_CATALOG['ACI (Memory)'] * mem
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

        case 'function-app-consumption': {
             items.push({
                resourceName: 'Function App Compute',
                sku: 'Consumption (Pay-as-you-go)',
                unitPrice: 0,
                quantity: 1,
                total: 0 // First 1M executions free generally covers dev/test
            });
            // Functions require storage
            const storageSku = 'Standard_LRS';
            const storagePrice = PRICING_CATALOG['Storage Capacity (Hot LRS)'] * 5; // Low usage
            items.push({
                resourceName: 'Storage Account',
                sku: storageSku,
                unitPrice: storagePrice,
                quantity: 1,
                total: storagePrice
            });
            break;
        }

        case 'static-web-app': {
            const sku = inputs['sku'] || 'Free';
            const price = sku === 'Standard' ? PRICING_CATALOG['Static Web App (Standard)'] : 0;
            items.push({
                resourceName: 'Static Web App',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            break;
        }

        case 'container-apps': {
             items.push({
                resourceName: 'CA Environment (Log Analytics)',
                sku: 'Ingestion (Est. 2GB)',
                unitPrice: PRICING_CATALOG['Log Analytics (Per GB)'],
                quantity: 2,
                total: PRICING_CATALOG['Log Analytics (Per GB)'] * 2
            });
             items.push({
                resourceName: 'App Replicas (Active)',
                sku: 'vCPU/Memory (Est. 0.5 core / 1GB)',
                unitPrice: (PRICING_CATALOG['Container Apps (vCPU)'] * 0.5) + PRICING_CATALOG['Container Apps (Memory)'],
                quantity: 1,
                total: (PRICING_CATALOG['Container Apps (vCPU)'] * 0.5) + PRICING_CATALOG['Container Apps (Memory)']
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

        case 'network-hub-spoke': {
            items.push({
                resourceName: 'VNet Peering Traffic (Est.)',
                sku: 'Intra-Region Data Transfer',
                unitPrice: PRICING_CATALOG['VNet Peering (Per GB)'],
                quantity: 100, // Est 100GB
                total: PRICING_CATALOG['VNet Peering (Per GB)'] * 100
            });
            break;
        }

        case 'network-vpn-gateway': {
            const sku = inputs['sku'] || 'VpnGw1';
            const key = `VPN Gateway (${sku})`;
            const price = PRICING_CATALOG[key] || 138.70;
            items.push({
                resourceName: 'VPN Gateway',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
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

        case 'network-nat-gateway': {
            items.push({
                resourceName: 'NAT Gateway',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['NAT Gateway (Standard)'],
                quantity: 1,
                total: PRICING_CATALOG['NAT Gateway (Standard)']
            });
             items.push({
                resourceName: 'Data Processing (Est. 100GB)',
                sku: 'Outbound Data',
                unitPrice: PRICING_CATALOG['NAT Data (Per GB)'],
                quantity: 100,
                total: PRICING_CATALOG['NAT Data (Per GB)'] * 100
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

        case 'dns-public': {
            items.push({
                resourceName: 'DNS Zone',
                sku: 'Public',
                unitPrice: 0.50,
                quantity: 1,
                total: 0.50
            });
             items.push({
                resourceName: 'DNS Queries (Est. 1M)',
                sku: 'Standard',
                unitPrice: 0.40,
                quantity: 1,
                total: 0.40
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

        case 'identity-uami':
        case 'identity-sp':
        case 'identity-rbac': {
             items.push({
                 resourceName: 'Azure Active Directory Object',
                 sku: 'Free (Included)',
                 unitPrice: 0.00,
                 quantity: 1,
                 total: 0.00
             });
             break;
        }

        case 'kv-standard': {
            const sku = String(inputs['sku'] || 'Standard');
            if (sku === 'Premium') {
                items.push({
                    resourceName: 'Key Vault',
                    sku: 'Premium (HSM Backed)',
                    unitPrice: PRICING_CATALOG['Key Vault (Premium Base)'],
                    quantity: 1,
                    total: PRICING_CATALOG['Key Vault (Premium Base)']
                });
            } else {
                 items.push({
                    resourceName: 'Key Vault',
                    sku: 'Standard',
                    unitPrice: 0.03, // Nominal operations cost
                    quantity: 1,
                    total: 0.03
                });
            }
            break;
        }

        case 'azure-firewall': {
            const sku = String(inputs['sku'] || 'Standard');
            const key = `Azure Firewall (${sku})`;
            const price = PRICING_CATALOG[key] || 912.00;
            
            items.push({
                resourceName: 'Azure Firewall',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            items.push({
                resourceName: 'Data Processing (Est. 100GB)',
                sku: 'Standard',
                unitPrice: 0.016, // per GB
                quantity: 100,
                total: 1.60
            });
            break;
        }

        case 'app-gateway-waf': {
             const price = PRICING_CATALOG['App Gateway (WAF v2)'];
             items.push({
                resourceName: 'Application Gateway',
                sku: 'WAF v2',
                unitPrice: price,
                quantity: 1,
                total: price
            });
            items.push({
                resourceName: 'Capacity Units (Est)',
                sku: 'Autoscale Unit',
                unitPrice: 0.008 * 730, // approx monthly per CU
                quantity: 5, // Avg load
                total: (0.008 * 730) * 5
            });
            break;
        }

        case 'sentinel-starter': {
            items.push({
                resourceName: 'Log Analytics Ingestion',
                sku: 'Pay-as-you-go',
                unitPrice: PRICING_CATALOG['Log Analytics (Per GB)'],
                quantity: 5, // Est 5GB/day * 30? No, 5GB total for demo
                total: PRICING_CATALOG['Log Analytics (Per GB)'] * 5
            });
             items.push({
                resourceName: 'Microsoft Sentinel Analysis',
                sku: 'Pay-as-you-go',
                unitPrice: PRICING_CATALOG['Sentinel (Per GB Analysis)'],
                quantity: 5, 
                total: PRICING_CATALOG['Sentinel (Per GB Analysis)'] * 5
            });
            break;
        }

        case 'logic-app-standard': {
            const sku = inputs['sku'] || 'WS1';
            const price = PRICING_CATALOG[`Logic App (${sku})`] || 175.00;
            items.push({
                resourceName: 'Workflow Standard Plan',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
             items.push({
                resourceName: 'Storage Account',
                sku: 'Standard_LRS',
                unitPrice: PRICING_CATALOG['Storage Capacity (Hot LRS)'] * 50, // More storage usage than consumption
                quantity: 1,
                total: PRICING_CATALOG['Storage Capacity (Hot LRS)'] * 50
            });
            break;
        }

        case 'apim-standard': {
            const sku = inputs['sku'] || 'Developer';
            const price = PRICING_CATALOG[`APIM (${sku})`] || 48.00;
            items.push({
                resourceName: 'API Management',
                sku: sku,
                unitPrice: price,
                quantity: 1,
                total: price
            });
            break;
        }

        case 'service-bus-standard': {
             items.push({
                resourceName: 'Service Bus Namespace',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['Service Bus (Standard Base)'],
                quantity: 1,
                total: PRICING_CATALOG['Service Bus (Standard Base)']
            });
            items.push({
                resourceName: 'Operations (Est 5M)',
                sku: 'Standard',
                unitPrice: PRICING_CATALOG['Service Bus (Ops 1M)'],
                quantity: 5,
                total: PRICING_CATALOG['Service Bus (Ops 1M)'] * 5
            });
            break;
        }

        case 'monitor-cost-analytics': {
            items.push({
                resourceName: 'Log Analytics Workspace',
                sku: 'Pay-as-you-go',
                unitPrice: PRICING_CATALOG['Log Analytics (Per GB)'],
                quantity: 5, // Est 5GB
                total: PRICING_CATALOG['Log Analytics (Per GB)'] * 5
            });
            items.push({
                resourceName: 'Automation Account',
                sku: 'Basic',
                unitPrice: 0.002, // Minimal cost per minute usually
                quantity: 0, // Assuming within free grant
                total: 0
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
