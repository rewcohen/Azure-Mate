export enum AzureCategory {
  COMPUTE = 'Compute',
  NETWORKING = 'Networking',
  STORAGE = 'Storage',
  SERVERLESS = 'Serverless',
  IDENTITY = 'Identity',
  MONITORING = 'Monitoring',
  DATABASE = 'Database',
  SECURITY = 'Security',
  CONTAINERS = 'Containers',
  INTEGRATION = 'Integration',
  TROUBLESHOOT = 'Troubleshoot',
}

export interface WizardInput {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  options?: string[]; // For select types
  defaultValue?: string | number | boolean;
  placeholder?: string;
  description?: string;
}

export interface LearnLink {
  title: string;
  url: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: AzureCategory;
  description: string;

  // Wizard & Template Fields
  inputs: WizardInput[];
  scriptTemplate: string; // PowerShell template with {{variable}} placeholders
  diagramCode: string; // Mermaid diagram definition
  learnLinks: LearnLink[];

  // New Explanation Fields
  whatItDoes: string[];
  limitations: string[];
  commonIssues: string[]; // Pitfalls and common deployment errors

  // Dependencies - List of Scenario IDs that are prerequisites
  prerequisites?: string[];

  // For LLM fallback or custom scenarios
  defaultPrompt?: string;
}

export interface GeneratedResult {
  script: string;
  explanation?: string;
  variables: Record<string, string | number | boolean>;
  troubleshootingSteps?: string[];
}

export enum ViewState {
  HOME = 'HOME',
  CATALOG = 'CATALOG',
  GENERATOR = 'GENERATOR',
  TROUBLESHOOTER = 'TROUBLESHOOTER',
  VARIABLES = 'VARIABLES',
  END_STATE = 'END_STATE',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isScript?: boolean;
}

export interface AzureContext {
  subscriptionId: string;
  tenantId: string;
  isConnected: boolean;
  userDisplayName?: string;
  username?: string;
}

export interface GlobalVariables {
  projectPrefix: string;
  environment: string;
  location: string;
  costCenter: string;
  owner: string;
  proximityPlacementGroup: string;
  ollamaModel: string;
}

// Cost Estimation Types
export interface CostItem {
  resourceName: string;
  sku: string;
  unitPrice: number; // Monthly cost
  quantity: number;
  total: number;
}

export interface CostBreakdown {
  items: CostItem[];
  totalMonthly: number;
  currency: string;
  isEstimated: boolean;
}

// Project Cart Types
export interface SavedDeploymentItem {
  id: string;
  timestamp: number;
  scenarioId: string;
  scenarioTitle: string;
  script: string;
  costEstimate: CostBreakdown | null;
  variables: Record<string, string | number | boolean>;
  deploymentTips: string[];
  diagramCode?: string;
}

export interface ProjectState {
  name: string;
  items: SavedDeploymentItem[];
}

// System Status Types
export type ServiceStatusLevel =
  | 'Available'
  | 'Warning'
  | 'Critical'
  | 'Information';

export interface ServiceHealth {
  name: string;
  category: string; // e.g., Compute, Networking
  region: string; // e.g., Global, East US
  status: ServiceStatusLevel;
  updated: string;
  message?: string;
}

// Auditor Types
export interface ResourceNode {
  id: string;
  name: string;
  type: string;
  location: string;
  tags?: Record<string, string>;
  properties: Record<string, any>;
  dependsOn?: string[];
}

export interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  resourceId: string;
  message: string;
  code: string;
  metadata?: {
    targetId?: string;
    expectedLocation?: string;
    actualLocation?: string;
  };
}

export interface AutoPopulate {
  (location: string, env: string, owner: string): void;
}

// Deployment Types
export interface DeploymentLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'command';
}

export interface DeploymentStatus {
  state: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: DeploymentLog[];
}
