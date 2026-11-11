/**
 * ============================================================
 * FILE PURPOSE:
 *   Route 11 — Transmission Logs Page matching code.html Lines 1084–1148.
 *   Provides live log searching, directional filtering (ALL, SENT, RECEIVED),
 *   CSV export, and row purging via DELETE /api/transfers/:id.
 *
 * ARCHITECTURAL LAYER:
 *   Frontend UI — Page Component
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';
import { useTransfer } from '../context/TransferContext';
import type { Transfer } from '../types/peerlink';

export const LogsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useTransfer();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'OUTGOING' | 'INCOMING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await api.get<{ transfers: Transfer[] }>('/api/transfers/history?limit=100');
      setTransfers(res.transfers);
    } catch (err: any) {
      showToast(err.message || 'FAILED TO LOAD LOGS');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const handleDelete = async (id: string, sessionCode: string) => {
    if (!window.confirm(`PURGE RECORD: Delete session ${sessionCode} from local audit register?`)) return;
    try {
      await api.delete(`/api/transfers/${id}`);
      showToast(`SESSION ${sessionCode} PURGED.`);
      setTransfers((prev) => prev.filter((t) => t._id !== id));
    } catch (err: any) {
      showToast(err.message || 'FAILED TO PURGE RECORD');
    }
  };

  const handleExportCSV = () => {
    let csv = 'SESSION ID,DIR,PEER,PAYLOAD,SIZE,RATE,TIMESTAMP,STATUS\n';
    transfers.forEach((r) => {
      const isOutgoing = (r.sender._id || r.sender.id) === (user?.id || user?._id);
      const dir = isOutgoing ? 'OUTGOING' : 'INCOMING';
      const peer = isOutgoing ? r.recipient.handle : r.sender.handle;
      const sizeMB = (r.sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      const rate = `${r.averageSpeedMBps || 0} MB/S`;
      csv += `"${r.sessionCode}","${dir}","${peer}","${r.filename}","${sizeMB}","${rate}","${r.createdAt}","${r.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `peerlink-telemetry-${Date.now()}.csv`;
    a.click();
    showToast('CSV EXPORTED.');
  };

  const filteredTransfers = transfers.filter((r) => {
    const isOutgoing = (r.sender._id || r.sender.id) === (user?.id || user?._id);
    if (filterType === 'OUTGOING' && !isOutgoing) return false;
    if (filterType === 'INCOMING' && isOutgoing) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchFile = r.filename.toLowerCase().includes(q);
      const matchPeer = (isOutgoing ? r.recipient.handle : r.sender.handle).toLowerCase().includes(q);
      const matchSession = r.sessionCode.toLowerCase().includes(q);
      return matchFile || matchPeer || matchSession;
    }
    return true;
  });

  return (
    <>
      {/* Ink Header */}
      <section className="w-full bg-ink text-cream border-b-2 border-ink py-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-[12px] font-mono font-[700] uppercase tracking-widest text-coral">
              // PERSISTENT TELEMETRY ARCHIVE
            </span>
            <h2 className="text-[40px] md:text-[56px] font-[800] uppercase tracking-tight leading-none mt-1">
              TRANSMISSION LOGS
            </h2>
          </div>
          <button
            onClick={handleExportCSV}
            className="h-[46px] px-6 rounded-full border-2 border-cream bg-sand text-ink font-mono font-[700] text-[13px] uppercase hover:bg-cream transition-colors"
          >
            EXPORT CSV
          </button>
        </div>
      </section>

      {/* Search & Table */}
      <section className="w-full bg-cream text-ink py-10 pb-24 md:pb-10 flex-grow overflow-x-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col gap-6">
          <div className="border-2 border-ink bg-sand p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <input
              type="text"
              id="logs-filter-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="SEARCH LOGS BY FILENAME OR PEER..."
              className="w-full md:w-80 h-10 border-2 border-ink bg-cream px-3 font-mono text-[12px] font-[700] uppercase focus:ring-0 focus:border-cobalt"
            />
            <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] font-[700]">
              <span>FILTER:</span>
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 border-2 border-ink ${filterType === 'ALL' ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterType('OUTGOING')}
                className={`px-3 py-1 border-2 border-ink ${filterType === 'OUTGOING' ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
              >
                SENT
              </button>
              <button
                onClick={() => setFilterType('INCOMING')}
                className={`px-3 py-1 border-2 border-ink ${filterType === 'INCOMING' ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
              >
                RECEIVED
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border-2 border-ink bg-cream overflow-x-auto">
            <table id="logs-table" className="w-full text-left border-collapse font-mono text-[13px]">
              <thead>
                <tr className="bg-sand border-b-2 border-ink text-[11px] font-[800] uppercase">
                  <th className="p-3">SESSION ID</th>
                  <th className="p-3">DIR</th>
                  <th className="p-3">PEER</th>
                  <th className="p-3">PAYLOAD</th>
                  <th className="p-3">SIZE</th>
                  <th className="p-3">RATE</th>
                  <th className="p-3">TIMESTAMP</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3">PURGE</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-ink-muted">
                      NO TRANSMISSION LOGS FOUND.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((row) => {
                    const isOutgoing = (row.sender._id || row.sender.id) === (user?.id || user?._id);
                    const peerHandle = isOutgoing ? row.recipient.handle : row.sender.handle;
                    const sizeMB = (row.sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
                    const dateFormatted = new Date(row.createdAt).toLocaleDateString();

                    return (
                      <tr key={row._id} className="hover:bg-sand/40">
                        <td className="p-3 font-[700]">
                          <Link to={`/transfer/${row.sessionCode}/details`} className="underline hover:text-cobalt">
                            {row.sessionCode}
                          </Link>
                        </td>
                        <td className={`p-3 font-[700] ${!isOutgoing ? 'text-cobalt' : 'text-coral'}`}>
                          {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                        </td>
                        <td className="p-3 font-[700] uppercase">@{peerHandle}</td>
                        <td className="p-3 font-[700] truncate max-w-[200px]" title={row.filename}>
                          {row.filename}
                        </td>
                        <td className="p-3">{sizeMB}</td>
                        <td className="p-3 text-cobalt font-[700]">{row.averageSpeedMBps || 0} MB/S</td>
                        <td className="p-3 text-[11px] text-ink-muted">{dateFormatted}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 border border-ink text-[11px] font-[800] bg-cream">
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDelete(row._id, row.sessionCode)}
                            className="text-coral font-[700] hover:underline"
                            title="Purge Record"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
};
