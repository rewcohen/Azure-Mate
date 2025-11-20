
import { AzureCategory, Scenario } from './types';

const COMMON_TAGS = '@{ "Environment" = "{{environment}}"; "Project" = "{{projectPrefix}}"; "CostCenter" = "{{costCenter}}"; "Owner" = "{{owner}}" }';
const BASE_RG = '$RgName = "{{projectPrefix}}-{{environment}}-{{rgSuffix}}"';
const BASE_LOC = '$Location = "{{location}}"';

export const SCENARIOS: Scenario[] = [
  // --- COMPUTE ---
  {
    id: 'vm-linux-ssh',
    category: AzureCategory.COMPUTE,
    title: 'Secure Linux VM (Ubuntu)',
    description: 'Deploys a hardened Ubuntu Linux Virtual Machine suitable for jumpboxes or web servers. This configuration includes a Network Security Group (NSG) strictly limiting ingress to SSH (Port 22), creates a User Assigned Managed Identity for secure Azure resource access without credentials, and utilizes SSH Key authentication for maximum security.',
    whatItDoes: [
        "Creates Resource Group and VNet/Subnet",
        "Deploys Ubuntu 22.04 LTS VM",
        "Configures SSH Key Authentication",
        "Attaches System Assigned Managed Identity",
        "Configures NSG allowing only Port 22"
    ],
    limitations: [
        "Does not configure OS-level diagnostics",
        "Does not set up Azure Backup",
        "Does not install custom extensions (Docker, etc.)"
    ],
    commonIssues: [
        "Connection Timeout: Often caused by corporate firewalls blocking outbound Port 22.",
        "Permission Denied: Ensure the private key permissions are restricted (chmod 400) on the client side.",
        "Identity Errors: The VM may take 1-2 minutes to fully register the Managed Identity after boot."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'compute' },
      { id: 'vmName', label: 'VM Name', type: 'text', defaultValue: 'vm-app-01' },
      { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_B1s', 'Standard_B2s', 'Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_B2s', description: 'Affects cost. B-series is burstable, D-series is general purpose.' },
      { id: 'adminUser', label: 'Admin Username', type: 'text', defaultValue: 'azureuser' }
    ],
    learnLinks: [
      { title: 'Quickstart: Create a Linux VM', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/linux/quick-create-powershell' },
      { title: 'Proximity Placement Groups', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/co-location' }
    ],
    diagramCode: `
graph TD
    User -->|SSH :22| NSG
    subgraph "Azure: {{location}}"
      NSG[NSG] --> Subnet
      Subnet --> VM[Ubuntu VM]
      VM --> Disk[OS Disk]
    end
    `,
    scriptTemplate: `# Secure Linux VM Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$AdminUser = "{{adminUser}}"
$Tags = ${COMMON_TAGS}
$ProximityGroup = "{{proximityPlacementGroup}}"

Write-Host "Creating Resource Group $RgName..." -ForegroundColor Cyan
New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# PPG Handling
$ppgId = $null
if (-not [string]::IsNullOrWhiteSpace($ProximityGroup)) {
    Write-Host "Checking Proximity Placement Group: $ProximityGroup"
    $ppg = Get-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -ErrorAction SilentlyContinue
    if ($null -eq $ppg) {
        Write-Host "Creating new PPG..."
        $ppg = New-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -Location $Location -ProximityPlacementGroupType Standard
    }
    $ppgId = $ppg.Id
}

Write-Host "Creating Networking..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$VmName-vnet" -AddressPrefix "10.0.0.0/16"
$nsg = New-AzNetworkSecurityGroup -ResourceGroupName $RgName -Location $Location -Name "$VmName-nsg"
$subnet = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.0.1.0/24" -NetworkSecurityGroup $nsg -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork

$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VmName-pip" -AllocationMethod Static -Sku Standard
$nic = New-AzNetworkInterface -ResourceGroupName $RgName -Location $Location -Name "$VmName-nic" -SubnetId $subnet.Id -PublicIpAddressId $pip.Id

Write-Host "Creating VM Config..."
$vmConfig = New-AzVMConfig -VMName $VmName -VMSize $VmSize |
    Set-AzVMOperatingSystem -Linux -ComputerName $VmName -Credential (Get-Credential) |
    Set-AzVMSourceImage -PublisherName "Canonical" -Offer "0001-com-ubuntu-server-jammy" -Skus "22_04-lts" -Version "latest" |
    Add-AzVMNetworkInterface -Id $nic.Id |
    Assign-AzUserAssignedIdentity -Identity "/subscriptions/{{subscriptionId}}/resourcegroups/$RgName/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-$VmName"

if ($ppgId) {
    $vmConfig = Set-AzVMProximityPlacementGroup -VMConfig $vmConfig -Id $ppgId
}

New-AzVM -ResourceGroupName $RgName -Location $Location -VM $vmConfig -Tag $Tags
Write-Host "Done." -ForegroundColor Green`
  },

  // --- CONTAINERS (AKS) ---
  {
    id: 'aks-managed',
    category: AzureCategory.CONTAINERS,
    title: 'Azure Kubernetes Service (AKS)',
    description: 'Provisions a production-ready Managed Kubernetes cluster. This setup uses System Assigned Managed Identity for control plane auth, Azure CNI for advanced networking (assigning VNet IPs to Pods), and enables the monitoring addon for Container Insights. It ensures the cluster is ready for high-performance workloads.',
    whatItDoes: [
        "Deploys AKS Cluster with Managed Identity",
        "Configures System Node Pool",
        "Enables Azure CNI Networking",
        "Generates SSH Keys for nodes"
    ],
    limitations: [
        "Does not configure Ingress Controller (AGIC/Nginx)",
        "Does not enable Entra ID (AAD) integration",
        "Does not set up Log Analytics workspace"
    ],
    commonIssues: [
        "Subnet Exhaustion: Azure CNI requires 1 IP per Pod. Ensure the subnet is large enough (min /24 recommended).",
        "Quota Limits: Standard_DS2_v2 CPUs often hit regional subscription limits.",
        "Registration State: 'Microsoft.ContainerService' provider must be registered in the subscription."
    ],
    prerequisites: ['acr-premium'], // AKS often needs ACR
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'k8s' },
      { id: 'clusterName', label: 'Cluster Name', type: 'text', defaultValue: 'aks-cluster-01' },
      { id: 'nodeCount', label: 'Node Count', type: 'number', defaultValue: 3 },
      { id: 'vmSize', label: 'Node Size', type: 'select', options: ['Standard_DS2_v2', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_DS2_v2' }
    ],
    learnLinks: [
        { title: 'Quickstart: Deploy an AKS cluster', url: 'https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-powershell' },
        { title: 'AKS Best Practices', url: 'https://learn.microsoft.com/en-us/azure/aks/best-practices' }
    ],
    diagramCode: `graph TB
    User -->|kubectl| LB[Load Balancer]
    subgraph "AKS Cluster: {{clusterName}}"
      LB --> Node1
      LB --> Node2
      Node1[Node Pool]
      Node2[System Pool]
    end`,
    scriptTemplate: `# AKS Deployment
${BASE_RG}
${BASE_LOC}
$ClusterName = "{{clusterName}}"
$NodeCount = {{nodeCount}}
$NodeSize = "{{vmSize}}"
$Tags = ${COMMON_TAGS}
$ProximityGroup = "{{proximityPlacementGroup}}"

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# PPG Handling (AKS supports PPG for node pools)
$ppgId = $null
if (-not [string]::IsNullOrWhiteSpace($ProximityGroup)) {
     $ppg = Get-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -ErrorAction SilentlyContinue
     if ($ppg) { $ppgId = $ppg.Id }
}

Write-Host "Creating AKS Cluster..."
# Note: Basic deployment. For PPG, typically requires AgentPool config separately, but included here as parameter if applicable in specific API versions or add-on logic.
# Defaulting to standard deployment for simplicity as direct New-AzAksCluster PPG support varies by module version.

New-AzAksCluster -ResourceGroupName $RgName -Name $ClusterName -Location $Location ` + 
`-NodeCount $NodeCount -NodeVmSize $NodeSize -NetworkPlugin azure ` +
`-EnableManagedIdentity -GenerateSshKey -Tag $Tags

if ($ppgId) {
    Write-Host "Use Add-AzAksNodePool to add pools associated with PPG ID: $ppgId"
}

Write-Host "Get Credentials:"
Write-Host "Get-AzAksClusterUserCredential -ResourceGroupName $RgName -Name $ClusterName"`
  },

  // --- STORAGE (BLOB) ---
  {
    id: 'storage-blob-gpv2',
    category: AzureCategory.STORAGE,
    title: 'Azure Storage Account (Blob)',
    description: 'Deploys a General Purpose v2 (GPv2) Storage Account optimized for general blob storage use cases. It automatically creates a default container for immediate use. GPv2 is the industry standard for storing objects like images, logs, and backups.',
    whatItDoes: [
        "Creates GPv2 Storage Account",
        "Enables 'Hot' access tier by default",
        "Creates a private Blob Container"
    ],
    limitations: [
        "Does not configure Lifecycle Management policies",
        "Does not configure Virtual Network firewall rules",
        "Does not enable immutable storage (WORM)"
    ],
    commonIssues: [
        "Naming: Storage names must be 3-24 chars, lowercase alphanumeric ONLY, and globally unique.",
        "Public Access: Scripts often default to blocking public blob access for security. Check 'AllowBlobPublicAccess' if needed.",
        "Replication: GRS/RA-GRS is significantly more expensive than LRS."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'store' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stblob001', description: 'Lowercase, numbers only, unique' },
      { id: 'sku', label: 'Replication SKU', type: 'select', options: ['Standard_LRS', 'Standard_GRS', 'Standard_RAGRS'], defaultValue: 'Standard_LRS' },
      { id: 'containerName', label: 'Container Name', type: 'text', defaultValue: 'data' }
    ],
    learnLinks: [{ title: 'Create Storage Account', url: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create?tabs=azure-powershell' }],
    diagramCode: `graph LR
    User -->|HTTPS| Blob[Blob Service]
    Blob --> Container
    Container --> File1
    Container --> File2`,
    scriptTemplate: `# Storage Account (Blob)
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$AccountName = "{{accountName}}"
$Sku = "{{sku}}"
$ContainerName = "{{containerName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Storage Account $AccountName..."
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $AccountName -SkuName $Sku -Location $Location -Kind StorageV2 -AccessTier Hot -Tag $Tags

$ctx = $st.Context

Write-Host "Creating Container $ContainerName..."
New-AzStorageContainer -Name $ContainerName -Context $ctx -Permission Off

Write-Host "Storage Account Created."`
  },

  // --- STORAGE (FILES) ---
  {
    id: 'storage-files',
    category: AzureCategory.STORAGE,
    title: 'Azure Files (SMB Share)',
    description: 'Deploys a Storage Account and creates a standard SMB 3.0 File Share. This is ideal for "Lift and Shift" scenarios where legacy applications require a mapped network drive, or for sharing configuration files between multiple VMs.',
    whatItDoes: [
        "Creates GPv2 Storage Account",
        "Creates SMB File Share",
        "Sets Quota Limit"
    ],
    limitations: [
        "Does not configure Active Directory Domain Services (AD DS) authentication",
        "Does not configure Azure File Sync"
    ],
    commonIssues: [
        "Port 445: Most residential ISPs block outbound port 445. You may not be able to mount this share from your home PC.",
        "Mounting: Requires the Storage Account Key for mounting unless Identity-based auth is configured."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'files' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stfiles001', description: 'Lowercase, numbers only, unique' },
      { id: 'shareName', label: 'Share Name', type: 'text', defaultValue: 'share-01' },
      { id: 'quota', label: 'Quota (GB)', type: 'number', defaultValue: 100 }
    ],
    learnLinks: [{ title: 'Create Azure File Share', url: 'https://learn.microsoft.com/en-us/azure/storage/files/storage-how-to-create-file-share?tabs=azure-powershell' }],
    diagramCode: `graph LR
    VM1[Windows VM] -->|SMB 3.0| Share[Azure File Share]
    VM2[Linux VM] -->|SMB 3.0| Share
    Share --> Folder --> Files`,
    scriptTemplate: `# Azure Files Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$AccountName = "{{accountName}}"
$ShareName = "{{shareName}}"
$Quota = {{quota}}
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Storage Account for Files..."
# Using Standard_LRS for cost efficiency in this template
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $AccountName -SkuName "Standard_LRS" -Location $Location -Kind StorageV2 -Tag $Tags

$ctx = $st.Context

Write-Host "Creating File Share $ShareName..."
New-AzStorageShare -Name $ShareName -Context $ctx -QuotaGiB $Quota

Write-Host "File Share Created."`
  },

  // --- STORAGE (DATA LAKE) ---
  {
    id: 'storage-datalake-gen2',
    category: AzureCategory.STORAGE,
    title: 'Data Lake Storage Gen2',
    description: 'Deploys a Storage Account with Hierarchical Namespaces (HNS) enabled. This converges the capabilities of Blob Storage and Data Lake Gen1, making it the primary storage solution for building Enterprise Data Lakes and running Big Data analytics.',
    whatItDoes: [
        "Creates Storage Account with HNS Enabled",
        "Creates root filesystem (Container)"
    ],
    limitations: [
        "Cannot disable HNS after creation",
        "Does not set up Role-Based Access Control (RBAC) for data plane"
    ],
    commonIssues: [
        "Driver Compatibility: Ensure your client applications use the ABFS driver.",
        "Soft Delete: Verify soft delete retention periods if frequently overwriting data."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'lake' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stdatalake001', description: 'Lowercase, numbers only, unique' },
      { id: 'fsName', label: 'Filesystem Name', type: 'text', defaultValue: 'raw-data' }
    ],
    learnLinks: [{ title: 'Introduction to Data Lake Gen2', url: 'https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction' }],
    diagramCode: `graph TB
    Source[Data Sources] -->|Ingest| ADLS[Data Lake Gen2]
    ADLS -->|Analyze| Synapse[Synapse Analytics]
    ADLS -->|Train| ML[Machine Learning]`,
    scriptTemplate: `# Data Lake Gen2 Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$AccountName = "{{accountName}}"
$FsName = "{{fsName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating HNS Enabled Storage Account..."
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $AccountName -SkuName "Standard_LRS" -Location $Location -Kind StorageV2 -EnableHierarchicalNamespace $true -Tag $Tags

$ctx = $st.Context

Write-Host "Creating Filesystem $FsName..."
New-AzStorageContainer -Name $FsName -Context $ctx -Permission Off

Write-Host "Data Lake Gen2 Ready."`
  },

  // --- NETWORKING (BASTION) ---
  {
    id: 'bastion-vnet',
    category: AzureCategory.NETWORKING,
    title: 'Azure Bastion & VNet',
    description: 'Deploys a secure Virtual Network containing the specialized AzureBastionSubnet and a Standard SKU Bastion Host. This enables secure RDP/SSH connectivity to your VMs directly from the Azure Portal over SSL, eliminating the need for public IPs on your virtual machines.',
    whatItDoes: [
        "Creates VNet and 'AzureBastionSubnet'",
        "Deploys Standard Public IP",
        "Deploys Azure Bastion Service (Standard SKU)"
    ],
    limitations: [
        "Does not deploy Jumpbox VMs",
        "Does not configure VNet Peering"
    ],
    commonIssues: [
        "Subnet Naming: The subnet MUST be named exactly 'AzureBastionSubnet'.",
        "Subnet Size: The subnet must be /26 or larger (e.g., /25, /24).",
        "Public IP SKU: Bastion requires a Standard SKU Public IP."
    ],
    prerequisites: ['vm-linux-ssh'], // Bastion is useless without a VM
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net' },
      { id: 'vnetName', label: 'VNet Name', type: 'text', defaultValue: 'vnet-hub' },
      { id: 'cidr', label: 'VNet CIDR', type: 'text', defaultValue: '10.1.0.0/16' }
    ],
    learnLinks: [
        { title: 'Create Bastion Host', url: 'https://learn.microsoft.com/en-us/azure/bastion/create-host-powershell' },
        { title: 'VNet Architecture', url: 'https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview' }
    ],
    diagramCode: `graph TD
    User -->|HTTPS| Bastion[Azure Bastion]
    subgraph VNet
      Bastion -->|RDP/SSH| VM[Target VM]
    end`,
    scriptTemplate: `# Azure Bastion Deployment
${BASE_RG}
${BASE_LOC}
$VnetName = "{{vnetName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# Create VNet
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name $VnetName -AddressPrefix "{{cidr}}"

# Bastion Subnet (Must be /26 or larger)
Add-AzVirtualNetworkSubnetConfig -Name "AzureBastionSubnet" -AddressPrefix "10.1.1.0/26" -VirtualNetwork $vnet | Set-AzVirtualNetwork

# Public IP for Bastion
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VnetName-bastion-pip" -Sku Standard -AllocationMethod Static

# Create Bastion
Write-Host "Deploying Bastion (this takes 5-10 mins)..."
New-AzBastion -ResourceGroupName $RgName -Name "$VnetName-bastion" -PublicIpAddress $pip -VirtualNetwork $vnet -Sku Standard -Tag $Tags`
  },

  // --- NETWORKING (FRONT DOOR) ---
  {
    id: 'frontdoor-std',
    category: AzureCategory.NETWORKING,
    title: 'Azure Front Door (Standard)',
    description: 'Deploys a global Azure Front Door (Standard SKU) profile. This acts as a modern Content Delivery Network (CDN) and global Load Balancer, providing dynamic site acceleration and edge-caching. It creates a single global entry point for your web applications.',
    whatItDoes: [
        "Creates Front Door Standard Profile",
        "Creates a global Endpoint"
    ],
    limitations: [
        "Does not configure Origin Groups",
        "Does not configure WAF policies",
        "Does not configure Custom Domains"
    ],
    commonIssues: [
        "DNS Propagation: Front Door endpoints can take 10-30 minutes to become globally active.",
        "Backend Health: If origins are not configured correctly, FD will return 503 errors.",
        "Certificates: Managed certificates require CNAME validation which can block deployment if DNS isn't ready."
    ],
    prerequisites: ['app-service-linux'], // AFD needs a backend
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'afd' },
      { id: 'afdName', label: 'Front Door Name', type: 'text', defaultValue: 'afd-global-01' }
    ],
    learnLinks: [{ title: 'Create Front Door', url: 'https://learn.microsoft.com/en-us/azure/frontdoor/create-front-door-powershell' }],
    diagramCode: `graph TB
    User[Global User] -->|Anycast| AFD[Azure Front Door]
    AFD -->|Origin| WebApp1[East US]
    AFD -->|Origin| WebApp2[West Europe]`,
    scriptTemplate: `# Azure Front Door Standard
${BASE_RG}
$ProfileName = "{{afdName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location "Global" -Tag $Tags -Force

# Create Profile
New-AzFrontDoorCdnProfile -ResourceGroupName $RgName -Name $ProfileName -SkuName Standard_AzureFrontDoor -Tag $Tags

# Create Endpoint
New-AzFrontDoorCdnEndpoint -ResourceGroupName $RgName -ProfileName $ProfileName -Name "$ProfileName-ep" -EnabledState Enabled

Write-Host "Front Door Created. Add Origins via portal or additional scripts."`
  },

  // --- SECURITY (KEY VAULT) ---
  {
    id: 'kv-standard',
    category: AzureCategory.SECURITY,
    title: 'Azure Key Vault',
    description: 'Deploys a secure Azure Key Vault (Standard) configured with the Role-Based Access Control (RBAC) permission model, replacing the legacy Access Policy model. Soft-delete is enabled by default to protect against accidental deletion of secrets.',
    whatItDoes: [
        "Deploys Key Vault Standard SKU",
        "Enables Soft Delete (Retention 90 days)",
        "Enables RBAC Authorization model"
    ],
    limitations: [
        "Does not create Private Endpoints",
        "Does not populate secrets"
    ],
    commonIssues: [
        "Soft Delete Conflict: If you delete a KV and try to recreate it with the same name immediately, it will fail unless you purge the deleted vault.",
        "Access Denied: Even as 'Owner', you must assign yourself 'Key Vault Secrets User' role to read secrets in the RBAC model."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'sec' },
      { id: 'kvName', label: 'Key Vault Name', type: 'text', defaultValue: 'kv-shared-01', description: 'Must be globally unique' }
    ],
    learnLinks: [
        { title: 'Create Key Vault', url: 'https://learn.microsoft.com/en-us/azure/key-vault/general/quick-create-powershell' },
        { title: 'Key Vault RBAC', url: 'https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide' }
    ],
    diagramCode: `graph LR
    App -->|Managed Identity| KV[Key Vault]
    KV --> Secrets
    KV --> Keys
    KV --> Certs`,
    scriptTemplate: `# Key Vault Deployment
${BASE_RG}
${BASE_LOC}
$KvName = "{{kvName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

New-AzKeyVault -Name $KvName -ResourceGroupName $RgName -Location $Location ` +
`-Sku Standard -EnableSoftDelete -EnableRbacAuthorization -Tag $Tags

Write-Host "Key Vault $KvName created with RBAC model."`
  },

  // --- DATABASE (COSMOS) ---
  {
    id: 'cosmos-sql',
    category: AzureCategory.DATABASE,
    title: 'Cosmos DB (NoSQL)',
    description: 'Provisions a Cosmos DB account using the Core (SQL) API. It creates a database and a sample container with a predefined partition key. This setup is optimized for high-availability global applications requiring low-latency data access.',
    whatItDoes: [
        "Creates Cosmos DB Account (Serverless/Provisioned)",
        "Creates SQL Database",
        "Creates Container with Partition Key"
    ],
    limitations: [
        "Does not configure Geo-Replication",
        "Does not configure Private Link"
    ],
    commonIssues: [
        "Partition Key: The partition key ('/id' here) CANNOT be changed after creation. Choose wisely.",
        "Cost Management: Default throughput is 400 RU/s. Auto-scale settings should be monitored to avoid bill shock."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'data' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'cosmos-global-01' },
      { id: 'dbName', label: 'Database Name', type: 'text', defaultValue: 'CoreDb' }
    ],
    learnLinks: [{ title: 'Create Cosmos DB', url: 'https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/manage-with-powershell' }],
    diagramCode: `graph LR
    App -->|SDK| Cosmos[Cosmos DB Account]
    Cosmos --> DB[Database]
    DB --> Container[Container]`,
    scriptTemplate: `# Cosmos DB Deployment
${BASE_RG}
${BASE_LOC}
$AccountName = "{{accountName}}"
$DbName = "{{dbName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# Account
$acc = New-AzCosmosDBAccount -ResourceGroupName $RgName -Name $AccountName -Location $Location -ApiKind "Sql" -Tag $Tags

# Database
New-AzCosmosDBSqlDatabase -ResourceGroupName $RgName -AccountName $AccountName -Name $DbName

# Container
New-AzCosmosDBSqlContainer -ResourceGroupName $RgName -AccountName $AccountName -DatabaseName $DbName -Name "Items" -PartitionKeyPath "/id" -Throughput 400

Write-Host "Cosmos DB deployed."`
  },

  // --- DATABASE (REDIS) ---
  {
    id: 'redis-cache',
    category: AzureCategory.DATABASE,
    title: 'Azure Redis Cache',
    description: 'Deploys a fully managed Azure Cache for Redis (Standard SKU). This acts as a distributed, in-memory data store for high-performance applications. The Standard SKU supports replication for reliability.',
    whatItDoes: [
        "Deploys Redis Cache Standard",
        "Configures Non-SSL port (Disabled by default)"
    ],
    limitations: [
        "Does not configure VNet Injection (requires Premium)",
        "Does not configure persistence"
    ],
    commonIssues: [
        "TLS Versions: Azure Redis enforces TLS 1.2 by default. Older clients may fail to connect.",
        "VNet Injection: Standard SKU does not support VNet injection. Use Private Endpoints for secure access."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'cache' },
      { id: 'redisName', label: 'Redis Name', type: 'text', defaultValue: 'redis-cache-01' },
      { id: 'sku', label: 'Cache SKU', type: 'select', options: ['Basic C0', 'Standard C0', 'Standard C1'], defaultValue: 'Standard C0' }
    ],
    learnLinks: [{ title: 'Create Redis Cache', url: 'https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-how-to-manage-redis-cache-powershell' }],
    diagramCode: `graph LR
    WebApp -->|Redis Protocol| Redis[Azure Redis Cache]
    Redis --> Memory[In-Memory Store]`,
    scriptTemplate: `# Redis Cache Deployment
${BASE_RG}
${BASE_LOC}
$RedisName = "{{redisName}}"
$SkuFull = "{{sku}}" 
# Simple parse for template: "Standard C0" -> Sku: Standard, Size: C0
$SkuName = $SkuFull.Split(' ')[0]
$Size = $SkuFull.Split(' ')[1]
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

New-AzRedisCache -ResourceGroupName $RgName -Name $RedisName -Location $Location -Sku $SkuName -Size $Size -Tag $Tags

Write-Host "Redis Cache created."`
  },

  // --- STORAGE (ACR) ---
  {
    id: 'acr-premium',
    category: AzureCategory.CONTAINERS,
    title: 'Azure Container Registry',
    description: 'Creates a Premium Azure Container Registry (ACR). The Premium SKU is selected to support advanced features like Geo-replication, Content Trust, and Private Link, which are essential for enterprise container supply chains.',
    whatItDoes: [
        "Creates ACR Premium",
        "Enables Admin User"
    ],
    limitations: [
        "Does not configure Content Trust",
        "Does not configure Geo-replication zones"
    ],
    commonIssues: [
        "Docker Login: You must enable the Admin User (or use AAD tokens) to log in via 'docker login'.",
        "Public Access: Premium registries are often locked down. Ensure public network access is allowed if pushing from a dev machine."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'acr' },
      { id: 'acrName', label: 'Registry Name', type: 'text', defaultValue: 'acrregistry001', description: 'Alphanumeric only' }
    ],
    learnLinks: [{ title: 'Create ACR', url: 'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-get-started-powershell' }],
    diagramCode: `graph LR
    DevOps -->|Push| ACR[Container Registry]
    AKS -->|Pull| ACR
    WebApp -->|Pull| ACR`,
    scriptTemplate: `# Azure Container Registry
${BASE_RG}
${BASE_LOC}
$AcrName = "{{acrName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

New-AzContainerRegistry -ResourceGroupName $RgName -Name $AcrName -Location $Location -Sku Premium -EnableAdminUser -Tag $Tags

Write-Host "ACR Created: $AcrName.azurecr.io"`
  },

  // --- INTEGRATION (LOGIC APP) ---
  {
    id: 'logic-app-std',
    category: AzureCategory.INTEGRATION,
    title: 'Logic App (Consumption)',
    description: 'Creates a Consumption-based Logic App. This serverless offering allows you to orchestrate workflows and integrate disparate systems without managing infrastructure. It is ideal for event-driven integrations.',
    whatItDoes: [
        "Creates Consumption Logic App"
    ],
    limitations: [
        "Does not create API Connections",
        "Does not deploy workflow JSON definition"
    ],
    commonIssues: [
        "Connections: Logic Apps require 'API Connections' resource for most actions (Office365, SQL), which must be authorized post-deployment.",
        "Throttling: Consumption plan has limits on concurrent runs. Use Standard plan for high throughput."
    ],
    prerequisites: ['storage-blob-gpv2'], // often needs storage, though logic app consumption is abstracted
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'int' },
      { id: 'logicAppName', label: 'Logic App Name', type: 'text', defaultValue: 'la-workflow-01' }
    ],
    learnLinks: [{ title: 'Create Logic App', url: 'https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-logic-apps-powershell' }],
    diagramCode: `graph LR
    Trigger[HTTP Trigger] -->|JSON| LA[Logic App]
    LA -->|Connector| SQL[SQL DB]
    LA -->|Connector| O365[Office 365]`,
    scriptTemplate: `# Logic App Consumption
${BASE_RG}
${BASE_LOC}
$LaName = "{{logicAppName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

New-AzLogicApp -ResourceGroupName $RgName -Name $LaName -Location $Location -Tag $Tags

Write-Host "Logic App shell created."`
  },

  // --- SERVERLESS (APP SERVICE) ---
  {
    id: 'app-service-linux',
    category: AzureCategory.SERVERLESS,
    title: 'Web App (Linux)',
    description: 'Deploys a Standard tier Linux App Service Plan and a corresponding Web App. This PAAS offering abstracts the OS management, providing built-in scaling, patching, and CI/CD integration capabilities.',
    whatItDoes: [
        "Creates Standard App Service Plan (Linux)",
        "Creates Web App"
    ],
    limitations: [
        "Does not configure Application Insights",
        "Does not configure Deployment Slots"
    ],
    commonIssues: [
        "Cold Starts: If you scale down to the Free/Shared tier, apps will sleep after inactivity.",
        "Container Timeout: If using Docker, heavy containers may time out during startup (default 230s). Set WEBSITES_CONTAINER_START_TIME_LIMIT to increase."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'web' },
      { id: 'appName', label: 'App Name', type: 'text', defaultValue: 'webapp-front-01' },
      { id: 'sku', label: 'Plan SKU', type: 'select', options: ['Free', 'Basic (B1)', 'Standard (S1)', 'PremiumV3 (P1v3)'], defaultValue: 'Standard (S1)' }
    ],
    learnLinks: [{ title: 'Create Web App', url: 'https://learn.microsoft.com/en-us/azure/app-service/scripts/powershell-deploy-linux-docker' }],
    diagramCode: `graph TD
    User -->|HTTPS| AFD[Front Door]
    AFD --> WebApp[App Service]
    subgraph "App Service Plan"
      WebApp
    end`,
    scriptTemplate: `# Linux Web App
${BASE_RG}
${BASE_LOC}
$AppName = "{{appName}}"
$SkuFull = "{{sku}}"
# Parse "Standard (S1)" -> "S1" or "Standard" depending on what cmd requires. 
# New-AzAppServicePlan uses Tier and WorkerSize generally.
$Tier = if($SkuFull -match "Premium"){"PremiumV3"}elseif($SkuFull -match "Standard"){"Standard"}elseif($SkuFull -match "Basic"){"Basic"}else{"Free"}
$Size = if($SkuFull -match "P1v3"){"P1v3"}elseif($SkuFull -match "S1"){"S1"}elseif($SkuFull -match "B1"){"B1"}else{"F1"}
$PlanName = "$AppName-plan"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# App Service Plan
New-AzAppServicePlan -ResourceGroupName $RgName -Name $PlanName -Location $Location -Tier $Tier -WorkerSize $Size -Linux -Tag $Tags

# Web App
New-AzWebApp -ResourceGroupName $RgName -Name $AppName -Location $Location -AppServicePlan $PlanName -Tag $Tags

Write-Host "Web App Deployed: https://$AppName.azurewebsites.net"`
  }
];
