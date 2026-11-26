import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeightedProjectProgress,
  validateAndComputeMilestoneAmounts,
  evaluateMilestoneCompliance,
  transitionSmartContractState,
  canRolePerformAction,
  ContractRuleConfig,
  PaymentMilestone,
  EvidenceFile,
  DisputeRecord,
  SmartContractTimelineConfig,
} from './smartbuildEngine';

const defaultTimeline: SmartContractTimelineConfig = {
  unitLabel: 'Unit Kontrak (H)',
  H0: 0,
  H180: 180,
  H185: 185,
  H188: 188,
  H190: 190,
  H195: 195,
  H200: 200,
};

const defaultRules: ContractRuleConfig = {
  id: 'rule-1',
  contractId: 'cnt-1',
  version: 1,
  minProgressForRelease: 100,
  requirePhotoEvidence: true,
  requireVideoEvidence: false,
  requireDocumentEvidence: true,
  requireAdminVerification: true,
  requireSupervisorApproval: true,
  supervisorHasFinalTechnicalAuthority: true,
  requireOwnerApproval: true,
  requireMfaForRelease: true,
  blockReleaseOnActiveDispute: true,
  approvalSlaUnits: 5,
  repairGraceUnits: 5,
  disputeResolutionAuthority: 'Dewan Arbitrase Konstruksi & Pengawas Independen',
  timelineConfig: defaultTimeline,
  updatedAt: '2026-11-25T00:00:00Z',
  updatedBy: 'System',
};

const baseMilestone: PaymentMilestone = {
  id: 'ms-1',
  projectId: 'prj-1',
  contractId: 'cnt-1',
  order: 1,
  name: 'Tahap 1: Pondasi Selesai',
  linkedStageIds: ['stg-1'],
  percentage: 25,
  amount: 25000000,
  workProgress: 100,
  status: 'Menunggu persetujuan',
  approvalStatus: 'Disetujui Penuh (Pengawas & Pemilik)',
  authorizationStatus: 'MFA Terverifikasi & Diotorisasi',
  transactionStatus: 'Siap Diproses',
  supervisorApproved: true,
  adminVerified: true,
  ownerApproved: true,
  mfaVerifiedSessionId: 'MFA-SESSION-991',
  smartContractState: 'H180_H185_VALIDATION',
  smartContractCurrentH: 185,
};

const validEvidences: EvidenceFile[] = [
  {
    id: 'ev-1',
    projectId: 'prj-1',
    contractId: 'cnt-1',
    milestoneId: 'ms-1',
    stageName: 'Pondasi',
    uploaderId: 'usr-contractor',
    uploaderName: 'PT Konstruksi Nusantara',
    uploadedAt: '2026-11-20T10:00:00Z',
    description: 'Foto pengecoran pondasi tapak selesai',
    locationCoords: '-6.2088, 106.8456',
    fileName: 'pondasi_cor.jpg',
    fileType: 'JPG',
    fileSizeKb: 1420,
    previewUrl: '/demo/pondasi.jpg',
    inspectionStatus: 'Diterima',
    adminVerificationStatus: 'Dokumen Lengkap & Valid',
  },
  {
    id: 'ev-2',
    projectId: 'prj-1',
    contractId: 'cnt-1',
    milestoneId: 'ms-1',
    stageName: 'Pondasi',
    uploaderId: 'usr-contractor',
    uploaderName: 'PT Konstruksi Nusantara',
    uploadedAt: '2026-11-20T10:15:00Z',
    description: 'Laporan Uji Kuat Tekan Beton K-350',
    locationCoords: '-6.2088, 106.8456',
    fileName: 'uji_beton_k350.pdf',
    fileType: 'PDF',
    fileSizeKb: 850,
    previewUrl: '/demo/uji_beton.pdf',
    inspectionStatus: 'Diterima',
    adminVerificationStatus: 'Dokumen Lengkap & Valid',
  },
];

test('Bagian 12: Weighted progress calculation computes overall progress accurately and checks 100% weight sum', () => {
  const result = calculateWeightedProjectProgress([
    { realizedProgress: 100, weight: 25 },
    { realizedProgress: 100, weight: 30 },
    { realizedProgress: 20, weight: 25 },
    { realizedProgress: 0, weight: 20 },
  ]);
  assert.equal(result.isWeightValid, true);
  assert.equal(result.totalWeight, 100);
  // (100*25 + 100*30 + 20*25 + 0*20) / 100 = (2500 + 3000 + 500) / 100 = 60%
  assert.equal(result.overallProgress, 60);
});

test('Bagian 7.1: Milestone payment percentages must sum to 100%', () => {
  const valid = validateAndComputeMilestoneAmounts(100000000, [
    { name: 'Tahap 1: Pondasi selesai', percentage: 25 },
    { name: 'Tahap 2: Struktur bangunan', percentage: 30 },
    { name: 'Tahap 3: Dinding dan atap', percentage: 25 },
    { name: 'Tahap 4: Penyelesaian', percentage: 20 },
  ]);
  assert.equal(valid.isValid, true);
  assert.equal(valid.computed[0].amount, 25000000);
  assert.equal(valid.computed[1].amount, 30000000);

  const invalid = validateAndComputeMilestoneAmounts(100000000, [
    { name: 'Tahap 1', percentage: 25 },
    { name: 'Tahap 2', percentage: 30 },
  ]);
  assert.equal(invalid.isValid, false);
});

test('Bagian 25 QA Scenario 1: If contractor uploads evidence but supervisor rejects, funds MUST NOT be released', () => {
  const rejectedEvidences: EvidenceFile[] = [
    { ...validEvidences[0], inspectionStatus: 'Ditolak' },
    validEvidences[1],
  ];
  const res = evaluateMilestoneCompliance({
    milestone: { ...baseMilestone, supervisorApproved: false },
    rules: defaultRules,
    evidences: rejectedEvidences,
    disputes: [],
    escrowFundedAmount: 100000000,
    alreadyDisbursedIds: new Set(),
  });
  assert.equal(res.compliant, false);
  assert.ok(res.blockingReasons.some((r) => r.includes('ditolak') || r.includes('Pengawas')));
});

test('Bagian 25 QA Scenario 2: If supervisor accepts evidence but owner approval is missing when required, funds remain held', () => {
  const res = evaluateMilestoneCompliance({
    milestone: { ...baseMilestone, supervisorApproved: true, ownerApproved: false },
    rules: defaultRules,
    evidences: validEvidences,
    disputes: [],
    escrowFundedAmount: 100000000,
    alreadyDisbursedIds: new Set(),
  });
  assert.equal(res.compliant, false);
  assert.equal(res.overallVerdict, 'Menunggu pemeriksaan manusia');
  assert.ok(res.blockingReasons.some((r) => r.includes('Pemilik Proyek')));
});

test('Bagian 25 QA Scenario 3: If all requirements met but MFA fails/missing, disbursement MUST NOT proceed', () => {
  const res = evaluateMilestoneCompliance({
    milestone: { ...baseMilestone, mfaVerifiedSessionId: null },
    rules: defaultRules,
    evidences: validEvidences,
    disputes: [],
    escrowFundedAmount: 100000000,
    alreadyDisbursedIds: new Set(),
  });
  assert.equal(res.compliant, false);
  assert.ok(res.blockingReasons.some((r) => r.includes('MFA')));
});

test('Bagian 25 QA Scenario 4: If active dispute blocks payment, funds remain locked', () => {
  const activeDispute: DisputeRecord = {
    id: 'dsp-1',
    projectId: 'prj-1',
    contractId: 'cnt-1',
    milestoneId: 'ms-1',
    raisedById: 'usr-owner',
    raisedByName: 'Pemilik Proyek',
    raisedByRole: 'PROJECT_OWNER',
    raisedAt: '2026-11-22T09:00:00Z',
    reason: 'Mutu beton kolom tidak sesuai spesifikasi K-350',
    evidenceAttachmentName: 'hasil_hammer_test.pdf',
    status: 'Dalam pemeriksaan',
    blocksPayment: true,
    responses: [],
  };
  const res = evaluateMilestoneCompliance({
    milestone: baseMilestone,
    rules: defaultRules,
    evidences: validEvidences,
    disputes: [activeDispute],
    escrowFundedAmount: 100000000,
    alreadyDisbursedIds: new Set(),
  });
  assert.equal(res.compliant, false);
  assert.equal(res.overallVerdict, 'Terhalang sengketa');
});

test('Bagian 25 QA Scenario 5: Idempotency prevents duplicate disbursement of an already paid milestone', () => {
  const res = evaluateMilestoneCompliance({
    milestone: baseMilestone,
    rules: defaultRules,
    evidences: validEvidences,
    disputes: [],
    escrowFundedAmount: 100000000,
    alreadyDisbursedIds: new Set(['ms-1']),
  });
  assert.equal(res.compliant, false);
  assert.ok(res.blockingReasons.some((r) => r.includes('Idempotency')));
});

test('Bagian 14: Smart Contract H0-H200 workflow state machine branches A and B', () => {
  // Branch B: Requirements not met at H185
  const branchB = transitionSmartContractState({
    currentState: 'H180_H185_VALIDATION',
    event: 'VALIDATE_REQUIREMENTS_H185',
    requirementsMet: false,
    timeline: defaultTimeline,
  });
  assert.equal(branchB.nextState, 'H185_BRANCH_B_HELD');
  assert.equal(branchB.canDisburse, false);
  assert.equal(branchB.currentH, 185);

  // Branch A: Dual approval at H188
  const branchA188 = transitionSmartContractState({
    currentState: 'H180_H185_VALIDATION',
    event: 'BOTH_PARTIES_APPROVE_H188',
    requirementsMet: true,
    timeline: defaultTimeline,
  });
  assert.equal(branchA188.nextState, 'H188_DUAL_APPROVAL_DISBURSEMENT');
  assert.equal(branchA188.canDisburse, true);
  assert.equal(branchA188.currentH, 188);

  // Branch A with Dispute -> Proven at H190 -> Repair at H195 -> Final Disbursement at H200
  const objection = transitionSmartContractState({
    currentState: 'H180_H185_VALIDATION',
    event: 'PARTY_RAISES_OBJECTION',
    timeline: defaultTimeline,
  });
  assert.equal(objection.nextState, 'H185_DISPUTE_PROOF_CHECK');
  assert.equal(objection.canDisburse, false);

  const proven190 = transitionSmartContractState({
    currentState: objection.nextState,
    event: 'DISPUTE_PROVEN_H190',
    timeline: defaultTimeline,
  });
  assert.equal(proven190.nextState, 'H190_NON_COMPLIANCE_PROVEN');
  assert.equal(proven190.currentH, 190);

  const repair195 = transitionSmartContractState({
    currentState: proven190.nextState,
    event: 'REPAIR_VALIDATED_H195',
    timeline: defaultTimeline,
  });
  assert.equal(repair195.nextState, 'H195_REPAIR_AND_REVALIDATION');
  assert.equal(repair195.currentH, 195);

  const final200 = transitionSmartContractState({
    currentState: repair195.nextState,
    event: 'EXECUTE_FINAL_DISBURSEMENT_H200',
    timeline: defaultTimeline,
  });
  assert.equal(final200.nextState, 'H200_FINAL_DISBURSEMENT');
  assert.equal(final200.canDisburse, true);
  assert.equal(final200.currentH, 200);
});

test('Bagian 3: RBAC forbids supervisor or contractor from unilateral fund release or contract tampering', () => {
  assert.equal(canRolePerformAction('CONTRACTOR', 'DISBURSE_FUNDS_UNILATERALLY'), false);
  assert.equal(canRolePerformAction('PROJECT_SUPERVISOR', 'DISBURSE_FUNDS_UNILATERALLY'), false);
  assert.equal(canRolePerformAction('PROJECT_SUPERVISOR', 'MODIFY_CONTRACT_AMOUNT_UNILATERALLY'), false);
  assert.equal(canRolePerformAction('PROJECT_SUPERVISOR', 'DELETE_EVIDENCE_AS_SUPERVISOR'), false);
  assert.equal(canRolePerformAction('PROJECT_SUPERVISOR', 'INSPECT_TECHNICAL_EVIDENCE'), true);
  assert.equal(canRolePerformAction('ADMIN_VERIFIER', 'VERIFY_ADMIN_DOCUMENTS'), true);
});
