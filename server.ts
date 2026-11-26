import express from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialSeedDatabase,
  SmartBuildDatabase,
  MfaAuthLog,
} from './src/data/seedDatabase';
import {
  calculateWeightedProjectProgress,
  evaluateMilestoneCompliance,
  transitionSmartContractState,
  canRolePerformAction,
  RoleId,
  InspectionStatus,
  AdminVerificationStatus,
  SmartContractTransitionInput,
} from './src/logic/smartbuildEngine';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'smartbuild_db.json');

function loadDatabase(): SmartBuildDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw) as SmartBuildDatabase;
    }
  } catch {
    // Fallback to clean seed if corrupted
  }
  const initial = createInitialSeedDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: SmartBuildDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // Ignore write failure in read-only containers
  }
}

let db: SmartBuildDatabase = loadDatabase();

// Server-side MFA OTP Store (Never exposed in logs or unauthenticated endpoints)
interface ServerOtpChallenge {
  challengeId: string;
  userId: string;
  userName: string;
  role: RoleId;
  actionType: MfaAuthLog['actionType'];
  otpHash: string;
  expiresAtMs: number;
  attemptsUsed: number;
  maxAttempts: number;
  verifiedSessionToken: string | null;
}

const otpChallenges = new Map<string, ServerOtpChallenge>();
const verifiedMfaTokens = new Map<
  string,
  { userId: string; role: RoleId; actionType: string; verifiedAt: string; used: boolean }
>();
const disbursedIdempotencyKeys = new Set<string>(
  db.paymentMilestones
    .filter((m) => m.status === 'Berhasil dicairkan')
    .map((m) => m.id)
);

function hashValue(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function formatWibNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} WIB`;
}

function appendAuditLog(params: {
  userId: string;
  userName: string;
  role: RoleId;
  activity: string;
  projectId: string;
  contractId: string;
  statusBefore: string;
  statusAfter: string;
  sessionIp?: string;
}) {
  const timestamp = formatWibNow();
  const prevHash = db.auditLogs[0]?.integrityHash || 'GENESIS';
  const payload = `${prevHash}|${params.userId}|${params.role}|${params.activity}|${timestamp}|${params.statusAfter}`;
  const integrityHash = `SHA256:${hashValue(payload).slice(0, 48)}`;
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: params.userId,
    userName: params.userName,
    role: params.role,
    activity: params.activity,
    timestamp,
    projectId: params.projectId,
    contractId: params.contractId,
    statusBefore: params.statusBefore,
    statusAfter: params.statusAfter,
    sessionIp: params.sessionIp || '103.144.20.11 (Verified Session)',
    integrityHash,
  });
}

function appendNotification(params: {
  targetRoles: RoleId[];
  projectId: string;
  title: string;
  message: string;
  category:
    | 'KONTRAK'
    | 'PROYEK'
    | 'BUKTI_PEKERJAAN'
    | 'PENGAWASAN'
    | 'SENGKETA'
    | 'PEMBAYARAN'
    | 'MFA';
}) {
  db.notifications.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetRoles: params.targetRoles,
    projectId: params.projectId,
    title: params.title,
    message: params.message,
    category: params.category,
    createdAt: formatWibNow(),
    isRead: false,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- API: Full State & Live Compliance Evaluation ---
  app.get('/api/state', (_req, res) => {
    // Recompute weighted progress for every project dynamically
    for (const project of db.projects) {
      const stages = db.projectStages.filter((s) => s.projectId === project.id);
      if (stages.length > 0) {
        const calc = calculateWeightedProjectProgress(stages);
        project.overallProgress = calc.overallProgress;
      }
    }

    // Evaluate automated compliance for every payment milestone
    const complianceByMilestone: Record<string, ReturnType<typeof evaluateMilestoneCompliance>> = {};
    for (const ms of db.paymentMilestones) {
      const rules =
        db.contractRules.find((r) => r.contractId === ms.contractId) || db.contractRules[0];
      const escrow = db.escrowRecords.find((e) => e.contractId === ms.contractId);
      complianceByMilestone[ms.id] = evaluateMilestoneCompliance({
        milestone: ms,
        rules,
        evidences: db.evidences,
        disputes: db.disputes,
        escrowFundedAmount: escrow ? escrow.heldAmount + escrow.disbursedAmount : 0,
        alreadyDisbursedIds: disbursedIdempotencyKeys,
      });
    }

    res.json({
      ...db,
      complianceByMilestone,
    });
  });

  // --- API: Reset Demo Data ---
  app.post('/api/demo/reset', (_req, res) => {
    db = createInitialSeedDatabase();
    disbursedIdempotencyKeys.clear();
    for (const m of db.paymentMilestones) {
      if (m.status === 'Berhasil dicairkan') {
        disbursedIdempotencyKeys.add(m.id);
      }
    }
    saveDatabase(db);
    res.json({ ok: true, message: 'Database simulasi DEMO berhasil direset ke kondisi awal.' });
  });

  // --- API: MFA OTP Backend Generation & Verification (Bagian 8 PRD) ---
  app.post('/api/mfa/request', (req, res) => {
    const { userId, actionType } = req.body as {
      userId: string;
      actionType: MfaAuthLog['actionType'];
    };
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    // Generate 6-digit cryptographic OTP on backend
    const otpCode = String(crypto.randomInt(100000, 999999));
    const challengeId = `MFA-CH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    otpChallenges.set(challengeId, {
      challengeId,
      userId: user.id,
      userName: user.name,
      role: user.role,
      actionType: actionType || 'OTORISASI_PENCAIRAN',
      otpHash: hashValue(`${challengeId}:${otpCode}`),
      expiresAtMs,
      attemptsUsed: 0,
      maxAttempts: 3,
      verifiedSessionToken: null,
    });

    db.mfaLogs.unshift({
      id: `mfa-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.role,
      actionType: actionType || 'OTORISASI_PENCAIRAN',
      status: 'OTP_DIKIRIM',
      timestamp: formatWibNow(),
      expiresAt: new Date(expiresAtMs).toLocaleTimeString('id-ID'),
      attemptsUsed: 0,
      deviceInfo: 'SmartBuild Backend MFA Authenticator [DEMO]',
    });
    saveDatabase(db);

    // Note: Never log OTP in server stdout. Return simulated SMS/Email inbox delivery preview for DEMO usability.
    res.json({
      challengeId,
      expiresInSeconds: 300,
      maxAttempts: 3,
      deliveryChannel: `${user.email} / ${user.phone}`,
      demoInboxOtpPreview: otpCode, // Clearly labeled DEMO delivery inbox so tester can complete MFA verification
    });
  });

  app.post('/api/mfa/verify', (req, res) => {
    const { challengeId, otpInput } = req.body as { challengeId: string; otpInput: string };
    const challenge = otpChallenges.get(challengeId);
    if (!challenge) {
      res.status(400).json({ error: 'Sesi tantangan MFA tidak ditemukan atau sudah tidak berlaku.' });
      return;
    }

    if (Date.now() > challenge.expiresAtMs) {
      db.mfaLogs.unshift({
        id: `mfa-${Date.now()}`,
        userId: challenge.userId,
        userName: challenge.userName,
        role: challenge.role,
        actionType: challenge.actionType,
        status: 'KEDALUWARSA',
        timestamp: formatWibNow(),
        expiresAt: 'Kedaluwarsa',
        attemptsUsed: challenge.attemptsUsed,
        deviceInfo: 'SmartBuild Backend MFA Gate',
      });
      saveDatabase(db);
      res.status(400).json({ error: 'Kode OTP telah kedaluwarsa. Silakan kirim ulang OTP baru.' });
      return;
    }

    if (challenge.attemptsUsed >= challenge.maxAttempts) {
      res.status(429).json({
        error: `Batas maksimum percobaan OTP (${challenge.maxAttempts}x) terlampaui. Silakan minta kode OTP baru.`,
      });
      return;
    }

    challenge.attemptsUsed += 1;
    const candidateHash = hashValue(`${challengeId}:${String(otpInput || '').trim()}`);

    if (candidateHash !== challenge.otpHash) {
      const remaining = challenge.maxAttempts - challenge.attemptsUsed;
      db.mfaLogs.unshift({
        id: `mfa-${Date.now()}`,
        userId: challenge.userId,
        userName: challenge.userName,
        role: challenge.role,
        actionType: challenge.actionType,
        status: 'GAGAL_PERCOBAAN',
        timestamp: formatWibNow(),
        expiresAt: 'Aktif',
        attemptsUsed: challenge.attemptsUsed,
        deviceInfo: 'SmartBuild Backend MFA Gate',
      });
      saveDatabase(db);
      res.status(401).json({
        error: `Kode OTP tidak sesuai. Sisa kesempatan percobaan: ${remaining} kali.`,
        remainingAttempts: remaining,
      });
      return;
    }

    const token = `MFA-VERIFIED-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    challenge.verifiedSessionToken = token;
    verifiedMfaTokens.set(token, {
      userId: challenge.userId,
      role: challenge.role,
      actionType: challenge.actionType,
      verifiedAt: formatWibNow(),
      used: false,
    });

    db.mfaLogs.unshift({
      id: `mfa-${Date.now()}`,
      userId: challenge.userId,
      userName: challenge.userName,
      role: challenge.role,
      actionType: challenge.actionType,
      status: 'TERVERIFIKASI',
      timestamp: formatWibNow(),
      expiresAt: 'Terverifikasi',
      attemptsUsed: challenge.attemptsUsed,
      deviceInfo: 'SmartBuild Backend MFA Gate',
    });

    appendAuditLog({
      userId: challenge.userId,
      userName: challenge.userName,
      role: challenge.role,
      activity: `Verifikasi Otorisasi MFA OTP Berhasil (${challenge.actionType})`,
      projectId: 'ALL',
      contractId: 'ALL',
      statusBefore: 'MFA_CHALLENGE_PENDING',
      statusAfter: `MFA_VERIFIED (${token})`,
    });

    saveDatabase(db);
    res.json({
      verified: true,
      mfaToken: token,
      verifiedAt: formatWibNow(),
    });
  });

  // --- API: Create / Edit Project (Bagian 4 PRD) ---
  app.post('/api/projects', (req, res) => {
    const {
      actorRole,
      actorId,
      name,
      location,
      description,
      projectValue,
      startDate,
      targetEndDate,
      ownerId,
      contractorId,
      supervisorId,
    } = req.body;

    if (!canRolePerformAction(actorRole, 'CREATE_PROJECT')) {
      res.status(403).json({
        error: 'Akses ditolak: Hanya Pemilik Proyek atau Super Admin yang dapat membuat proyek baru.',
      });
      return;
    }

    if (!name || !location || !projectValue || Number(projectValue) <= 0) {
      res.status(400).json({ error: 'Nama proyek, lokasi, dan nilai proyek wajib diisi dengan benar.' });
      return;
    }

    const owner = db.users.find((u) => u.id === ownerId) || db.users.find((u) => u.role === 'PROJECT_OWNER')!;
    const contractor =
      db.users.find((u) => u.id === contractorId) || db.users.find((u) => u.role === 'CONTRACTOR')!;
    const supervisor =
      db.users.find((u) => u.id === supervisorId) || db.users.find((u) => u.role === 'PROJECT_SUPERVISOR')!;
    const verifier = db.users.find((u) => u.role === 'ADMIN_VERIFIER')!;

    const newId = `prj-${Date.now()}`;
    const numValue = Number(projectValue);
    const newProject = {
      id: newId,
      code: `SB-PRJ-2026-00${db.projects.length + 1} [DEMO]`,
      name: String(name).trim(),
      location: String(location).trim(),
      description: String(description || 'Proyek Konstruksi SmartBuild (Simulasi DEMO)').trim(),
      buildingImageUrl: 'SVG_AULA_BUILDING',
      projectValue: numValue,
      startDate: startDate || '2026-12-01',
      targetEndDate: targetEndDate || '2027-06-01',
      ownerId: owner.id,
      ownerName: owner.name,
      contractorId: contractor.id,
      contractorName: contractor.name,
      supervisorId: supervisor.id,
      supervisorName: supervisor.name,
      verifierId: verifier.id,
      verifierName: verifier.name,
      status: 'Menunggu Persetujuan' as const,
      overallProgress: 0,
      isArchived: false,
      isDemo: true,
    };

    db.projects.unshift(newProject);

    // Create default 8 construction stages summing to 100% weight
    const defaultStages = [
      { order: 1, name: '1. Persiapan', layer: 'site' as const, weight: 10 },
      { order: 2, name: '2. Pondasi', layer: 'foundation' as const, weight: 15 },
      { order: 3, name: '3. Struktur', layer: 'structure' as const, weight: 30 },
      { order: 4, name: '4. Dinding', layer: 'walls' as const, weight: 15 },
      { order: 5, name: '5. Atap', layer: 'roof' as const, weight: 10 },
      { order: 6, name: '6. Instalasi', layer: 'mep' as const, weight: 10 },
      { order: 7, name: '7. Finishing', layer: 'finishing' as const, weight: 5 },
      { order: 8, name: '8. Pemeriksaan Akhir', layer: 'final' as const, weight: 5 },
    ];
    const createdStageIds: string[] = [];
    for (const s of defaultStages) {
      const stgId = `stg-${newId}-${s.order}`;
      createdStageIds.push(stgId);
      db.projectStages.push({
        id: stgId,
        projectId: newId,
        order: s.order,
        name: s.name,
        bimLayerId: s.layer,
        targetProgress: 0,
        realizedProgress: 0,
        weight: s.weight,
        startDate: newProject.startDate,
        targetEndDate: newProject.targetEndDate,
        picName: contractor.name,
        verificationStatus: 'Menunggu Bukti',
      });
    }

    // Create linked Digital Contract draft
    const contractId = `cnt-${Date.now()}`;
    db.contracts.unshift({
      id: contractId,
      contractNumber: `KTR/SB/2026/XI/00${db.contracts.length + 1}-DEMO`,
      projectId: newId,
      version: 1,
      ownerId: owner.id,
      ownerName: owner.name,
      contractorId: contractor.id,
      contractorName: contractor.name,
      supervisorId: supervisor.id,
      supervisorName: supervisor.name,
      contractValue: numValue,
      scopeOfWork: newProject.description,
      workStagesSummary:
        'Tahap 1: Pondasi selesai (25%) · Tahap 2: Struktur bangunan (30%) · Tahap 3: Dinding dan atap (25%) · Tahap 4: Penyelesaian (20%)',
      startDate: newProject.startDate,
      targetEndDate: newProject.targetEndDate,
      paymentTerms: 'Pembayaran 4 tahap melalui Smart Contract Escrow (25%, 30%, 25%, 20%).',
      verificationRequirements: 'Foto dokumentasi, dokumen PDF uji mutu, persetujuan Pengawas & Verifikator.',
      objectionTerms: 'Pengajuan keberatan pada H180–H185.',
      disputeTerms: 'Pembuktian ketidaksesuaian H190 dan perbaikan H195.',
      disbursementTerms: 'Wajib lulus mesin kepatuhan otomatis dan otorisasi MFA.',
      ownerApproved: false,
      contractorApproved: false,
      isLocked: false,
      status: 'Menunggu Persetujuan',
      approvals: [],
      addendums: [],
    });

    // Create 4 milestones (25%, 30%, 25%, 20% = 100%)
    const milestoneDefs = [
      { order: 1, name: 'Tahap 1: Pondasi selesai (25%)', pct: 25, stages: [createdStageIds[0], createdStageIds[1]] },
      { order: 2, name: 'Tahap 2: Struktur bangunan (30%)', pct: 30, stages: [createdStageIds[2]] },
      { order: 3, name: 'Tahap 3: Dinding dan atap (25%)', pct: 25, stages: [createdStageIds[3], createdStageIds[4]] },
      { order: 4, name: 'Tahap 4: Penyelesaian (20%)', pct: 20, stages: [createdStageIds[5], createdStageIds[6], createdStageIds[7]] },
    ];
    for (const m of milestoneDefs) {
      db.paymentMilestones.push({
        id: `ms-${newId}-${m.order}`,
        projectId: newId,
        contractId,
        order: m.order,
        name: m.name,
        linkedStageIds: m.stages,
        percentage: m.pct,
        amount: Math.round((numValue * m.pct) / 100),
        workProgress: 0,
        status: 'Dana ditahan',
        approvalStatus: 'Belum Disetujui',
        authorizationStatus: 'Belum Diotorisasi',
        transactionStatus: 'Belum Diproses',
        supervisorApproved: false,
        adminVerified: false,
        ownerApproved: false,
        mfaVerifiedSessionId: null,
        smartContractState: 'H0_ESCROW_FUNDED',
        smartContractCurrentH: 0,
      });
    }

    db.escrowRecords.push({
      id: `esc-${Date.now()}`,
      projectId: newId,
      contractId,
      totalContractValue: numValue,
      depositedAmount: numValue,
      disbursedAmount: 0,
      heldAmount: numValue,
      disputedHoldAmount: 0,
      status: 'DANA_TERKUNCI_SMART_CONTRACT',
      providerName: 'SmartBuild Escrow Vault Engine [DEMO SIMULATION]',
      smartContractAddress: `0xDEMO71C94F2A8E3B9D1029384756ABCDEF${Math.floor(100000 + Math.random() * 899999)}`,
      isDemo: true,
    });

    db.contractRules.push({
      ...db.contractRules[0],
      id: `rule-${Date.now()}`,
      contractId,
    });

    db.contractPolicies.push({
      ...db.contractPolicies[0],
      id: `pol-${Date.now()}`,
      contractId,
    });

    db.bimModels.unshift({
      id: `bim-${newId}-v1`,
      projectId: newId,
      versionNumber: 'v1.0 (Baseline BIM 3D)',
      fileName: `${newProject.name.replace(/\s+/g, '_')}_v1.0.glb`,
      format: 'GLB',
      uploadedAt: formatWibNow(),
      uploadedBy: contractor.name,
      fileSizeMb: 15.0,
      notes: 'Model BIM 3D awal proyek.',
      elementsCount: 14,
    });

    const actor = db.users.find((u) => u.id === actorId) || owner;
    appendAuditLog({
      userId: actor.id,
      userName: actor.name,
      role: actorRole,
      activity: `Membuat Proyek Baru "${newProject.name}" & Draft Kontrak Digital ${contractId}`,
      projectId: newId,
      contractId,
      statusBefore: 'NONE',
      statusAfter: 'Menunggu Persetujuan',
    });

    saveDatabase(db);
    res.json({ ok: true, project: newProject });
  });

  // --- API: Dual-Party Contract Approval & Addendum (Bagian 5 PRD) ---
  app.post('/api/contracts/:contractId/approve', (req, res) => {
    const { contractId } = req.params;
    const { actorRole, actorId, mfaToken, notes } = req.body as {
      actorRole: RoleId;
      actorId: string;
      mfaToken: string;
      notes?: string;
    };

    if (!canRolePerformAction(actorRole, 'APPROVE_CONTRACT')) {
      res.status(403).json({
        error: 'Hanya Pemilik Proyek atau Kontraktor terkait yang berwenang menyetujui kontrak.',
      });
      return;
    }

    const contract = db.contracts.find((c) => c.id === contractId);
    if (!contract) {
      res.status(404).json({ error: 'Kontrak tidak ditemukan.' });
      return;
    }

    if (!mfaToken || !verifiedMfaTokens.has(mfaToken)) {
      res.status(401).json({
        error: 'Persetujuan kontrak wajib menggunakan otorisasi MFA OTP yang telah diverifikasi di backend.',
      });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === actorRole)!;
    const statusBefore = contract.status;

    if (actorRole === 'PROJECT_OWNER') {
      contract.ownerApproved = true;
    } else if (actorRole === 'CONTRACTOR') {
      contract.contractorApproved = true;
    }

    contract.approvals.push({
      id: `app-${Date.now()}`,
      contractId: contract.id,
      contractVersion: contract.version,
      userId: user.id,
      userName: user.name,
      role: actorRole,
      approvedAt: formatWibNow(),
      authMethod: 'MFA_OTP_VERIFIED',
      proofHash: `0xDEMO${hashValue(`${contract.id}:${user.id}:${mfaToken}`).slice(0, 36)}`,
      notes: notes || 'Menyetujui seluruh klausul dan aturan penguncian dana Smart Contract.',
    });

    if (contract.ownerApproved && contract.contractorApproved) {
      contract.isLocked = true;
      contract.status = 'Kontrak Aktif (Terkunci)';
      const project = db.projects.find((p) => p.id === contract.projectId);
      if (project && project.status === 'Menunggu Persetujuan') {
        project.status = 'Dalam Pengerjaan';
      }
    }

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Menyetujui Kontrak Digital ${contract.contractNumber} (v${contract.version}) dengan MFA`,
      projectId: contract.projectId,
      contractId: contract.id,
      statusBefore,
      statusAfter: contract.status,
    });

    saveDatabase(db);
    res.json({ ok: true, contract });
  });

  app.post('/api/contracts/:contractId/addendum', (req, res) => {
    const { contractId } = req.params;
    const { actorRole, actorId, title, changesSummary, mfaToken } = req.body;
    const contract = db.contracts.find((c) => c.id === contractId);
    if (!contract) {
      res.status(404).json({ error: 'Kontrak tidak ditemukan.' });
      return;
    }
    if (actorRole !== 'PROJECT_OWNER' && actorRole !== 'CONTRACTOR') {
      res.status(403).json({ error: 'Hanya Pemilik Proyek atau Kontraktor yang dapat mengajukan addendum.' });
      return;
    }
    if (!mfaToken || !verifiedMfaTokens.has(mfaToken)) {
      res.status(401).json({ error: 'Pengajuan Addendum kontrak wajib melalui verifikasi MFA OTP.' });
      return;
    }
    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === actorRole)!;
    const nextVersion = contract.version + 1;
    contract.version = nextVersion;
    contract.addendums.unshift({
      id: `add-${Date.now()}`,
      contractId: contract.id,
      versionNumber: nextVersion,
      title: String(title || `Addendum v${nextVersion}`).trim(),
      proposedBy: user.name,
      proposedByRole: actorRole,
      proposedAt: formatWibNow(),
      changesSummary: String(changesSummary || '').trim(),
      ownerApproved: true,
      contractorApproved: true,
      status: 'Disetujui & Aktif',
    });

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Mengesahkan Addendum Kontrak ${contract.contractNumber} menjadi Versi ${nextVersion}`,
      projectId: contract.projectId,
      contractId: contract.id,
      statusBefore: `v${nextVersion - 1}`,
      statusAfter: `v${nextVersion} (Addendum Disetujui)`,
    });

    saveDatabase(db);
    res.json({ ok: true, contract });
  });

  // --- API: Update Contract Policy & Rules (Bagian 6 PRD) ---
  app.post('/api/contracts/:contractId/rules', (req, res) => {
    const { contractId } = req.params;
    const {
      actorRole,
      actorId,
      minProgressForRelease,
      requirePhotoEvidence,
      requireVideoEvidence,
      requireDocumentEvidence,
      requireAdminVerification,
      requireSupervisorApproval,
      supervisorHasFinalTechnicalAuthority,
      requireOwnerApproval,
      requireMfaForRelease,
      blockReleaseOnActiveDispute,
      timelineConfig,
    } = req.body;

    if (actorRole !== 'PROJECT_OWNER' && actorRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error:
          'Pengawas dan Kontraktor dilarang mengubah kebijakan/aturan kontrak secara sepihak.',
      });
      return;
    }

    const rules = db.contractRules.find((r) => r.contractId === contractId);
    if (!rules) {
      res.status(404).json({ error: 'Aturan kontrak tidak ditemukan.' });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users[0];
    const prevVersion = rules.version;
    rules.version += 1;
    if (typeof minProgressForRelease === 'number') rules.minProgressForRelease = minProgressForRelease;
    if (typeof requirePhotoEvidence === 'boolean') rules.requirePhotoEvidence = requirePhotoEvidence;
    if (typeof requireVideoEvidence === 'boolean') rules.requireVideoEvidence = requireVideoEvidence;
    if (typeof requireDocumentEvidence === 'boolean') rules.requireDocumentEvidence = requireDocumentEvidence;
    if (typeof requireAdminVerification === 'boolean') rules.requireAdminVerification = requireAdminVerification;
    if (typeof requireSupervisorApproval === 'boolean') rules.requireSupervisorApproval = requireSupervisorApproval;
    if (typeof supervisorHasFinalTechnicalAuthority === 'boolean') {
      rules.supervisorHasFinalTechnicalAuthority = supervisorHasFinalTechnicalAuthority;
    }
    if (typeof requireOwnerApproval === 'boolean') rules.requireOwnerApproval = requireOwnerApproval;
    if (typeof requireMfaForRelease === 'boolean') rules.requireMfaForRelease = requireMfaForRelease;
    if (typeof blockReleaseOnActiveDispute === 'boolean') {
      rules.blockReleaseOnActiveDispute = blockReleaseOnActiveDispute;
    }
    if (timelineConfig) {
      rules.timelineConfig = {
        ...rules.timelineConfig,
        ...timelineConfig,
      };
    }
    rules.updatedAt = formatWibNow();
    rules.updatedBy = user.name;

    const policy = db.contractPolicies.find((p) => p.contractId === contractId);
    if (policy) {
      policy.version = rules.version;
      policy.changeLog.unshift({
        version: rules.version,
        changedAt: rules.updatedAt,
        changedBy: user.name,
        summary: `Pembaruan konfigurasi Rule Engine & Parameter H0–H200 (v${rules.version})`,
        approvedByBothParties: true,
      });
    }

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Memperbarui Kebijakan & Rule Engine Kontrak ${contractId} (v${prevVersion} -> v${rules.version})`,
      projectId: 'ALL',
      contractId,
      statusBefore: `Policy v${prevVersion}`,
      statusAfter: `Policy v${rules.version}`,
    });

    saveDatabase(db);
    res.json({ ok: true, rules });
  });

  // --- API: Update Stage Progress (Bagian 12 PRD) ---
  app.post('/api/stages/:stageId/progress', (req, res) => {
    const { stageId } = req.params;
    const { actorRole, actorId, realizedProgress } = req.body as {
      actorRole: RoleId;
      actorId: string;
      realizedProgress: number;
    };

    if (actorRole !== 'CONTRACTOR' && actorRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Kontraktor pelaksana yang dapat memperbarui pengiriman progres fisik.' });
      return;
    }

    const stage = db.projectStages.find((s) => s.id === stageId);
    if (!stage) {
      res.status(404).json({ error: 'Tahapan pekerjaan tidak ditemukan.' });
      return;
    }

    const prev = stage.realizedProgress;
    stage.realizedProgress = Math.max(0, Math.min(100, Number(realizedProgress)));
    if (stage.realizedProgress >= 100 && stage.verificationStatus === 'Menunggu Bukti') {
      stage.verificationStatus = 'Menunggu Verifikasi';
    }

    // Update linked payment milestone workProgress
    const milestones = db.paymentMilestones.filter(
      (m) => m.projectId === stage.projectId && m.linkedStageIds.includes(stage.id)
    );
    for (const ms of milestones) {
      const linkedStages = db.projectStages.filter((s) => ms.linkedStageIds.includes(s.id));
      const avgProgress =
        linkedStages.reduce((acc, s) => acc + s.realizedProgress, 0) /
        Math.max(1, linkedStages.length);
      ms.workProgress = Math.round(avgProgress);
    }

    // Recompute weighted project progress
    const allStages = db.projectStages.filter((s) => s.projectId === stage.projectId);
    const calc = calculateWeightedProjectProgress(allStages);
    const project = db.projects.find((p) => p.id === stage.projectId);
    if (project) {
      project.overallProgress = calc.overallProgress;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === 'CONTRACTOR')!;
    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Memperbarui Realisasi Progres "${stage.name}" (${prev}% -> ${stage.realizedProgress}%)`,
      projectId: stage.projectId,
      contractId: milestones[0]?.contractId || 'cnt-1',
      statusBefore: `${prev}%`,
      statusAfter: `${stage.realizedProgress}% (Progres Proyek: ${calc.overallProgress}%)`,
    });

    saveDatabase(db);
    res.json({ ok: true, stage, overallProgress: calc.overallProgress });
  });

  // --- API: Upload Digital Evidence (Bagian 9 PRD) ---
  app.post('/api/evidences', (req, res) => {
    const {
      actorRole,
      actorId,
      projectId,
      contractId,
      milestoneId,
      stageName,
      description,
      locationCoords,
      fileName,
      fileType,
      fileSizeKb,
    } = req.body;

    if (actorRole !== 'CONTRACTOR' && actorRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: 'Hanya Kontraktor yang dapat mengunggah bukti pelaksanaan pekerjaan.',
      });
      return;
    }

    const allowedTypes = ['JPG', 'JPEG', 'PNG', 'MP4', 'PDF'];
    const normalizedType = String(fileType || 'JPG').toUpperCase();
    if (!allowedTypes.includes(normalizedType)) {
      res.status(400).json({ error: 'Format file tidak didukung. Gunakan JPG, JPEG, PNG, MP4, atau PDF.' });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === 'CONTRACTOR')!;
    const newEvidence = {
      id: `ev-${Date.now()}`,
      projectId,
      contractId,
      milestoneId,
      stageName: stageName || 'Tahapan Konstruksi',
      uploaderId: user.id,
      uploaderName: user.name,
      uploadedAt: formatWibNow(),
      description: `${String(description).trim()} [DEMO]`,
      locationCoords: locationCoords || '-6.2884, 106.8012',
      fileName: fileName || `bukti_pekerjaan_${Date.now()}.${normalizedType.toLowerCase()}`,
      fileType: normalizedType as 'JPG' | 'JPEG' | 'PNG' | 'MP4' | 'PDF',
      fileSizeKb: Number(fileSizeKb) || 1450,
      previewUrl:
        normalizedType === 'PDF'
          ? 'SVG_EVIDENCE_PDF'
          : normalizedType === 'MP4'
          ? 'SVG_EVIDENCE_VIDEO'
          : 'SVG_EVIDENCE_STRUCTURE',
      inspectionStatus: 'Menunggu pemeriksaan' as InspectionStatus,
      adminVerificationStatus: 'Menunggu Verifikasi' as AdminVerificationStatus,
    };

    db.evidences.unshift(newEvidence);

    const milestone = db.paymentMilestones.find((m) => m.id === milestoneId);
    if (milestone && milestone.status !== 'Berhasil dicairkan') {
      milestone.status = 'Menunggu verifikasi';
      milestone.smartContractState = 'H180_DIGITAL_EVIDENCE_ASSESSMENT';
      milestone.smartContractCurrentH = 180;
    }

    appendNotification({
      targetRoles: ['PROJECT_SUPERVISOR', 'ADMIN_VERIFIER', 'PROJECT_OWNER'],
      projectId,
      title: 'Bukti Pekerjaan Baru Diunggah Kontraktor',
      message: `${user.name} mengunggah bukti "${newEvidence.fileName}" pada ${newEvidence.stageName}. Menunggu pemeriksaan Pengawas & Verifikator.`,
      category: 'BUKTI_PEKERJAAN',
    });

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Mengunggah Bukti Pekerjaan "${newEvidence.fileName}" (${newEvidence.fileType})`,
      projectId,
      contractId,
      statusBefore: 'Menunggu bukti',
      statusAfter: 'Menunggu pemeriksaan (H180)',
    });

    saveDatabase(db);
    res.json({ ok: true, evidence: newEvidence });
  });

  // --- API: Third-Party Supervisor Inspection (Bagian 10 PRD) ---
  app.post('/api/inspections', (req, res) => {
    const {
      actorRole,
      actorId,
      evidenceId,
      result,
      technicalNotes,
      recommendation,
      attachmentReportName,
    } = req.body as {
      actorRole: RoleId;
      actorId: string;
      evidenceId: string;
      result: InspectionStatus;
      technicalNotes: string;
      recommendation: string;
      attachmentReportName?: string;
    };

    if (!canRolePerformAction(actorRole, 'INSPECT_TECHNICAL_EVIDENCE')) {
      res.status(403).json({
        error:
          'Akses ditolak: Pemeriksaan teknis konstruksi hanya dapat dilakukan oleh Project Supervisor (Pengawas Pihak Ketiga).',
      });
      return;
    }

    const evidence = db.evidences.find((e) => e.id === evidenceId);
    if (!evidence) {
      res.status(404).json({ error: 'Bukti pekerjaan tidak ditemukan.' });
      return;
    }

    const supervisor =
      db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === 'PROJECT_SUPERVISOR')!;
    const prevStatus = evidence.inspectionStatus;
    evidence.inspectionStatus = result;
    evidence.supervisorNotes = technicalNotes;

    const report = {
      id: `insp-${Date.now()}`,
      projectId: evidence.projectId,
      contractId: evidence.contractId,
      milestoneId: evidence.milestoneId,
      evidenceId: evidence.id,
      stageName: evidence.stageName,
      supervisorId: supervisor.id,
      supervisorName: supervisor.name,
      inspectedAt: formatWibNow(),
      result,
      technicalNotes,
      recommendation: recommendation || 'Sesuai catatan pemeriksaan teknis pengawas.',
      attachmentReportName: attachmentReportName || `LHP-SUP-${Date.now()}-DEMO.pdf`,
    };
    db.inspections.unshift(report);

    // Update milestone supervisorApproved state based on all evidences for that milestone
    const milestone = db.paymentMilestones.find((m) => m.id === evidence.milestoneId);
    if (milestone && milestone.status !== 'Berhasil dicairkan') {
      const msEvidences = db.evidences.filter((e) => e.milestoneId === milestone.id);
      const anyRejected = msEvidences.some(
        (e) => e.inspectionStatus === 'Ditolak' || e.inspectionStatus === 'Perlu perbaikan'
      );
      const allAccepted =
        msEvidences.length > 0 &&
        msEvidences.every((e) => e.inspectionStatus === 'Diterima' || e.inspectionStatus === 'Selesai');

      if (anyRejected) {
        milestone.supervisorApproved = false;
        milestone.status = 'Ditolak';
        milestone.approvalStatus = 'Ditolak';
        milestone.smartContractState = 'H185_BRANCH_B_HELD';
        milestone.smartContractCurrentH = 185;
      } else if (allAccepted) {
        milestone.supervisorApproved = true;
        milestone.status = milestone.ownerApproved ? 'Siap diproses' : 'Menunggu persetujuan';
        milestone.approvalStatus = milestone.ownerApproved
          ? 'Disetujui Penuh (Pengawas & Pemilik)'
          : 'Disetujui Pengawas';
        milestone.smartContractState = 'H180_H185_VALIDATION';
        milestone.smartContractCurrentH = 185;
      }
    }

    appendNotification({
      targetRoles: ['PROJECT_OWNER', 'CONTRACTOR', 'ADMIN_VERIFIER'],
      projectId: evidence.projectId,
      title: `Hasil Pemeriksaan Pengawas: ${result}`,
      message: `${supervisor.name} memeriksa bukti "${evidence.fileName}" dengan hasil "${result}". Catatan: ${technicalNotes}`,
      category: 'PENGAWASAN',
    });

    appendAuditLog({
      userId: supervisor.id,
      userName: supervisor.name,
      role: actorRole,
      activity: `Pemeriksaan Teknis Bukti "${evidence.fileName}" -> ${result}`,
      projectId: evidence.projectId,
      contractId: evidence.contractId,
      statusBefore: prevStatus,
      statusAfter: result,
    });

    saveDatabase(db);
    res.json({ ok: true, evidence, report, milestone });
  });

  // --- API: Administrative Verification (Bagian 3.5 PRD) ---
  app.post('/api/verifications', (req, res) => {
    const { actorRole, actorId, evidenceId, adminVerificationStatus, notes } = req.body as {
      actorRole: RoleId;
      actorId: string;
      evidenceId: string;
      adminVerificationStatus: AdminVerificationStatus;
      notes: string;
    };

    if (!canRolePerformAction(actorRole, 'VERIFY_ADMIN_DOCUMENTS') && actorRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: 'Akses ditolak: Hanya Verifikator Administrasi yang dapat memvalidasi kelengkapan dokumen administratif.',
      });
      return;
    }

    const evidence = db.evidences.find((e) => e.id === evidenceId);
    if (!evidence) {
      res.status(404).json({ error: 'Bukti tidak ditemukan.' });
      return;
    }

    const verifier =
      db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === 'ADMIN_VERIFIER')!;
    const prev = evidence.adminVerificationStatus;
    evidence.adminVerificationStatus = adminVerificationStatus;
    evidence.adminVerifierNotes = notes;

    const milestone = db.paymentMilestones.find((m) => m.id === evidence.milestoneId);
    if (milestone) {
      const msEvidences = db.evidences.filter((e) => e.milestoneId === milestone.id);
      milestone.adminVerified =
        msEvidences.length > 0 &&
        msEvidences.every((e) => e.adminVerificationStatus === 'Dokumen Lengkap & Valid');
    }

    appendAuditLog({
      userId: verifier.id,
      userName: verifier.name,
      role: actorRole,
      activity: `Verifikasi Administrasi Dokumen "${evidence.fileName}" -> ${adminVerificationStatus}`,
      projectId: evidence.projectId,
      contractId: evidence.contractId,
      statusBefore: prev,
      statusAfter: adminVerificationStatus,
    });

    saveDatabase(db);
    res.json({ ok: true, evidence, milestone });
  });

  // --- API: Project Owner Milestone Approval + MFA Authorization (Bagian 7, 8, 16 PRD) ---
  app.post('/api/milestones/:milestoneId/approve-owner', (req, res) => {
    const { milestoneId } = req.params;
    const { actorRole, actorId, mfaToken } = req.body as {
      actorRole: RoleId;
      actorId: string;
      mfaToken?: string;
    };

    if (!canRolePerformAction(actorRole, 'APPROVE_PAYMENT_OWNER')) {
      res.status(403).json({
        error: 'Akses ditolak: Hanya Pemilik Proyek / Pengguna Jasa yang dapat memberikan persetujuan pembayaran.',
      });
      return;
    }

    const milestone = db.paymentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      res.status(404).json({ error: 'Tahap pembayaran tidak ditemukan.' });
      return;
    }

    if (!mfaToken || !verifiedMfaTokens.has(mfaToken)) {
      res.status(401).json({
        error: 'Persetujuan pembayaran dan otorisasi pencairan wajib menggunakan kode OTP MFA yang telah diverifikasi.',
      });
      return;
    }

    const owner =
      db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === 'PROJECT_OWNER')!;
    const prevApproval = milestone.approvalStatus;

    milestone.ownerApproved = true;
    milestone.mfaVerifiedSessionId = mfaToken;
    milestone.authorizationStatus = 'MFA Terverifikasi & Diotorisasi';
    milestone.approvalStatus = milestone.supervisorApproved
      ? 'Disetujui Penuh (Pengawas & Pemilik)'
      : 'Belum Disetujui';
    if (milestone.supervisorApproved && milestone.adminVerified) {
      milestone.status = 'Siap diproses';
      milestone.transactionStatus = 'Siap Diproses';
    }

    appendAuditLog({
      userId: owner.id,
      userName: owner.name,
      role: actorRole,
      activity: `Memberikan Persetujuan Pemilik Proyek & Otorisasi MFA (${mfaToken}) untuk "${milestone.name}"`,
      projectId: milestone.projectId,
      contractId: milestone.contractId,
      statusBefore: prevApproval,
      statusAfter: `${milestone.approvalStatus} | ${milestone.authorizationStatus}`,
    });

    saveDatabase(db);
    res.json({ ok: true, milestone });
  });

  // --- API: Execute Milestone Escrow Disbursement (Bagian 7.3, 13, 14, 16, 17, 25 PRD) ---
  app.post('/api/milestones/:milestoneId/disburse', (req, res) => {
    const { milestoneId } = req.params;
    const { actorRole, actorId } = req.body as {
      actorRole: RoleId;
      actorId: string;
    };

    // Kontraktor dan Pengawas TIDAK BOLEH mencairkan dana secara sepihak (Bagian 3.3 & 3.4)
    if (actorRole === 'CONTRACTOR' || actorRole === 'PROJECT_SUPERVISOR') {
      res.status(403).json({
        error: `Akses ditolak: ${actorRole} dilarang mencairkan dana Escrow secara sepihak.`,
      });
      return;
    }

    const milestone = db.paymentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      res.status(404).json({ error: 'Tahap pembayaran tidak ditemukan.' });
      return;
    }

    const rules =
      db.contractRules.find((r) => r.contractId === milestone.contractId) || db.contractRules[0];
    const escrow = db.escrowRecords.find((e) => e.contractId === milestone.contractId);

    // Run full Automated Compliance Engine check before allowing disbursement
    const compliance = evaluateMilestoneCompliance({
      milestone,
      rules,
      evidences: db.evidences,
      disputes: db.disputes,
      escrowFundedAmount: escrow ? escrow.heldAmount + escrow.disbursedAmount : 0,
      alreadyDisbursedIds: disbursedIdempotencyKeys,
    });

    if (!compliance.compliant) {
      res.status(422).json({
        error: `Pencairan dana terkunci oleh Smart Contract Compliance Engine: ${compliance.blockingReasons.join(' | ')}`,
        compliance,
      });
      return;
    }

    // Transition Smart Contract State Machine to H188 or H200
    const scTransition = transitionSmartContractState({
      currentState: milestone.smartContractState,
      event:
        milestone.smartContractState === 'H195_REPAIR_AND_REVALIDATION'
          ? 'EXECUTE_FINAL_DISBURSEMENT_H200'
          : 'BOTH_PARTIES_APPROVE_H188',
      requirementsMet: true,
      timeline: rules.timelineConfig,
    });

    if (!scTransition.canDisburse) {
      res.status(422).json({
        error: scTransition.description,
      });
      return;
    }

    // Lock Idempotency Key
    const idempotencyKey = `IDEMP-${milestone.id}-${Date.now()}`;
    disbursedIdempotencyKeys.add(milestone.id);

    const prevStatus = milestone.status;
    milestone.status = 'Berhasil dicairkan';
    milestone.transactionStatus = 'Berhasil Dicairkan';
    milestone.smartContractState = scTransition.nextState;
    milestone.smartContractCurrentH = scTransition.currentH;
    milestone.disbursedAt = formatWibNow();
    const trxRef = `TRX-SB-DEMO-${Date.now().toString().slice(-8)}`;
    milestone.transactionRef = trxRef;
    milestone.idempotencyKey = idempotencyKey;

    if (escrow) {
      escrow.heldAmount = Math.max(0, escrow.heldAmount - milestone.amount);
      escrow.disbursedAmount += milestone.amount;
      escrow.status = escrow.heldAmount === 0 ? 'SELESAI_PENUH' : 'SEBAGIAN_DICAIRKAN';
    }

    const project = db.projects.find((p) => p.id === milestone.projectId);
    const contract = db.contracts.find((c) => c.id === milestone.contractId);

    const newTransaction = {
      id: `trx-${Date.now()}`,
      transactionNumber: trxRef,
      contractNumber: contract?.contractNumber || 'KTR/SB/DEMO',
      projectId: milestone.projectId,
      projectName: project?.name || 'Proyek SmartBuild',
      milestoneId: milestone.id,
      milestoneName: milestone.name,
      amount: milestone.amount,
      date: milestone.disbursedAt,
      recipientName: `${contract?.contractorName || 'Kontraktor'} [DEMO]`,
      type: 'PENCAIRAN_MILESTONE' as const,
      approvalStatus: milestone.approvalStatus,
      authorizationStatus: `${milestone.authorizationStatus} (${milestone.mfaVerifiedSessionId})`,
      transactionStatus: 'Berhasil' as const,
      referenceNumber: `REL-H${scTransition.currentH}-${Date.now().toString().slice(-6)}-DEMO`,
      idempotencyKey,
      isDemo: true,
      blockchainRecord: {
        network: 'SmartBuild Polygon Amoy Testnet [DEMO SIMULATION]',
        chainId: 80002,
        walletAddress: '0xDEMO44F5E6D7C8B9A0123456789ABCDEF0123456',
        smartContractAddress:
          escrow?.smartContractAddress || '0xDEMO71C94F2A8E3B9D1029384756ABCDEF110001',
        transactionHash: `0xDEMO_SIMULATED_TX_${hashValue(idempotencyKey).slice(0, 48)}`,
        blockTimestamp: new Date().toISOString(),
        isSimulatedDemo: true,
      },
    };
    db.paymentTransactions.unshift(newTransaction);

    const actor = db.users.find((u) => u.id === actorId) || db.users[0];
    appendNotification({
      targetRoles: ['PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'SUPER_ADMIN'],
      projectId: milestone.projectId,
      title: `Pencairan Dana Escrow Berhasil (${milestone.name})`,
      message: `Dana sebesar Rp ${milestone.amount.toLocaleString('id-ID')} telah dicairkan melalui Smart Contract pada H${scTransition.currentH} (Ref: ${trxRef} [DEMO]).`,
      category: 'PEMBAYARAN',
    });

    appendAuditLog({
      userId: actor.id,
      userName: actor.name,
      role: actorRole,
      activity: `Eksekusi Pencairan Escrow "${milestone.name}" Rp ${milestone.amount.toLocaleString('id-ID')} (${trxRef})`,
      projectId: milestone.projectId,
      contractId: milestone.contractId,
      statusBefore: prevStatus,
      statusAfter: `Berhasil dicairkan (H${scTransition.currentH})`,
    });

    saveDatabase(db);
    res.json({
      ok: true,
      milestone,
      transaction: newTransaction,
      escrow,
      smartContractTransition: scTransition,
    });
  });

  // --- API: Smart Contract State Machine Simulation Step (Bagian 14 PRD) ---
  app.post('/api/smart-contract/transition', (req, res) => {
    const { milestoneId, event, actorId, actorRole } = req.body as {
      milestoneId: string;
      event: SmartContractTransitionInput['event'];
      actorId: string;
      actorRole: RoleId;
    };

    const milestone = db.paymentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone tidak ditemukan.' });
      return;
    }

    const rules =
      db.contractRules.find((r) => r.contractId === milestone.contractId) || db.contractRules[0];
    const escrow = db.escrowRecords.find((e) => e.contractId === milestone.contractId);
    const compliance = evaluateMilestoneCompliance({
      milestone,
      rules,
      evidences: db.evidences,
      disputes: db.disputes,
      escrowFundedAmount: escrow ? escrow.heldAmount + escrow.disbursedAmount : 0,
      alreadyDisbursedIds: disbursedIdempotencyKeys,
    });

    const prevState = milestone.smartContractState;
    const result = transitionSmartContractState({
      currentState: milestone.smartContractState,
      event,
      requirementsMet:
        milestone.workProgress >= rules.minProgressForRelease &&
        milestone.supervisorApproved &&
        milestone.adminVerified,
      timeline: rules.timelineConfig,
    });

    milestone.smartContractState = result.nextState;
    milestone.smartContractCurrentH = result.currentH;
    if (result.nextState === 'H185_BRANCH_B_HELD') {
      milestone.status = 'Dana ditahan';
    } else if (result.nextState === 'H185_DISPUTE_PROOF_CHECK' || result.nextState === 'H190_NON_COMPLIANCE_PROVEN') {
      milestone.status = 'Ditahan karena sengketa';
    }

    const actor = db.users.find((u) => u.id === actorId) || db.users[0];
    appendAuditLog({
      userId: actor.id,
      userName: actor.name,
      role: actorRole || 'SUPER_ADMIN',
      activity: `Transisi State Machine Smart Contract (${event}): ${prevState} -> ${result.nextState} (H${result.currentH})`,
      projectId: milestone.projectId,
      contractId: milestone.contractId,
      statusBefore: prevState,
      statusAfter: `${result.nextState} (H${result.currentH})`,
    });

    saveDatabase(db);
    res.json({ ok: true, milestone, transition: result, compliance });
  });

  // --- API: Dispute & Objection Management (Bagian 15 PRD) ---
  app.post('/api/disputes', (req, res) => {
    const {
      actorRole,
      actorId,
      projectId,
      contractId,
      milestoneId,
      reason,
      evidenceAttachmentName,
    } = req.body;

    if (!canRolePerformAction(actorRole, 'RAISE_DISPUTE')) {
      res.status(403).json({
        error: 'Hanya Pemilik Proyek atau Kontraktor yang dapat mengajukan keberatan/sengketa kontrak.',
      });
      return;
    }

    if (!reason || String(reason).trim().length < 5) {
      res.status(400).json({ error: 'Alasan keberatan/sengketa wajib diisi secara jelas.' });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === actorRole)!;
    const newDispute = {
      id: `dsp-${Date.now()}`,
      projectId,
      contractId,
      milestoneId,
      raisedById: user.id,
      raisedByName: user.name,
      raisedByRole: actorRole as RoleId,
      raisedAt: formatWibNow(),
      reason: String(reason).trim(),
      evidenceAttachmentName: evidenceAttachmentName || 'bukti_keberatan_kontrak_DEMO.pdf',
      status: 'Dalam pemeriksaan' as const,
      blocksPayment: true,
      responses: [],
    };
    db.disputes.unshift(newDispute);

    const milestone = db.paymentMilestones.find((m) => m.id === milestoneId);
    if (milestone && milestone.status !== 'Berhasil dicairkan') {
      milestone.status = 'Ditahan karena sengketa';
      milestone.transactionStatus = 'Ditahan / Gagal';
      milestone.smartContractState = 'H185_DISPUTE_PROOF_CHECK';
      milestone.smartContractCurrentH = 185;
    }

    const escrow = db.escrowRecords.find((e) => e.contractId === contractId);
    if (escrow && milestone) {
      escrow.disputedHoldAmount = milestone.amount;
      escrow.status = 'DITAHAN_SENGKETA';
    }

    appendNotification({
      targetRoles: ['PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'SUPER_ADMIN'],
      projectId,
      title: 'Keberatan / Sengketa Baru Diajukan (Pencairan Ditahan)',
      message: `${user.name} mengajukan keberatan pada tahap pembayaran: "${newDispute.reason}". Dana otomatis ditahan oleh Smart Contract.`,
      category: 'SENGKETA',
    });

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Mengajukan Sengketa/Keberatan "${newDispute.reason}" (Pencairan Ditahan)`,
      projectId,
      contractId,
      statusBefore: 'Tidak ada sengketa',
      statusAfter: 'Dalam pemeriksaan (Dana Ditahan H185)',
    });

    saveDatabase(db);
    res.json({ ok: true, dispute: newDispute, milestone });
  });

  app.post('/api/disputes/:disputeId/resolve', (req, res) => {
    const { disputeId } = req.params;
    const { actorRole, actorId, ruling, decisionBasis } = req.body as {
      actorRole: RoleId;
      actorId: string;
      ruling: 'Terbukti (Wajib Perbaikan H190-H195)' | 'Tidak Terbukti (Lanjut Pencairan H195)';
      decisionBasis: string;
    };

    if (!canRolePerformAction(actorRole, 'RESOLVE_DISPUTE')) {
      res.status(403).json({
        error: 'Hanya Pihak Berwenang (Project Supervisor Independen / Super Admin Arbitrase) yang dapat menetapkan keputusan sengketa.',
      });
      return;
    }

    const dispute = db.disputes.find((d) => d.id === disputeId);
    if (!dispute) {
      res.status(404).json({ error: 'Data sengketa tidak ditemukan.' });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users.find((u) => u.role === actorRole)!;
    const prevStatus = dispute.status;

    dispute.resolution = {
      decidedByName: user.name,
      decidedByRole: actorRole,
      decidedAt: formatWibNow(),
      ruling,
      decisionBasis: decisionBasis || 'Berdasarkan hasil pembuktian teknis terhadap spesifikasi kontrak awal.',
    };

    const milestone = db.paymentMilestones.find((m) => m.id === dispute.milestoneId);
    const escrow = db.escrowRecords.find((e) => e.contractId === dispute.contractId);

    if (ruling === 'Tidak Terbukti (Lanjut Pencairan H195)') {
      dispute.status = 'Tidak terbukti';
      dispute.blocksPayment = false;
      if (milestone && milestone.status !== 'Berhasil dicairkan') {
        milestone.status = milestone.ownerApproved ? 'Siap diproses' : 'Menunggu persetujuan';
        milestone.smartContractState = 'H195_DISPUTE_UNPROVEN_DISBURSEMENT';
        milestone.smartContractCurrentH = 195;
      }
      if (escrow) {
        escrow.disputedHoldAmount = 0;
        escrow.status = 'SEBAGIAN_DICAIRKAN';
      }
    } else {
      // Terbukti -> Selesai setelah perbaikan H195 divalidasi
      dispute.status = 'Selesai';
      dispute.blocksPayment = false;
      if (milestone && milestone.status !== 'Berhasil dicairkan') {
        milestone.status = milestone.ownerApproved ? 'Siap diproses' : 'Menunggu persetujuan';
        milestone.smartContractState = 'H195_REPAIR_AND_REVALIDATION';
        milestone.smartContractCurrentH = 195;
      }
      if (escrow) {
        escrow.disputedHoldAmount = 0;
        escrow.status = 'SEBAGIAN_DICAIRKAN';
      }
    }

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole,
      activity: `Menetapkan Keputusan Sengketa ${dispute.id}: ${ruling}`,
      projectId: dispute.projectId,
      contractId: dispute.contractId,
      statusBefore: prevStatus,
      statusAfter: `${dispute.status} (${ruling})`,
    });

    saveDatabase(db);
    res.json({ ok: true, dispute, milestone });
  });

  // --- API: Upload New BIM Model Version (Bagian 11 & 25.G PRD) ---
  app.post('/api/bim/upload', (req, res) => {
    const { actorRole, actorId, projectId, versionNumber, fileName, fileSizeMb, notes } = req.body;
    const ext = String(fileName || '').split('.').pop()?.toUpperCase();
    if (!['GLB', 'GLTF', 'IFC'].includes(ext || '')) {
      res.status(400).json({
        error: 'File model 3D tidak valid. Format yang didukung: .glb, .gltf, atau .ifc (konversi).',
      });
      return;
    }

    const user = db.users.find((u) => u.id === actorId) || db.users[0];
    const newVersion = {
      id: `bim-${Date.now()}`,
      projectId: projectId || 'prj-1',
      versionNumber: versionNumber || `v2.${db.bimModels.length} (Update Model BIM)`,
      fileName: String(fileName),
      format: (ext === 'IFC' ? 'IFC_CONVERTED' : ext === 'GLTF' ? 'glTF' : 'GLB') as
        | 'GLB'
        | 'glTF'
        | 'IFC_CONVERTED',
      uploadedAt: formatWibNow(),
      uploadedBy: user.name,
      fileSizeMb: Number(fileSizeMb) || 17.5,
      notes: notes || 'Pembaruan model BIM 3D terintegrasi tahapan pekerjaan.',
      elementsCount: 14,
    };

    db.bimModels.unshift(newVersion);

    appendAuditLog({
      userId: user.id,
      userName: user.name,
      role: actorRole || user.role,
      activity: `Mengunggah Versi Model BIM 3D Baru "${newVersion.fileName}" (${newVersion.versionNumber})`,
      projectId: newVersion.projectId,
      contractId: 'cnt-1',
      statusBefore: 'Model Sebelumnya',
      statusAfter: newVersion.versionNumber,
    });

    saveDatabase(db);
    res.json({ ok: true, bimModel: newVersion });
  });

  // --- API: Mark Notifications Read ---
  app.post('/api/notifications/read-all', (_req, res) => {
    for (const n of db.notifications) {
      n.isRead = true;
    }
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- Mount Vite Dev Server or Production Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartBuild 3.0 Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
