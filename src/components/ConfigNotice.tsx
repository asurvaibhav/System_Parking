import React, { useState } from 'react';
import { Database, Server, Copy, Check, ExternalLink } from 'lucide-react';
import { Card } from './ui/Card';
import { isSupabaseConfigured, supabaseUrl } from '../lib/supabase';

interface ConfigNoticeProps {
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const ConfigNotice: React.FC<ConfigNoticeProps> = ({
  onCloseModal,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const sqlQuickCopy = `-- Run cpvts_schema.sql in Supabase SQL Editor
-- Creates slots, tariffs, session_details view, and check_in/check_out RPCs`;

  const copySqlNotice = () => {
    navigator.clipboard.writeText(sqlQuickCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[#9FE870] text-[#163300] flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Database className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#163300] tracking-tight">
          Supabase Database Connection
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-1 max-w-md mx-auto">
          {isSupabaseConfigured
            ? `Connected to live database at ${supabaseUrl}`
            : 'Configure your Supabase credentials in .env or src/lib/supabaseConfig.ts'}
        </p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              isSupabaseConfigured
                ? 'bg-[#EAF9DD] border-[#D8F2C4] text-[#163300]'
                : 'bg-[#FEECEB] border-[#FCD5D2] text-[#D92D20]'
            }`}
          >
            {isSupabaseConfigured ? '🟢 Live PostgreSQL Connected' : '🔴 Supabase Not Configured'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* SQL Schema Notice */}
        <Card padding="md" className="border-l-4 border-l-[#9FE870]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[#163300] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                <span>Database Schema</span>
              </div>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                The schema file <code className="bg-[#F2F2F0] px-1.5 py-0.5 rounded font-mono text-[#163300]">cpvts_schema.sql</code> includes tables, 100 slots, tariffs matrix, and stored procedures for check-in and checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={copySqlNotice}
              className="text-xs font-semibold text-[#163300] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-[#1F9D55]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy SQL Path'}</span>
            </button>
          </div>
        </Card>

        {/* Credentials instructions */}
        <Card padding="md">
          <h3 className="text-xs font-bold text-[#163300] uppercase tracking-wider mb-2">
            Credentials Configuration
          </h3>
          <p className="text-xs text-[#6B6B6B] leading-relaxed mb-3">
            Configure using Vite environment variables or direct config:
          </p>
          <div className="p-3 bg-[#163300] text-[#9FE870] font-mono text-[11px] rounded-xl overflow-x-auto space-y-1">
            <div>VITE_SUPABASE_URL="https://your-project.supabase.co"</div>
            <div>VITE_SUPABASE_ANON_KEY="your-anon-key"</div>
          </div>
        </Card>

        <div className="pt-2 flex items-center justify-between">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#163300] hover:underline inline-flex items-center gap-1"
          >
            <span>Supabase Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="px-4 py-2 rounded-xl bg-[#163300] text-white text-xs font-bold cursor-pointer hover:bg-[#1f4500]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
