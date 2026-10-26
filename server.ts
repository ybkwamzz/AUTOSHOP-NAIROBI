import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  LeadStatus,
  StaffRole,
  LeadSource,
  generateLeadId,
  validateEnquiryInput,
  validateStateTransition,
  computeOperationalAlerts,
  computeDashboardMetrics,
  sanitizePlainText,
  formatNairobiTime,
  LeadRecord,
} from './src/domain/leadLifecycle';
import {
  getBusinessConfig,
  saveBusinessConfig,
  findRecentDuplicateLead,
  insertLeadWithAudit,
  getLeadById,
  listAllLeads,
  listAuditEntriesForLead,
  updateLeadStateAndOperationalFields,
  recordOrRetrySecretaryNotification,
  redactLeadPersonalData,
  listDailyReconciliations,
  insertDailyReconciliation,
  ensureInitialSeedData,
} from './src/server/db';
import { runBoundedOrchestratorAnalysis } from './src/server/geminiOrchestrator';

// Seed initial workshop records if DB is empty
ensureInitialSeedData();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '64kb' }));

// Basic security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple IP rate limiter for public enquiry and login endpoints
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count++;
  return true;
}

// Staff Authentication & Signed Session Management
interface StaffSession {
  token: string;
  staffName: string;
  role: StaffRole;
  expiresAtMs: number;
}

const activeSessions = new Map<string, StaffSession>();

function getRoleAccessCode(role: StaffRole): string {
  if (role === StaffRole.OWNER) {
    return process.env.OWNER_ACCESS_CODE || 'langata-owner-2026';
  }
  if (role === StaffRole.SECRETARY) {
    return process.env.SECRETARY_ACCESS_CODE || 'langata-sec-2026';
  }
  return process.env.MECHANIC_ACCESS_CODE || 'langata-mech-2026';
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractSessionFromRequest(req: Request): StaffSession | null {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('langata_staff_session='));
    if (match) {
      token = decodeURIComponent(match.split('=')[1] || '');
    }
  }
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAtMs) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function requireStaffAuth(allowedRoles?: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = extractSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Authentication required. Please sign in to the Staff Operations Portal.' });
      return;
    }
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      res.status(403).json({
        error: `Access denied. Your role (${session.role}) is not authorised for this action.`,
      });
      return;
    }
    (req as Request & { staffSession: StaffSession }).staffSession = session;
    next();
  };
}

// ---------------------------------------------------------------------------
// SEO & Crawler Endpoints
// ---------------------------------------------------------------------------
app.get('/robots.txt', (_req: Request, res: Response) => {
  const appUrl = (process.env.APP_URL || 'https://ais-pre-twtq44m24dr3wmd7weyfa7-515141959120.europe-west2.run.app').replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${appUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const appUrl = (process.env.APP_URL || 'https://ais-pre-twtq44m24dr3wmd7weyfa7-515141959120.europe-west2.run.app').replace(/\/$/, '');
  const config = getBusinessConfig();
  const urls = [
    `<url><loc>${appUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...config.services.map(
      (s) =>
        `<url><loc>${appUrl}/?service=${encodeURIComponent(s.slug)}</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>`
    ),
  ].join('\n  ');
  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>`);
});

// ---------------------------------------------------------------------------
// Public Website Configuration & Enquiry Intake Endpoints
// ---------------------------------------------------------------------------
app.get('/api/config', (_req: Request, res: Response) => {
  const config = getBusinessConfig();
  res.json({
    config,
    systemStatus: {
      persistenceEngine: 'SQLite Persistent WAL Ledger (./data/langata_leads.sqlite)',
      postgresConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      automatedWebhookConfigured: Boolean(process.env.NOTIFICATION_WEBHOOK_URL?.trim()),
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      serverTimeUtc: new Date().toISOString(),
      serverTimeNairobi: formatNairobiTime(new Date().toISOString()),
    },
  });
});

app.post('/api/enquiries', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(`enquiry:${clientIp}`, 15, 10 * 60 * 1000)) {
      res.status(429).json({
        error: 'Too many requests from this connection. Please call or WhatsApp our secretary directly.',
      });
      return;
    }

    const config = getBusinessConfig();
    const validation = validateEnquiryInput(req.body || {}, config);
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({
        error: validation.errors.join(' '),
        errors: validation.errors,
      });
      return;
    }

    const norm = validation.normalized;

    // Duplicate-submission protection (15-minute idempotency check)
    const duplicate = findRecentDuplicateLead(norm.duplicateFingerprint, 15);
    if (duplicate) {
      res.status(200).json({
        duplicatePrevented: true,
        leadId: duplicate.leadId,
        createdAtUtc: duplicate.createdAtUtc,
        createdAtNairobi: formatNairobiTime(duplicate.createdAtUtc),
        status: duplicate.status,
        requestedServiceTitle: duplicate.requestedServiceTitle,
        preferredChannel: duplicate.preferredChannel,
        notificationStatus: duplicate.notificationStatus,
        notificationDetail: duplicate.notificationDetail,
        safetyAdvisory: duplicate.orchestratorAnalysis.safetyAdvisory,
        customerAcknowledgementDraft: duplicate.orchestratorAnalysis.customerAcknowledgementDraft,
        message:
          'We already received this identical enquiry within the last 15 minutes. Your original Lead ID and workshop queue position remain active.',
      });
      return;
    }

    const now = new Date();
    const nowUtc = now.toISOString();
    const leadId = generateLeadId(now);
    const followUpAtUtc = new Date(
      now.getTime() + config.internalTargets.defaultFollowUpMinutes * 60 * 1000
    ).toISOString();

    const orchestratorAnalysis = await runBoundedOrchestratorAnalysis({
      leadId,
      customerName: norm.customerName,
      vehicleMakeModel: norm.vehicleMakeModel,
      requestedServiceSlug: norm.requestedServiceSlug,
      requestedServiceTitle: norm.requestedServiceTitle,
      symptomsDescription: norm.symptomsDescription,
      locationArea: norm.locationArea,
      urgency: norm.urgency,
      safetyFlags: norm.safetyFlags,
      status: LeadStatus.NEW,
      config,
    });

    const newLead: LeadRecord = {
      leadId,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
      customerName: norm.customerName,
      phoneRaw: norm.phoneRaw,
      phoneNormalized: norm.phoneNormalized,
      preferredChannel: norm.preferredChannel,
      vehicleMakeModel: norm.vehicleMakeModel,
      vehicleRegistration: norm.vehicleRegistration,
      requestedServiceSlug: norm.requestedServiceSlug,
      requestedServiceTitle: norm.requestedServiceTitle,
      symptomsDescription: norm.symptomsDescription,
      locationArea: norm.locationArea,
      urgency: orchestratorAnalysis.classifiedUrgency,
      safetyFlags: norm.safetyFlags,
      source: LeadSource.WEBSITE_FORM,
      landingPage: norm.landingPage,
      utmSource: norm.utmSource,
      utmMedium: norm.utmMedium,
      utmCampaign: norm.utmCampaign,
      assignedStaffName: '',
      assignedStaffRole: '',
      status: LeadStatus.NEW,
      lastContactAtUtc: null,
      nextFollowUpAtUtc: followUpAtUtc,
      bookingDateTimeLocal: null,
      bookingBayNotes: '',
      outcomeSummary: '',
      lossOrCancelReason: '',
      duplicateFingerprint: norm.duplicateFingerprint,
      consentGranted: true,
      isRedacted: false,
      orchestratorAnalysis,
      notificationStatus: 'PENDING_MANUAL_OR_UNCONFIGURED',
      notificationDetail: 'Initialising notification workflow...',
    };

    // Persist synchronously BEFORE reporting success
    const savedLead = insertLeadWithAudit(
      newLead,
      `Website enquiry recorded (${norm.requestedServiceTitle}) from ${norm.locationArea}.`
    );

    // Execute idempotent secretary notification workflow
    const notifResult = recordOrRetrySecretaryNotification({ lead: savedLead });

    res.status(201).json({
      duplicatePrevented: false,
      leadId: savedLead.leadId,
      createdAtUtc: savedLead.createdAtUtc,
      createdAtNairobi: formatNairobiTime(savedLead.createdAtUtc),
      status: savedLead.status,
      requestedServiceTitle: savedLead.requestedServiceTitle,
      preferredChannel: savedLead.preferredChannel,
      notificationStatus: notifResult.status,
      notificationDetail: notifResult.detail,
      safetyAdvisory: savedLead.orchestratorAnalysis.safetyAdvisory,
      customerAcknowledgementDraft: savedLead.orchestratorAnalysis.customerAcknowledgementDraft,
      message:
        'Your enquiry has been saved to our Lang\'ata Workshop Lead Ledger. Our secretary will review bay availability and contact you shortly.',
    });
  } catch (err) {
    console.error('Error recording enquiry:', err);
    res.status(500).json({
      error:
        'We encountered a server error while saving your enquiry. Please call or WhatsApp our secretary directly using the buttons on screen.',
    });
  }
});

// ---------------------------------------------------------------------------
// Staff Authentication Endpoints
// ---------------------------------------------------------------------------
app.post('/api/staff/login', (req: Request, res: Response) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`login:${clientIp}`, 25, 10 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait 10 minutes.' });
    return;
  }

  const roleInput = String(req.body?.role || '').toUpperCase() as StaffRole;
  const accessCode = String(req.body?.accessCode || '').trim();
  const staffNameInput = sanitizePlainText(req.body?.staffName || '', 60);

  if (!Object.values(StaffRole).includes(roleInput)) {
    res.status(400).json({ error: 'Select a valid staff role (OWNER, SECRETARY, or MECHANIC).' });
    return;
  }

  const expectedCode = getRoleAccessCode(roleInput);
  if (!timingSafeCompare(accessCode, expectedCode)) {
    res.status(401).json({ error: 'Invalid access code for the selected role.' });
    return;
  }

  const defaultNames: Record<StaffRole, string> = {
    [StaffRole.OWNER]: 'Workshop Owner',
    [StaffRole.SECRETARY]: 'Workshop Secretary',
    [StaffRole.MECHANIC]: 'Lead Mechanic',
  };

  const token = crypto.randomBytes(32).toString('hex');
  const session: StaffSession = {
    token,
    staffName: staffNameInput || defaultNames[roleInput],
    role: roleInput,
    expiresAtMs: Date.now() + 12 * 3600 * 1000,
  };
  activeSessions.set(token, session);

  res.setHeader(
    'Set-Cookie',
    `langata_staff_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  );

  res.json({
    authenticated: true,
    token,
    staffName: session.staffName,
    role: session.role,
  });
});

app.post('/api/staff/logout', (req: Request, res: Response) => {
  const session = extractSessionFromRequest(req);
  if (session) {
    activeSessions.delete(session.token);
  }
  res.setHeader('Set-Cookie', 'langata_staff_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ authenticated: false });
});

app.get('/api/staff/session', (req: Request, res: Response) => {
  const session = extractSessionFromRequest(req);
  if (!session) {
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    staffName: session.staffName,
    role: session.role,
  });
});

// ---------------------------------------------------------------------------
// Protected Staff Operations & Lead Ledger Endpoints
// ---------------------------------------------------------------------------
app.get('/api/staff/dashboard', requireStaffAuth(), (req: Request, res: Response) => {
  const config = getBusinessConfig();
  const allLeads = listAllLeads();

  // Apply optional query filters
  const statusFilter = String(req.query.status || 'ALL');
  const sourceFilter = String(req.query.source || 'ALL');
  const staffFilter = String(req.query.assigned || 'ALL');
  const dateFilter = String(req.query.date || '');
  const searchQuery = String(req.query.q || '').toLowerCase().trim();

  const filteredLeads = allLeads.filter((lead) => {
    if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;
    if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) return false;
    if (staffFilter === 'UNASSIGNED' && lead.assignedStaffName !== '') return false;
    if (
      staffFilter !== 'ALL' &&
      staffFilter !== 'UNASSIGNED' &&
      lead.assignedStaffName.toLowerCase() !== staffFilter.toLowerCase()
    ) {
      return false;
    }
    if (dateFilter && !lead.createdAtUtc.startsWith(dateFilter)) return false;
    if (searchQuery) {
      const hay = `${lead.leadId} ${lead.customerName} ${lead.phoneNormalized} ${lead.vehicleMakeModel} ${lead.vehicleRegistration} ${lead.requestedServiceTitle} ${lead.locationArea} ${lead.symptomsDescription}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  const alerts = computeOperationalAlerts(allLeads, config);
  const metrics = computeDashboardMetrics(allLeads);
  const recentAudit = listAuditEntriesForLead();
  const reconciliations = listDailyReconciliations();

  res.json({
    leads: filteredLeads,
    totalUnfilteredCount: allLeads.length,
    alerts,
    metrics,
    recentAudit,
    reconciliations,
    config,
  });
});

app.get('/api/staff/leads/:leadId/audit', requireStaffAuth(), (req: Request, res: Response) => {
  const entries = listAuditEntriesForLead(String(req.params.leadId));
  res.json({ auditEntries: entries });
});

app.post(
  '/api/staff/leads/:leadId/transition',
  requireStaffAuth(),
  (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const leadId = String(req.params.leadId);
    const existing = getLeadById(leadId);
    if (!existing) {
      res.status(404).json({ error: `Lead ${leadId} not found.` });
      return;
    }

    const targetState = (req.body?.targetState || existing.status) as LeadStatus;
    const reason = sanitizePlainText(req.body?.reason || '', 300);
    const note = sanitizePlainText(req.body?.note || '', 500);

    // If transitioning to a new state, validate via state machine + RBAC
    if (targetState !== existing.status) {
      const transitionCheck = validateStateTransition({
        currentState: existing.status,
        targetState,
        actorRole: session.role,
        reason,
      });
      if (!transitionCheck.valid) {
        res.status(400).json({ error: transitionCheck.error });
        return;
      }
    }

    const assignedStaffName =
      req.body?.assignedStaffName !== undefined
        ? sanitizePlainText(req.body.assignedStaffName, 60)
        : undefined;
    const assignedStaffRole =
      req.body?.assignedStaffRole !== undefined
        ? (req.body.assignedStaffRole as StaffRole | '')
        : undefined;
    const nextFollowUpAtUtc =
      req.body?.nextFollowUpAtUtc !== undefined ? req.body.nextFollowUpAtUtc : undefined;
    const bookingDateTimeLocal =
      req.body?.bookingDateTimeLocal !== undefined ? req.body.bookingDateTimeLocal : undefined;
    const bookingBayNotes =
      req.body?.bookingBayNotes !== undefined
        ? sanitizePlainText(req.body.bookingBayNotes, 500)
        : undefined;
    const outcomeSummary =
      req.body?.outcomeSummary !== undefined
        ? sanitizePlainText(req.body.outcomeSummary, 500)
        : undefined;

    const updated = updateLeadStateAndOperationalFields({
      leadId,
      targetState,
      actorName: session.staffName,
      actorRole: session.role,
      reason,
      note: note || `Updated by ${session.staffName} (${session.role})`,
      assignedStaffName,
      assignedStaffRole,
      nextFollowUpAtUtc,
      bookingDateTimeLocal,
      bookingBayNotes,
      outcomeSummary,
      markContactedNow: Boolean(req.body?.markContactedNow),
    });

    res.json({
      lead: updated,
      auditEntries: listAuditEntriesForLead(leadId),
    });
  }
);

// Manual logging of inbound telephone calls, WhatsApp messages, or walk-ins by Secretary/Owner
app.post(
  '/api/staff/leads/manual',
  requireStaffAuth([StaffRole.OWNER, StaffRole.SECRETARY]),
  async (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const config = getBusinessConfig();

    const validation = validateEnquiryInput(
      {
        ...req.body,
        consentGranted: true,
        source: req.body?.source || LeadSource.PHONE_CALL_LOGGED,
      },
      config
    );

    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ error: validation.errors.join(' ') });
      return;
    }

    const norm = validation.normalized;
    const now = new Date();
    const nowUtc = now.toISOString();
    const leadId = generateLeadId(now);
    const followUpAtUtc = new Date(
      now.getTime() + config.internalTargets.defaultFollowUpMinutes * 60 * 1000
    ).toISOString();

    const orchestratorAnalysis = await runBoundedOrchestratorAnalysis({
      leadId,
      customerName: norm.customerName,
      vehicleMakeModel: norm.vehicleMakeModel,
      requestedServiceSlug: norm.requestedServiceSlug,
      requestedServiceTitle: norm.requestedServiceTitle,
      symptomsDescription: norm.symptomsDescription,
      locationArea: norm.locationArea,
      urgency: norm.urgency,
      safetyFlags: norm.safetyFlags,
      status: LeadStatus.ACKNOWLEDGED,
      config,
    });

    const manualLead: LeadRecord = {
      leadId,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
      customerName: norm.customerName,
      phoneRaw: norm.phoneRaw,
      phoneNormalized: norm.phoneNormalized,
      preferredChannel: norm.preferredChannel,
      vehicleMakeModel: norm.vehicleMakeModel,
      vehicleRegistration: norm.vehicleRegistration,
      requestedServiceSlug: norm.requestedServiceSlug,
      requestedServiceTitle: norm.requestedServiceTitle,
      symptomsDescription: norm.symptomsDescription,
      locationArea: norm.locationArea,
      urgency: orchestratorAnalysis.classifiedUrgency,
      safetyFlags: norm.safetyFlags,
      source: norm.source,
      landingPage: 'staff-manual-intake',
      utmSource: 'direct_staff_log',
      utmMedium: norm.source,
      utmCampaign: '',
      assignedStaffName: session.staffName,
      assignedStaffRole: session.role,
      status: LeadStatus.ACKNOWLEDGED,
      lastContactAtUtc: nowUtc,
      nextFollowUpAtUtc: followUpAtUtc,
      bookingDateTimeLocal: null,
      bookingBayNotes: '',
      outcomeSummary: '',
      lossOrCancelReason: '',
      duplicateFingerprint: norm.duplicateFingerprint,
      consentGranted: true,
      isRedacted: false,
      orchestratorAnalysis,
      notificationStatus: 'DELIVERED',
      notificationDetail: `Logged directly by ${session.staffName} (${session.role}).`,
    };

    const saved = insertLeadWithAudit(
      manualLead,
      `Off-website enquiry (${norm.source}) logged manually by ${session.staffName}.`,
      session.staffName,
      session.role
    );

    res.status(201).json({ lead: saved });
  }
);

app.post(
  '/api/staff/leads/:leadId/notify-retry',
  requireStaffAuth([StaffRole.OWNER, StaffRole.SECRETARY]),
  (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const lead = getLeadById(String(req.params.leadId));
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    const result = recordOrRetrySecretaryNotification({
      lead,
      forceManualConfirmation: Boolean(req.body?.confirmManualDispatch),
      actorName: session.staffName,
    });
    res.json({
      notificationStatus: result.status,
      notificationDetail: result.detail,
      lead: getLeadById(lead.leadId),
    });
  }
);

app.post(
  '/api/staff/leads/:leadId/redact',
  requireStaffAuth([StaffRole.OWNER]),
  (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const reason = sanitizePlainText(req.body?.reason || '', 200);
    if (reason.length < 4) {
      res.status(400).json({ error: 'Provide a documented reason for personal data redaction.' });
      return;
    }
    const updated = redactLeadPersonalData(
      String(req.params.leadId),
      session.staffName,
      session.role,
      reason
    );
    res.json({ lead: updated });
  }
);

app.post(
  '/api/staff/reconciliation',
  requireStaffAuth([StaffRole.OWNER, StaffRole.SECRETARY]),
  (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const reconciliationDate =
      sanitizePlainText(req.body?.reconciliationDate, 15) ||
      new Date().toISOString().slice(0, 10);
    const phoneCallsReviewedCount = Math.max(0, Number(req.body?.phoneCallsReviewedCount) || 0);
    const whatsappChatsReviewedCount = Math.max(
      0,
      Number(req.body?.whatsappChatsReviewedCount) || 0
    );
    const unloggedEnquiriesAddedCount = Math.max(
      0,
      Number(req.body?.unloggedEnquiriesAddedCount) || 0
    );
    const discrepancyNotes = sanitizePlainText(req.body?.discrepancyNotes || '', 400);

    const saved = insertDailyReconciliation({
      reconciliationDate,
      loggedByStaffName: session.staffName,
      loggedByRole: session.role,
      phoneCallsReviewedCount,
      whatsappChatsReviewedCount,
      unloggedEnquiriesAddedCount,
      discrepancyNotes: discrepancyNotes || 'All inbound calls and WhatsApp chats reconciled against ledger.',
    });

    res.status(201).json({ reconciliation: saved, reconciliations: listDailyReconciliations() });
  }
);

app.put(
  '/api/staff/config',
  requireStaffAuth([StaffRole.OWNER]),
  (req: Request, res: Response) => {
    const session = (req as Request & { staffSession: StaffSession }).staffSession;
    const current = getBusinessConfig();
    const body = req.body || {};

    const updated = saveBusinessConfig(
      {
        ...current,
        brandShortName: sanitizePlainText(body.brandShortName ?? current.brandShortName, 80),
        legalBusinessName: sanitizePlainText(body.legalBusinessName ?? current.legalBusinessName, 140),
        isPlaceholderName: Boolean(body.isPlaceholderName ?? current.isPlaceholderName),
        workshopAddress: sanitizePlainText(body.workshopAddress ?? current.workshopAddress, 200),
        mechanicPhone: sanitizePlainText(body.mechanicPhone ?? current.mechanicPhone, 30),
        secretaryPhone: sanitizePlainText(body.secretaryPhone ?? current.secretaryPhone, 30),
        whatsappNumber: sanitizePlainText(body.whatsappNumber ?? current.whatsappNumber, 30),
        businessEmail: sanitizePlainText(body.businessEmail ?? current.businessEmail, 100),
        operatingHours: sanitizePlainText(body.operatingHours ?? current.operatingHours, 160),
        dispatchPolicy: sanitizePlainText(body.dispatchPolicy ?? current.dispatchPolicy, 400),
        indicativePricesApproved: Boolean(
          body.indicativePricesApproved ?? current.indicativePricesApproved
        ),
        internalTargets: {
          acknowledgeTargetMinutes: Math.max(
            1,
            Number(body.internalTargets?.acknowledgeTargetMinutes) ||
              current.internalTargets.acknowledgeTargetMinutes
          ),
          assignTargetMinutes: Math.max(
            1,
            Number(body.internalTargets?.assignTargetMinutes) ||
              current.internalTargets.assignTargetMinutes
          ),
          defaultFollowUpMinutes: Math.max(
            5,
            Number(body.internalTargets?.defaultFollowUpMinutes) ||
              current.internalTargets.defaultFollowUpMinutes
          ),
          staleLeadHours: Math.max(
            1,
            Number(body.internalTargets?.staleLeadHours) || current.internalTargets.staleLeadHours
          ),
        },
      },
      session.staffName
    );

    res.json({ config: updated });
  }
);

app.get(
  '/api/staff/export.csv',
  requireStaffAuth([StaffRole.OWNER, StaffRole.SECRETARY]),
  (_req: Request, res: Response) => {
    const leads = listAllLeads();
    const headers = [
      'Lead ID',
      'Created UTC',
      'Created Nairobi EAT',
      'Customer Name',
      'Phone Normalized',
      'Preferred Channel',
      'Vehicle Make/Model',
      'Registration',
      'Service Requested',
      'Location Area',
      'Urgency',
      'Source',
      'Status',
      'Assigned Staff',
      'Last Contact UTC',
      'Next Follow-Up UTC',
      'Booking Date/Time',
      'Outcome Summary',
      'Loss/Cancel Reason',
      'Notification Status',
    ];

    const escapeCsv = (val: unknown): string => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = leads.map((l) =>
      [
        l.leadId,
        l.createdAtUtc,
        formatNairobiTime(l.createdAtUtc),
        l.customerName,
        l.phoneNormalized,
        l.preferredChannel,
        l.vehicleMakeModel,
        l.vehicleRegistration,
        l.requestedServiceTitle,
        l.locationArea,
        l.urgency,
        l.source,
        l.status,
        l.assignedStaffName,
        l.lastContactAtUtc || '',
        l.nextFollowUpAtUtc || '',
        l.bookingDateTimeLocal || '',
        l.outcomeSummary,
        l.lossOrCancelReason,
        l.notificationStatus,
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="langata-lead-ledger-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csvContent);
  }
);

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lang'ata Auto Ops & Lead Ledger running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
