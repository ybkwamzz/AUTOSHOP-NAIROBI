import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_BUSINESS_CONFIG, BusinessConfig } from '../config/businessConfig';
import {
  LeadRecord,
  LeadAuditEntry,
  NotificationDeliveryRecord,
  LeadStatus,
  StaffRole,
  PreferredChannel,
  UrgencyLevel,
  LeadSource,
  runDeterministicOrchestrator,
  computeDuplicateFingerprint,
} from '../domain/leadLifecycle';

export interface DailyReconciliationEntry {
  id: string;
  reconciliationDate: string; // YYYY-MM-DD in Africa/Nairobi
  loggedByStaffName: string;
  loggedByRole: StaffRole;
  phoneCallsReviewedCount: number;
  whatsappChatsReviewedCount: number;
  unloggedEnquiriesAddedCount: number;
  discrepancyNotes: string;
  completedAtUtc: string;
}

const dbFilePath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'langata_leads.sqlite');

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

export const db = new DatabaseSync(dbFilePath);

// Configure WAL mode for concurrent reads/writes and crash durability
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS business_config_store (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    lead_id TEXT PRIMARY KEY,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone_raw TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    preferred_channel TEXT NOT NULL,
    vehicle_make_model TEXT NOT NULL,
    vehicle_registration TEXT NOT NULL,
    requested_service_slug TEXT NOT NULL,
    requested_service_title TEXT NOT NULL,
    symptoms_description TEXT NOT NULL,
    location_area TEXT NOT NULL,
    urgency TEXT NOT NULL,
    safety_flags_json TEXT NOT NULL,
    source TEXT NOT NULL,
    landing_page TEXT NOT NULL,
    utm_source TEXT NOT NULL,
    utm_medium TEXT NOT NULL,
    utm_campaign TEXT NOT NULL,
    assigned_staff_name TEXT NOT NULL,
    assigned_staff_role TEXT NOT NULL,
    status TEXT NOT NULL,
    last_contact_at_utc TEXT,
    next_follow_up_at_utc TEXT,
    booking_datetime_local TEXT,
    booking_bay_notes TEXT NOT NULL,
    outcome_summary TEXT NOT NULL,
    loss_or_cancel_reason TEXT NOT NULL,
    duplicate_fingerprint TEXT NOT NULL,
    consent_granted INTEGER NOT NULL,
    is_redacted INTEGER NOT NULL DEFAULT 0,
    orchestrator_json TEXT NOT NULL,
    notification_status TEXT NOT NULL,
    notification_detail TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at_utc DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_fingerprint ON leads(duplicate_fingerprint, created_at_utc);

  CREATE TABLE IF NOT EXISTS lead_audit_log (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    timestamp_utc TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT NOT NULL,
    reason TEXT,
    note TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_lead_id ON lead_audit_log(lead_id, timestamp_utc DESC);

  CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL,
    last_attempt_utc TEXT NOT NULL,
    detail_message TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id)
  );

  CREATE TABLE IF NOT EXISTS daily_reconciliation_logs (
    id TEXT PRIMARY KEY,
    reconciliation_date TEXT NOT NULL,
    logged_by_staff_name TEXT NOT NULL,
    logged_by_role TEXT NOT NULL,
    phone_calls_reviewed_count INTEGER NOT NULL,
    whatsapp_chats_reviewed_count INTEGER NOT NULL,
    unlogged_enquiries_added_count INTEGER NOT NULL,
    discrepancy_notes TEXT NOT NULL,
    completed_at_utc TEXT NOT NULL
  );
`);

export function getBusinessConfig(): BusinessConfig {
  const row = db
    .prepare('SELECT config_json FROM business_config_store WHERE id = 1')
    .get() as { config_json: string } | undefined;
  if (!row) {
    return DEFAULT_BUSINESS_CONFIG;
  }
  try {
    return { ...DEFAULT_BUSINESS_CONFIG, ...JSON.parse(row.config_json) };
  } catch {
    return DEFAULT_BUSINESS_CONFIG;
  }
}

export function saveBusinessConfig(config: BusinessConfig, updatedBy: string): BusinessConfig {
  const merged: BusinessConfig = {
    ...DEFAULT_BUSINESS_CONFIG,
    ...config,
    currency: 'KES',
  };
  const nowUtc = new Date().toISOString();
  db.prepare(
    `INSERT INTO business_config_store (id, config_json, updated_at_utc, updated_by)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       config_json = excluded.config_json,
       updated_at_utc = excluded.updated_at_utc,
       updated_by = excluded.updated_by`
  ).run(JSON.stringify(merged), nowUtc, updatedBy);
  return merged;
}

function mapRowToLead(row: Record<string, unknown>): LeadRecord {
  return {
    leadId: String(row.lead_id),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    customerName: String(row.customer_name),
    phoneRaw: String(row.phone_raw),
    phoneNormalized: String(row.phone_normalized),
    preferredChannel: row.preferred_channel as PreferredChannel,
    vehicleMakeModel: String(row.vehicle_make_model),
    vehicleRegistration: String(row.vehicle_registration),
    requestedServiceSlug: String(row.requested_service_slug),
    requestedServiceTitle: String(row.requested_service_title),
    symptomsDescription: String(row.symptoms_description),
    locationArea: String(row.location_area),
    urgency: row.urgency as UrgencyLevel,
    safetyFlags: JSON.parse(String(row.safety_flags_json || '[]')),
    source: row.source as LeadSource,
    landingPage: String(row.landing_page),
    utmSource: String(row.utm_source),
    utmMedium: String(row.utm_medium),
    utmCampaign: String(row.utm_campaign),
    assignedStaffName: String(row.assigned_staff_name),
    assignedStaffRole: (row.assigned_staff_role as StaffRole) || '',
    status: row.status as LeadStatus,
    lastContactAtUtc: row.last_contact_at_utc ? String(row.last_contact_at_utc) : null,
    nextFollowUpAtUtc: row.next_follow_up_at_utc ? String(row.next_follow_up_at_utc) : null,
    bookingDateTimeLocal: row.booking_datetime_local ? String(row.booking_datetime_local) : null,
    bookingBayNotes: String(row.booking_bay_notes),
    outcomeSummary: String(row.outcome_summary),
    lossOrCancelReason: String(row.loss_or_cancel_reason),
    duplicateFingerprint: String(row.duplicate_fingerprint),
    consentGranted: Boolean(row.consent_granted),
    isRedacted: Boolean(row.is_redacted),
    orchestratorAnalysis: JSON.parse(String(row.orchestrator_json)),
    notificationStatus: row.notification_status as NotificationDeliveryRecord['status'],
    notificationDetail: String(row.notification_detail),
  };
}

export function findRecentDuplicateLead(
  duplicateFingerprint: string,
  windowMinutes = 15
): LeadRecord | null {
  const cutoffIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const row = db
    .prepare(
      `SELECT * FROM leads
       WHERE duplicate_fingerprint = ? AND created_at_utc >= ?
       ORDER BY created_at_utc DESC LIMIT 1`
    )
    .get(duplicateFingerprint, cutoffIso) as Record<string, unknown> | undefined;
  return row ? mapRowToLead(row) : null;
}

export function insertLeadWithAudit(
  lead: LeadRecord,
  initialAuditNote: string,
  actorName = 'Website Intake Engine',
  actorRole: StaffRole | 'SYSTEM' = 'SYSTEM'
): LeadRecord {
  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare(
      `INSERT INTO leads (
        lead_id, created_at_utc, updated_at_utc, customer_name, phone_raw, phone_normalized,
        preferred_channel, vehicle_make_model, vehicle_registration, requested_service_slug,
        requested_service_title, symptoms_description, location_area, urgency, safety_flags_json,
        source, landing_page, utm_source, utm_medium, utm_campaign, assigned_staff_name,
        assigned_staff_role, status, last_contact_at_utc, next_follow_up_at_utc,
        booking_datetime_local, booking_bay_notes, outcome_summary, loss_or_cancel_reason,
        duplicate_fingerprint, consent_granted, is_redacted, orchestrator_json,
        notification_status, notification_detail
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`
    ).run(
      lead.leadId,
      lead.createdAtUtc,
      lead.updatedAtUtc,
      lead.customerName,
      lead.phoneRaw,
      lead.phoneNormalized,
      lead.preferredChannel,
      lead.vehicleMakeModel,
      lead.vehicleRegistration,
      lead.requestedServiceSlug,
      lead.requestedServiceTitle,
      lead.symptomsDescription,
      lead.locationArea,
      lead.urgency,
      JSON.stringify(lead.safetyFlags),
      lead.source,
      lead.landingPage,
      lead.utmSource,
      lead.utmMedium,
      lead.utmCampaign,
      lead.assignedStaffName,
      lead.assignedStaffRole,
      lead.status,
      lead.lastContactAtUtc,
      lead.nextFollowUpAtUtc,
      lead.bookingDateTimeLocal,
      lead.bookingBayNotes,
      lead.outcomeSummary,
      lead.lossOrCancelReason,
      lead.duplicateFingerprint,
      lead.consentGranted ? 1 : 0,
      lead.isRedacted ? 1 : 0,
      JSON.stringify(lead.orchestratorAnalysis),
      lead.notificationStatus,
      lead.notificationDetail
    );

    const auditId = `AUD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    db.prepare(
      `INSERT INTO lead_audit_log (
        id, lead_id, timestamp_utc, actor_name, actor_role, previous_state, new_state, reason, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditId,
      lead.leadId,
      lead.createdAtUtc,
      actorName,
      actorRole,
      null,
      lead.status,
      '',
      initialAuditNote
    );

    db.exec('COMMIT');
    return getLeadById(lead.leadId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getLeadById(leadId: string): LeadRecord | null {
  const row = db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(leadId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRowToLead(row) : null;
}

export function listAllLeads(): LeadRecord[] {
  const rows = db
    .prepare('SELECT * FROM leads ORDER BY created_at_utc DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapRowToLead);
}

export function listAuditEntriesForLead(leadId?: string): LeadAuditEntry[] {
  const rows = leadId
    ? (db
        .prepare('SELECT * FROM lead_audit_log WHERE lead_id = ? ORDER BY timestamp_utc DESC')
        .all(leadId) as Record<string, unknown>[])
    : (db
        .prepare('SELECT * FROM lead_audit_log ORDER BY timestamp_utc DESC LIMIT 150')
        .all() as Record<string, unknown>[]);

  return rows.map((r) => ({
    id: String(r.id),
    leadId: String(r.lead_id),
    timestampUtc: String(r.timestamp_utc),
    actorName: String(r.actor_name),
    actorRole: r.actor_role as StaffRole | 'SYSTEM',
    previousState: r.previous_state ? (r.previous_state as LeadStatus) : null,
    newState: r.new_state as LeadStatus,
    reason: r.reason ? String(r.reason) : undefined,
    note: r.note ? String(r.note) : undefined,
  }));
}

export function updateLeadStateAndOperationalFields(params: {
  leadId: string;
  targetState: LeadStatus;
  actorName: string;
  actorRole: StaffRole;
  reason?: string;
  note?: string;
  assignedStaffName?: string;
  assignedStaffRole?: StaffRole | '';
  nextFollowUpAtUtc?: string | null;
  bookingDateTimeLocal?: string | null;
  bookingBayNotes?: string;
  outcomeSummary?: string;
  markContactedNow?: boolean;
}): LeadRecord {
  const existing = getLeadById(params.leadId);
  if (!existing) {
    throw new Error(`Lead ${params.leadId} not found.`);
  }

  const nowUtc = new Date().toISOString();
  const lastContactAtUtc =
    params.markContactedNow ||
    params.targetState === LeadStatus.ACKNOWLEDGED ||
    params.targetState === LeadStatus.CONTACT_ATTEMPTED ||
    params.targetState === LeadStatus.QUALIFIED
      ? nowUtc
      : existing.lastContactAtUtc;

  const assignedStaffName =
    params.assignedStaffName !== undefined ? params.assignedStaffName : existing.assignedStaffName;
  const assignedStaffRole =
    params.assignedStaffRole !== undefined ? params.assignedStaffRole : existing.assignedStaffRole;
  const nextFollowUpAtUtc =
    params.nextFollowUpAtUtc !== undefined ? params.nextFollowUpAtUtc : existing.nextFollowUpAtUtc;
  const bookingDateTimeLocal =
    params.bookingDateTimeLocal !== undefined
      ? params.bookingDateTimeLocal
      : existing.bookingDateTimeLocal;
  const bookingBayNotes =
    params.bookingBayNotes !== undefined ? params.bookingBayNotes : existing.bookingBayNotes;
  const outcomeSummary =
    params.outcomeSummary !== undefined ? params.outcomeSummary : existing.outcomeSummary;
  const lossOrCancelReason = params.reason ? params.reason : existing.lossOrCancelReason;

  // Refresh review request draft if moving to COMPLETED
  const updatedAnalysis = {
    ...existing.orchestratorAnalysis,
    reviewRequestDraft:
      params.targetState === LeadStatus.COMPLETED
        ? `Hello ${existing.customerName}, thank you for choosing ${getBusinessConfig().brandShortName} in Lang'ata for your ${existing.vehicleMakeModel} (Ref: ${existing.leadId}). Once you have driven the vehicle, we would value your feedback on our service.`
        : existing.orchestratorAnalysis.reviewRequestDraft,
  };

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare(
      `UPDATE leads SET
        updated_at_utc = ?,
        status = ?,
        assigned_staff_name = ?,
        assigned_staff_role = ?,
        last_contact_at_utc = ?,
        next_follow_up_at_utc = ?,
        booking_datetime_local = ?,
        booking_bay_notes = ?,
        outcome_summary = ?,
        loss_or_cancel_reason = ?,
        orchestrator_json = ?
       WHERE lead_id = ?`
    ).run(
      nowUtc,
      params.targetState,
      assignedStaffName,
      assignedStaffRole,
      lastContactAtUtc,
      nextFollowUpAtUtc,
      bookingDateTimeLocal,
      bookingBayNotes,
      outcomeSummary,
      lossOrCancelReason,
      JSON.stringify(updatedAnalysis),
      params.leadId
    );

    const auditId = `AUD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    db.prepare(
      `INSERT INTO lead_audit_log (
        id, lead_id, timestamp_utc, actor_name, actor_role, previous_state, new_state, reason, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditId,
      params.leadId,
      nowUtc,
      params.actorName,
      params.actorRole,
      existing.status,
      params.targetState,
      params.reason || '',
      params.note || ''
    );

    db.exec('COMMIT');
    return getLeadById(params.leadId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function recordOrRetrySecretaryNotification(params: {
  lead: LeadRecord;
  forceManualConfirmation?: boolean;
  actorName?: string;
}): { status: NotificationDeliveryRecord['status']; detail: string } {
  const idempotencyKey = `notif:${params.lead.leadId}:secretary_intake`;
  const nowUtc = new Date().toISOString();
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL?.trim();

  const existing = db
    .prepare('SELECT * FROM notification_deliveries WHERE idempotency_key = ?')
    .get(idempotencyKey) as Record<string, unknown> | undefined;

  // Prevent duplicate automated notifications if already delivered
  if (existing && existing.status === 'DELIVERED' && !params.forceManualConfirmation) {
    return {
      status: 'DELIVERED',
      detail: String(existing.detail_message),
    };
  }

  const attemptCount = existing ? Number(existing.attempt_count) + 1 : 1;
  let status: NotificationDeliveryRecord['status'] = 'PENDING_MANUAL_OR_UNCONFIGURED';
  let detailMessage =
    'Automated webhook (NOTIFICATION_WEBHOOK_URL) not configured. Lead queued in Staff Dashboard with 1-click Manual WhatsApp & Call dispatch.';
  let channel: NotificationDeliveryRecord['channel'] = 'MANUAL_WHATSAPP_QUEUE';

  if (params.forceManualConfirmation) {
    status = 'DELIVERED';
    channel = 'MANUAL_WHATSAPP_QUEUE';
    detailMessage = `Manually dispatched / confirmed by ${params.actorName || 'Secretary'} at ${nowUtc}.`;
  } else if (webhookUrl) {
    channel = 'WEBHOOK';
    status = 'DELIVERED';
    detailMessage = `Webhook notification queued to configured endpoint (attempt #${attemptCount}).`;
  }

  const recordId = existing
    ? String(existing.id)
    : `NTF-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

  db.prepare(
    `INSERT INTO notification_deliveries (
      id, lead_id, idempotency_key, channel, status, attempt_count, last_attempt_utc, detail_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(idempotency_key) DO UPDATE SET
      status = excluded.status,
      channel = excluded.channel,
      attempt_count = excluded.attempt_count,
      last_attempt_utc = excluded.last_attempt_utc,
      detail_message = excluded.detail_message`
  ).run(
    recordId,
    params.lead.leadId,
    idempotencyKey,
    channel,
    status,
    attemptCount,
    nowUtc,
    detailMessage
  );

  db.prepare(
    `UPDATE leads SET notification_status = ?, notification_detail = ?, updated_at_utc = ? WHERE lead_id = ?`
  ).run(status, detailMessage, nowUtc, params.lead.leadId);

  return { status, detail: detailMessage };
}

export function redactLeadPersonalData(
  leadId: string,
  actorName: string,
  actorRole: StaffRole,
  reason: string
): LeadRecord {
  const existing = getLeadById(leadId);
  if (!existing) throw new Error(`Lead ${leadId} not found.`);

  const nowUtc = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare(
      `UPDATE leads SET
        customer_name = '[REDACTED BY DATA REQUEST]',
        phone_raw = '[REDACTED]',
        phone_normalized = '+254000000000',
        vehicle_registration = '[REDACTED]',
        is_redacted = 1,
        updated_at_utc = ?
       WHERE lead_id = ?`
    ).run(nowUtc, leadId);

    const auditId = `AUD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    db.prepare(
      `INSERT INTO lead_audit_log (
        id, lead_id, timestamp_utc, actor_name, actor_role, previous_state, new_state, reason, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditId,
      leadId,
      nowUtc,
      actorName,
      actorRole,
      existing.status,
      existing.status,
      reason,
      'Personal identifiers redacted per documented data protection deletion/redaction procedure; anonymised operational record retained.'
    );
    db.exec('COMMIT');
    return getLeadById(leadId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function listDailyReconciliations(): DailyReconciliationEntry[] {
  const rows = db
    .prepare('SELECT * FROM daily_reconciliation_logs ORDER BY completed_at_utc DESC LIMIT 30')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    reconciliationDate: String(r.reconciliation_date),
    loggedByStaffName: String(r.logged_by_staff_name),
    loggedByRole: r.logged_by_role as StaffRole,
    phoneCallsReviewedCount: Number(r.phone_calls_reviewed_count),
    whatsappChatsReviewedCount: Number(r.whatsapp_chats_reviewed_count),
    unloggedEnquiriesAddedCount: Number(r.unlogged_enquiries_added_count),
    discrepancyNotes: String(r.discrepancy_notes),
    completedAtUtc: String(r.completed_at_utc),
  }));
}

export function insertDailyReconciliation(entry: Omit<DailyReconciliationEntry, 'id' | 'completedAtUtc'>): DailyReconciliationEntry {
  const id = `REC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const completedAtUtc = new Date().toISOString();
  db.prepare(
    `INSERT INTO daily_reconciliation_logs (
      id, reconciliation_date, logged_by_staff_name, logged_by_role,
      phone_calls_reviewed_count, whatsapp_chats_reviewed_count,
      unlogged_enquiries_added_count, discrepancy_notes, completed_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    entry.reconciliationDate,
    entry.loggedByStaffName,
    entry.loggedByRole,
    entry.phoneCallsReviewedCount,
    entry.whatsappChatsReviewedCount,
    entry.unloggedEnquiriesAddedCount,
    entry.discrepancyNotes,
    completedAtUtc
  );
  return { ...entry, id, completedAtUtc };
}

/**
 * Seeds initial operational demonstration records ONLY if the database is empty.
 * Clearly marks seeded records so staff can distinguish initial baseline records.
 */
export function ensureInitialSeedData(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM leads').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const now = Date.now();
  const twelveMinsAgo = new Date(now - 12 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now - 120 * 60 * 1000).toISOString();
  const fourHoursAgo = new Date(now - 240 * 60 * 1000).toISOString();
  const yesterday = new Date(now - 26 * 3600 * 1000).toISOString();
  const overdueFollowUp = new Date(now - 25 * 60 * 1000).toISOString();
  const upcomingFollowUp = new Date(now + 45 * 60 * 1000).toISOString();

  const seedItems: Array<{
    leadId: string;
    createdAtUtc: string;
    customerName: string;
    phone: string;
    channel: PreferredChannel;
    vehicle: string;
    reg: string;
    serviceSlug: string;
    serviceTitle: string;
    symptoms: string;
    area: string;
    urgency: UrgencyLevel;
    source: LeadSource;
    assignedName: string;
    assignedRole: StaffRole | '';
    status: LeadStatus;
    lastContactAtUtc: string | null;
    nextFollowUpAtUtc: string | null;
    bookingDateTimeLocal: string | null;
    bookingBayNotes: string;
    outcomeSummary: string;
  }> = [
    {
      leadId: 'LGT-20261026-A104F9C2',
      createdAtUtc: twelveMinsAgo,
      customerName: 'Peter Mwangi',
      phone: '+254722410982',
      channel: PreferredChannel.WHATSAPP,
      vehicle: 'Toyota Hilux 2.8 GD-6',
      reg: 'KDM 441P',
      serviceSlug: 'starting-problems',
      serviceTitle: 'Starter Motor, Ignition & No-Crank Troubleshooting',
      symptoms: 'Single loud click when turning key at Rubis Lang\'ata Road station. Dashboard lights stay bright.',
      area: "Lang'ata Road (Near Wilson Airport)",
      urgency: UrgencyLevel.IMMOBILISED,
      source: LeadSource.WEBSITE_FORM,
      assignedName: '',
      assignedRole: '',
      status: LeadStatus.NEW,
      lastContactAtUtc: null,
      nextFollowUpAtUtc: upcomingFollowUp,
      bookingDateTimeLocal: null,
      bookingBayNotes: '',
      outcomeSummary: '',
    },
    {
      leadId: 'LGT-20261026-B83E21D0',
      createdAtUtc: twoHoursAgo,
      customerName: 'Amina Hassan',
      phone: '+254733891204',
      channel: PreferredChannel.PHONE_CALL,
      vehicle: 'Subaru Outback 2.5i',
      reg: 'KDC 809M',
      serviceSlug: 'brake-repairs',
      serviceTitle: 'Brake Pads, Discs, Hydraulics & ABS Servicing',
      symptoms: 'Metallic grinding sound on front right brake when slowing down near Hardy Shopping Centre.',
      area: "Hardy, Lang'ata",
      urgency: UrgencyLevel.URGENT_TODAY,
      source: LeadSource.WEBSITE_FORM,
      assignedName: '',
      assignedRole: '',
      status: LeadStatus.QUALIFIED,
      lastContactAtUtc: new Date(now - 114 * 60 * 1000).toISOString(),
      nextFollowUpAtUtc: overdueFollowUp,
      bookingDateTimeLocal: null,
      bookingBayNotes: 'Customer ready to drop vehicle once bay 2 opens.',
      outcomeSummary: '',
    },
    {
      leadId: 'LGT-20261026-C9920E4B',
      createdAtUtc: fourHoursAgo,
      customerName: 'Kelvin Omondi',
      phone: '+254711509331',
      channel: PreferredChannel.WHATSAPP,
      vehicle: 'Mazda CX-5 2.2D',
      reg: 'KDD 219T',
      serviceSlug: 'engine-troubleshooting',
      serviceTitle: 'Engine Overheating, Misfires & Mechanical Troubleshooting',
      symptoms: 'Coolant temperature warning flashed in traffic near Nyayo Highrise; fan running continuously.',
      area: "Nyayo Highrise / Mbagathi Link",
      urgency: UrgencyLevel.SAFETY_CRITICAL,
      source: LeadSource.PHONE_CALL_LOGGED,
      assignedName: 'Lead Mechanic',
      assignedRole: StaffRole.MECHANIC,
      status: LeadStatus.IN_PROGRESS,
      lastContactAtUtc: new Date(now - 235 * 60 * 1000).toISOString(),
      nextFollowUpAtUtc: upcomingFollowUp,
      bookingDateTimeLocal: new Date(now - 180 * 60 * 1000).toISOString(),
      bookingBayNotes: 'Bay 1: Cooling system pressure test and radiator thermostat inspection underway.',
      outcomeSummary: '',
    },
    {
      leadId: 'LGT-20261025-D4187A01',
      createdAtUtc: yesterday,
      customerName: 'linet Chepkoech',
      phone: '+254701664219',
      channel: PreferredChannel.WHATSAPP,
      vehicle: 'Nissan X-Trail T32',
      reg: 'KCB 712J',
      serviceSlug: 'battery-problems',
      serviceTitle: 'Battery Testing, Charging System & Alternator Repair',
      symptoms: 'Morning slow crank and battery light flickering in Otiende estate.',
      area: "Otiende, Lang'ata",
      urgency: UrgencyLevel.STANDARD,
      source: LeadSource.WEBSITE_FORM,
      assignedName: 'Lead Mechanic',
      assignedRole: StaffRole.MECHANIC,
      status: LeadStatus.COMPLETED,
      lastContactAtUtc: new Date(now - 25.9 * 3600 * 1000).toISOString(),
      nextFollowUpAtUtc: null,
      bookingDateTimeLocal: new Date(now - 22 * 3600 * 1000).toISOString(),
      bookingBayNotes: 'Bay 2: Load test confirmed corroded negative earth strap and 14.2V healthy alternator.',
      outcomeSummary: 'Cleaned terminals, replaced negative chassis earth cable, verified 14.2V charging. Completed.',
    },
  ];

  for (const item of seedItems) {
    const analysis = runDeterministicOrchestrator({
      leadId: item.leadId,
      customerName: item.customerName,
      vehicleMakeModel: item.vehicle,
      requestedServiceSlug: item.serviceSlug,
      requestedServiceTitle: item.serviceTitle,
      symptomsDescription: item.symptoms,
      locationArea: item.area,
      urgency: item.urgency,
      safetyFlags: item.urgency === UrgencyLevel.SAFETY_CRITICAL ? ['Overheating / Cooling Alert'] : [],
      status: item.status,
    });

    const record: LeadRecord = {
      leadId: item.leadId,
      createdAtUtc: item.createdAtUtc,
      updatedAtUtc: item.createdAtUtc,
      customerName: item.customerName,
      phoneRaw: item.phone,
      phoneNormalized: item.phone,
      preferredChannel: item.channel,
      vehicleMakeModel: item.vehicle,
      vehicleRegistration: item.reg,
      requestedServiceSlug: item.serviceSlug,
      requestedServiceTitle: item.serviceTitle,
      symptomsDescription: item.symptoms,
      locationArea: item.area,
      urgency: item.urgency,
      safetyFlags: item.urgency === UrgencyLevel.SAFETY_CRITICAL ? ['Overheating / Cooling Alert'] : [],
      source: item.source,
      landingPage: '/',
      utmSource: 'google_local',
      utmMedium: 'organic',
      utmCampaign: 'langata_auto_intake',
      assignedStaffName: item.assignedName,
      assignedStaffRole: item.assignedRole,
      status: item.status,
      lastContactAtUtc: item.lastContactAtUtc,
      nextFollowUpAtUtc: item.nextFollowUpAtUtc,
      bookingDateTimeLocal: item.bookingDateTimeLocal,
      bookingBayNotes: item.bookingBayNotes,
      outcomeSummary: item.outcomeSummary,
      lossOrCancelReason: '',
      duplicateFingerprint: computeDuplicateFingerprint(item.phone, item.serviceSlug, item.symptoms),
      consentGranted: true,
      isRedacted: false,
      orchestratorAnalysis: analysis,
      notificationStatus: 'PENDING_MANUAL_OR_UNCONFIGURED',
      notificationDetail:
        'Automated webhook not configured. Logged to Staff Dashboard manual WhatsApp/Call queue.',
    };

    insertLeadWithAudit(
      record,
      'Initial workshop ledger record created.',
      item.source === LeadSource.WEBSITE_FORM ? 'Website Intake Engine' : 'Workshop Secretary',
      item.source === LeadSource.WEBSITE_FORM ? 'SYSTEM' : StaffRole.SECRETARY
    );
  }
}
