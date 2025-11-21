# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Azure Architect Mate is a React-based web application that helps users generate Azure PowerShell deployment scripts through an interactive wizard interface. The application provides pre-configured scenarios across multiple Azure categories (Compute, Networking, Storage, etc.) with template-based script generation, cost estimation, and deployment planning capabilities.

## Prerequisites and Setup

- Node.js
- Ollama (for local LLM features, must be running at http://localhost:11434)
- Docker (optional)

**Setup commands:**
```bash
npm install
npm run dev      # Start development server on port 3000
npm run build    # Build for production (runs TypeScript check + Vite build)
npm run preview  # Preview production build
```

## Architecture

### State Management

The application uses React's built-in state management with `useState` and `useEffect` hooks. State is organized hierarchically:

- **App.tsx**: Root-level state management
  - `currentView`: Controls which page is displayed (CATALOG, GENERATOR, TROUBLESHOOTER, VARIABLES, END_STATE)
  - `azureContext`: Azure connection information (subscriptionId, tenantId, isConnected)
  - `globalVars`: Project-wide configuration (projectPrefix, environment, location, costCenter, owner, proximityPlacementGroup, ollamaModel)
  - `projectState`: Deployment cart containing saved deployment items
  - State persists to localStorage for `globalVars` and `projectState`

### Core Data Flow

1. **Scenario Selection**: User browses scenarios from `constants.ts` (SCENARIOS array)
2. **Wizard Input**: User fills out scenario-specific inputs via `ConnectWizard.tsx`
3. **Template Processing**: `templateEngine.ts` substitutes variables into PowerShell templates
4. **Script Generation**: Either template-based (from `constants.ts`) or LLM-based (via `ollamaService.ts`)
5. **Cost Estimation**: `pricingService.ts` calculates estimated Azure costs
6. **Deployment Cart**: Scripts can be added to `projectState` for batch deployment

### Key Services

- **templateEngine.ts**: Variable substitution engine
  - `generateScriptFromTemplate()`: Replaces `{{placeholders}}` with actual values
  - `processDiagramTemplate()`: Processes Mermaid diagrams with real resource names
  - Substitution order: Global Variables → Wizard Inputs → Azure Context

- **ollamaService.ts**: Ollama LLM integration (local)
  - `generateConfig()`: Generates PowerShell scripts using Ollama API
  - `troubleshootIssue()`: Provides troubleshooting guidance
  - Default endpoint: `http://localhost:11434`
  - No API key required (fully local)

- **pricingService.ts**: Azure cost estimation with mock pricing data

- **mockDeployment.ts**: Simulates PowerShell script execution for testing

- **mockResourceGraph.ts**: Simulates Azure Resource Graph queries

- **azureStatusService.ts**: Fetches Azure service health status

### Component Structure

- **App.tsx**: Main application container with routing logic
- **Sidebar.tsx**: Navigation and Azure connection management
- **Generator.tsx**: Scenario catalog and wizard orchestration
- **ConnectWizard.tsx**: Multi-step form for scenario inputs
- **ScriptDisplay.tsx**: PowerShell script viewer with syntax highlighting
- **EndStateDeployment.tsx**: Deployment cart/project management
- **Troubleshooter.tsx**: Interactive troubleshooting chat
- **VariablesPage.tsx**: Global configuration editor
- **Mermaid.tsx**: Architecture diagram renderer
- **TerminalOutput.tsx**: Command output display

### Scenario Definition

Scenarios are defined in `constants.ts` with the following structure:
- `id`: Unique identifier
- `category`: AzureCategory enum value
- `title` and `description`: Display information
- `inputs`: Array of wizard form fields (text, select, number, boolean)
- `scriptTemplate`: PowerShell template with `{{variable}}` placeholders
- `diagramCode`: Mermaid diagram definition
- `whatItDoes`, `limitations`, `commonIssues`: Educational content
- `learnLinks`: External documentation references
- `prerequisites`: Array of scenario IDs that must be deployed first

### Template Variable System

Three levels of variables are substituted into templates:

1. **Global Variables** (from `globalVars`):
   - `{{projectPrefix}}`, `{{environment}}`, `{{location}}`, `{{costCenter}}`, `{{owner}}`, `{{proximityPlacementGroup}}`

2. **Wizard Inputs** (scenario-specific):
   - Defined in `scenario.inputs[]`
   - Example: `{{vmName}}`, `{{vmSize}}`, `{{nodeCount}}`

3. **Azure Context** (from connection):
   - `{{subscriptionId}}`, `{{tenantId}}`

## TypeScript Configuration

The project uses strict TypeScript with the following key settings:
- Target: ES2020
- Module: ESNext with bundler resolution
- JSX: react-jsx (React 18 automatic runtime)
- `noEmit: true` (Vite handles compilation)
- Strict mode enabled

## Common Development Patterns

### Adding a New Scenario

1. Add scenario definition to `SCENARIOS` array in `constants.ts`
2. Define `inputs[]` with required form fields
3. Write `scriptTemplate` with PowerShell code using `{{placeholders}}`
4. Create `diagramCode` with Mermaid syntax
5. Fill in `whatItDoes`, `limitations`, `commonIssues` arrays
6. Test template variable substitution

### Working with State Persistence

Both `globalVars` and `projectState` auto-save to localStorage on change via `useEffect` hooks in App.tsx. Always update state through setter functions to trigger persistence.

### Handling Azure Context

Check `azureContext.isConnected` before using subscription/tenant IDs. The template engine provides fallback placeholders when not connected.
