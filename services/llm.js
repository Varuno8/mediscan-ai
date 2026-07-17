// Unified LLM helper — uses Groq (llama) as primary, Gemini as fallback
import { callGemini, GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL } from './gemini.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

async function callGroq({ system, messages, jsonMode }) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const fullMessages = system
        ? [{ role: 'system', content: system }, ...messages.filter(m => m.role !== 'system')]
        : messages;

    const body = {
        model: GROQ_MODEL,
        messages: fullMessages.map(m => ({ role: m.role, content: m.content })),
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Groq response');
    return text;
}

/**
 * Try Groq → Gemini Pro → Gemini Flash, returning the first successful text reply.
 * @param {Object} args
 * @param {string} [args.system]
 * @param {Array<{role:string,content:string}>} args.messages
 * @param {boolean} [args.jsonMode]
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function callLLM({ system, messages, jsonMode = false }) {
    const errors = [];

    // 1. Groq (primary)
    try {
        const text = await callGroq({ system, messages, jsonMode });
        return { text, provider: 'groq', model: GROQ_MODEL };
    } catch (e) {
        const msg = e?.message || String(e);
        console.warn(`[llm] Groq failed: ${msg.slice(0, 200)}`);
        errors.push(`groq: ${msg}`);
    }

    // 2. Gemini Pro
    try {
        const text = await callGemini({ model: GEMINI_PRO_MODEL, system, messages, jsonMode });
        return { text, provider: 'gemini', model: GEMINI_PRO_MODEL };
    } catch (e) {
        const msg = e?.message || String(e);
        console.warn(`[llm] Gemini Pro failed: ${msg.slice(0, 200)}`);
        errors.push(`gemini-pro: ${msg}`);
    }

    // 3. Gemini Flash
    try {
        const text = await callGemini({ model: GEMINI_FLASH_MODEL, system, messages, jsonMode });
        return { text, provider: 'gemini', model: GEMINI_FLASH_MODEL };
    } catch (e) {
        const msg = e?.message || String(e);
        console.warn(`[llm] Gemini Flash failed: ${msg.slice(0, 200)}`);
        errors.push(`gemini-flash: ${msg}`);
    }

    throw new Error(`All LLM providers failed. ${errors.join(' | ')}`);
}
