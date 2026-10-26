import { GoogleGenAI, Type } from '@google/genai';
import {
  OrchestratorAnalysis,
  UrgencyLevel,
  LeadStatus,
  runDeterministicOrchestrator,
} from '../domain/leadLifecycle';
import { BusinessConfig } from '../config/businessConfig';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Runs bounded LLM language tasks (symptom summarisation, enquiry classification,
 * mechanic preparation note, and truthful customer acknowledgement draft)
 * validated against an explicit schema, with deterministic fallback and guardrails.
 */
export async function runBoundedOrchestratorAnalysis(params: {
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
  config: BusinessConfig;
}): Promise<OrchestratorAnalysis> {
  // Always compute the deterministic baseline first
  const deterministic = runDeterministicOrchestrator(params);

  const ai = getGeminiClient();
  if (!ai) {
    return deterministic;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analyse this automotive workshop enquiry in Lang'ata, Nairobi:
Lead ID: ${params.leadId}
Customer Name: ${params.customerName}
Vehicle: ${params.vehicleMakeModel}
Requested Service: ${params.requestedServiceTitle} (${params.requestedServiceSlug})
Customer Symptoms: ${params.symptomsDescription}
Location: ${params.locationArea}
Reported Urgency: ${params.urgency}
Workshop Brand: ${params.config.brandShortName}`,
      config: {
        systemInstruction: `You are a bounded intake triage assistant for an automotive repair workshop in Lang'ata, Nairobi, Kenya.
STRICT RULES:
1. Never promise or invent any price or KES figure. State that estimates are provided after physical inspection.
2. Never confirm mobile roadside dispatch as guaranteed; state that the secretary will confirm bay or mechanic availability.
3. Never make a definitive safety-critical mechanical diagnosis; frame notes as preliminary inspection preparation for the mechanic.
4. Keep outputs concise, factual, and tailored to Lang'ata, Nairobi.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symptomSummary: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence summary of vehicle symptoms and location for the secretary and mechanic.',
            },
            classifiedServiceSlug: {
              type: Type.STRING,
              description: 'One of: diagnostics, routine-servicing, battery-problems, starting-problems, brake-repairs, engine-troubleshooting',
            },
            classifiedUrgency: {
              type: Type.STRING,
              description: 'One of: STANDARD, URGENT_TODAY, IMMOBILISED, SAFETY_CRITICAL',
            },
            safetyAdvisory: {
              type: Type.STRING,
              description: 'Safety warning if brakes, overheating, smoke, or road hazard is mentioned; otherwise empty string.',
            },
            suggestedMechanicNote: {
              type: Type.STRING,
              description: 'Tools and bay checks the mechanic should prepare before inspecting the vehicle.',
            },
            customerAcknowledgementDraft: {
              type: Type.STRING,
              description: 'Truthful WhatsApp/SMS draft referencing the Lead ID, stating the secretary is checking bay availability and that pricing follows inspection.',
            },
          },
          required: [
            'symptomSummary',
            'classifiedServiceSlug',
            'classifiedUrgency',
            'safetyAdvisory',
            'suggestedMechanicNote',
            'customerAcknowledgementDraft',
          ],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) return deterministic;
    const parsed = JSON.parse(rawText);

    const allowedSlugs = new Set(params.config.services.map((s) => s.slug));
    const classifiedServiceSlug = allowedSlugs.has(parsed.classifiedServiceSlug)
      ? parsed.classifiedServiceSlug
      : deterministic.classifiedServiceSlug;

    const allowedUrgencies = new Set<string>(Object.values(UrgencyLevel));
    // Never downgrade a deterministic SAFETY_CRITICAL flag
    const classifiedUrgency =
      deterministic.classifiedUrgency === UrgencyLevel.SAFETY_CRITICAL
        ? UrgencyLevel.SAFETY_CRITICAL
        : allowedUrgencies.has(parsed.classifiedUrgency)
        ? (parsed.classifiedUrgency as UrgencyLevel)
        : deterministic.classifiedUrgency;

    return {
      symptomSummary:
        typeof parsed.symptomSummary === 'string' && parsed.symptomSummary.length > 5
          ? parsed.symptomSummary.slice(0, 280)
          : deterministic.symptomSummary,
      classifiedServiceSlug,
      classifiedUrgency,
      safetyAdvisory:
        deterministic.safetyAdvisory ||
        (typeof parsed.safetyAdvisory === 'string' && parsed.safetyAdvisory.trim().length > 0
          ? parsed.safetyAdvisory.slice(0, 280)
          : null),
      suggestedAssigneeRole: 'SECRETARY',
      suggestedMechanicNote:
        typeof parsed.suggestedMechanicNote === 'string' && parsed.suggestedMechanicNote.length > 5
          ? parsed.suggestedMechanicNote.slice(0, 280)
          : deterministic.suggestedMechanicNote,
      customerAcknowledgementDraft:
        typeof parsed.customerAcknowledgementDraft === 'string' &&
        parsed.customerAcknowledgementDraft.includes(params.leadId)
          ? parsed.customerAcknowledgementDraft.slice(0, 420)
          : deterministic.customerAcknowledgementDraft,
      reviewRequestDraft: deterministic.reviewRequestDraft,
      generatedBy: 'GEMINI_BOUNDED_SCHEMA',
      generatedAtUtc: new Date().toISOString(),
    };
  } catch {
    // Graceful fallback if Gemini API quota is exhausted or key is unconfigured
    return deterministic;
  }
}
