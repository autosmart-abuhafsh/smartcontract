import React, { useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  Lock,
  CheckCircle2,
  Printer,
  Box,
  Sliders,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { SmartBuildDatabase } from '../data/seedDatabase';
import {
  RoleId,
  calculateWeightedProjectProgress,
  canRolePerformAction,
} from '../logic/smartbuildEngine';
import { BuildingIllustration } from './ProjectIllustrations';
import { formatRupiah } from './ExecutiveDashboardView';

interface ProjectsAndContractsViewProps {
  mode: 'projects' | 'contracts' | 'policies' | 'progress';
  db: SmartBuildDatabase;
  activeRole: RoleId;
  activeUserId: string;
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onNavigate: (menuId: string) => void;
  onRefresh: () => void;
  onRequestMfa: (params: {
    actionType: 'PERSETUJUAN_KONTRAK' | 'ADDENDUM_KONTRAK';
    actionTitle: string;
    onSuccess: (token: string) => void;
  }) => void;
}

export const ProjectsAndContractsView: React.FC<ProjectsAndContractsViewProps> = ({
  mode,
  db,
  activeRole,
  activeUserId,
  selectedProjectId,
  onSelectProject,
  onNavigate,
  onRefresh,
  onRequestMfa,
}) => {
  // Project Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');
  const [newProjectValue, setNewProjectValue] = useState('350000000');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [formMsg, setFormMsg] = useState('');

  // Addendum State
  const [addendumTitle, setAddendumTitle] = useState('');
  const [addendumSummary, setAddendumSummary] = useState('');
  const [showPrintContract, setShowPrintContract] = useState(false);

  // Policy & Rule Engine State
  const currentProject =
    db.projects.find((p) => p.id === selectedProjectId) || db.projects[0];
  const currentContract =
    db.contracts.find((c) => c.projectId === currentProject.id) || db.contracts[0];
  const currentRules =
    db.contractRules.find((r) => r.contractId === currentContract.id) || db.contractRules[0];
  const currentPolicies =
    db.contractPolicies.find((p) => p.contractId === currentContract.id) ||
    db.contractPolicies[0];

  const [ruleH180, setRuleH180] = useState<number>(currentRules.timelineConfig.H180);
  const [ruleH185, setRuleH185] = useState<number>(currentRules.timelineConfig.H185);
  const [ruleH188, setRuleH188] = useState<number>(currentRules.timelineConfig.H188);
  const [ruleH190, setRuleH190] = useState<number>(currentRules.timelineConfig.H190);
  const [ruleH195, setRuleH195] = useState<number>(currentRules.timelineConfig.H195);
  const [ruleH200, setRuleH200] = useState<number>(currentRules.timelineConfig.H200);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    if (!newProjectName.trim() || !newProjectLocation.trim()) {
      setFormMsg('Nama proyek dan lokasi wajib diisi.');
      return;
    }
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        name: newProjectName,
        location: newProjectLocation,
        description: newProjectDesc,
        projectValue: Number(newProjectValue),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormMsg(data.error || 'Gagal membuat proyek.');
    } else {
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectLocation('');
      setNewProjectDesc('');
      onSelectProject(data.project.id);
      onRefresh();
    }
  };

  const handleApproveContract = () => {
    onRequestMfa({
      actionType: 'PERSETUJUAN_KONTRAK',
      actionTitle: `Persetujuan Kontrak Digital ${currentContract.contractNumber}`,
      onSuccess: async (mfaToken) => {
        const res = await fetch(`/api/contracts/${currentContract.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorRole: activeRole,
            actorId: activeUserId,
            mfaToken,
            notes: `Disetujui oleh ${activeRole} dengan verifikasi MFA OTP.`,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormMsg(data.error || 'Gagal menyetujui kontrak.');
        } else {
          setFormMsg('Kontrak berhasil disetujui dan tercatat pada Audit Trail.');
          onRefresh();
        }
      },
    });
  };

  const handleCreateAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addendumTitle.trim() || !addendumSummary.trim()) {
      setFormMsg('Judul addendum dan rincian perubahan wajib diisi.');
      return;
    }
    onRequestMfa({
      actionType: 'ADDENDUM_KONTRAK',
      actionTitle: `Pengesahan Addendum Kontrak ${currentContract.contractNumber}`,
      onSuccess: async (mfaToken) => {
        const res = await fetch(`/api/contracts/${currentContract.id}/addendum`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorRole: activeRole,
            actorId: activeUserId,
            title: addendumTitle,
            changesSummary: addendumSummary,
            mfaToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormMsg(data.error || 'Gagal menyimpan addendum.');
        } else {
          setAddendumTitle('');
          setAddendumSummary('');
          setFormMsg('Addendum kontrak berhasil disahkan dan versi kontrak diperbarui.');
          onRefresh();
        }
      },
    });
  };

  const handleToggleRule = async (field: string, value: boolean) => {
    setFormMsg('');
    const res = await fetch(`/api/contracts/${currentContract.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        [field]: value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormMsg(data.error || 'Gagal memperbarui aturan kontrak.');
    } else {
      setFormMsg('Konfigurasi Rule Engine kontrak berhasil diperbarui.');
      onRefresh();
    }
  };

  const handleSaveTimelineRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    const res = await fetch(`/api/contracts/${currentContract.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        timelineConfig: {
          ...currentRules.timelineConfig,
          H180: Number(ruleH180),
          H185: Number(ruleH185),
          H188: Number(ruleH188),
          H190: Number(ruleH190),
          H195: Number(ruleH195),
          H200: Number(ruleH200),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormMsg(data.error || 'Gagal menyimpan parameter H0-H200.');
    } else {
      setFormMsg('Parameter alur Smart Contract H0–H200 berhasil disimpan sebagai versi baru.');
      onRefresh();
    }
  };

  const handleStageProgressChange = async (stageId: string, newProgress: number) => {
    setFormMsg('');
    const res = await fetch(`/api/stages/${stageId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: activeRole,
        actorId: activeUserId,
        realizedProgress: newProgress,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormMsg(data.error || 'Gagal memperbarui progres.');
    } else {
      onRefresh();
    }
  };

  // --- MODE 1: PROJECT MANAGEMENT (Bagian 4 PRD) ---
  if (mode === 'projects') {
    const filteredProjects = db.projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Cari proyek konstruksi"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama proyek, lokasi, atau ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <select
              aria-label="Filter status proyek"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-50 font-medium"
            >
              <option value="ALL">Semua Status Proyek</option>
              <option value="Dalam Pengerjaan">Dalam Pengerjaan</option>
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>

          {canRolePerformAction(activeRole, 'CREATE_PROJECT') && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Proyek Baru
            </button>
          )}
        </div>

        {formMsg && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900">
            {formMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredProjects.map((prj) => (
            <div
              key={prj.id}
              className={`bg-white border rounded-lg overflow-hidden flex flex-col justify-between transition-colors ${
                prj.id === selectedProjectId ? 'border-sky-600' : 'border-slate-200'
              }`}
            >
              <div>
                <BuildingIllustration type={prj.buildingImageUrl} className="w-full h-40" />
                <div className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                    <span>{prj.code}</span>
                    <span className="font-semibold text-slate-800">{prj.status}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{prj.name}</h3>
                  <div className="text-slate-500">{prj.location}</div>
                  <p className="text-slate-600 line-clamp-2">{prj.description}</p>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nilai Proyek:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(prj.projectValue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jadwal:</span>
                      <span className="font-mono text-slate-700">
                        {prj.startDate} s/d {prj.targetEndDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pemilik:</span>
                      <span className="text-slate-800 font-medium">{prj.ownerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kontraktor:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[180px]">
                        {prj.contractorName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pengawas:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[180px]">
                        {prj.supervisorName}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between font-mono text-xs mb-1">
                      <span className="text-slate-600">Progres Fisik Tertimbang</span>
                      <span className="font-bold text-slate-900">{prj.overallProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${prj.overallProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectProject(prj.id);
                    onNavigate('contracts');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  Kontrak Digital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectProject(prj.id);
                    onNavigate('bim');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded whitespace-nowrap shrink-0"
                >
                  <Box className="w-3.5 h-3.5" /> BIM 3D
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 shadow-xl">
              <h3 id="create-project-title" className="text-base font-bold text-slate-900 mb-4">
                Tambah Proyek Konstruksi Baru [DEMO]
              </h3>
              <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
                <div>
                  <label htmlFor="prj-name" className="block font-semibold text-slate-700 mb-1">
                    Nama Proyek Konstruksi
                  </label>
                  <input
                    id="prj-name"
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Contoh: Pembangunan Gedung Laboratorium Teknik"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="prj-loc" className="block font-semibold text-slate-700 mb-1">
                    Lokasi Proyek
                  </label>
                  <input
                    id="prj-loc"
                    type="text"
                    required
                    value={newProjectLocation}
                    onChange={(e) => setNewProjectLocation(e.target.value)}
                    placeholder="Contoh: Kawasan Industri Cikarang, Bekasi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="prj-val" className="block font-semibold text-slate-700 mb-1">
                    Nilai Kontrak Proyek (Rp)
                  </label>
                  <input
                    id="prj-val"
                    type="number"
                    min={1000000}
                    required
                    value={newProjectValue}
                    onChange={(e) => setNewProjectValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="prj-desc" className="block font-semibold text-slate-700 mb-1">
                    Ruang Lingkup & Deskripsi Pekerjaan
                  </label>
                  <textarea
                    id="prj-desc"
                    rows={3}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Deskripsi spesifikasi bangunan, tahapan, dan target mutu..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md"
                  >
                    Simpan Proyek & Buat Kontrak Digital
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MODE 2: DIGITAL CONTRACT MANAGEMENT (Bagian 5 PRD) ---
  if (mode === 'contracts') {
    return (
      <div className="space-y-6">
        {/* Project & Contract Selector */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Kontrak Digital & Persetujuan Dua Pihak
              </h2>
              <p className="text-xs text-slate-500">
                Setelah disetujui kedua pihak melalui MFA, isi kontrak dikunci dari perubahan
                sepihak. Perubahan wajib melalui mekanisme Addendum.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Pilih Kontrak Proyek"
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
            <button
              type="button"
              onClick={() => setShowPrintContract((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              {showPrintContract ? 'Tutup Mode Cetak PDF' : 'Cetak / Dokumen PDF'}
            </button>
          </div>
        </div>

        {formMsg && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900">
            {formMsg}
          </div>
        )}

        {showPrintContract && (
          <div className="bg-white border-2 border-slate-800 rounded-lg p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  DOKUMEN KONTRAK KONSTRUKSI DIGITAL SMARTBUILD 3.0 [DEMO]
                </div>
                <div className="font-mono text-slate-600">
                  Nomor: {currentContract.contractNumber} · Versi: v{currentContract.version}
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-[#0B1E3D] text-white font-semibold rounded"
              >
                Cetak Dokumen (Print PDF)
              </button>
            </div>
            <p className="text-slate-700">
              Dokumen ini mengikat secara digital antara <strong>{currentContract.ownerName}</strong>{' '}
              (Pemilik Proyek) dan <strong>{currentContract.contractorName}</strong> (Penyedia Jasa)
              dengan pengawasan teknis oleh <strong>{currentContract.supervisorName}</strong> senilai{' '}
              <strong className="font-mono">{formatRupiah(currentContract.contractValue)}</strong>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Contract Clauses */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  Nomor Kontrak: {currentContract.contractNumber} · Versi {currentContract.version}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {currentProject.name}
                </h3>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <Lock className="w-3.5 h-3.5" />
                {currentContract.isLocked ? 'Terkunci (Immutable Version)' : 'Menunggu Persetujuan'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs">
              <div>
                <div className="text-slate-500">Identitas Pemilik Proyek</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {currentContract.ownerName}
                </div>
                <div className="text-[11px] font-mono text-emerald-700">
                  {currentContract.ownerApproved ? 'Telah Menyetujui (MFA)' : 'Belum Menyetujui'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Identitas Penyedia Jasa</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {currentContract.contractorName}
                </div>
                <div className="text-[11px] font-mono text-emerald-700">
                  {currentContract.contractorApproved ? 'Telah Menyetujui (MFA)' : 'Belum Menyetujui'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Nilai & Target Waktu</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {formatRupiah(currentContract.contractValue)}
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  {currentContract.startDate} s/d {currentContract.targetEndDate}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="font-bold text-slate-800">1. Ruang Lingkup Pekerjaan</div>
                <p className="text-slate-600 mt-0.5">{currentContract.scopeOfWork}</p>
              </div>
              <div>
                <div className="font-bold text-slate-800">2. Tahapan Pekerjaan & Bobot Pembayaran</div>
                <p className="text-slate-600 mt-0.5 font-mono">
                  {currentContract.workStagesSummary}
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-800">3. Ketentuan Pembayaran & Pencairan Dana</div>
                <p className="text-slate-600 mt-0.5">{currentContract.paymentTerms}</p>
                <p className="text-slate-600 mt-0.5">{currentContract.disbursementTerms}</p>
              </div>
              <div>
                <div className="font-bold text-slate-800">4. Persyaratan Verifikasi & Pemeriksaan</div>
                <p className="text-slate-600 mt-0.5">{currentContract.verificationRequirements}</p>
              </div>
              <div>
                <div className="font-bold text-slate-800">5. Ketentuan Keberatan & Penyelesaian Sengketa</div>
                <p className="text-slate-600 mt-0.5">
                  {currentContract.objectionTerms} {currentContract.disputeTerms}
                </p>
              </div>
            </div>

            {!currentContract.isLocked &&
              canRolePerformAction(activeRole, 'APPROVE_CONTRACT') && (
                <div className="pt-3 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={handleApproveContract}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Setujui & Kunci Kontrak Digital (Wajib MFA OTP)
                  </button>
                </div>
              )}
          </div>

          {/* Right Column: Cryptographic Approval Records & Addendum Mechanism */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-3">
                Catatan Persetujuan Digital (Proof of Consent)
              </h3>
              <div className="space-y-3">
                {currentContract.approvals.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1"
                  >
                    <div className="font-semibold text-slate-900">{app.userName}</div>
                    <div className="text-[11px] text-slate-500">
                      Role: {app.role} · Versi Kontrak: v{app.contractVersion}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      Waktu: {app.approvedAt} · Metode: {app.authMethod}
                    </div>
                    <div className="text-[10px] font-mono text-sky-900 truncate">
                      Bukti Hash: {app.proofHash}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
                Mekanisme Addendum Kontrak
              </h3>
              <div className="space-y-2">
                {currentContract.addendums.map((add) => (
                  <div
                    key={add.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <div className="font-semibold text-slate-900">
                      v{add.versionNumber}: {add.title}
                    </div>
                    <p className="text-slate-600 mt-0.5">{add.changesSummary}</p>
                    <div className="text-[11px] font-mono text-emerald-700 mt-1">
                      {add.status} · Diajukan oleh {add.proposedBy} ({add.proposedAt})
                    </div>
                  </div>
                ))}
              </div>

              {(activeRole === 'PROJECT_OWNER' || activeRole === 'CONTRACTOR') && (
                <form onSubmit={handleCreateAddendum} className="space-y-2.5 pt-2 border-t border-slate-200 text-xs">
                  <div className="font-semibold text-slate-800">Ajukan Addendum Baru (MFA)</div>
                  <input
                    type="text"
                    value={addendumTitle}
                    onChange={(e) => setAddendumTitle(e.target.value)}
                    placeholder="Judul Addendum (misal: Addendum 02 Spesifikasi)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                  <textarea
                    rows={2}
                    value={addendumSummary}
                    onChange={(e) => setAddendumSummary(e.target.value)}
                    placeholder="Rincian perubahan yang disepakati kedua pihak..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                  <button
                    type="submit"
                    className="w-full px-3 py-2 bg-[#0B1E3D] hover:bg-slate-800 text-white font-semibold rounded-md"
                  >
                    Sahkan Addendum dengan MFA OTP
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 3: CONTRACT POLICY & RULE ENGINE (Bagian 6 PRD) ---
  if (mode === 'policies') {
    const canEditRules = activeRole === 'PROJECT_OWNER' || activeRole === 'SUPER_ADMIN';

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-[#0B1E3D]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Contract Policy & Dynamic Rule Engine (Versi {currentRules.version})
              </h2>
              <p className="text-xs text-slate-500">
                Konfigurasi aturan kepatuhan otomatis, kewajiban bukti, otoritas pengawas, dan
                parameter waktu Smart Contract H0–H200 untuk setiap kontrak.
              </p>
            </div>
          </div>

          <select
            aria-label="Pilih Kontrak untuk Kebijakan"
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

        {formMsg && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900">
            {formMsg}
          </div>
        )}

        {/* 3-Party Policy Pillars (Bagian 6.1, 6.2, 6.3 PRD) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5 mb-3">
              6.1 Kebijakan Pemilik Proyek / Pengguna Jasa
            </h3>
            <ul className="space-y-2 text-xs text-slate-700 list-disc pl-4">
              {currentPolicies.ownerPolicies.map((pol, i) => (
                <li key={i}>{pol}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5 mb-3">
              6.2 Kebijakan Penyedia Jasa / Kontraktor
            </h3>
            <ul className="space-y-2 text-xs text-slate-700 list-disc pl-4">
              {currentPolicies.contractorPolicies.map((pol, i) => (
                <li key={i}>{pol}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5 mb-3">
              6.3 Kebijakan Pengawas Pihak Ketiga (Supervisor)
            </h3>
            <ul className="space-y-2 text-xs text-slate-700 list-disc pl-4">
              {currentPolicies.supervisorPolicies.map((pol, i) => (
                <li key={i}>{pol}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Interactive Rule Engine Toggles & H0-H200 Configurable Parameters (Bagian 6.4 & 14 PRD) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                6.4 Pengaturan Aturan Kontrak & Syarat Penguncian Dana
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Diperbarui: {currentRules.updatedAt}
              </span>
            </div>

            {!canEditRules && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Peran Anda ({activeRole}) hanya dapat melihat kebijakan. Pengawas dan Kontraktor
                  tidak dapat mengubah aturan kontrak secara sepihak.
                </span>
              </div>
            )}

            <div className="divide-y divide-slate-100 text-xs">
              {[
                {
                  key: 'requirePhotoEvidence',
                  label: 'Wajib Bukti Foto Dokumentasi Lapangan (JPG/PNG)',
                  val: currentRules.requirePhotoEvidence,
                },
                {
                  key: 'requireDocumentEvidence',
                  label: 'Wajib Dokumen Pendukung / Hasil Uji Lab (PDF)',
                  val: currentRules.requireDocumentEvidence,
                },
                {
                  key: 'requireVideoEvidence',
                  label: 'Wajib Bukti Video Pelaksanaan (MP4)',
                  val: currentRules.requireVideoEvidence,
                },
                {
                  key: 'requireAdminVerification',
                  label: 'Wajib Verifikasi Kelengkapan Dokumen oleh Verifikator Administrasi',
                  val: currentRules.requireAdminVerification,
                },
                {
                  key: 'requireSupervisorApproval',
                  label: 'Wajib Pemeriksaan & Persetujuan Teknis Project Supervisor',
                  val: currentRules.requireSupervisorApproval,
                },
                {
                  key: 'requireOwnerApproval',
                  label: 'Wajib Persetujuan Akhir Pemilik Proyek sebelum Pencairan',
                  val: currentRules.requireOwnerApproval,
                },
                {
                  key: 'requireMfaForRelease',
                  label: 'Wajib Otorisasi Multi-Factor Authentication (MFA OTP) saat Pencairan',
                  val: currentRules.requireMfaForRelease,
                },
                {
                  key: 'blockReleaseOnActiveDispute',
                  label: 'Otomatis Kunci Dana Escrow apabila Terdapat Sengketa Aktif',
                  val: currentRules.blockReleaseOnActiveDispute,
                },
              ].map((item) => (
                <div key={item.key} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <input
                    type="checkbox"
                    aria-label={item.label}
                    checked={item.val}
                    disabled={!canEditRules}
                    onChange={(e) => handleToggleRule(item.key, e.target.checked)}
                    className="w-4 h-4 accent-[#0B1E3D]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Configurable H0-H200 Parameters (Bagian 14 PRD) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Konfigurasi Parameter Smart Contract (H0–H200)
            </h3>
            <p className="text-xs text-slate-600">
              Sesuai Bagian 14 PRD, angka H0, H180, H185, H188, H190, H195, dan H200 dapat
              dikonfigurasi sebagai unit tahapan waktu kontrak tanpa mengasumsikan jam atau hari
              kalender secara kaku.
            </p>

            <form onSubmit={handleSaveTimelineRules} className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Batas Penilaian Bukti (H180)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH180}
                  onChange={(e) => setRuleH180(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Batas Validasi (H185)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH185}
                  onChange={(e) => setRuleH185(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pencairan Cabang A (H188)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH188}
                  onChange={(e) => setRuleH188(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hasil Pembuktian (H190)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH190}
                  onChange={(e) => setRuleH190(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Perbaikan & Validasi (H195)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH195}
                  onChange={(e) => setRuleH195(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pencairan Pasca-Perbaikan (H200)
                </label>
                <input
                  type="number"
                  disabled={!canEditRules}
                  value={ruleH200}
                  onChange={(e) => setRuleH200(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              {canEditRules && (
                <div className="col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-[#0B1E3D] hover:bg-slate-800 text-white font-semibold rounded-md"
                  >
                    Simpan Parameter H0–H200 & Buat Versi Kebijakan Baru
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE 4: PROGRESS MONITORING (Bagian 12 PRD) ---
  const stages = db.projectStages.filter((s) => s.projectId === currentProject.id);
  const progressSummary = calculateWeightedProjectProgress(stages);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#0B1E3D]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Monitoring Progres Konstruksi Tertimbang — {currentProject.name}
            </h2>
            <p className="text-xs text-slate-500">
              Rumus: Progres Keseluruhan = ∑ (Realisasi Tahap × Bobot Tahap) ={' '}
              <span className="font-mono font-bold text-slate-900">
                {progressSummary.overallProgress}%
              </span>{' '}
              (Total Bobot: {progressSummary.totalWeight}%)
            </p>
          </div>
        </div>

        <select
          aria-label="Pilih Proyek untuk Monitoring Progres"
          value={selectedProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-slate-50"
        >
          {db.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.overallProgress}%)
            </option>
          ))}
        </select>
      </div>

      {formMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900">
          {formMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
              <th className="py-2.5 px-3 font-semibold">Tahapan Pekerjaan</th>
              <th className="py-2.5 px-3 font-semibold text-right">Bobot</th>
              <th className="py-2.5 px-3 font-semibold text-right">Target</th>
              <th className="py-2.5 px-3 font-semibold text-right">Realisasi</th>
              <th className="py-2.5 px-3 font-semibold text-right">Kontribusi</th>
              <th className="py-2.5 px-3 font-semibold">Jadwal Pelaksanaan</th>
              <th className="py-2.5 px-3 font-semibold">Status Verifikasi</th>
              <th className="py-2.5 px-3 font-semibold">Update Realisasi (Kontraktor)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stages.map((stg) => {
              const contribution = Math.round(((stg.realizedProgress * stg.weight) / 100) * 10) / 10;
              const isLate = stg.realizedProgress < stg.targetProgress;
              return (
                <tr key={stg.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-semibold text-slate-900">{stg.name}</td>
                  <td className="py-3 px-3 text-right font-mono">{stg.weight}%</td>
                  <td className="py-3 px-3 text-right font-mono">{stg.targetProgress}%</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {stg.realizedProgress}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                    +{contribution}%
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                    {stg.startDate} → {stg.targetEndDate}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`font-semibold ${
                        stg.verificationStatus === 'Terverifikasi'
                          ? 'text-emerald-700'
                          : isLate
                          ? 'text-amber-700'
                          : 'text-sky-700'
                      }`}
                    >
                      {stg.verificationStatus}
                      {isLate ? ' (Terlambat dari Target)' : ''}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {activeRole === 'CONTRACTOR' || activeRole === 'SUPER_ADMIN' ? (
                      <div className="flex items-center gap-1.5">
                        {[25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleStageProgressChange(stg.id, pct)}
                            className={`px-2 py-1 text-[11px] font-mono rounded border ${
                              stg.realizedProgress === pct
                                ? 'bg-[#0B1E3D] text-white border-[#0B1E3D]'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Hanya Kontraktor</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
