import React from 'react';
import {
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { SmartBuildDatabase } from '../data/seedDatabase';
import { ComplianceCheckResult } from '../logic/smartbuildEngine';
import { BuildingIllustration } from './ProjectIllustrations';

interface ExecutiveDashboardViewProps {
  db: SmartBuildDatabase & {
    complianceByMilestone: Record<string, ComplianceCheckResult>;
  };
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onNavigate: (menuId: string) => void;
}

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  db,
  selectedProjectId,
  onSelectProject,
  onNavigate,
}) => {
  const activeProjects = db.projects.filter((p) => !p.isArchived);
  const totalProjects = activeProjects.length;
  const inProgressProjects = activeProjects.filter(
    (p) => p.status === 'Dalam Pengerjaan' || p.status === 'Kontrak Aktif'
  ).length;
  const waitingVerificationProjects = activeProjects.filter(
    (p) => p.status === 'Menunggu Verifikasi'
  ).length;
  const activeContractsCount = db.contracts.filter(
    (c) => c.status === 'Kontrak Aktif (Terkunci)'
  ).length;

  const totalContractValue = activeProjects.reduce((sum, p) => sum + p.projectValue, 0);
  const totalDisbursed = db.escrowRecords.reduce((sum, e) => sum + e.disbursedAmount, 0);
  const totalHeldEscrow = db.escrowRecords.reduce((sum, e) => sum + e.heldAmount, 0);
  const pendingMilestonesAmount = db.paymentMilestones
    .filter(
      (m) =>
        m.status === 'Menunggu persetujuan' ||
        m.status === 'Menunggu verifikasi' ||
        m.status === 'Siap diproses' ||
        m.status === 'Ditahan karena sengketa'
    )
    .reduce((sum, m) => sum + m.amount, 0);

  const avgProgress =
    totalProjects > 0
      ? Math.round(
          (activeProjects.reduce((sum, p) => sum + p.overallProgress, 0) / totalProjects) * 10
        ) / 10
      : 0;

  const mainProject =
    db.projects.find((p) => p.id === selectedProjectId) || db.projects[0];
  const mainMilestones = db.paymentMilestones.filter(
    (m) => m.projectId === mainProject.id
  );
  const mainStages = db.projectStages.filter((s) => s.projectId === mainProject.id);

  // 10 Mandatory Stat Cards from Bagian 2.2 PRD
  const statCards = [
    {
      idx: '01',
      label: 'Total Proyek',
      value: `${totalProjects} Proyek`,
      sub: 'Seluruh proyek terdaftar [DEMO]',
    },
    {
      idx: '02',
      label: 'Proyek Aktif',
      value: `${inProgressProjects} Proyek`,
      sub: 'Dalam pelaksanaan konstruksi',
    },
    {
      idx: '03',
      label: 'Total Kontrak Aktif',
      value: `${activeContractsCount} Kontrak`,
      sub: 'Kontrak digital terkunci & aktif',
    },
    {
      idx: '04',
      label: 'Total Nilai Kontrak',
      value: formatRupiah(totalContractValue),
      sub: 'Akumulasi kontrak terverifikasi',
    },
    {
      idx: '05',
      label: 'Total Pembayaran',
      value: formatRupiah(totalDisbursed),
      sub: 'Telah dicairkan dari Escrow',
    },
    {
      idx: '06',
      label: 'Dana Tertahan',
      value: formatRupiah(totalHeldEscrow),
      sub: 'Terkunci di Smart Contract Escrow',
    },
    {
      idx: '07',
      label: 'Pembayaran Tertunda',
      value: formatRupiah(pendingMilestonesAmount),
      sub: 'Menunggu verifikasi / persetujuan',
    },
    {
      idx: '08',
      label: 'Proyek Menunggu Verifikasi',
      value: `${waitingVerificationProjects} Proyek`,
      sub: 'Menunggu pemeriksaan bukti',
    },
    {
      idx: '09',
      label: 'Rata-rata Progres',
      value: `${avgProgress}%`,
      sub: 'Perhitungan bobot tahapan',
    },
    {
      idx: '10',
      label: 'Keamanan Sistem',
      value: 'MFA & Escrow Aktif',
      sub: `${db.mfaLogs.length} log MFA · ${db.auditLogs.length} audit trail`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Project Switcher Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Ringkasan Eksekutif SmartBuild 3.0 [DEMO MODE]
          </h2>
          <p className="text-xs text-slate-500">
            Seluruh metrik dihitung langsung dari database proyek, kontrak digital, dan ledger
            Smart Contract Escrow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-md">
          {db.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectProject(p.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                mainProject.id === p.id
                  ? 'bg-[#0B1E3D] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {p.name} ({p.overallProgress}%)
            </button>
          ))}
        </div>
      </div>

      {/* 10 Executive Stat Cards (Bagian 2.2 PRD) */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5"
        data-testid="executive-kpi-grid"
      >
        {statCards.map((card) => (
          <div
            key={card.idx}
            className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">{card.label}</span>
              <span className="font-mono text-[11px] text-slate-400">{card.idx}</span>
            </div>
            <div className="mt-2 text-lg font-bold font-mono tabular-nums text-slate-900">
              {card.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Section A (Detail Proyek Utama) & Section C (Grafik Progres Target vs Realisasi) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* A. Detail Proyek Utama */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <BuildingIllustration
              type={mainProject.buildingImageUrl}
              className="w-full h-48"
            />
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {mainProject.code} · {mainProject.location}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {mainProject.name}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-sky-800 font-mono">
                  {mainProject.status}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {mainProject.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-500">Nilai Kontrak</div>
                  <div className="font-mono font-bold text-slate-900">
                    {formatRupiah(mainProject.projectValue)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Persentase Progres</div>
                  <div className="font-mono font-bold text-emerald-700">
                    {mainProject.overallProgress}% (Tertimbang)
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Tanggal Mulai</div>
                  <div className="font-mono text-slate-800">{mainProject.startDate}</div>
                </div>
                <div>
                  <div className="text-slate-500">Target Selesai</div>
                  <div className="font-mono text-slate-800">{mainProject.targetEndDate}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500">Penanggung Jawab & Pengawas</div>
                  <div className="text-slate-800 font-medium">
                    Kontraktor: {mainProject.contractorName} · Pengawas: {mainProject.supervisorName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" />
              Lihat Detail Proyek
            </button>
            <button
              type="button"
              onClick={() => onNavigate('bim')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Box className="w-3.5 h-3.5" />
              Lihat BIM 3D
            </button>
          </div>
        </div>

        {/* C. Grafik Progres (Target vs Realisasi Berdasarkan Tahap & Tanggal) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Grafik Progres Konstruksi (Target vs Realisasi — {mainProject.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Rumus: Progres Keseluruhan = ∑ (Realisasi Tahap × Bobot Tahap) ={' '}
                  <span className="font-mono font-bold text-slate-900">
                    {mainProject.overallProgress}%
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('progress')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
              >
                Kelola Progres <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {mainStages.map((stg) => {
                const isDelayed = stg.realizedProgress < stg.targetProgress;
                return (
                  <div key={stg.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{stg.name}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Bobot {stg.weight}%
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Target Selesai: {stg.targetEndDate}
                        </span>
                      </div>
                      <div className="font-mono text-xs tabular-nums">
                        <span className="text-slate-500">Target {stg.targetProgress}%</span>
                        <span className="mx-1.5 text-slate-300">/</span>
                        <span
                          className={
                            stg.realizedProgress >= 100
                              ? 'text-emerald-700 font-bold'
                              : isDelayed
                              ? 'text-amber-700 font-bold'
                              : 'text-sky-700 font-bold'
                          }
                        >
                          Realisasi {stg.realizedProgress}%
                        </span>
                      </div>
                    </div>

                    {/* Dual Comparison Bar: Target (gray track marker) vs Realisasi (colored bar) */}
                    <div className="relative w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-slate-300/70"
                        style={{ width: `${stg.targetProgress}%` }}
                        title={`Target: ${stg.targetProgress}%`}
                      />
                      <div
                        className={`relative h-full transition-all ${
                          stg.realizedProgress >= 100
                            ? 'bg-emerald-600'
                            : isDelayed
                            ? 'bg-amber-500'
                            : 'bg-sky-600'
                        }`}
                        style={{ width: `${stg.realizedProgress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-4">
              <span>Hijau: Selesai 100%</span>
              <span>·</span>
              <span>Kuning: Realisasi di bawah Target</span>
              <span>·</span>
              <span>Abu-abu: Target Jadwal</span>
            </div>
            <span className="font-mono font-semibold text-slate-900">
              Total Bobot Tahapan: 100%
            </span>
          </div>
        </div>
      </div>

      {/* Section B: Tahap Pembayaran (Milestone Payment Breakdown) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tahap Pembayaran & Status Penguncian Smart Contract ({mainProject.name})
            </h3>
            <p className="text-xs text-slate-500">
              Setiap tahapan wajib melewati verifikasi administrasi, pemeriksaan Project Supervisor,
              persetujuan Pemilik Proyek, dan otorisasi MFA sebelum dana dicairkan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('milestones')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            Buka Milestone & Compliance Engine
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Nama Tahapan</th>
                <th className="py-2.5 px-3 font-semibold text-right">Persentase</th>
                <th className="py-2.5 px-3 font-semibold text-right">Nilai Pembayaran</th>
                <th className="py-2.5 px-3 font-semibold">Status Pekerjaan</th>
                <th className="py-2.5 px-3 font-semibold">Status Verifikasi & Pengawas</th>
                <th className="py-2.5 px-3 font-semibold">Status Pencairan Escrow</th>
                <th className="py-2.5 px-3 font-semibold">Posisi Smart Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mainMilestones.map((ms) => {
                const comp = db.complianceByMilestone[ms.id];
                return (
                  <tr key={ms.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900">{ms.name}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {ms.percentage}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatRupiah(ms.amount)}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      Fisik {ms.workProgress}%
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-700">
                        Pengawas: {ms.supervisorApproved ? 'Disetujui' : 'Menunggu'} · Admin:{' '}
                        {ms.adminVerified ? 'Valid' : 'Menunggu'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          ms.status === 'Berhasil dicairkan'
                            ? 'text-emerald-700'
                            : ms.status === 'Ditolak' || ms.status === 'Ditahan karena sengketa'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ms.status}
                      </span>
                      {comp && !comp.compliant && ms.status !== 'Berhasil dicairkan' && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Terkunci: {comp.overallVerdict}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-sky-900">
                      H{ms.smartContractCurrentH} · {ms.smartContractState}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section D (Riwayat Transaksi) & Section E (Aktivitas Terbaru) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* D. Riwayat Transaksi */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Riwayat Transaksi Escrow & Pembayaran [DEMO]
              </h3>
              <p className="text-xs text-slate-500">
                Seluruh transaksi pembayaran tercatat dengan nomor referensi dan idempotency key.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900"
            >
              Lihat Semua
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2 px-2.5 font-semibold">Tanggal</th>
                  <th className="py-2 px-2.5 font-semibold">Keterangan</th>
                  <th className="py-2 px-2.5 font-semibold text-right">Nominal</th>
                  <th className="py-2 px-2.5 font-semibold">Status</th>
                  <th className="py-2 px-2.5 font-semibold">Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {db.paymentTransactions.slice(0, 5).map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600">
                      {trx.date}
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-900">{trx.projectName}</div>
                      <div className="text-[11px] text-slate-500">{trx.milestoneName}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatRupiah(trx.amount)}
                    </td>
                    <td className="py-2.5 px-2.5 font-semibold text-emerald-700">
                      {trx.transactionStatus} [DEMO]
                    </td>
                    <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600">
                      {trx.referenceNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* E. Aktivitas Terbaru */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Aktivitas & Audit Trail Terbaru
              </h3>
              <p className="text-xs text-slate-500">
                Rekam jejak persetujuan kontrak, bukti, inspeksi, dan transaksi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900"
            >
              Audit Log
            </button>
          </div>

          <div className="space-y-3">
            {db.auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-800">{log.userName}</span>
                  <span className="font-mono">{log.timestamp}</span>
                </div>
                <div className="text-slate-800 font-medium">{log.activity}</div>
                <div className="text-[11px] font-mono text-slate-500">
                  Status: {log.statusBefore} →{' '}
                  <span className="text-emerald-700 font-semibold">{log.statusAfter}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
