import { GeneratedResult } from '../types';

const OLLAMA_BASE_URL = 'http://localhost:11434';

export const generateConfig = async (
  title: string,
  userRequirements: string,
  contextVars: Record<string, string> = {},
  modelName: string = 'llama3'
): Promise<GeneratedResult> => {
  const prompt = `
    You are an expert Azure DevOps Engineer and PowerShell scripting wizard.
    Task: Generate a production-ready Azure PowerShell script for the following scenario: "${title}".
    
    User Requirements: ${userRequirements}
    
    Specific Context/Variables to use: ${JSON.stringify(contextVars)}
    
    Guidelines:
    1. Use the 'Az' module (not AzureRM).
    2. Include comments explaining key parameters.
    3. Implement error handling (Try/Catch) where appropriate.
    4. Use meaningful variable names.
    5. Follow Microsoft Cloud Adoption Framework best practices.
    6. Ensure the script is idempotent if possible.

    Output Requirement:
    You MUST respond with a valid JSON object exactly matching this structure:
    {
      "script": "string (the complete PowerShell script)",
      "explanation": "string (markdown explanation of best practices used)",
      "variables": { "key": "value" } (object of variables defined in script),
      "troubleshootingSteps": ["step1", "step2"] (array of validation steps)
    }
  `;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        format: 'json', // Force JSON mode
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const jsonStr = data.response;

    // Basic parsing, Ollama usually returns the JSON object in 'response'
    try {
      return JSON.parse(jsonStr) as GeneratedResult;
    } catch (e) {
      console.error('Failed to parse JSON from Ollama:', jsonStr);
      // Fallback attempt to extract JSON from text if model is chatty
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as GeneratedResult;
      }
      throw new Error('Invalid JSON response from model');
    }
  } catch (error) {
    console.error('Ollama generation error:', error);
    throw new Error(
      `Failed to generate configuration. Ensure Ollama is running at ${OLLAMA_BASE_URL} and the model '${modelName}' is pulled.`
    );
  }
};

export const troubleshootIssue = async (
  issueDescription: string,
  history: { role: string; text: string }[],
  modelName: string = 'llama3'
): Promise<string> => {
  const systemPrompt = `You are an expert Azure Troubleshooting Assistant. Provide concise, step-by-step troubleshooting guides. Return response in Markdown.`;

  // Map history to Ollama format (role: user/assistant)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    })),
    { role: 'user', content: issueDescription },
  ];

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return (
      data.message?.content || "I couldn't generate a solution at this time."
    );
  } catch (error) {
    console.error('Ollama troubleshooting error:', error);
    return `Error contacting Ollama at ${OLLAMA_BASE_URL}. Ensure it is running locally.`;
  }
};
