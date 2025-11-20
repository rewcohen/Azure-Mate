import React, { useState, useRef, useEffect } from 'react';
import { troubleshootIssue } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Send, User, Bot, AlertTriangle, Loader2 } from 'lucide-react';

const Troubleshooter: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Hello! I'm your Azure Troubleshooting Assistant. Describe the issue you're facing (e.g., 'My VM isn't reachable via SSH' or 'Function App returning 503')." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await troubleshootIssue(userMsg.text, messages);
      const botMsg: ChatMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
        const errorMsg: ChatMessage = { role: 'model', text: "I encountered an error connecting to the knowledge base." };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">Troubleshooter</h2>
                <p className="text-sm text-slate-500">Diagnose common deployment and runtime errors</p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                        {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm shadow-sm'
                    }`}>
                        <div className="prose prose-invert prose-sm max-w-none">
                             {msg.text.split('\n').map((line, i) => {
                                // Simple rendering logic for markdown-like lists or code
                                if (line.trim().startsWith('-')) return <li key={i} className="ml-4">{line.replace('-', '').trim()}</li>;
                                if (line.includes('`')) return <p key={i} className="font-mono bg-black/30 p-1 rounded inline-block">{line.replace(/`/g, '')}</p>;
                                return <p key={i}>{line}</p>;
                             })}
                        </div>
                    </div>
                </div>
            ))}
            {loading && (
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                         <Bot className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        <span className="text-xs text-slate-500">Analyzing issue...</span>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="p-6 bg-slate-950 border-t border-slate-800">
        <div className="max-w-3xl mx-auto relative">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your error (e.g., 'Error: AuthorizationFailed when creating RG')..."
                className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl py-4 pl-5 pr-14 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:outline-none transition-all resize-none shadow-lg"
                rows={2}
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-3">
            AI can make mistakes. Verify diagnostic commands before running in production.
        </p>
      </div>
    </div>
  );
};

export default Troubleshooter;