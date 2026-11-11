/**
 * ============================================================
 * FILE PURPOSE:
 *   System Notification Toast component matching code.html Lines 236–240.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Component
 * ============================================================
 */

import React, { useEffect } from 'react';
import { useTransfer } from '../context/TransferContext';

export const Toast: React.FC = () => {
  const { toastMessage, showToast } = useTransfer();

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      showToast('');
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage, showToast]);

  if (!toastMessage) return null;

  return (
    <div
      id="system-toast"
      className="fixed bottom-14 right-6 z-50 bg-ink text-cream border-2 border-sand p-4 font-mono text-[13px] font-[700] flex items-center gap-3 shadow-2xl"
    >
      <span className="w-2.5 h-2.5 bg-coral inline-block"></span>
      <span id="toast-text">{toastMessage}</span>
    </div>
  );
};
