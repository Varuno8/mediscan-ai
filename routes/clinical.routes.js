
import express from 'express';
import * as service from '../services/dynamo.service.js';
import { callLLM } from '../services/llm.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
    try {
        const stats = await service.getStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/analytics', async (req, res) => {
    try {
        const analytics = await service.getAnalytics();
        res.json(analytics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/queue', async (req, res) => {
    try {
        const queue = await service.getQueue();
        res.json(queue);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/visits', async (req, res) => {
    try {
        const visit = await service.createVisit(req.body);
        res.json(visit);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/visits/:id', async (req, res) => {
    try {
        const visitData = await service.getVisit(req.params.id);
        res.json(visitData);
    } catch (e) {
        res.status(404).json({ error: 'Visit not found' });
    }
});

router.patch('/visits/:id', async (req, res) => {
    try {
        const result = await service.updateVisit(req.params.id, req.body);
        if (!result) return res.status(404).json({ error: 'Visit not found' });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/visits/:id', async (req, res) => {
    try {
        const result = await service.deleteVisit(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/visits/:id/symptoms', async (req, res) => {
    try {
        const result = await service.addSymptoms(req.params.id, req.body.symptoms);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/visits/:id/medications', async (req, res) => {
    try {
        const result = await service.addMedications(req.params.id, req.body.medications);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/visits/:id/differentials', async (req, res) => {
    try {
        const result = await service.generateDifferentials(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/visits/:id/analysis', async (req, res) => {
    try {
        const result = await service.generateClinicalAnalysis(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/triage', async (req, res) => {
    try {
        const result = await service.createTriageAssessment(req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/triage/queue', async (req, res) => {
    try {
        const result = await service.getTriageQueue();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const response = await service.chatWithAI(req.body.messages);
        res.json({ response });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


router.post('/chat/summarize', async (req, res) => {
    try {
        const result = await service.summarizeConversation(req.body.messages);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/audit-logs', async (req, res) => {
    try {
        const result = await service.getAuditLogs();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/documents/:id', async (req, res) => {
    try {
        const result = await service.getDocument(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(404).json({ error: 'Document not found' });
    }
});

// Process voice input with LLM
router.post('/process-voice', async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const llmResult = await callLLM({
            system: `You are a medical assistant analyzing voice-dictated patient information. Extract structured data and return ONLY valid JSON.

                        Output Format:
                        {
                            "chief_complaint": "Main complaint in brief",
                            "symptoms": [
                                { "text": "symptom name", "severity": "mild/moderate/severe", "duration": "e.g. 3 days", "confidenceScore": 85 }
                            ],
                            "criticality": "Critical" | "Stable",
                            "criticality_reason": "Reason for assessment",
                            "clinical_summary": "Concise summary (2-3 sentences)",
                            "department": "Suggested department (e.g., Cardiology, Emergency)",
                            "facility_name": "General Consultation",
                            "doctor_name": "AI Assistant"
                        }

                        Instructions:
                        1. Extract ALL symptoms mentioned with details (severity, duration)
                        2. Assess criticality based on symptoms described
                        3. Determine appropriate department
                        4. Create a brief clinical summary
                        5. IMPORTANT: Translate ALL text fields (complaints, symptoms, summary) to ENGLISH, regardless of the input language.
                        6. Return ONLY JSON, no additional text`,
            messages: [{ role: 'user', content: `Voice Input: ${transcript}` }],
            jsonMode: true,
        });
        console.log(`[voice] LLM provider: ${llmResult.provider} (${llmResult.model})`);
        let content = llmResult.text || '{}';

        const robustParse = (str) => {
            if (!str) return null;
            let clean = str.trim();
            if (clean.startsWith('```')) {
                clean = clean.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
            }
            if (!clean.startsWith('{')) {
                const s = clean.indexOf('{');
                const e = clean.lastIndexOf('}');
                if (s !== -1 && e !== -1 && e > s) clean = clean.substring(s, e + 1);
            }
            try {
                return JSON.parse(clean);
            } catch (e) {
                try {
                    const noTrailing = clean.replace(/,\s*([\]}])/g, '$1');
                    return JSON.parse(noTrailing);
                } catch (e2) {
                    return null;
                }
            }
        };

        try {
            const clinicalData = robustParse(content);
            if (!clinicalData) throw new Error('Could not parse AI response');

            // Create visit with extracted data
            const visit = await service.createVisit({
                chiefComplaint: clinicalData.chief_complaint || transcript.substring(0, 200),
                visitNotes: `Voice Input: ${transcript}`,
                sourceType: 'voice_input',
                facilityName: clinicalData.facility_name || 'Voice Consultation',
                department: clinicalData.department || 'General',
                providerName: clinicalData.doctor_name || 'AI Assistant',
                confidenceScore: 85,
                criticality: clinicalData.criticality || 'Stable',
                criticalityReason: clinicalData.criticality_reason,
                summary: clinicalData.clinical_summary
            });

            // Add symptoms
            if (clinicalData.symptoms && clinicalData.symptoms.length > 0) {
                await service.addSymptoms(visit.id, clinicalData.symptoms.map(s => ({
                    text: s.text,
                    confidenceScore: s.confidenceScore || 75,
                    severity: s.severity || 'moderate',
                    duration: s.duration || 'not specified',
                    source: 'voice_llm',
                    rawText: s.text
                })));
            }

            res.json({
                visit,
                clinicalData,
                symptomsAdded: clinicalData.symptoms?.length || 0
            });
        } catch (parseError) {
            console.error('Failed to parse LLM response:', parseError);
            res.status(500).json({ error: 'Failed to parse AI response' });
        }
    } catch (error) {
        console.error('Voice processing error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// CLASSIFICATION ROUTES (ICD/SNOMED)
// ==========================================

// Get classifications for a visit
router.get('/classifications/:visitId', async (req, res) => {
    try {
        const classifications = await service.getClassifications(req.params.visitId);
        res.json(classifications);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generate classifications for a visit using AI
router.post('/classifications/generate/:visitId', async (req, res) => {
    try {
        const classifications = await service.generateClassifications(req.params.visitId);
        res.json(classifications);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create a manual classification
router.post('/classifications', async (req, res) => {
    try {
        const classification = await service.createClassification(req.body);
        res.json(classification);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// FEEDBACK ROUTES
// ==========================================

// Submit feedback
router.post('/feedback', async (req, res) => {
    try {
        const feedback = await service.createFeedback(req.body);
        res.json(feedback);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get feedback for a specific target
router.get('/feedback/:targetId', async (req, res) => {
    try {
        const feedback = await service.getFeedback(req.params.targetId);
        res.json(feedback);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get feedback statistics
router.get('/feedback-stats', async (req, res) => {
    try {
        const stats = await service.getFeedbackStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// SYMPTOM HISTORY ROUTES
// ==========================================

// Get symptom history for a visit
router.get('/symptom-history/:visitId', async (req, res) => {
    try {
        const history = await service.getSymptomHistory(req.params.visitId);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add symptom history entry
router.post('/symptom-history', async (req, res) => {
    try {
        const history = await service.createSymptomHistory(req.body);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// PUBLIC HEALTH SURVEILLANCE ROUTES
// ==========================================

// Get surveillance data (trends, top symptoms, etc.)
router.get('/surveillance/data', async (req, res) => {
    try {
        const data = await service.getSurveillanceData();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get outbreak detection alerts
router.get('/surveillance/outbreaks', async (req, res) => {
    try {
        const outbreaks = await service.detectOutbreaks();
        res.json(outbreaks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// ENHANCED SURVEILLANCE ROUTES (PINCODE-BASED)
// ==========================================

// Get enhanced surveillance data with pincode clustering
router.get('/surveillance/enhanced-data', async (req, res) => {
    try {
        const data = await service.getSurveillanceDataEnhanced();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get enhanced outbreak detection by area
router.get('/surveillance/outbreaks-by-area', async (req, res) => {
    try {
        const outbreaks = await service.detectOutbreaksEnhanced();
        res.json(outbreaks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get outbreaks by pincode
router.get('/surveillance/outbreaks/:pincode', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const outbreaks = await service.getOutbreaksByPincode(req.params.pincode);
        res.json(outbreaks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get emergency triage statistics
router.get('/emergency/triage-stats', async (req, res) => {
    try {
        const stats = await service.getEmergencyTriageStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
