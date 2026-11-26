/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Sliders,
  BarChart3,
  Box,
  FileImage,
  ClipboardCheck,
  FileCheck,
  Milestone,
  Vault,
  CreditCard,
  Scale,
  ArrowLeftRight,
  FileSpreadsheet,
  Bell,
  Users,
  ShieldCheck,
  History,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { SmartBuildDatabase, MfaAuthLog } from './data/seedDatabase';
import {
  RoleId,
  ROLE_LABELS,
  ComplianceCheckResult,
} from './logic/smartbuildEngine';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { ProjectsAndContractsView } from './components/ProjectsAndContractsView';
import { Bim3DViewer } from './components/Bim3DViewer';
import { EvidenceAndInspectionView } from './components/EvidenceAndInspectionView';
import { EscrowAndPaymentView } from './components/EscrowAndPaymentView';
import { GovernanceAndReportsView } from './components/GovernanceAndReportsView';
import { MfaVerifyModal } from './components/MfaVerifyModal';

interface NavMenuItem {
  id: string;
  order: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
}

// Bagian 24 PRD: Exact 20 Sidebar Navigation Menus in Order
const SIDEBAR_MENUS: NavMenuItem[] = [
  {
    id: 'dashboard',
    order: 1,
    label: '1. Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'projects',
    order: 2,
    label: '2. Proyek Saya',
    icon: Building2,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'contracts',
    order: 3,
    label: '3. Kontrak Digital',
    icon: FileText,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'policies',
    order: 4,
    label: '4. Kebijakan Kontrak',
    icon: Sliders,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR'],
  },
  {
    id: 'progress',
    order: 5,
    label: '5. Progress Proyek',
    icon: BarChart3,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR'],
  },
  {
    id: 'bim',
    order: 6,
    label: '6. BIM Viewer',
    icon: Box,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR'],
  },
  {
    id: 'evidence',
    order: 7,
    label: '7. Digital Evidence',
    icon: FileImage,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'supervisor',
    order: 8,
    label: '8. Pengawasan Proyek',
    icon: ClipboardCheck,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_SUPERVISOR', 'PROJECT_OWNER', 'CONTRACTOR'],
  },
  {
    id: 'verification',
    order: 9,
    label: '9. Verifikasi Pekerjaan',
    icon: FileCheck,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_VERIFIER', 'PROJECT_OWNER'],
  },
  {
    id: 'milestones',
    order: 10,
    label: '10. Milestone Payment',
    icon: Milestone,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR'],
  },
  {
    id: 'escrow',
    order: 11,
    label: '11. Escrow Management',
    icon: Vault,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR'],
  },
  {
    id: 'payments',
    order: 12,
    label: '12. Pembayaran',
    icon: CreditCard,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'disputes',
    order: 13,
    label: '13. Sengketa',
    icon: Scale,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR'],
  },
  {
    id: 'transactions',
    order: 14,
    label: '14. Riwayat Transaksi',
    icon: ArrowLeftRight,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR'],
  },
  {
    id: 'reports',
    order: 15,
    label: '15. Laporan',
    icon: FileSpreadsheet,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'notifications',
    order: 16,
    label: '16. Notifikasi',
    icon: Bell,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'users',
    order: 17,
    label: '17. Pengguna',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'security',
    order: 18,
    label: '18. Keamanan & MFA',
    icon: ShieldCheck,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'CONTRACTOR', 'PROJECT_SUPERVISOR', 'ADMIN_VERIFIER'],
  },
  {
    id: 'audit',
    order: 19,
    label: '19. Audit Log',
    icon: History,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER', 'ADMIN_VERIFIER'],
  },
  {
    id: 'settings',
    order: 20,
    label: '20. Pengaturan',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN', 'PROJECT_OWNER'],
  },
];

type FullAppState = SmartBuildDatabase & {
  complianceByMilestone: Record<string, ComplianceCheckResult>;
};

export default function App() {
  const [appState, setAppState] = useState<FullAppState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [activeRole, setActiveRole] = useState<RoleId>('PROJECT_OWNER');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('prj-1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // MFA Modal State
  const [mfaModal, setMfaModal] = useState<{
    isOpen: boolean;
    actionType: MfaAuthLog['actionType'];
    actionTitle: string;
    onSuccess: (token: string) => void;
  }>({
    isOpen: false,
    actionType: 'OTORISASI_PENCAIRAN',
    actionTitle: '',
    onSuccess: () => {},
  });

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setAppState(data);
    } catch {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  if (loading || !appState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full text-center space-y-2">
          <div className="text-base font-bold text-slate-900">Memuat SmartBuild 3.0...</div>
          <p className="text-xs text-slate-500">
            Menyiapkan database proyek, kontrak digital, BIM 3D, dan mesin kepatuhan Smart Contract.
          </p>
        </div>
      </div>
    );
  }

  const activeUser =
    appState.users.find((u) => u.role === activeRole) || appState.users[0];
  const visibleMenus = SIDEBAR_MENUS.filter((m) => m.allowedRoles.includes(activeRole));
  const unreadNotifsCount = appState.notifications.filter((n) => !n.isRead).length;
  const activeMenuObj =
    SIDEBAR_MENUS.find((m) => m.id === activeMenu) || SIDEBAR_MENUS[0];

  const handleRequestMfa = (params: {
    actionType: MfaAuthLog['actionType'];
    actionTitle: string;
    onSuccess: (token: string) => void;
  }) => {
    setMfaModal({
      isOpen: true,
      actionType: params.actionType,
      actionTitle: params.actionTitle,
      onSuccess: params.onSuccess,
    });
  };

  const handleRoleChange = (newRole: RoleId) => {
    setActiveRole(newRole);
    const allowedForRole = SIDEBAR_MENUS.filter((m) => m.allowedRoles.includes(newRole));
    if (!allowedForRole.some((m) => m.id === activeMenu)) {
      setActiveMenu('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Left Sidebar Navigation (Navy Blue #0B1E3D — Bagian 2.1 & 24 PRD) */}
      <aside
        aria-label="Sidebar Navigasi Utama SmartBuild"
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0B1E3D] text-slate-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-base font-bold tracking-tight text-white">
              SMARTBUILD 3.0
            </div>
            <div className="text-[11px] font-mono text-sky-400">
              BIM & SMART CONTRACT [DEMO]
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup menu navigasi"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Indicator inside Sidebar */}
        <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 text-xs">
          <div className="text-[10px] font-mono text-slate-400">ROLE AKTIF ({visibleMenus.length} MENU)</div>
          <div className="font-semibold text-white truncate">{ROLE_LABELS[activeRole]}</div>
          <div className="text-[11px] text-slate-400 truncate">{activeUser.name}</div>
        </div>

        {/* Scrollable 20-Item Menu List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {visibleMenus.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <IconComponent className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadNotifsCount > 0 && (
                  <span className="font-mono text-[11px] font-bold text-amber-300">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
          <div>Mode: DEMO SIMULATION</div>
          <div>Total Kontrak: Rp 790.000.000</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar (Follows SaaS Top Bar Contract: Breadcrumb on Left, Role Switcher & Primary Action on Right) */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-500 truncate">
              <span className="font-semibold text-slate-900">SmartBuild 3.0</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-sky-800">{activeMenuObj.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="global-role-switcher"
                className="hidden sm:inline text-xs font-semibold text-slate-600 whitespace-nowrap"
              >
                Peran Aktif (RBAC):
              </label>
              <select
                id="global-role-switcher"
                aria-label="Pilih Peran Pengguna Aktif (RBAC)"
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as RoleId)}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md"
              >
                <option value="SUPER_ADMIN">Super Admin (20 Menu)</option>
                <option value="PROJECT_OWNER">Pemilik Proyek / Pengguna Jasa</option>
                <option value="CONTRACTOR">Penyedia Jasa / Kontraktor</option>
                <option value="PROJECT_SUPERVISOR">Project Supervisor (Pengawas 3P)</option>
                <option value="ADMIN_VERIFIER">Verifikator Administrasi</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setActiveMenu('bim')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B1E3D] hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              BIM 3D Viewer
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {activeMenu === 'dashboard' && (
            <ExecutiveDashboardView
              db={appState}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onNavigate={setActiveMenu}
            />
          )}

          {(activeMenu === 'projects' ||
            activeMenu === 'contracts' ||
            activeMenu === 'policies' ||
            activeMenu === 'progress') && (
            <ProjectsAndContractsView
              mode={activeMenu}
              db={appState}
              activeRole={activeRole}
              activeUserId={activeUser.id}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onNavigate={setActiveMenu}
              onRefresh={fetchState}
              onRequestMfa={handleRequestMfa}
            />
          )}

          {activeMenu === 'bim' && (
            <Bim3DViewer
              projects={appState.projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              bimModels={appState.bimModels}
              bimElementsByProject={appState.bimElements}
              activeRole={activeRole}
              activeUserId={activeUser.id}
              onModelUploaded={fetchState}
            />
          )}

          {(activeMenu === 'evidence' ||
            activeMenu === 'supervisor' ||
            activeMenu === 'verification') && (
            <EvidenceAndInspectionView
              mode={activeMenu}
              db={appState}
              activeRole={activeRole}
              activeUserId={activeUser.id}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onNavigate={setActiveMenu}
              onRefresh={fetchState}
            />
          )}

          {(activeMenu === 'milestones' ||
            activeMenu === 'escrow' ||
            activeMenu === 'payments' ||
            activeMenu === 'disputes' ||
            activeMenu === 'transactions') && (
            <EscrowAndPaymentView
              mode={activeMenu}
              db={appState}
              activeRole={activeRole}
              activeUserId={activeUser.id}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onRefresh={fetchState}
              onRequestMfa={handleRequestMfa}
            />
          )}

          {(activeMenu === 'reports' ||
            activeMenu === 'notifications' ||
            activeMenu === 'users' ||
            activeMenu === 'security' ||
            activeMenu === 'audit' ||
            activeMenu === 'settings') && (
            <GovernanceAndReportsView
              mode={activeMenu}
              db={appState}
              activeRole={activeRole}
              activeUserId={activeUser.id}
              onSwitchRole={handleRoleChange}
              onRefresh={fetchState}
              onRequestMfa={handleRequestMfa}
            />
          )}
        </main>
      </div>

      {/* Global Backend MFA Verification Modal */}
      <MfaVerifyModal
        isOpen={mfaModal.isOpen}
        onClose={() => setMfaModal((prev) => ({ ...prev, isOpen: false }))}
        userId={activeUser.id}
        userName={activeUser.name}
        actionType={mfaModal.actionType}
        actionTitle={mfaModal.actionTitle}
        onVerified={(token) => {
          setMfaModal((prev) => ({ ...prev, isOpen: false }));
          mfaModal.onSuccess(token);
        }}
      />
    </div>
  );
}
