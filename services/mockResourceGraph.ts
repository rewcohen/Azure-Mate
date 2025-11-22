import { ResourceNode } from '../types';

/**
 * Generates a randomized but realistic topology of Azure resources
 * to simulate a "Live Scan" from Azure Resource Graph.
 */
export const mockSearchGraph = async (
  subscriptionId: string,
  environment: string
): Promise<ResourceNode[]> => {
  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const subPath = `/subscriptions/${subscriptionId}`;
  const rgName = `rg-${environment}-core`;
  const location = 'eastus';

  const resources: ResourceNode[] = [];

  // 1. Network Topology (Hub & Spoke)
  const vnetHubId = `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Network/virtualNetworks/vnet-hub`;
  resources.push({
    id: vnetHubId,
    name: 'vnet-hub',
    type: 'Microsoft.Network/virtualNetworks',
    location: location,
    tags: { environment, role: 'hub' },
    properties: {
      addressSpace: { addressPrefixes: ['10.0.0.0/16'] },
      subnets: [
        {
          name: 'AzureFirewallSubnet',
          id: `${vnetHubId}/subnets/AzureFirewallSubnet`,
        },
        { name: 'GatewaySubnet', id: `${vnetHubId}/subnets/GatewaySubnet` },
      ],
    },
  });

  const vnetSpokeId = `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Network/virtualNetworks/vnet-spoke-app`;
  const spokeSubnetId = `${vnetSpokeId}/subnets/default`;
  resources.push({
    id: vnetSpokeId,
    name: 'vnet-spoke-app',
    type: 'Microsoft.Network/virtualNetworks',
    location: location,
    tags: { environment, role: 'spoke' },
    properties: {
      addressSpace: { addressPrefixes: ['10.1.0.0/16'] },
      subnets: [{ name: 'default', id: spokeSubnetId }],
    },
  });

  // 2. Compute (VMs)
  // A Healthy VM
  const vm1Name = 'vm-app-01';
  const nic1Id = `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Network/networkInterfaces/${vm1Name}-nic`;
  resources.push({
    id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Compute/virtualMachines/${vm1Name}`,
    name: vm1Name,
    type: 'Microsoft.Compute/virtualMachines',
    location: location,
    tags: { environment, owner: 'cloud-admin' },
    properties: {
      hardwareProfile: { vmSize: 'Standard_D2s_v3' },
      networkProfile: { networkInterfaces: [{ id: nic1Id }] },
      storageProfile: {
        osDisk: {
          managedDisk: {
            id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Compute/disks/${vm1Name}_OsDisk`,
          },
        },
      },
    },
  });
  resources.push({
    id: nic1Id,
    name: `${vm1Name}-nic`,
    type: 'Microsoft.Network/networkInterfaces',
    location: location,
    properties: {
      ipConfigurations: [
        {
          name: 'ipconfig1',
          properties: { subnet: { id: spokeSubnetId } },
        },
      ],
    },
  });
  resources.push({
    id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Compute/disks/${vm1Name}_OsDisk`,
    name: `${vm1Name}_OsDisk`,
    type: 'Microsoft.Compute/disks',
    location: location,
    properties: { diskSizeGB: 128, diskState: 'Attached' },
  });

  // A Broken VM (Cross-region mismatch logic test)
  const vmBadName = 'vm-legacy-dr';
  const nicBadId = `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Network/networkInterfaces/${vmBadName}-nic`;
  resources.push({
    id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Compute/virtualMachines/${vmBadName}`,
    name: vmBadName,
    type: 'Microsoft.Compute/virtualMachines',
    location: 'westus', // Intentional mismatch
    tags: { environment: 'legacy' },
    properties: {
      hardwareProfile: { vmSize: 'Standard_F2s_v2' },
      networkProfile: { networkInterfaces: [{ id: nicBadId }] },
    },
  });
  resources.push({
    id: nicBadId,
    name: `${vmBadName}-nic`,
    type: 'Microsoft.Network/networkInterfaces',
    location: location, // East US (Mismatch)
    properties: {
      ipConfigurations: [
        {
          name: 'ipconfig1',
          properties: { subnet: { id: spokeSubnetId } },
        },
      ],
    },
  });

  // 3. Storage & Databases
  // Orphaned Disk
  resources.push({
    id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Compute/disks/disk-backup-old`,
    name: 'disk-backup-old',
    type: 'Microsoft.Compute/disks',
    location: location,
    properties: { diskSizeGB: 1024, diskState: 'Unattached' }, // Issue
  });

  // SQL Server
  resources.push({
    id: `${subPath}/resourceGroups/${rgName}/providers/Microsoft.Sql/servers/sql-${environment}`,
    name: `sql-${environment}`,
    type: 'Microsoft.Sql/servers',
    location: location,
    tags: { environment },
    properties: { version: '12.0' },
  });

  return resources;
};
