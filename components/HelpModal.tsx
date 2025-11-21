import React from 'react';
import { X, Book, Lightbulb, Star, Heart } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Application Guide</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          {/* Instructions */}
          <section>
            <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-500/10 text-blue-400"><Book className="w-4 h-4" /></div>
              How to Navigate
            </h4>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p><strong>1. Connect:</strong> Use the sidebar to connect to your Azure Tenant. This imports your subscription context.</p>
                <p><strong>2. Configure:</strong> Set global variables (Tags, Location, Naming Standards) in the 'Global Config' page.</p>
                <p><strong>3. Generate:</strong> Browse the 'Config Library' to find scenarios (VMs, AKS, etc.). Customize inputs and view generated code, diagrams, and costs.</p>
                <p><strong>4. Plan:</strong> Add items to your 'End-State Plan' cart. Review the aggregated architecture and costs.</p>
                <p><strong>5. Audit:</strong> Use the 'Troubleshooter' to validate deployed resources against your standards.</p>
            </div>
          </section>

          {/* Features */}
          <section>
            <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
               <div className="p-1.5 rounded bg-purple-500/10 text-purple-400"><Star className="w-4 h-4" /></div>
               Key Features
            </h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Real-time Azure Pricing Estimates</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Live Architecture Diagrams (Mermaid)</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Best-Practice PowerShell Generation</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Offline & Live Environment Auditing</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Custom AI-generated Configurations</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Exportable Deployment Plans</li>
            </ul>
          </section>

           {/* Tips */}
           <section>
            <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
               <div className="p-1.5 rounded bg-amber-500/10 text-amber-400"><Lightbulb className="w-4 h-4" /></div>
               Pro Tips
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
                <li className="bg-slate-800/50 p-3 rounded border border-slate-800">
                    <strong className="text-white">Mock Deployments:</strong> You can run "mock" deployments on generated scripts to see simulated logs without touching Azure.
                </li>
                <li className="bg-slate-800/50 p-3 rounded border border-slate-800">
                    <strong className="text-white">Variable Persistence:</strong> Your Project Cart and Global Variables are saved automatically to your browser's local storage.
                </li>
            </ul>
          </section>

          {/* Inspirational Message */}
          <div className="mt-8 pt-8 border-t border-slate-800 text-center">
             <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full mb-4">
                 <Heart className="w-6 h-6 text-pink-400 fill-pink-400/20" />
             </div>
             <blockquote className="text-lg font-medium text-white italic mb-2">
                "Never give up, and always stand up for what you believe in but don't let your mind be so rigid that you can't change it."
             </blockquote>
             <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Architecture requires balance</p>
          </div>

        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900">
            <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors border border-slate-700">
                Close Guide
            </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;