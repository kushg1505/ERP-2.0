"use client";

import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function DisclaimerModal({ isOpen, onAccept, onCancel }: DisclaimerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="w-7 h-7" />
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">⚠️ Quick Note</h3>
          </div>
          
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            <p>
              BunkWise is designed to provide accurate and up-to-date academic schedules. However, in rare cases, data or technical discrepancies may occur.
            </p>
            <p>
              Please verify important classes with the official college timetable. BunkWise cannot be held responsible for missed classes resulting from any such discrepancies.
            </p>
            <p className="text-slate-800 dark:text-slate-200 font-bold">
              Thank you for understanding!
            </p>
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onAccept}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow flex items-center gap-2 transition-all active:scale-95"
          >
            I understand
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
