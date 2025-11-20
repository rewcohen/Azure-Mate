import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Generator from './components/Generator';
import Troubleshooter from './components/Troubleshooter';
import VariablesPage from './components/VariablesPage';
import { AzureCategory, ViewState, AzureContext, GlobalVariables } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.CATALOG);
  const [currentCategory, setCurrentCategory] = useState<AzureCategory | null>(null);
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
      
      return {
          projectPrefix: 'demo',
          environment: 'dev',
          location: 'eastus',
          costCenter: 'IT-General',
          owner: 'cloud-admin',
          proximityPlacementGroup: '',
          ollamaModel: 'llama3'
      };
  });

  // Auto-save globalVars to localStorage whenever they change
  useEffect(() => {
      localStorage.setItem('azureMate_globalVars', JSON.stringify(globalVars));
  }, [globalVars]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar 
        currentCategory={currentCategory} 
        onSelectCategory={setCurrentCategory}
        currentView={currentView}
        onSelectView={setCurrentView}
        azureContext={azureContext}
        onUpdateContext={setAzureContext}
      />
      
      <main className="flex-1 overflow-hidden relative">
        {currentView === ViewState.TROUBLESHOOTER && <Troubleshooter globalVars={globalVars} />}
        {currentView === ViewState.VARIABLES && (
            <VariablesPage config={globalVars} onSave={setGlobalVars} />
        )}
        {(currentView === ViewState.CATALOG || currentView === ViewState.GENERATOR) && (
          <Generator 
            selectedCategory={currentCategory} 
            azureContext={azureContext}
            globalVars={globalVars}
          />
        )}
      </main>
    </div>
  );
};

export default App;