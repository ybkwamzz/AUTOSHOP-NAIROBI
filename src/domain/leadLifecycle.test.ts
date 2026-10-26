import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LeadStatus,
  StaffRole,
  UrgencyLevel,
  PreferredChannel,
  LeadSource,
  generateLeadId,
  normalizeKenyanPhone,
  validateEnquiryInput,
  computeDuplicateFingerprint,
  validateStateTransition,
  runDeterministicOrchestrator,
  computeOperationalAlerts,
  computeDashboardMetrics,
  LeadRecord,
} from './leadLifecycle';

test('generateLeadId produces unique non-guessable LGT-YYYYMMDD-XXXXXXXX identifier', () => {
  const id1 = generateLeadId(new Date('2026-10-26T10:00:00Z'));
  const id2 = generateLeadId(new Date('2026-10-26T10:00:00Z'));
  assert.match(id1, /^LGT-20261026-[0-9A-F]{8}$/);
  assert.notEqual(id1, id2);
});

test('normalizeKenyanPhone normalizes valid Kenyan numbers and rejects invalid strings', () => {
  assert.equal(normalizeKenyanPhone('0712 345 678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('0110-222-333'), '+254110222333');
  assert.equal(normalizeKenyanPhone('254722111222'), '+254722111222');
  assert.equal(normalizeKenyanPhone('+254 733 999 000'), '+254733999000');
  assert.equal(normalizeKenyanPhone('invalid-phone'), null);
  assert.equal(normalizeKenyanPhone('12345'), null);
});

test('validateEnquiryInput enforces required fields, consent, honeypot, and normalizes data', () => {
  const validSubmission = validateEnquiryInput({
    customerName: 'David Kamau',
    phone: '0722 123 456',
    preferredChannel: PreferredChannel.WHATSAPP,
    vehicleMakeModel: 'Subaru Forester XT',
    requestedServiceSlug: 'brake-repairs',
    symptomsDescription: 'Grinding noise from front left wheel when braking near Otiende.',
    locationArea: "Lang'ata Otiende",
    urgency: UrgencyLevel.URGENT_TODAY,
    consentGranted: true,
  });

  assert.equal(validSubmission.valid, true);
  assert.equal(validSubmission.normalized?.phoneNormalized, '+254722123456');
  assert.equal(validSubmission.normalized?.requestedServiceTitle, 'Brake Pads, Discs, Hydraulics & ABS Servicing');

  // Missing consent must fail
  const noConsent = validateEnquiryInput({
    customerName: 'David Kamau',
    phone: '0722 123 456',
    requestedServiceSlug: 'brake-repairs',
    symptomsDescription: 'Grinding noise from front left wheel.',
    locationArea: "Lang'ata",
    consentGranted: false,
  });
  assert.equal(noConsent.valid, false);
  assert.ok(noConsent.errors.some((e) => e.toLowerCase().includes('consent')));

  // Honeypot filled must fail
  const spamAttempt = validateEnquiryInput({
    customerName: 'Spam Bot',
    phone: '0722 123 456',
    requestedServiceSlug: 'diagnostics',
    symptomsDescription: 'Valid length description here',
    locationArea: "Lang'ata",
    consentGranted: true,
    honeypotWebsite: 'https://spam.example.com',
  });
  assert.equal(spamAttempt.valid, false);
});

test('computeDuplicateFingerprint generates identical hash for identical normalized enquiry', () => {
  const fp1 = computeDuplicateFingerprint('+254722123456', 'battery-problems', 'Car wont start clicking noise!');
  const fp2 = computeDuplicateFingerprint('+254722123456', 'battery-problems', 'car wont start, clicking noise');
  assert.equal(fp1, fp2);
});

test('validateStateTransition enforces valid edges, required reason for LOST/CANCELLED/INVALID, and RBAC', () => {
  // Valid NEW -> ACKNOWLEDGED by SECRETARY
  const ack = validateStateTransition({
    currentState: LeadStatus.NEW,
    targetState: LeadStatus.ACKNOWLEDGED,
    actorRole: StaffRole.SECRETARY,
  });
  assert.equal(ack.valid, true);

  // Invalid jump NEW -> COMPLETED
  const invalidJump = validateStateTransition({
    currentState: LeadStatus.NEW,
    targetState: LeadStatus.COMPLETED,
    actorRole: StaffRole.OWNER,
  });
  assert.equal(invalidJump.valid, false);

  // Transition to LOST without reason must fail
  const lostWithoutReason = validateStateTransition({
    currentState: LeadStatus.QUALIFIED,
    targetState: LeadStatus.LOST,
    actorRole: StaffRole.SECRETARY,
    reason: '',
  });
  assert.equal(lostWithoutReason.valid, false);

  // Transition to LOST with reason succeeds
  const lostWithReason = validateStateTransition({
    currentState: LeadStatus.QUALIFIED,
    targetState: LeadStatus.LOST,
    actorRole: StaffRole.SECRETARY,
    reason: 'Customer towed vehicle to dealer under warranty',
  });
  assert.equal(lostWithReason.valid, true);

  // Mechanic cannot mark a NEW lead as INVALID
  const mechanicRbac = validateStateTransition({
    currentState: LeadStatus.NEW,
    targetState: LeadStatus.INVALID,
    actorRole: StaffRole.MECHANIC,
    reason: 'Wrong number',
  });
  assert.equal(mechanicRbac.valid, false);

  // Mechanic can mark ASSIGNED lead as IN_PROGRESS
  const mechanicProgress = validateStateTransition({
    currentState: LeadStatus.ASSIGNED,
    targetState: LeadStatus.IN_PROGRESS,
    actorRole: StaffRole.MECHANIC,
  });
  assert.equal(mechanicProgress.valid, true);
});

test('runDeterministicOrchestrator flags safety-critical symptoms and avoids promising fixed prices', () => {
  const analysis = runDeterministicOrchestrator({
    leadId: 'LGT-20261026-AABBCCDD',
    customerName: 'Grace Wanjiku',
    vehicleMakeModel: 'Toyota Prado',
    requestedServiceSlug: 'brake-repairs',
    requestedServiceTitle: 'Brake Pads, Discs, Hydraulics & ABS Servicing',
    symptomsDescription: 'Brake pedal goes to the floor and red warning light is on near Wilson Airport.',
    locationArea: 'Lang\'ata Road / Wilson',
    urgency: UrgencyLevel.URGENT_TODAY,
    safetyFlags: [],
  });

  assert.equal(analysis.classifiedUrgency, UrgencyLevel.SAFETY_CRITICAL);
  assert.ok(analysis.safetyAdvisory?.includes('SAFETY ADVISORY'));
  assert.ok(analysis.customerAcknowledgementDraft.includes('LGT-20261026-AABBCCDD'));
  assert.ok(analysis.customerAcknowledgementDraft.includes('after physical inspection'));
});

test('computeOperationalAlerts and computeDashboardMetrics detect unacknowledged leads and calculate conversion', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const tenMinutesAgo = new Date('2026-10-26T11:50:00Z').toISOString();
  const fiveMinutesAgo = new Date('2026-10-26T11:55:00Z').toISOString();

  const sampleLeads: LeadRecord[] = [
    {
      leadId: 'LGT-20261026-11112222',
      createdAtUtc: tenMinutesAgo,
      updatedAtUtc: tenMinutesAgo,
      customerName: 'John Otieno',
      phoneRaw: '0711222333',
      phoneNormalized: '+254711222333',
      preferredChannel: PreferredChannel.WHATSAPP,
      vehicleMakeModel: 'Mazda CX-5',
      vehicleRegistration: 'KDD 123A',
      requestedServiceSlug: 'diagnostics',
      requestedServiceTitle: 'Computerised OBD-II & Electrical Diagnostics',
      symptomsDescription: 'Check engine light blinking on Langata Road',
      locationArea: "Lang'ata",
      urgency: UrgencyLevel.URGENT_TODAY,
      safetyFlags: [],
      source: LeadSource.WEBSITE_FORM,
      landingPage: '/',
      utmSource: 'google',
      utmMedium: 'organic',
      utmCampaign: '',
      assignedStaffName: '',
      assignedStaffRole: '',
      status: LeadStatus.NEW,
      lastContactAtUtc: null,
      nextFollowUpAtUtc: fiveMinutesAgo,
      bookingDateTimeLocal: null,
      bookingBayNotes: '',
      outcomeSummary: '',
      lossOrCancelReason: '',
      duplicateFingerprint: 'fp1',
      consentGranted: true,
      isRedacted: false,
      orchestratorAnalysis: runDeterministicOrchestrator({
        leadId: 'LGT-20261026-11112222',
        customerName: 'John Otieno',
        vehicleMakeModel: 'Mazda CX-5',
        requestedServiceSlug: 'diagnostics',
        requestedServiceTitle: 'Computerised OBD-II & Electrical Diagnostics',
        symptomsDescription: 'Check engine light blinking on Langata Road',
        locationArea: "Lang'ata",
        urgency: UrgencyLevel.URGENT_TODAY,
        safetyFlags: [],
      }),
      notificationStatus: 'PENDING_MANUAL_OR_UNCONFIGURED',
      notificationDetail: 'Logged to manual WhatsApp queue',
    },
  ];

  const alerts = computeOperationalAlerts(sampleLeads, undefined, now);
  assert.ok(alerts.some((a) => a.category === 'UNACKNOWLEDGED_SLA'));
  assert.ok(alerts.some((a) => a.category === 'OVERDUE_FOLLOWUP'));

  const metrics = computeDashboardMetrics(sampleLeads, now);
  assert.equal(metrics.totalLeads, 1);
  assert.equal(metrics.newAwaitingAck, 1);
  assert.equal(metrics.overdueFollowUps, 1);
});
