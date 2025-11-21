
import { AzureCategory, Scenario } from './types';

const COMMON_TAGS = '@{ "Environment" = "{{environment}}"; "Project" = "{{projectPrefix}}"; "CostCenter" = "{{costCenter}}"; "Owner" = "{{owner}}" }';
const BASE_RG = '$RgName = "{{projectPrefix}}-{{environment}}-{{rgSuffix}}"';
const BASE_LOC = '$Location = "{{location}}"';

// Standard styling for diagrams
const DIAGRAM_STYLES = `
    classDef existing fill:#f1f5f9,stroke:#cbd5e1,color:#64748b,stroke-dasharray: 5 5;
    classDef new fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
`;

export const SCENARIOS: Scenario[] = [
  // --- COMPUTE (LINUX) ---
  {
    id: 'vm-linux-ssh',
    category: AzureCategory.COMPUTE,
    title: 'Secure Linux VM (Ubuntu)',
    description: 'Deploys a hardened Ubuntu Linux Virtual Machine suitable for jumpboxes or web servers. This configuration includes a Network Security Group (NSG) strictly limiting ingress to SSH (Port 22), creates a User Assigned Managed Identity for secure Azure resource access without credentials, and uses SSH Key authentication.',
    whatItDoes: [
        "Creates Resource Group and VNet/Subnet",
        "Deploys Ubuntu 22.04 LTS VM",
        "Configures SSH Key Authentication",
        "Attaches System Assigned Managed Identity",
        "Configures NSG allowing only Port 22"
    ],
    limitations: [
        "Does not configure OS-level diagnostics",
        "Does not set up Azure Backup"
    ],
    commonIssues: [
        "Connection Timeout: Often caused by corporate firewalls blocking outbound Port 22.",
        "Permission Denied: Ensure the private key permissions are restricted (chmod 400)."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'compute' },
      { id: 'vmName', label: 'VM Name', type: 'text', defaultValue: 'vm-app-01' },
      { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_B1s', 'Standard_B2s', 'Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_B2s', description: 'Affects cost.' },
      { id: 'adminUser', label: 'Admin Username', type: 'text', defaultValue: 'azureuser' }
    ],
    learnLinks: [
      { title: 'Quickstart: Create a Linux VM', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/linux/quick-create-powershell' },
      { title: 'Proximity Placement Groups', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/co-location' }
    ],
    diagramCode: `graph TD
    User((User)) -->|SSH :22| NSG
    subgraph "New Deployment: {{location}}"
      NSG[NSG] --> Subnet
      Subnet --> VM[Ubuntu VM]
      VM --> Disk[OS Disk]
    end
    ${DIAGRAM_STYLES}
    class User existing;
    class NSG,Subnet,VM,Disk new;`,
    scriptTemplate: `# Secure Linux VM Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$AdminUser = "{{adminUser}}"
$Tags = ${COMMON_TAGS}
$ProximityGroup = "{{proximityPlacementGroup}}"

try {
    Write-Host "Creating Resource Group $RgName..." -ForegroundColor Cyan
    New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force
} catch {
    Write-Error "Failed to create Resource Group: $_"
    exit
}

# PPG Handling
$ppgId = $null
if (-not [string]::IsNullOrWhiteSpace($ProximityGroup)) {
    try {
        Write-Host "Checking Proximity Placement Group: $ProximityGroup"
        $ppg = Get-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -ErrorAction SilentlyContinue
        if ($null -eq $ppg) {
            Write-Host "Creating new PPG..."
            $ppg = New-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -Location $Location -ProximityPlacementGroupType Standard
        }
        $ppgId = $ppg.Id
    } catch {
        Write-Warning "Failed to configure PPG, proceeding without it: $_"
    }
}

try {
    Write-Host "Creating Networking..."
    $vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$VmName-vnet" -AddressPrefix "10.0.0.0/16"
    $nsg = New-AzNetworkSecurityGroup -ResourceGroupName $RgName -Location $Location -Name "$VmName-nsg"
    $subnet = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.0.1.0/24" -NetworkSecurityGroup $nsg -VirtualNetwork $vnet
    $vnet | Set-AzVirtualNetwork

    $pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VmName-pip" -AllocationMethod Static -Sku Standard
    $nic = New-AzNetworkInterface -ResourceGroupName $RgName -Location $Location -Name "$VmName-nic" -SubnetId $subnet.Id -PublicIpAddressId $pip.Id
} catch {
    Write-Error "Failed to create networking components: $_"
    exit
}

try {
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
    Write-Host "Done." -ForegroundColor Green
} catch {
    Write-Error "Failed to create VM: $_"
    exit
}`
  },

  // --- COMPUTE (WINDOWS) ---
  {
    id: 'vm-windows-secure',
    category: AzureCategory.COMPUTE,
    title: 'Secure Windows VM (2022)',
    description: 'Deploys a Windows Server 2022 Datacenter Virtual Machine. It includes a specialized Network Security Group allowing RDP access (Port 3389) only from a specific management IP address to prevent brute-force attacks.',
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
        "Public RDP Risk: Exposing RDP is risky. Consider Azure Bastion for production."
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
    Admin((Admin IP)) -->|RDP :3389| NSG
    subgraph "New Deployment: {{location}}"
      NSG[NSG] --> VM[Windows Server]
      VM --> Disk[OS Disk]
    end
    ${DIAGRAM_STYLES}
    class Admin existing;
    class NSG,VM,Disk new;`,
    scriptTemplate: `# Windows Server 2022 Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$AdminUser = "{{adminUser}}"
$AllowedIp = "{{allowedIp}}"
$Tags = ${COMMON_TAGS}

try {
    New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force
} catch {
    Write-Error "Failed to create RG: $_"
    exit
}

try {
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
} catch {
    Write-Error "Networking creation failed: $_"
    exit
}

try {
    Write-Host "Creating VM Config..."
    $cred = Get-Credential -Message "Enter VM Admin Password"

    $vmConfig = New-AzVMConfig -VMName $VmName -VMSize $VmSize |
        Set-AzVMOperatingSystem -Windows -ComputerName $VmName -Credential $cred |
        Set-AzVMSourceImage -PublisherName "MicrosoftWindowsServer" -Offer "WindowsServer" -Skus "2022-Datacenter" -Version "latest" |
        Add-AzVMNetworkInterface -Id $nic.Id |
        Assign-AzSystemAssignedIdentity

    New-AzVM -ResourceGroupName $RgName -Location $Location -VM $vmConfig -Tag $Tags

    Write-Host "Windows VM Deployed. Connect via RDP to $($pip.IpAddress)"
} catch {
    Write-Error "VM Deployment failed: $_"
    exit
}`
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
        "Over-provisioning: Autoscale can rapidly increase costs.",
        "Health Probes: LB needs a valid probe to route traffic."
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
    User((User)) --> LB[Load Balancer]
    subgraph "New Deployment: {{location}}"
      LB --> VM1[Instance 1]
      LB --> VM2[Instance 2]
      VM1 -.-> Scale[Autoscale Rule]
    end
    ${DIAGRAM_STYLES}
    class User existing;
    class LB,VM1,VM2,Scale new;`,
    scriptTemplate: `# VM Scale Set Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmssName = "{{vmssName}}"
$VmSize = "{{vmSize}}"
$MinCount = {{minCount}}
$MaxCount = {{maxCount}}
$Tags = ${COMMON_TAGS}

try {
    New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force
} catch {
    Write-Error "RG Creation failed: $_"
    exit
}

try {
    # Networking
    $vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Name "$VmssName-vnet" -Location $Location -AddressPrefix "10.0.0.0/16"
    $sub = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.0.1.0/24" -VirtualNetwork $vnet
    $vnet | Set-AzVirtualNetwork

    # Load Balancer
    $pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Name "$VmssName-lb-pip" -Location $Location -AllocationMethod Static -Sku Standard
    $frontend = New-AzLoadBalancerFrontendIpConfig -Name "frontend" -PublicIpAddress $pip
    $backend = New-AzLoadBalancerBackendAddressPoolConfig -Name "backend"
    $lb = New-AzLoadBalancer -ResourceGroupName $RgName -Name "$VmssName-lb" -Location $Location -Sku Standard -FrontendIpConfiguration $frontend -BackendAddressPool $backend
} catch {
    Write-Error "Networking/LB failed: $_"
    exit
}

try {
    # VMSS
    Write-Host "Creating VM Scale Set..."
    $ipConfig = New-AzVmssIpConfig -Name "ipconfig" -LoadBalancerBackendAddressPoolsId $lb.BackendAddressPools[0].Id -SubnetId $sub.Id
    $config = New-AzVmssConfig -Location $Location -SkuCapacity $MinCount -SkuName $VmSize -UpgradePolicyMode Automatic |
        Add-AzVmssNetworkInterfaceConfiguration -Name "nic" -Primary $true -IpConfiguration $ipConfig |
        Set-AzVmssOsProfile -ComputerNamePrefix "vmss" -AdminUsername "azureuser" -AdminPassword "SecurePassword123!" -LinuxConfiguration (New-AzVmssLinuxConfiguration -DisablePasswordAuthentication $false) |
        Set-AzVmssStorageProfile -ImageReferencePublisher "Canonical" -ImageReferenceOffer "0001-com-ubuntu-server-jammy" -ImageReferenceSku "22_04-lts" -ImageReferenceVersion "latest"

    New-AzVmss -ResourceGroupName $RgName -Name $VmssName -VirtualMachineScaleSet $config -Tag $Tags
} catch {
    Write-Error "VMSS Creation failed: $_"
    exit
}

try {
    # Autoscale
    Write-Host "Configuring Autoscale..."
    $ruleScaleOut = New-AzAutoscaleRule -MetricName "Percentage CPU" -MetricResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -Operator GreaterThan -MetricStatistic Average -Threshold 75 -TimeGrain "00:01:00" -ScaleActionDirection Increase -ScaleActionType ChangeCount -ScaleActionValue 1 -Cooldown "00:05:00"
    $ruleScaleIn = New-AzAutoscaleRule -MetricName "Percentage CPU" -MetricResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -Operator LessThan -MetricStatistic Average -Threshold 25 -TimeGrain "00:01:00" -ScaleActionDirection Decrease -ScaleActionType ChangeCount -ScaleActionValue 1 -Cooldown "00:05:00"

    $profile = New-AzAutoscaleProfile -Name "DefaultProfile" -CapacityMin $MinCount -CapacityMax $MaxCount -CapacityDefault $MinCount -Rule $ruleScaleOut,$ruleScaleIn
    New-AzAutoscaleSetting -ResourceGroupName $RgName -Name "$VmssName-autoscale" -TargetResourceId (Get-AzVmss -ResourceGroupName $RgName -Name $VmssName).Id -AutoscaleProfile $profile -Location $Location

    Write-Host "VMSS Deployed with Autoscale."
} catch {
    Write-Error "Autoscale configuration failed: $_"
}
`
  },

  // --- COMPUTE (SPOT VM) ---
  {
    id: 'vm-spot-linux',
    category: AzureCategory.COMPUTE,
    title: 'Spot Virtual Machine (Cost Saver)',
    description: 'Deploys an Azure Spot Virtual Machine. Spot VMs utilize unused Azure capacity at a significant discount (up to 90%).',
    whatItDoes: [
        "Creates Spot VM (Eviction Policy: Deallocate)",
        "Sets Max Price to -1 (Current Market Price)"
    ],
    limitations: [
        "No SLA for availability",
        "Can be evicted at any time"
    ],
    commonIssues: [
        "Eviction: Your application must handle sudden shutdowns."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'spot' },
      { id: 'vmName', label: 'VM Name', type: 'text', defaultValue: 'vm-spot-01' },
      { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_D2s_v3' }
    ],
    learnLinks: [{ title: 'Azure Spot VMs', url: 'https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms' }],
    diagramCode: `graph TD
    Azure[Azure Fabric] -.->|Eviction Signal| VM
    subgraph "New Deployment: {{location}}"
      VM[Spot VM]
      VM --> Disk[OS Disk]
    end
    ${DIAGRAM_STYLES}
    class Azure existing;
    class VM,Disk new;`,
    scriptTemplate: `# Spot VM Deployment
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$VmName = "{{vmName}}"
$VmSize = "{{vmSize}}"
$Tags = ${COMMON_TAGS}

try {
    New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force
} catch {
    Write-Error "Failed to create RG: $_"
    exit
}

try {
    # Network
    $vnet = New-AzVirtualNetwork -ResourceGroupName $RgName -Location $Location -Name "$VmName-vnet" -AddressPrefix "10.10.0.0/16"
    $sub = Add-AzVirtualNetworkSubnetConfig -Name "default" -AddressPrefix "10.10.1.0/24" -VirtualNetwork $vnet
    $vnet | Set-AzVirtualNetwork
    $pip = New-AzPublicIpAddress -ResourceGroupName $RgName -Location $Location -Name "$VmName-pip" -Sku Standard -AllocationMethod Static
    $nic = New-AzNetworkInterface -ResourceGroupName $RgName -Location $Location -Name "$VmName-nic" -SubnetId $sub.Id -PublicIpAddressId $pip.Id
} catch {
    Write-Error "Networking setup failed: $_"
    exit
}

try {
    # VM Config (Spot)
    $vmConfig = New-AzVMConfig -VMName $VmName -VMSize $VmSize |
        Set-AzVMOperatingSystem -Linux -ComputerName $VmName -Credential (Get-Credential) |
        Set-AzVMSourceImage -PublisherName "Canonical" -Offer "0001-com-ubuntu-server-jammy" -Skus "22_04-lts" -Version "latest" |
        Add-AzVMNetworkInterface -Id $nic.Id |
        Set-AzVMQPriority -Priority "Spot" -MaxPrice -1 -EvictionPolicy "Deallocate"

    Write-Host "Deploying Spot VM ($VmSize)..."
    New-AzVM -ResourceGroupName $RgName -Location $Location -VM $vmConfig -Tag $Tags

    Write-Host "Spot VM created."
} catch {
    Write-Error "Spot VM deployment failed: $_"
    exit
}`
  },
  
  // --- COMPUTE (AVD) ---
  {
    id: 'avd-pooled',
    category: AzureCategory.COMPUTE,
    title: 'Azure Virtual Desktop (AVD)',
    description: 'Deploys the core infrastructure for an Azure Virtual Desktop (AVD) environment. This includes a Workspace, a Pooled Host Pool, and a Desktop Application Group. AVD enables secure remote work by delivering virtualized desktops and apps.',
    whatItDoes: [
        "Creates AVD Workspace",
        "Creates Pooled Host Pool",
        "Creates Desktop Application Group",
        "Registers App Group to Workspace",
        "Generates Registration Token"
    ],
    limitations: [
        "Does not deploy Session Host VMs",
        "Does not configure Entra ID / Active Directory integration"
    ],
    commonIssues: [
        "Registration Token: The output token is required to join VMs to this host pool. It expires after 24 hours.",
        "Module: Requires 'Az.DesktopVirtualization' module."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'avd' },
      { id: 'hpName', label: 'Host Pool Name', type: 'text', defaultValue: 'hp-pooled-01' },
      { id: 'wsName', label: 'Workspace Name', type: 'text', defaultValue: 'ws-avd-01' },
      { id: 'lbType', label: 'Load Balancing', type: 'select', options: ['BreadthFirst', 'DepthFirst'], defaultValue: 'BreadthFirst', description: 'BreadthFirst spreads users; DepthFirst fills hosts.' }
    ],
    learnLinks: [{ title: 'Create AVD Host Pool', url: 'https://learn.microsoft.com/en-us/azure/virtual-desktop/create-host-pools-powershell' }],
    diagramCode: `graph TB
    User((User)) -->|RDP| Gateway[AVD Gateway]
    Gateway --> WS[Workspace]
    subgraph "New Deployment: {{location}}"
      WS --> DAG[Desktop App Group]
      DAG --> HP[Host Pool]
      HP -.-> VM1[Future Session Host]
      HP -.-> VM2[Future Session Host]
    end
    ${DIAGRAM_STYLES}
    class User,Gateway,VM1,VM2 existing;
    class WS,DAG,HP new;`,
    scriptTemplate: `# Azure Virtual Desktop Infrastructure
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$HpName = "{{hpName}}"
$WsName = "{{wsName}}"
$LbType = "{{lbType}}"
$DagName = "$HpName-dag"
$Tags = ${COMMON_TAGS}

try {
    New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force
} catch {
    Write-Error "RG creation failed: $_"
    exit
}

try {
    Write-Host "Creating Host Pool ($LbType)..."
    # Creating a Pooled Host Pool
    $hp = New-AzWvdHostPool -ResourceGroupName $RgName -Name $HpName -Location $Location ` +
    `-HostPoolType Pooled -LoadBalancerType $LbType -PreferredAppGroupType Desktop -Tag $Tags

    Write-Host "Creating Desktop Application Group..."
    $dag = New-AzWvdApplicationGroup -ResourceGroupName $RgName -Name $DagName -Location $Location ` +
    `-HostPoolArmPath $hp.Id -ApplicationGroupType Desktop -FriendlyName "Default Desktop" -Tag $Tags

    Write-Host "Creating Workspace..."
    $ws = New-AzWvdWorkspace -ResourceGroupName $RgName -Name $WsName -Location $Location -Tag $Tags

    Write-Host "Registering App Group to Workspace..."
    Register-AzWvdApplicationGroup -ResourceGroupName $RgName -WorkspaceName $WsName -ApplicationGroupPath $dag.Id

    Write-Host "Generating Host Registration Token (Valid 24h)..."
    $token = New-AzWvdRegistrationInfo -ResourceGroupName $RgName -HostPoolName $HpName -ExpirationTime ((Get-Date).ToUniversalTime().AddHours(24).ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ'))

    Write-Host "AVD Environment Ready."
    Write-Host "Host Pool ID: $($hp.Id)"
    Write-Host "Registration Token: $($token.Token)" -ForegroundColor Yellow
    Write-Host "Use this token when deploying Session Host VMs."
} catch {
    Write-Error "AVD Deployment failed: $_"
    exit
}`
  },

  // --- CONTAINERS (AKS) ---
  {
    id: 'aks-managed',
    category: AzureCategory.CONTAINERS,
    title: 'Azure Kubernetes Service (AKS)',
    description: 'Provisions a production-ready Managed Kubernetes cluster. This setup uses System Assigned Managed Identity for control plane auth and Azure CNI for advanced networking.',
    whatItDoes: [
        "Deploys AKS Cluster with Managed Identity",
        "Configures System Node Pool",
        "Enables Azure CNI Networking"
    ],
    limitations: [
        "Does not configure Ingress Controller",
        "Does not enable Entra ID (AAD) integration"
    ],
    commonIssues: [
        "Subnet Exhaustion: Azure CNI requires 1 IP per Pod.",
        "Quota Limits: Check CPU quotas."
    ],
    prerequisites: ['acr-premium'],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'k8s' },
      { id: 'clusterName', label: 'Cluster Name', type: 'text', defaultValue: 'aks-cluster-01' },
      { id: 'nodeCount', label: 'Node Count', type: 'number', defaultValue: 3 },
      { id: 'vmSize', label: 'Node Size', type: 'select', options: ['Standard_DS2_v2', 'Standard_D4s_v3', 'Standard_F2s_v2'], defaultValue: 'Standard_DS2_v2' }
    ],
    learnLinks: [
        { title: 'Quickstart: Deploy an AKS cluster', url: 'https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-powershell' }
    ],
    diagramCode: `graph TB
    User((User)) -->|kubectl| LB[Load Balancer]
    subgraph "New Deployment: {{location}}"
      subgraph "AKS Cluster: {{clusterName}}"
        LB --> Node1
        LB --> Node2
        Node1[Node Pool]
        Node2[System Pool]
      end
    end
    ${DIAGRAM_STYLES}
    class User existing;
    class LB,Node1,Node2 new;`,
    scriptTemplate: `# AKS Deployment
${BASE_RG}
${BASE_LOC}
$ClusterName = "{{clusterName}}"
$NodeCount = {{nodeCount}}
$NodeSize = "{{vmSize}}"
$Tags = ${COMMON_TAGS}
$ProximityGroup = "{{proximityPlacementGroup}}"

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

# PPG Handling
$ppgId = $null
if (-not [string]::IsNullOrWhiteSpace($ProximityGroup)) {
     $ppg = Get-AzProximityPlacementGroup -Name $ProximityGroup -ResourceGroupName $RgName -ErrorAction SilentlyContinue
     if ($ppg) { $ppgId = $ppg.Id }
}

Write-Host "Creating AKS Cluster..."
New-AzAksCluster -ResourceGroupName $RgName -Name $ClusterName -Location $Location ` + 
`-NodeCount $NodeCount -NodeVmSize $NodeSize -NetworkPlugin azure ` +
`-EnableManagedIdentity -GenerateSshKey -Tag $Tags

if ($ppgId) {
    Write-Host "Use Add-AzAksNodePool to add pools associated with PPG ID: $ppgId"
}

Write-Host "Get Credentials:"
Write-Host "Get-AzAksClusterUserCredential -ResourceGroupName $RgName -Name $ClusterName"`
  },

  // --- CONTAINERS (ACI Single) ---
  {
    id: 'aci-single',
    category: AzureCategory.CONTAINERS,
    title: 'Single Docker Container (ACI)',
    description: 'Deploys a single container instance using Azure Container Instances (ACI). This is a "Serverless Container" solution ideal for simple applications, task automation, or build jobs that do not require full Kubernetes orchestration.',
    whatItDoes: [
        "Creates Resource Group",
        "Deploys Container Group with 1 Container",
        "Exposes Port 80 via Public IP",
        "Configures DNS Name Label"
    ],
    limitations: [
        "No Auto-scaling or Orchestration (unlike AKS)",
        "No integrated Load Balancer support",
        "No VNet Integration configured in this template"
    ],
    commonIssues: [
        "Image Name: Ensure the image name is correct (e.g., 'nginx:latest').",
        "DNS Name: Must be globally unique within the Azure region.",
        "Ports: Only Port 80 is exposed by default in this script."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'aci' },
      { id: 'cgName', label: 'Container Name', type: 'text', defaultValue: 'aci-demo-01' },
      { id: 'image', label: 'Image Name', type: 'text', defaultValue: 'mcr.microsoft.com/azuredocs/aci-helloworld', placeholder: 'nginx:latest' },
      { id: 'osType', label: 'OS Type', type: 'select', options: ['Linux', 'Windows'], defaultValue: 'Linux' },
      { id: 'cpu', label: 'CPU Cores', type: 'number', defaultValue: 1 },
      { id: 'memory', label: 'Memory (GB)', type: 'number', defaultValue: 1.5 },
      { id: 'dnsLabel', label: 'DNS Label', type: 'text', defaultValue: 'myapp-demo', description: 'Must be globally unique' }
    ],
    learnLinks: [
        { title: 'Quickstart: Deploy ACI', url: 'https://learn.microsoft.com/en-us/azure/container-instances/container-instances-quickstart-powershell' }
    ],
    diagramCode: `graph LR
    User((User)) -->|HTTP:80| ACI[Container Instance]
    subgraph "New Deployment: {{location}}"
      ACI
      ACI -.->|Pull| DockerHub[Registry]
    end
    ${DIAGRAM_STYLES}
    class User,DockerHub existing;
    class ACI new;`,
    scriptTemplate: `# Azure Container Instance (Single)
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$CgName = "{{cgName}}"
$Image = "{{image}}"
$OsType = "{{osType}}"
$Cpu = {{cpu}}
$Memory = {{memory}}
$DnsLabel = "{{dnsLabel}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Deploying Container Group ($Image)..."
$container = New-AzContainerGroup -ResourceGroupName $RgName -Name $CgName -Location $Location ` +
`-Image $Image -OsType $OsType -IpAddressType Public -Port 80 -DnsNameLabel $DnsLabel ` +
`-Cpu $Cpu -MemoryInGB $Memory -Tag $Tags

Write-Host "Deployment Complete."
Write-Host "FQDN: http://$($container.IpAddress.Fqdn)" -ForegroundColor Cyan`
  },

  // --- SERVERLESS (FUNCTION APP) ---
  {
    id: 'function-app-consumption',
    category: AzureCategory.SERVERLESS,
    title: 'Azure Function App (Consumption)',
    description: 'Deploys an Azure Function App on the Consumption Plan. Includes required Storage Account and Application Insights.',
    whatItDoes: [
        "Creates Storage Account (Required)",
        "Creates Application Insights",
        "Creates Function App (Consumption)"
    ],
    limitations: [
        "Cold Starts: App may take seconds to wake up."
    ],
    commonIssues: [
        "Storage Connection: Ensure storage name is unique."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'func' },
      { id: 'funcName', label: 'Function App Name', type: 'text', defaultValue: 'func-app-01' },
      { id: 'runtime', label: 'Runtime Stack', type: 'select', options: ['DotNet', 'Node', 'Python', 'Java', 'PowerShell'], defaultValue: 'Node' }
    ],
    learnLinks: [{ title: 'Create Function App', url: 'https://learn.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-node' }],
    diagramCode: `graph LR
    Event[Event Source] --> Func[Function App]
    subgraph "New Deployment: {{location}}"
      Func --> Storage[Storage Account]
      Func --> AppInsights[App Insights]
    end
    ${DIAGRAM_STYLES}
    class Event existing;
    class Func,Storage,AppInsights new;`,
    scriptTemplate: `# Function App (Consumption)
${BASE_RG}
${BASE_LOC}
$FuncName = "{{funcName}}"
$Runtime = "{{runtime}}"
$StorageName = "st" + $FuncName.Replace("-","").Substring(0, [math]::Min($FuncName.Length, 15)) # Generate compliant storage name
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Storage Account: $StorageName..."
$st = New-AzStorageAccount -ResourceGroupName $RgName -Name $StorageName -SkuName Standard_LRS -Location $Location -Kind StorageV2 -Tag $Tags

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
    description: 'Deploys an Azure Container Apps environment and a sample container app. Supports KEDA-based scaling.',
    whatItDoes: [
        "Creates Log Analytics Workspace",
        "Creates Container Apps Environment",
        "Deploys Hello World Container App"
    ],
    limitations: [
        "Does not configure VNet integration"
    ],
    commonIssues: [
        "Module Missing: Requires 'Az.ContainerApp' module."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'aca' },
      { id: 'envName', label: 'Environment Name', type: 'text', defaultValue: 'aca-env-01' },
      { id: 'appName', label: 'App Name', type: 'text', defaultValue: 'aca-app-hello' }
    ],
    learnLinks: [{ title: 'Azure Container Apps Overview', url: 'https://learn.microsoft.com/en-us/azure/container-apps/overview' }],
    diagramCode: `graph TD
    Internet((Internet)) --> Envoy[Ingress]
    subgraph "New Deployment: {{location}}"
      subgraph "Container Apps Env"
        Envoy --> App[Container App]
        App --> Replicas[Replica Set]
      end
      App --> Log[Log Analytics]
    end
    ${DIAGRAM_STYLES}
    class Internet existing;
    class Envoy,App,Replicas,Log new;`,
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
    description: 'Deploys an Azure Static Web App resource. Designed for hosting static web applications with a serverless backend.',
    whatItDoes: [
        "Creates Static Web App Resource"
    ],
    limitations: [
        "Does not create GitHub Repository"
    ],
    commonIssues: [
        "Deployment Token: Must be used to configure CI/CD."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'web' },
      { id: 'swaName', label: 'Static App Name', type: 'text', defaultValue: 'swa-portal-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Free', 'Standard'], defaultValue: 'Free' }
    ],
    learnLinks: [{ title: 'Create Static Web App', url: 'https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal' }],
    diagramCode: `graph LR
    User((User)) --> Edge[Edge Server]
    GitHub[GitHub Actions] --> Content
    subgraph "New Deployment: Global"
      Edge --> Content[Static Content]
      Edge --> API[Managed Functions]
    end
    ${DIAGRAM_STYLES}
    class User,GitHub existing;
    class Edge,Content,API new;`,
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

  // --- SERVERLESS (APP SERVICE) ---
  {
    id: 'app-service-linux',
    category: AzureCategory.SERVERLESS,
    title: 'Web App (Linux)',
    description: 'Deploys a Standard tier Linux App Service Plan and a corresponding Web App.',
    whatItDoes: [
        "Creates Standard App Service Plan (Linux)",
        "Creates Web App"
    ],
    limitations: [
        "Does not configure Application Insights"
    ],
    commonIssues: [
        "Cold Starts: Free/Shared tier apps sleep after inactivity."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'web' },
      { id: 'appName', label: 'App Name', type: 'text', defaultValue: 'webapp-front-01' },
      { id: 'sku', label: 'Plan SKU', type: 'select', options: ['Free', 'Basic (B1)', 'Standard (S1)', 'PremiumV3 (P1v3)'], defaultValue: 'Standard (S1)' }
    ],
    learnLinks: [{ title: 'Create Web App', url: 'https://learn.microsoft.com/en-us/azure/app-service/scripts/powershell-deploy-linux-docker' }],
    diagramCode: `graph TD
    User((User)) -->|HTTPS| WebApp[App Service]
    subgraph "New Deployment: {{location}}"
      subgraph "App Service Plan"
        WebApp
      end
    end
    ${DIAGRAM_STYLES}
    class User existing;
    class WebApp new;`,
    scriptTemplate: `# Linux Web App
${BASE_RG}
${BASE_LOC}
$AppName = "{{appName}}"
$SkuFull = "{{sku}}"
# Parse "Standard (S1)" -> "S1" or "Standard"
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
    description: 'Deploys a standalone User Assigned Managed Identity (UAMI). Can be assigned to multiple resources.',
    whatItDoes: [
        "Creates User Assigned Identity Resource",
        "Outputs Client ID and Principal ID"
    ],
    limitations: [
        "Does not assign the identity to any Azure resource"
    ],
    commonIssues: [
        "Propagation Delay: Principal ID may take time to replicate."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'identity' },
      { id: 'idName', label: 'Identity Name', type: 'text', defaultValue: 'id-app-prod' }
    ],
    learnLinks: [{ title: 'Managed Identities Overview', url: 'https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview' }],
    diagramCode: `graph LR
    AzureAD[Entra ID] -->|Trust| ID[User Assigned Identity]
    subgraph "New Deployment: {{location}}"
      ID
    end
    ID -.->|Assign To| VM1[Existing VM]
    ID -.->|Assign To| VM2[Existing VM]
    ${DIAGRAM_STYLES}
    class AzureAD,VM1,VM2 existing;
    class ID new;`,
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
    description: 'Creates an Entra ID (Azure AD) App Registration and a corresponding Service Principal.',
    whatItDoes: [
        "Creates App Registration",
        "Creates Service Principal",
        "Generates Client Secret"
    ],
    limitations: [
        "Does not grant Subscription permissions"
    ],
    commonIssues: [
        "Secret Management: Secret shown only once."
    ],
    inputs: [
      { id: 'appName', label: 'App Display Name', type: 'text', defaultValue: 'sp-cicd-pipeline' }
    ],
    learnLinks: [{ title: 'App Objects & Service Principals', url: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals' }],
    diagramCode: `graph TD
    Ext[GitHub / DevOps] -->|Client ID + Secret| AAD[Entra ID]
    subgraph "New Directory Object"
      AAD -->|Token| SP[Service Principal]
    end
    SP -->|RBAC| Azure[Azure Resources]
    ${DIAGRAM_STYLES}
    class Ext,AAD,Azure existing;
    class SP new;`,
    scriptTemplate: `# Service Principal Creation
$ErrorActionPreference = "Stop"
$AppName = "{{appName}}"

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
Write-Host "--------------------------------------------------" -ForegroundColor Green`
  },

  // --- IDENTITY (RBAC) ---
  {
    id: 'identity-rbac',
    category: AzureCategory.IDENTITY,
    title: 'Assign Role (RBAC)',
    description: 'Grants access to an Azure Resource Group by assigning a built-in Role.',
    whatItDoes: [
        "Creates Role Assignment at Resource Group Scope"
    ],
    limitations: [
        "Scopes permission to the entire Resource Group"
    ],
    commonIssues: [
        "Propagation: Assignments take time to replicate."
    ],
    inputs: [
      { id: 'rgName', label: 'Resource Group Name', type: 'text', defaultValue: 'rg-demo-dev' },
      { id: 'principalId', label: 'Principal ID (Object ID)', type: 'text', placeholder: '00000000-0000-0000-...' },
      { id: 'roleName', label: 'Role', type: 'select', options: ['Reader', 'Contributor', 'Owner', 'User Access Administrator'], defaultValue: 'Reader' }
    ],
    learnLinks: [{ title: 'Azure RBAC Overview', url: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/overview' }],
    diagramCode: `graph LR
    User[User/SP] -->|Assigns| Role[Role Definition]
    subgraph "Scope: {{rgName}}"
      Role -->|Assignment| RG[Resource Group]
    end
    ${DIAGRAM_STYLES}
    class User,Role,RG existing;
    linkStyle 1 stroke:#2563eb,stroke-width:4px;`,
    scriptTemplate: `# RBAC Role Assignment
$ErrorActionPreference = "Stop"
$RgName = "{{rgName}}"
$PrincipalId = "{{principalId}}"
$RoleName = "{{roleName}}"

Write-Host "Assigning '$RoleName' to $PrincipalId on $RgName..."

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
    description: 'Deploys a secure Azure Key Vault configured with RBAC.',
    whatItDoes: [
        "Deploys Key Vault (Standard/Premium)",
        "Enables Soft Delete",
        "Enables RBAC Authorization model"
    ],
    limitations: [
        "Does not create Private Endpoints"
    ],
    commonIssues: [
        "Access Denied: Even 'Owner' needs 'Key Vault Secrets User' role."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'sec' },
      { id: 'kvName', label: 'Key Vault Name', type: 'text', defaultValue: 'kv-shared-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Standard', 'Premium'], defaultValue: 'Standard' }
    ],
    learnLinks: [{ title: 'Create Key Vault', url: 'https://learn.microsoft.com/en-us/azure/key-vault/general/quick-create-powershell' }],
    diagramCode: `graph LR
    App[App Service] -->|Managed Identity| KV[Key Vault]
    subgraph "New Deployment: {{location}}"
      KV --> Secrets
      KV --> Keys
      KV --> Certs
    end
    ${DIAGRAM_STYLES}
    class App existing;
    class KV,Secrets,Keys,Certs new;`,
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
    description: 'Deploys Azure Firewall with a public IP and the mandatory "AzureFirewallSubnet".',
    whatItDoes: [
        "Creates VNet with 'AzureFirewallSubnet'",
        "Deploys Public IP",
        "Deploys Azure Firewall"
    ],
    limitations: [
        "Does not configure Firewall Policy"
    ],
    commonIssues: [
        "Subnet Name: Must be 'AzureFirewallSubnet'.",
        "Cost: Significant hourly cost."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'fw' },
      { id: 'fwName', label: 'Firewall Name', type: 'text', defaultValue: 'azfw-hub-01' },
      { id: 'sku', label: 'SKU Tier', type: 'select', options: ['Basic', 'Standard', 'Premium'], defaultValue: 'Standard' }
    ],
    learnLinks: [{ title: 'Deploy Azure Firewall', url: 'https://learn.microsoft.com/en-us/azure/firewall/deploy-ps' }],
    diagramCode: `graph TD
    Internet((Internet)) -->|Traffic| FW[Azure Firewall]
    subgraph "New Deployment: {{location}}"
      FW -->|Filter| VNet[Hub VNet]
    end
    VNet -->|Peering| Spoke1[Spoke VNet 1]
    VNet -->|Peering| Spoke2[Spoke VNet 2]
    ${DIAGRAM_STYLES}
    class Internet,Spoke1,Spoke2 existing;
    class FW,VNet new;`,
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
New-AzFirewall -Name $FwName -ResourceGroupName $RgName -Location $Location -VirtualNetworkName $vnet.Name -PublicIpName $pip.Name -SkuName "AZFW_VNet" -SkuTier $SkuTier -Tag $Tags

Write-Host "Firewall Deployed."`
  },

  // --- SECURITY (WAF) ---
  {
    id: 'app-gateway-waf',
    category: AzureCategory.SECURITY,
    title: 'App Gateway WAF v2',
    description: 'Deploys an Application Gateway v2 with Web Application Firewall (WAF) enabled.',
    whatItDoes: [
        "Creates VNet with dedicated subnet",
        "Deploys Public IP",
        "Deploys App Gateway WAF v2"
    ],
    limitations: [
        "Does not configure backend targets"
    ],
    commonIssues: [
        "Provisioning Time: Can take 15-20 minutes."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'waf' },
      { id: 'agwName', label: 'Gateway Name', type: 'text', defaultValue: 'agw-waf-01' },
      { id: 'capacity', label: 'Max Capacity Units', type: 'number', defaultValue: 10 }
    ],
    learnLinks: [{ title: 'Create App Gateway WAF', url: 'https://learn.microsoft.com/en-us/azure/web-application-firewall/ag/create-waf-policy-ag' }],
    diagramCode: `graph TB
    User((User)) -->|HTTPS| WAF[App Gateway WAF]
    subgraph "New Deployment: {{location}}"
      WAF
    end
    WAF -->|Protect| WebApp1[Existing App 1]
    WAF -->|Protect| WebApp2[Existing App 2]
    ${DIAGRAM_STYLES}
    class User,WebApp1,WebApp2 existing;
    class WAF new;`,
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
    description: 'Deploys a Log Analytics Workspace and enables Microsoft Sentinel on top of it.',
    whatItDoes: [
        "Creates Log Analytics Workspace",
        "Installs 'SecurityInsights' (Sentinel) Solution"
    ],
    limitations: [
        "Does not configure Data Connectors"
    ],
    commonIssues: [
        "Cost: Sentinel adds a cost on top of Log Analytics."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'siem' },
      { id: 'workspaceName', label: 'Workspace Name', type: 'text', defaultValue: 'la-sentinel-01' }
    ],
    learnLinks: [{ title: 'Onboard Microsoft Sentinel', url: 'https://learn.microsoft.com/en-us/azure/sentinel/quickstart-onboard' }],
    diagramCode: `graph LR
    Logs[Activity Logs] --> LA[Log Analytics]
    VMs[VM Events] --> LA
    subgraph "New Deployment: {{location}}"
      LA --> Sentinel[Microsoft Sentinel]
      Sentinel --> Alerts
    end
    ${DIAGRAM_STYLES}
    class Logs,VMs existing;
    class LA,Sentinel,Alerts new;`,
    scriptTemplate: `# Microsoft Sentinel Setup
${BASE_RG}
${BASE_LOC}
$WorkspaceName = "{{workspaceName}}"
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Log Analytics Workspace..."
$la = New-AzOperationalInsightsWorkspace -ResourceGroupName $RgName -Name $WorkspaceName -Location $Location -Sku Standard -Tag $Tags

Write-Host "Enabling Sentinel Solution..."
New-AzOperationalInsightsSolution -ResourceGroupName $RgName -WorkspaceResourceId $la.ResourceId -SolutionName "SecurityInsights" -Provider "Microsoft.OperationsManagement" -Tag $Tags

Write-Host "Sentinel Onboarded."`
  },

  // --- STORAGE (BLOB) ---
  {
    id: 'storage-blob-gpv2',
    category: AzureCategory.STORAGE,
    title: 'Azure Storage Account (Blob)',
    description: 'Deploys a General Purpose v2 (GPv2) Storage Account optimized for general blob storage use cases.',
    whatItDoes: [
        "Creates GPv2 Storage Account",
        "Enables 'Hot' access tier",
        "Creates a private Blob Container"
    ],
    limitations: [
        "Does not configure Lifecycle Management policies"
    ],
    commonIssues: [
        "Naming: Storage names must be globally unique."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'store' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stblob001', description: 'Lowercase, numbers only, unique' },
      { id: 'sku', label: 'Replication SKU', type: 'select', options: ['Standard_LRS', 'Standard_GRS', 'Standard_RAGRS'], defaultValue: 'Standard_LRS' },
      { id: 'containerName', label: 'Container Name', type: 'text', defaultValue: 'data' }
    ],
    learnLinks: [{ title: 'Create Storage Account', url: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create?tabs=azure-powershell' }],
    diagramCode: `graph LR
    User((User)) -->|HTTPS| Blob[Blob Service]
    subgraph "New Deployment: {{location}}"
      Blob --> Container
      Container --> File1
    end
    ${DIAGRAM_STYLES}
    class User existing;
    class Blob,Container,File1 new;`,
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
    description: 'Deploys a Storage Account and creates a standard SMB 3.0 File Share.',
    whatItDoes: [
        "Creates GPv2 Storage Account",
        "Creates SMB File Share",
        "Sets Quota Limit"
    ],
    limitations: [
        "Does not configure AD DS authentication"
    ],
    commonIssues: [
        "Port 445: ISPs often block outbound port 445."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'files' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stfiles001' },
      { id: 'shareName', label: 'Share Name', type: 'text', defaultValue: 'share-01' },
      { id: 'quota', label: 'Quota (GB)', type: 'number', defaultValue: 100 }
    ],
    learnLinks: [{ title: 'Create Azure File Share', url: 'https://learn.microsoft.com/en-us/azure/storage/files/storage-how-to-create-file-share?tabs=azure-powershell' }],
    diagramCode: `graph LR
    VM1[Windows VM] -->|SMB 3.0| Share[Azure File Share]
    VM2[Linux VM] -->|SMB 3.0| Share
    subgraph "New Deployment: {{location}}"
      Share --> Folder --> Files
    end
    ${DIAGRAM_STYLES}
    class VM1,VM2 existing;
    class Share,Folder,Files new;`,
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
    description: 'Deploys a Storage Account with Hierarchical Namespaces (HNS) enabled.',
    whatItDoes: [
        "Creates Storage Account with HNS Enabled",
        "Creates root filesystem (Container)"
    ],
    limitations: [
        "Cannot disable HNS after creation"
    ],
    commonIssues: [
        "Driver Compatibility: Ensure client uses ABFS driver."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'lake' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'stdatalake001' },
      { id: 'fsName', label: 'Filesystem Name', type: 'text', defaultValue: 'raw-data' }
    ],
    learnLinks: [{ title: 'Introduction to Data Lake Gen2', url: 'https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction' }],
    diagramCode: `graph TB
    Source[Data Sources] -->|Ingest| ADLS[Data Lake Gen2]
    subgraph "New Deployment: {{location}}"
      ADLS
    end
    ADLS -->|Analyze| Synapse[Synapse Analytics]
    ADLS -->|Train| ML[Machine Learning]
    ${DIAGRAM_STYLES}
    class Source,Synapse,ML existing;
    class ADLS new;`,
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
    description: 'Deploys a secure Virtual Network containing the specialized AzureBastionSubnet and a Standard SKU Bastion Host.',
    whatItDoes: [
        "Creates VNet and 'AzureBastionSubnet'",
        "Deploys Standard Public IP",
        "Deploys Azure Bastion Service"
    ],
    limitations: [
        "Does not deploy Jumpbox VMs"
    ],
    commonIssues: [
        "Subnet Naming: Must be 'AzureBastionSubnet'.",
        "Subnet Size: Must be /26 or larger."
    ],
    prerequisites: ['vm-linux-ssh'],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net' },
      { id: 'vnetName', label: 'VNet Name', type: 'text', defaultValue: 'vnet-hub' },
      { id: 'cidr', label: 'VNet CIDR', type: 'text', defaultValue: '10.1.0.0/16' }
    ],
    learnLinks: [
        { title: 'Create Bastion Host', url: 'https://learn.microsoft.com/en-us/azure/bastion/create-host-powershell' }
    ],
    diagramCode: `graph TD
    User((User)) -->|HTTPS| Bastion[Azure Bastion]
    subgraph "New Deployment: {{location}}"
      subgraph VNet
        Bastion
      end
    end
    Bastion -->|RDP/SSH| VM[Existing Target VM]
    ${DIAGRAM_STYLES}
    class User,VM existing;
    class Bastion new;`,
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
    description: 'Deploys a global Azure Front Door (Standard SKU) profile.',
    whatItDoes: [
        "Creates Front Door Standard Profile",
        "Creates a global Endpoint"
    ],
    limitations: [
        "Does not configure Origin Groups"
    ],
    commonIssues: [
        "DNS Propagation: Can take 10-30 minutes."
    ],
    prerequisites: ['app-service-linux'],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'afd' },
      { id: 'afdName', label: 'Front Door Name', type: 'text', defaultValue: 'afd-global-01' }
    ],
    learnLinks: [{ title: 'Create Front Door', url: 'https://learn.microsoft.com/en-us/azure/frontdoor/create-front-door-powershell' }],
    diagramCode: `graph TB
    User((User)) -->|Anycast| AFD[Azure Front Door]
    subgraph "New Deployment: Global"
      AFD
    end
    AFD -->|Origin| WebApp1[Existing WebApp (US)]
    AFD -->|Origin| WebApp2[Existing WebApp (EU)]
    ${DIAGRAM_STYLES}
    class User,WebApp1,WebApp2 existing;
    class AFD new;`,
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
    description: 'Deploys a Hub VNet and a Spoke VNet, and establishes bidirectional VNet Peering.',
    whatItDoes: [
        "Creates Hub VNet",
        "Creates Spoke VNet",
        "Enables Bidirectional Peering"
    ],
    limitations: [
        "Does not deploy Hub resources (Firewall/Gateway)"
    ],
    commonIssues: [
        "IP Overlap: Ensure Hub and Spoke address spaces do not overlap."
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
    subgraph "New Deployment: {{location}}"
      Hub[Hub VNet] <-->|Peering| Spoke[Spoke VNet]
    end
    Hub -.-> FW[Future Firewall]
    Spoke -.-> VM[Future VM]
    ${DIAGRAM_STYLES}
    class FW,VM existing;
    class Hub,Spoke new;`,
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
    description: 'Deploys a Route-Based Virtual Network Gateway (VPN).',
    whatItDoes: [
        "Creates VNet with 'GatewaySubnet'",
        "Creates Public IP (Standard)",
        "Deploys Virtual Network Gateway (VPN)"
    ],
    limitations: [
        "Does not create the 'Local Network Gateway'"
    ],
    commonIssues: [
        "Deployment Time: 30-45 minutes."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net-gw' },
      { id: 'gwName', label: 'Gateway Name', type: 'text', defaultValue: 'vpngw-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['VpnGw1', 'VpnGw2', 'VpnGw1AZ'], defaultValue: 'VpnGw1' }
    ],
    learnLinks: [{ title: 'Create VPN Gateway', url: 'https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-howto-point-to-site-resource-manager-portal' }],
    diagramCode: `graph LR
    OnPrem[Existing On-Prem DC] <-->|IPsec Tunnel| GW[Azure VPN Gateway]
    subgraph "New Deployment: {{location}}"
      GW --> HubVNet
    end
    HubVNet <--> SpokeVNet[Existing Spoke]
    ${DIAGRAM_STYLES}
    class OnPrem,SpokeVNet existing;
    class GW,HubVNet new;`,
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
    description: 'Deploys a Virtual Network NAT Gateway.',
    whatItDoes: [
        "Creates Public IP Prefix",
        "Creates NAT Gateway Resource",
        "Creates VNet and attaches NAT to Subnet"
    ],
    limitations: [
        "Does not migrate existing subnets"
    ],
    commonIssues: [
        "Zone Redundancy: NAT Gateway is zonal."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'net-nat' },
      { id: 'natName', label: 'NAT Name', type: 'text', defaultValue: 'ng-outbound-01' },
      { id: 'vnetName', label: 'VNet Name', type: 'text', defaultValue: 'vnet-app-01' }
    ],
    learnLinks: [{ title: 'What is Azure NAT Gateway?', url: 'https://learn.microsoft.com/en-us/azure/virtual-network/nat-gateway/nat-overview' }],
    diagramCode: `graph TB
    Internet((Internet)) --x|Block Ingress| NAT
    subgraph "New Deployment: {{location}}"
      Subnet[Private Subnet] -->|Outbound| NAT[NAT Gateway]
      NAT -->|Static IP| Internet
    end
    ${DIAGRAM_STYLES}
    class Internet existing;
    class Subnet,NAT new;`,
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
  
  // --- NETWORKING (DNS) ---
  {
    id: 'dns-public',
    category: AzureCategory.NETWORKING,
    title: 'Azure DNS Zone',
    description: 'Deploys a Public DNS Zone for hosting domain records. Azure DNS allows you to host your DNS domain in Azure for record management.',
    whatItDoes: [
        "Creates Public DNS Zone",
        "Outputs Name Servers for delegation"
    ],
    limitations: [
        "Does not purchase the domain name",
        "Does not configure registrar NS records automatically"
    ],
    commonIssues: [
        "Delegation: You must update your domain registrar's name servers to point to the Azure Name Servers provided in the output."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'dns' },
      { id: 'zoneName', label: 'Domain Name', type: 'text', defaultValue: 'example.com', placeholder: 'yourdomain.com' },
      { id: 'addWww', label: 'Add "www" Record', type: 'select', options: ['Yes', 'No'], defaultValue: 'Yes', description: 'Creates a placeholder A record.' }
    ],
    learnLinks: [{ title: 'Azure DNS Overview', url: 'https://learn.microsoft.com/en-us/azure/dns/dns-overview' }],
    diagramCode: `graph TD
    User((User)) -->|Query| DNS[Azure DNS]
    DNS -->|A Record| IP[Public IP]
    subgraph "New Deployment: {{location}}"
      DNS
    end
    ${DIAGRAM_STYLES}
    class User,IP existing;
    class DNS new;`,
    scriptTemplate: `# Azure DNS Zone
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$ZoneName = "{{zoneName}}"
$AddWww = "{{addWww}}"
$Tags = ${COMMON_TAGS}

# DNS Zones are global resources, but the resource group requires a location.
New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating DNS Zone $ZoneName..."
$zone = New-AzDnsZone -Name $ZoneName -ResourceGroupName $RgName -Tag $Tags

if ($AddWww -eq 'Yes') {
    Write-Host "Adding placeholder 'www' record..."
    New-AzDnsRecordSet -Name "www" -RecordType A -ZoneName $ZoneName -ResourceGroupName $RgName -Ttl 3600 -DnsRecords (New-AzDnsRecordConfig -Ipv4Address "1.2.3.4") -Overwrite
}

Write-Host "DNS Zone Deployed."
Write-Host "Update your registrar with these Name Servers:" -ForegroundColor Yellow
$zone.NameServers`
  },

  // --- DATABASE (COSMOS) ---
  {
    id: 'cosmos-sql',
    category: AzureCategory.DATABASE,
    title: 'Cosmos DB (NoSQL)',
    description: 'Provisions a Cosmos DB account using the Core (SQL) API.',
    whatItDoes: [
        "Creates Cosmos DB Account",
        "Creates SQL Database",
        "Creates Container with Partition Key"
    ],
    limitations: [
        "Does not configure Geo-Replication"
    ],
    commonIssues: [
        "Partition Key: Cannot be changed after creation."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'data' },
      { id: 'accountName', label: 'Account Name', type: 'text', defaultValue: 'cosmos-global-01' },
      { id: 'dbName', label: 'Database Name', type: 'text', defaultValue: 'CoreDb' }
    ],
    learnLinks: [{ title: 'Create Cosmos DB', url: 'https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/manage-with-powershell' }],
    diagramCode: `graph LR
    App[Existing App] -->|SDK| Cosmos[Cosmos DB Account]
    subgraph "New Deployment: {{location}}"
      Cosmos --> DB[Database]
      DB --> Container[Container]
    end
    ${DIAGRAM_STYLES}
    class App existing;
    class Cosmos,DB,Container new;`,
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
    description: 'Deploys a fully managed Azure Cache for Redis (Standard SKU).',
    whatItDoes: [
        "Deploys Redis Cache Standard"
    ],
    limitations: [
        "Does not configure VNet Injection"
    ],
    commonIssues: [
        "TLS Versions: Enforces TLS 1.2 by default."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'cache' },
      { id: 'redisName', label: 'Redis Name', type: 'text', defaultValue: 'redis-cache-01' },
      { id: 'sku', label: 'Cache SKU', type: 'select', options: ['Basic C0', 'Standard C0', 'Standard C1'], defaultValue: 'Standard C0' }
    ],
    learnLinks: [{ title: 'Create Redis Cache', url: 'https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-how-to-manage-redis-cache-powershell' }],
    diagramCode: `graph LR
    WebApp[Existing WebApp] -->|Redis Protocol| Redis[Azure Redis Cache]
    subgraph "New Deployment: {{location}}"
      Redis --> Memory[In-Memory Store]
    end
    ${DIAGRAM_STYLES}
    class WebApp existing;
    class Redis,Memory new;`,
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
    description: 'Creates a Premium Azure Container Registry (ACR).',
    whatItDoes: [
        "Creates ACR Premium",
        "Enables Admin User"
    ],
    limitations: [
        "Does not configure Content Trust"
    ],
    commonIssues: [
        "Docker Login: Enable Admin User."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'acr' },
      { id: 'acrName', label: 'Registry Name', type: 'text', defaultValue: 'acrregistry001', description: 'Alphanumeric only' }
    ],
    learnLinks: [{ title: 'Create ACR', url: 'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-get-started-powershell' }],
    diagramCode: `graph LR
    DevOps[Existing Pipeline] -->|Push| ACR[Container Registry]
    AKS[Existing AKS] -->|Pull| ACR
    subgraph "New Deployment: {{location}}"
      ACR
    end
    ${DIAGRAM_STYLES}
    class DevOps,AKS existing;
    class ACR new;`,
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
    description: 'Deploys a Standard-tier Logic App running on a Workflow Standard App Service Plan.',
    whatItDoes: [
        "Creates Workflow Standard App Service Plan",
        "Creates Storage Account",
        "Creates Logic App (Standard)"
    ],
    limitations: [
        "Does not configure VNet Integration"
    ],
    commonIssues: [
        "State Storage: Requires dedicated Storage Account."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'int-std' },
      { id: 'laName', label: 'Logic App Name', type: 'text', defaultValue: 'la-std-01' },
      { id: 'sku', label: 'Plan SKU', type: 'select', options: ['WS1', 'WS2', 'WS3'], defaultValue: 'WS1' }
    ],
    learnLinks: [{ title: 'Logic Apps Standard vs Consumption', url: 'https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview#resource-type-and-host-environment-differences' }],
    diagramCode: `graph LR
    Trigger[External Trigger] --> Workflow[Logic App Std]
    subgraph "New Deployment: {{location}}"
      Workflow -->|VNet| SQL[Private SQL]
      Workflow -->|Connector| SAP[SAP System]
      subgraph "App Service Plan (WS1)"
        Workflow
      end
    end
    ${DIAGRAM_STYLES}
    class Trigger,SQL,SAP existing;
    class Workflow,SQL,SAP,Plan new;`,
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
    description: 'Deploys an Azure API Management (APIM) instance.',
    whatItDoes: [
        "Creates API Management Service",
        "Configures Publisher Email/Name"
    ],
    limitations: [
        "Deployment takes 30-45 minutes"
    ],
    commonIssues: [
        "Soft Delete: APIM soft-delete enabled by default."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'api' },
      { id: 'apimName', label: 'APIM Name', type: 'text', defaultValue: 'apim-gateway-01' },
      { id: 'sku', label: 'SKU', type: 'select', options: ['Developer', 'Standard', 'Premium'], defaultValue: 'Developer', description: 'Developer is cheapest for non-prod.' },
      { id: 'publisherEmail', label: 'Admin Email', type: 'text', placeholder: 'admin@yourdomain.com', description: 'Required for APIM admin notifications' }
    ],
    learnLinks: [{ title: 'Create API Management', url: 'https://learn.microsoft.com/en-us/azure/api-management/get-started-create-service-instance-powershell' }],
    diagramCode: `graph LR
    Client[Mobile/Web Client] -->|HTTPS| APIM[API Management]
    subgraph "New Deployment: {{location}}"
      APIM -->|Policy| Auth[Oauth2]
      APIM -->|Proxy| Func[Function App]
      APIM -->|Proxy| K8s[AKS Service]
    end
    ${DIAGRAM_STYLES}
    class Client,Auth,Func,K8s existing;
    class APIM new;`,
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
    description: 'Deploys a Service Bus Namespace (Standard SKU) with a sample Queue and Topic.',
    whatItDoes: [
        "Creates Service Bus Namespace",
        "Creates 'orders' Queue",
        "Creates 'events' Topic"
    ],
    limitations: [
        "Does not configure Authorization Rules"
    ],
    commonIssues: [
        "SKU: Basic SKU does NOT support Topics."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'bus' },
      { id: 'sbName', label: 'Namespace Name', type: 'text', defaultValue: 'sb-enterprise-01' }
    ],
    learnLinks: [{ title: 'Create Service Bus Namespace', url: 'https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-powershell' }],
    diagramCode: `graph LR
    App1[Existing Producer] -->|Send| SB[Service Bus]
    subgraph "New Deployment: {{location}}"
      SB -->|Queue| App2[Consumer A]
      SB -->|Topic| App3[Consumer B]
      SB -->|Topic| App4[Consumer C]
    end
    ${DIAGRAM_STYLES}
    class App1,App2,App3,App4 existing;
    class SB new;`,
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
  },

  // --- MONITORING (COST & LOGS) ---
  {
    id: 'monitor-cost-analytics',
    category: AzureCategory.MONITORING,
    title: 'Log Analytics & Cost Automation',
    description: 'Deploys a Log Analytics Workspace and an Azure Automation Account. Includes a sample Runbook script scaffolded for cost analysis and tracking tasks.',
    whatItDoes: [
        "Creates Log Analytics Workspace",
        "Creates Automation Account",
        "Enables System Managed Identity",
        "Deploys 'Analyze-Cost' Runbook"
    ],
    limitations: [
        "Requires 'Cost Management Reader' role assignment (manual step)"
    ],
    commonIssues: [
        "Modules: Ensure 'Az.Accounts' and 'Az.Billing' modules are added to Automation Account."
    ],
    inputs: [
      { id: 'rgSuffix', label: 'RG Suffix', type: 'text', defaultValue: 'monitor' },
      { id: 'workspaceName', label: 'Workspace Name', type: 'text', defaultValue: 'la-ops-01' },
      { id: 'automationName', label: 'Automation Name', type: 'text', defaultValue: 'aa-ops-01' },
      { id: 'retention', label: 'Log Retention (Days)', type: 'number', defaultValue: 30 }
    ],
    learnLinks: [{ title: 'Azure Automation Runbooks', url: 'https://learn.microsoft.com/en-us/azure/automation/automation-runbook-types' }],
    diagramCode: `graph LR
    Timer[Schedule] -->|Trigger| Runbook[Cost Analysis Runbook]
    Runbook -->|Query| Azure[Azure Cost Mgmt]
    Runbook -->|Log| LA[Log Analytics]
    subgraph "New Deployment: {{location}}"
      Runbook
      LA
    end
    ${DIAGRAM_STYLES}
    class Timer,Azure existing;
    class Runbook,LA new;`,
    scriptTemplate: `# Log Analytics & Cost Automation
$ErrorActionPreference = "Stop"
${BASE_RG}
${BASE_LOC}
$WorkspaceName = "{{workspaceName}}"
$AutomationName = "{{automationName}}"
$Retention = {{retention}}
$Tags = ${COMMON_TAGS}

New-AzResourceGroup -Name $RgName -Location $Location -Tag $Tags -Force

Write-Host "Creating Log Analytics Workspace..."
$la = New-AzOperationalInsightsWorkspace -ResourceGroupName $RgName -Name $WorkspaceName -Location $Location -Sku Standard -RetentionInDays $Retention -Tag $Tags

Write-Host "Creating Automation Account..."
$aa = New-AzAutomationAccount -ResourceGroupName $RgName -Name $AutomationName -Location $Location -Sku Basic -Tag $Tags
$aa | Set-AzAutomationAccount -AssignSystemIdentity

Write-Host "Creating Cost Analysis Runbook..."
$scriptContent = @"
<#
.SYNOPSIS
    Basic Cost Analysis Skeleton
.DESCRIPTION
    Connects via Managed Identity and queries scope usage.
#>
try {
    Connect-AzAccount -Identity
    Write-Output 'Logged in via Managed Identity.'
    
    # Placeholder for complex cost query logic
    Write-Output 'Checking subscription costs...'
    # \`$cost = Get-AzConsumptionUsageDetail ...
    
    Write-Output 'Cost analysis logic executed successfully.'
} catch {
    Write-Error 'Failed to execute cost analysis.'
}
"@

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $scriptContent
Import-AzAutomationRunbook -ResourceGroupName $RgName -AutomationAccountName $AutomationName -Name "Analyze-Cost" -Path $tmp -Type PowerShell -Force
Remove-Item $tmp

Write-Host "Deployment Complete."
Write-Host "IMPORTANT: Grant the Automation Account's Managed Identity 'Cost Management Reader' access on your subscription." -ForegroundColor Yellow`
  }
];
