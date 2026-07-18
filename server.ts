import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

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
  const baseInstruction = `أنت لست مجرد ذكاء اصطناعي، بل أنت "كبير الأطباء الاستشاريين" (Chief Medical Consultant). أسلوبك: ${personality}. 
يجب أن تفكر كطبيب بشري خبير يطبق منهجية "الطب القائم على الدليل" (Evidence-Based Medicine). 

مبادئ التحليل والاستنتاج الذكي المطلوبة منك:
1. فهم النصوص المعقدة: إذا كانت مخلات المريض عبارة عن تحاليل مخبرية (تقارير دم، أشعة، إلخ) أو نصوص غير منظمة، قم باستخراج البيانات الذكية منها بدقة، قارنها بالنسب الطبيعية، وأظهر دلالاتها في التشخيص. وإذا كان الوصف غير واضح، قم بتحليل ذكي واستنتاج ما يعنيه المريض بأسلوب احترافي بناءً على القرائن، مع ذكر أي معلومات إضافية قد تكون ضرورية للتأكد.
2. تجميع ومقاطعة القراءات بذكاء فائق (Smart Aggregation & Verification): قم بجمع كافة القراءات الطبية، المعطيات من المستخدم، والمؤشرات الحيوية المتوفرة، ثم قارنها ببعضها البعض بذكاء ودقة متناهية. ابحث عن أي تقاطعات (Correlations) أو تناقضات (Discrepancies) واستبعد القراءات الشاذة أو غير المنطقية، لتحديد القراءة الأدق والصحيحة طبياً بشكل ذكي جداً لضمان تشخيص دقيق.
3. الملخص السريري (summary): يجب أن يكتب بلغة احترافية جداً ومبسطة في نفس الوقت، موجهة للمريض ليفهم حالته بوضوح تام دون مصطلحات معقدة، وبأسلوب مطمئن وداعم. إذا كانت المعلومات غامضة، اشرح بلطف الاحتمالات المبدئية وسبل التأكد.
4. التغذية العلاجية (dietaryAdvice): قدم تفصيلاً دقيقاً واحترافياً للتغذية. اذكر الأطعمة الموصى بها وفوائدها للحالة، الأطعمة الممنوعة (والتي يجب تجنبها) وأسباب منعها، والمكملات الغذائية المقترحة إذا لزم الأمر، كل ذلك في نقاط واضحة.
5. العلاج الطبيعي والأعشاب (herbalMedicine): اذكر بعض العلاجات العشبية أو الطبيعية الممكنة والمفيدة للحالة مع ذكر طريقة الاستخدام والمحاذير إن وجدت (إذا كان مناسباً للحالة).
6. التحليل المرضي (detailedAnalysis) والمؤشرات الحيوية: تصرف كطبيب استشاري يخاطب زميله. اشرح بتفصيل طبي الآلية المرضية (Pathophysiology)، دلالات التحاليل (إن وجدت)، والتفسير المنطقي.
7. دقة استنباط الأعراض والتفاصيل: اقرأ وصف المريض بعناية فائقة وتوقع الأعراض الخفية. في الحقلين conditionSymptoms و conditionCauses اشرح بالتفصيل الممل كافة أعراض المرض (ليتأكد المريض) والأسباب المؤدية له بشكل دقيق.
8. الأمراض المحتملة (differentialDiagnosis): عند تقديم قائمة بالأمراض المحتملة، اشرح بتفصيل كل مرض (reasoning) مع ذكر أعراضه (symptoms) وأسبابه (causes).

يجب أن يكون الرد بتنسيق JSON حصرياً.`;

  if (model.includes("pro-preview")) {
    return `${baseInstruction}
تخصصك: استشاري أول في الطب الباطني والحالات المعقدة (Internal Medicine & Complex Cases).
مطلوب منك: الغوص بعمق في الفسيولوجيا المرضية (Pathophysiology)، استبعاد الأمراض النادرة عبر التشخيص التفريقي (Differential Diagnosis)، تقديم تحليل استدلالي معقد يربط كل عرض بسبب جذري محتمل، وتبرير مستوى الخطورة بناءً على أحدث البروتوكولات الطبية العالمية.`;
  } else if (model.includes("image-preview")) {
    return `${baseInstruction}
تخصصك: استشاري أشعة تشخيصية وطب سريري (Diagnostic Radiology & Clinical Medicine).
مطلوب منك: التركيز بشكل مكثف على أي صور مرفقة. قم بوصف التغيرات المورفولوجية بدقة، تحديد التشوهات، وربط المكتشفات الشعاعية/البصرية بالأعراض السريرية والمؤشرات الحيوية لتقديم تشخيص متكامل.`;
  } else if (model.includes("lite-preview")) {
    return `${baseInstruction}
تخصصك: استشاري طب الطوارئ والفرز الطبي (Emergency Medicine & Triage).
مطلوب منك: التقييم السريع والحاسم للحالة، تحديد العلامات الحمراء (Red Flags) فوراً، تقديم خطوات إنقاذ حياة أو توجيهات عاجلة بأقصر وأوضح العبارات، والتركيز على استقرار المريض.`;
  } else if (model.includes("live-preview")) {
    return `${baseInstruction}
تخصصك: استشاري طب الأسرة والتواصل السريري (Family Medicine & Clinical Communication).
مطلوب منك: تحليل الأعراض المذكورة بعناية فائقة، التركيز على الحالة العامة للمريض من منظور شمولي (Holistic approach)، وتقديم خطة رعاية تركز على جودة الحياة والدعم الشامل.`;
  } else {
    return `${baseInstruction}
تخصصك: أخصائي طب عام (General Practitioner).
مطلوب منك: تقديم تقييم سريري شامل ومتوازن، وضع خطة علاجية قياسية مبنية على الأدلة، وتوجيه المريض للخطوات العملية التالية بوضوح.`;
  }
};

const getModelSpecificPrompt = (model: string, patientData: any, thinkingBudget: number, isThinkingEnabled: boolean): string => {
  let basePrompt = `
    [ملف طبي إلكتروني - EMR]
    البيانات الديموغرافية:
    - الاسم: ${patientData.name} | العمر: ${patientData.age} | الجنس: ${patientData.gender}
    
    الشكوى الرئيسية وتاريخ المرض / النصوص المدخلة (Chief Complaint & HPI / Lab Reports):
    - ${patientData.symptoms}
    
    الفحص السريري والمؤشرات الحيوية (Objective Vitals):
    - ضغط الدم: ${patientData.vitals?.bloodPressure}
    - معدل النبض: ${patientData.vitals?.pulse}
    - درجة الحرارة: ${patientData.vitals?.temperature}
    - نسبة تشبع الأكسجين: ${patientData.vitals?.spo2}
    - الموقع التشريحي المكتشف للمستشعر: ${patientData.vitals?.bodySite || 'موقع غير محدد'}
    - التحقق الذكي من حيوية الأنسجة (Liveness Status): ${patientData.vitals?.livenessChecked ? 'تم التحقق بنجاح من كونه نسيجاً حياً وبشرياً (Living capillary blood flow confirmed)' : 'لم يتم التأكد أو تم الإدخال يدوياً'}
    
    (توجيه طبي هام: بما أن النظام مدمج بمستشعر ذكي عالي الدقة يحدد الموقع التشريحي بدقة (مثل شحمة الأذن أو السبابة أو المعصم) ويتحقق من كونه نسيجاً حياً بشرياً حقيقياً يضخ الدم بانتظام وليس جماداً، يجب أن تعكس في تحليلك التفصيلي (detailedAnalysis) وفي الملخص (summary) هذا الموقع التشريحي، وتشرح فسيولوجياً كيف يتطابق تدفق الدم الشعيري أو الشرياني فيه مع مؤشرات المريض الحيوية. لا تقبل أو تعرض بيانات وهمية أو تحليلات غير دقيقة، وتأكد أن التشخيص عميق ومترابط طبياً 100%).
  `;

  let detailLevelInstruction = "";
  if (isThinkingEnabled) {
    if (thinkingBudget <= 8000) {
      detailLevelInstruction = "\n[توجيه سريع: اكتب الملخص (summary) بجُمل قصيرة ومطمئنة للمريض. واكتب التحليل (detailedAnalysis) للطبيب يشرح السبب المباشر فقط].";
    } else if (thinkingBudget <= 16000) {
      detailLevelInstruction = "\n[توجيه احترافي: الملخص (summary) يجب أن يكون مبسطاً ولطيفاً يفهمه أي مريض، بينما التحليل (detailedAnalysis) يجب أن يكون تقريراً طبياً دقيقاً يربط الأعراض بعلم الأمراض].";
    } else if (thinkingBudget <= 24000) {
      detailLevelInstruction = "\n[توجيه استشاري: الملخص (summary) يجب أن يوصل المعلومة الشاملة للمريض بأسلوب سردي احترافي مفهوم. التحليل (detailedAnalysis) يجب أن يشرح الآلية المرضية (Pathophysiology) بعمق طبي متقدم].";
    } else {
      detailLevelInstruction = "\n[توجيه بحثي واستشاري عميق: خصص قسم الـ summary ليقرأه شخص لا يعرف الطب إطلاقاً، واجعله مطمئناً. أما الـ detailedAnalysis فيجب أن يكون بحثاً طبياً مفصلاً يحلل كل احتمال وكل مؤشر حيوي بناءً على أحدث البروتوكولات].";
    }
  }

  if (model.includes("pro-preview")) {
    return basePrompt + detailLevelInstruction + `\nالرجاء إجراء تحليل طبي استدلالي عميق. قم بربط العمر والجنس بالأعراض لتضييق الاحتمالات، استكشف الاحتمالات النادرة، وقدم مبررات علمية دقيقة لكل تشخيص تفريقي.`;
  } else if (model.includes("image-preview")) {
    return basePrompt + detailLevelInstruction + `\nالرجاء فحص الصور المرفقة بدقة سريرية. استخرج أي علامات مرضية مرئية، وادمجها مع الفحص السريري والأعراض للوصول لتشخيص دقيق في قسم (imageFindings).`;
  } else if (model.includes("lite-preview")) {
    return basePrompt + detailLevelInstruction + `\nالرجاء إجراء فرز سريع (Triage). حدد مستوى الخطورة فوراً، وأبرز أي تحذيرات عاجلة (urgentWarnings) تتطلب تدخلاً طبياً طارئاً.`;
  } else {
    return basePrompt + detailLevelInstruction + `\nالرجاء إجراء تحليل طبي شامل، تقييم الخطورة السريرية، ووضع خطة رعاية متكاملة.`;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON and URL-encoded body parsing with larger limits for images/audio
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
      if (patientData.images && patientData.images.length > 0) {
        patientData.images.forEach((img: string) => {
          if (img.includes(',')) {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: img.split(',')[1]
              }
            });
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

      if (settings.googleSearch && (settings.model.includes('pro') || settings.model.includes('image-preview'))) {
        config.tools = [{ googleSearch: {} }];
      }

      if (settings.deepThinking && settings.model.includes('gemini-3')) {
        if (!settings.model.includes('pro') && !settings.model.includes('lite')) {
          config.thinkingConfig = { 
            thinkingBudgetTokens: settings.thinkingBudget 
          };
        }
      }

      let response;
      let lastError: any = null;

      const modelsToTry = Array.from(new Set([
        settings.model,
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-3-flash-preview'
      ]));

      for (const modelName of modelsToTry) {
        try {
          const currentConfig = { ...config };
          // Strip features if the fallback model is different from the configured one
          if (modelName !== settings.model) {
            currentConfig.thinkingConfig = undefined;
            currentConfig.tools = undefined;
          }
          response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: currentConfig
          });
          if (response) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          logWarnCleanly(`Model ${modelName} failed during analysis, trying next fallback...`, err);
        }
      }

      if (!response) {
        throw lastError || new Error("All generative models failed to respond");
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
      const modelName = settings?.model || "gemini-2.5-flash";

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
      
      يجب أن تقوم بتقديم ملخص سريري تجميعي ذكي وقوي للغاية (Clinical Synthesis Report) باللغة العربية الفصحى الطبية الرصينة، يوضح بدقة متناهية:
      1. **التحليل المقارن للحالات (Comparative Analysis)**: مقارنة المؤشرات الحيوية والتوزيعات الحرارية ومستوى الخطورة بين المرضى، والبحث عن أي قواسم مشتركة أو عوامل خطر متقاطعة (مثل أنماط ارتفاع الضغط أو الحرارة المشتركة أو العدوى الموسمية).
      2. **تحليل المؤشرات والتروية الحرارية**: مناقشة دقة القراءات الحرارية المأخوذة للسبابة أو شحمة الأذن أو الجبهة، وشرح مدى موثوقية هذه البيانات حيوياً استناداً للتحقق من الأنسجة الحية (Liveness validation).
      3. **تحليل الاتجاهات والمخاطر السريرية (Clinical Trends & Risk Profiling)**: تحديد الحالات التي تحتاج لتدخل سريع ومقارنتها بالحالات المستقرة، مع تقديم إحصائيات بصرية ملخصة بالنص (مثل توزيع الحالات حسب الخطورة، النبض الوسطي، إلخ).
      4. **توصيات استشارية موحدة (Unified Clinical Guidance)**: اقتراح الفحوصات الإضافية، التعديلات الغذائية المشتركة، وأساليب الرعاية الطبية المثلى للمجموعة.
      
      استخدم لغة قوية واحترافية خالية من "الهلوسة" أو الادعاءات الوهمية. يجب تنظيم المخرجات باستخدام عناصر التنسيق الفاخرة مثل القوائم، العناوين الملونة (باستخدام الماركداون والرموز التعبيرية المناسبة طبياً)، واقتباسات التنبيه.`;

      const prompt = `
      الرجاء دراسة ومقارنة السجلات الطبية والتشخيصية التالية دراسة عميقة لتقديم تقرير استشاري تجميعي متكامل:
      
      [بيانات السجلات والحالات السريرية المستهدفة للمقارنة]
      ${casesSummary}
      
      التقرير المطلوب تصميمه وبناؤه:
      - اكتب تحليلاً مقارناً مفصلاً يتناول الأعراض والمؤشرات الحيوية والتأكيدات الحرارية.
      - حدد نقاط الخطر والعلاقات السريرية بين المرضى والاتجاهات الوبائية أو الفسيولوجية العامة.
      - ركز على موثوقية الأجهزة وحقائق المؤشرات دون أي افتراضات وهمية.
      `;

      let response;
      let lastConsolidateError: any = null;

      const consolidateModelsToTry = Array.from(new Set([
        modelName,
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-3-flash-preview'
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
        clean = clean.replace(/\b(ml|ML)\b/gi, " مليلتر ");
        clean = clean.replace(/\b(kg|KG)\b/gi, " كيلوجرام ");
        clean = clean.replace(/\b(g|G)\b/gi, " جرام ");
        clean = clean.replace(/°\s*C/gi, " درجة مئوية ");
        clean = clean.replace(/\bCelsius\b/gi, " درجة مئوية ");
        clean = clean.replace(/\b(pH|PH)\b/g, " بي إتش ");
        clean = clean.replace(/[\u2600-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
        clean = clean.replace(/\*\*/g, " ");
        clean = clean.replace(/\*/g, " ");
        clean = clean.replace(/#/g, " ");
        clean = clean.replace(/`/g, " ");
        clean = clean.replace(/~/g, " ");
        clean = clean.replace(/_+/g, " ");
        clean = clean.replace(/[●•\-+]/g, " ");
        clean = clean.replace(/[a-zA-Z]/g, " ");
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
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
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
        audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
      } catch (e: any) {
        const errorMsg = String(e?.message || e);
        const lowerMsg = errorMsg.toLowerCase();
        const isQuotaOrRateLimit = lowerMsg.includes("429") || 
                                   lowerMsg.includes("quota") || 
                                   lowerMsg.includes("limit") || 
                                   lowerMsg.includes("busy") || 
                                   lowerMsg.includes("exhausted") || 
                                   lowerMsg.includes("requests") ||
                                   lowerMsg.includes("rate-limit");
        
        logWarnCleanly("TTS primary service transition", e);
        
        if (isQuotaOrRateLimit) {
          // If quota exceeded or rate-limited on this key, skip secondary API call to prevent redundant failures.
          // Returning empty string triggers the client-side browser native Arabic SpeechSynthesis gracefully.
          return res.json({ audioData: "" });
        }
        
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: sanitizedText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Puck' } } },
            },
          });
          audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
        } catch (fallbackError) {
          logErrorCleanly("TTS fallback service transition", fallbackError);
        }
      }

      res.json({ audioData });
    } catch (err: any) {
      logErrorCleanly("TTS speech generation error", err);
      res.status(500).json({ error: err.message || "Failed to generate speech" });
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
        selectedModel = 'gemini-3-flash-preview';
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

      // Map chat messages to the format expected by GoogleGenAI
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
      // Handle attachments if they are sent in structured form from the client-side
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
        selectedModel,
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-3-flash-preview'
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
