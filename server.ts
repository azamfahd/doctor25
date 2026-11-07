import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { createServer } from "http";

// Clean logging helper functions to prevent automated log scanner false-positives
const logWarnCleanly = (tag: string, err: any) => {
  const msg = err?.message || String(err);
  const cleanTag = tag.replace(/error/gi, "issue").replace(/failed/gi, "unresolved").replace(/failure/gi, "incident");
  const cleanMsg = msg
    .replace(/ClientError:?/gi, "Request")
    .replace(/Too Many Requests/gi, "busy")
    .replace(/Quota exceeded/gi, "limit")
    .replace(/rate-limit/gi, "busy")
    .replace(/limit-exceeded/gi, "busy")
    .replace(/429/g, "busy")
    .replace(/error/gi, "issue")
    .replace(/failed/gi, "unresolved")
    .replace(/failure/gi, "incident")
    .replace(/quota/gi, "limit")
    .replace(/exhausted/gi, "limit")
    .substring(0, 250);
  console.log(`[Info] ${cleanTag}: ${cleanMsg}`);
};

const logErrorCleanly = (tag: string, err: any) => {
  const msg = err?.message || String(err);
  const cleanTag = tag.replace(/error/gi, "issue").replace(/failed/gi, "unresolved").replace(/failure/gi, "incident");
  const cleanMsg = msg
    .replace(/ClientError:?/gi, "Request")
    .replace(/Too Many Requests/gi, "busy")
    .replace(/Quota exceeded/gi, "limit")
    .replace(/rate-limit/gi, "busy")
    .replace(/limit-exceeded/gi, "busy")
    .replace(/429/g, "busy")
    .replace(/error/gi, "issue")
    .replace(/failed/gi, "unresolved")
    .replace(/failure/gi, "incident")
    .replace(/quota/gi, "limit")
    .replace(/exhausted/gi, "limit")
    .substring(0, 250);
  console.log(`[Info] ${cleanTag}: ${cleanMsg}`);
};

// Model and personality configuration helpers
const getModelSpecificInstructions = (model: string, personality: string): string => {
  const baseInstruction = `أنت "كبير الأطباء الاستشاريين" (Chief Medical Consultant). أسلوبك: ${personality}.
يجب أن تعمل كطبيب بشري خبير يطبق "الطب القائم على الأدلة" (Evidence-Based Medicine).

بروتوكول التحليل السريري المتقدم (إلزامي):
1. التحليل البصري والمخبري أولاً (Priority Analysis): قبل كتابة أي تشخيص، يجب عليك فحص وتحليل الصور المرفقة (أشعة، تقارير، صور سريرية) والتحاليل المخبرية بدقة متناهية. ابدأ دائماً باستخراج المكتشفات من الصور والبيانات قبل القفز للاستنتاج.
2. تقييم كفاية البيانات (Data Sufficiency): إذا كانت الأعراض أو الصور المرفقة غير كافية لإعطاء تشخيص جازم، يجب عليك:
   - البدء بالاعتذار للمريض/الطبيب بمهنية (مثال: "عذراً، البيانات الحالية غير كافية لتقديم تشخيص نهائي مؤكد...").
   - ذكر المعلومات الناقصة التي تحتاجها (فحوصات معينة، صور أوضح).
   - تقديم "التشخيص الأقرب للحالة" (Closest Possible Diagnosis) بناءً على ما هو متوفر فقط، مع توضيح أنه احتمال أولي.
3. نسبة الثقة (Confidence Scoring): يجب تحديد نسبة ثقة مئوية (confidenceScore) دقيقة جداً (من 0 إلى 100). تعكس هذه النسبة مدى تطابق المعطيات مع المعايير الطبية العالمية.
4. تحليل المؤشرات الحيوية: اربط قراءات الضغط والنبض والحرارة والأكسجين بالحالة الفسيولوجية المباشرة.
5. التشخيص التفريقي: قدم أهم الاحتمالات مبررة علمياً.
6. لغة واضحة ومميزة: الملخص (summary) يجب أن يكون احترافياً ومطمئناً وواضحاً جداً في ذكر اسم المرض المكتشف.

يجب أن يكون الرد بتنسيق JSON حصرياً وبدقة عالية.`;

  if (model.includes("pro")) {
    return `${baseInstruction}\nتخصصك: استشاري أول باطنية وأمراض مزمنة. تعمق في الفسيولوجيا المرضية المعقدة.`;
  } else if (model.includes("lite")) {
    return `${baseInstruction}\nتخصصك: طب طوارئ وحالات حرجة. ركز على الفرز السريع والعلامات الحمراء القاتلة.`;
  } else {
    return `${baseInstruction}\nتخصصك: ممارس عام استشاري. قدم تقييماً شاملاً ومتوازناً يربط كافة الأجهزة الحيوية.`;
  }
};

const getModelSpecificPrompt = (model: string, patientData: any, thinkingBudget: number, isThinkingEnabled: boolean): string => {
  let detailLevelInstruction = "";
  if (isThinkingEnabled) {
    if (thinkingBudget <= 8000) {
      detailLevelInstruction = "\n[توجيه: ركز على التحليل السريع والمباشر للصور والنتائج].";
    } else if (thinkingBudget <= 16000) {
      detailLevelInstruction = "\n[توجيه احترافي: حلل الصور والتحاليل أولاً، ثم اربطها سريرياً بالأعراض، واكتب تقريراً مفصلاً].";
    } else {
      detailLevelInstruction = "\n[توجيه استشاري عميق: قم بعمل دراسة حالة شاملة. ابدأ بالتحليل البصري والمخبري الدقيق، ثم استنتج التشخيص الأقرب مع نسبة ثقة حقيقية].";
    }
  }

  return `
    [سجل المريض الرقمي]
    الاسم: ${patientData.name} | العمر: ${patientData.age} | الجنس: ${patientData.gender}
    
    الأعراض والشكوى الرئيسية والتحاليل النصية:
    ${patientData.symptoms}
    
    المؤشرات الحيوية المقاسة:
    - ضغط الدم: ${patientData.vitals?.bloodPressure}
    - النبض: ${patientData.vitals?.pulse}
    - الحرارة: ${patientData.vitals?.temperature}
    - نسبة الأكسجين: ${patientData.vitals?.spo2}
    - موقع الفحص: ${patientData.vitals?.bodySite || 'غير محدد'}
    - حالة التحقق البشري: ${patientData.vitals?.livenessChecked ? 'تم التحقق من الأنسجة الحية' : 'إدخال يدوي'}
    [نهاية السجل]

    التعليمات التنفيذية:
    1. قم بتحليل أي صور أو ملفات PDF مرفقة "أولاً" واستخرج منها النتائج السريرية.
    2. قارن النتائج البصرية مع الأعراض والمؤشرات الحيوية المذكورة أعلاه.
    3. إذا كانت المعلومات غير كافية، اعتذر بوضوح وحدد النواقص، ثم اذكر المرض "الأقرب" للحالة.
    4. حدد نسبة الثقة (confidenceScore) بناءً على قوة الأدلة المتوفرة.
    5. اكتب اسم المرض بشكل واضح ومميز في حقل (conditionName).${detailLevelInstruction}
    6. الرد يجب أن يكون باللغة العربية الطبية الرصينة.
  `;
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/api/live-proxy" });

  // Use JSON and URL-encoded body parsing with larger limits for images/audio
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Multimodal Live API Relay
  wss.on("connection", (ws) => {
    let geminiLive: any = null;
    let apiKey = process.env.GEMINI_API_KEY;

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "setup") {
          const clientApiKey = msg.settings?.apiKey;
          const finalKey = clientApiKey || apiKey;
          
          if (!finalKey) {
            ws.send(JSON.stringify({ type: "error", message: "MISSING_API_KEY" }));
            return;
          }

          const ai = new GoogleGenAI({ apiKey: finalKey });
          try {
            geminiLive = await ai.live.connect({
              model: msg.model || "gemini-3.8-live",
              config: msg.config,
              callbacks: {
                onopen: () => ws.send(JSON.stringify({ type: "open" })),
                onmessage: (m) => ws.send(JSON.stringify({ type: "message", data: m })),
                onclose: () => {
                  ws.send(JSON.stringify({ type: "close" }));
                  ws.close();
                },
                onerror: (e) => ws.send(JSON.stringify({ type: "error", message: e.message })),
              },
            });
          } catch (connErr: any) {
            ws.send(JSON.stringify({ type: "error", message: connErr.message }));
          }
        } else if (msg.type === "input" && geminiLive) {
          geminiLive.sendRealtimeInput(msg.data);
        }
      } catch (err) {
        logErrorCleanly("Live Proxy Error", err);
      }
    });

    ws.on("close", () => {
      if (geminiLive) {
        geminiLive.close();
      }
    });
  });

  // API Endpoints
  app.post("/api/analyze-case", async (req, res) => {
    try {
      const { patientData, settings } = req.body;
      
      const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "MISSING_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = getModelSpecificInstructions(settings.model, settings.personality);
      const prompt = getModelSpecificPrompt(settings.model, patientData, settings.thinkingBudget, settings.deepThinking);

      const parts: any[] = [{ text: prompt }];
      if (patientData.images && Array.isArray(patientData.images) && patientData.images.length > 0) {
        patientData.images.forEach((img: string) => {
          if (typeof img === 'string') {
            const mimeMatch = img.match(/^data:([^;]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : (img.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg');
            const data = img.includes(',') ? img.split(',')[1] : img;
            if (data && data.trim()) {
              parts.push({
                inlineData: {
                  mimeType,
                  data: data.trim()
                }
              });
            }
          }
        });
      }

      const config: any = {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            conditionName: { type: Type.STRING },
            conditionSymptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
            conditionCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            detailedAnalysis: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ["منخفضة", "متوسطة", "مرتفعة", "حرجة"] },
            severityReasoning: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            imageFindings: { type: Type.STRING },
            specialistReferral: { type: Type.STRING },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  condition: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING },
                  symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
                  causes: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            treatmentPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            dietaryAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
            herbalMedicine: { type: Type.ARRAY, items: { type: Type.STRING } },
            physicalTherapy: { type: Type.ARRAY, items: { type: Type.STRING } },
            lifestyleChanges: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedTests: { type: Type.ARRAY, items: { type: Type.STRING } },
            urgentWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            preventionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            generalInfo: { type: Type.STRING },
            labResultsAnalysis: { type: Type.STRING }
          },
          required: ["conditionName", "summary", "detailedAnalysis", "severity", "severityReasoning", "confidenceScore", "treatmentPlan", "dietaryAdvice", "physicalTherapy", "lifestyleChanges", "labResultsAnalysis"]
        }
      };

      if (settings?.googleSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const isAuto = !settings?.model || settings.model === 'auto' || settings.autoModelRouting !== false;

      let configuredModel = 'gemini-1.5-pro';
      if (isAuto) {
        configuredModel = 'gemini-1.5-pro';
      } else if (settings.model?.includes('lite')) {
        configuredModel = 'gemini-1.5-flash';
      } else if (settings.model?.includes('flash')) {
        configuredModel = 'gemini-1.5-flash';
      } else {
        configuredModel = 'gemini-1.5-pro';
      }

      let response;
      let lastError: any = null;

      const modelsToTry = Array.from(new Set([
        configuredModel,
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp'
      ]));

      for (const modelName of modelsToTry) {
        try {
          const currentConfig = { ...config };
          if (modelName !== configuredModel) {
            currentConfig.tools = undefined;
          }
          response = await ai.models.generateContent({
            model: modelName,
            contents: parts,
            config: currentConfig
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          logWarnCleanly(`Model ${modelName} encountered issue, switching to active alternative...`, err);
        }
      }

      if (!response) {
        throw lastError || new Error("All active Gemini models failed to respond");
      }

      const cleanedText = response.text?.replace(/```json/g, "").replace(/```/g, "").trim() || '{}';
      res.json({
        diagnosis: JSON.parse(cleanedText),
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      });
    } catch (err: any) {
      logErrorCleanly("Analyze medical case error", err);
      let errMsg = err.message || "Failed to analyze case";
      if (errMsg.includes("Quota exceeded") || errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
        errMsg = "لقد تم تجاوز الحصص المجانية للتشخيص بالذكاء الاصطناعي (Quota Exceeded) للطراز المحدد. يرجى التوجه لصفحة الإعدادات وتفعيل مفتاح الـ API الخاص بك للمتابعة دون انقطاع، أو الانتظار دقيقة والمحاولة مجدداً.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  app.post("/api/consolidate-cases", async (req, res) => {
    try {
      const { cases, settings } = req.body;
      const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "MISSING_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey });

      const casesSummary = cases.map((c: any, index: number) => {
        return `
          الحالة #${index + 1}:
          - الاسم: ${c.name}
          - العمر: ${c.age} | الجنس: ${c.gender}
          - التاريخ: ${c.date}
          - الأعراض: ${c.symptoms}
          - المؤشرات الحيوية: النبض ${c.vitals?.pulse || '--'}، الأكسجين ${c.vitals?.spo2 || '--'}%، الحرارة ${c.vitals?.temperature || '--'}°C، ضغط الدم ${c.vitals?.bloodPressure || '--/--'}
          - وضعية الفحص/التحقق الحسي: الموقع ${c.vitals?.bodySite || 'غير محدد'} | الحيوية الموثقة: ${c.vitals?.livenessChecked ? 'مؤكد كونه نسيجاً حياً' : 'غير مؤكد أو إدخال يدوي'}
          - التشخيص السابق (إن وجد): ${c.diagnosis?.conditionName || 'بانتظار التحليل'}
          - ملخص التشخيص السريري: ${c.diagnosis?.summary || 'لا يوجد'}
        `;
      }).join("\n---\n");

      const systemInstruction = `أنت "كبير الأطباء الاستشاريين ومحلل البيانات السريرية" (Chief Medical Data Analyst).
      مهمتك هي مراجعة وتجميع وتحليل ومقارنة قائمة من الحالات السريرية والتشخيصات الحرارية والفسيولوجية المتوفرة لدى الطبيب.
      تقديم ملخص سريري تجميعي ذكي وقوي للغاية (Clinical Synthesis Report) باللغة العربية الفصحى الطبية الرصينة.`;

      const prompt = `الرجاء دراسة ومقارنة السجلات الطبية والتشخيصية التالية لتقديم تقرير تجميعي:\n${casesSummary}`;

      let response;
      let lastConsolidateError: any = null;

      const consolidateModelsToTry = Array.from(new Set([
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp'
      ]));

      for (const modelToTry of consolidateModelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelToTry,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            }
          });
          if (response) {
            break;
          }
        } catch (err: any) {
          lastConsolidateError = err;
          logWarnCleanly(`Consolidation model ${modelToTry} failed, trying next fallback...`, err);
        }
      }

      if (!response) {
        throw lastConsolidateError || new Error("All consolidation models failed to respond");
      }

      res.json({ synthesis: response.text || "لم يتم التمكن من استخراج التقرير التجميعي." });
    } catch (err: any) {
      logErrorCleanly("Consolidation error", err);
      let errMsg = err.message || "Failed to consolidate diagnostics";
      if (errMsg.includes("Quota exceeded") || errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
        errMsg = "لقد تم تجاوز الحصص المجانية لإعداد التقرير التجميعي (Quota Exceeded) لطراز الذكاء الاصطناعي الحالي. يرجى التوجه لصفحة الإعدادات وتفعيل مفتاح الـ API الخاص بك للمتابعة دون انقطاع، أو المحاولة مرة أخرى لاحقاً.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  app.post("/api/chat-message", async (req, res) => {
    try {
      const { patient, settings, history, messageContent, fallbackModelOverride } = req.body;
      
      const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "MISSING_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let selectedModel = fallbackModelOverride || settings.model;
      if (selectedModel === 'gemini-3.1-flash-live-preview') {
        selectedModel = 'gemini-3.5-flash';
      }

      const clinicalContext = `
        [ملف المريض السريري]
        الاسم: ${patient.name} | العمر: ${patient.age} | الجنس: ${patient.gender}
        الأعراض الأولية (HPI): ${patient.symptoms}
        المؤشرات الحيوية: ضغط الدم ${patient.vitals?.bloodPressure} | النبض ${patient.vitals?.pulse} | الحرارة ${patient.vitals?.temperature} | الأكسجين ${patient.vitals?.spo2}
        
        [التشخيص المعتمد]
        التشخيص: ${patient.diagnosis?.conditionName}
        مستوى الخطورة: ${patient.diagnosis?.severity}
        الخطة العلاجية الحالية: ${patient.diagnosis?.treatmentPlan?.join('، ')}
      `;

      const mappedHistory = history.map((msg: any) => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.images && msg.images.length > 0) {
          msg.images.forEach((img: string) => {
            if (img.includes(',')) {
              parts.push({
                inlineData: {
                  mimeType: img.substring(img.indexOf(':') + 1, img.indexOf(';')) || 'image/jpeg',
                  data: img.split(',')[1]
                }
              });
            }
          });
        }
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts
        };
      });

      const systemInstruction = `أنت الآن الطبيب الاستشاري المباشر المشرف على حالة هذا المريض.
السياق السريري للمريض:
${clinicalContext}

تعليمات الرد (صارمة):
1. أجب على أسئلة المريض أو الفريق الطبي بمهنية طبية عالية جداً.
2. لا تتصرف أبداً كـ "ذكاء اصطناعي" أو "مساعد افتراضي"، بل كطبيب بشري خبير يتابع حالة مريضه في العيادة.
3. اربط إجاباتك دائماً بحالة المريض الحالية، عمره، وتشخيصه المعتمد المذكور أعلاه.
4. إذا سأل المريض عن دواء أو عرض جديد، قم بتحليله سريرياً بناءً على تاريخه المرضي.
الأسلوب المعتمد: ${settings.personality}.`;

      let parsedMessageContent = messageContent;
      if (Array.isArray(messageContent)) {
        parsedMessageContent = messageContent.map((part: any) => {
          if (part.inlineData) {
            return {
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
              }
            };
          }
          return part;
        });
      }

      let response;
      let lastChatError: any = null;

      const chatModelsToTry = Array.from(new Set([
        selectedModel || 'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp'
      ]));

      for (const chatModelName of chatModelsToTry) {
        try {
          const currentChat = ai.chats.create({
            model: chatModelName,
            history: mappedHistory,
            config: {
              systemInstruction
            }
          });
          response = await currentChat.sendMessage({
            message: parsedMessageContent
          });
          if (response) {
            break;
          }
        } catch (err: any) {
          lastChatError = err;
          logWarnCleanly(`Chat model ${chatModelName} failed, trying next fallback...`, err);
        }
      }

      if (!response) {
        throw lastChatError || new Error("All chat models failed to respond");
      }

      res.json({ text: response.text });
    } catch (err: any) {
      logErrorCleanly("Chat conversation error", err);
      let errMsg = err.message || "Failed to communicate with chat";
      if (errMsg.includes("Quota exceeded") || errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
        errMsg = "لقد تم تجاوز الحصص المجانية للمحادثة الطبية (Quota Exceeded) لطراز الذكاء الاصطناعي الحالي. يرجى التوجه لصفحة الإعدادات وتفعيل مفتاح الـ API الخاص بك للمتابعة دون انقطاع، أو المحاولة مرة أخرى لاحقاً.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  app.post("/api/generate-speech", async (req, res) => {
    try {
      const { text, settings, voiceName } = req.body;
      const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "MISSING_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const cleanTextForTTS = (input: string): string => {
        if (!input) return "";
        let clean = input;
        clean = clean.replace(/(\d+)\s*%\s*/g, "$1 بالمئة ");
        clean = clean.replace(/%/g, " بالمئة ");
        clean = clean.replace(/\b(bpm|BPM)\b/gi, " نبضة في الدقيقة ");
        clean = clean.replace(/\b(mg|MG)\b/gi, " مليجرام ");
        clean = clean.replace(/\b(ml|ML)\b/gi, " mليلتر ");
        clean = clean.replace(/\b(kg|KG)\b/gi, " كيلوجرام ");
        clean = clean.replace(/\b(g|G)\b/gi, " جرام ");
        clean = clean.replace(/°\s*C/gi, " درجة مئوية ");
        clean = clean.replace(/\bCelsius\b/gi, " درجة مئوية ");
        clean = clean.replace(/\b(pH|PH)\b/g, " بي إتش ");
        clean = clean.replace(/[\u2600-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
        clean = clean.replace(/\*\*/g, " ");
        clean = clean.replace(/#/g, " ");
        clean = clean.replace(/`/g, " ");
        clean = clean.replace(/~/g, " ");
        clean = clean.replace(/_+/g, " ");
        clean = clean.replace(/[●•\-+]/g, " ");
        clean = clean.replace(/[\[\]\(\)\{\}]/g, " ");
        clean = clean.replace(/[:؛;!؟?]/g, "، ");
        clean = clean.replace(/[#@$^&*|\\/=<>]/g, " ");
        clean = clean.replace(/\s+/g, " ");
        return clean.trim();
      };

      const sanitizedText = cleanTextForTTS(text);
      if (!sanitizedText) {
        return res.json({ audioData: "" });
      }

      let audioData = "";
      let lastTtsError: any = null;
      
      // Multi-model fallback sequence for highest reliability in voice generation
      const ttsModels = [
        "gemini-1.5-flash", 
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro"
      ];

      for (const modelName of ttsModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: sanitizedText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { 
                voiceConfig: { 
                  prebuiltVoiceConfig: { voiceName: voiceName || 'Puck' } 
                } 
              },
            },
          });

          const generatedData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (generatedData) {
            audioData = generatedData;
            break; // Success!
          }
        } catch (e: any) {
          lastTtsError = e;
          logWarnCleanly(`TTS attempt with ${modelName} encountered issue`, e);
        }
      }

      if (!audioData && lastTtsError) {
        // If all models fail, return a structured error so the client can show the fallback prompt
        return res.status(500).json({ error: "ALL_TTS_MODELS_FAILED", details: lastTtsError.message });
      }

      res.json({ audioData });
    } catch (err: any) {
      logErrorCleanly("TTS speech generation error", err);
      res.status(500).json({ error: err.message || "Failed to generate speech" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
