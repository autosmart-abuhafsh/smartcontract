/**
 * SmartBuild 3.0 — Core Domain Types, RBAC, Automated Compliance Engine,
 * Weighted Progress Calculator, Milestone Payment Locking, and H0-H200 Smart Contract State Machine.
 */

export type RoleId =
  | 'SUPER_ADMIN'
  | 'PROJECT_OWNER'
  | 'CONTRACTOR'
  | 'PROJECT_SUPERVISOR'
  | 'ADMIN_VERIFIER';

export type ProjectStatus =
  | 'Draft'
  | 'Menunggu Kontrak'
  | 'Menunggu Persetujuan'
  | 'Kontrak Aktif'
  | 'Dalam Pengerjaan'
  | 'Menunggu Verifikasi'
  | 'Dalam Perbaikan'
  | 'Selesai'
  | 'Dibatalkan';

export type PaymentMilestoneStatus =
  | 'Belum didanai'
  | 'Menunggu konfirmasi'
  | 'Dana ditahan'
  | 'Pekerjaan berlangsung'
  | 'Menunggu bukti'
  | 'Menunggu verifikasi'
  | 'Menunggu persetujuan'
  | 'Siap diproses'
  | 'Dalam proses pencairan'
  | 'Berhasil dicairkan'
  | 'Ditolak'
  | 'Ditahan karena sengketa';

export type InspectionStatus =
  | 'Menunggu pemeriksaan'
  | 'Sedang diperiksa'
  | 'Diterima'
  | 'Ditolak'
  | 'Perlu perbaikan'
  | 'Pemeriksaan ulang'
  | 'Selesai';

export type AdminVerificationStatus =
  | 'Menunggu Verifikasi'
  | 'Dokumen Lengkap & Valid'
  | 'Dokumen Kurang / Revisi';

export type DisputeStatus =
  | 'Tidak ada sengketa'
  | 'Sengketa diajukan'
  | 'Menunggu bukti'
  | 'Dalam pemeriksaan'
  | 'Terbukti'
  | 'Tidak terbukti'
  | 'Menunggu perbaikan'
  | 'Selesai';

export type SmartContractStageCode =
  | 'H0_ESCROW_FUNDED'
  | 'H0_H180_EXECUTION'
  | 'H180_DIGITAL_EVIDENCE_ASSESSMENT'
  | 'H180_H185_VALIDATION'
  | 'H185_BRANCH_B_HELD'
  | 'H188_DUAL_APPROVAL_DISBURSEMENT'
  | 'H185_DISPUTE_PROOF_CHECK'
  | 'H190_NON_COMPLIANCE_PROVEN'
  | 'H195_REPAIR_AND_REVALIDATION'
  | 'H195_DISPUTE_UNPROVEN_DISBURSEMENT'
  | 'H200_FINAL_DISBURSEMENT';

export interface SmartContractTimelineConfig {
  unitLabel: string; // e.g., "Unit Waktu Kontrak (H)" - configurable without assuming hours or calendar days
  H0: number;
  H180: number;
  H185: number;
  H188: number;
  H190: number;
  H195: number;
  H200: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  organization: string;
  phone: string;
  mfaEnabled: boolean;
  mfaMethod: 'OTP_BACKEND' | 'TOTP_AUTHENTICATOR';
  status: 'Aktif' | 'Nonaktif';
}

export interface ProjectStageProgress {
  id: string;
  projectId: string;
  order: number;
  name: string; // e.g. Persiapan, Pondasi, Struktur, Dinding, Atap, Instalasi, Finishing, Pemeriksaan akhir
  bimLayerId: 'foundation' | 'structure' | 'walls' | 'roof' | 'mep' | 'finishing' | 'site' | 'final';
  targetProgress: number; // 0-100
  realizedProgress: number; // 0-100
  weight: number; // percentage weight, all stages in project sum to 100
  startDate: string;
  targetEndDate: string;
  picName: string;
  verificationStatus: 'Menunggu Bukti' | 'Menunggu Verifikasi' | 'Terverifikasi' | 'Perlu Perbaikan';
}

export interface ContractRuleConfig {
  id: string;
  contractId: string;
  version: number;
  minProgressForRelease: number; // default 100% of stage
  requirePhotoEvidence: boolean;
  requireVideoEvidence: boolean;
  requireDocumentEvidence: boolean;
  requireAdminVerification: boolean;
  requireSupervisorApproval: boolean;
  supervisorHasFinalTechnicalAuthority: boolean;
  requireOwnerApproval: boolean;
  requireMfaForRelease: boolean;
  blockReleaseOnActiveDispute: boolean;
  approvalSlaUnits: number;
  repairGraceUnits: number;
  disputeResolutionAuthority: string;
  timelineConfig: SmartContractTimelineConfig;
  updatedAt: string;
  updatedBy: string;
}

export interface ContractPolicySet {
  id: string;
  contractId: string;
  version: number;
  ownerPolicies: string[];
  contractorPolicies: string[];
  supervisorPolicies: string[];
  changeLog: {
    version: number;
    changedAt: string;
    changedBy: string;
    summary: string;
    approvedByBothParties: boolean;
  }[];
}

export interface ContractApprovalRecord {
  id: string;
  contractId: string;
  contractVersion: number;
  userId: string;
  userName: string;
  role: RoleId;
  approvedAt: string;
  authMethod: 'MFA_OTP_VERIFIED';
  proofHash: string;
  notes: string;
}

export interface ContractAddendum {
  id: string;
  contractId: string;
  versionNumber: number;
  title: string;
  proposedBy: string;
  proposedByRole: RoleId;
  proposedAt: string;
  changesSummary: string;
  newContractValue?: number;
  newTargetEndDate?: string;
  ownerApproved: boolean;
  contractorApproved: boolean;
  status: 'Menunggu Persetujuan Kedua Pihak' | 'Disetujui & Aktif' | 'Ditolak';
}

export interface DigitalContract {
  id: string;
  contractNumber: string;
  projectId: string;
  version: number;
  ownerId: string;
  ownerName: string;
  contractorId: string;
  contractorName: string;
  supervisorId: string;
  supervisorName: string;
  contractValue: number;
  scopeOfWork: string;
  workStagesSummary: string;
  startDate: string;
  targetEndDate: string;
  paymentTerms: string;
  verificationRequirements: string;
  objectionTerms: string;
  disputeTerms: string;
  disbursementTerms: string;
  ownerApproved: boolean;
  contractorApproved: boolean;
  isLocked: boolean;
  status: 'Draft' | 'Menunggu Persetujuan' | 'Kontrak Aktif (Terkunci)' | 'Addendum Dalam Proses' | 'Selesai';
  approvals: ContractApprovalRecord[];
  addendums: ContractAddendum[];
}

export interface EvidenceFile {
  id: string;
  projectId: string;
  contractId: string;
  milestoneId: string;
  stageName: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: string;
  description: string;
  locationCoords: string;
  fileName: string;
  fileType: 'JPG' | 'JPEG' | 'PNG' | 'MP4' | 'PDF';
  fileSizeKb: number;
  previewUrl: string;
  inspectionStatus: InspectionStatus;
  adminVerificationStatus: AdminVerificationStatus;
  supervisorNotes?: string;
  adminVerifierNotes?: string;
}

export interface InspectionReport {
  id: string;
  projectId: string;
  contractId: string;
  milestoneId: string;
  evidenceId: string;
  stageName: string;
  supervisorId: string;
  supervisorName: string;
  inspectedAt: string;
  result: InspectionStatus;
  technicalNotes: string;
  recommendation: string;
  attachmentReportName: string;
}

export interface PaymentMilestone {
  id: string;
  projectId: string;
  contractId: string;
  order: number;
  name: string;
  linkedStageIds: string[];
  percentage: number; // e.g., 25, 30, 25, 20 (sum = 100)
  amount: number;
  workProgress: number; // 0-100
  status: PaymentMilestoneStatus;
  approvalStatus: 'Belum Disetujui' | 'Disetujui Pengawas' | 'Disetujui Penuh (Pengawas & Pemilik)' | 'Ditolak';
  authorizationStatus: 'Belum Diotorisasi' | 'MFA Terverifikasi & Diotorisasi' | 'Otorisasi Gagal';
  transactionStatus: 'Belum Diproses' | 'Siap Diproses' | 'Dalam Proses' | 'Berhasil Dicairkan' | 'Ditahan / Gagal';
  supervisorApproved: boolean;
  adminVerified: boolean;
  ownerApproved: boolean;
  mfaVerifiedSessionId: string | null;
  smartContractState: SmartContractStageCode;
  smartContractCurrentH: number;
  disbursedAt?: string;
  transactionRef?: string;
  idempotencyKey?: string;
}

export interface DisputeRecord {
  id: string;
  projectId: string;
  contractId: string;
  milestoneId: string;
  raisedById: string;
  raisedByName: string;
  raisedByRole: RoleId;
  raisedAt: string;
  reason: string;
  evidenceAttachmentName: string;
  status: DisputeStatus;
  blocksPayment: boolean;
  responses: {
    id: string;
    responderName: string;
    responderRole: RoleId;
    respondedAt: string;
    message: string;
    attachmentName?: string;
  }[];
  resolution?: {
    decidedByName: string;
    decidedByRole: RoleId;
    decidedAt: string;
    ruling: 'Terbukti (Wajib Perbaikan H190-H195)' | 'Tidak Terbukti (Lanjut Pencairan H195)';
    decisionBasis: string;
  };
}

export interface PaymentTransaction {
  id: string;
  transactionNumber: string;
  contractNumber: string;
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  amount: number;
  date: string;
  recipientName: string;
  type: 'SETORAN_ESCROW_H0' | 'PENCAIRAN_MILESTONE' | 'PENGEMBALIAN_DANA';
  approvalStatus: string;
  authorizationStatus: string;
  transactionStatus: 'Berhasil' | 'Menunggu' | 'Ditahan' | 'Ditolak';
  referenceNumber: string;
  idempotencyKey: string;
  isDemo: boolean;
  blockchainRecord: {
    network: string;
    chainId: number;
    walletAddress: string;
    smartContractAddress: string;
    transactionHash: string;
    blockTimestamp: string;
    isSimulatedDemo: boolean;
  };
}

export interface BimElementSpec {
  id: string;
  name: string;
  objectType: string;
  ifcCategory: string;
  material: string;
  dimensions: string;
  volumeM3: number;
  linkedStage: 'foundation' | 'structure' | 'walls' | 'roof' | 'mep' | 'finishing';
  stageLabel: string;
  completionPercent: number;
  technicalSpec: string;
}

export interface BimModelVersion {
  id: string;
  projectId: string;
  versionNumber: string;
  fileName: string;
  format: 'GLB' | 'glTF' | 'IFC_CONVERTED';
  uploadedAt: string;
  uploadedBy: string;
  fileSizeMb: number;
  notes: string;
  elementsCount: number;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  description: string;
  buildingImageUrl: string;
  projectValue: number;
  startDate: string;
  targetEndDate: string;
  ownerId: string;
  ownerName: string;
  contractorId: string;
  contractorName: string;
  supervisorId: string;
  supervisorName: string;
  verifierId: string;
  verifierName: string;
  status: ProjectStatus;
  overallProgress: number; // computed from weighted stages
  isArchived: boolean;
  isDemo: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  role: RoleId;
  activity: string;
  timestamp: string;
  projectId: string;
  contractId: string;
  statusBefore: string;
  statusAfter: string;
  sessionIp: string;
  integrityHash: string;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  overallVerdict:
    | 'Memenuhi persyaratan'
    | 'Belum memenuhi persyaratan'
    | 'Menunggu pemeriksaan manusia'
    | 'Terhalang sengketa';
  checks: {
    code: string;
    label: string;
    passed: boolean;
    reason: string;
  }[];
  blockingReasons: string[];
}

/**
 * 1. Weighted Progress Calculation (Bagian 12 PRD)
 * Formula: Progres keseluruhan = sum(progres setiap tahap * bobot tahap) / 100
 * Validates that total weights equal 100%.
 */
export function calculateWeightedProjectProgress(
  stages: Pick<ProjectStageProgress, 'realizedProgress' | 'weight'>[]
): { overallProgress: number; totalWeight: number; isWeightValid: boolean } {
  if (stages.length === 0) {
    return { overallProgress: 0, totalWeight: 0, isWeightValid: false };
  }
  const totalWeight = stages.reduce((sum, s) => sum + s.weight, 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;
  const weightedSum = stages.reduce((sum, s) => {
    const clampedProgress = Math.max(0, Math.min(100, s.realizedProgress));
    return sum + clampedProgress * s.weight;
  }, 0);

  const overallProgress = Math.round((weightedSum / 100) * 10) / 10;
  return { overallProgress, totalWeight, isWeightValid };
}

/**
 * 2. Milestone Payment Schedule Validator (Bagian 7.1 PRD)
 * Total percentage of all payment milestones in a contract must equal 100%,
 * and each milestone amount is calculated accurately from contractValue.
 */
export function validateAndComputeMilestoneAmounts(
  contractValue: number,
  milestones: { name: string; percentage: number }[]
): {
  isValid: boolean;
  totalPercentage: number;
  error?: string;
  computed: { name: string; percentage: number; amount: number }[];
} {
  if (contractValue <= 0) {
    return {
      isValid: false,
      totalPercentage: 0,
      error: 'Nilai kontrak harus lebih besar dari Rp 0.',
      computed: [],
    };
  }
  const totalPercentage = milestones.reduce((acc, m) => acc + m.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return {
      isValid: false,
      totalPercentage,
      error: `Total persentase tahapan pembayaran harus 100% (saat ini ${totalPercentage}%).`,
      computed: [],
    };
  }
  const computed = milestones.map((m) => ({
    name: m.name,
    percentage: m.percentage,
    amount: Math.round((contractValue * m.percentage) / 100),
  }));
  return { isValid: true, totalPercentage: 100, computed };
}

/**
 * 3. Automated Compliance & Payment Locking Engine (Bagian 7.3, 13, 25 PRD)
 * Evaluates whether a payment milestone satisfies all contract rules, evidence,
 * third-party inspection, admin verification, owner approval, dispute status, and MFA authorization.
 */
export function evaluateMilestoneCompliance(params: {
  milestone: PaymentMilestone;
  rules: ContractRuleConfig;
  evidences: EvidenceFile[];
  disputes: DisputeRecord[];
  escrowFundedAmount: number;
  alreadyDisbursedIds: Set<string>;
}): ComplianceCheckResult {
  const { milestone, rules, evidences, disputes, escrowFundedAmount, alreadyDisbursedIds } = params;
  const checks: ComplianceCheckResult['checks'] = [];
  const blockingReasons: string[] = [];

  // Check 0: Idempotency / duplicate transaction prevention
  const notDuplicate =
    milestone.status !== 'Berhasil dicairkan' && !alreadyDisbursedIds.has(milestone.id);
  checks.push({
    code: 'IDEMPOTENCY_GUARD',
    label: 'Validasi Anti-Pencairan Ganda (Idempotency)',
    passed: notDuplicate,
    reason: notDuplicate
      ? 'Tahap pembayaran belum pernah dicairkan sebelumnya.'
      : 'Transaksi pembayaran tahap ini sudah berhasil dicairkan. Permintaan berulang ditolak.',
  });
  if (!notDuplicate) {
    blockingReasons.push('Transaksi pembayaran tahap ini telah dicairkan sebelumnya (Idempotency Guard).');
  }

  // Check 1: Escrow funding sufficiency (H0)
  const escrowSufficient = escrowFundedAmount >= milestone.amount;
  checks.push({
    code: 'ESCROW_FUNDED',
    label: 'Ketersediaan Dana Escrow (H0)',
    passed: escrowSufficient,
    reason: escrowSufficient
      ? `Saldo Escrow mencukupi untuk nilai tahap Rp ${milestone.amount.toLocaleString('id-ID')}.`
      : 'Dana belum disetorkan atau saldo Escrow tertahan tidak mencukupi.',
  });
  if (!escrowSufficient) {
    blockingReasons.push('Dana Escrow belum mencukupi untuk tahapan ini.');
  }

  // Check 2: Work progress threshold
  const progressMet = milestone.workProgress >= rules.minProgressForRelease;
  checks.push({
    code: 'WORK_PROGRESS',
    label: `Progres Pekerjaan Minimum (${rules.minProgressForRelease}%)`,
    passed: progressMet,
    reason: progressMet
      ? `Progres tahap mencapai ${milestone.workProgress}% (memenuhi syarat >= ${rules.minProgressForRelease}%).`
      : `Progres tahap baru mencapai ${milestone.workProgress}% (syarat minimum ${rules.minProgressForRelease}%).`,
  });
  if (!progressMet) {
    blockingReasons.push(
      `Persyaratan progres pekerjaan belum terpenuhi (${milestone.workProgress}% dari target ${rules.minProgressForRelease}%).`
    );
  }

  // Check 3: Required digital evidence files
  const milestoneEvidences = evidences.filter((e) => e.milestoneId === milestone.id);
  const hasPhoto = milestoneEvidences.some((e) => ['JPG', 'JPEG', 'PNG'].includes(e.fileType));
  const hasVideo = milestoneEvidences.some((e) => e.fileType === 'MP4');
  const hasDoc = milestoneEvidences.some((e) => e.fileType === 'PDF');

  const photoOk = !rules.requirePhotoEvidence || hasPhoto;
  const videoOk = !rules.requireVideoEvidence || hasVideo;
  const docOk = !rules.requireDocumentEvidence || hasDoc;
  const evidenceAvailable = milestoneEvidences.length > 0 && photoOk && videoOk && docOk;

  const missingEvidenceTypes: string[] = [];
  if (rules.requirePhotoEvidence && !hasPhoto) missingEvidenceTypes.push('Foto (JPG/PNG)');
  if (rules.requireVideoEvidence && !hasVideo) missingEvidenceTypes.push('Video (MP4)');
  if (rules.requireDocumentEvidence && !hasDoc) missingEvidenceTypes.push('Dokumen (PDF)');

  checks.push({
    code: 'DIGITAL_EVIDENCE',
    label: 'Ketersediaan Bukti Digital & Dokumen Wajib',
    passed: evidenceAvailable,
    reason: evidenceAvailable
      ? `${milestoneEvidences.length} berkas bukti pekerjaan wajib telah diunggah.`
      : `Bukti pekerjaan belum lengkap. Kurang: ${
          missingEvidenceTypes.length > 0 ? missingEvidenceTypes.join(', ') : 'Minimal 1 bukti digital'
        }.`,
  });
  if (!evidenceAvailable) {
    blockingReasons.push(
      `Bukti pekerjaan wajib belum lengkap (${
        missingEvidenceTypes.length > 0 ? missingEvidenceTypes.join(', ') : 'belum ada bukti diunggah'
      }).`
    );
  }

  // Check 4: Administrative Verification (Bagian 3.5)
  const adminOk = !rules.requireAdminVerification || milestone.adminVerified;
  checks.push({
    code: 'ADMIN_VERIFICATION',
    label: 'Verifikasi Kelengkapan Administrasi',
    passed: adminOk,
    reason: adminOk
      ? 'Verifikator Administrasi telah memvalidasi kelengkapan dokumen persyaratan.'
      : 'Menunggu verifikasi kelengkapan dokumen oleh Verifikator Administrasi.',
  });
  if (!adminOk) {
    blockingReasons.push('Verifikasi dokumen administratif belum selesai.');
  }

  // Check 5: Third-Party Supervisor Inspection (Bagian 10)
  const rejectedEvidence = milestoneEvidences.some(
    (e) => e.inspectionStatus === 'Ditolak' || e.inspectionStatus === 'Perlu perbaikan'
  );
  const supervisorOk =
    !rules.requireSupervisorApproval || (milestone.supervisorApproved && !rejectedEvidence);
  checks.push({
    code: 'SUPERVISOR_INSPECTION',
    label: 'Pemeriksaan & Persetujuan Pengawas Pihak Ketiga (Project Supervisor)',
    passed: supervisorOk,
    reason: rejectedEvidence
      ? 'Pengawas menolak bukti atau meminta perbaikan teknis konstruksi.'
      : supervisorOk
      ? 'Pengawas Pihak Ketiga telah memeriksa dan menyetujui bukti teknis pekerjaan.'
      : 'Pengawas Pihak Ketiga belum memberikan persetujuan pemeriksaan teknis.',
  });
  if (!supervisorOk) {
    blockingReasons.push(
      rejectedEvidence
        ? 'Bukti pekerjaan ditolak atau diminta perbaikan oleh Pengawas Pihak Ketiga.'
        : 'Pengawas Pihak Ketiga belum menyelesaikan pemeriksaan atau memberikan persetujuan.'
    );
  }

  // Check 6: Project Owner Approval
  const ownerOk = !rules.requireOwnerApproval || milestone.ownerApproved;
  checks.push({
    code: 'OWNER_APPROVAL',
    label: 'Persetujuan Pemilik Proyek / Pengguna Jasa',
    passed: ownerOk,
    reason: ownerOk
      ? 'Pemilik Proyek telah menyetujui tahapan pembayaran ini.'
      : 'Pemilik Proyek belum memberikan persetujuan pencairan.',
  });
  if (!ownerOk) {
    blockingReasons.push('Persetujuan Pemilik Proyek belum diberikan.');
  }

  // Check 7: Active Blocking Dispute (Bagian 15)
  const activeBlockingDisputes = disputes.filter(
    (d) =>
      d.milestoneId === milestone.id &&
      d.blocksPayment &&
      d.status !== 'Tidak ada sengketa' &&
      d.status !== 'Tidak terbukti' &&
      d.status !== 'Selesai'
  );
  const noBlockingDispute = !rules.blockReleaseOnActiveDispute || activeBlockingDisputes.length === 0;
  checks.push({
    code: 'DISPUTE_CLEARANCE',
    label: 'Bebas Sengketa Aktif yang Menghalangi Pencairan',
    passed: noBlockingDispute,
    reason: noBlockingDispute
      ? 'Tidak terdapat sengketa aktif yang menahan pencairan dana.'
      : `Terdapat ${activeBlockingDisputes.length} sengketa aktif (${activeBlockingDisputes[0].status}) yang menahan pencairan.`,
  });
  if (!noBlockingDispute) {
    blockingReasons.push(
      `Dana ditahan karena terdapat sengketa aktif: "${activeBlockingDisputes[0].reason}" (${activeBlockingDisputes[0].status}).`
    );
  }

  // Check 8: MFA Authorization (Bagian 8)
  const mfaOk = !rules.requireMfaForRelease || Boolean(milestone.mfaVerifiedSessionId);
  checks.push({
    code: 'MFA_AUTHORIZATION',
    label: 'Otorisasi Keamanan Multi-Factor Authentication (MFA OTP)',
    passed: mfaOk,
    reason: mfaOk
      ? `Otorisasi MFA berhasil diverifikasi di backend (Ref: ${milestone.mfaVerifiedSessionId}).`
      : 'Transaksi belum mendapatkan otorisasi MFA OTP yang valid.',
  });
  if (!mfaOk) {
    blockingReasons.push('Otorisasi MFA belum dilakukan atau kode OTP belum terverifikasi.');
  }

  const compliant = checks.every((c) => c.passed);
  let overallVerdict: ComplianceCheckResult['overallVerdict'] = 'Memenuhi persyaratan';
  if (!noBlockingDispute) {
    overallVerdict = 'Terhalang sengketa';
  } else if (!progressMet || !evidenceAvailable || rejectedEvidence || !escrowSufficient || !notDuplicate) {
    overallVerdict = 'Belum memenuhi persyaratan';
  } else if (!adminOk || !supervisorOk || !ownerOk || !mfaOk) {
    overallVerdict = 'Menunggu pemeriksaan manusia';
  }

  return {
    compliant,
    overallVerdict,
    checks,
    blockingReasons,
  };
}

/**
 * 4. Smart Contract Workflow State Machine H0-H200 (Bagian 14 PRD)
 * Strictly follows the client diagram:
 * H0 (Deposit) -> H0..H180 (Execution & Max H180 Digital Evidence Assessment)
 * -> H180..H185 (Validation)
 *   - Branch B (Syarat Tidak Terpenuhi): H185 Dana tetap tertahan
 *   - Branch A (Syarat Terpenuhi):
 *       - Kedua pihak menyetujui -> H188 Pencairan dana sesuai ketentuan
 *       - Salah satu pihak tidak menyetujui -> Pembuktian ketidaksesuaian:
 *           - Terbukti -> H190 Hasil pembuktian -> H195 Perbaikan & validasi bukti -> H200 Pencairan
 *           - Tidak terbukti -> H195 Pencairan sesuai ketentuan
 */
export interface SmartContractTransitionInput {
  currentState: SmartContractStageCode;
  event:
    | 'FUND_ESCROW_H0'
    | 'SUBMIT_EVIDENCE_H180'
    | 'VALIDATE_REQUIREMENTS_H185'
    | 'BOTH_PARTIES_APPROVE_H188'
    | 'PARTY_RAISES_OBJECTION'
    | 'DISPUTE_PROVEN_H190'
    | 'DISPUTE_NOT_PROVEN_H195'
    | 'REPAIR_VALIDATED_H195'
    | 'EXECUTE_FINAL_DISBURSEMENT_H200';
  requirementsMet?: boolean;
  timeline: SmartContractTimelineConfig;
}

export function transitionSmartContractState(input: SmartContractTransitionInput): {
  nextState: SmartContractStageCode;
  currentH: number;
  paymentHold: boolean;
  canDisburse: boolean;
  description: string;
} {
  const { currentState, event, requirementsMet, timeline } = input;

  switch (event) {
    case 'FUND_ESCROW_H0':
      return {
        nextState: 'H0_H180_EXECUTION',
        currentH: timeline.H0,
        paymentHold: true,
        canDisburse: false,
        description: `H${timeline.H0}: Pengguna jasa menyetorkan dana ke Smart Contract Escrow. Periode pelaksanaan H${timeline.H0}–H${timeline.H180} dimulai.`,
      };

    case 'SUBMIT_EVIDENCE_H180':
      return {
        nextState: 'H180_H185_VALIDATION',
        currentH: timeline.H180,
        paymentHold: true,
        canDisburse: false,
        description: `H${timeline.H180}: Penilaian bukti digital selesai diajukan. Masuk periode validasi H${timeline.H180}–H${timeline.H185}.`,
      };

    case 'VALIDATE_REQUIREMENTS_H185':
      if (!requirementsMet) {
        return {
          nextState: 'H185_BRANCH_B_HELD',
          currentH: timeline.H185,
          paymentHold: true,
          canDisburse: false,
          description: `Cabang B (H${timeline.H185}): Syarat tidak terpenuhi. Dana tetap tertahan di Smart Contract sampai persyaratan dipenuhi.`,
        };
      }
      return {
        nextState: 'H180_H185_VALIDATION',
        currentH: timeline.H185,
        paymentHold: true,
        canDisburse: false,
        description: `Cabang A (H${timeline.H185}): Syarat teknis & administratif terpenuhi. Menunggu kesepakatan kedua belah pihak.`,
      };

    case 'BOTH_PARTIES_APPROVE_H188':
      if (currentState === 'H185_BRANCH_B_HELD' || requirementsMet === false) {
        return {
          nextState: 'H185_BRANCH_B_HELD',
          currentH: timeline.H185,
          paymentHold: true,
          canDisburse: false,
          description: `Pencairan ditolak pada H${timeline.H185}: Syarat kontrak belum terpenuhi.`,
        };
      }
      return {
        nextState: 'H188_DUAL_APPROVAL_DISBURSEMENT',
        currentH: timeline.H188,
        paymentHold: false,
        canDisburse: true,
        description: `Cabang A (H${timeline.H188}): Kedua pihak menyetujui. Proses pencairan dana sesuai ketentuan kontrak.`,
      };

    case 'PARTY_RAISES_OBJECTION':
      return {
        nextState: 'H185_DISPUTE_PROOF_CHECK',
        currentH: timeline.H185,
        paymentHold: true,
        canDisburse: false,
        description: `Cabang A (H${timeline.H185}): Salah satu pihak tidak menyetujui. Dilakukan pembuktian ketidaksesuaian terhadap kontrak awal.`,
      };

    case 'DISPUTE_PROVEN_H190':
      return {
        nextState: 'H190_NON_COMPLIANCE_PROVEN',
        currentH: timeline.H190,
        paymentHold: true,
        canDisburse: false,
        description: `H${timeline.H190}: Ketidaksesuaian terbukti. Kontraktor wajib melakukan perbaikan dan validasi ulang bukti pada H${timeline.H195}.`,
      };

    case 'REPAIR_VALIDATED_H195':
      return {
        nextState: 'H195_REPAIR_AND_REVALIDATION',
        currentH: timeline.H195,
        paymentHold: true,
        canDisburse: false,
        description: `H${timeline.H195}: Perbaikan selesai dan bukti tervalidasi. Siap menuju pencairan akhir pada H${timeline.H200}.`,
      };

    case 'EXECUTE_FINAL_DISBURSEMENT_H200':
      return {
        nextState: 'H200_FINAL_DISBURSEMENT',
        currentH: timeline.H200,
        paymentHold: false,
        canDisburse: true,
        description: `H${timeline.H200}: Proses pencairan dana pasca-perbaikan dan validasi bukti sesuai ketentuan kontrak.`,
      };

    case 'DISPUTE_NOT_PROVEN_H195':
      return {
        nextState: 'H195_DISPUTE_UNPROVEN_DISBURSEMENT',
        currentH: timeline.H195,
        paymentHold: false,
        canDisburse: true,
        description: `H${timeline.H195}: Ketidaksesuaian tidak terbukti. Proses pencairan dana dilaksanakan sesuai ketentuan kontrak.`,
      };

    default:
      return {
        nextState: currentState,
        currentH: timeline.H0,
        paymentHold: true,
        canDisburse: false,
        description: 'Status Smart Contract tetap.',
      };
  }
}

/**
 * 5. Role-Based Access Control Matrix (Bagian 3 & Bagian 24 PRD)
 */
export const ROLE_LABELS: Record<RoleId, string> = {
  SUPER_ADMIN: 'Super Admin',
  PROJECT_OWNER: 'Pemilik Proyek / Pengguna Jasa',
  CONTRACTOR: 'Penyedia Jasa / Kontraktor',
  PROJECT_SUPERVISOR: 'Project Supervisor (Pengawas Pihak Ketiga)',
  ADMIN_VERIFIER: 'Verifikator Administrasi',
};

export function canRolePerformAction(
  role: RoleId,
  action:
    | 'CREATE_PROJECT'
    | 'EDIT_CONTRACT_DRAFT'
    | 'APPROVE_CONTRACT'
    | 'UPLOAD_EVIDENCE'
    | 'INSPECT_TECHNICAL_EVIDENCE'
    | 'VERIFY_ADMIN_DOCUMENTS'
    | 'APPROVE_PAYMENT_OWNER'
    | 'DISBURSE_FUNDS_UNILATERALLY'
    | 'RAISE_DISPUTE'
    | 'RESOLVE_DISPUTE'
    | 'MANAGE_USERS'
    | 'ASSIGN_SUPERVISOR'
    | 'MODIFY_CONTRACT_AMOUNT_UNILATERALLY'
    | 'DELETE_EVIDENCE_AS_SUPERVISOR'
): boolean {
  // Explicitly forbidden actions across all roles per PRD
  if (
    action === 'DISBURSE_FUNDS_UNILATERALLY' ||
    action === 'MODIFY_CONTRACT_AMOUNT_UNILATERALLY' ||
    action === 'DELETE_EVIDENCE_AS_SUPERVISOR'
  ) {
    return false;
  }

  switch (action) {
    case 'CREATE_PROJECT':
      return role === 'PROJECT_OWNER' || role === 'SUPER_ADMIN';
    case 'EDIT_CONTRACT_DRAFT':
      return role === 'PROJECT_OWNER' || role === 'CONTRACTOR';
    case 'APPROVE_CONTRACT':
      return role === 'PROJECT_OWNER' || role === 'CONTRACTOR';
    case 'UPLOAD_EVIDENCE':
      return role === 'CONTRACTOR';
    case 'INSPECT_TECHNICAL_EVIDENCE':
      return role === 'PROJECT_SUPERVISOR';
    case 'VERIFY_ADMIN_DOCUMENTS':
      return role === 'ADMIN_VERIFIER';
    case 'APPROVE_PAYMENT_OWNER':
      return role === 'PROJECT_OWNER';
    case 'RAISE_DISPUTE':
      return role === 'PROJECT_OWNER' || role === 'CONTRACTOR';
    case 'RESOLVE_DISPUTE':
      return role === 'SUPER_ADMIN' || role === 'PROJECT_SUPERVISOR';
    case 'MANAGE_USERS':
    case 'ASSIGN_SUPERVISOR':
      return role === 'SUPER_ADMIN';
    default:
      return false;
  }
}
