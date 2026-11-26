import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Bell,
  Users,
  ShieldCheck,
  History,
  Settings,
  Download,
  Printer,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { SmartBuildDatabase } from '../data/seedDatabase';
import { ROLE_LABELS, RoleId } from '../logic/smartbuildEngine';
import { formatRupiah } from './ExecutiveDashboardView';

interface GovernanceAndReportsViewProps {
  mode: 'reports' | 'notifications' | 'users' | 'security' | 'audit' | 'settings';
  db: SmartBuildDatabase;
  activeRole: RoleId;
  activeUserId: string;
  onSwitchRole: (role: RoleId) => void;
  onRefresh: () => void;
  onRequestMfa: (params: {
    actionType: 'TINDAKAN_ADMIN_KRITIS';
    actionTitle: string;
    onSuccess: (token: string) => void;
  }) => void;
}

const REPORT_TYPES = [
  { id: 'R1', label: '1. Laporan Proyek' },
  { id: 'R2', label: '2. Laporan Progres' },
  { id: 'R3', label: '3. Laporan Kontrak' },
  { id: 'R4', label: '4. Laporan Bukti Pekerjaan' },
  { id: 'R5', label: '5. Laporan Pengawasan' },
  { id: 'R6', label: '6. Laporan Verifikasi' },
  { id: 'R7', label: '7. Laporan Pembayaran' },
  { id: 'R8', label: '8. Laporan Dana Tertahan' },
  { id: 'R9', label: '9. Laporan Sengketa' },
  { id: 'R10', label: '10. Laporan Aktivitas' },
];

export const GovernanceAndReportsView: React.FC<GovernanceAndReportsViewProps> = ({
  mode,
  db,
  activeRole,
  activeUserId,
  onSwitchRole,
  onRefresh,
  onRequestMfa,
}) => {
  const [selectedReport, setSelectedReport] = useState<string>('R1');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [infoToast, setInfoToast] = useState<string>('');

  const handleExportCsv = () => {
    const rows = [
      ['Laporan SmartBuild 3.0 [DEMO]', selectedReport],
      ['Proyek', 'Nilai Kontrak', 'Progres', 'Status'],
      ...db.projects.map((p) => [
        p.name,
        String(p.projectValue),
        `${p.overallProgress}%`,
        p.status,
      ]),
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartBuild_Laporan_${selectedReport}_DEMO.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setInfoToast(`Berhasil mengekspor ${selectedReport} ke format CSV / Excel [DEMO].`);
  };

  // --- MODE 1: 10 REPORTS MODULE (Bagian 20 PRD) ---
  if (mode === 'reports') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pusat Laporan Terintegrasi (10 Jenis Laporan Eksekutif & Teknis)
              </h2>
              <p className="text-xs text-slate-500">
                Filter berdasarkan proyek, pengguna, status, serta ekspor ke PDF atau Excel (CSV).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              <Printer className="w-3.5 h-3.5" /> Ekspor PDF
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor Excel (CSV)
            </button>
          </div>
        </div>

        {infoToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
            {infoToast}
          </div>
        )}

        {/* 10 Report Type Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-1.5">
          {REPORT_TYPES.map((rep) => (
            <button
              key={rep.id}
              type="button"
              onClick={() => setSelectedReport(rep.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                selectedReport === rep.id
                  ? 'bg-[#0B1E3D] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {rep.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Filter Proyek</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
            >
              <option value="ALL">Semua Proyek</option>
              {db.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Filter Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
            >
              <option value="ALL">Semua Status</option>
              <option value="Aktif">Aktif / Dalam Pengerjaan</option>
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
        </div>

        {/* Dynamic Report Table Content */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            {REPORT_TYPES.find((r) => r.id === selectedReport)?.label} [DEMO]
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Kode / Referensi</th>
                <th className="py-2.5 px-3 font-semibold">Proyek / Uraian</th>
                <th className="py-2.5 px-3 font-semibold">Pihak Terkait</th>
                <th className="py-2.5 px-3 font-semibold text-right">Nilai / Metrik</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.projects
                .filter((p) => projectFilter === 'ALL' || p.id === projectFilter)
                .map((prj) => {
                  const esc = db.escrowRecords.find((e) => e.projectId === prj.id);
                  return (
                    <tr key={prj.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono">{prj.code}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{prj.name}</div>
                        <div className="text-[11px] text-slate-500">{prj.location}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div>Pemilik: {prj.ownerName}</div>
                        <div>Kontraktor: {prj.contractorName}</div>
                        <div>Pengawas: {prj.supervisorName}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {selectedReport === 'R8'
                          ? `Tertahan: ${formatRupiah(esc?.heldAmount || 0)}`
                          : selectedReport === 'R7'
                          ? `Cair: ${formatRupiah(esc?.disbursedAmount || 0)}`
                          : `${formatRupiah(prj.projectValue)} (${prj.overallProgress}%)`}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{prj.status}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- MODE 2: NOTIFICATION CENTER (Bagian 18 PRD) ---
  if (mode === 'notifications') {
    const markAllRead = async () => {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      onRefresh();
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pusat Notifikasi Sistem & Integrasi Email
              </h2>
              <p className="text-xs text-slate-500">
                Pemberitahuan otomatis untuk kontrak, pengiriman bukti, hasil pemeriksaan pengawas,
                sengketa, MFA, dan pencairan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
          >
            Tandai Semua Dibaca
          </button>
        </div>

        <div className="space-y-3">
          {db.notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-lg border text-xs flex items-start justify-between gap-4 ${
                n.isRead ? 'bg-white border-slate-200' : 'bg-sky-50/70 border-sky-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span>Kategori: {n.category}</span>
                  <span>·</span>
                  <span>Waktu: {n.createdAt}</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{n.title}</div>
                <p className="text-slate-700">{n.message}</p>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                {n.isRead ? 'Dibaca' : 'Baru'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- MODE 3: USERS & RBAC MATRIX (Bagian 3 PRD) ---
  if (mode === 'users') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Pengguna & Hak Akses Multi-Role (RBAC)
              </h2>
              <p className="text-xs text-slate-500">
                Lima peran terpisah dengan pembatasan kewenangan ketat sesuai Bagian 3 PRD. Anda
                dapat beralih peran aktif untuk menguji hak akses setiap pihak.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Nama Pengguna</th>
                <th className="py-2.5 px-3 font-semibold">Role / Jabatan</th>
                <th className="py-2.5 px-3 font-semibold">Organisasi</th>
                <th className="py-2.5 px-3 font-semibold">Metode MFA</th>
                <th className="py-2.5 px-3 font-semibold">Simulasi Beralih Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {ROLE_LABELS[u.role]}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{u.organization}</td>
                  <td className="py-3 px-3 font-mono text-emerald-700">
                    {u.mfaMethod} ({u.status})
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => onSwitchRole(u.role)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                        activeRole === u.role
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {activeRole === u.role ? 'Role Aktif Saat Ini' : `Gunakan Role ${u.role}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- MODE 4: MFA SECURITY CENTER (Bagian 8 PRD) ---
  if (mode === 'security') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pusat Keamanan & Multi-Factor Authentication (MFA Backend OTP)
              </h2>
              <p className="text-xs text-slate-500">
                Verifikasi OTP dilakukan di backend dengan masa berlaku 5 menit, pembatasan maksimal
                3 kali percobaan, dan tidak pernah mencatat secret key di log biasa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onRequestMfa({
                actionType: 'TINDAKAN_ADMIN_KRITIS',
                actionTitle: 'Uji Verifikasi Keamanan MFA OTP Backend',
                onSuccess: (token) => {
                  setInfoToast(`Verifikasi MFA berhasil diuji! Token Sesi: ${token}`);
                  onRefresh();
                },
              })
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md"
          >
            Uji Tantangan MFA OTP Sekarang
          </button>
        </div>

        {infoToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
            {infoToast}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-3">
            Riwayat Autentikasi & Tantangan MFA
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2 px-3 font-semibold">Waktu</th>
                  <th className="py-2 px-3 font-semibold">Pengguna & Role</th>
                  <th className="py-2 px-3 font-semibold">Jenis Tindakan Kritis</th>
                  <th className="py-2 px-3 font-semibold">Status Verifikasi</th>
                  <th className="py-2 px-3 font-semibold">Percobaan</th>
                  <th className="py-2 px-3 font-semibold">Perangkat / Kanal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {db.mfaLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-[11px]">{log.timestamp}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[11px] text-slate-500">{log.role}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{log.actionType}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-semibold ${
                          log.status === 'TERVERIFIKASI'
                            ? 'text-emerald-700'
                            : log.status === 'GAGAL_PERCOBAAN' || log.status === 'KEDALUWARSA'
                            ? 'text-red-700'
                            : 'text-sky-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{log.attemptsUsed} / 3</td>
                    <td className="py-2.5 px-3 text-slate-600">{log.deviceInfo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 5: IMMUTABLE AUDIT TRAIL (Bagian 19 PRD) ---
  if (mode === 'audit') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Audit Trail Terproteksi (Immutable Activity Log — Bagian 19 PRD)
              </h2>
              <p className="text-xs text-slate-500">
                Setiap perubahan kontrak, bukti, pemeriksaan pengawas, MFA, sengketa, dan pencairan
                dicatat dengan rantai hash SHA-256 dan tidak dapat dihapus oleh pengguna.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Waktu</th>
                <th className="py-2.5 px-3 font-semibold">Identitas Pengguna & Role</th>
                <th className="py-2.5 px-3 font-semibold">Aktivitas</th>
                <th className="py-2.5 px-3 font-semibold">Status Sebelum → Sesudah</th>
                <th className="py-2.5 px-3 font-semibold">Sesi / Hash Integritas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.auditLogs.map((aud) => (
                <tr key={aud.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                    {aud.timestamp}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{aud.userName}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {aud.userId} · {aud.role}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800">{aud.activity}</td>
                  <td className="py-3 px-3 font-mono text-[11px]">
                    <span className="text-slate-500">{aud.statusBefore}</span> →{' '}
                    <span className="text-emerald-700 font-semibold">{aud.statusAfter}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[10px] text-slate-500 max-w-[220px] truncate">
                    <div>{aud.sessionIp}</div>
                    <div className="text-sky-900 truncate">{aud.integrityHash}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- MODE 6: SETTINGS & PRODUCTION INTEGRATION DOCUMENTATION (Bagian 27.8 PRD) ---
  const handleResetDemo = async () => {
    await fetch('/api/demo/reset', { method: 'POST' });
    setInfoToast('Seluruh data simulasi DEMO telah dikembalikan ke kondisi awal PRD.');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-[#0B1E3D]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pengaturan Sistem & Dokumentasi Kesiapan Produksi (Bagian 27 PRD)
            </h2>
            <p className="text-xs text-slate-500">
              Ringkasan modul yang telah berfungsi penuh dalam mode DEMO serta parameter integrasi
              menuju lingkungan produksi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset Data Simulasi DEMO
        </button>
      </div>

      {infoToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
          {infoToast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
            Fitur Berfungsi Penuh (End-to-End Functional Modules)
          </h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Dashboard Eksekutif 10 Metrik Real-Time:</strong> Terhubung langsung ke
                database proyek (Total Rp 790.000.000 pada 3 proyek DEMO).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Multi-Role RBAC (5 Role):</strong> Super Admin, Pemilik Proyek, Kontraktor,
                Project Supervisor (Pengawas Pihak Ketiga), dan Verifikator Administrasi.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Mesin Kepatuhan Otomatis & Penguncian Pembayaran:</strong> Mencegah
                pencairan apabila bukti ditolak pengawas, persetujuan pemilik belum ada, sengketa
                aktif, MFA belum terverifikasi, atau duplikasi transaksi (Idempotency).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Workflow Smart Contract H0–H200 State Machine:</strong> Mendukung Cabang A
                (H188, H190, H195, H200) dan Cabang B (H185 Dana Tertahan) dengan parameter H yang
                dapat dikonfigurasi.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>BIM 3D Viewer (Three.js):</strong> Visualisasi 3D terhubung tahapan
                konstruksi, pemilihan elemen IFC interaktif, exploded view, dan manajemen versi
                GLB/glTF.
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
            Kesiapan Integrasi Eksternal Menuju Produksi
          </h3>
          <div className="space-y-2.5 text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-bold text-slate-900">1. Penyedia Layanan Escrow & Payment Gateway</div>
              <p className="text-slate-600 mt-0.5">
                Saat ini berjalan dalam mode <strong>SIMULASI DEMO</strong>. Untuk produksi,
                hubungkan endpoint server-side <code>/api/milestones/:id/disburse</code> dengan
                API resmi bank kustodian / penyedia Escrow berizin menggunakan webhook bertanda
                tangan kriptografis.
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-bold text-slate-900">2. Jaringan Blockchain & Smart Contract</div>
              <p className="text-slate-600 mt-0.5">
                Seluruh hash transaksi diberi label <code>0xDEMO_SIMULATED_TX_...</code>. Untuk
                produksi, lakukan audit keamanan Solidity dan kelola penandatanganan melalui KMS /
                server-side HSM tanpa menyimpan private key di frontend.
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-bold text-slate-900">3. Layanan Pengiriman OTP & TOTP Produksi</div>
              <p className="text-slate-600 mt-0.5">
                Verifikasi OTP sudah dijalankan di backend dengan batas waktu & percobaan. Untuk
                produksi, hubungkan pengiriman kode OTP dengan gateway SMTP/SMS/WhatsApp resmi
                atau TOTP Authenticator (RFC 6238).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
