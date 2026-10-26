export interface ServiceCapability {
  slug: string;
  indexNumber: string;
  title: string;
  shortSummary: string;
  detailedDescription: string;
  commonSymptoms: string[];
  workshopProcedure: string[];
  typicalTurnaroundNote: string;
  indicativePriceKes: string;
  imagePath: string;
  imageAlt: string;
  safetyNotice?: string;
}

export interface BusinessConfig {
  brandShortName: string;
  legalBusinessName: string;
  isPlaceholderName: boolean;
  serviceAreaPrimary: string;
  serviceCorridors: string[];
  workshopAddress: string;
  mapCoordinatesLabel: string;
  mechanicPhone: string;
  mechanicNamePlaceholder: string;
  secretaryPhone: string;
  secretaryNamePlaceholder: string;
  whatsappNumber: string;
  businessEmail: string;
  operatingHours: string;
  dispatchPolicy: string;
  emergencyInstructions: string;
  currency: 'KES';
  indicativePricesApproved: boolean;
  unapprovedPricingNotice: string;
  bookingProcedureSteps: {
    stepNumber: string;
    title: string;
    detail: string;
  }[];
  internalTargets: {
    acknowledgeTargetMinutes: number;
    assignTargetMinutes: number;
    defaultFollowUpMinutes: number;
    staleLeadHours: number;
  };
  services: ServiceCapability[];
  faqs: {
    question: string;
    answer: string;
  }[];
  privacySummary: string;
  dataRetentionDays: number;
}

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  brandShortName: "Lang'ata Auto Ops",
  legalBusinessName: "[PLACEHOLDER: Confirm Registered Workshop Name — Lang'ata, Nairobi]",
  isPlaceholderName: true,
  serviceAreaPrimary: "Lang'ata, Nairobi, Kenya",
  serviceCorridors: [
    "Lang'ata Road (Wilson Airport to Bomas)",
    "Lang'ata Shopping Centre & Otiende",
    "Hardy & Karen Border",
    "Nyayo Highrise & Mbagathi Way Link",
    "South C & Southern Bypass Interchange"
  ],
  workshopAddress: "[PLACEHOLDER: Confirm Workshop Plot Number & Landmark, Lang'ata, Nairobi]",
  mapCoordinatesLabel: "-1.3396, 36.7662 (Lang'ata General Area — Update Exact Pin)",
  mechanicPhone: "+254700000101",
  mechanicNamePlaceholder: "Lead Mechanic [PLACEHOLDER: Confirm Name]",
  secretaryPhone: "+254700000102",
  secretaryNamePlaceholder: "Workshop Secretary [PLACEHOLDER: Confirm Name]",
  whatsappNumber: "+254700000102",
  businessEmail: "intake@langata-workshop.example.ke",
  operatingHours: "[PLACEHOLDER: Mon–Sat 08:00–18:00 EAT · Sun Closed — Confirm Actual Hours]",
  dispatchPolicy:
    "Workshop-first operation in Lang'ata. Mobile battery jump-start or roadside inspection within Lang'ata is strictly subject to mechanic bay availability and secretary confirmation—never assumed automatically upon form submission.",
  emergencyInstructions:
    "SAFETY FIRST: If your vehicle is stalled in an active lane on Lang'ata Road or the Southern Bypass, switch on hazard lights, place reflective triangles 50 metres behind the vehicle, and move passengers off the carriageway. If brakes have failed or smoke/fire is visible, do not drive the vehicle—arrange flatbed recovery before workshop inspection.",
  currency: 'KES',
  indicativePricesApproved: false,
  unapprovedPricingNotice:
    "Pricing policy: Written estimates in KES are issued only after physical bay inspection or diagnostic scan. No automated online price quotes are binding.",
  bookingProcedureSteps: [
    {
      stepNumber: "01",
      title: "Submit Breakdown or Service Request",
      detail:
        "Complete the enquiry form below or call/WhatsApp the secretary desk. Every website request is assigned a unique Lead ID in our persistent workshop ledger before confirmation is shown."
    },
    {
      stepNumber: "02",
      title: "Secretary Qualification & Bay Slot Confirmation",
      detail:
        "Our secretary reviews your symptoms, checks mechanic bay availability in Lang'ata, and contacts you via your preferred channel (Phone or WhatsApp) to confirm a drop-off window or discuss recovery."
    },
    {
      stepNumber: "03",
      title: "Physical Inspection & Approved KES Estimate",
      detail:
        "The mechanic inspects the vehicle and explains the fault findings. No parts are purchased or fitted without your explicit approval of the itemised KES estimate."
    }
  ],
  internalTargets: {
    acknowledgeTargetMinutes: 5,
    assignTargetMinutes: 15,
    defaultFollowUpMinutes: 30,
    staleLeadHours: 24
  },
  services: [
    {
      slug: "diagnostics",
      indexNumber: "01",
      title: "Computerised OBD-II & Electrical Diagnostics",
      shortSummary:
        "Fault-code scanning, live sensor waveform checks, and wiring continuity testing before replacing any component.",
      detailedDescription:
        "Modern vehicles operating in Nairobi traffic frequently trigger Check Engine, ABS, DPF, or Airbag warning lamps caused by sensor faults, wiring harness chafing, or fuel-quality issues. We perform structured OBD-II telemetry scans and physical multimeter verification to isolate the root cause rather than guessing parts.",
      commonSymptoms: [
        "Check Engine (MIL), ABS, Traction Control, or Airbag warning light illuminated",
        "Intermittent loss of power or limp-home mode on hills",
        "Increased fuel consumption or rough idle in Lang'ata traffic",
        "Parasitic electrical drain flattening the battery overnight"
      ],
      workshopProcedure: [
        "Full system OBD-II / manufacturer fault code read and freeze-frame capture",
        "Live sensor data verification (MAF, O2, fuel trim, coolant temp, wheel speed)",
        "Circuit load and ground continuity inspection",
        "Written diagnostic summary with recommended repair steps"
      ],
      typicalTurnaroundNote: "Initial diagnostic scan typically completed same day upon booked bay arrival.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Diagnostic Scan Fee in KES]",
      imagePath: "/images/service-diagnostics.svg",
      imageAlt: "Computerised OBD-II diagnostic waveform and sensor telemetry interface"
    },
    {
      slug: "routine-servicing",
      indexNumber: "02",
      title: "Routine Minor & Major Vehicle Servicing",
      shortSummary:
        "Scheduled engine oil, filters, fluid checks, belt inspection, and underbody suspension safety audit for Nairobi road conditions.",
      detailedDescription:
        "Stop-and-go commuting along Lang'ata Road and dusty feeder roads accelerates oil degradation and air/cabin filter clogging. Our scheduled servicing follows a multi-point mechanical checklist covering fluids, filters, belts, bushings, and tyre wear.",
      commonSymptoms: [
        "Service interval due by mileage (every 5,000 km – 10,000 km) or time",
        "Service reminder indicator on dashboard cluster",
        "Dark, degraded engine oil or clogged air filter element",
        "Pre-upcountry trip mechanical safety inspection request"
      ],
      workshopProcedure: [
        "Engine oil drain and replacement with specification-matched lubricant",
        "Oil, air, fuel, and cabin filter inspection/replacement",
        "Brake fluid, coolant, transmission, and power steering level & condition check",
        "Underbody suspension bush, ball-joint, and exhaust mount check"
      ],
      typicalTurnaroundNote: "Standard minor service completed within a scheduled half-day workshop slot.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Labour & Service Package Rates in KES]",
      imagePath: "/images/hero-workshop.svg",
      imageAlt: "Workshop hydraulic lift inspection and routine vehicle servicing bay"
    },
    {
      slug: "battery-problems",
      indexNumber: "03",
      title: "Battery Testing, Charging System & Alternator Repair",
      shortSummary:
        "Digital battery load testing, alternator charging output verification, and terminal/earth strap remediation.",
      detailedDescription:
        "A flat battery is often a symptom of a failing alternator diode pack, slipping drive belt, corroded earth strap, or parasitic draw. Before condemning your battery, we test Cold Cranking Amps (CCA), resting voltage, and alternator charging ripple under electrical load.",
      commonSymptoms: [
        "Battery warning icon glowing red on the instrument cluster",
        "Headlights dimming at idle or slow electric window operation",
        "Vehicle requires jump-starting in the morning",
        "Swollen battery casing or heavy white/blue terminal corrosion"
      ],
      workshopProcedure: [
        "Digital battery conductance and CCA load test",
        "Alternator charging voltage check (idle and 2,000 RPM with load)",
        "Parasitic current draw test across fuse circuits",
        "Terminal cleaning, earth strap tightening, or alternator repair/replacement"
      ],
      typicalTurnaroundNote: "Battery and charging test takes 30–45 minutes in the workshop bay.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Testing Fee in KES]",
      imagePath: "/images/service-battery.svg",
      imageAlt: "12V automotive battery CCA load test and alternator voltage measurement"
    },
    {
      slug: "starting-problems",
      indexNumber: "04",
      title: "Starter Motor, Ignition & No-Crank Troubleshooting",
      shortSummary:
        "Systematic diagnosis for single-click, rapid-click, crank-no-start, immobiliser, and fuel-delivery faults.",
      detailedDescription:
        "When a vehicle refuses to start at home or at a Lang'ata parking bay, distinguishing between a dead battery, faulty starter solenoid, neutral-safety switch, crank sensor, or fuel pump failure saves unnecessary towing and part costs.",
      commonSymptoms: [
        "Single loud metallic click or rapid clicking when turning the key / pressing Start",
        "Engine cranks normally at full speed but fails to fire",
        "Intermittent no-start when the engine is hot",
        "Dashboard lights up normally but starter motor does not engage"
      ],
      workshopProcedure: [
        "Starter relay, fuse, and solenoid voltage-drop measurement",
        "Crankshaft and camshaft position sensor signal check",
        "Fuel rail pressure and pump relay verification",
        "Starter motor bench test, brush/solenoid overhaul, or unit replacement"
      ],
      typicalTurnaroundNote: "Subject to whether vehicle is brought to workshop or requires local call-out check.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Inspection Rate in KES]",
      imagePath: "/images/service-battery.svg",
      imageAlt: "Starter motor circuit and ignition troubleshooting diagram"
    },
    {
      slug: "brake-repairs",
      indexNumber: "05",
      title: "Brake Pads, Discs, Hydraulics & ABS Servicing",
      shortSummary:
        "Front and rear brake pad replacement, disc rotor inspection, brake fluid bleeding, and caliper seizure repair.",
      detailedDescription:
        "Braking performance is safety-critical. Grinding noises, pedal pulsation, or a spongy brake pedal require immediate mechanical inspection before continuing daily driving.",
      commonSymptoms: [
        "High-pitched squealing or metallic grinding noise when braking",
        "Steering wheel vibration or pedal judder during deceleration",
        "Soft, spongy brake pedal or pedal sinking toward the floor",
        "Vehicle pulling left or right under braking or handbrake not holding on slopes"
      ],
      workshopProcedure: [
        "Wheel removal and micrometre measurement of disc rotor thickness and runout",
        "Inspection of inner and outer brake pads, caliper slide pins, and dust boots",
        "Hydraulic brake line, master cylinder, and wheel cylinder leak check",
        "Pad/disc replacement and DOT-4 hydraulic system bleeding"
      ],
      typicalTurnaroundNote: "Standard axle pad/disc service completed same day once parts are confirmed.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Brake Labour Rate in KES]",
      imagePath: "/images/service-brakes.svg",
      imageAlt: "Ventilated disc brake rotor and hydraulic caliper inspection",
      safetyNotice:
        "CRITICAL SAFETY WARNING: If your red Brake System warning light is on or the brake pedal goes to the floor, do not drive the vehicle to the workshop. Contact the secretary to coordinate safe recovery."
    },
    {
      slug: "engine-troubleshooting",
      indexNumber: "06",
      title: "Engine Overheating, Misfires & Mechanical Troubleshooting",
      shortSummary:
        "Cooling system pressure testing, cylinder misfire isolation, oil leak repair, and timing/drivetrain diagnostics.",
      detailedDescription:
        "Overheating in Nairobi traffic can warp cylinder heads within minutes if ignored. We perform cooling system pressure tests, thermostat and radiator fan verification, ignition coil/spark plug misfire isolation, and compression testing.",
      commonSymptoms: [
        "Temperature gauge rising above normal or steam/coolant smell from bonnet",
        "Engine shaking at idle, hesitation under acceleration, or misfire codes",
        "Visible oil or coolant puddles beneath the parked vehicle",
        "Unusual knocking, rattling, or belt squeal from the engine bay"
      ],
      workshopProcedure: [
        "Cooling system pressure test, radiator cap, thermostat, and fan relay check",
        "Ignition coil, spark plug, and fuel injector balance testing",
        "Cylinder compression and head-gasket combustion leak test where indicated",
        "Itemised mechanical repair plan with parts sourcing options"
      ],
      typicalTurnaroundNote: "Diagnostic evaluation completed first; repair duration depends on fault complexity.",
      indicativePriceKes: "[PLACEHOLDER: Set Approved Engine Diagnostic Rate in KES]",
      imagePath: "/images/service-diagnostics.svg",
      imageAlt: "Engine cooling, compression, and misfire diagnostic workflow",
      safetyNotice:
        "CRITICAL OVERHEATING WARNING: Never open a hot radiator or expansion tank cap—pressurised boiling coolant causes severe burns. Switch off the engine immediately if the temperature gauge enters the red zone."
    }
  ],
  faqs: [
    {
      question: "Do you offer immediate 24/7 roadside recovery anywhere in Nairobi?",
      answer:
        "No. We are an operating mechanical workshop serving Lang'ata and adjacent corridors. While we can sometimes dispatch a mechanic locally within Lang'ata for battery/starting checks during staffed hours, roadside attendance is strictly subject to workshop bay workload and secretary confirmation."
    },
    {
      question: "What happens immediately after I submit the website enquiry form?",
      answer:
        "Your enquiry is saved directly into our Workshop Lead Ledger with a unique Lead ID (e.g., LGT-20261026-XXXX) and our secretary is alerted. During operating hours, the secretary reviews your symptoms, checks mechanic availability, and contacts you via phone or WhatsApp to confirm next steps."
    },
    {
      question: "Can you give me a fixed repair price over WhatsApp before seeing the car?",
      answer:
        "For routine servicing or standard diagnostic scans, we can share approved labour guidelines once you specify your exact vehicle make, model, and year. For breakdowns, noises, warning lights, or overheating, we must inspect the vehicle first so we do not quote for the wrong part."
    },
    {
      question: "Can I supply my own spare parts or do you source them?",
      answer:
        "We can advise on genuine OEM and verified aftermarket part options after diagnosis. If you prefer to purchase parts yourself, our mechanic will provide the exact part specification or sample first so you buy the correct fitment."
    },
    {
      question: "How is my personal contact and vehicle information handled?",
      answer:
        "We collect only your name, phone number, vehicle make/model, location area, and fault description to coordinate your service request. Records are stored in our access-controlled Lead Ledger and can be redacted upon request."
    }
  ],
  privacySummary:
    "We collect your name, telephone number, preferred contact channel, vehicle make/model, and repair symptoms solely to respond to your enquiry, schedule workshop inspection, and maintain service quality records in accordance with the Kenya Data Protection Act. We never sell your contact details to third-party marketers.",
  dataRetentionDays: 365
};
