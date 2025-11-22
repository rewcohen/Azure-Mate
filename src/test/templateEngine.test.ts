import { describe, it, expect } from 'vitest';
import {
  generateScriptFromTemplate,
  processDiagramTemplate,
} from '../../services/templateEngine';
import type { WizardInput } from '../../types';

describe('templateEngine', () => {
  describe('generateScriptFromTemplate', () => {
    it('should substitute global variables', () => {
      const template = 'Hello {{projectPrefix}}-{{environment}}';
      const inputs: WizardInput[] = [];
      const wizardInputs = {};
      const azureContext = { subscriptionId: '123', tenantId: '456', isConnected: false };
      const globalVars = {
        projectPrefix: 'myapp',
        environment: 'prod',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const result = generateScriptFromTemplate(template, inputs, wizardInputs, azureContext, globalVars);
      
      expect(result).toBe('Hello myapp-prod');
    });

    it('should substitute wizard inputs', () => {
      const template = 'Creating VM {{vmName}} of size {{vmSize}}';
      const inputs = [
        { id: 'vmName', label: 'VM Name', type: 'text' },
        { id: 'vmSize', label: 'VM Size', type: 'select', options: ['Standard_B1s', 'Standard_B2s'] },
      ];
      const wizardInputs = {
        vmName: 'web-01',
        vmSize: 'Standard_B2s',
      };
      const azureContext = { subscriptionId: '123', tenantId: '456', isConnected: false };
      const globalVars = {
        projectPrefix: 'demo',
        environment: 'dev',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const result = generateScriptFromTemplate(template, inputs, wizardInputs, azureContext, globalVars);
      
      expect(result).toBe('Creating VM web-01 of size Standard_B2s');
    });

    it('should substitute Azure context when connected', () => {
      const template = 'Subscription: {{subscriptionId}}, Tenant: {{tenantId}}';
      const inputs = [];
      const wizardInputs = {};
      const azureContext = { subscriptionId: 'abc-123', tenantId: 'xyz-789', isConnected: true };
      const globalVars = {
        projectPrefix: 'demo',
        environment: 'dev',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const result = generateScriptFromTemplate(template, inputs, wizardInputs, azureContext, globalVars);
      
      expect(result).toBe('Subscription: abc-123, Tenant: xyz-789');
    });

    it('should leave unsubstituted variables as is', () => {
      const template = 'Hello {{unknownVariable}}';
      const inputs = [];
      const wizardInputs = {};
      const azureContext = { subscriptionId: '123', tenantId: '456', isConnected: false };
      const globalVars = {
        projectPrefix: 'demo',
        environment: 'dev',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const result = generateScriptFromTemplate(template, inputs, wizardInputs, azureContext, globalVars);
      
      expect(result).toBe('Hello {{unknownVariable}}');
    });
  });

  describe('processDiagramTemplate', () => {
    it('should substitute variables in Mermaid diagrams', () => {
      const diagramTemplate = `
        graph TD
        User((User)) -->|SSH| VM["{{vmName}}"]
        VM --> RG["{{projectPrefix}}-{{environment}}-rg"]
      `;

      const variables = {
        vmName: 'web-01',
        projectPrefix: 'myapp',
        environment: 'prod',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const inputs = [
        { id: 'vmName', label: 'VM Name', type: 'text' },
      ];
      const values = {
        vmName: 'web-01',
      };
      const globalVars = {
        projectPrefix: 'myapp',
        environment: 'prod',
        location: 'eastus',
        costCenter: 'IT',
        owner: 'admin',
        proximityPlacementGroup: '',
        ollamaModel: 'llama3',
      };

      const result = processDiagramTemplate(diagramTemplate, inputs, values, globalVars);
      
      expect(result).toContain('web-01');
      expect(result).toContain('myapp-prod-rg');
      expect(result).not.toContain('{{vmName}}');
    });
  });
});
