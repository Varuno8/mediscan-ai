// Gemini client with three-tier fallback:
//   1. Vertex AI – gemini-3.1-pro-preview  (GCP credits, project-5def41da)
//   2. Vertex AI – gemini-3.1-flash-lite-preview (same project, faster/cheaper)
//   3. AI Studio – same flash model via API key (free tier, no billing needed)

import { GoogleAuth } from 'google-auth-library';
import { execSync } from 'child_process';
import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const VERTEX_SA_FILE = process.env.VERTEX_SA_FILE
    || `${process.env.HOME}/.config/gcp/vertex-sa.json`;

export const GEMINI_PRO_MODEL   = process.env.GEMINI_MODEL          || 'gemini-3.1-pro-preview';
export const GEMINI_FLASH_MODEL = process.env.GEMINI_FALLBACK_MODEL  || 'gemini-3.1-flash-lite-preview';

// ── Shared payload builder ────────────────────────────────────────────────────

function toGeminiPayload({ system, messages, jsonMode }) {
    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const generationConfig = { temperature: 0.2 };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';

    const payload = { contents, generationConfig };
    const sys = system || messages.find(m => m.role === 'system')?.content;
    if (sys) payload.systemInstruction = { parts: [{ text: sys }] };

    return payload;
}

// ── Vertex AI ─────────────────────────────────────────────────────────────────

let vertexAuth = null;
let cachedVertexToken = null;

function getVertexAuth() {
    if (vertexAuth) return vertexAuth;

    let credentials;
    // Prefer the dedicated Vertex SA file, fall back to GOOGLE_SERVICE_ACCOUNT_JSON env
    if (fs.existsSync(VERTEX_SA_FILE)) {
        credentials = JSON.parse(fs.readFileSync(VERTEX_SA_FILE, 'utf8'));
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }

    vertexAuth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return vertexAuth;
}

async function getVertexToken() {
    if (cachedVertexToken && Date.now() < cachedVertexToken.expiresAt) {
        return cachedVertexToken.token;
    }
    try {
        const client = await getVertexAuth().getClient();
        const res = await client.getAccessToken();
        if (res.token) {
            cachedVertexToken = { token: res.token, expiresAt: Date.now() + 45 * 60_000 };
            return res.token;
        }
    } catch { /* fall through to gcloud */ }

    const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    cachedVertexToken = { token, expiresAt: Date.now() + 45 * 60_000 };
    return token;
}

async function getVertexProject() {
    if (fs.existsSync(VERTEX_SA_FILE)) {
        const sa = JSON.parse(fs.readFileSync(VERTEX_SA_FILE, 'utf8'));
        return sa.project_id;
    }
    return process.env.GOOGLE_PROJECT_ID
        || process.env.DOC_AI_PROJECT_ID
        || 'project-5def41da-b693-4500-a0c';
}

async function callVertex(model, payload) {
    const project = await getVertexProject();
    const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
    const body = JSON.stringify(payload);

    for (let attempt = 0; attempt < 4; attempt++) {
        const token = await getVertexToken();
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body,
        });

        if (res.status === 429 || res.status === 503) {
            const delay = (attempt + 1) * 4000;
            console.warn(`[gemini-vertex:${model}] ${res.status} — retry in ${delay / 1000}s`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`Empty Gemini response from ${model}`);
        return text;
    }

    throw new Error(`Gemini ${model} (Vertex) unavailable after retries`);
}

// ── AI Studio (API key fallback) ──────────────────────────────────────────────

async function callAiStudio(model, payload) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const body = JSON.stringify(payload);

    for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        if (res.status === 429 || res.status === 503) {
            const delay = (attempt + 1) * 4000;
            console.warn(`[gemini-aistudio:${model}] ${res.status} — retry in ${delay / 1000}s`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`Empty Gemini response from ${model}`);
        return text;
    }

    throw new Error(`Gemini ${model} (AI Studio) unavailable after retries`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call Gemini with a given model, trying Vertex first, then AI Studio.
 */
export async function callGemini({ model, system, messages, jsonMode = false }) {
    const payload = toGeminiPayload({ system, messages, jsonMode });

    // Vertex first — uses GCP credits, supports Pro
    try {
        return await callVertex(model, payload);
    } catch (e) {
        console.warn(`[gemini] Vertex failed for ${model}: ${e.message.slice(0, 100)}`);
    }

    // AI Studio fallback — free tier, flash models only
    return callAiStudio(GEMINI_FLASH_MODEL, payload);
}
