import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Wrench,
  FileCheck,
  ShieldAlert,
  Box,
  Download,
} from 'lucide-react';
import { SmartBuildDatabase } from '../data/seedDatabase';
import {
  RoleId,
  InspectionStatus,
  AdminVerificationStatus,
  canRolePerformAction,
} from '../logic/smartbuildEngine';
import { EvidencePreviewGraphic } from './ProjectIllustrations';

interface EvidenceAndInspectionViewProps {
  mode: 'evidence' | 'supervisor' | 'verification';
  db: SmartBuildDatabase;
  activeRole: RoleId;
  activeUserId: string;
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onNavigate: (menuId: string) => void;
  onRefresh: () => void;
}

export const EvidenceAndInspectionView: React.FC<EvidenceAndInspectionViewProps> = ({
  mode,
  db,
  activeRole,
  activeUserId,
  selectedProjectId,
  onSelectProject,
  onNavigate,
  onRefresh,
}) => {
  const currentProject =
    db.projects.find((p) => p.id === selectedProjectId) || db.projects[0];
  const currentContract =
    db.contracts.find((c) => c.projectId === currentProject.id) || db.contracts[0];
  const projectMilestones = db.paymentMilestones.filter(
    (m) => m.projectId === currentProject.id
  );
  const projectEvidences = db.evidences.filter((e) => e.projectId === currentProject.id);

  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [milestoneId, setMilestoneId] = useState<string>(projectMilestones[1]?.id || projectMilestones[0]?.id || '');
  const [stageName, setStageName] = useState<string>('3. Struktur');
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'JPG' | 'PNG' | 'MP4' | 'PDF'>('JPG');
  const [description, setDescription] = useState<string>('');
  const [locationCoords, setLocationCoords] = useState<string>('-6.2884, 106.8012');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Supervisor Inspection Form State
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>(
    db.evidences[0]?.id || ''
  );
  const [inspectionResult, setInspectionResult] = useState<InspectionStatus>('Diterima');
  const [technicalNotes, setTechnicalNotes] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [attachmentReport, setAttachmentReport] = useState<string>('LHP-SUP-2026-11-DEMO.pdf');

  // Admin Verification Form State
  const [adminStatus, setAdminStatus] = useState<AdminVerificationStatus>(
    'Dokumen Lengkap & Valid'
  );
  const [adminNotes, setAdminNotes] = useState<string>('');

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg('');
    setErrorMsg('');

    if (!description.trim() || !fileName.trim()) {
      setErrorMsg('Nama file dan deskripsi bukti pekerjaan wajib diisi.');
      return;
    }

    const res = await fetch('/api/evidences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        projectId: currentProject.id,
        contractId: currentContract.id,
        milestoneId: milestoneId || projectMilestones[0]?.id,
        stageName,
        description,
        locationCoords,
        fileName,
        fileType,
        fileSizeKb: 1680,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal mengunggah bukti pekerjaan.');
    } else {
      setFeedbackMsg(`Bukti pekerjaan "${data.evidence.fileName}" berhasil diunggah dan notifikasi telah dikirim ke Project Supervisor.`);
      setFileName('');
      setDescription('');
      onRefresh();
    }
  };

  const handleSupervisorInspect = async (
    targetEvId: string,
    quickResult?: InspectionStatus
  ) => {
    setFeedbackMsg('');
    setErrorMsg('');
    const finalResult = quickResult || inspectionResult;
    const notesToUse =
      technicalNotes.trim() ||
      (finalResult === 'Diterima'
        ? 'Hasil pemeriksaan teknis lapangan memenuhi spesifikasi gambar kerja dan mutu SNI.'
        : finalResult === 'Ditolak'
        ? 'Bukti pekerjaan ditolak karena spesifikasi material/dimensi belum sesuai kontrak. Dana tetap terkunci.'
        : 'Memerlukan perbaikan teknis sebelum pemeriksaan ulang.');

    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        evidenceId: targetEvId,
        result: finalResult,
        technicalNotes: notesToUse,
        recommendation:
          recommendation.trim() ||
          (finalResult === 'Diterima'
            ? 'Direkomendasikan lanjut ke persetujuan Pemilik Proyek.'
            : 'Tahan pencairan dana Escrow sampai perbaikan selesai dan diperiksa ulang.'),
        attachmentReportName: attachmentReport,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal menyimpan hasil pemeriksaan.');
    } else {
      setFeedbackMsg(
        `Hasil pemeriksaan pengawas (${finalResult}) berhasil disimpan dan status penguncian dana telah diperbarui.`
      );
      setTechnicalNotes('');
      onRefresh();
    }
  };

  const handleAdminVerify = async (
    targetEvId: string,
    statusOverride?: AdminVerificationStatus
  ) => {
    setFeedbackMsg('');
    setErrorMsg('');
    const finalStatus = statusOverride || adminStatus;
    const res = await fetch('/api/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        evidenceId: targetEvId,
        adminVerificationStatus: finalStatus,
        notes:
          adminNotes.trim() ||
          'Pemeriksaan kelengkapan administrasi dokumen pendukung sesuai daftar persyaratan kontrak.',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal memproses verifikasi administrasi.');
    } else {
      setFeedbackMsg(`Status verifikasi administrasi diperbarui menjadi: ${finalStatus}.`);
      setAdminNotes('');
      onRefresh();
    }
  };

  // --- MODE 1: DIGITAL EVIDENCE MANAGEMENT (Bagian 9 PRD) ---
  if (mode === 'evidence') {
    const filteredEvidences = projectEvidences.filter(
      (ev) => stageFilter === 'ALL' || ev.stageName === stageFilter
    );
    const uniqueStages = Array.from(new Set(projectEvidences.map((e) => e.stageName)));

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Digital Evidence Management — {currentProject.name}
            </h2>
            <p className="text-xs text-slate-500">
              Pengumpulan foto (JPG/PNG), video (MP4), dan dokumen uji mutu (PDF) terproteksi hak
              akses role.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Pilih Proyek untuk Bukti Pekerjaan"
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

            <select
              aria-label="Filter Tahap Bukti Pekerjaan"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-50"
            >
              <option value="ALL">Semua Tahapan Pekerjaan</option>
              {uniqueStages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
            {errorMsg}
          </div>
        )}
        {feedbackMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
            {feedbackMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gallery of Evidence Files */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvidences.map((ev) => (
              <div
                key={ev.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <EvidencePreviewGraphic
                    previewType={ev.previewUrl}
                    fileName={ev.fileName}
                    stageName={ev.stageName}
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>ID: {ev.id}</span>
                    <span>
                      {ev.fileType} · {ev.fileSizeKb} KB
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">{ev.description}</div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div>Tahap: {ev.stageName}</div>
                    <div>Pengunggah: {ev.uploaderName}</div>
                    <div className="font-mono">
                      Waktu: {ev.uploadedAt} · Lokasi: {ev.locationCoords}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Pengawas:</span>
                    <span
                      className={`font-semibold ${
                        ev.inspectionStatus === 'Diterima' || ev.inspectionStatus === 'Selesai'
                          ? 'text-emerald-700'
                          : ev.inspectionStatus === 'Ditolak' ||
                            ev.inspectionStatus === 'Perlu perbaikan'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {ev.inspectionStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Verifikasi Admin:</span>
                    <span className="font-semibold text-slate-800">
                      {ev.adminVerificationStatus}
                    </span>
                  </div>
                  {ev.supervisorNotes && (
                    <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-700">
                      <strong>Catatan Pengawas:</strong> {ev.supervisorNotes}
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onNavigate('supervisor')}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                    >
                      Detail Pemeriksaan
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFeedbackMsg(
                          `Mengunduh berkas terproteksi "${ev.fileName}" sesuai hak akses ${activeRole} [DEMO].`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Form: Upload New Evidence (Contractor) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 h-fit space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Unggah Bukti Pekerjaan Baru
            </h3>

            {!canRolePerformAction(activeRole, 'UPLOAD_EVIDENCE') &&
              activeRole !== 'SUPER_ADMIN' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                  Saat ini Anda masuk sebagai <strong>{activeRole}</strong>. Hanya{' '}
                  <strong>Penyedia Jasa / Kontraktor</strong> yang dapat mengunggah bukti
                  pekerjaan.
                </div>
              )}

            <form onSubmit={handleUploadEvidence} className="space-y-3 text-xs">
              <div>
                <label htmlFor="ev-milestone" className="block font-semibold text-slate-700 mb-1">
                  Tahap Pembayaran Terkait
                </label>
                <select
                  id="ev-milestone"
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
                >
                  {projectMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ev-stage" className="block font-semibold text-slate-700 mb-1">
                  Tahapan Konstruksi
                </label>
                <select
                  id="ev-stage"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
                >
                  <option value="2. Pondasi">2. Pondasi</option>
                  <option value="3. Struktur">3. Struktur</option>
                  <option value="4. Dinding">4. Dinding</option>
                  <option value="5. Atap">5. Atap</option>
                  <option value="6. Instalasi">6. Instalasi</option>
                  <option value="7. Finishing">7. Finishing</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ev-type" className="block font-semibold text-slate-700 mb-1">
                    Jenis File
                  </label>
                  <select
                    id="ev-type"
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as typeof fileType)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  >
                    <option value="JPG">JPG (Foto)</option>
                    <option value="PNG">PNG (Foto)</option>
                    <option value="MP4">MP4 (Video)</option>
                    <option value="PDF">PDF (Dokumen)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ev-coords" className="block font-semibold text-slate-700 mb-1">
                    Koordinat Lokasi
                  </label>
                  <input
                    id="ev-coords"
                    type="text"
                    value={locationCoords}
                    onChange={(e) => setLocationCoords(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ev-filename" className="block font-semibold text-slate-700 mb-1">
                  Nama Berkas
                </label>
                <input
                  id="ev-filename"
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Contoh: pemasangan_dinding_akustik.jpg"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label htmlFor="ev-desc" className="block font-semibold text-slate-700 mb-1">
                  Deskripsi Bukti Pekerjaan
                </label>
                <textarea
                  id="ev-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan hasil pekerjaan dan spesifikasi teknis..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !canRolePerformAction(activeRole, 'UPLOAD_EVIDENCE') &&
                  activeRole !== 'SUPER_ADMIN'
                }
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 disabled:opacity-50 rounded-md"
              >
                <Upload className="w-3.5 h-3.5" />
                Unggah & Ajukan Pemeriksaan Pengawas
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 2: THIRD-PARTY INSPECTION / PROJECT SUPERVISOR (Bagian 10 PRD) ---
  if (mode === 'supervisor') {
    const waitingCount = db.evidences.filter(
      (e) => e.inspectionStatus === 'Menunggu pemeriksaan' || e.inspectionStatus === 'Sedang diperiksa'
    ).length;
    const acceptedCount = db.evidences.filter(
      (e) => e.inspectionStatus === 'Diterima' || e.inspectionStatus === 'Selesai'
    ).length;
    const rejectedOrRepairCount = db.evidences.filter(
      (e) => e.inspectionStatus === 'Ditolak' || e.inspectionStatus === 'Perlu perbaikan'
    ).length;

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Dashboard Pengawas Pihak Ketiga (PROJECT SUPERVISOR)
            </h2>
            <p className="text-xs text-slate-500">
              Pemeriksaan teknis konstruksi independen. Pengawas berwenang menerima, menolak, atau
              meminta perbaikan bukti pekerjaan, tetapi tidak dapat mengubah nilai kontrak atau
              mencairkan dana.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bim')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md"
          >
            <Box className="w-3.5 h-3.5" /> Buka Referensi Model BIM 3D
          </button>
        </div>

        {/* Supervisor Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Proyek Ditugaskan</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {db.projects.length} Proyek
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Menunggu Pemeriksaan</div>
            <div className="text-xl font-bold font-mono text-amber-700 mt-1">
              {waitingCount} Bukti
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Bukti Diterima</div>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
              {acceptedCount} Bukti
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Ditolak / Perlu Perbaikan</div>
            <div className="text-xl font-bold font-mono text-red-700 mt-1">
              {rejectedOrRepairCount} Bukti
            </div>
          </div>
        </div>

        {/* Mandatory Human Competence Notice (Bagian 10 PRD) */}
        <div className="bg-slate-900 text-slate-100 rounded-lg p-4 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">
              Prinsip Independensi & Kompetensi Pemeriksaan Teknis (Bagian 10 PRD)
            </div>
            <p className="text-slate-300 mt-0.5">
              Sistem otomatis atau AI tidak pernah menjadi satu-satunya pihak yang menyatakan
              pekerjaan konstruksi aman atau sesuai standar teknis. Keputusan teknis konstruksi
              wajib ditetapkan oleh tenaga <strong>Project Supervisor</strong> bersertifikat yang
              ditugaskan pada kontrak.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
            {errorMsg}
          </div>
        )}
        {feedbackMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
            {feedbackMsg}
          </div>
        )}

        {/* Evidence Queue for Supervisor Inspection */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">
            Daftar Bukti Pekerjaan untuk Pemeriksaan Teknis Pengawas
          </h3>

          <div className="space-y-4">
            {db.evidences.map((ev) => {
              const prj = db.projects.find((p) => p.id === ev.projectId);
              const canInspect = canRolePerformAction(activeRole, 'INSPECT_TECHNICAL_EVIDENCE');
              return (
                <div
                  key={ev.id}
                  className="p-4 border border-slate-200 rounded-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <span>{prj?.name}</span>
                      <span>·</span>
                      <span>{ev.stageName}</span>
                      <span>·</span>
                      <span>
                        {ev.fileName} ({ev.fileType})
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">{ev.description}</div>
                    <div className="text-slate-600">
                      Diunggah oleh: {ev.uploaderName} pada {ev.uploadedAt}
                    </div>
                    {ev.supervisorNotes && (
                      <div className="text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded mt-1">
                        <strong>Catatan Pemeriksaan:</strong> {ev.supervisorNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold mr-2 ${
                        ev.inspectionStatus === 'Diterima' || ev.inspectionStatus === 'Selesai'
                          ? 'text-emerald-700'
                          : ev.inspectionStatus === 'Ditolak' ||
                            ev.inspectionStatus === 'Perlu perbaikan'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      Status: {ev.inspectionStatus}
                    </span>

                    <button
                      type="button"
                      disabled={!canInspect}
                      onClick={() => handleSupervisorInspect(ev.id, 'Diterima')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Terima Bukti
                    </button>
                    <button
                      type="button"
                      disabled={!canInspect}
                      onClick={() => handleSupervisorInspect(ev.id, 'Perlu perbaikan')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-md"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Minta Perbaikan
                    </button>
                    <button
                      type="button"
                      disabled={!canInspect}
                      onClick={() => handleSupervisorInspect(ev.id, 'Ditolak')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-40 rounded-md"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Tolak Bukti
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Inspection Report Submission Form & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Formulir Laporan Pemeriksaan Teknis (LHP)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Bukti Pekerjaan
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50"
                >
                  {db.evidences.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.fileName} — {ev.stageName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keputusan Hasil Pemeriksaan
                </label>
                <select
                  value={inspectionResult}
                  onChange={(e) => setInspectionResult(e.target.value as InspectionStatus)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                >
                  <option value="Diterima">Diterima</option>
                  <option value="Perlu perbaikan">Perlu perbaikan</option>
                  <option value="Ditolak">Ditolak</option>
                  <option value="Pemeriksaan ulang">Pemeriksaan ulang</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Teknis Pengawas
                </label>
                <textarea
                  rows={2}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  placeholder="Hasil pengukuran dimensi, mutu beton/baja, dan kesesuaian gambar BIM..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rekomendasi Tindak Lanjut
                </label>
                <input
                  type="text"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder="Rekomendasi kelayakan pencairan atau instruksi perbaikan..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lampiran Laporan Pemeriksaan (PDF)
                </label>
                <input
                  type="text"
                  value={attachmentReport}
                  onChange={(e) => setAttachmentReport(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <button
                type="button"
                disabled={!canRolePerformAction(activeRole, 'INSPECT_TECHNICAL_EVIDENCE')}
                onClick={() => handleSupervisorInspect(selectedEvidenceId)}
                className="w-full px-4 py-2 bg-[#0B1E3D] hover:bg-slate-800 disabled:opacity-40 text-white font-semibold rounded-md"
              >
                Kirim Laporan Pemeriksaan Pengawas
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-3">
              Riwayat Laporan Pemeriksaan Pengawas Pihak Ketiga
            </h3>
            <div className="space-y-3">
              {db.inspections.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {rep.stageName} · Lampiran: {rep.attachmentReportName}
                    </span>
                    <span className="font-mono font-semibold text-emerald-700">{rep.result}</span>
                  </div>
                  <div className="text-slate-700">
                    <strong>Catatan Teknis:</strong> {rep.technicalNotes}
                  </div>
                  <div className="text-slate-700">
                    <strong>Rekomendasi:</strong> {rep.recommendation}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Pengawas: {rep.supervisorName} · Tanggal: {rep.inspectedAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 3: ADMINISTRATIVE VERIFICATION (Bagian 3.5 PRD) ---
  const canVerifyAdmin =
    canRolePerformAction(activeRole, 'VERIFY_ADMIN_DOCUMENTS') || activeRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileCheck className="w-5 h-5 text-[#0B1E3D]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Verifikasi Administrasi & Kelengkapan Dokumen (Bagian 3.5 PRD)
            </h2>
            <p className="text-xs text-slate-500">
              Pemisahan tegas antara verifikasi kelengkapan dokumen administratif oleh Verifikator
              Administrasi dan pemeriksaan teknis konstruksi oleh Project Supervisor.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
          {errorMsg}
        </div>
      )}
      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
          {feedbackMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
              <th className="py-2.5 px-3 font-semibold">Berkas & Tahap</th>
              <th className="py-2.5 px-3 font-semibold">Pengunggah & Waktu</th>
              <th className="py-2.5 px-3 font-semibold">Pemeriksaan Teknis (Supervisor)</th>
              <th className="py-2.5 px-3 font-semibold">Verifikasi Administratif</th>
              <th className="py-2.5 px-3 font-semibold">Tindakan Verifikator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {db.evidences.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50">
                <td className="py-3 px-3">
                  <div className="font-semibold text-slate-900">{ev.fileName}</div>
                  <div className="text-[11px] text-slate-500">{ev.stageName}</div>
                </td>
                <td className="py-3 px-3">
                  <div className="text-slate-800">{ev.uploaderName}</div>
                  <div className="text-[11px] font-mono text-slate-500">{ev.uploadedAt}</div>
                </td>
                <td className="py-3 px-3 font-semibold text-slate-700">{ev.inspectionStatus}</td>
                <td className="py-3 px-3">
                  <span
                    className={`font-semibold ${
                      ev.adminVerificationStatus === 'Dokumen Lengkap & Valid'
                        ? 'text-emerald-700'
                        : ev.adminVerificationStatus === 'Dokumen Kurang / Revisi'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {ev.adminVerificationStatus}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canVerifyAdmin}
                      onClick={() => handleAdminVerify(ev.id, 'Dokumen Lengkap & Valid')}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded"
                    >
                      Validasi Lengkap
                    </button>
                    <button
                      type="button"
                      disabled={!canVerifyAdmin}
                      onClick={() => handleAdminVerify(ev.id, 'Dokumen Kurang / Revisi')}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-40 rounded"
                    >
                      Minta Revisi Dokumen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
