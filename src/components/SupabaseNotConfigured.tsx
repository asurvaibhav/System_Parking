import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink, Terminal, ShieldAlert } from 'lucide-react';

export const SupabaseNotConfigured: React.FC = () => {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const envTemplate = `VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`;

  const configTemplate = `// src/lib/supabaseConfig.ts
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F6] flex flex-col justify-center items-center p-6 select-none">
      <div className="w-full max-w-xl bg-white border border-[#E5E5E5] rounded-3xl p-8 shadow-sm">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#FEECEB] border border-[#FCD5D2] flex items-center justify-center mx-auto mb-5 text-[#D92D20]">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#163300] tracking-tight">
            Supabase is not configured
          </h1>
          <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed max-w-md mx-auto">
            CPVTS operates exclusively with a real PostgreSQL database backend via Supabase. Provide your project URL and public anon key to activate gate operations.
          </p>
        </div>

        {/* Step 1: Environment Variables */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#F9FAF8] border border-[#E0EBD8]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#163300] flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#1F9D55]" />
                Option 1: Add to .env (Recommended)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(envTemplate, setCopiedEnv)}
                className="text-[11px] font-semibold text-[#163300] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedEnv ? <Check className="w-3.5 h-3.5 text-[#1F9D55]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEnv ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#163300] text-[#9FE870] font-mono text-[11px] rounded-xl overflow-x-auto">
              {envTemplate}
            </pre>
          </div>

          {/* Option 2: Edit src/lib/supabaseConfig.ts */}
          <div className="p-4 rounded-2xl bg-[#F9FAF8] border border-[#E0EBD8]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#163300] flex items-center gap-1.5">
                <Database className="w-4 h-4 text-[#1F9D55]" />
                Option 2: Edit src/lib/supabaseConfig.ts
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(configTemplate, setCopiedCode)}
                className="text-[11px] font-semibold text-[#163300] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#1F9D55]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#163300] text-[#9FE870] font-mono text-[11px] rounded-xl overflow-x-auto">
              {configTemplate}
            </pre>
          </div>
        </div>

        {/* Database setup instructions */}
        <div className="mt-6 pt-5 border-t border-[#ECECEC] text-center space-y-2">
          <p className="text-[11px] text-[#6B6B6B]">
            Ensure you run <code className="bg-[#EAEAEA] px-1.5 py-0.5 rounded font-mono text-[#163300]">cpvts_schema.sql</code> in your Supabase SQL Editor to initialize the 100 slots, tariffs, and stored procedures.
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163300] hover:underline"
          >
            <span>Open Supabase Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
