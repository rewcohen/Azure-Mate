import { WizardInput, AzureContext, GlobalVariables } from '../types';

/**
 * Generates a valid PowerShell script by substituting variables into a template.
 *
 * @param template - The raw PowerShell template string containing {{placeholders}}.
 * @param inputs - The definition of inputs required by the specific scenario wizard.
 * @param values - The actual values provided by the user in the wizard form.
 * @param context - The active Azure Context (Subscription/Tenant).
 * @param globalVars - Global configuration variables (Project, Env, etc.).
 * @returns The fully processed, executable PowerShell script.
 */
export const generateScriptFromTemplate = (
  template: string,
  inputs: WizardInput[],
  values: Record<string, string | number | boolean>,
  context: AzureContext,
  globalVars: GlobalVariables
): string => {
  let script = template;

  // 1. Replace Global Variables
  // These are project-wide settings configured in the Global Config page
  script = script.split('{{projectPrefix}}').join(globalVars.projectPrefix);
  script = script.split('{{environment}}').join(globalVars.environment);
  script = script.split('{{location}}').join(globalVars.location);
  script = script.split('{{costCenter}}').join(globalVars.costCenter);
  script = script.split('{{owner}}').join(globalVars.owner);

  // Handle optional PPG - if empty, it remains empty string in script which logic handles
  script = script
    .split('{{proximityPlacementGroup}}')
    .join(globalVars.proximityPlacementGroup || '');

  // 2. Replace Wizard Inputs
  // These are specific to the selected scenario (e.g., VM Name, Node Count)
  inputs.forEach((input) => {
    const key = `{{${input.id}}}`;
    const value =
      values[input.id] !== undefined ? values[input.id] : input.defaultValue;
    // Global replacement
    script = script.split(key).join(String(value));
  });

  // 3. Replace Azure Context Variables
  // Injected from the sidebar connection state
  if (context.isConnected) {
    script = script.split('{{subscriptionId}}').join(context.subscriptionId);
    script = script.split('{{tenantId}}').join(context.tenantId);
  } else {
    // Fallback placeholders if not connected
    script = script.split('{{subscriptionId}}').join('<Your-Subscription-ID>');
    script = script.split('{{tenantId}}').join('<Your-Tenant-ID>');
  }

  return script;
};

/**
 * Processes the Mermaid diagram template to inject real resource names.
 * This allows the architecture diagram to reflect the user's actual configuration.
 */
export const processDiagramTemplate = (
  diagramCode: string,
  inputs: WizardInput[],
  values: Record<string, string | number | boolean>,
  globalVars: GlobalVariables
): string => {
  let code = diagramCode;

  // Replace globals in diagram
  code = code.split('{{projectPrefix}}').join(globalVars.projectPrefix);
  code = code.split('{{environment}}').join(globalVars.environment);
  code = code.split('{{location}}').join(globalVars.location);

  // Replace wizard specific inputs
  inputs.forEach((input) => {
    const key = `{{${input.id}}}`;
    const value =
      values[input.id] !== undefined ? values[input.id] : input.defaultValue;
    code = code.split(key).join(String(value));
  });
  return code;
};
