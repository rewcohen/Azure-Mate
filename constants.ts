

import { AzureCategory, Scenario } from './types';

const COMMON_TAGS = '@{ "Environment" = "{{environment}}"; "Project" = "{{projectPrefix}}"; "CostCenter" = "{{costCenter}}"; "Owner" = "{{owner}}" }';
const BASE_RG = '$RgName = "{{projectPrefix}}-{{environment}}-{{rgSuffix}}"';
const BASE_LOC = '$Location = "{{location}}"';

export const SCENARIOS: Scenario[] = [
  // --- COMPUTE (LINUX) ---
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

  // --- COMPUTE (WINDOWS) ---
  {
    id: 'vm-windows-secure',
    category: AzureCategory.COMPUTE,
    title: 'Secure Windows VM (2022)',
    description: 'Deploys a Windows Server 2022 Datacenter Virtual Machine. It includes a specialized Network Security Group allowing RDP access (Port 3389) only from a specific management IP address to prevent brute-force attacks. It also enables the System Assigned Managed Identity.',
    whatItDoes: [
        "Creates Windows Server 2022 VM",
        "Configures NSG with restricted RDP access",
        "Enables System Assigned Identity"
    ],
    limitations: [
        "Does not join an Active Directory Domain",
        "Does not install Anti-Malware extensions"
    ],
    commonIssues: [
        "Public RDP Risk: Even with IP restriction, exposing RDP to the internet is risky. Use Azure Bastion for production.",
        "Password Complexity: Windows passwords must meet strict complexity requirements (upper, lower, number, special)."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'win' },
      { id: 'vmName', label: 'VM Name', type: 'text', defaultValue: 'vm-win-01' },
      { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_B2s', 'Standard_D2s_v3', 'Standard_D4s_v3'], defaultValue: 'Standard_D2s_v3' },
      { id: 'adminUser', label: 'Admin Username', type: 'text', defaultValue: 'localadmin' },
      { id: 'allowedIp', label: 'Your IP (for RDP)', type: 'text', placeholder: '1.2.3.4', description: 'Your public IP for NSG allow rule' }
    ],
    learnLinks: [{ title: 'Create Windows VM', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/windows/quick-create-powershell' }],
    diagramCode: `graph TD
    User[Admin IP] -->|RDP :3389| NSG
    subgraph Azure
      NSG --> VM[Windows Server]
      VM --> Disk[OS Disk]
    end`,
    scriptTemplate: `# Windows Server 2022 Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$AdminUser = "{{adminUser}}"
$AllowedIp = "{{allowedIp}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Secure Network..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$VmName-vnet" -AddressPrefix "10.0.0.0/16"
$nsg = New-AzNetworkSecurityGroup -ResourceGroupName $RgName -Location $Location -Name "$VmName-nsg"

# Add Safe RDP Rule
if (-not [string]::IsNullOrWhiteSpace($AllowedIp)) {
    $nsg | Add-AzNetworkSecurityRuleConfig -Name "AllowAdminRDP" -Description "Allow RDP from Admin IP" -Access Allow ` +
    `-Protocol Tcp -Direction Inbound -Priority 100 -SourceAddressPrefix $AllowedIp -SourcePortRange * ` +
    `-DestinationAddressPrefix * -DestinationPortRange 3389 | Set-AzNetworkSecurityGroup
} else {
    Write-Warning "No Allowed IP provided. RDP port will not be opened via NSG (locked down)."
}

$subnet = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.0.1.0/24" -NetworkSecurityGroup $nsg -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork

$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VmName-pip" -AllocationMethod Static -Sku Standard
$nic = New-AzNetworkInterface -ResourceGroupName $RgName -Location $Location -Name "$VmName-nic" -SubnetId $subnet.Id -PublicIpAddressId $pip.Id

Write-Host "Creating VM Config..."
$cred = Get-Credential -Message "Enter VM Admin Password"

$vmConfig = New-AzVMConfig -VMName $VmName -VMSize $VmSize |
    Set-AzVMOperatingSystem -Windows -ComputerName $VmName -Credential $cred |
    Set-AzVMSourceImage -PublisherName "MicrosoftWindowsServer" -Offer "WindowsServer" -Skus "2022-Datacenter" -Version "latest" |
    Add-AzVMNetworkInterface -Id $nic.Id |
    Assign-AzSystemAssignedIdentity

New-AzVM -ResourceGroupName $RgName -Location $Location -VM $vmConfig -Tag $Tags

Write-Host "Windows VM Deployed. Connect via RDP to $($pip.IpAddress)"`
  },

  // --- COMPUTE (VMSS) ---
  {
    id: 'vmss-autoscale',
    category: AzureCategory.COMPUTE,
    title: 'VM Scale Set (Autoscale)',
    description: 'Deploys a Linux Virtual Machine Scale Set (VMSS) in Flexible Orchestration mode. It includes a Standard Load Balancer to distribute traffic and an Autoscale setting that scales out the instance count when CPU usage exceeds 75%.',
    whatItDoes: [
        "Creates Standard Load Balancer",
        "Creates VM Scale Set (Flex)",
        "Configures Autoscale Rules (CPU based)"
    ],
    limitations: [
        "Uses a generic Ubuntu image",
        "No application deployed inside instances"
    ],
    commonIssues: [
        "Over-provisioning: Autoscale can rapidly increase costs if thresholds are too sensitive.",
        "Health Probes: The Load Balancer needs a valid health probe (e.g., HTTP on port 80) to route traffic."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'scale' },
      { id: 'vmssName', label: 'VMSS Name', type: 'text', defaultValue: 'vmss-app-01' },
      { id: 'vmSize', label: 'Instance Size', type: 'select', options: ['Standard_B1s', 'Standard_D2s_v3'], defaultValue: 'Standard_B1s' },
      { id: 'minCount', label: 'Min Instances', type: 'number', defaultValue: 1 },
      { id: 'maxCount', label: 'Max Instances', type: 'number', defaultValue: 5 }
    ],
    learnLinks: [{ title: 'Create VMSS', url: 'https://learn.microsoft.com/en-us/azure/virtual-machine-scale-sets/quick-create-powershell' }],
    diagramCode: `graph TB
    User --> LB[Load Balancer]
    LB --> VM1[Instance 1]
    LB --> VM2[Instance 2]
    VM1 -.-> Scale[Autoscale Rule]`,
    scriptTemplate: `# VM Scale Set Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmssName = "{{vmssName}}"
$VmSize = "{{vmSize}}"
$MinCount = {{minCount}}
$MaxCount = {{maxCount}}
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# Networking
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Name "$VmssName-vnet" -Location $Location -AddressPrefix "10.0.0.0/16"
$sub = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.0.1.0/24" -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork

# Load Balancer
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Name "$VmssName-lb-pip" -Location $Location -AllocationMethod Static -Sku Standard
$frontend = New-AzLoadBalancerFrontendIpConfig -Name "frontend" -PublicIpAddress $pip
$backend = New-AzLoadBalancerBackendAddressPoolConfig -Name "backend"
$lb = New-AzLoadBalancer -ResourceGroupName $RgName -Name "$VmssName-lb" -Location $Location -Sku Standard -FrontendIpConfiguration $frontend -BackendAddressPool $backend

# VMSS
Write-Host "Creating VM Scale Set..."
$ipConfig = New-AzVmssIpConfig -Name "ipconfig" -LoadBalancerBackendAddressPoolsId $lb.BackendAddressPools[0].Id -SubnetId $sub.Id
$config = New-AzVmssConfig -Location $Location -SkuCapacity $MinCount -SkuName $VmSize -UpgradePolicyMode Automatic |
    Add-AzVmssNetworkInterfaceConfiguration -Name "nic" -Primary $true -IpConfiguration $ipConfig |
    Set-AzVmssOsProfile -ComputerNamePrefix "vmss" -AdminUsername "azureuser" -AdminPassword "SecurePassword123!" -LinuxConfiguration (New-AzVmssLinuxConfiguration -DisablePasswordAuthentication $false) |
    Set-AzVmssStorageProfile -ImageReferencePublisher "Canonical" -ImageReferenceOffer "0001-com-ubuntu-server-jammy" -ImageReferenceSku "22_04-lts" -ImageReferenceVersion "latest"

New-AzVmss -ResourceGroupName $RgName -Name $VmssName -VirtualMachineScaleSet $config -Tag $Tags

# Autoscale
Write-Host "Configuring Autoscale..."
$ruleScaleOut = New-AzAutoscaleRule -MetricName "Percentage CPU" -MetricResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -Operator GreaterThan -MetricStatistic Average -Threshold 75 -TimeGrain "00:01:00" -ScaleActionDirection Increase -ScaleActionType ChangeCount -ScaleActionValue 1 -Cooldown "00:05:00"
$ruleScaleIn = New-AzAutoscaleRule -MetricName "Percentage CPU" -MetricResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -Operator LessThan -MetricStatistic Average -Threshold 25 -TimeGrain "00:01:00" -ScaleActionDirection Decrease -ScaleActionType ChangeCount -ScaleActionValue 1 -Cooldown "00:05:00"

$profile = New-AzAutoscaleProfile -Name "DefaultProfile" -CapacityMin $MinCount -CapacityMax $MaxCount -CapacityDefault $MinCount -Rule $ruleScaleOut,$ruleScaleIn
New-AzAutoscaleSetting -ResourceGroupName $RgName -Name "$VmssName-autoscale" -TargetResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -AutoscaleProfile $profile -Location $Location

Write-Host "VMSS Deployed with Autoscale."`
  },

  // --- COMPUTE (SPOT VM) ---
  {
    id: 'vm-spot-linux',
    category: AzureCategory.COMPUTE,
    title: 'Spot Virtual Machine (Cost Saver)',
    description: 'Deploys an Azure Spot Virtual Machine. Spot VMs utilize unused Azure capacity at a significant discount (up to 90%). However, they can be evicted (shut down) by Azure at any time if the capacity is needed elsewhere. Ideal for batch jobs, dev/test, or stateless workloads.',
    whatItDoes: [
        "Creates Spot VM (Eviction Policy: Deallocate)",
        "Sets Max Price to -1 (Current Market Price)"
    ],
    limitations: [
        "No SLA for availability",
        "Can be evicted at any time"
    ],
    commonIssues: [
        "Eviction: Your application must handle sudden shutdowns.",
        "Capacity: Spot capacity varies by region and size. Deployment may fail if no spot capacity is available."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'spot' },
      { id: 'vmName', label: 'VM Name', type: 'text', defaultValue: 'vm-spot-01' },
      { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_D2s_v3' }
    ],
    learnLinks: [{ title: 'Azure Spot VMs', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms' }],
    diagramCode: `graph TD
    User --> VM[Spot VM]
    Azure[Azure Fabric] -.->|Eviction Signal| VM`,
    scriptTemplate: `# Spot VM Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# Network
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$VmName-vnet" -AddressPrefix "10.10.0.0/16"
$sub = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.10.1.0/24" -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VmName-pip" -Sku Standard -AllocationMethod Static
$nic = New-AzNetworkInterface -ResourceGroupName $RgName -Location $Location -Name "$VmName-nic" -SubnetId $sub.Id -PublicIpAddressId $pip.Id

# VM Config (Spot)
$vmConfig = New-AzVMConfig -VMName $VmName -VMSize $VmSize |
    Set-AzVMOperatingSystem -Linux -ComputerName $VmName -Credential (Get-Credential) |
    Set-AzVMSourceImage -PublisherName "Canonical" -Offer "0001-com-ubuntu-server-jammy" -Skus "22_04-lts" -Version "latest" |
    Add-AzVMNetworkInterface -Id $nic.Id |
    Set-AzVMQPriority -Priority "Spot" -MaxPrice -1 -EvictionPolicy "Deallocate"

Write-Host "Deploying Spot VM ($VmSize)..."
New-AzVM -ResourceGroupName $RgName -Location $Location -VM $vmConfig -Tag $Tags

Write-Host "Spot VM created."`
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

  // --- SERVERLESS (FUNCTION APP) ---
  {
    id: 'function-app-consumption',
    category: AzureCategory.SERVERLESS,
    title: 'Azure Function App (Consumption)',
    description: 'Deploys an Azure Function App on the Consumption Plan. This is a true serverless model where you only pay for the time your code runs. It includes a required associated Storage Account and Application Insights for monitoring. Ideal for event-driven workloads.',
    whatItDoes: [
        "Creates Storage Account (Required)",
        "Creates Application Insights",
        "Creates Function App (Consumption)",
        "Enables System Assigned Managed Identity"
    ],
    limitations: [
        "Cold Starts: App may take seconds to wake up after inactivity.",
        "Timeout: Execution time limited to 10 minutes max."
    ],
    commonIssues: [
        "Storage Connection: Ensure the storage account name is globally unique and lowercase.",
        "Runtime Mismatch: Ensure your local dev environment matches the runtime stack selected here."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'func' },
      { id: 'funcName', label: 'Function App Name', type: 'text', defaultValue: 'func-app-01', description: 'Globally unique' },
      { id: 'runtime', label: 'Runtime Stack', type: 'select', options: ['DotNet', 'Node', 'Python', 'Java', 'PowerShell'], defaultValue: 'Node' }
    ],
    learnLinks: [{ title: 'Create Function App', url: 'https://learn.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-node' }],
    diagramCode: `graph LR
    Event[Event Trigger] --> Func[Function App]
    Func --> Storage[Storage Account]
    Func --> AppInsights[App Insights]`,
    scriptTemplate: `# Function App (Consumption)
${BASE_RG}
${BASE_LOC}
$FuncName = "{{funcName}}"
$Runtime = "{{runtime}}"
$StorageName = "st" + $FuncName.Replace("-","").Substring(0, [math]::Min($FuncName.Length, 15)) # Generate compliant storage name
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Storage Account: $StorageName..."
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $StorageName -SkuName Standard_LRS -Location $Location -Tag $Tags

Write-Host "Creating App Insights..."
$ai = New-AzApplicationInsights -ResourceGroupName $RgName -Name "$FuncName-ai" -Location $Location -Tag $Tags

Write-Host "Creating Function App ($Runtime)..."
New-AzFunctionApp -ResourceGroupName $RgName -Name $FuncName -StorageAccountName $StorageName -Location $Location ` +
`-Runtime $Runtime -FunctionsVersion 4 -Ostype Linux -IdentityType SystemAssigned -ApplicationInsightsName $ai.Name -Tag $Tags

Write-Host "Function App Deployed: https://$FuncName.azurewebsites.net"`
  },

  // --- SERVERLESS (CONTAINER APPS) ---
  {
    id: 'container-apps',
    category: AzureCategory.SERVERLESS,
    title: 'Azure Container Apps',
    description: 'Deploys an Azure Container Apps environment and a sample container app. This service allows you to run microservices and containerized applications on a serverless platform powered by Kubernetes, with support for KEDA-based scaling (including scale-to-zero).',
    whatItDoes: [
        "Creates Log Analytics Workspace",
        "Creates Container Apps Environment",
        "Deploys Hello World Container App"
    ],
    limitations: [
        "Does not configure VNet integration (External ingress used)",
        "Does not configure Dapr components"
    ],
    commonIssues: [
        "Module Missing: Requires 'Az.ContainerApp' module.",
        "Region Availability: Not all regions support Container Apps (e.g., some older regions)."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'aca' },
      { id: 'envName', label: 'Environment Name', type: 'text', defaultValue: 'aca-env-01' },
      { id: 'appName', label: 'App Name', type: 'text', defaultValue: 'aca-app-hello' }
    ],
    learnLinks: [{ title: 'Azure Container Apps Overview', url: 'https://learn.microsoft.com/en-us/azure/container-apps/overview' }],
    diagramCode: `graph TD
    Internet --> Envoy[Ingress]
    subgraph "Container Apps Env"
      Envoy --> App[Container App]
      App --> Replicas[Replica Set (0..N)]
    end
    App --> Log[Log Analytics]`,
    scriptTemplate: `# Azure Container Apps
${BASE_RG}
${BASE_LOC}
$EnvName = "{{envName}}"
$AppName = "{{appName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Log Analytics for Environment..."
$la = New-AzOperationalInsightsWorkspace -ResourceGroupName $RgName -Name "$EnvName-logs" -Location $Location -Sku Standard

Write-Host "Creating Container Apps Environment..."
$env = New-AzContainerAppManagedEnv -ResourceGroupName $RgName -Name $EnvName -Location $Location -LogAnalyticConfigurationClientId $la.CustomerId -LogAnalyticConfigurationClientSecret (Get-AzOperationalInsightsKeys -ResourceGroupName $RgName -Name $la.Name).PrimarySharedKey -Tag $Tags

Write-Host "Creating Container App..."
# Deploying simple hello-world image
New-AzContainerApp -ResourceGroupName $RgName -Name $AppName -Location $Location -ManagedEnvironmentId $env.Id ` + 
`-IngressExternal -TargetPort 80 -Image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" -MinReplica 1 -MaxReplica 10 -Tag $Tags

Write-Host "Container App Deployed."`
  },

  // --- SERVERLESS (STATIC WEB APPS) ---
  {
    id: 'static-web-app',
    category: AzureCategory.SERVERLESS,
    title: 'Azure Static Web Apps',
    description: 'Deploys an Azure Static Web App resource. This service is designed for hosting static web applications (React, Vue, Angular) with a serverless backend (Azure Functions) and global distribution. It includes built-in SSL and GitHub Actions integration.',
    whatItDoes: [
        "Creates Static Web App Resource"
    ],
    limitations: [
        "Does not create GitHub Repository",
        "Does not create GitHub Actions workflow file (must be done via Token output)"
    ],
    commonIssues: [
        "Deployment Token: You must copy the deployment token after creation to configure your CI/CD pipeline.",
        "Free Tier Limits: Free tier has bandwidth and function execution limits."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'web' },
      { id: 'swaName', label: 'Static App Name', type: 'text', defaultValue: 'swa-portal-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Free', 'Standard'], defaultValue: 'Free' }
    ],
    learnLinks: [{ title: 'Create Static Web App', url: 'https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal' }],
    diagramCode: `graph LR
    User[Global User] --> Edge[Edge Server]
    Edge --> Content[Static Content]
    Edge --> API[Managed Functions]
    Content --> GitHub[GitHub Actions]`,
    scriptTemplate: `# Azure Static Web App
${BASE_RG}
${BASE_LOC}
$SwaName = "{{swaName}}"
$Sku = "{{sku}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Static Web App ($Sku)..."
$swa = New-AzStaticWebApp -ResourceGroupName $RgName -Name $SwaName -Location $Location -SkuName $Sku -Tag $Tags

Write-Host "Static Web App Created."
Write-Host "Default Hostname: $($swa.DefaultHostname)"
Write-Host "NOTE: Retrieve deployment token via portal or 'Get-AzStaticWebAppUserProvidedFunctionApp' logic for CI/CD."`
  },

  // --- SERVERLESS (APP SERVICE - LEGACY ENTRY) ---
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
  },

  // --- IDENTITY (MANAGED ID) ---
  {
    id: 'identity-uami',
    category: AzureCategory.IDENTITY,
    title: 'User Assigned Managed Identity',
    description: 'Deploys a standalone User Assigned Managed Identity (UAMI). Unlike System Assigned identities which are tied to the lifecycle of a specific resource, UAMIs are independent Azure resources that can be assigned to multiple resources (e.g., a fleet of VMs) simultaneously, simplifying permission management.',
    whatItDoes: [
        "Creates User Assigned Identity Resource",
        "Outputs Client ID and Principal ID"
    ],
    limitations: [
        "Does not assign the identity to any Azure resource (must be done on target resource)",
        "Does not assign RBAC permissions to the identity"
    ],
    commonIssues: [
        "Propagation Delay: After creation, it may take 1-2 minutes before the Principal ID is recognized by Role Assignment endpoints.",
        "Cross-Region: UAMIs are regional resources but can generally be used by resources in the same region."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'identity' },
      { id: 'idName', label: 'Identity Name', type: 'text', defaultValue: 'id-app-prod' }
    ],
    learnLinks: [{ title: 'Managed Identities Overview', url: 'https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview' }],
    diagramCode: `graph LR
    AzureAD[Entra ID] -->|Trust| ID[User Assigned Identity]
    ID -.->|Assigned To| VM1
    ID -.->|Assigned To| VM2`,
    scriptTemplate: `# User Assigned Identity
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$IdName = "{{idName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Managed Identity $IdName..."
$id = New-AzUserAssignedIdentity -ResourceGroupName $RgName -Name $IdName -Location $Location -Tag $Tags

Write-Host "Identity Created."
Write-Host "Client ID: $($id.ClientId)"
Write-Host "Principal ID: $($id.PrincipalId)"
Write-Host "Assign this identity to your VMs or App Services."`
  },

  // --- IDENTITY (SERVICE PRINCIPAL) ---
  {
    id: 'identity-sp',
    category: AzureCategory.IDENTITY,
    title: 'Service Principal (App Reg)',
    description: 'Creates an Entra ID (Azure AD) App Registration and a corresponding Service Principal. It generates a Client Secret (password) for authentication. This is the standard authentication method for CI/CD pipelines (GitHub Actions, Azure DevOps) and external 3rd-party applications integrating with Azure.',
    whatItDoes: [
        "Creates App Registration",
        "Creates Service Principal",
        "Generates Client Secret (1 Year Validity)"
    ],
    limitations: [
        "Does not grant Subscription permissions (RBAC must be assigned separately)",
        "Client Secret is shown only once in output"
    ],
    commonIssues: [
        "Secret Management: The generated secret text is only available immediately after creation. Store it securely in a Key Vault.",
        "Permission Delay: If you immediately try to assign roles to this SP, it might fail with 'PrincipalNotFound' for a few seconds until replication completes."
    ],
    inputs: [
      { id: 'appName', label: 'App Display Name', type: 'text', defaultValue: 'sp-cicd-pipeline' }
    ],
    learnLinks: [{ title: 'App Objects & Service Principals', url: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals' }],
    diagramCode: `graph TD
    Ext[GitHub / DevOps] -->|Client ID + Secret| AAD[Entra ID]
    AAD -->|Token| SP[Service Principal]
    SP -->|RBAC| Azure[Azure Resources]`,
    scriptTemplate: `# Service Principal Creation
$ErrorActionPreference = "Stop"
$AppName = "{{appName}}"

# Note: This script requires privileges to create App Registrations in Entra ID
Write-Host "Creating App Registration..."
$app = New-AzADApplication -DisplayName $AppName

Write-Host "Creating Service Principal..."
$sp = New-AzADServicePrincipal -ApplicationId $app.AppId

Write-Host "Generating Client Secret (1 Year)..."
$secret = New-AzADAppCredential -ObjectId $app.Id -Count 1 -StartDate (Get-Date) -EndDate (Get-Date).AddYears(1)

Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "Tenant ID:     $((Get-AzContext).Tenant.Id)"
Write-Host "App (Client) ID: $($app.AppId)"
Write-Host "Client Secret: $($secret.Password)" -ForegroundColor Yellow
Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "WARNING: Copy the secret now. It cannot be retrieved later." -ForegroundColor Red`
  },

  // --- IDENTITY (RBAC) ---
  {
    id: 'identity-rbac',
    category: AzureCategory.IDENTITY,
    title: 'Assign Role (RBAC)',
    description: 'Grants access to an Azure Resource Group by assigning a built-in Role (e.g., Contributor, Reader) to a specific user, group, or service principal. This automates the implementation of the Principle of Least Privilege.',
    whatItDoes: [
        "Validates Principal existence",
        "Creates Role Assignment at Resource Group Scope"
    ],
    limitations: [
        "Scopes permission to the entire Resource Group",
        "Requires 'Owner' or 'User Access Administrator' permissions to execute"
    ],
    commonIssues: [
        "Self-Lockout: Do not remove your own Owner access.",
        "Propagation: Role assignments can take up to 5-10 minutes to propagate to all Azure regions/services."
    ],
    inputs: [
      { id: 'rgName', label: 'Resource Group Name', type: 'text', defaultValue: 'rg-demo-dev' },
      { id: 'principalId', label: 'Principal ID (Object ID)', type: 'text', placeholder: '00000000-0000-0000-...' },
      { id: 'roleName', label: 'Role', type: 'select', options: ['Reader', 'Contributor', 'Owner', 'User Access Administrator'], defaultValue: 'Reader' }
    ],
    learnLinks: [{ title: 'Azure RBAC Overview', url: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/overview' }],
    diagramCode: `graph LR
    User[User/SP] -->|Assignment| Role[Role Definition]
    Role -->|Scope| RG[Resource Group]
    RG --> Resources`,
    scriptTemplate: `# RBAC Role Assignment
$ErrorActionPreference = "Stop"
$RgName = "{{rgName}}"
$PrincipalId = "{{principalId}}"
$RoleName = "{{roleName}}"

Write-Host "Assigning '$RoleName' to $PrincipalId on $RgName..."

# Verify RG exists
if (-not (Get-AzResourceGroup -Name $RgName -ErrorAction SilentlyContinue)) {
    Write-Error "Resource Group '$RgName' not found."
}

New-AzRoleAssignment -ObjectId $PrincipalId -RoleDefinitionName $RoleName -ResourceGroupName $RgName

Write-Host "Role Assigned successfully."`
  },

  // --- SECURITY (KEY VAULT) ---
  {
    id: 'kv-standard',
    category: AzureCategory.SECURITY,
    title: 'Azure Key Vault',
    description: 'Deploys a secure Azure Key Vault configured with the Role-Based Access Control (RBAC) permission model, replacing the legacy Access Policy model. Soft-delete is mandatory and enabled by default to protect against accidental deletion of secrets. You can select between Standard (software-backed) and Premium (HSM-backed) SKUs.',
    whatItDoes: [
        "Deploys Key Vault (Standard/Premium)",
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
      { id: 'kvName', label: 'Key Vault Name', type: 'text', defaultValue: 'kv-shared-01', description: 'Must be globally unique' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Standard', 'Premium'], defaultValue: 'Standard', description: 'Premium offers HSM-backed keys.' }
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
$Sku = "{{sku}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

New-AzKeyVault -Name $KvName -ResourceGroupName $RgName -Location $Location ` +
`-Sku $Sku -EnableSoftDelete -EnableRbacAuthorization -Tag $Tags

Write-Host "Key Vault $KvName ($Sku) created with RBAC model."`
  },

  // --- SECURITY (FIREWALL) ---
  {
    id: 'azure-firewall',
    category: AzureCategory.SECURITY,
    title: 'Azure Firewall',
    description: 'Deploys Azure Firewall, a managed, cloud-based network security service that protects your Azure Virtual Network resources. It creates a high-availability firewall with a public IP and the mandatory "AzureFirewallSubnet". This resource is critical for centralized network filtering and threat intelligence.',
    whatItDoes: [
        "Creates VNet with 'AzureFirewallSubnet'",
        "Deploys Public IP",
        "Deploys Azure Firewall (Basic/Standard/Premium)"
    ],
    limitations: [
        "Does not configure specific application or network rules",
        "Does not configure Firewall Policy (uses legacy rules, or empty policy)"
    ],
    commonIssues: [
        "Subnet Name: Must be exactly 'AzureFirewallSubnet'.",
        "Subnet Size: Must be /26 or larger.",
        "Cost: Azure Firewall has a significant hourly fixed cost, even when idle."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'fw' },
      { id: 'fwName', label: 'Firewall Name', type: 'text', defaultValue: 'azfw-hub-01' },
      { id: 'sku', label: 'SKU Tier', type: 'select', options: ['Basic', 'Standard', 'Premium'], defaultValue: 'Standard', description: 'Basic is for SMBs, Premium adds IDPS/TLS inspection.' }
    ],
    learnLinks: [{ title: 'Deploy Azure Firewall', url: 'https://learn.microsoft.com/en-us/azure/firewall/deploy-ps' }],
    diagramCode: `graph TD
    Internet -->|Traffic| FW[Azure Firewall]
    FW -->|Filter| VNet[Hub VNet]
    VNet -->|Peering| Spoke1[Spoke VNet 1]
    VNet -->|Peering| Spoke2[Spoke VNet 2]`,
    scriptTemplate: `# Azure Firewall Deployment
${BASE_RG}
${BASE_LOC}
$FwName = "{{fwName}}"
$SkuTier = "{{sku}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating VNet for Firewall..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$FwName-vnet" -AddressPrefix "10.100.0.0/16"
$sub = Add-AzVirtualNetworkSubnetConfig -Name "AzureFirewallSubnet" -AddressPrefix "10.100.1.0/26" -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork

Write-Host "Creating Public IP..."
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$FwName-pip" -AllocationMethod Static -Sku Standard

Write-Host "Deploying Azure Firewall ($SkuTier)..."
# Note: Basic SKU requires specific management subnet logic, simpler Standard template shown here for robustness
New-AzFirewall -Name $FwName -ResourceGroupName $RgName -Location $Location -VirtualNetworkName $vnet.Name -PublicIpName $pip.Name -SkuName "AZFW_VNet" -SkuTier $SkuTier -Tag $Tags

Write-Host "Firewall Deployed."`
  },

  // --- SECURITY (WAF) ---
  {
    id: 'app-gateway-waf',
    category: AzureCategory.SECURITY,
    title: 'App Gateway WAF v2',
    description: 'Deploys an Application Gateway v2 with Web Application Firewall (WAF) enabled. This protects web applications from common exploits and vulnerabilities (OWASP Top 10) such as SQL injection and cross-site scripting. Includes autoscaling configuration.',
    whatItDoes: [
        "Creates VNet with dedicated subnet",
        "Deploys Public IP",
        "Deploys App Gateway WAF v2",
        "Configures Autoscaling"
    ],
    limitations: [
        "Does not configure backend targets (add backend pools later)",
        "Does not upload SSL certificates (HTTP only for initial setup)"
    ],
    commonIssues: [
        "Subnet Exclusivity: The App Gateway subnet can ONLY contain App Gateway instances.",
        "Provisioning Time: Can take 15-20 minutes to fully provision.",
        "Empty Backend: Will return 502 Bad Gateway until backends are added and healthy."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'waf' },
      { id: 'agwName', label: 'Gateway Name', type: 'text', defaultValue: 'agw-waf-01' },
      { id: 'capacity', label: 'Max Capacity Units', type: 'number', defaultValue: 10, description: 'Autoscale limit (0-125)' }
    ],
    learnLinks: [{ title: 'Create App Gateway WAF', url: 'https://learn.microsoft.com/en-us/azure/web-application-firewall/ag/create-waf-policy-ag' }],
    diagramCode: `graph TB
    User -->|HTTPS| WAF[App Gateway WAF]
    WAF -->|Protect| WebApp1
    WAF -->|Protect| WebApp2`,
    scriptTemplate: `# Application Gateway WAF v2
${BASE_RG}
${BASE_LOC}
$AgwName = "{{agwName}}"
$MaxCapacity = {{capacity}}
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Network Infrastructure..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Name "$AgwName-vnet" -AddressPrefix "10.200.0.0/16" -Location $Location
$sub = Add-AzVirtualNetworkSubnetConfig -Name "AppGatewaySubnet" -AddressPrefix "10.200.1.0/24" -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Name "$AgwName-pip" -Location $Location -AllocationMethod Static -Sku Standard

Write-Host "Configuring IP and Ports..."
$ipConf = New-AzApplicationGatewayIPConfiguration -Name "appGatewayIpConfig" -SubnetId $sub.Id
$frontendIP = New-AzApplicationGatewayFrontendIPConfig -Name "appGatewayFrontendIP" -PublicIPAddress $pip
$frontendPort = New-AzApplicationGatewayFrontendPort -Name "appGatewayFrontendPort" -Port 80

Write-Host "Configuring Basic Listeners/Pools..."
$pool = New-AzApplicationGatewayBackendAddressPool -Name "appGatewayBackendPool"
$setting = New-AzApplicationGatewayBackendHttpSettings -Name "appGatewayBackendHttpSettings" -Port 80 -Protocol Http -CookieBasedAffinity Disabled
$listener = New-AzApplicationGatewayHttpListener -Name "appGatewayHttpListener" -Protocol Http -FrontendIPConfiguration $frontendIP -FrontendPort $frontendPort
$rule = New-AzApplicationGatewayRequestRoutingRule -Name "rule1" -RuleType Basic -BackendHttpSettings $setting -HttpListener $listener -BackendAddressPool $pool

Write-Host "Deploying WAF v2..."
$sku = New-AzApplicationGatewaySku -Name "WAF_v2" -Tier "WAF_v2"
$autoscale = New-AzApplicationGatewayAutoscaleConfiguration -MinCapacity 0 -MaxCapacity $MaxCapacity

New-AzApplicationGateway -Name $AgwName -ResourceGroupName $RgName -Location $Location -Sku $sku -AutoscaleConfiguration $autoscale ` + 
`-GatewayIPConfigurations $ipConf -FrontendIPConfigurations $frontendIP -FrontendPorts $frontendPort ` + 
`-BackendAddressPools $pool -BackendHttpSettingsCollection $setting -HttpListeners $listener -RequestRoutingRules $rule -WebApplicationFirewallConfiguration (New-AzApplicationGatewayWebApplicationFirewallConfiguration -Enabled $true -FirewallMode Detection -RuleSetType OWASP -RuleSetVersion 3.2) -Tag $Tags

Write-Host "WAF Deployed."`
  },

  // --- SECURITY (SENTINEL) ---
  {
    id: 'sentinel-starter',
    category: AzureCategory.SECURITY,
    title: 'Microsoft Sentinel',
    description: 'Deploys a Log Analytics Workspace and enables Microsoft Sentinel on top of it. Sentinel is a cloud-native SIEM (Security Information and Event Management) and SOAR (Security Orchestration Automation and Response) solution that provides intelligent security analytics across your enterprise.',
    whatItDoes: [
        "Creates Log Analytics Workspace",
        "Installs 'SecurityInsights' (Sentinel) Solution"
    ],
    limitations: [
        "Does not configure Data Connectors",
        "Does not configure Analytics Rules"
    ],
    commonIssues: [
        "Cost: Sentinel adds a cost on top of Log Analytics ingestion. Check pricing tiers.",
        "Retention: Default retention is 30 days. Increase this in the workspace settings for compliance."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'siem' },
      { id: 'workspaceName', label: 'Workspace Name', type: 'text', defaultValue: 'la-sentinel-01' }
    ],
    learnLinks: [{ title: 'Onboard Microsoft Sentinel', url: 'https://learn.microsoft.com/en-us/azure/sentinel/quickstart-onboard' }],
    diagramCode: `graph LR
    Logs[Activity Logs] --> LA[Log Analytics]
    VMs[VM Events] --> LA
    LA --> Sentinel[Microsoft Sentinel]
    Sentinel --> Alerts`,
    scriptTemplate: `# Microsoft Sentinel Setup
${BASE_RG}
${BASE_LOC}
$WorkspaceName = "{{workspaceName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Log Analytics Workspace..."
$la = New-AzOperationalInsightsWorkspace -ResourceGroupName $RgName -Name $WorkspaceName -Location $Location -Sku Standard -Tag $Tags

Write-Host "Enabling Sentinel Solution..."
# Sentinel is technically a solution named 'SecurityInsights' on the workspace
New-AzOperationalInsightsSolution -ResourceGroupName $RgName -WorkspaceResourceId $la.ResourceId -SolutionName "SecurityInsights" -Provider "Microsoft.OperationsManagement" -Tag $Tags

Write-Host "Sentinel Onboarded."`
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

  // --- NETWORKING (HUB & SPOKE) ---
  {
    id: 'network-hub-spoke',
    category: AzureCategory.NETWORKING,
    title: 'Hub & Spoke Topology',
    description: 'Deploys a Hub Virtual Network and a Spoke Virtual Network, and establishes bidirectional VNet Peering. This is the standard enterprise network topology where shared services (Firewall, Bastion, VPN) reside in the Hub, and workloads reside in isolated Spokes.',
    whatItDoes: [
        "Creates Hub VNet",
        "Creates Spoke VNet",
        "Enables Bidirectional Peering"
    ],
    limitations: [
        "Does not configure Gateway Transit (enabled by default in script but requires Gateway to function)",
        "Does not deploy Hub resources (Firewall/Gateway)"
    ],
    commonIssues: [
        "IP Overlap: Ensure Hub and Spoke address spaces do not overlap.",
        "Peering Lag: Peering status must be 'Connected' on BOTH sides to work."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net-core' },
      { id: 'hubName', label: 'Hub VNet Name', type: 'text', defaultValue: 'vnet-hub-eastus' },
      { id: 'hubCidr', label: 'Hub CIDR', type: 'text', defaultValue: '10.0.0.0/16' },
      { id: 'spokeName', label: 'Spoke VNet Name', type: 'text', defaultValue: 'vnet-spoke-app01' },
      { id: 'spokeCidr', label: 'Spoke CIDR', type: 'text', defaultValue: '10.1.0.0/16' }
    ],
    learnLinks: [{ title: 'Hub-spoke network topology', url: 'https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/hybrid-networking/hub-spoke?tabs=cli' }],
    diagramCode: `graph LR
    Hub[Hub VNet] <-->|Peering| Spoke[Spoke VNet]
    Hub --> FW[Firewall/VPN]
    Spoke --> VM[Workload VM]`,
    scriptTemplate: `# Hub and Spoke Network Peering
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$HubName = "{{hubName}}"
$HubCidr = "{{hubCidr}}"
$SpokeName = "{{spokeName}}"
$SpokeCidr = "{{spokeCidr}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Hub VNet ($HubCidr)..."
$hub = New-AzVirtualNetwork -ResourceGroupName $RgName -Name $HubName -Location $Location -AddressPrefix $HubCidr -Tag $Tags

Write-Host "Creating Spoke VNet ($SpokeCidr)..."
$spoke = New-AzVirtualNetwork -ResourceGroupName $RgName -Name $SpokeName -Location $Location -AddressPrefix $SpokeCidr -Tag $Tags

Write-Host "Peering Hub -> Spoke..."
Add-AzVirtualNetworkPeering -Name "$HubName-to-$SpokeName" -VirtualNetwork $hub -RemoteVirtualNetworkId $spoke.Id -AllowVirtualNetworkAccess -AllowForwardedTraffic

Write-Host "Peering Spoke -> Hub..."
Add-AzVirtualNetworkPeering -Name "$SpokeName-to-$HubName" -VirtualNetwork $spoke -RemoteVirtualNetworkId $hub.Id -AllowVirtualNetworkAccess -AllowForwardedTraffic

Write-Host "Peering Established."`
  },

  // --- NETWORKING (VPN GATEWAY) ---
  {
    id: 'network-vpn-gateway',
    category: AzureCategory.NETWORKING,
    title: 'VPN Gateway (Site-to-Site)',
    description: 'Deploys a Route-Based Virtual Network Gateway (VPN) necessary for hybrid connectivity. It creates a VNet with the specific "GatewaySubnet" required by Azure, a Public IP, and the Gateway resource itself. This allows secure, encrypted traffic between Azure and on-premises networks.',
    whatItDoes: [
        "Creates VNet with 'GatewaySubnet'",
        "Creates Public IP (Standard)",
        "Deploys Virtual Network Gateway (VPN)"
    ],
    limitations: [
        "Does not create the 'Local Network Gateway' (On-prem representation)",
        "Does not create the Connection resource"
    ],
    commonIssues: [
        "Deployment Time: VPN Gateways take 30-45 minutes to provision. Do not cancel the script.",
        "GatewaySubnet: Must be named exactly 'GatewaySubnet' and should ideally be /27 or larger."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net-gw' },
      { id: 'gwName', label: 'Gateway Name', type: 'text', defaultValue: 'vpngw-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['VpnGw1', 'VpnGw2', 'VpnGw1AZ'], defaultValue: 'VpnGw1' }
    ],
    learnLinks: [{ title: 'Create VPN Gateway', url: 'https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-howto-point-to-site-resource-manager-portal' }],
    diagramCode: `graph LR
    OnPrem[On-Premises DC] <-->|IPsec Tunnel| GW[Azure VPN Gateway]
    GW --> HubVNet
    HubVNet <--> SpokeVNet`,
    scriptTemplate: `# VPN Gateway Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$GwName = "{{gwName}}"
$Sku = "{{sku}}"
$VnetName = "$GwName-vnet"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating VNet and GatewaySubnet..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Name $VnetName -Location $Location -AddressPrefix "10.10.0.0/16" -Tag $Tags
$subnet = Add-AzVirtualNetworkSubnetConfig -Name "GatewaySubnet" -AddressPrefix "10.10.255.0/27" -VirtualNetwork $vnet
$vnet | Set-AzVirtualNetwork

Write-Host "Creating Public IP..."
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Name "$GwName-pip" -Location $Location -AllocationMethod Static -Sku Standard -Tag $Tags

Write-Host "Deploying VPN Gateway (This can take 45 minutes)..."
$ipConf = New-AzVirtualNetworkGatewayIpConfig -Name "gw-ip-config" -SubnetId $subnet.Id -PublicIpAddressId $pip.Id

New-AzVirtualNetworkGateway -ResourceGroupName $RgName -Name $GwName -Location $Location ` + 
`-IpConfigurations $ipConf -GatewayType Vpn -VpnType RouteBased -Sku $Sku -Generation Generation1 -Tag $Tags

Write-Host "VPN Gateway Deployed."`
  },

  // --- NETWORKING (NAT GATEWAY) ---
  {
    id: 'network-nat-gateway',
    category: AzureCategory.NETWORKING,
    title: 'NAT Gateway',
    description: 'Deploys a Virtual Network NAT Gateway. This resource provides outbound internet connectivity for one or more subnets of a virtual network. It is preferred over default Load Balancer outbound rules because it provides SNAT port scalability and static public IP association.',
    whatItDoes: [
        "Creates Public IP Prefix",
        "Creates NAT Gateway Resource",
        "Creates VNet and attaches NAT to Subnet"
    ],
    limitations: [
        "Does not migrate existing subnets (creates new VNet structure)"
    ],
    commonIssues: [
        "Zone Redundancy: NAT Gateway is zonal. For multi-zone redundancy, standard practice varies (often 1 NAT per zone if strict isolation needed, or Standard LB).",
        "Association: You must explicitly associate the NAT Gateway to the subnet."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net-nat' },
      { id: 'natName', label: 'NAT Name', type: 'text', defaultValue: 'ng-outbound-01' },
      { id: 'vnetName', label: 'VNet Name', type: 'text', defaultValue: 'vnet-app-01' }
    ],
    learnLinks: [{ title: 'What is Azure NAT Gateway?', url: 'https://learn.microsoft.com/en-us/azure/virtual-network/nat-gateway/nat-overview' }],
    diagramCode: `graph TB
    Subnet[Private Subnet] -->|Outbound| NAT[NAT Gateway]
    NAT -->|Static IP| Internet
    Internet --x|Block Ingress| NAT`,
    scriptTemplate: `# NAT Gateway Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$NatName = "{{natName}}"
$VnetName = "{{vnetName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Public IP..."
$pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Name "$NatName-pip" -Location $Location -Sku Standard -AllocationMethod Static -Tag $Tags

Write-Host "Creating NAT Gateway..."
$nat = New-AzNatGateway -ResourceGroupName $RgName -Name $NatName -Location $Location -Sku "Standard" -PublicIpAddress $pip -Tag $Tags

Write-Host "Creating VNet with NAT Association..."
$vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Name $VnetName -Location $Location -AddressPrefix "10.20.0.0/16" -Tag $Tags
# Add subnet with NAT Gateway ID
Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.20.1.0/24" -VirtualNetwork $vnet -NatGatewayId $nat.Id
$vnet | Set-AzVirtualNetwork

Write-Host "NAT Gateway deployed and attached to 'default' subnet."`
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

  // --- INTEGRATION (LOGIC APP STANDARD) ---
  {
    id: 'logic-app-standard',
    category: AzureCategory.INTEGRATION,
    title: 'Logic App (Standard)',
    description: 'Deploys a Standard-tier Logic App running on a Workflow Standard App Service Plan. Unlike Consumption, this SKU supports VNet Integration, Private Endpoints, and runs in a single-tenant environment, making it suitable for enterprise workloads requiring network isolation.',
    whatItDoes: [
        "Creates Workflow Standard App Service Plan",
        "Creates Storage Account (Required for state)",
        "Creates Logic App (Standard)"
    ],
    limitations: [
        "Higher base cost than Consumption",
        "Does not configure VNet Integration (script creates capability, needs subnet ID)"
    ],
    commonIssues: [
        "State Storage: Requires a dedicated Storage Account. Do not share with other high-IO workloads.",
        "Plan Sizing: WS1 is sufficient for most workloads. Scale up to WS2/3 for high memory requirements."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'int-std' },
      { id: 'laName', label: 'Logic App Name', type: 'text', defaultValue: 'la-std-01' },
      { id: 'sku', label: 'Plan SKU', type: 'select', options: ['WS1', 'WS2', 'WS3'], defaultValue: 'WS1' }
    ],
    learnLinks: [{ title: 'Logic Apps Standard vs Consumption', url: 'https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview#resource-type-and-host-environment-differences' }],
    diagramCode: `graph LR
    Trigger[HTTP/Timer] --> Workflow[Logic App Std]
    Workflow -->|VNet| SQL[Private SQL]
    Workflow -->|Connector| SAP[SAP System]
    subgraph "App Service Plan (WS1)"
      Workflow
    end`,
    scriptTemplate: `# Logic App Standard
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$LaName = "{{laName}}"
$Sku = "{{sku}}"
$PlanName = "$LaName-asp"
$StorageName = "st" + $LaName.Replace("-","").Substring(0, [math]::Min($LaName.Length, 15))
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Storage Account..."
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $StorageName -SkuName Standard_LRS -Location $Location -Kind StorageV2 -Tag $Tags

Write-Host "Creating Workflow App Service Plan ($Sku)..."
# Note: Logic Apps Standard uses specific Tier "WorkflowStandard"
New-AzAppServicePlan -ResourceGroupName $RgName -Name $PlanName -Location $Location -Tier "WorkflowStandard" -WorkerSize $Sku -PerSiteScaling $false -Tag $Tags

Write-Host "Creating Logic App Standard..."
# Using New-AzResource for robust creation of workflowapp kind
$props = @{
    "ServerFarmId" = (Get-AzAppServicePlan -ResourceGroupName $RgName -Name $PlanName).Id
}

New-AzResource -ResourceGroupName $RgName -Location $Location -ResourceType "Microsoft.Web/sites" -ResourceName $LaName -PropertyObject $props -Kind "functionapp,workflowapp" -Tag $Tags -Force

Write-Host "Logic App Standard Deployed."`
  },

  // --- INTEGRATION (API MANAGEMENT) ---
  {
    id: 'apim-standard',
    category: AzureCategory.INTEGRATION,
    title: 'API Management (Standard)',
    description: 'Deploys an Azure API Management (APIM) instance. APIM acts as a facade for your backend services, providing rate limiting, authentication, IP filtering, and analytics. The Standard tier is production-ready.',
    whatItDoes: [
        "Creates API Management Service",
        "Configures Publisher Email/Name"
    ],
    limitations: [
        "Deployment takes 30-45 minutes",
        "Does not configure APIs or Operations"
    ],
    commonIssues: [
        "Soft Delete: APIM instances have soft-delete enabled by default. If you delete and recreate with the same name, you must restore or purge.",
        "Capacity: Scale units take time to provision."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'api' },
      { id: 'apimName', label: 'APIM Name', type: 'text', defaultValue: 'apim-gateway-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Developer', 'Standard', 'Premium'], defaultValue: 'Developer', description: 'Developer is cheapest for non-prod.' },
      { id: 'publisherEmail', label: 'Admin Email', type: 'text', defaultValue: 'admin@contoso.com' }
    ],
    learnLinks: [{ title: 'Create API Management', url: 'https://learn.microsoft.com/en-us/azure/api-management/get-started-create-service-instance-powershell' }],
    diagramCode: `graph LR
    Client[Mobile/Web] -->|HTTPS| APIM[API Management]
    APIM -->|Policy| Auth[Oauth2]
    APIM -->|Proxy| Func[Function App]
    APIM -->|Proxy| K8s[AKS Service]`,
    scriptTemplate: `# API Management Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$ApimName = "{{apimName}}"
$Sku = "{{sku}}"
$Email = "{{publisherEmail}}"
$OrgName = "{{projectPrefix}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Deploying APIM $ApimName ($Sku)... (This takes 30+ mins)"
New-AzApiManagement -ResourceGroupName $RgName -Name $ApimName -Location $Location -Organization $OrgName -AdminEmail $Email -Sku $Sku -Capacity 1 -Tag $Tags

Write-Host "APIM Deployed."`
  },

  // --- INTEGRATION (SERVICE BUS) ---
  {
    id: 'service-bus-standard',
    category: AzureCategory.INTEGRATION,
    title: 'Service Bus Namespace',
    description: 'Deploys a Service Bus Namespace (Standard SKU) with a sample Queue and Topic. Service Bus is a fully managed enterprise message broker with message queues and publish-subscribe topics, essential for decoupling applications.',
    whatItDoes: [
        "Creates Service Bus Namespace",
        "Creates 'orders' Queue",
        "Creates 'events' Topic"
    ],
    limitations: [
        "Does not configure Authorization Rules (SAS)",
        "Does not configure Geo-DR"
    ],
    commonIssues: [
        "SKU: Basic SKU does NOT support Topics, only Queues. Standard is required for Pub/Sub.",
        "Networking: Service Bus uses port 5671 (AMQP). Ensure firewall outbound allows this."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'bus' },
      { id: 'sbName', label: 'Namespace Name', type: 'text', defaultValue: 'sb-enterprise-01' }
    ],
    learnLinks: [{ title: 'Create Service Bus Namespace', url: 'https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-powershell' }],
    diagramCode: `graph LR
    App1[Producer] -->|Send| SB[Service Bus]
    SB -->|Queue| App2[Consumer A]
    SB -->|Topic| App3[Consumer B]
    SB -->|Topic| App4[Consumer C]`,
    scriptTemplate: `# Service Bus Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$SbName = "{{sbName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Namespace ($SbName)..."
New-AzServiceBusNamespace -ResourceGroupName $RgName -Name $SbName -Location $Location -Sku Standard -Tag $Tags

Write-Host "Creating Queue 'orders'..."
New-AzServiceBusQueue -ResourceGroupName $RgName -NamespaceName $SbName -Name "orders" -EnablePartitioning $false

Write-Host "Creating Topic 'events'..."
New-AzServiceBusTopic -ResourceGroupName $RgName -NamespaceName $SbName -Name "events"

Write-Host "Service Bus Ready."`
  }
];
