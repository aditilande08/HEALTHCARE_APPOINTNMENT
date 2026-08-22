const OpenAI = require('openai');
const config = require('../config');

let client = null;

function getClient() {
  if (!config.openai.apiKey) return null;
  if (!client) {
    client = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: config.openai.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://healthcare-frontend-i4v0.onrender.com', // Optional OpenRouter header
        'X-Title': 'Health Is Aura Portal'
      }
    });
  }
  return client;
}

function getMockPreVisitSummary(symptoms) {
  const s = (symptoms || '').toLowerCase();
  
  if (s.includes('chest') || s.includes('heart') || s.includes('breath') || s.includes('pain') || s.includes('severe')) {
    return {
      urgency: 'High',
      chiefComplaint: 'Patient reports acute chest/respiratory distress or severe discomfort.',
      suggestedQuestions: [
        'How long have you had this chest discomfort or breathing issue?',
        'Does the pain radiate to your left arm, neck, or back?',
        'Are you experiencing accompanying symptoms like cold sweats, nausea, or dizziness?'
      ]
    };
  }

  if (s.includes('fever') || s.includes('cough') || s.includes('throat') || s.includes('headache') || s.includes('cold')) {
    return {
      urgency: 'Medium',
      chiefComplaint: 'Patient presents with acute symptoms of a potential respiratory infection or fever.',
      suggestedQuestions: [
        'Have you taken your temperature, and if so, what was the highest reading?',
        'Is your cough dry or producing phlegm?',
        'Are you experiencing associated muscle aches, chills, or difficulty swallowing?'
      ]
    };
  }

  return {
    urgency: 'Low',
    chiefComplaint: 'Patient reports mild or general physical symptoms for clinical assessment.',
    suggestedQuestions: [
      'When did you first notice these symptoms, and have they changed over time?',
      'Does anything specific make the symptoms better or worse?',
      'Have you tried any over-the-counter medications or home remedies?'
    ]
  };
}

function getMockPostVisitSummary(notes, prescriptions) {
  const prescriptionList = prescriptions && prescriptions.length > 0
    ? prescriptions.map(p => `- ${p.medication} (${p.dose}): ${p.frequency} for ${p.days} days`).join('\n')
    : 'No active prescriptions.';

  return `CLINICAL SUMMARY (LOCAL AI SIMULATOR):
Based on your visit, here is a summary of the clinical findings:
${notes}

MEDICATION SCHEDULE:
${prescriptionList}

FOLLOW-UP STEPS:
- Monitor your symptoms closely over the coming days.
- Ensure proper rest and hydration.
- If your symptoms worsen or do not improve within 3 to 5 days, please contact the clinic.`;
}

async function generatePreVisitSummary(symptoms) {
  const openai = getClient();

  if (!openai) {
    console.warn('[LLM] OPENAI_API_KEY not set — using smart rule-based simulator');
    return getMockPreVisitSummary(symptoms);
  }

  const prompt = `Analyse these symptoms and return a JSON object with exactly these fields:
- "urgency": one of "Low", "Medium", or "High"
- "chiefComplaint": a one-sentence summary of the main problem
- "suggestedQuestions": an array of exactly 3 questions the doctor should ask

Respond with valid JSON only, no extra text.

Symptoms: ${symptoms}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'google/gemma-2-9b-it:free',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw);

    // validate the shape before storing
    if (!parsed.urgency || !parsed.chiefComplaint || !Array.isArray(parsed.suggestedQuestions)) {
      throw new Error('Unexpected LLM response shape');
    }

    return {
      urgency: parsed.urgency,
      chiefComplaint: parsed.chiefComplaint,
      suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
    };
  } catch (err) {
    console.error('[LLM] Pre-visit summary failed, using fallback:', err.message);
    return getMockPreVisitSummary(symptoms);
  }
}

async function generatePostVisitSummary(notes, prescriptions) {
  const openai = getClient();

  if (!openai) {
    console.warn('[LLM] OPENAI_API_KEY not set — using local mock summary');
    return getMockPostVisitSummary(notes, prescriptions);
  }

  const prescriptionText =
    prescriptions && prescriptions.length > 0
      ? prescriptions
          .map((p) => `${p.medication} ${p.dose} — ${p.frequency} for ${p.days} days`)
          .join('\n')
      : 'No prescriptions';

  const prompt = `Convert these clinical notes into a patient-friendly summary. Write clearly for someone with no medical background.

Include:
1. What the doctor found (in simple terms)
2. Medication schedule (based on prescriptions below)
3. Follow-up steps and what to watch for

Clinical notes: ${notes}

Prescriptions:
${prescriptionText}

Write the summary in plain paragraphs, no bullet points, no medical jargon.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'google/gemma-2-9b-it:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('[LLM] Post-visit summary failed, using fallback:', err.message);
    return getMockPostVisitSummary(notes, prescriptions);
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
