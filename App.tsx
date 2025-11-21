import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Generator from './components/Generator';
import Troubleshooter from './components/Troubleshooter';
import VariablesPage from './components/VariablesPage';
import EndStateDeployment from './components/EndStateDeployment';
import { AzureCategory, ViewState, AzureContext, GlobalVariables, Scenario, ProjectState, SavedDeploymentItem } from './types';

const DEFAULT_GLOBAL_VARS: GlobalVariables = {
    projectPrefix: 'demo',
    environment: 'dev',
    location: 'eastus',
    costCenter: 'IT-General',
    owner: 'cloud-admin',
    proximityPlacementGroup: '',
    ollamaModel: 'llama3'
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.CATALOG);
  const [currentCategory, setCurrentCategory] = useState<AzureCategory | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [azureContext, setAzureContext] = useState<AzureContext>({
      subscriptionId: '',
      tenantId: '',
      isConnected: false
  });
  
  // Load initial state from localStorage or fallback to defaults
  const [globalVars, setGlobalVars] = useState<GlobalVariables>(() => {
      try {
          const saved = localStorage.getItem('azureMate_globalVars');
          if (saved) {
              return JSON.parse(saved);
          }
      } catch (e) {
          console.warn("Failed to load variables from local storage", e);
      }
      
      return DEFAULT_GLOBAL_VARS;
  });

  // Project / Code Cart State - Persisted to localStorage
  const [projectState, setProjectState] = useState<ProjectState>(() => {
      try {
          const saved = localStorage.getItem('azureMate_projectState');
          if (saved) {
              const parsed = JSON.parse(saved);
              // Ensure structure is valid
              if (!Array.isArray(parsed.items)) parsed.items = [];
              
              // Defensive: Filter out any null or malformed items that could crash the app
              parsed.items = parsed.items.filter((i: any) => i && typeof i === 'object' && i.script);
              
              return parsed;
          }
      } catch (e) {
          console.warn("Failed to load project state from local storage", e);
      }
      return {
          name: '',
          items: []
      };
  });

  const handleAddToCart = (item: SavedDeploymentItem) => {
      // If no project name exists, prompt for it
      if (!projectState.name) {
          // Default project name
          const defaultName = `${globalVars.projectPrefix}-deployment`;
          const inputName = window.prompt("Enter a name for this deployment project:", defaultName);
          
          // Use default if user cancelled or entered empty string to ensure item is added
          const name = inputName && inputName.trim() !== "" ? inputName : defaultName;
          
          setProjectState(prev => ({
              name,
              items: [...prev.items, item]
          }));
      } else {
          setProjectState(prev => ({
              ...prev,
              items: [...prev.items, item]
          }));
      }
  };

  const handleRemoveFromCart = (id: string) => {
      if(window.confirm("Remove this deployment item?")) {
          setProjectState(prev => ({
              ...prev,
              items: prev.items.filter(i => i.id !== id)
          }));
      }
  };

  const handleAutoPopulate = (location: string, env: string, owner: string) => {
      setGlobalVars(prev => ({
          ...prev,
          location: location || prev.location,
          environment: env || prev.environment,
          owner: owner || prev.owner
      }));
  };

  const handleStartOver = () => {
    if (window.confirm("⚠️ Start Over?\n\nThis will erase your entire Project Plan (End-State) and reset Global Variables to defaults.\n\nAre you sure you want to proceed?")) {
        setProjectState({ name: '', items: [] });
        setGlobalVars(DEFAULT_GLOBAL_VARS);
        setActiveScenario(null);
        setCurrentView(ViewState.CATALOG);
        setCurrentCategory(null);
    }
  };

  // Auto-save globalVars to localStorage whenever they change
  useEffect(() => {
      localStorage.setItem('azureMate_globalVars', JSON.stringify(globalVars));
  }, [globalVars]);

  // Auto-save projectState to localStorage whenever it changes
  useEffect(() => {
      localStorage.setItem('azureMate_projectState', JSON.stringify(projectState));
  }, [projectState]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar 
        currentCategory={currentCategory} 
        onSelectCategory={setCurrentCategory}
        currentView={currentView}
        onSelectView={setCurrentView}
        azureContext={azureContext}
        onUpdateContext={setAzureContext}
        isWizardActive={!!activeScenario}
        onResetWizard={() => setActiveScenario(null)}
        projectName={projectState.name}
        projectItemCount={projectState.items.length}
        onAutoPopulate={handleAutoPopulate}
        onStartOver={handleStartOver}
      />
      
      <main className="flex-1 overflow-hidden relative">
        {currentView === ViewState.TROUBLESHOOTER && <Troubleshooter globalVars={globalVars} azureContext={azureContext} />}
        {currentView === ViewState.VARIABLES && (
            <VariablesPage config={globalVars} onSave={setGlobalVars} />
        )}
        {currentView === ViewState.END_STATE && (
            <EndStateDeployment project={projectState} onRemoveItem={handleRemoveFromCart} />
        )}
        {(currentView === ViewState.CATALOG || currentView === ViewState.GENERATOR) && (
          <Generator 
            selectedCategory={currentCategory} 
            azureContext={azureContext}
            globalVars={globalVars}
            activeScenario={activeScenario}
            onScenarioChange={setActiveScenario}
            onAddToCart={handleAddToCart}
            projectName={projectState.name}
          />
        )}
      </main>
    </div>
  );
};

export default App;