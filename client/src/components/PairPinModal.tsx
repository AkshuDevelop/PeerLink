/**
 * ============================================================
 * FILE PURPOSE:
 *   Pair Code PIN Modal matching code.html Lines 217–234.
 *   Allows a user to generate a 6-digit PIN to share with a nearby device,
 *   or enter a 6-digit PIN from another user to pair instantly.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Component
 * ============================================================
 */

import React, { useState } from 'react';
import { useTransfer } from '../context/TransferContext';
import { api } from '../api/httpClient';

export const PairPinModal: React.FC = () => {
  const { isPairModalOpen, closePairModal, showToast } = useTransfer();
  const [pinInput, setPinInput] = useState('');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isPairModalOpen) return null;

  const handleGenerate = async () => {
    try {
      const res = await api.post<{ pin: string }>('/api/contacts/pair-pin/generate', {});
      setGeneratedPin(res.pin);
      showToast(`NEW PIN GENERATED: ${res.pin}`);
    } catch (err: any) {
      showToast(err.message || 'FAILED TO GENERATE PIN');
    }
  };

  const handleRedeem = async () => {
    if (pinInput.length !== 6) {
      alert('ENTER A VALID 6-DIGIT PIN');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/api/contacts/pair-pin/redeem', { pin: pinInput });
      showToast(`EPHEMERAL PIN [${pinInput}] NEGOTIATED. PEER CONNECTED.`);
      closePairModal();
    } catch (err: any) {
      showToast(err.message || 'FAILED TO REDEEM PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="pair-modal" className="fixed inset-0 bg-ink/80 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-cream border-2 border-ink p-6 flex flex-col gap-4 text-ink hard-shadow-ink">
        <div className="flex justify-between items-center border-b-2 border-ink pb-2">
          <span className="font-[800] uppercase text-[16px]">INSTANT PAIR PIN</span>
          <button onClick={closePairModal} className="font-mono font-bold text-[18px]">
            ✕
          </button>
        </div>

        {/* Generate PIN section */}
        <div className="border border-ink/40 p-3 bg-sand/30 font-mono text-[12px] flex flex-col gap-2">
          <span className="font-[700] uppercase text-ink">YOUR PIN FOR THIS DEVICE:</span>
          {generatedPin ? (
            <div className="text-[28px] font-[800] text-cobalt tracking-widest text-center py-1 bg-cream border border-ink">
              {generatedPin}
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="h-9 px-4 rounded-full border border-ink bg-sand hover:bg-cream uppercase font-[700] self-start inline-flex items-center justify-center leading-none"
            >
              GENERATE 6-DIGIT PIN
            </button>
          )}
          <span className="text-[10px] text-ink-muted">PIN expires automatically in 5 minutes.</span>
        </div>

        <p className="text-[13px] font-mono text-ink-muted">
          Or enter a 6-digit ephemeral PIN generated on another device:
        </p>

        <input
          type="text"
          id="pin-input"
          maxLength={6}
          placeholder="849201"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
          className="h-12 border-2 border-ink bg-sand px-4 font-mono font-[800] text-[20px] uppercase text-center focus:border-cobalt focus:ring-0"
        />

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleRedeem}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-full border-2 border-ink bg-cobalt text-cream font-mono font-[700] text-[13px] uppercase hover:bg-sand hover:text-ink transition-colors inline-flex items-center justify-center leading-none"
          >
            {isSubmitting ? 'CONNECTING...' : 'CONNECT PIN'}
          </button>
          <button
            onClick={closePairModal}
            className="px-5 h-11 rounded-full border-2 border-ink bg-sand font-mono font-[700] text-[13px] uppercase hover:bg-cream inline-flex items-center justify-center leading-none"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
