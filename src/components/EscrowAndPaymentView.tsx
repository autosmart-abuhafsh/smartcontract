import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Scale,
  Cpu,
  Download,
  RefreshCw,
} from 'lucide-react';
import { SmartBuildDatabase } from '../data/seedDatabase';
import {
  RoleId,
  ComplianceCheckResult,
  SmartContractTransitionInput,
  canRolePerformAction,
} from '../logic/smartbuildEngine';
import { formatRupiah } from './ExecutiveDashboardView';

interface EscrowAndPaymentViewProps {
  mode: 'milestones' | 'escrow' | 'payments' | 'disputes' | 'transactions';
  db: SmartBuildDatabase & {
    complianceByMilestone: Record<string, ComplianceCheckResult>;
  };
  activeRole: RoleId;
  activeUserId: string;
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onRefresh: () => void;
  onRequestMfa: (params: {
    actionType: 'PERSETUJUAN_PEMBAYARAN' | 'OTORISASI_PENCAIRAN';
    actionTitle: string;
    onSuccess: (token: string) => void;
  }) => void;
}

export const EscrowAndPaymentView: React.FC<EscrowAndPaymentViewProps> = ({
  mode,
  db,
  activeRole,
  activeUserId,
  selectedProjectId,
  onSelectProject,
  onRefresh,
  onRequestMfa,
}) => {
  const currentProject =
    db.projects.find((p) => p.id === selectedProjectId) || db.projects[0];
  const currentContract =
    db.contracts.find((c) => c.projectId === currentProject.id) || db.contracts[0];
  const currentRules =
    db.contractRules.find((r) => r.contractId === currentContract.id) || db.contractRules[0];
  const projectMilestones = db.paymentMilestones.filter(
    (m) => m.projectId === currentProject.id
  );
  const currentEscrow =
    db.escrowRecords.find((e) => e.projectId === currentProject.id) || db.escrowRecords[0];

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(
    projectMilestones[1]?.id || projectMilestones[0]?.id || ''
  );
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Dispute form state
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeEvidenceName, setDisputeEvidenceName] = useState<string>(
    'laporan_ketidaksesuaian_spesifikasi.pdf'
  );
  const [resolutionBasis, setResolutionBasis] = useState<string>('');

  const activeMilestone =
    projectMilestones.find((m) => m.id === selectedMilestoneId) || projectMilestones[0];
  const activeCompliance = activeMilestone
    ? db.complianceByMilestone[activeMilestone.id]
    : undefined;

  const handleOwnerApproveWithMfa = (msId: string, msName: string) => {
    setStatusMsg('');
    setErrorMsg('');
    onRequestMfa({
      actionType: 'PERSETUJUAN_PEMBAYARAN',
      actionTitle: `Persetujuan Pemilik Proyek & Otorisasi MFA — ${msName}`,
      onSuccess: async (mfaToken) => {
        const res = await fetch(`/api/milestones/${msId}/approve-owner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorRole: activeRole,
            actorId: activeUserId,
            mfaToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Gagal menyetujui pembayaran.');
        } else {
          setStatusMsg(
            `Persetujuan Pemilik Proyek & Otorisasi MFA (${mfaToken}) berhasil diverifikasi. Tahap siap diproses.`
          );
          onRefresh();
        }
      },
    });
  };

  const handleDisburseMilestone = async (msId: string) => {
    setStatusMsg('');
    setErrorMsg('');
    const res = await fetch(`/api/milestones/${msId}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Pencairan ditolak oleh mesin kepatuhan kontrak.');
    } else {
      setStatusMsg(
        `Pencairan Escrow berhasil dieksekusi pada H${data.smartContractTransition.currentH}! Nomor Referensi: ${data.transaction.transactionNumber} [DEMO].`
      );
      onRefresh();
    }
  };

  const handleSmartContractStep = async (
    msId: string,
    event: SmartContractTransitionInput['event']
  ) => {
    setStatusMsg('');
    setErrorMsg('');
    const res = await fetch('/api/smart-contract/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneId: msId,
        event,
        actorId: activeUserId,
        actorRole: activeRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal menjalankan transisi state machine.');
    } else {
      setStatusMsg(data.transition.description);
      onRefresh();
    }
  };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    if (!disputeReason.trim()) {
      setErrorMsg('Alasan pengajuan keberatan/sengketa wajib diisi.');
      return;
    }
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        projectId: currentProject.id,
        contractId: currentContract.id,
        milestoneId: activeMilestone.id,
        reason: disputeReason,
        evidenceAttachmentName: disputeEvidenceName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal mengajukan sengketa.');
    } else {
      setDisputeReason('');
      setStatusMsg(
        'Keberatan/sengketa berhasil diajukan. Sistem otomatis mengunci pencairan dana pada tahap ini (H185).'
      );
      onRefresh();
    }
  };

  const handleResolveDispute = async (
    disputeId: string,
    ruling: 'Terbukti (Wajib Perbaikan H190-H195)' | 'Tidak Terbukti (Lanjut Pencairan H195)'
  ) => {
    setStatusMsg('');
    setErrorMsg('');
    const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        ruling,
        decisionBasis:
          resolutionBasis.trim() ||
          'Keputusan hasil pemeriksaan bukti teknis terhadap kontrak awal oleh pihak berwenang.',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal menetapkan keputusan sengketa.');
    } else {
      setStatusMsg(`Keputusan sengketa (${ruling}) berhasil ditetapkan dan dicatat pada Audit Trail.`);
      setResolutionBasis('');
      onRefresh();
    }
  };

  // --- MODE 1: MILESTONE PAYMENT & AUTOMATED COMPLIANCE ENGINE (Bagian 7 & 13 PRD) ---
  if (mode === 'milestones') {
    const totalPct = projectMilestones.reduce((s, m) => s + m.percentage, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Milestone Payment & Automated Compliance Engine — {currentProject.name}
            </h2>
            <p className="text-xs text-slate-500">
              Total Nilai Kontrak:{' '}
              <span className="font-mono font-bold text-slate-900">
                {formatRupiah(currentContract.contractValue)}
              </span>{' '}
              · Total Persentase Tahapan:{' '}
              <span className="font-mono font-bold text-emerald-700">{totalPct}%</span>. Dana
              terkunci otomatis apabila salah satu syarat kontrak belum terpenuhi.
            </p>
          </div>

          <select
            aria-label="Pilih Proyek untuk Milestone Payment"
            value={selectedProjectId}
            onChange={(e) => {
              onSelectProject(e.target.value);
              const firstMs = db.paymentMilestones.find((m) => m.projectId === e.target.value);
              if (firstMs) setSelectedMilestoneId(firstMs.id);
            }}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-slate-50"
          >
            {db.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {statusMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Milestone Cards */}
          <div className="lg:col-span-5 space-y-3">
            {projectMilestones.map((ms) => {
              const comp = db.complianceByMilestone[ms.id];
              const isSelected = ms.id === activeMilestone?.id;
              return (
                <div
                  key={ms.id}
                  onClick={() => setSelectedMilestoneId(ms.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-600'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{ms.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Bobot {ms.percentage}% · Progres Fisik {ms.workProgress}% · H
                        {ms.smartContractCurrentH}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-slate-900">
                        {formatRupiah(ms.amount)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          ms.status === 'Berhasil dicairkan'
                            ? 'text-emerald-700'
                            : ms.status === 'Ditolak' || ms.status === 'Ditahan karena sengketa'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ms.status}
                      </div>
                    </div>
                  </div>

                  {comp && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Hasil Mesin Kepatuhan:</span>
                      <span
                        className={`font-semibold ${
                          comp.compliant
                            ? 'text-emerald-700'
                            : comp.overallVerdict === 'Terhalang sengketa'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ms.status === 'Berhasil dicairkan'
                          ? 'Telah Dicairkan (Idempotent Locked)'
                          : comp.overallVerdict}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right 7 Cols: Automated Compliance Engine Breakdown & Authorization Gate */}
          {activeMilestone && activeCompliance && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    Pemeriksaan Persyaratan Otomatis (Bagian 7.3 & Bagian 13 PRD)
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {activeMilestone.name} — {formatRupiah(activeMilestone.amount)}
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  {activeCompliance.compliant ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <Unlock className="w-4 h-4" /> Memenuhi Persyaratan Pencairan
                    </span>
                  ) : (
                    <span className="text-amber-700 inline-flex items-center gap-1">
                      <Lock className="w-4 h-4" /> Dana Terkunci ({activeCompliance.overallVerdict})
                    </span>
                  )}
                </div>
              </div>

              {/* Three Distinct Statuses Required by Bagian 16 PRD */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs">
                <div>
                  <div className="text-slate-500">1. Status Persetujuan</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {activeMilestone.approvalStatus}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">2. Status Otorisasi MFA</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {activeMilestone.authorizationStatus}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">3. Status Transaksi Pembayaran</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {activeMilestone.transactionStatus}
                  </div>
                </div>
              </div>

              {/* Detailed Compliance Checks List with Explicit Reasons */}
              <div className="space-y-2">
                {activeCompliance.checks.map((chk) => (
                  <div
                    key={chk.code}
                    className={`p-3 rounded-md border text-xs flex items-start gap-2.5 ${
                      chk.passed
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-red-50/50 border-red-200'
                    }`}
                  >
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900">{chk.label}</div>
                      <div className="text-slate-700 mt-0.5">{chk.reason}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Gate: Never a simple release button! Requires Owner Approval + MFA + Full Compliance */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                {activeRole === 'PROJECT_OWNER' &&
                  activeMilestone.status !== 'Berhasil dicairkan' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOwnerApproveWithMfa(activeMilestone.id, activeMilestone.name)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      1. Setujui Pembayaran & Verifikasi MFA OTP (Pemilik Proyek)
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => handleDisburseMilestone(activeMilestone.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    activeCompliance.compliant
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  2. Eksekusi Pencairan Smart Contract Escrow [DEMO]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- MODE 2: ESCROW MANAGEMENT & WORKFLOW SMART CONTRACT H0-H200 (Bagian 7.4 & 14 PRD) ---
  if (mode === 'escrow') {
    const tl = currentRules.timelineConfig;

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Escrow Management & Workflow Smart Contract H{tl.H0}–H{tl.H200} [DEMO SIMULATION]
              </h2>
              <p className="text-xs text-slate-500">
                Simulasi penyimpanan dana Escrow dan State Machine alur keputusan H0–H200 sesuai
                diagram konsep klien.
              </p>
            </div>
          </div>

          <select
            aria-label="Pilih Proyek untuk Escrow"
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-slate-50"
          >
            {db.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Escrow Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Total Setoran Escrow (H{tl.H0})</div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatRupiah(currentEscrow.depositedAmount)}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">[SIMULASI DEMO]</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Saldo Dana Ditahan (Terkunci)</div>
            <div className="text-lg font-bold font-mono text-amber-700 mt-1">
              {formatRupiah(currentEscrow.heldAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dijaga oleh Rule Engine</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Total Dana Dicairkan</div>
            <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
              {formatRupiah(currentEscrow.disbursedAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Lulus Verifikasi & MFA</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Alamat Smart Contract [DEMO]</div>
            <div className="text-xs font-bold font-mono text-sky-900 truncate mt-1.5">
              {currentEscrow.smartContractAddress}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{currentEscrow.status}</div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900">
            {statusMsg}
          </div>
        )}

        {/* Interactive H0-H200 Diagram & State Machine Simulator (Bagian 14 PRD) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Diagram State Machine Alur Smart Contract (H{tl.H0} s/d H{tl.H200})
              </h3>
              <p className="text-xs text-slate-500">
                Pilih tahapan pembayaran untuk melihat posisi state machine dan menguji cabang
                keputusan Cabang A (Syarat Terpenuhi) maupun Cabang B (Syarat Tidak Terpenuhi).
              </p>
            </div>
            <select
              value={activeMilestone?.id || ''}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-slate-50"
            >
              {projectMilestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — Posisi: H{m.smartContractCurrentH} ({m.smartContractState})
                </option>
              ))}
            </select>
          </div>

          {/* Visual Flow Diagram Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-md border border-slate-300 bg-slate-50 space-y-1">
              <div className="font-mono font-bold text-slate-900">1. H{tl.H0} — Setoran Dana</div>
              <p className="text-slate-600">
                Pengguna jasa menyetorkan dana ke Smart Contract Escrow.
              </p>
            </div>
            <div className="p-3.5 rounded-md border border-slate-300 bg-slate-50 space-y-1">
              <div className="font-mono font-bold text-slate-900">
                2. H{tl.H0}–H{tl.H180} — Pelaksanaan & Bukti
              </div>
              <p className="text-slate-600">
                Periode pelaksanaan pekerjaan & maksimal H{tl.H180} penilaian bukti digital.
              </p>
            </div>
            <div className="p-3.5 rounded-md border border-sky-300 bg-sky-50 space-y-1">
              <div className="font-mono font-bold text-sky-950">
                3. H{tl.H180}–H{tl.H185} — Proses Validasi
              </div>
              <p className="text-sky-900">
                Validasi persyaratan kontrak oleh Pengawas, Verifikator, dan Rule Engine.
              </p>
            </div>
            <div className="p-3.5 rounded-md border border-amber-300 bg-amber-50 space-y-1">
              <div className="font-mono font-bold text-amber-950">
                CABANG B (H{tl.H185}) — Syarat Tidak Terpenuhi
              </div>
              <p className="text-amber-900">
                Dana tetap tertahan. Pencairan tidak dilakukan sampai persyaratan terpenuhi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-md border border-emerald-300 bg-emerald-50 space-y-1">
              <div className="font-mono font-bold text-emerald-950">
                CABANG A.1 (H{tl.H188}) — Kedua Pihak Setuju
              </div>
              <p className="text-emerald-900">
                Syarat terpenuhi & kedua pihak menyetujui: H{tl.H188} proses pencairan dana sesuai
                ketentuan.
              </p>
            </div>
            <div className="p-3.5 rounded-md border border-purple-300 bg-purple-50 space-y-1">
              <div className="font-mono font-bold text-purple-950">
                CABANG A.2 (H{tl.H190} → H{tl.H195} → H{tl.H200}) — Keberatan Terbukti
              </div>
              <p className="text-purple-900">
                Pembuktian ketidaksesuaian terbukti (H{tl.H190}) → Perbaikan & validasi bukti (H
                {tl.H195}) → Pencairan (H{tl.H200}).
              </p>
            </div>
            <div className="p-3.5 rounded-md border border-teal-300 bg-teal-50 space-y-1">
              <div className="font-mono font-bold text-teal-950">
                CABANG A.3 (H{tl.H195}) — Keberatan Tidak Terbukti
              </div>
              <p className="text-teal-900">
                Jika ketidaksesuaian tidak terbukti: H{tl.H195} proses pencairan dana sesuai
                ketentuan.
              </p>
            </div>
          </div>

          {/* Interactive State Machine Triggers for Active Milestone */}
          {activeMilestone && (
            <div className="p-4 bg-slate-900 text-white rounded-lg space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-400">Tahap Aktif:</span>{' '}
                  <strong className="text-white">{activeMilestone.name}</strong>
                </div>
                <div className="font-mono text-sky-400">
                  State Saat Ini: {activeMilestone.smartContractState} (H
                  {activeMilestone.smartContractCurrentH})
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSmartContractStep(activeMilestone.id, 'SUBMIT_EVIDENCE_H180')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded font-mono text-[11px]"
                >
                  Simulasi H{tl.H180}: Penilaian Bukti
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSmartContractStep(activeMilestone.id, 'VALIDATE_REQUIREMENTS_H185')
                  }
                  className="px-3 py-1.5 bg-sky-800 hover:bg-sky-700 rounded font-mono text-[11px]"
                >
                  Simulasi H{tl.H185}: Validasi Syarat (Cabang A/B)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSmartContractStep(activeMilestone.id, 'PARTY_RAISES_OBJECTION')
                  }
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded font-mono text-[11px]"
                >
                  Simulasi Keberatan Salah Satu Pihak
                </button>
                <button
                  type="button"
                  onClick={() => handleSmartContractStep(activeMilestone.id, 'DISPUTE_PROVEN_H190')}
                  className="px-3 py-1.5 bg-purple-800 hover:bg-purple-700 rounded font-mono text-[11px]"
                >
                  Simulasi H{tl.H190}: Terbukti Tidak Sesuai
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSmartContractStep(activeMilestone.id, 'REPAIR_VALIDATED_H195')
                  }
                  className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 rounded font-mono text-[11px]"
                >
                  Simulasi H{tl.H195}: Perbaikan & Validasi Bukti
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- MODE 3: PAYMENT MANAGEMENT (Bagian 16 PRD) ---
  if (mode === 'payments') {
    const totalHeld = db.escrowRecords.reduce((s, e) => s + e.heldAmount, 0);
    const totalReleased = db.escrowRecords.reduce((s, e) => s + e.disbursedAmount, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Manajemen Pembayaran & Pemisahan Status Tiga Lapis (Bagian 16 PRD)
            </h2>
            <p className="text-xs text-slate-500">
              Membedakan secara tegas antara Status Persetujuan, Status Otorisasi MFA, dan Status
              Transaksi Pembayaran.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              Rekap Dana Tertahan:{' '}
              <strong className="text-amber-700">{formatRupiah(totalHeld)}</strong>
            </div>
            <div>
              Rekap Dana Dicairkan:{' '}
              <strong className="text-emerald-700">{formatRupiah(totalReleased)}</strong>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Proyek & Tahapan</th>
                <th className="py-2.5 px-3 font-semibold text-right">Nominal</th>
                <th className="py-2.5 px-3 font-semibold">1. Status Persetujuan</th>
                <th className="py-2.5 px-3 font-semibold">2. Status Otorisasi (MFA)</th>
                <th className="py-2.5 px-3 font-semibold">3. Status Transaksi Pembayaran</th>
                <th className="py-2.5 px-3 font-semibold">Referensi & Idempotency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.paymentMilestones.map((ms) => {
                const prj = db.projects.find((p) => p.id === ms.projectId);
                return (
                  <tr key={ms.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{prj?.name}</div>
                      <div className="text-[11px] text-slate-500">{ms.name}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(ms.amount)}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">{ms.approvalStatus}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-sky-900">
                      {ms.authorizationStatus}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          ms.transactionStatus === 'Berhasil Dicairkan'
                            ? 'text-emerald-700'
                            : ms.transactionStatus === 'Ditahan / Gagal'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ms.transactionStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {ms.transactionRef || 'Belum Dicairkan'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- MODE 4: DISPUTE MANAGEMENT (Bagian 15 PRD) ---
  if (mode === 'disputes') {
    const canResolve = canRolePerformAction(activeRole, 'RESOLVE_DISPUTE');

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Keberatan & Penyelesaian Sengketa Konstruksi (Bagian 15 PRD)
              </h2>
              <p className="text-xs text-slate-500">
                Apabila terdapat sengketa aktif pada tahapan pembayaran, Smart Contract otomatis
                menahan proses pencairan dana sampai ada keputusan pihak berwenang.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Active & Past Disputes */}
          <div className="lg:col-span-7 space-y-4">
            {db.disputes.map((dsp) => {
              const prj = db.projects.find((p) => p.id === dsp.projectId);
              const ms = db.paymentMilestones.find((m) => m.id === dsp.milestoneId);
              return (
                <div
                  key={dsp.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <div className="font-mono text-[11px] text-slate-500">
                        ID: {dsp.id} · Proyek: {prj?.name} · {ms?.name}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">{dsp.reason}</h3>
                    </div>
                    <span
                      className={`font-semibold ${
                        dsp.status === 'Selesai' || dsp.status === 'Tidak terbukti'
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {dsp.status} {dsp.blocksPayment ? '(Menahan Pencairan)' : ''}
                    </span>
                  </div>

                  <div className="text-slate-600">
                    Diajukan oleh: <strong>{dsp.raisedByName}</strong> ({dsp.raisedByRole}) pada{' '}
                    <span className="font-mono">{dsp.raisedAt}</span> · Bukti:{' '}
                    <span className="font-mono">{dsp.evidenceAttachmentName}</span>
                  </div>

                  {dsp.responses.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="font-semibold text-slate-800">Tanggapan & Pemeriksaan:</div>
                      {dsp.responses.map((r) => (
                        <div
                          key={r.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded"
                        >
                          <div className="font-semibold text-slate-900">
                            {r.responderName} ({r.responderRole}) ·{' '}
                            <span className="font-mono text-[11px] text-slate-500">
                              {r.respondedAt}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-0.5">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {dsp.resolution ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md space-y-1">
                      <div className="font-bold text-emerald-950">
                        Keputusan Akhir: {dsp.resolution.ruling}
                      </div>
                      <div className="text-emerald-900">
                        Dasar Keputusan: {dsp.resolution.decisionBasis}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-800">
                        Ditetapkan oleh Pihak Berwenang: {dsp.resolution.decidedByName} (
                        {dsp.resolution.decidedAt})
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <input
                        type="text"
                        value={resolutionBasis}
                        onChange={(e) => setResolutionBasis(e.target.value)}
                        placeholder="Catatan dasar keputusan teknis pihak berwenang..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!canResolve}
                          onClick={() =>
                            handleResolveDispute(
                              dsp.id,
                              'Terbukti (Wajib Perbaikan H190-H195)'
                            )
                          }
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white font-semibold rounded-md"
                        >
                          Putuskan Terbukti & Selesai Perbaikan (H190–H195)
                        </button>
                        <button
                          type="button"
                          disabled={!canResolve}
                          onClick={() =>
                            handleResolveDispute(
                              dsp.id,
                              'Tidak Terbukti (Lanjut Pencairan H195)'
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold rounded-md"
                        >
                          Putuskan Tidak Terbukti & Buka Kunci Dana (H195)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right 5 Cols: File New Objection / Dispute */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 h-fit space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Ajukan Keberatan / Sengketa Baru (H185)
            </h3>
            <form onSubmit={handleRaiseDispute} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proyek</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => onSelectProject(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
                >
                  {db.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tahap Pembayaran yang Dikeberatkan
                </label>
                <select
                  value={activeMilestone?.id || ''}
                  onChange={(e) => setSelectedMilestoneId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
                >
                  {projectMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Keberatan / Ketidaksesuaian Kontrak
                </label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Jelaskan ketidaksesuaian spesifikasi pekerjaan terhadap kontrak awal..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lampiran Bukti Keberatan
                </label>
                <input
                  type="text"
                  value={disputeEvidenceName}
                  onChange={(e) => setDisputeEvidenceName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!canRolePerformAction(activeRole, 'RAISE_DISPUTE')}
                className="w-full px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white font-semibold rounded-md"
              >
                Ajukan Keberatan & Kunci Pencairan Dana
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 5: TRANSACTION HISTORY & BLOCKCHAIN SIMULATION LEDGER (Bagian 16 & 17 PRD) ---
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Riwayat Transaksi & Arsitektur Integrasi Blockchain [DEMO SIMULATION]
          </h2>
          <p className="text-xs text-slate-500">
            Seluruh transaksi simulasi di bawah ini memiliki label <strong>DEMO</strong> dan tidak
            terhubung ke jaringan mainnet produksi sebelum persetujuan dan audit smart contract.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {db.paymentTransactions.map((trx) => (
          <div
            key={trx.id}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="font-mono text-[11px] text-slate-500">
                  No. Transaksi: {trx.transactionNumber} · Kontrak: {trx.contractNumber} · Ref:{' '}
                  {trx.referenceNumber}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {trx.projectName} — {trx.milestoneName}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-base font-bold font-mono text-slate-900">
                  {formatRupiah(trx.amount)}
                </div>
                <div className="text-[11px] font-semibold text-emerald-700">
                  {trx.transactionStatus} [SIMULASI DEMO]
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700">
              <div>
                <span className="text-slate-500">Penerima:</span>{' '}
                <strong className="text-slate-900">{trx.recipientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Status Persetujuan:</span>{' '}
                <strong>{trx.approvalStatus}</strong>
              </div>
              <div>
                <span className="text-slate-500">Otorisasi MFA:</span>{' '}
                <strong className="font-mono text-[11px]">{trx.authorizationStatus}</strong>
              </div>
            </div>

            {/* Blockchain Metadata Block (Bagian 17 PRD) */}
            <div className="p-3 bg-slate-900 text-slate-200 rounded-md font-mono text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400">Network:</span> {trx.blockchainRecord.network}{' '}
                (Chain ID: {trx.blockchainRecord.chainId})
              </div>
              <div>
                <span className="text-slate-400">Waktu Blok:</span>{' '}
                {trx.blockchainRecord.blockTimestamp}
              </div>
              <div className="truncate">
                <span className="text-slate-400">Wallet Address:</span>{' '}
                {trx.blockchainRecord.walletAddress}
              </div>
              <div className="truncate">
                <span className="text-slate-400">Smart Contract:</span>{' '}
                {trx.blockchainRecord.smartContractAddress}
              </div>
              <div className="md:col-span-2 truncate text-sky-400">
                <span className="text-slate-400">Simulated Tx Hash:</span>{' '}
                {trx.blockchainRecord.transactionHash}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
