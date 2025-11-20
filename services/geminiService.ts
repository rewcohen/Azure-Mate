import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for structured output when generating scripts
const scriptResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    script: {
      type: Type.STRING,
      description: 'The complete, executable PowerShell script.',
    },
    explanation: {
      type: Type.STRING,
      description: 'A Markdown formatted explanation of the script, highlighting best practices used.',
    },
    variables: {
      type: Type.OBJECT,
      description: 'Key-value pairs of variables defined in the script for easy user reference.',
      additionalProperties: { type: Type.STRING }
    },
    troubleshootingSteps: {
      type: Type.ARRAY,
      description: 'A list of 3-5 potential issues or validation steps for this configuration.',
      items: { type: Type.STRING }
    }
  },
  required: ['script', 'explanation', 'variables']
};

export const generateConfig = async (
  title: string, 
  userRequirements: string, 
  contextVars: Record<string, string> = {}
): Promise<GeneratedResult> => {
  
  const model = 'gemini-2.5-flash';
  
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
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: scriptResponseSchema,
        temperature: 0.2, // Low temperature for code precision
      }
    });

    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr) as GeneratedResult;

  } catch (error) {
    console.error("Gemini generation error:", error);
    throw new Error("Failed to generate configuration. Please check your API key and try again.");
  }
};

export const troubleshootIssue = async (
  issueDescription: string,
  history: { role: string; text: string }[]
): Promise<string> => {
  
  const model = 'gemini-2.5-flash';
  
  // Convert history to prompt format if needed, or just send as context
  // For simplicity in this strict format, we'll append history to the prompt text
  const historyText = history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n');
  
  const prompt = `
    You are an expert Azure Troubleshooting Assistant.
    
    Conversation History:
    ${historyText}
    
    Current User Issue: ${issueDescription}
    
    Provide a concise, step-by-step troubleshooting guide. 
    If applicable, provide specific PowerShell commands to diagnose the issue (e.g., Test-NetConnection, Get-AzLog).
    Format the response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
         // No schema here, we want freeform chat response
         temperature: 0.4
      }
    });

    return response.text || "I couldn't generate a solution at this time.";
  } catch (error) {
    console.error("Gemini troubleshooting error:", error);
    return "Error contacting the troubleshooting assistant.";
  }
};