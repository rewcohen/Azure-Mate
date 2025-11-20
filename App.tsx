import React, { useState } from 'react';
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
  
  const [globalVars, setGlobalVars] = useState<GlobalVariables>({
      projectPrefix: 'demo',
      environment: 'dev',
      location: 'eastus',
      costCenter: 'IT-General',
      owner: 'cloud-admin',
      proximityPlacementGroup: ''
  });

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
        {currentView === ViewState.TROUBLESHOOTER && <Troubleshooter />}
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