
import React, { useState, useEffect } from 'react';
import { AzureContext } from '../types';
import { ShieldCheck, Smartphone, Loader2, User, CheckCircle2, X, Globe, Lock, ChevronRight } from 'lucide-react';

interface ConnectWizardProps {
  onClose: () => void;
  onConnect: (ctx: AzureContext) => void;
  onAutoPopulate: (location: string, env: string, owner: string) => void;
}

// Mock Data for Simulation
const MOCK_SUBSCRIPTIONS = [
  { id: "a1b2c3d4-e5f6-7890-1234-567890abcdef", name: "Production Subscription (IT)", location: "eastus", env: "prod" },
  { id: "98765432-10ab-cdef-1234-567890abcdef", name: "Development Sandbox", location: "westeurope", env: "dev" },
  { id: "11223344-5566-7788-9900-aabbccddeeff", name: "Test Environment", location: "westus2", env: "test" }
];

const ConnectWizard: React.FC<ConnectWizardProps> = ({ onClose, onConnect, onAutoPopulate }) => {
  const [step, setStep] = useState<'method' | 'authenticating' | 'mfa' | 'subscriptions' | 'success'>('method');
  const [authCode, setAuthCode] = useState<number>(0);
  const [selectedSub, setSelectedSub] = useState<string>(MOCK_SUBSCRIPTIONS[0].id);

  useEffect(() => {
    if (step === 'authenticating') {
      // Simulate redirection delay
      setTimeout(() => {
        setAuthCode(Math.floor(10 + Math.random() * 89)); // Random 2 digit code
        setStep('mfa');
      }, 2000);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'mfa') {
      // Simulate user approving on phone
      setTimeout(() => {
        setStep('subscriptions');
      }, 3500);
    }
  }, [step]);

  const handleMethodSelect = () => {
    setStep('authenticating');
  };

  const handleFinalize = () => {
    const sub = MOCK_SUBSCRIPTIONS.find(s => s.id === selectedSub);
    if (sub) {
      onConnect({
        isConnected: true,
        subscriptionId: sub.id,
        tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47", // Mock Tenant
        userDisplayName: "Cloud Architect",
        username: "architect@contoso.com"
      });
      onAutoPopulate(sub.location, sub.env, "architect@contoso.com");
      setStep('success');
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Connect to Azure</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 min-h-[300px] flex flex-col">
          
          {/* Step 1: Method Selection */}
          {step === 'method' && (
            <div className="space-y-6 flex-1">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="text-lg font-medium text-white">Sign in to Microsoft Entra ID</h4>
                <p className="text-sm text-slate-400">Securely connect to your Azure Tenant to import context and validate deployments.</p>
              </div>

              <div className="space-y-3">
                <button 
                    onClick={handleMethodSelect}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700 rounded group-hover:bg-blue-600 transition-colors">
                            <User className="w-5 h-5 text-slate-300 group-hover:text-white" />
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-medium text-white">Interactive Login</div>
                            <div className="text-xs text-slate-500">Browser-based authentication</div>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                </button>

                <button 
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed"
                    title="Not available in demo mode"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700 rounded">
                            <ShieldCheck className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-medium text-white">Service Principal</div>
                            <div className="text-xs text-slate-500">Client ID & Secret</div>
                        </div>
                    </div>
                    <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">Pro</div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Authentication Redirect */}
          {step === 'authenticating' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative z-10" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-white">Contacting Microsoft Identity...</h4>
                <p className="text-sm text-slate-400">Redirecting to secure login page.</p>
              </div>
            </div>
          )}

          {/* Step 3: MFA Simulation */}
          {step === 'mfa' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-6">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 animate-bounce">
                <Smartphone className="w-8 h-8 text-emerald-400" />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Approve sign-in request</h4>
                <p className="text-sm text-slate-400 max-w-[250px] mx-auto">
                    Open your Authenticator app and enter the number shown below.
                </p>
              </div>

              <div className="text-4xl font-mono font-bold text-white tracking-widest bg-slate-800 px-6 py-3 rounded-lg border border-slate-700">
                {authCode}
              </div>
              
              <p className="text-xs text-slate-500 animate-pulse">Waiting for approval...</p>
            </div>
          )}

          {/* Step 4: Subscription Selection */}
          {step === 'subscriptions' && (
            <div className="flex flex-col flex-1 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        CA
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">Cloud Architect</div>
                        <div className="text-xs text-slate-400">architect@contoso.com</div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Select Subscription</label>
                    <div className="space-y-2">
                        {MOCK_SUBSCRIPTIONS.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setSelectedSub(sub.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${
                                    selectedSub === sub.id 
                                    ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500' 
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                }`}
                            >
                                <div className="text-sm font-medium text-white">{sub.name}</div>
                                <div className="text-xs text-slate-500 font-mono mt-1">{sub.id}</div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{sub.location}</span>
                                    <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{sub.env}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleFinalize}
                    className="mt-auto w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                >
                    Connect & Auto-Populate
                </button>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
             <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-in zoom-in duration-300" />
                <div>
                    <h4 className="text-xl font-bold text-white">Connected Successfully</h4>
                    <p className="text-sm text-slate-400 mt-2">
                        Global variables have been updated based on your subscription context.
                    </p>
                </div>
             </div>
          )}

        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 w-full">
            <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: step === 'method' ? '10%' : step === 'authenticating' ? '40%' : step === 'mfa' ? '60%' : step === 'subscriptions' ? '90%' : '100%' }}
            ></div>
        </div>
      </div>
    </div>
  );
};

export default ConnectWizard;
