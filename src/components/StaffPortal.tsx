import React, { useState, useEffect, useCallback } from 'react';
import { BusinessConfig } from '../config/businessConfig';
import {
  LeadRecord,
  LeadAuditEntry,
  LeadStatus,
  StaffRole,
  LeadSource,
  PreferredChannel,
  UrgencyLevel,
  ALLOWED_STATE_TRANSITIONS,
  STATES_REQUIRING_REASON,
  OperationalAlert,
  DashboardMetrics,
  formatNairobiTime,
  canRoleTransitionState,
} from '../domain/leadLifecycle';
import { DailyReconciliationEntry } from '../server/db';
import {
  AlertTriangle,
  Download,
  Plus,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Phone,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface StaffPortalProps {
  config: BusinessConfig;
  staffSession: {
    authenticated: boolean;
    token?: string;
    staffName?: string;
    role?: StaffRole;
  };
  onLoginSuccess: (session: {
    authenticated: boolean;
    token: string;
    staffName: string;
    role: StaffRole;
  }) => void;
  onLogout: () => void;
  onConfigUpdated: (newConfig: BusinessConfig) => void;
  onOpenHandoverDocs: () => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({
  config,
  staffSession,
  onLoginSuccess,
  onLogout,
  onConfigUpdated,
  onOpenHandoverDocs,
}) => {
  // Login Form State
  const [loginRole, setLoginRole] = useState<StaffRole>(StaffRole.SECRETARY);
  const [staffNameInput, setStaffNameInput] = useState('Grace (Workshop Secretary)');
  const [accessCodeInput, setAccessCodeInput] = useState('langata-sec-2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard Sub-navigation
  const [activeSubTab, setActiveSubTab] = useState<
    'ledger' | 'analytics' | 'reconciliation' | 'config'
  >('ledger');

  // Dashboard Data State
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [totalUnfilteredCount, setTotalUnfilteredCount] = useState(0);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [reconciliations, setReconciliations] = useState<DailyReconciliationEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [assignedFilter, setAssignedFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Lead Detail & Lifecycle Drawer
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [selectedLeadAudit, setSelectedLeadAudit] = useState<LeadAuditEntry[]>([]);
  const [targetState, setTargetState] = useState<LeadStatus>(LeadStatus.ACKNOWLEDGED);
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [assignedStaffName, setAssignedStaffName] = useState('');
  const [nextFollowUpLocal, setNextFollowUpLocal] = useState('');
  const [bookingDateTimeLocal, setBookingDateTimeLocal] = useState('');
  const [bookingBayNotes, setBookingBayNotes] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);
  const [updatingLead, setUpdatingLead] = useState(false);

  // Manual Off-Website Call / WhatsApp Lead Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualSource, setManualSource] = useState<LeadSource>(LeadSource.PHONE_CALL_LOGGED);
  const [manualVehicle, setManualVehicle] = useState('');
  const [manualServiceSlug, setManualServiceSlug] = useState('diagnostics');
  const [manualSymptoms, setManualSymptoms] = useState('');
  const [manualLocation, setManualLocation] = useState("Lang'ata Road");
  const [manualUrgency, setManualUrgency] = useState<UrgencyLevel>(UrgencyLevel.STANDARD);
  const [manualError, setManualError] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  // Daily Reconciliation Form
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recCallsCount, setRecCallsCount] = useState(6);
  const [recWhatsappCount, setRecWhatsappCount] = useState(9);
  const [recAddedCount, setRecAddedCount] = useState(1);
  const [recNotes, setRecNotes] = useState(
    'Cross-checked workshop handset call log and WhatsApp Business chat list against Lead Ledger.'
  );
  const [recSuccess, setRecSuccess] = useState<string | null>(null);

  // Business Config Editor State (Owner Only)
  const [cfgBrandShort, setCfgBrandShort] = useState(config.brandShortName);
  const [cfgLegalName, setCfgLegalName] = useState(config.legalBusinessName);
  const [cfgIsPlaceholder, setCfgIsPlaceholder] = useState(config.isPlaceholderName);
  const [cfgAddress, setCfgAddress] = useState(config.workshopAddress);
  const [cfgMechanicPhone, setCfgMechanicPhone] = useState(config.mechanicPhone);
  const [cfgSecretaryPhone, setCfgSecretaryPhone] = useState(config.secretaryPhone);
  const [cfgWhatsapp, setCfgWhatsapp] = useState(config.whatsappNumber);
  const [cfgHours, setCfgHours] = useState(config.operatingHours);
  const [cfgPricesApproved, setCfgPricesApproved] = useState(config.indicativePricesApproved);
  const [cfgAckMins, setCfgAckMins] = useState(config.internalTargets.acknowledgeTargetMinutes);
  const [cfgStaleHours, setCfgStaleHours] = useState(config.internalTargets.staleLeadHours);
  const [cfgSavedMessage, setCfgSavedMessage] = useState<string | null>(null);

  // Redaction state
  const [redactReason, setRedactReason] = useState('');

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (staffSession.token) {
      headers['Authorization'] = `Bearer ${staffSession.token}`;
    }
    return headers;
  }, [staffSession.token]);

  const fetchDashboardData = useCallback(async () => {
    if (!staffSession.authenticated) return;
    setLoadingData(true);
    setDashboardError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (assignedFilter !== 'ALL') params.set('assigned', assignedFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const response = await fetch(`/api/staff/dashboard?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          onLogout();
          return;
        }
        const err = await response.json();
        setDashboardError(err.error || 'Failed to load dashboard data.');
        setLoadingData(false);
        return;
      }

      const data = await response.json();
      setLeads(data.leads || []);
      setTotalUnfilteredCount(data.totalUnfilteredCount || 0);
      setAlerts(data.alerts || []);
      setMetrics(data.metrics || null);
      setReconciliations(data.reconciliations || []);
      setLoadingData(false);
    } catch {
      setDashboardError('Network error while loading Staff Ledger.');
      setLoadingData(false);
    }
  }, [
    staffSession.authenticated,
    statusFilter,
    sourceFilter,
    assignedFilter,
    dateFilter,
    searchQuery,
    authHeaders,
    onLogout,
  ]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const openLeadDrawer = async (lead: LeadRecord) => {
    setSelectedLead(lead);
    setTransitionError(null);
    setTransitionSuccess(null);
    setTransitionReason(lead.lossOrCancelReason || '');
    setTransitionNote('');
    setAssignedStaffName(lead.assignedStaffName || '');
    setBookingDateTimeLocal(
      lead.bookingDateTimeLocal ? lead.bookingDateTimeLocal.slice(0, 16) : ''
    );
    setNextFollowUpLocal(
      lead.nextFollowUpAtUtc ? lead.nextFollowUpAtUtc.slice(0, 16) : ''
    );
    setBookingBayNotes(lead.bookingBayNotes || '');
    setOutcomeSummary(lead.outcomeSummary || '');

    const allowedNext = ALLOWED_STATE_TRANSITIONS[lead.status] || [];
    const roleFiltered = allowedNext.filter(
      (st) =>
        canRoleTransitionState(staffSession.role || StaffRole.SECRETARY, lead.status, st).allowed
    );
    setTargetState(roleFiltered[0] || lead.status);

    try {
      const res = await fetch(`/api/staff/leads/${lead.leadId}/audit`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLeadAudit(data.auditEntries || []);
      }
    } catch {
      // Ignore audit fetch error
    }
    setTimeout(() => {
      document.getElementById('lead-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const handleRolePresetSelect = (role: StaffRole) => {
    setLoginRole(role);
    setLoginError(null);
    if (role === StaffRole.OWNER) {
      setStaffNameInput('Workshop Owner');
      setAccessCodeInput('langata-owner-2026');
    } else if (role === StaffRole.SECRETARY) {
      setStaffNameInput('Grace (Workshop Secretary)');
      setAccessCodeInput('langata-sec-2026');
    } else {
      setStaffNameInput('Juma (Lead Mechanic)');
      setAccessCodeInput('langata-mech-2026');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole,
          staffName: staffNameInput,
          accessCode: accessCodeInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed.');
        setLoggingIn(false);
        return;
      }
      onLoginSuccess({
        authenticated: true,
        token: data.token,
        staffName: data.staffName,
        role: data.role,
      });
      setLoggingIn(false);
    } catch {
      setLoginError('Network error during login.');
      setLoggingIn(false);
    }
  };

  const handleUpdateLeadLifecycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setTransitionError(null);
    setTransitionSuccess(null);
    setUpdatingLead(true);

    try {
      const res = await fetch(`/api/staff/leads/${selectedLead.leadId}/transition`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          targetState,
          reason: transitionReason,
          note: transitionNote,
          assignedStaffName,
          assignedStaffRole: assignedStaffName ? StaffRole.MECHANIC : '',
          nextFollowUpAtUtc: nextFollowUpLocal ? new Date(nextFollowUpLocal).toISOString() : null,
          bookingDateTimeLocal: bookingDateTimeLocal
            ? new Date(bookingDateTimeLocal).toISOString()
            : null,
          bookingBayNotes,
          outcomeSummary,
          markContactedNow: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransitionError(data.error || 'Failed to update lead status.');
        setUpdatingLead(false);
        return;
      }
      setSelectedLead(data.lead);
      setSelectedLeadAudit(data.auditEntries || []);
      setTransitionSuccess(`Lead updated to ${data.lead.status} and recorded in audit trail.`);
      setUpdatingLead(false);
      fetchDashboardData();
    } catch {
      setTransitionError('Network error while updating lead.');
      setUpdatingLead(false);
    }
  };

  const handleConfirmManualNotification = async (leadId: string) => {
    try {
      const res = await fetch(`/api/staff/leads/${leadId}/notify-retry`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirmManualDispatch: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedLead && selectedLead.leadId === leadId) {
          setSelectedLead(data.lead);
        }
        fetchDashboardData();
      }
    } catch {
      // ignore
    }
  };

  const handleRedactLead = async (leadId: string) => {
    if (!redactReason.trim()) {
      setTransitionError('Enter a documented reason before redacting personal data.');
      return;
    }
    try {
      const res = await fetch(`/api/staff/leads/${leadId}/redact`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: redactReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransitionError(data.error || 'Failed to redact lead.');
        return;
      }
      setSelectedLead(data.lead);
      setTransitionSuccess('Personal identifiers redacted per data protection procedure.');
      setRedactReason('');
      fetchDashboardData();
    } catch {
      setTransitionError('Network error while redacting lead.');
    }
  };

  const handleManualLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setSavingManual(true);
    try {
      const res = await fetch('/api/staff/leads/manual', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          customerName: manualName,
          phone: manualPhone,
          source: manualSource,
          preferredChannel:
            manualSource === LeadSource.WHATSAPP_LOGGED
              ? PreferredChannel.WHATSAPP
              : PreferredChannel.PHONE_CALL,
          vehicleMakeModel: manualVehicle,
          requestedServiceSlug: manualServiceSlug,
          symptomsDescription: manualSymptoms,
          locationArea: manualLocation,
          urgency: manualUrgency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || 'Please check the required fields.');
        setSavingManual(false);
        return;
      }
      setSavingManual(false);
      setShowManualModal(false);
      setManualName('');
      setManualPhone('');
      setManualVehicle('');
      setManualSymptoms('');
      fetchDashboardData();
    } catch {
      setManualError('Network error while logging off-website lead.');
      setSavingManual(false);
    }
  };

  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecSuccess(null);
    try {
      const res = await fetch('/api/staff/reconciliation', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          reconciliationDate: recDate,
          phoneCallsReviewedCount: recCallsCount,
          whatsappChatsReviewedCount: recWhatsappCount,
          unloggedEnquiriesAddedCount: recAddedCount,
          discrepancyNotes: recNotes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReconciliations(data.reconciliations || []);
        setRecSuccess(`Daily reconciliation logged for ${recDate}.`);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveBusinessConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgSavedMessage(null);
    try {
      const res = await fetch('/api/staff/config', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          brandShortName: cfgBrandShort,
          legalBusinessName: cfgLegalName,
          isPlaceholderName: cfgIsPlaceholder,
          workshopAddress: cfgAddress,
          mechanicPhone: cfgMechanicPhone,
          secretaryPhone: cfgSecretaryPhone,
          whatsappNumber: cfgWhatsapp,
          operatingHours: cfgHours,
          indicativePricesApproved: cfgPricesApproved,
          internalTargets: {
            ...config.internalTargets,
            acknowledgeTargetMinutes: cfgAckMins,
            staleLeadHours: cfgStaleHours,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onConfigUpdated(data.config);
        setCfgSavedMessage('Workshop configuration saved persistently and updated across website.');
      }
    } catch {
      // ignore
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await fetch('/api/staff/export.csv', {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `langata-lead-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  // -------------------------------------------------------------------------
  // RENDER LOGIN VIEW IF NOT AUTHENTICATED
  // -------------------------------------------------------------------------
  if (!staffSession.authenticated) {
    return (
      <main className="max-w-lg mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-mono font-semibold text-slate-500">
              ROLE-BASED ACCESS CONTROL
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Workshop Staff Lead Ledger Sign-In
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Select your operational role to access the Lang&apos;ata Lead Ledger, SLA alerts, or Mechanic job assignments.
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Quick Role Selection (Pre-fills evaluation credentials):
            </span>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
              {[StaffRole.SECRETARY, StaffRole.MECHANIC, StaffRole.OWNER].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRolePresetSelect(r)}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                    loginRole === r
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {loginError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 font-medium"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="staff-name-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Staff Member Name (Recorded in Audit Log)
              </label>
              <input
                id="staff-name-input"
                type="text"
                required
                value={staffNameInput}
                onChange={(e) => setStaffNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="staff-access-code"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Role Access Code
              </label>
              <input
                id="staff-access-code"
                type="password"
                required
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Default eval codes: Secretary (langata-sec-2026) · Mechanic (langata-mech-2026) · Owner (langata-owner-2026)
              </p>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 px-4 text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
            >
              {loggingIn ? 'Signing In...' : `Sign In as ${loginRole}`}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // AUTHENTICATED STAFF OPERATIONS DASHBOARD
  // -------------------------------------------------------------------------
  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Signed in as <strong className="text-slate-900">{staffSession.staffName}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-slate-900">Role: {staffSession.role}</span>
            <span aria-hidden="true">·</span>
            <span>Internal Ack Target: <strong className="font-mono tabular-nums">{config.internalTargets.acknowledgeTargetMinutes}m</strong></span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Lang&apos;ata Workshop Lead Ledger &amp; Anti-Leakage Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {(staffSession.role === StaffRole.OWNER ||
            staffSession.role === StaffRole.SECRETARY) && (
            <>
              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Log Call / WhatsApp Lead</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onOpenHandoverDocs}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Secretary SOP
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Operational Leakage & SLA Alerts Banner */}
      {alerts.length > 0 && (
        <section
          aria-label="Active Operational Alerts"
          className="bg-white border border-red-200 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-700">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>ACTIVE ANTI-LEAKAGE &amp; SLA ALERTS ({alerts.length})</span>
            </div>
            <span className="text-xs text-slate-500">
              Click any alert to open and resolve the lead record
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((alert) => {
              const matchedLead = leads.find((l) => l.leadId === alert.leadId);
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => {
                    if (matchedLead) openLeadDrawer(matchedLead);
                  }}
                  className={`text-left p-3.5 rounded-lg border transition-colors ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-red-50/70 border-red-200 hover:bg-red-100/70 text-red-950'
                      : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold">
                    <span>{alert.severity} · {alert.leadId}</span>
                    <span>{alert.customerName}</span>
                  </div>
                  <p className="text-xs font-bold mt-1">{alert.title}</p>
                  <p className="text-[11px] opacity-90 mt-0.5 line-clamp-2">{alert.detail}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Summary Grid */}
      {metrics && (
        <section aria-label="Operational Key Performance Indicators" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Total Leads</span>
            <strong className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {metrics.totalLeads}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">New (Unack)</span>
            <strong className={`text-xl font-bold font-mono tabular-nums ${metrics.newAwaitingAck > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {metrics.newAwaitingAck}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Qualified Unassigned</span>
            <strong className={`text-xl font-bold font-mono tabular-nums ${metrics.qualifiedAwaitingAssignment > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {metrics.qualifiedAwaitingAssignment}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Overdue Follow-Up</span>
            <strong className={`text-xl font-bold font-mono tabular-nums ${metrics.overdueFollowUps > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {metrics.overdueFollowUps}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Booked / In Bay</span>
            <strong className="text-xl font-bold font-mono text-sky-700 tabular-nums">
              {metrics.activeBookingsAndInProgress}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Completed Jobs</span>
            <strong className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {metrics.completedJobs}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Lost / Cancelled</span>
            <strong className="text-xl font-bold font-mono text-slate-700 tabular-nums">
              {metrics.lostOrCancelledJobs}
            </strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] text-slate-500 block">Median 1st Contact</span>
            <strong className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {metrics.medianTimeToFirstContactMinutes !== null
                ? `${metrics.medianTimeToFirstContactMinutes}m`
                : '—'}
            </strong>
          </div>
        </section>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab('ledger')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeSubTab === 'ledger'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Lead Ledger Queue ({leads.length}/{totalUnfilteredCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeSubTab === 'analytics'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Conversion by Source &amp; Service
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reconciliation')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeSubTab === 'reconciliation'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daily Call/WhatsApp Reconciliation ({reconciliations.length})
        </button>

        {staffSession.role === StaffRole.OWNER && (
          <button
            type="button"
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'config'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Editable Business Config (Owner)
          </button>
        )}
      </div>

      {dashboardError && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
          {dashboardError}
        </div>
      )}

      {/* TAB 1: LEAD LEDGER QUEUE & DETAIL WORKSPACE */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="filter-search" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Search Lead ID, Name, Phone or Vehicle
              </label>
              <input
                id="filter-search"
                type="search"
                placeholder="e.g. LGT- or Hilux or 0722..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter by Lifecycle Status
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Statuses</option>
                {Object.values(LeadStatus).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-source" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter by Acquisition Source
              </label>
              <select
                id="filter-source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Sources</option>
                {Object.values(LeadSource).map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-assigned" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter by Assigned Staff
              </label>
              <select
                id="filter-assigned"
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Staff / Any</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                <option value="Lead Mechanic">Lead Mechanic</option>
                <option value="Workshop Secretary">Workshop Secretary</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-date" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter by Created Date (UTC)
              </label>
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* High-Density Lead Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingData ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading persistent Lead Ledger records...
              </div>
            ) : leads.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-800">
                  No leads match the active filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSourceFilter('ALL');
                    setAssignedFilter('ALL');
                    setDateFilter('');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Lead ID &amp; Created (EAT)</th>
                      <th className="py-3 px-4">Customer &amp; Channel</th>
                      <th className="py-3 px-4">Vehicle &amp; Service</th>
                      <th className="py-3 px-4">Location &amp; Urgency</th>
                      <th className="py-3 px-4">Status &amp; Assignee</th>
                      <th className="py-3 px-4">Next Follow-Up</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {leads.map((lead) => {
                      const isOverdue =
                        lead.nextFollowUpAtUtc &&
                        Date.now() > new Date(lead.nextFollowUpAtUtc).getTime() &&
                        ![
                          LeadStatus.COMPLETED,
                          LeadStatus.LOST,
                          LeadStatus.CANCELLED,
                          LeadStatus.INVALID,
                        ].includes(lead.status);

                      return (
                        <tr
                          key={lead.leadId}
                          className={`hover:bg-slate-50 transition-colors ${
                            selectedLead?.leadId === lead.leadId ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4 align-top">
                            <div className="font-mono font-bold text-slate-900 tabular-nums">
                              {lead.leadId}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              {formatNairobiTime(lead.createdAtUtc)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Source: {lead.source}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top">
                            <div className="font-semibold text-slate-900">{lead.customerName}</div>
                            <div className="font-mono text-slate-700 tabular-nums mt-0.5">
                              {lead.phoneNormalized}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Prefers: {lead.preferredChannel}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top max-w-[250px]">
                            <div className="font-semibold text-slate-900">
                              {lead.vehicleMakeModel}{' '}
                              {lead.vehicleRegistration ? `(${lead.vehicleRegistration})` : ''}
                            </div>
                            <div className="text-slate-700 mt-0.5">{lead.requestedServiceTitle}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                              {lead.symptomsDescription}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top">
                            <div className="text-slate-900 font-medium">{lead.locationArea}</div>
                            <div
                              className={`font-mono font-semibold mt-0.5 ${
                                lead.urgency === UrgencyLevel.SAFETY_CRITICAL
                                  ? 'text-red-700'
                                  : lead.urgency === UrgencyLevel.IMMOBILISED ||
                                    lead.urgency === UrgencyLevel.URGENT_TODAY
                                  ? 'text-amber-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {lead.urgency}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top">
                            <div className="font-mono font-bold text-slate-900">{lead.status}</div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Assigned: {lead.assignedStaffName || 'Unassigned'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Alert: {lead.notificationStatus}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top font-mono tabular-nums">
                            {lead.nextFollowUpAtUtc ? (
                              <span className={isOverdue ? 'text-red-700 font-bold' : 'text-slate-700'}>
                                {formatNairobiTime(lead.nextFollowUpAtUtc)}
                                {isOverdue ? ' (OVERDUE)' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 align-top text-right">
                            <button
                              type="button"
                              onClick={() => openLeadDrawer(lead)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                            >
                              Inspect &amp; Update
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SELECTED LEAD LIFECYCLE & ORCHESTRATOR PANEL */}
          {selectedLead && (
            <section
              id="lead-detail-panel"
              aria-label={`Lead Detail and Lifecycle Management for ${selectedLead.leadId}`}
              className="scroll-mt-24 bg-white border-2 border-slate-900 rounded-xl p-6 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {selectedLead.leadId}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Status: <strong className="font-mono text-slate-900">{selectedLead.status}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Created: <span className="font-mono tabular-nums">{formatNairobiTime(selectedLead.createdAtUtc)}</span></span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    {selectedLead.customerName} — {selectedLead.vehicleMakeModel} ({selectedLead.requestedServiceTitle})
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`tel:${selectedLead.phoneNormalized}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 tabular-nums"
                  >
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Call {selectedLead.phoneNormalized}</span>
                  </a>

                  <a
                    href={`https://wa.me/${selectedLead.phoneNormalized.replace(
                      /[^0-9]/g,
                      ''
                    )}?text=${encodeURIComponent(
                      selectedLead.orchestratorAnalysis.customerAcknowledgementDraft
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleConfirmManualNotification(selectedLead.leadId)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send WhatsApp Acknowledgement</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                  >
                    Close Panel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left 5 Columns: Orchestrator Analysis & Notification Status */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        Intake Triage &amp; Symptom Summary
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {selectedLead.orchestratorAnalysis.generatedBy}
                      </span>
                    </div>

                    {selectedLead.orchestratorAnalysis.safetyAdvisory && (
                      <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-900 font-medium flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{selectedLead.orchestratorAnalysis.safetyAdvisory}</span>
                      </div>
                    )}

                    <div className="text-xs space-y-2 text-slate-700">
                      <p>
                        <strong>Customer Reported Symptoms:</strong> {selectedLead.symptomsDescription}
                      </p>
                      <p>
                        <strong>Triage Brief:</strong> {selectedLead.orchestratorAnalysis.symptomSummary}
                      </p>
                      <p>
                        <strong>Suggested Mechanic Bay Prep:</strong>{' '}
                        {selectedLead.orchestratorAnalysis.suggestedMechanicNote}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        Drafted Customer Acknowledgement (Truthful, No Fixed Price Promise):
                      </span>
                      <p className="p-2.5 bg-white border border-slate-200 rounded text-xs text-slate-800 font-mono">
                        {selectedLead.orchestratorAnalysis.customerAcknowledgementDraft}
                      </p>
                    </div>

                    {selectedLead.orchestratorAnalysis.reviewRequestDraft && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <span className="text-[11px] font-semibold text-emerald-800 block">
                          Post-Completion Review Request Draft (Ready to Send):
                        </span>
                        <p className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950 font-mono">
                          {selectedLead.orchestratorAnalysis.reviewRequestDraft}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notification Delivery Status */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900">Secretary Notification Delivery</strong>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedLead.notificationStatus}
                      </span>
                    </div>
                    <p className="text-slate-600">{selectedLead.notificationDetail}</p>
                    {selectedLead.notificationStatus !== 'DELIVERED' && (
                      <button
                        type="button"
                        onClick={() => handleConfirmManualNotification(selectedLead.leadId)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                      >
                        Mark Notification Acknowledged / Dispatched
                      </button>
                    )}
                  </div>

                  {/* Formal Data Protection Redaction (Owner Only) */}
                  {staffSession.role === StaffRole.OWNER && !selectedLead.isRedacted && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <strong className="text-slate-900 block">
                        Data Protection PII Redaction (Owner Only)
                      </strong>
                      <p className="text-slate-600">
                        Scrubs personal contact identifiers upon formal customer deletion request while retaining anonymised ledger statistics.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Reason for redaction..."
                          value={redactReason}
                          onChange={(e) => setRedactReason(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => handleRedactLead(selectedLead.leadId)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0"
                        >
                          Redact PII
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 7 Columns: State Transition Form & Immutable Audit History */}
                <div className="lg:col-span-7 space-y-6">
                  <form
                    onSubmit={handleUpdateLeadLifecycle}
                    className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4"
                  >
                    <h3 className="text-sm font-bold text-slate-900">
                      Update Lead Lifecycle State, Assignment &amp; Booking
                    </h3>

                    {transitionError && (
                      <div
                        role="alert"
                        className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 font-medium"
                      >
                        {transitionError}
                      </div>
                    )}

                    {transitionSuccess && (
                      <div
                        role="status"
                        className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{transitionSuccess}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="transition-target-state"
                          className="block text-xs font-semibold text-slate-800 mb-1"
                        >
                          Target Lifecycle Status (Current: {selectedLead.status})
                        </label>
                        <select
                          id="transition-target-state"
                          value={targetState}
                          onChange={(e) => setTargetState(e.target.value as LeadStatus)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        >
                          <option value={selectedLead.status}>
                            Keep Current ({selectedLead.status})
                          </option>
                          {(ALLOWED_STATE_TRANSITIONS[selectedLead.status] || []).map((st) => (
                            <option key={st} value={st}>
                              Transition → {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="assigned-staff-input"
                          className="block text-xs font-semibold text-slate-800 mb-1"
                        >
                          Assigned Staff Member / Mechanic
                        </label>
                        <input
                          id="assigned-staff-input"
                          type="text"
                          placeholder="e.g. Lead Mechanic"
                          value={assignedStaffName}
                          onChange={(e) => setAssignedStaffName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {STATES_REQUIRING_REASON.has(targetState) && (
                      <div>
                        <label
                          htmlFor="loss-cancel-reason"
                          className="block text-xs font-semibold text-red-800 mb-1"
                        >
                          Mandatory Reason for {targetState} *
                        </label>
                        <input
                          id="loss-cancel-reason"
                          type="text"
                          required
                          placeholder="e.g. Customer towed to franchise dealer / Duplicate test / Price objection"
                          value={transitionReason}
                          onChange={(e) => setTransitionReason(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-red-300 rounded-lg"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="next-followup-input"
                          className="block text-xs font-semibold text-slate-800 mb-1"
                        >
                          Next Follow-Up Deadline
                        </label>
                        <input
                          id="next-followup-input"
                          type="datetime-local"
                          value={nextFollowUpLocal}
                          onChange={(e) => setNextFollowUpLocal(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="booking-datetime-input"
                          className="block text-xs font-semibold text-slate-800 mb-1"
                        >
                          Workshop Booking Date/Time
                        </label>
                        <input
                          id="booking-datetime-input"
                          type="datetime-local"
                          value={bookingDateTimeLocal}
                          onChange={(e) => setBookingDateTimeLocal(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="booking-bay-notes"
                        className="block text-xs font-semibold text-slate-800 mb-1"
                      >
                        Booking &amp; Workshop Bay Notes
                      </label>
                      <input
                        id="booking-bay-notes"
                        type="text"
                        placeholder="e.g. Bay 1 reserved at 14:00; OBD scanner and battery load tester ready"
                        value={bookingBayNotes}
                        onChange={(e) => setBookingBayNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="outcome-summary-input"
                        className="block text-xs font-semibold text-slate-800 mb-1"
                      >
                        Recorded Job Outcome / Mechanical Findings
                      </label>
                      <input
                        id="outcome-summary-input"
                        type="text"
                        placeholder="e.g. Replaced front brake pads & bled DOT-4 fluid; test drive nominal."
                        value={outcomeSummary}
                        onChange={(e) => setOutcomeSummary(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="audit-note-input"
                        className="block text-xs font-semibold text-slate-800 mb-1"
                      >
                        Audit Trail Note
                      </label>
                      <input
                        id="audit-note-input"
                        type="text"
                        placeholder="e.g. Spoke with customer on WhatsApp; confirmed drop-off."
                        value={transitionNote}
                        onChange={(e) => setTransitionNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={updatingLead}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      {updatingLead ? 'Saving Transition...' : 'Save State Transition & Audit Record'}
                    </button>
                  </form>

                  {/* Audit Trail Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900">
                      Immutable Audit History ({selectedLeadAudit.length} events)
                    </h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Timestamp (EAT)</th>
                            <th className="py-2 px-3">Actor &amp; Role</th>
                            <th className="py-2 px-3">Transition</th>
                            <th className="py-2 px-3">Reason / Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {selectedLeadAudit.map((entry) => (
                            <tr key={entry.id}>
                              <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                                {formatNairobiTime(entry.timestampUtc)}
                              </td>
                              <td className="py-2 px-3">
                                <strong>{entry.actorName}</strong> ({entry.actorRole})
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {entry.previousState ? `${entry.previousState} → ` : ''}
                                <strong>{entry.newState}</strong>
                              </td>
                              <td className="py-2 px-3">
                                {entry.reason ? `[Reason: ${entry.reason}] ` : ''}
                                {entry.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: CONVERSION BY SOURCE & SERVICE */}
      {activeSubTab === 'analytics' && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Conversion Rate by Acquisition Source
            </h2>
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Acquisition Source</th>
                  <th className="py-2.5 px-3 text-right">Total Leads</th>
                  <th className="py-2.5 px-3 text-right">Booked / Completed</th>
                  <th className="py-2.5 px-3 text-right">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.conversionBySource.map((row) => (
                  <tr key={row.source}>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {row.source}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.total}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.bookedOrCompleted}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {row.ratePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Conversion Rate by Requested Service
            </h2>
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Service Capability</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Booked / Done</th>
                  <th className="py-2.5 px-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.conversionByService.map((row) => (
                  <tr key={row.serviceTitle}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.serviceTitle}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.total}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.bookedOrCompleted}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {row.ratePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* TAB 3: DAILY CALL & WHATSAPP RECONCILIATION ROUTINE */}
      {activeSubTab === 'reconciliation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Secretary Daily Call &amp; WhatsApp Reconciliation Sign-Off
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Because direct telephone calls and WhatsApp messages do not originate from the website form, the secretary must reconcile the workshop phone call log and WhatsApp Business chat list against the Lead Ledger every evening.
            </p>

            {recSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                {recSuccess}
              </div>
            )}

            <form onSubmit={handleReconciliationSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="rec-date" className="block font-semibold text-slate-800 mb-1">
                  Reconciliation Date
                </label>
                <input
                  id="rec-date"
                  type="date"
                  value={recDate}
                  onChange={(e) => setRecDate(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="rec-calls" className="block font-semibold text-slate-800 mb-1">
                    Calls Reviewed
                  </label>
                  <input
                    id="rec-calls"
                    type="number"
                    min={0}
                    value={recCallsCount}
                    onChange={(e) => setRecCallsCount(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="rec-wa" className="block font-semibold text-slate-800 mb-1">
                    WhatsApp Chats
                  </label>
                  <input
                    id="rec-wa"
                    type="number"
                    min={0}
                    value={recWhatsappCount}
                    onChange={(e) => setRecWhatsappCount(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="rec-added" className="block font-semibold text-slate-800 mb-1">
                    Added to Ledger
                  </label>
                  <input
                    id="rec-added"
                    type="number"
                    min={0}
                    value={recAddedCount}
                    onChange={(e) => setRecAddedCount(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rec-notes" className="block font-semibold text-slate-800 mb-1">
                  Reconciliation &amp; Discrepancy Notes
                </label>
                <textarea
                  id="rec-notes"
                  rows={3}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
              >
                Record Daily Reconciliation Sign-Off
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Reconciliation Log History
            </h2>
            {reconciliations.length === 0 ? (
              <p className="text-xs text-slate-500">
                No daily reconciliations recorded yet today. Use the form on the left to submit today&apos;s sign-off.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3 text-right">Calls</th>
                      <th className="py-2.5 px-3 text-right">WhatsApp</th>
                      <th className="py-2.5 px-3 text-right">Added</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reconciliations.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono font-semibold">{r.reconciliationDate}</td>
                        <td className="py-2 px-3">{r.loggedByStaffName}</td>
                        <td className="py-2 px-3 text-right font-mono">{r.phoneCallsReviewedCount}</td>
                        <td className="py-2 px-3 text-right font-mono">{r.whatsappChatsReviewedCount}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {r.unloggedEnquiriesAddedCount}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{r.discrepancyNotes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EDITABLE BUSINESS CONFIGURATION (OWNER ONLY) */}
      {activeSubTab === 'config' && staffSession.role === StaffRole.OWNER && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Editable Workshop Configuration (Persisted in Database)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Update business name, Lang&apos;ata plot address, Mechanic and Secretary phone numbers, operating hours, and internal SLA targets without touching code.
            </p>
          </div>

          {cfgSavedMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
              {cfgSavedMessage}
            </div>
          )}

          <form onSubmit={handleSaveBusinessConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-brand-short" className="block font-semibold text-slate-800 mb-1">
                  Display Brand Title (Top Bar)
                </label>
                <input
                  id="cfg-brand-short"
                  type="text"
                  value={cfgBrandShort}
                  onChange={(e) => setCfgBrandShort(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="cfg-legal-name" className="block font-semibold text-slate-800 mb-1">
                  Registered Workshop Name
                </label>
                <input
                  id="cfg-legal-name"
                  type="text"
                  value={cfgLegalName}
                  onChange={(e) => setCfgLegalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cfg-sec-phone" className="block font-semibold text-slate-800 mb-1">
                  Secretary Contact Number
                </label>
                <input
                  id="cfg-sec-phone"
                  type="text"
                  value={cfgSecretaryPhone}
                  onChange={(e) => setCfgSecretaryPhone(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="cfg-mech-phone" className="block font-semibold text-slate-800 mb-1">
                  Mechanic Contact Number
                </label>
                <input
                  id="cfg-mech-phone"
                  type="text"
                  value={cfgMechanicPhone}
                  onChange={(e) => setCfgMechanicPhone(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="cfg-wa-phone" className="block font-semibold text-slate-800 mb-1">
                  WhatsApp Intake Number
                </label>
                <input
                  id="cfg-wa-phone"
                  type="text"
                  value={cfgWhatsapp}
                  onChange={(e) => setCfgWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-address" className="block font-semibold text-slate-800 mb-1">
                  Workshop Address &amp; Landmark (Lang&apos;ata)
                </label>
                <input
                  id="cfg-address"
                  type="text"
                  value={cfgAddress}
                  onChange={(e) => setCfgAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="cfg-hours" className="block font-semibold text-slate-800 mb-1">
                  Operating Hours (EAT)
                </label>
                <input
                  id="cfg-hours"
                  type="text"
                  value={cfgHours}
                  onChange={(e) => setCfgHours(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-ack-mins" className="block font-semibold text-slate-800 mb-1">
                  Internal Acknowledgement Target (Minutes)
                </label>
                <input
                  id="cfg-ack-mins"
                  type="number"
                  min={1}
                  value={cfgAckMins}
                  onChange={(e) => setCfgAckMins(Number(e.target.value))}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="cfg-stale-hours" className="block font-semibold text-slate-800 mb-1">
                  Stale Open Lead Alert Threshold (Hours)
                </label>
                <input
                  id="cfg-stale-hours"
                  type="number"
                  min={1}
                  value={cfgStaleHours}
                  onChange={(e) => setCfgStaleHours(Number(e.target.value))}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!cfgIsPlaceholder}
                  onChange={(e) => setCfgIsPlaceholder(!e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Mark Business Details as Founder-Verified (Hides Placeholder Banner)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgPricesApproved}
                  onChange={(e) => setCfgPricesApproved(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Display Indicative KES Service Prices on Public Service Pages</span>
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
            >
              Save Business Configuration
            </button>
          </form>
        </section>
      )}

      {/* MODAL: LOG OFF-WEBSITE PHONE CALL / WHATSAPP LEAD */}
      {showManualModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-lead-dialog-title"
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="manual-lead-dialog-title" className="text-base font-bold text-slate-900">
                Log Inbound Call, WhatsApp, or Walk-In Enquiry
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            {manualError && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
                {manualError}
              </div>
            )}

            <form onSubmit={handleManualLeadSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-source" className="block font-semibold text-slate-800 mb-1">
                    Inbound Channel *
                  </label>
                  <select
                    id="manual-source"
                    value={manualSource}
                    onChange={(e) => setManualSource(e.target.value as LeadSource)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value={LeadSource.PHONE_CALL_LOGGED}>Direct Phone Call</option>
                    <option value={LeadSource.WHATSAPP_LOGGED}>Direct WhatsApp Message</option>
                    <option value={LeadSource.WALK_IN_LOGGED}>Workshop Walk-In</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="manual-urgency" className="block font-semibold text-slate-800 mb-1">
                    Urgency *
                  </label>
                  <select
                    id="manual-urgency"
                    value={manualUrgency}
                    onChange={(e) => setManualUrgency(e.target.value as UrgencyLevel)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value={UrgencyLevel.STANDARD}>Standard</option>
                    <option value={UrgencyLevel.URGENT_TODAY}>Urgent Today</option>
                    <option value={UrgencyLevel.IMMOBILISED}>Immobilised</option>
                    <option value={UrgencyLevel.SAFETY_CRITICAL}>Safety Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-name" className="block font-semibold text-slate-800 mb-1">
                    Customer Name *
                  </label>
                  <input
                    id="manual-name"
                    type="text"
                    required
                    placeholder="e.g. Samuel Njoroge"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="manual-phone" className="block font-semibold text-slate-800 mb-1">
                    Customer Phone *
                  </label>
                  <input
                    id="manual-phone"
                    type="tel"
                    required
                    placeholder="e.g. 0722 998 877"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-vehicle" className="block font-semibold text-slate-800 mb-1">
                    Vehicle Make &amp; Model
                  </label>
                  <input
                    id="manual-vehicle"
                    type="text"
                    placeholder="e.g. Volkswagen Tiguan"
                    value={manualVehicle}
                    onChange={(e) => setManualVehicle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="manual-service" className="block font-semibold text-slate-800 mb-1">
                    Service Category *
                  </label>
                  <select
                    id="manual-service"
                    value={manualServiceSlug}
                    onChange={(e) => setManualServiceSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {config.services.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="manual-location" className="block font-semibold text-slate-800 mb-1">
                  Location / Estate *
                </label>
                <input
                  id="manual-location"
                  type="text"
                  required
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="manual-symptoms" className="block font-semibold text-slate-800 mb-1">
                  Reported Symptoms / Request *
                </label>
                <textarea
                  id="manual-symptoms"
                  rows={2}
                  required
                  placeholder="Describe caller's vehicle issue..."
                  value={manualSymptoms}
                  onChange={(e) => setManualSymptoms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="px-4 py-2 font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 cursor-pointer"
                >
                  {savingManual ? 'Saving...' : 'Save to Lead Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
