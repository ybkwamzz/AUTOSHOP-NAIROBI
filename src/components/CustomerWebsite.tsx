import React, { useState, useEffect } from 'react';
import { BusinessConfig, ServiceCapability } from '../config/businessConfig';
import { PreferredChannel, UrgencyLevel } from '../domain/leadLifecycle';
import {
  Phone,
  MessageSquare,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface CustomerWebsiteProps {
  config: BusinessConfig;
  initialServiceSlug: string | null;
  onSelectServiceSlug: (slug: string | null) => void;
  onOpenStaffPortal: () => void;
  onOpenHandoverDocs: () => void;
}

interface SubmissionConfirmation {
  duplicatePrevented: boolean;
  leadId: string;
  createdAtUtc: string;
  createdAtNairobi: string;
  status: string;
  requestedServiceTitle: string;
  preferredChannel: string;
  notificationStatus: string;
  notificationDetail: string;
  safetyAdvisory: string | null;
  customerAcknowledgementDraft: string;
  message: string;
}

export const CustomerWebsite: React.FC<CustomerWebsiteProps> = ({
  config,
  initialServiceSlug,
  onSelectServiceSlug,
  onOpenStaffPortal,
  onOpenHandoverDocs,
}) => {
  const [selectedServiceSlug, setSelectedServiceSlug] = useState<string | null>(initialServiceSlug);

  // Enquiry Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>(PreferredChannel.WHATSAPP);
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [requestedServiceSlug, setRequestedServiceSlug] = useState(
    initialServiceSlug || config.services[0]?.slug || 'diagnostics'
  );
  const [symptomsDescription, setSymptomsDescription] = useState('');
  const [locationArea, setLocationArea] = useState("Lang'ata Road");
  const [urgency, setUrgency] = useState<UrgencyLevel>(UrgencyLevel.STANDARD);
  const [safetyFlags, setSafetyFlags] = useState<string[]>([]);
  const [consentGranted, setConsentGranted] = useState(false);
  const [honeypotWebsite, setHoneypotWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<SubmissionConfirmation | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    setSelectedServiceSlug(initialServiceSlug);
    if (initialServiceSlug) {
      setRequestedServiceSlug(initialServiceSlug);
    }
  }, [initialServiceSlug]);

  const activeServiceDetail: ServiceCapability | null = selectedServiceSlug
    ? config.services.find((s) => s.slug === selectedServiceSlug) || null
    : null;

  const cleanWhatsappDigits = config.whatsappNumber.replace(/[^0-9]/g, '');

  const handleToggleSafetyFlag = (flag: string) => {
    setSafetyFlags((prev) =>
      prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]
    );
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phone,
          preferredChannel,
          vehicleMakeModel,
          vehicleRegistration,
          requestedServiceSlug,
          symptomsDescription,
          locationArea,
          urgency,
          safetyFlags,
          consentGranted,
          honeypotWebsite,
          landingPage: window.location.pathname + window.location.search,
          utmSource: urlParams.get('utm_source') || '',
          utmMedium: urlParams.get('utm_medium') || '',
          utmCampaign: urlParams.get('utm_campaign') || '',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Please check the required form fields and try again.');
        setSubmitting(false);
        return;
      }

      setConfirmation(data);
      setSubmitting(false);
      const formEl = document.getElementById('enquiry-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      setSubmitError(
        'Network error while saving your enquiry. Please call or WhatsApp our secretary directly.'
      );
      setSubmitting(false);
    }
  };

  const handleChooseServiceForBooking = (slug: string) => {
    setRequestedServiceSlug(slug);
    const el = document.getElementById('enquiry-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. HERO SECTION — Immediately answers What, Where, How to get help, How to book, and What happens next */}
      <section className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Core Proposition, Lang'ata Coverage & Direct Actions */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-amber-400">{config.serviceAreaPrimary}</span>
                  <span aria-hidden="true">·</span>
                  <span>Mechanical Workshop &amp; Diagnostics</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{config.operatingHours}</span>
                </div>

                <h1
                  className="font-display font-bold tracking-tight text-white leading-[1.1]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                >
                  Vehicle Diagnostics, Servicing &amp; Breakdown Repairs in Lang&apos;ata, Nairobi
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                  Structured OBD-II fault scanning, battery and starter troubleshooting, brake repairs, and routine servicing along the Lang&apos;ata Road corridor—backed by a tracked workshop lead ledger so your enquiry is never lost.
                </p>

                {config.isPlaceholderName && (
                  <p className="text-xs text-amber-300/90 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5">
                    Configuration Notice: Registered workshop name, plot address, and telephone lines are currently set to editable founder placeholders (<strong>{config.legalBusinessName}</strong>). Update anytime in the Staff Ledger.
                  </p>
                )}
              </div>

              {/* Primary & Secondary Contact Actions */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#enquiry-form"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('enquiry-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Book Inspection / Log Breakdown</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>

                  <a
                    href={`tel:${config.secretaryPhone}`}
                    className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                  >
                    <Phone className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <span>Call Secretary ({config.secretaryPhone})</span>
                  </a>

                  <a
                    href={`https://wa.me/${cleanWhatsappDigits}?text=${encodeURIComponent(
                      "Hello, I need vehicle assistance in Lang'ata. Please advise on workshop bay availability."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <span>WhatsApp Desk</span>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Direct Mechanic Line: <a href={`tel:${config.mechanicPhone}`} className="text-slate-200 underline hover:text-amber-400 font-mono tabular-nums">{config.mechanicPhone}</a></span>
                  <span aria-hidden="true">·</span>
                  <span>Currency: <strong className="text-slate-200 font-mono">KES</strong> (Written estimate after physical inspection)</span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Workshop Bay Asset with Resilient Fallback */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[280px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col justify-between">
                <img
                  src="/images/hero-workshop.svg"
                  alt="Lang'ata Automotive Workshop Hydraulic Lift and OBD-II Diagnostic Bay Schematic"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-5">
                  <p className="text-xs font-mono text-amber-400">
                    LANG&apos;ATA CORRIDOR COVERAGE
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    Lang&apos;ata Road · Otiende · Hardy · Nyayo Highrise · Wilson / South C
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    {config.dispatchPolicy}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-Column First-Screen Operational Answers Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80">
            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-xs font-mono text-amber-400">01. AVAILABLE SERVICES</p>
              <p className="text-sm font-semibold text-white mt-1">
                Diagnostics, Servicing, Battery, Starter, Brakes &amp; Engine
              </p>
              <p className="text-xs text-slate-400 mt-1">
                6 verified mechanical &amp; electrical service lines in Lang&apos;ata.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-xs font-mono text-amber-400">02. SERVICE AREA</p>
              <p className="text-sm font-semibold text-white mt-1">
                Lang&apos;ata, Nairobi
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Workshop bay inspection by appointment; local call-out subject to mechanic confirmation.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-xs font-mono text-amber-400">03. WHAT HAPPENS AFTER SUBMITTING</p>
              <p className="text-sm font-semibold text-white mt-1">
                Instant Lead ID &amp; Secretary Callback
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Your request is saved to our Lead Ledger first; the secretary confirms bay timing via Phone/WhatsApp.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-xs font-mono text-amber-400">04. TRANSPARENT KES ESTIMATES</p>
              <p className="text-sm font-semibold text-white mt-1">
                No Unapproved Part Swaps
              </p>
              <p className="text-xs text-slate-400 mt-1">
                We diagnose first and issue a written KES estimate before fitting parts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* URGENT / ROADSIDE SAFETY NOTICE */}
      <section aria-label="Urgent Situation Instructions" className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
              {config.emergencyInstructions}
            </p>
          </div>
          <a
            href={`tel:${config.secretaryPhone}`}
            className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-200/80 border border-amber-300 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center tabular-nums"
          >
            Urgent Desk: {config.secretaryPhone}
          </a>
        </div>
      </section>

      {/* 2. DEDICATED SERVICE PAGE VIEW (When a specific service capability is selected) OR ALL SERVICES BENTO GRID */}
      <section id="services" className="scroll-mt-24 max-w-[1280px] mx-auto px-4 sm:px-6 py-14 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Verified Workshop Capabilities · Lang&apos;ata, Nairobi
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Mechanical &amp; Electrical Repair Services
            </h2>
          </div>

          {/* Service Filter / Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => onSelectServiceSlug(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedServiceSlug === null
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 6 Services
            </button>
            {config.services.map((svc) => (
              <button
                key={svc.slug}
                type="button"
                onClick={() => onSelectServiceSlug(svc.slug)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedServiceSlug === svc.slug
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {svc.indexNumber}. {svc.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Single-Service View */}
        {activeServiceDetail ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8">
            <div className="flex flex-col lg:flex-row justify-between gap-8 border-b border-slate-200 pb-8">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">
                    Service {activeServiceDetail.indexNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Lang&apos;ata Workshop Bay</span>
                  <span aria-hidden="true">·</span>
                  <span>Written KES Estimate After Inspection</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {activeServiceDetail.title}
                </h3>
                <p className="text-base text-slate-700 leading-relaxed">
                  {activeServiceDetail.detailedDescription}
                </p>
                {activeServiceDetail.safetyNotice && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900 font-medium">
                    {activeServiceDetail.safetyNotice}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleChooseServiceForBooking(activeServiceDetail.slug)}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    Request {activeServiceDetail.title.split('&')[0].trim()} Inspection
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectServiceSlug(null)}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Back to All Services
                  </button>
                </div>
              </div>

              <div className="lg:w-[380px] shrink-0">
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                  <img
                    src={activeServiceDetail.imagePath}
                    alt={activeServiceDetail.imageAlt}
                    referrerPolicy="no-referrer"
                    className="w-full h-56 object-cover"
                  />
                  <div className="p-4 bg-slate-950 text-slate-300 text-xs space-y-1">
                    <p className="font-semibold text-white">Turnaround &amp; Pricing Policy</p>
                    <p>{activeServiceDetail.typicalTurnaroundNote}</p>
                    <p className="font-mono text-amber-400 pt-1">
                      {config.indicativePricesApproved
                        ? activeServiceDetail.indicativePriceKes
                        : config.unapprovedPricingNotice}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-3">
                  Common Symptoms We Investigate
                </h4>
                <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                  {activeServiceDetail.commonSymptoms.map((symptom, idx) => (
                    <li key={idx}>{symptom}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 mb-3">
                  Our Workshop Inspection Procedure
                </h4>
                <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
                  {activeServiceDetail.workshopProcedure.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Internal Links to Related Services for Local SEO */}
            <div className="border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold text-slate-500 mb-3">
                Related Lang&apos;ata Workshop Services
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {config.services
                  .filter((s) => s.slug !== activeServiceDetail.slug)
                  .map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => onSelectServiceSlug(s.slug)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      <span>
                        {s.indexNumber}. {s.title}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          /* Asymmetric Bento Grid of All 6 Verified Services */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.services.map((service, idx) => {
              const isFeatured = idx === 0 || idx === 4;
              return (
                <article
                  key={service.slug}
                  className={`bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6 ${
                    isFeatured ? 'md:col-span-2' : 'md:col-span-1'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {service.indexNumber}. Verified Capability
                      </span>
                      <span>Lang&apos;ata Bay</span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onSelectServiceSlug(service.slug)}
                        className="text-left hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-500"
                      >
                        {service.title}
                      </button>
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {service.shortSummary}
                    </p>

                    <ul className="space-y-1.5 pt-1 text-xs text-slate-600">
                      {service.commonSymptoms.slice(0, 3).map((sym, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-slate-400 font-mono">·</span>
                          <span>{sym}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectServiceSlug(service.slug)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-950 underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      Inspect Procedure &amp; Symptoms
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseServiceForBooking(service.slug)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                    >
                      Book This Service
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. HOW BOOKING WORKS + PERSISTENT ENQUIRY FORM */}
      <section
        id="enquiry-form"
        className="scroll-mt-24 bg-white border-y border-slate-200 py-14"
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left 5 Columns: Booking Procedure & Verified Operational Facts */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Traceable Intake Ledger
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  Request a Workshop Inspection or Log a Breakdown
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Every request submitted here is persisted directly to our Lang&apos;ata Workshop Lead Ledger before confirmation is displayed.
                </p>
              </div>

              <div className="space-y-5">
                {config.bookingProcedureSteps.map((step) => (
                  <div key={step.stepNumber} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <p className="text-xs font-mono font-bold text-slate-900">
                      Step {step.stepNumber} · {step.title}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>VERIFIED OPERATIONAL STANDARDS</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We do not publish fabricated customer reviews, unverified 15-minute roadside guarantees, or binding sight-unseen repair quotes. Our secretary tracks every enquiry from initial call to mechanical completion.
                </p>
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-1 text-xs font-mono text-slate-300 tabular-nums">
                  <span>Secretary Line: {config.secretaryPhone}</span>
                  <span>Mechanic Line: {config.mechanicPhone}</span>
                  <span>Hours: {config.operatingHours}</span>
                </div>
              </div>
            </div>

            {/* Right 7 Columns: The Persistent Lead Capture Form OR Truthful Confirmation Screen */}
            <div className="lg:col-span-7">
              {confirmation ? (
                <div
                  data-testid="enquiry-confirmation-card"
                  className="bg-slate-50 border border-slate-300 rounded-xl p-6 sm:p-8 space-y-6"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-emerald-800">
                        ENQUIRY PERSISTED TO WORKSHOP LEAD LEDGER
                      </p>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                        Reference ID: <span className="font-mono tabular-nums">{confirmation.leadId}</span>
                      </h3>
                      <p className="text-sm text-slate-700 mt-1">
                        {confirmation.message}
                      </p>
                    </div>
                  </div>

                  {confirmation.safetyAdvisory && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900 font-medium">
                      {confirmation.safetyAdvisory}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-500 block">Recorded Timestamp (Nairobi)</span>
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {confirmation.createdAtNairobi}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Requested Capability</span>
                      <strong className="text-slate-900">{confirmation.requestedServiceTitle}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Ledger Status</span>
                      <strong className="font-mono text-slate-900">{confirmation.status}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Secretary Notification Channel</span>
                      <strong className="font-mono text-slate-900">{confirmation.notificationStatus}</strong>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Truthful Notification Status
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {confirmation.notificationDetail}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Need immediate voice or WhatsApp contact? Quote your Lead ID ({confirmation.leadId}):
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={`https://wa.me/${cleanWhatsappDigits}?text=${encodeURIComponent(
                          `Hello ${config.brandShortName}, I have submitted website enquiry Ref ${confirmation.leadId} for ${confirmation.requestedServiceTitle}. Please confirm workshop bay availability.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap shrink-0"
                      >
                        <MessageSquare className="w-4 h-4" aria-hidden="true" />
                        <span>Send Lead ID via WhatsApp</span>
                      </a>

                      <a
                        href={`tel:${config.secretaryPhone}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                      >
                        <Phone className="w-4 h-4" aria-hidden="true" />
                        <span>Call Secretary ({config.secretaryPhone})</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmation(null);
                          setSymptomsDescription('');
                        }}
                        className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                      >
                        Submit Another Enquiry
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleEnquirySubmit}
                  noValidate
                  className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
                >
                  <div className="border-b border-slate-200 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">
                      Vehicle Breakdown &amp; Service Enquiry Form
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Fields marked with * are required. Your Lead ID is generated immediately upon saving.
                    </p>
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900 font-medium"
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Honeypot field hidden from screen readers and visual users */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="honeypot-website">Website</label>
                    <input
                      id="honeypot-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypotWebsite}
                      onChange={(e) => setHoneypotWebsite(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="customer-name"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Your Full Name *
                      </label>
                      <input
                        id="customer-name"
                        type="text"
                        required
                        placeholder="e.g. David Kamau"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="customer-phone"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Telephone Number (Kenyan Format) *
                      </label>
                      <input
                        id="customer-phone"
                        type="tel"
                        required
                        placeholder="e.g. 0712 345 678 or +254712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-2 focus:outline-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="preferred-channel"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Preferred Contact Channel *
                      </label>
                      <select
                        id="preferred-channel"
                        value={preferredChannel}
                        onChange={(e) => setPreferredChannel(e.target.value as PreferredChannel)}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                      >
                        <option value={PreferredChannel.WHATSAPP}>WhatsApp</option>
                        <option value={PreferredChannel.PHONE_CALL}>Phone Call</option>
                        <option value={PreferredChannel.SMS}>SMS</option>
                        <option value={PreferredChannel.EITHER}>Phone or WhatsApp</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-make-model"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Vehicle Make &amp; Model
                      </label>
                      <input
                        id="vehicle-make-model"
                        type="text"
                        placeholder="e.g. Toyota Prado / Subaru Forester"
                        value={vehicleMakeModel}
                        onChange={(e) => setVehicleMakeModel(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-reg"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Registration (Optional)
                      </label>
                      <input
                        id="vehicle-reg"
                        type="text"
                        placeholder="e.g. KDD 123A"
                        value={vehicleRegistration}
                        onChange={(e) => setVehicleRegistration(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-mono uppercase focus:outline-2 focus:outline-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="requested-service"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Requested Service / Issue Category *
                      </label>
                      <select
                        id="requested-service"
                        value={requestedServiceSlug}
                        onChange={(e) => setRequestedServiceSlug(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                      >
                        {config.services.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.indexNumber}. {s.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="urgency-level"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        Urgency &amp; Mobility Status *
                      </label>
                      <select
                        id="urgency-level"
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                      >
                        <option value={UrgencyLevel.STANDARD}>Standard Booking (Vehicle Drivable)</option>
                        <option value={UrgencyLevel.URGENT_TODAY}>Urgent Same-Day Inspection Needed</option>
                        <option value={UrgencyLevel.IMMOBILISED}>Vehicle Immobilised / Won&apos;t Start</option>
                        <option value={UrgencyLevel.SAFETY_CRITICAL}>Safety Critical (Brakes / Overheating / Smoke)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="location-area"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      Current Location or Estate in Lang&apos;ata *
                    </label>
                    <input
                      id="location-area"
                      type="text"
                      required
                      placeholder="e.g. Lang'ata Shopping Centre, Otiende, Hardy, Rubis Lang'ata Road"
                      value={locationArea}
                      onChange={(e) => setLocationArea(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="symptoms-description"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      Description of Symptoms or Service Needed *
                    </label>
                    <textarea
                      id="symptoms-description"
                      rows={3}
                      required
                      placeholder="Describe what you hear, see, or feel (e.g. single click when turning key, brake grinding on front left, or due for 10,000km oil & filter service)..."
                      value={symptomsDescription}
                      onChange={(e) => setSymptomsDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-slate-900"
                    />
                  </div>

                  {/* Safety Flag Checkboxes */}
                  <fieldset className="p-3.5 bg-white border border-slate-200 rounded-lg">
                    <legend className="text-xs font-semibold text-slate-800 px-1">
                      Safety &amp; Situation Flags (Check any that apply)
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
                      {[
                        'Vehicle stalled in active traffic lane',
                        'Brake warning light or soft brake pedal',
                        'Engine temperature in red / steam visible',
                        'Need battery jump or starter check at parking spot',
                      ].map((flag) => (
                        <label key={flag} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={safetyFlags.includes(flag)}
                            onChange={() => handleToggleSafetyFlag(flag)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>{flag}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Privacy & Consent Checkbox */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2">
                    <label htmlFor="consent-checkbox" className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        id="consent-checkbox"
                        type="checkbox"
                        checked={consentGranted}
                        onChange={(e) => setConsentGranted(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-xs text-slate-700 leading-relaxed">
                        I consent to <strong>{config.brandShortName}</strong> storing my contact and vehicle details in the Workshop Lead Ledger to contact me regarding this service request.{' '}
                        <button
                          type="button"
                          onClick={() => setShowPrivacyModal(true)}
                          className="underline font-semibold text-slate-900 hover:text-amber-700"
                        >
                          Read Privacy &amp; Data Deletion Notice
                        </button>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-5 text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submitting
                      ? 'Recording Enquiry in Lead Ledger...'
                      : 'Submit Enquiry & Generate Lead ID'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. COVERAGE, LOCATION & OPERATING HOURS */}
      <section id="coverage" className="scroll-mt-24 max-w-[1280px] mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin className="w-4 h-4 text-slate-900" aria-hidden="true" />
              <span>WORKSHOP LOCATION &amp; SERVICE COVERAGE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Serving Lang&apos;ata &amp; Surrounding Corridors
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We focus exclusively on Lang&apos;ata and immediately adjacent feeder roads so our mechanic and secretary can provide realistic turnaround times.
            </p>
            <div className="space-y-2 text-xs sm:text-sm text-slate-700">
              <p>
                <strong>Workshop Address:</strong> {config.workshopAddress}
              </p>
              <p>
                <strong>Reference Coordinates:</strong>{' '}
                <span className="font-mono tabular-nums">{config.mapCoordinatesLabel}</span>
              </p>
            </div>
            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Primary Coverage Zones in Lang&apos;ata:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {config.serviceCorridors.map((corridor) => (
                  <li key={corridor} className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{corridor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock className="w-4 h-4 text-slate-900" aria-hidden="true" />
              <span>OPERATING HOURS &amp; DIRECT CONTACTS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Workshop Hours &amp; Dispatch Policy
            </h2>
            <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
              {config.operatingHours}
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              {config.dispatchPolicy}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Secretary &amp; Bookings Desk</span>
                <strong className="text-slate-900 block">{config.secretaryNamePlaceholder}</strong>
                <a
                  href={`tel:${config.secretaryPhone}`}
                  className="font-mono text-slate-900 underline tabular-nums block pt-1"
                >
                  {config.secretaryPhone}
                </a>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Workshop Lead Mechanic</span>
                <strong className="text-slate-900 block">{config.mechanicNamePlaceholder}</strong>
                <a
                  href={`tel:${config.mechanicPhone}`}
                  className="font-mono text-slate-900 underline tabular-nums block pt-1"
                >
                  {config.mechanicPhone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="scroll-mt-24 max-w-[1280px] mx-auto px-4 sm:px-6 pb-16 space-y-6">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            Customer Questions &amp; Policies
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {config.faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-2"
            >
              <h3 className="text-base font-bold text-slate-900">
                {faq.question}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. QUIET FOOTER */}
      <footer className="mt-auto bg-slate-950 text-slate-400 border-t border-slate-800 py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs">
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">{config.brandShortName}</p>
            <p>{config.legalBusinessName}</p>
            <p>{config.workshopAddress}</p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Privacy &amp; Data Protection Notice
            </button>
            <button
              type="button"
              onClick={onOpenStaffPortal}
              className="hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Staff Operations Portal
            </button>
            <button
              type="button"
              onClick={onOpenHandoverDocs}
              className="hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Secretary SOP &amp; Owner Handover
            </button>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              XML Sitemap
            </a>
          </div>
        </div>
      </footer>

      {/* PRIVACY & DATA PROTECTION MODAL */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-dialog-title"
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 id="privacy-dialog-title" className="text-lg font-bold text-slate-900">
              Privacy Notice, Consent &amp; Data Deletion Procedure
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {config.privacySummary}
            </p>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1.5">
              <p>
                <strong>Retention Period:</strong> Operational enquiry records are retained for up to{' '}
                <span className="font-mono tabular-nums">{config.dataRetentionDays}</span> days for warranty and service audit tracking.
              </p>
              <p>
                <strong>Data Redaction / Deletion Procedure:</strong> Customers may request personal data redaction at any time by quoting their Lead ID or telephone number to our Secretary ({config.secretaryPhone}) or emailing {config.businessEmail}. The Workshop Owner executes the built-in <em>Redact Personal Data</em> command in the Staff Ledger, which scrubs name, phone, and vehicle registration while preserving anonymised audit integrity.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
