import React, { useEffect, useRef } from 'react';

interface MermaidProps {
  chart: string;
}

declare global {
  interface Window {
    mermaid: any;
  }
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: true,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter',
      });
    }
  }, []);

  useEffect(() => {
    if (ref.current && window.mermaid) {
      // Reset content
      ref.current.removeAttribute('data-processed');

      try {
        window.mermaid.run({
          nodes: [ref.current],
        });
      } catch (e) {
        console.error('Mermaid error:', e);
        ref.current.innerHTML = 'Error rendering diagram.';
      }
    }
  }, [chart]);

  return (
    <div className="flex justify-center p-4 bg-slate-900 rounded-lg border border-slate-800 overflow-auto">
      <div className="mermaid" ref={ref}>
        {chart}
      </div>
    </div>
  );
};

export default Mermaid;
