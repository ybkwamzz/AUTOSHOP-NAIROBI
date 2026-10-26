import React, { useState } from 'react';
import { BusinessConfig } from '../config/businessConfig';

interface HandoverDocsViewProps {
  config: BusinessConfig;
  systemStatus: {
    persistenceEngine: string;
    postgresConfigured: boolean;
    automatedWebhookConfigured: boolean;
    geminiConfigured: boolean;
    serverTimeUtc: string;
    serverTimeNairobi: string;
  } | null;
  onNavigateToStaff: () => void;
  onNavigateToWebsite: () => void;
}

export const HandoverDocsView: React.FC<HandoverDocsViewProps> = ({
  config,
  systemStatus,
  onNavigateToStaff,
  onNavigateToWebsite,
}) => {
  const [activeDocTab, setActiveDocTab] = useState<'secretary_sop' | 'owner_report' | 'dns_seo'>('secretary_sop');

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wide">
            Lang&apos;ata Automotive Operations · Documentation &amp; Handover
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Secretary Operating Procedure &amp; Owner Handover Report
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">
            Designed so the founder does not need to operate the codebase day-to-day. Use the tabs below for the one-page Secretary SOP, the Owner Operational &amp; Architecture Report, and the Domain/DNS/Local SEO Setup Checklist.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateToStaff}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Open Staff Ledger
          </button>
          <button
            type="button"
            onClick={onNavigateToWebsite}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            View Customer Site
          </button>
        </div>
      </div>

      {/* Interactive Tab Selector */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveDocTab('secretary_sop')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeDocTab === 'secretary_sop'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          01. Secretary 1-Page SOP
        </button>
        <button
          type="button"
          onClick={() => setActiveDocTab('owner_report')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeDocTab === 'owner_report'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          02. Owner Handover &amp; Architecture Report
        </button>
        <button
          type="button"
          onClick={() => setActiveDocTab('dns_seo')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeDocTab === 'dns_seo'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          03. Domain, DNS, SEO &amp; Rollback Guide
        </button>
      </div>

      {activeDocTab === 'secretary_sop' && (
        <section
          aria-label="Secretary One-Page Operating Procedure"
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8"
        >
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                One-Page Daily Operating Procedure — Workshop Secretary
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Internal Operating Target: Acknowledge new enquiries within{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {config.internalTargets.acknowledgeTargetMinutes} minutes
                </span>{' '}
                during staffed hours ({config.operatingHours}).
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start"
            >
              Print SOP Page
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                1. Where New Enquiries Appear
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Open the <strong>Staff Ledger</strong> and sign in with the <strong>SECRETARY</strong> role. All website enquiries appear immediately at the top of the queue in <code>NEW</code> status with a unique Lead ID (<code>LGT-YYYYMMDD-XXXX</code>) and an automatic symptom summary.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                2. How to Acknowledge &amp; Qualify Enquiries
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Click <strong>Inspect &amp; Update</strong> on any <code>NEW</code> lead. Contact the customer via their preferred channel (Phone Call or the 1-click prefilled WhatsApp button). Confirm their exact location in Lang&apos;ata, vehicle make/model, and whether the vehicle is drivable. Move the status from <code>NEW</code> to <code>ACKNOWLEDGED</code> or <code>QUALIFIED</code> (or <code>CONTACT_ATTEMPTED</code> if unanswered).
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                3. How to Assign a Job to the Mechanic
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Once the customer confirms they want an inspection or bay slot, check with the Lead Mechanic for bay readiness. In the Lead Detail Drawer, enter the Mechanic&apos;s name under <strong>Assigned Staff Member</strong>, add bay preparation notes, and transition the status to <code>ASSIGNED</code> or <code>BOOKED</code>.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                4. How to Schedule &amp; Complete Follow-Ups
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every active lead has a <strong>Next Follow-Up Deadline</strong>. If a customer says &ldquo;call me back in 1 hour&rdquo; or does not answer, set the Next Follow-Up time in the Lead Drawer and save. Overdue follow-ups trigger a red alert banner at the top of the dashboard until contacted.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                5. How to Record Bookings &amp; Outcomes
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When a vehicle is booked for arrival, set status to <code>BOOKED</code> and enter the <strong>Booking Date/Time</strong>. When work begins, the Mechanic or Secretary marks it <code>IN_PROGRESS</code>. When finished, mark <code>COMPLETED</code> and write the work summary under <strong>Outcome Summary</strong>. If a lead does not proceed, mark <code>LOST</code>, <code>CANCELLED</code>, or <code>INVALID</code>—the system requires a mandatory reason so the Owner can see why jobs were lost.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                6. How to Log Direct Calls &amp; WhatsApp Leads
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Many customers call or WhatsApp directly without filling the website form. Click <strong>Log Call / WhatsApp Lead</strong> at the top of the Staff Ledger, select <code>PHONE_CALL_LOGGED</code>, <code>WHATSAPP_LOGGED</code>, or <code>WALK_IN_LOGGED</code>, and save. Takes under 25 seconds and prevents unrecorded workshop jobs.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                7. How to Escalate Urgent or Overdue Cases
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Leads flagged <code>SAFETY_CRITICAL</code> (brake failure, overheating, stalled in traffic on Lang&apos;ata Road) display a safety warning banner. Never advise a customer to drive a vehicle with failed brakes or red-zone overheating. Alert the Lead Mechanic immediately or advise safe flatbed recovery.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                8. Daily End-of-Shift Lead Ledger Reconciliation
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Before closing at 18:00 EAT, open the <strong>Daily Reconciliation</strong> tab in the Staff Ledger. Count the day&apos;s inbound calls on the workshop phone and chats on WhatsApp, log any missing enquiries, verify zero leads remain in <code>NEW</code> status without contact, and submit the daily sign-off record.
              </p>
            </div>
          </div>
        </section>
      )}

      {activeDocTab === 'owner_report' && (
        <section
          aria-label="Owner Handover and Technical Status Report"
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8"
        >
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Owner Handover Report — Lang&apos;ata Automotive Operation
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Truthful operational summary of what is built, tested, persisted, and what requires founder configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                1. Reference Repository Inspection &amp; Architecture Map
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                We inspected <code>github.com/ybkwamzz/Aircounsel-site</code> before writing code. AirCounsel is a static HTML/CSS/JS intake funnel (<code>index.html</code>, <code>intake.html</code>, <code>Embed.js</code>, <code>sitemap.xml</code>, <code>robots.txt</code>) with responsive <code>clamp()</code> typography and structured intake steps, and contained zero exposed secret keys. We reused its clean editorial numbering, friction-free intake philosophy, and SEO sitemap/robots conventions while building an isolated full-stack TypeScript + Express + SQLite WAL application specifically for Lang&apos;ata automotive operations.
              </p>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                2. Database &amp; Persistence Status
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Active Engine:{' '}
                <strong className="font-mono text-slate-900">
                  {systemStatus?.persistenceEngine || 'SQLite Persistent WAL Ledger (./data/langata_leads.sqlite)'}
                </strong>
                . Every website enquiry is validated and committed synchronously inside an ACID transaction with an initial audit record before returning HTTP 201 to the browser. External PostgreSQL status:{' '}
                <span className="font-mono">
                  {systemStatus?.postgresConfigured ? 'Configured via DATABASE_URL' : 'Not configured (using local SQLite WAL file)'}
                </span>
                . Note: When deploying to stateless container hosts that wipe local disk on container redeploy, mount a persistent volume to <code>./data</code> or supply a managed PostgreSQL <code>DATABASE_URL</code>.
              </p>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                3. Notification &amp; Orchestrator Status
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automated Webhook Status:{' '}
                <strong className="font-mono text-slate-900">
                  {systemStatus?.automatedWebhookConfigured
                    ? 'Active (NOTIFICATION_WEBHOOK_URL set)'
                    : 'Unconfigured — Manual WhatsApp Queue Active'}
                </strong>
                . Because WhatsApp Business API / SMTP credentials are not yet attached, the system truthfully marks notifications as <code>PENDING_MANUAL_OR_UNCONFIGURED</code> and provides 1-click prefilled WhatsApp dispatch in the Staff Ledger. The 10 orchestrator workflows run deterministically with bounded server-side Gemini schema enhancement when <code>GEMINI_API_KEY</code> has quota.
              </p>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                4. Exact Founder Actions Required (5-Minute Setup)
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  Log into the <strong>Staff Ledger</strong> as <strong>OWNER</strong> (default code: <code>langata-owner-2026</code>) and open the <strong>Business Config</strong> tab.
                </li>
                <li>
                  Replace the <code>[PLACEHOLDER]</code> workshop name, exact plot/landmark on Lang&apos;ata Road, actual Mechanic phone number, Secretary phone number, WhatsApp number, and confirmed operating hours.
                </li>
                <li>
                  Change default staff access codes in production environment variables (<code>OWNER_ACCESS_CODE</code>, <code>SECRETARY_ACCESS_CODE</code>, <code>MECHANIC_ACCESS_CODE</code>, <code>SESSION_SECRET</code>).
                </li>
                <li>
                  (Optional) Set <code>NOTIFICATION_WEBHOOK_URL</code> to receive instant Slack/Email/WhatsApp Business webhook alerts on new enquiries.
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                5. Known Limitations &amp; Operational Risks
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Direct Phone &amp; WhatsApp Leakage:</strong> Website clicks on <code>tel:</code> or <code>wa.me</code> links do not prove a conversation happened. The Secretary must complete the built-in Daily Reconciliation routine at 18:00 EAT each day.
                </li>
                <li>
                  <strong>Container Redeploy Storage:</strong> Local SQLite (<code>./data/langata_leads.sqlite</code>) persists across process restarts inside this container, but full Cloud Run image rebuilds require either regular CSV exports / SQLite backups or attaching a persistent volume / Cloud SQL instance.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                6. Estimated Ongoing Operating Costs
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 tabular-nums">
                <li>
                  <strong>Custom Domain (.co.ke or .com):</strong> ~KES 1,200 – 2,500 / year via KENIC registrar or Cloudflare.
                </li>
                <li>
                  <strong>Cloud Run / Container Hosting:</strong> Scale-to-zero tier (~USD 0 – $5 / month at typical local workshop traffic).
                </li>
                <li>
                  <strong>Gemini 3.8 Flash Intake Triage:</strong> Free tier / pennies per 1,000 enquiries (with zero-cost deterministic fallback always active).
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {activeDocTab === 'dns_seo' && (
        <section
          aria-label="Domain, DNS, Local SEO and Rollback Guide"
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Custom Domain DNS Configuration, Local SEO &amp; Database Backup / Rollback
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Ready for custom domain mapping as soon as the founder selects and registers the brand domain.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              1. Required DNS Records (Cloud Run Custom Domain Mapping)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Host / Name</th>
                    <th className="py-2.5 px-4">Value / Target</th>
                    <th className="py-2.5 px-4">TTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="py-2 px-4 font-bold">A</td>
                    <td className="py-2 px-4">@</td>
                    <td className="py-2 px-4">216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21</td>
                    <td className="py-2 px-4">3600</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">AAAA</td>
                    <td className="py-2 px-4">@</td>
                    <td className="py-2 px-4">2001:4860:4802:32::15 (and :34::15, :36::15, :38::15)</td>
                    <td className="py-2 px-4">3600</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">CNAME</td>
                    <td className="py-2 px-4">www</td>
                    <td className="py-2 px-4">ghs.googlehosted.com.</td>
                    <td className="py-2 px-4">3600</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">TXT</td>
                    <td className="py-2 px-4">@</td>
                    <td className="py-2 px-4">google-site-verification=&lt;TOKEN_FROM_SEARCH_CONSOLE&gt;</td>
                    <td className="py-2 px-4">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                2. Google Business Profile &amp; Search Console Checklist (Lang&apos;ata)
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  Claim/Create Google Business Profile with primary category <code>Auto Repair Shop</code> and secondary categories <code>Mechanic</code>, <code>Brake Shop</code>, and <code>Auto Electrical Service</code>.
                </li>
                <li>
                  Ensure Name, Address, and Phone (NAP) in the <strong>Business Config</strong> tab match the Google Business Profile character-for-character.
                </li>
                <li>
                  Submit <code>/sitemap.xml</code> in Google Search Console after verifying domain ownership via the DNS TXT record above.
                </li>
                <li>
                  Use the <strong>Review Request Draft</strong> generated automatically on <code>COMPLETED</code> leads to request genuine customer reviews.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                3. Database Backup, Privacy Redaction &amp; Rollback Procedure
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Daily CSV Backup:</strong> The Owner or Secretary can download a complete timestamped CSV snapshot via <code>GET /api/staff/export.csv</code> (Export CSV button in the Staff Ledger).
                </li>
                <li>
                  <strong>SQLite Hot Backup:</strong> Copy <code>./data/langata_leads.sqlite</code> using <code>sqlite3 data/langata_leads.sqlite &quot;.backup backup.sqlite&quot;</code> before any schema migration.
                </li>
                <li>
                  <strong>Data Deletion / Redaction:</strong> In the Lead Detail Drawer, the Owner can execute <strong>Redact Personal Data</strong>, which scrubs customer name, phone, and registration while preserving anonymised operational counts and audit history.
                </li>
                <li>
                  <strong>Rollback Procedure:</strong> Revert to the previous container revision in Cloud Run or restore <code>business_config_store</code> defaults from <code>src/config/businessConfig.ts</code>.
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
