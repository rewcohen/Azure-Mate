import React from 'react';
import { ViewState } from '../types';
import { 
  Shield, 
  Settings, 
  Box, 
  ShoppingCart, 
  Wrench, 
  ArrowRight, 
  LogIn,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface HomeProps {
  onNavigate: (view: ViewState) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const steps = [
    {
      id: 1,
      title: "Connect Identity",
      description: "Authenticate with your Azure Tenant via the sidebar to import subscription context and existing policies.",
      icon: LogIn,
      action: null, // Handled by sidebar
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20"
    },
    {
      id: 2,
      title: "Define Standards",
      description: "Set global variables like Project Prefix, Environment, Location, and Cost Center tags that apply to all scripts.",
      icon: Settings,
      action: ViewState.VARIABLES,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20"
    },
    {
      id: 3,
      title: "Select Scenarios",
      description: "Browse the Configuration Library to find best-practice templates for Compute, Network, and Security.",
      icon: Box,
      action: ViewState.CATALOG,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20"
    },
    {
      id: 4,
      title: "Build Plan",
      description: "Review your End-State Plan, check estimated costs, and export the finalized deployment scripts.",
      icon: ShoppingCart,
      action: ViewState.END_STATE,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20"
    },
    {
      id: 5,
      title: "Audit & Verify",
      description: "Use the Troubleshooter to scan deployed resources against your defined standards and detect drift.",
      icon: Wrench,
      action: ViewState.TROUBLESHOOTER,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Hero Section */}
      <div className="relative border-b border-slate-800 bg-slate-900/50">
        <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center]"></div>
        <div className="relative max-w-5xl mx-auto px-8 py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-blue-600 shadow-lg shadow-blue-900/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Azure Architect Mate</h1>
          </div>
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
            Your AI-powered companion for standardizing, generating, and auditing Azure infrastructure. 
            Follow the workflow below to ensure compliant and cost-optimized deployments.
          </p>
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-5 h-5 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Deployment Workflow</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div 
              key={step.id} 
              className={`relative group bg-slate-900 border rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${step.borderColor} hover:border-opacity-50 border-slate-800`}
            >
              <div className="absolute top-4 right-4 text-4xl font-bold text-slate-800 select-none opacity-50">
                0{step.id}
              </div>
              
              <div className={`w-12 h-12 rounded-lg ${step.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <step.icon className={`w-6 h-6 ${step.color}`} />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed min-h-[60px]">
                {step.description}
              </p>

              {step.action ? (
                <button 
                  onClick={() => onNavigate(step.action as ViewState)}
                  className={`flex items-center gap-2 text-sm font-bold ${step.color} hover:underline group-hover:translate-x-1 transition-transform`}
                >
                  Go to {step.title} <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                  Use Sidebar <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-6 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold mb-1">Ready to start?</h4>
            <p className="text-sm text-slate-400">You can jump to any section at any time using the sidebar.</p>
          </div>
          <button 
            onClick={() => onNavigate(ViewState.CATALOG)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            Start New Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;