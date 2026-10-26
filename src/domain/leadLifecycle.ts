import crypto from 'node:crypto';
import { DEFAULT_BUSINESS_CONFIG, BusinessConfig } from '../config/businessConfig';

export enum LeadStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  CONTACT_ATTEMPTED = 'CONTACT_ATTEMPTED',
  QUALIFIED = 'QUALIFIED',
  ASSIGNED = 'ASSIGNED',
  BOOKED = 'BOOKED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
  INVALID = 'INVALID',
}

export enum StaffRole {
  OWNER = 'OWNER',
  SECRETARY = 'SECRETARY',
  MECHANIC = 'MECHANIC',
}

export enum PreferredChannel {
  WHATSAPP = 'WHATSAPP',
  PHONE_CALL = 'PHONE_CALL',
  SMS = 'SMS',
  EITHER = 'EITHER',
}

export enum UrgencyLevel {
  STANDARD = 'STANDARD',
  URGENT_TODAY = 'URGENT_TODAY',
  IMMOBILISED = 'IMMOBILISED',
  SAFETY_CRITICAL = 'SAFETY_CRITICAL',
}

export enum LeadSource {
  WEBSITE_FORM = 'WEBSITE_FORM',
  PHONE_CALL_LOGGED = 'PHONE_CALL_LOGGED',
  WHATSAPP_LOGGED = 'WHATSAPP_LOGGED',
  WALK_IN_LOGGED = 'WALK_IN_LOGGED',
}

export interface LeadAuditEntry {
  id: string;
  leadId: string;
  timestampUtc: string;
  actorName: string;
  actorRole: StaffRole | 'SYSTEM';
  previousState: LeadStatus | null;
  newState: LeadStatus;
  reason?: string;
  note?: string;
}

export interface NotificationDeliveryRecord {
  id: string;
  leadId: string;
  idempotencyKey: string;
  channel: 'WEBHOOK' | 'MANUAL_WHATSAPP_QUEUE';
  status: 'DELIVERED' | 'PENDING_MANUAL_OR_UNCONFIGURED' | 'FAILED_RETRYABLE' | 'ESCALATED_OWNER';
  attemptCount: number;
  lastAttemptUtc: string;
  detailMessage: string;
}

export interface OrchestratorAnalysis {
  symptomSummary: string;
  classifiedServiceSlug: string;
  classifiedUrgency: UrgencyLevel;
  safetyAdvisory: string | null;
  suggestedAssigneeRole: 'SECRETARY' | 'MECHANIC';
  suggestedMechanicNote: string;
  customerAcknowledgementDraft: string;
  reviewRequestDraft: string | null;
  generatedBy: 'GEMINI_BOUNDED_SCHEMA' | 'DETERMINISTIC_RULES';
  generatedAtUtc: string;
}

export interface LeadRecord {
  leadId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  customerName: string;
  phoneRaw: string;
  phoneNormalized: string;
  preferredChannel: PreferredChannel;
  vehicleMakeModel: string;
  vehicleRegistration: string;
  requestedServiceSlug: string;
  requestedServiceTitle: string;
  symptomsDescription: string;
  locationArea: string;
  urgency: UrgencyLevel;
  safetyFlags: string[];
  source: LeadSource;
  landingPage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  assignedStaffName: string;
  assignedStaffRole: StaffRole | '';
  status: LeadStatus;
  lastContactAtUtc: string | null;
  nextFollowUpAtUtc: string | null;
  bookingDateTimeLocal: string | null;
  bookingBayNotes: string;
  outcomeSummary: string;
  lossOrCancelReason: string;
  duplicateFingerprint: string;
  consentGranted: boolean;
  isRedacted: boolean;
  orchestratorAnalysis: OrchestratorAnalysis;
  notificationStatus: NotificationDeliveryRecord['status'];
  notificationDetail: string;
}

export interface EnquirySubmissionInput {
  customerName: string;
  phone: string;
  preferredChannel?: string;
  vehicleMakeModel?: string;
  vehicleRegistration?: string;
  requestedServiceSlug: string;
  symptomsDescription: string;
  locationArea: string;
  urgency?: string;
  safetyFlags?: string[];
  source?: LeadSource;
  landingPage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  consentGranted: boolean;
  honeypotWebsite?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: {
    customerName: string;
    phoneRaw: string;
    phoneNormalized: string;
    preferredChannel: PreferredChannel;
    vehicleMakeModel: string;
    vehicleRegistration: string;
    requestedServiceSlug: string;
    requestedServiceTitle: string;
    symptomsDescription: string;
    locationArea: string;
    urgency: UrgencyLevel;
    safetyFlags: string[];
    source: LeadSource;
    landingPage: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    consentGranted: boolean;
    duplicateFingerprint: string;
  };
}

/**
 * Validated state transitions map.
 * A lead may only enter a state through an explicit allowed transition.
 */
export const ALLOWED_STATE_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [
    LeadStatus.ACKNOWLEDGED,
    LeadStatus.CONTACT_ATTEMPTED,
    LeadStatus.QUALIFIED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
    LeadStatus.INVALID,
  ],
  [LeadStatus.ACKNOWLEDGED]: [
    LeadStatus.CONTACT_ATTEMPTED,
    LeadStatus.QUALIFIED,
    LeadStatus.ASSIGNED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
    LeadStatus.INVALID,
  ],
  [LeadStatus.CONTACT_ATTEMPTED]: [
    LeadStatus.ACKNOWLEDGED,
    LeadStatus.QUALIFIED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
    LeadStatus.INVALID,
  ],
  [LeadStatus.QUALIFIED]: [
    LeadStatus.ASSIGNED,
    LeadStatus.BOOKED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
  ],
  [LeadStatus.ASSIGNED]: [
    LeadStatus.BOOKED,
    LeadStatus.IN_PROGRESS,
    LeadStatus.QUALIFIED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
  ],
  [LeadStatus.BOOKED]: [
    LeadStatus.IN_PROGRESS,
    LeadStatus.COMPLETED,
    LeadStatus.ASSIGNED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
  ],
  [LeadStatus.IN_PROGRESS]: [
    LeadStatus.COMPLETED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
  ],
  [LeadStatus.COMPLETED]: [],
  [LeadStatus.LOST]: [LeadStatus.QUALIFIED, LeadStatus.ACKNOWLEDGED],
  [LeadStatus.CANCELLED]: [LeadStatus.QUALIFIED, LeadStatus.ACKNOWLEDGED],
  [LeadStatus.INVALID]: [],
};

export const STATES_REQUIRING_REASON: ReadonlySet<LeadStatus> = new Set([
  LeadStatus.LOST,
  LeadStatus.CANCELLED,
  LeadStatus.INVALID,
]);

/**
 * Generates a unique, non-guessable Lead ID: LGT-YYYYMMDD-XXXXXXXX
 */
export function generateLeadId(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `LGT-${yyyy}${mm}${dd}-${randomHex}`;
}

/**
 * Formats an ISO UTC timestamp into Africa/Nairobi local time (EAT, UTC+3).
 */
export function formatNairobiTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '—';
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date) + ' EAT';
}

/**
 * Normalizes Kenyan and international telephone numbers to E.164 format (+254...).
 * Returns null if the phone number is invalid.
 */
export function normalizeKenyanPhone(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const stripped = rawPhone.replace(/[\s\-().]/g, '');

  // Kenyan mobile or landline formats:
  // 07XXXXXXXX or 01XXXXXXXX -> +2547XXXXXXXX / +2541XXXXXXXX
  if (/^0[17]\d{8}$/.test(stripped)) {
    return '+254' + stripped.slice(1);
  }
  // 2547XXXXXXXX or 2541XXXXXXXX -> +254...
  if (/^254[17]\d{8}$/.test(stripped)) {
    return '+' + stripped;
  }
  // +2547XXXXXXXX or +2541XXXXXXXX
  if (/^\+254[17]\d{8}$/.test(stripped)) {
    return stripped;
  }
  // Nairobi landline e.g. 020XXXXXXX -> +25420XXXXXXX
  if (/^020\d{7}$/.test(stripped)) {
    return '+254' + stripped.slice(1);
  }
  // International E.164 fallback for visitors/diplomats in Lang'ata/Karen (+ followed by 9-15 digits)
  if (/^\+[1-9]\d{8,14}$/.test(stripped)) {
    return stripped;
  }
  return null;
}

/**
 * Sanitizes plain text input by stripping HTML tags and control characters.
 */
export function sanitizePlainText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Computes a deterministic duplicate fingerprint for duplicate-submission protection.
 */
export function computeDuplicateFingerprint(
  phoneNormalized: string,
  requestedServiceSlug: string,
  symptomsDescription: string
): string {
  const normalizedSymptomKey = symptomsDescription
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 80);
  const payload = `${phoneNormalized}|${requestedServiceSlug.toLowerCase()}|${normalizedSymptomKey}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

/**
 * Workflow 1: Intake Normalisation and Server-Side Validation
 */
export function validateEnquiryInput(
  input: EnquirySubmissionInput,
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): ValidationResult {
  const errors: string[] = [];

  // Spam honeypot check
  if (input.honeypotWebsite && input.honeypotWebsite.trim().length > 0) {
    return { valid: false, errors: ['Spam submission rejected.'] };
  }

  const customerName = sanitizePlainText(input.customerName, 80);
  if (customerName.length < 2) {
    errors.push('Customer name must be at least 2 characters.');
  }

  const phoneRaw = sanitizePlainText(input.phone, 30);
  const phoneNormalized = normalizeKenyanPhone(phoneRaw);
  if (!phoneNormalized) {
    errors.push('Enter a valid Kenyan telephone number (e.g., 0712 345 678 or +254 712 345 678).');
  }

  const requestedServiceSlug = sanitizePlainText(input.requestedServiceSlug, 60) || 'diagnostics';
  const matchedService = config.services.find((s) => s.slug === requestedServiceSlug);
  const requestedServiceTitle = matchedService
    ? matchedService.title
    : 'General Mechanical Inspection & Diagnostics';

  const symptomsDescription = sanitizePlainText(input.symptomsDescription, 1200);
  if (symptomsDescription.length < 8) {
    errors.push('Please describe the vehicle symptoms or service needed (at least 8 characters).');
  }

  const locationArea = sanitizePlainText(input.locationArea, 120);
  if (locationArea.length < 3) {
    errors.push('Please specify your current location or area (e.g., Lang\'ata Road, Hardy, Otiende).');
  }

  if (input.consentGranted !== true) {
    errors.push('Please confirm consent to record your contact and vehicle enquiry details.');
  }

  const validChannels = Object.values(PreferredChannel);
  const preferredChannel = validChannels.includes(input.preferredChannel as PreferredChannel)
    ? (input.preferredChannel as PreferredChannel)
    : PreferredChannel.WHATSAPP;

  const validUrgencies = Object.values(UrgencyLevel);
  const urgency = validUrgencies.includes(input.urgency as UrgencyLevel)
    ? (input.urgency as UrgencyLevel)
    : UrgencyLevel.STANDARD;

  const vehicleMakeModel = sanitizePlainText(input.vehicleMakeModel || '', 80);
  const vehicleRegistration = sanitizePlainText(input.vehicleRegistration || '', 20).toUpperCase();

  const safetyFlags = Array.isArray(input.safetyFlags)
    ? input.safetyFlags.map((f) => sanitizePlainText(f, 60)).filter(Boolean).slice(0, 6)
    : [];

  const validSources = Object.values(LeadSource);
  const source = validSources.includes(input.source as LeadSource)
    ? (input.source as LeadSource)
    : LeadSource.WEBSITE_FORM;

  if (errors.length > 0 || !phoneNormalized) {
    return { valid: false, errors };
  }

  const duplicateFingerprint = computeDuplicateFingerprint(
    phoneNormalized,
    requestedServiceSlug,
    symptomsDescription
  );

  return {
    valid: true,
    errors: [],
    normalized: {
      customerName,
      phoneRaw,
      phoneNormalized,
      preferredChannel,
      vehicleMakeModel: vehicleMakeModel || 'Not specified',
      vehicleRegistration,
      requestedServiceSlug,
      requestedServiceTitle,
      symptomsDescription,
      locationArea,
      urgency,
      safetyFlags,
      source,
      landingPage: sanitizePlainText(input.landingPage || '/', 150),
      utmSource: sanitizePlainText(input.utmSource || '', 60),
      utmMedium: sanitizePlainText(input.utmMedium || '', 60),
      utmCampaign: sanitizePlainText(input.utmCampaign || '', 60),
      consentGranted: true,
      duplicateFingerprint,
    },
  };
}

/**
 * Enforces Role-Based Access Control (RBAC) for staff actions.
 */
export function canRoleTransitionState(
  role: StaffRole,
  previousState: LeadStatus,
  newState: LeadStatus
): { allowed: boolean; reason?: string } {
  if (role === StaffRole.OWNER || role === StaffRole.SECRETARY) {
    return { allowed: true };
  }

  if (role === StaffRole.MECHANIC) {
    // Mechanics can move assigned/booked jobs into IN_PROGRESS or COMPLETED
    const mechanicAllowedTargets = new Set<LeadStatus>([
      LeadStatus.IN_PROGRESS,
      LeadStatus.COMPLETED,
    ]);
    const mechanicAllowedSources = new Set<LeadStatus>([
      LeadStatus.ASSIGNED,
      LeadStatus.BOOKED,
      LeadStatus.IN_PROGRESS,
    ]);
    if (mechanicAllowedSources.has(previousState) && mechanicAllowedTargets.has(newState)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Mechanics may only transition ASSIGNED, BOOKED, or IN_PROGRESS jobs to IN_PROGRESS or COMPLETED.',
    };
  }

  return { allowed: false, reason: 'Unauthorised role.' };
}

/**
 * Validates a lead lifecycle state transition.
 */
export function validateStateTransition(params: {
  currentState: LeadStatus;
  targetState: LeadStatus;
  actorRole: StaffRole;
  reason?: string;
}): { valid: boolean; error?: string } {
  const { currentState, targetState, actorRole, reason } = params;

  if (currentState === targetState) {
    return { valid: false, error: `Lead is already in state ${currentState}.` };
  }

  const allowedTargets = ALLOWED_STATE_TRANSITIONS[currentState] || [];
  if (!allowedTargets.includes(targetState)) {
    return {
      valid: false,
      error: `Invalid state transition from ${currentState} to ${targetState}. Allowed transitions: ${
        allowedTargets.length ? allowedTargets.join(', ') : 'None (terminal state)'
      }.`,
    };
  }

  if (STATES_REQUIRING_REASON.has(targetState)) {
    const cleanReason = sanitizePlainText(reason || '', 300);
    if (cleanReason.length < 4) {
      return {
        valid: false,
        error: `A clear reason (at least 4 characters) is required when marking a lead as ${targetState}.`,
      };
    }
  }

  const rbacCheck = canRoleTransitionState(actorRole, currentState, targetState);
  if (!rbacCheck.allowed) {
    return { valid: false, error: rbacCheck.reason };
  }

  return { valid: true };
}

/**
 * Deterministic Orchestrator Engine (Workflows 2, 3, 4, 6, 7).
 * Provides fast, schema-valid operational triage without making unverified promises.
 */
export function runDeterministicOrchestrator(params: {
  leadId: string;
  customerName: string;
  vehicleMakeModel: string;
  requestedServiceSlug: string;
  requestedServiceTitle: string;
  symptomsDescription: string;
  locationArea: string;
  urgency: UrgencyLevel;
  safetyFlags: string[];
  status?: LeadStatus;
  config?: BusinessConfig;
}): OrchestratorAnalysis {
  const config = params.config || DEFAULT_BUSINESS_CONFIG;
  const lowerSymptoms = params.symptomsDescription.toLowerCase();

  // Classify urgency & safety deterministically
  let classifiedUrgency = params.urgency;
  const safetyTriggers: string[] = [...params.safetyFlags];

  if (
    lowerSymptoms.includes('brake fail') ||
    lowerSymptoms.includes('to the floor') ||
    lowerSymptoms.includes('no brakes') ||
    lowerSymptoms.includes('smoke') ||
    lowerSymptoms.includes('overheat') ||
    lowerSymptoms.includes('red zone') ||
    lowerSymptoms.includes('stalled on road') ||
    lowerSymptoms.includes('stalled in active')
  ) {
    classifiedUrgency = UrgencyLevel.SAFETY_CRITICAL;
    if (!safetyTriggers.includes('High-Risk Mechanical/Traffic Symptom')) {
      safetyTriggers.push('High-Risk Mechanical/Traffic Symptom');
    }
  } else if (
    lowerSymptoms.includes('wont start') ||
    lowerSymptoms.includes("won't start") ||
    lowerSymptoms.includes('no crank') ||
    lowerSymptoms.includes('dead battery') ||
    lowerSymptoms.includes('clicking')
  ) {
    if (classifiedUrgency === UrgencyLevel.STANDARD) {
      classifiedUrgency = UrgencyLevel.IMMOBILISED;
    }
  }

  // Classify service slug if general
  let classifiedServiceSlug = params.requestedServiceSlug;
  if (lowerSymptoms.includes('brake') || lowerSymptoms.includes('grinding') || lowerSymptoms.includes('squeal')) {
    classifiedServiceSlug = 'brake-repairs';
  } else if (lowerSymptoms.includes('battery') || lowerSymptoms.includes('alternator')) {
    classifiedServiceSlug = 'battery-problems';
  } else if (lowerSymptoms.includes('start') || lowerSymptoms.includes('crank') || lowerSymptoms.includes('click')) {
    classifiedServiceSlug = 'starting-problems';
  } else if (lowerSymptoms.includes('overheat') || lowerSymptoms.includes('coolant') || lowerSymptoms.includes('misfire')) {
    classifiedServiceSlug = 'engine-troubleshooting';
  }

  const safetyAdvisory =
    classifiedUrgency === UrgencyLevel.SAFETY_CRITICAL
      ? 'SAFETY ADVISORY: Symptoms indicate potential braking, overheating, or roadside hazard. Advise customer not to drive the vehicle until inspected or recovered safely.'
      : classifiedUrgency === UrgencyLevel.IMMOBILISED
      ? 'IMMOBILISED VEHICLE: Confirm whether vehicle is safely parked in Lang\'ata and check if mechanic bay or local jump/test slot is available.'
      : null;

  const symptomSummary = `${params.vehicleMakeModel} in ${params.locationArea} — ${params.requestedServiceTitle}: "${params.symptomsDescription.slice(0, 140)}${
    params.symptomsDescription.length > 140 ? '...' : ''
  }"`;

  const suggestedMechanicNote =
    classifiedServiceSlug === 'brake-repairs'
      ? 'Prepare hydraulic lift bay, rotor micrometre, and DOT-4 brake tester. Inspect pads, discs, and hydraulic lines before quoting.'
      : classifiedServiceSlug === 'battery-problems' || classifiedServiceSlug === 'starting-problems'
      ? 'Prepare 12V digital CCA load tester, multimeter, and starter relay/alternator ripple check.'
      : classifiedServiceSlug === 'engine-troubleshooting'
      ? 'Prepare cooling system pressure tester, OBD-II live scanner, and compression gauge.'
      : 'Prepare OBD-II diagnostic tablet and standard multi-point workshop inspection sheet.';

  const customerAcknowledgementDraft = `Hello ${params.customerName}, we have logged your enquiry (${params.leadId}) at ${config.brandShortName} for your ${params.vehicleMakeModel} (${params.requestedServiceTitle}). Our secretary is checking workshop bay availability in Lang'ata and will confirm your inspection slot shortly. Note: Final KES estimates are provided after physical inspection.`;

  const reviewRequestDraft =
    params.status === LeadStatus.COMPLETED
      ? `Hello ${params.customerName}, thank you for visiting ${config.brandShortName} in Lang'ata for your ${params.vehicleMakeModel} (${params.leadId}). If the repair is running smoothly, we would appreciate your honest feedback on our Google Business Profile.`
      : null;

  return {
    symptomSummary,
    classifiedServiceSlug,
    classifiedUrgency,
    safetyAdvisory,
    suggestedAssigneeRole: 'SECRETARY',
    suggestedMechanicNote,
    customerAcknowledgementDraft,
    reviewRequestDraft,
    generatedBy: 'DETERMINISTIC_RULES',
    generatedAtUtc: new Date().toISOString(),
  };
}

export interface OperationalAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING';
  category:
    | 'UNACKNOWLEDGED_SLA'
    | 'QUALIFIED_UNASSIGNED'
    | 'OVERDUE_FOLLOWUP'
    | 'BOOKING_MISSING_OUTCOME'
    | 'NOTIFICATION_FAILURE'
    | 'STALE_OPEN_LEAD';
  leadId: string;
  customerName: string;
  title: string;
  detail: string;
}

/**
 * Workflow 5, 9 & 10: Computes operational leakage alerts and SLA exceptions.
 */
export function computeOperationalAlerts(
  leads: LeadRecord[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  now: Date = new Date()
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const nowMs = now.getTime();
  const ackTargetMs = config.internalTargets.acknowledgeTargetMinutes * 60 * 1000;
  const staleTargetMs = config.internalTargets.staleLeadHours * 60 * 60 * 1000;

  const terminalStates = new Set<LeadStatus>([
    LeadStatus.COMPLETED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
    LeadStatus.INVALID,
  ]);

  for (const lead of leads) {
    const createdMs = new Date(lead.createdAtUtc).getTime();
    const ageMs = nowMs - createdMs;
    const ageMinutes = Math.max(1, Math.round(ageMs / 60000));

    // 1. New enquiries not acknowledged within target
    if (lead.status === LeadStatus.NEW && ageMs > ackTargetMs) {
      alerts.push({
        id: `alert-unack-${lead.leadId}`,
        severity: 'CRITICAL',
        category: 'UNACKNOWLEDGED_SLA',
        leadId: lead.leadId,
        customerName: lead.customerName,
        title: `Unacknowledged Enquiry (${ageMinutes}m elapsed)`,
        detail: `${lead.leadId} (${lead.requestedServiceTitle}) has been in NEW status for ${ageMinutes} minutes (internal target: ${config.internalTargets.acknowledgeTargetMinutes}m).`,
      });
    }

    // 2. Qualified enquiries not assigned
    if (lead.status === LeadStatus.QUALIFIED && !lead.assignedStaffName) {
      alerts.push({
        id: `alert-unassigned-${lead.leadId}`,
        severity: 'WARNING',
        category: 'QUALIFIED_UNASSIGNED',
        leadId: lead.leadId,
        customerName: lead.customerName,
        title: `Qualified Lead Awaiting Mechanic Assignment`,
        detail: `${lead.leadId} (${lead.vehicleMakeModel}) is QUALIFIED but has no assigned mechanic.`,
      });
    }

    // 3. Missed follow-up deadlines
    if (!terminalStates.has(lead.status) && lead.nextFollowUpAtUtc) {
      const followUpMs = new Date(lead.nextFollowUpAtUtc).getTime();
      if (nowMs > followUpMs) {
        const overdueMins = Math.max(1, Math.round((nowMs - followUpMs) / 60000));
        alerts.push({
          id: `alert-followup-${lead.leadId}`,
          severity: 'CRITICAL',
          category: 'OVERDUE_FOLLOWUP',
          leadId: lead.leadId,
          customerName: lead.customerName,
          title: `Overdue Follow-Up (${overdueMins}m overdue)`,
          detail: `Follow-up deadline for ${lead.leadId} passed at ${formatNairobiTime(lead.nextFollowUpAtUtc)}.`,
        });
      }
    }

    // 4. Bookings without a recorded outcome
    if (
      (lead.status === LeadStatus.BOOKED || lead.status === LeadStatus.IN_PROGRESS) &&
      !lead.outcomeSummary
    ) {
      if (lead.bookingDateTimeLocal) {
        const bookedMs = new Date(lead.bookingDateTimeLocal).getTime();
        if (!Number.isNaN(bookedMs) && nowMs > bookedMs + 4 * 3600 * 1000) {
          alerts.push({
            id: `alert-outcome-${lead.leadId}`,
            severity: 'WARNING',
            category: 'BOOKING_MISSING_OUTCOME',
            leadId: lead.leadId,
            customerName: lead.customerName,
            title: `Booked Job Missing Recorded Outcome`,
            detail: `${lead.leadId} booked for ${formatNairobiTime(lead.bookingDateTimeLocal)} has no recorded completion or loss outcome.`,
          });
        }
      }
    }

    // 5. Notification failure escalation
    if (
      lead.notificationStatus === 'FAILED_RETRYABLE' ||
      lead.notificationStatus === 'ESCALATED_OWNER'
    ) {
      alerts.push({
        id: `alert-notif-${lead.leadId}`,
        severity: 'CRITICAL',
        category: 'NOTIFICATION_FAILURE',
        leadId: lead.leadId,
        customerName: lead.customerName,
        title: `Secretary Notification Delivery Failed`,
        detail: `Automated alert for ${lead.leadId} failed (${lead.notificationDetail}). Use manual WhatsApp/Call action immediately.`,
      });
    }

    // 6. Leads remaining open beyond configurable period
    if (!terminalStates.has(lead.status) && ageMs > staleTargetMs) {
      const ageHours = Math.round(ageMs / 3600000);
      alerts.push({
        id: `alert-stale-${lead.leadId}`,
        severity: 'WARNING',
        category: 'STALE_OPEN_LEAD',
        leadId: lead.leadId,
        customerName: lead.customerName,
        title: `Open Lead Exceeds ${config.internalTargets.staleLeadHours}h Threshold (${ageHours}h open)`,
        detail: `${lead.leadId} is still in ${lead.status} after ${ageHours} hours without final resolution.`,
      });
    }
  }

  return alerts;
}

export interface DashboardMetrics {
  totalLeads: number;
  newAwaitingAck: number;
  qualifiedAwaitingAssignment: number;
  overdueFollowUps: number;
  leadsWithoutOutcome: number;
  activeBookingsAndInProgress: number;
  completedJobs: number;
  lostOrCancelledJobs: number;
  medianTimeToFirstContactMinutes: number | null;
  conversionBySource: { source: string; total: number; bookedOrCompleted: number; ratePercent: number }[];
  conversionByService: { serviceTitle: string; total: number; bookedOrCompleted: number; ratePercent: number }[];
}

export function computeDashboardMetrics(leads: LeadRecord[], now: Date = new Date()): DashboardMetrics {
  const nowMs = now.getTime();
  const terminalStates = new Set<LeadStatus>([
    LeadStatus.COMPLETED,
    LeadStatus.LOST,
    LeadStatus.CANCELLED,
    LeadStatus.INVALID,
  ]);
  const convertedStates = new Set<LeadStatus>([
    LeadStatus.BOOKED,
    LeadStatus.IN_PROGRESS,
    LeadStatus.COMPLETED,
  ]);

  let newAwaitingAck = 0;
  let qualifiedAwaitingAssignment = 0;
  let overdueFollowUps = 0;
  let leadsWithoutOutcome = 0;
  let activeBookingsAndInProgress = 0;
  let completedJobs = 0;
  let lostOrCancelledJobs = 0;

  const firstContactDeltasMinutes: number[] = [];
  const sourceMap = new Map<string, { total: number; converted: number }>();
  const serviceMap = new Map<string, { total: number; converted: number }>();

  for (const lead of leads) {
    if (lead.status === LeadStatus.NEW) newAwaitingAck++;
    if (lead.status === LeadStatus.QUALIFIED && !lead.assignedStaffName) qualifiedAwaitingAssignment++;
    if (
      !terminalStates.has(lead.status) &&
      lead.nextFollowUpAtUtc &&
      nowMs > new Date(lead.nextFollowUpAtUtc).getTime()
    ) {
      overdueFollowUps++;
    }
    if (!terminalStates.has(lead.status) && !lead.outcomeSummary) {
      leadsWithoutOutcome++;
    }
    if (lead.status === LeadStatus.BOOKED || lead.status === LeadStatus.IN_PROGRESS) {
      activeBookingsAndInProgress++;
    }
    if (lead.status === LeadStatus.COMPLETED) completedJobs++;
    if (lead.status === LeadStatus.LOST || lead.status === LeadStatus.CANCELLED) {
      lostOrCancelledJobs++;
    }

    if (lead.lastContactAtUtc) {
      const createdMs = new Date(lead.createdAtUtc).getTime();
      const contactMs = new Date(lead.lastContactAtUtc).getTime();
      if (contactMs >= createdMs) {
        firstContactDeltasMinutes.push(Math.round((contactMs - createdMs) / 60000));
      }
    }

    // Conversion by source
    const srcEntry = sourceMap.get(lead.source) || { total: 0, converted: 0 };
    srcEntry.total++;
    if (convertedStates.has(lead.status)) srcEntry.converted++;
    sourceMap.set(lead.source, srcEntry);

    // Conversion by service
    const svcEntry = serviceMap.get(lead.requestedServiceTitle) || { total: 0, converted: 0 };
    svcEntry.total++;
    if (convertedStates.has(lead.status)) svcEntry.converted++;
    serviceMap.set(lead.requestedServiceTitle, svcEntry);
  }

  let medianTimeToFirstContactMinutes: number | null = null;
  if (firstContactDeltasMinutes.length > 0) {
    firstContactDeltasMinutes.sort((a, b) => a - b);
    const mid = Math.floor(firstContactDeltasMinutes.length / 2);
    medianTimeToFirstContactMinutes =
      firstContactDeltasMinutes.length % 2 !== 0
        ? firstContactDeltasMinutes[mid]
        : Math.round((firstContactDeltasMinutes[mid - 1] + firstContactDeltasMinutes[mid]) / 2);
  }

  const conversionBySource = Array.from(sourceMap.entries()).map(([source, stats]) => ({
    source,
    total: stats.total,
    bookedOrCompleted: stats.converted,
    ratePercent: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
  }));

  const conversionByService = Array.from(serviceMap.entries()).map(([serviceTitle, stats]) => ({
    serviceTitle,
    total: stats.total,
    bookedOrCompleted: stats.converted,
    ratePercent: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
  }));

  return {
    totalLeads: leads.length,
    newAwaitingAck,
    qualifiedAwaitingAssignment,
    overdueFollowUps,
    leadsWithoutOutcome,
    activeBookingsAndInProgress,
    completedJobs,
    lostOrCancelledJobs,
    medianTimeToFirstContactMinutes,
    conversionBySource,
    conversionByService,
  };
}
