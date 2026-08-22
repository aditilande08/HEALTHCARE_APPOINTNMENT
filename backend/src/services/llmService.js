const OpenAI = require('openai');
const config = require('../config');

let client = null;

function getClient() {
  if (!config.openai.apiKey) return null;
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

async function generatePreVisitSummary(symptoms) {
  const openai = getClient();

  if (!openai) {
    console.warn('[LLM] OPENAI_API_KEY not set — skipping pre-visit summary');
    return null;
  }

  const prompt = `Analyse these symptoms and return a JSON object with exactly these fields:
- "urgency": one of "Low", "Medium", or "High"
- "chiefComplaint": a one-sentence summary of the main problem
- "suggestedQuestions": an array of exactly 3 questions the doctor should ask

Respond with valid JSON only, no extra text.

Symptoms: ${symptoms}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
    console.error('[LLM] Pre-visit summary failed:', err.message);
    return null;
  }
}

async function generatePostVisitSummary(notes, prescriptions) {
  const openai = getClient();

  if (!openai) {
    console.warn('[LLM] OPENAI_API_KEY not set — skipping post-visit summary');
    return null;
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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('[LLM] Post-visit summary failed:', err.message);
    return null;
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
