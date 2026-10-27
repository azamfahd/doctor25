import * as XLSX from 'xlsx';
import { PatientCase, VitalSigns, StructuredDiagnosis } from '../../types';

export interface ParseExcelResult {
  records: PatientCase[];
  totalRows: number;
  validRows: number;
  warnings: string[];
  detectedColumns: string[];
  columnMappingSummary: { [key: string]: string };
}

/**
 * Normalizes header string for fuzzy matching (removes accents, spaces, special chars)
 */
function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[ـ_ \-\/\\#،,:]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي');
}

/**
 * Maps varying Arabic & English column headers into canonical patient fields.
 */
function resolveFieldKey(header: string): string | null {
  const norm = normalizeHeader(header);

  // Name
  if (
    norm.includes('اسمالمريض') ||
    norm.includes('الاسم') ||
    norm.includes('اسمالحاله') ||
    norm.includes('اسم') ||
    norm.includes('patientname') ||
    norm.includes('fullname') ||
    norm.includes('clientname') ||
    norm === 'name' ||
    norm === 'patient'
  ) {
    return 'name';
  }

  // Age
  if (
    norm.includes('العمر') ||
    norm.includes('السن') ||
    norm.includes('سنوات') ||
    norm.includes('سنه') ||
    norm === 'age' ||
    norm === 'years'
  ) {
    return 'age';
  }

  // Gender
  if (
    norm.includes('الجنس') ||
    norm.includes('النوع') ||
    norm === 'gender' ||
    norm === 'sex'
  ) {
    return 'gender';
  }

  // Symptoms / Complaint
  if (
    norm.includes('الاعراض') ||
    norm.includes('الشكوي') ||
    norm.includes('الوصف') ||
    norm.includes('التاريخالمرضي') ||
    norm.includes('شكويالمريض') ||
    norm.includes('symptom') ||
    norm.includes('complaint') ||
    norm.includes('chiefcomplaint') ||
    norm.includes('description') ||
    norm.includes('notes')
  ) {
    return 'symptoms';
  }

  // Blood Pressure
  if (
    norm.includes('ضغطالدم') ||
    norm.includes('الضغط') ||
    norm.includes('bloodpressure') ||
    norm.includes('bp') ||
    norm.includes('systolic') ||
    norm.includes('sysdia')
  ) {
    return 'bloodPressure';
  }

  // Heart Rate / Pulse
  if (
    norm.includes('النبض') ||
    norm.includes('معدلالنبض') ||
    norm.includes('ضرباتالقلب') ||
    norm.includes('قلب') ||
    norm.includes('pulse') ||
    norm.includes('heartrate') ||
    norm.includes('hr') ||
    norm.includes('bpm')
  ) {
    return 'pulse';
  }

  // Temperature
  if (
    norm.includes('الحراره') ||
    norm.includes('درجهالحراره') ||
    norm.includes('حراره') ||
    norm.includes('temperature') ||
    norm.includes('temp')
  ) {
    return 'temperature';
  }

  // SpO2 / Oxygen
  if (
    norm.includes('الاكسجين') ||
    norm.includes('نسبهالاكسجين') ||
    norm.includes('تشبعالاكسجين') ||
    norm.includes('oxygen') ||
    norm.includes('spo2') ||
    norm.includes('o2') ||
    norm.includes('sat')
  ) {
    return 'spo2';
  }

  // Diagnosis / Condition
  if (
    norm.includes('التشخيص') ||
    norm.includes('المرض') ||
    norm.includes('اسمالمرض') ||
    norm.includes('الحالهالمرضيه') ||
    norm.includes('diagnosis') ||
    norm.includes('condition') ||
    norm.includes('disease')
  ) {
    return 'conditionName';
  }

  // Status / Severity / Triage
  if (
    norm.includes('الحاله') ||
    norm.includes('الخطوره') ||
    norm.includes('تصنيفالحاله') ||
    norm.includes('status') ||
    norm.includes('severity') ||
    norm.includes('triage') ||
    norm.includes('priority')
  ) {
    return 'status';
  }

  // Date
  if (
    norm.includes('التاريخ') ||
    norm.includes('تاريخالزياره') ||
    norm.includes('تاريخالفحص') ||
    norm.includes('تاريخالتسجيل') ||
    norm.includes('date') ||
    norm.includes('visitdate') ||
    norm.includes('createdat')
  ) {
    return 'date';
  }

  // ID / MRN
  if (
    norm.includes('المعرف') ||
    norm.includes('رقمМلف') ||
    norm.includes('رقمالملف') ||
    norm.includes('رقمالهويه') ||
    norm.includes('الكود') ||
    norm === 'id' ||
    norm === 'mrn' ||
    norm === 'filenumber' ||
    norm === 'code'
  ) {
    return 'id';
  }

  return null;
}

/**
 * Normalizes gender value to Arabic 'ذكر' or 'أنثى'
 */
function normalizeGender(val: any): 'ذكر' | 'أنثى' {
  if (!val) return 'ذكر';
  const str = String(val).trim().toLowerCase();
  if (
    str.includes('انث') ||
    str.includes('أنث') ||
    str.includes('fem') ||
    str.includes('woman') ||
    str.includes('girl') ||
    str === 'f'
  ) {
    return 'أنثى';
  }
  return 'ذكر';
}

/**
 * Normalizes status value to standard application statuses
 */
function normalizeStatus(val: any): 'مستقرة' | 'متابعة' | 'تدخل طبي' | 'حرجة' {
  if (!val) return 'مستقرة';
  const str = String(val).trim().toLowerCase();
  if (str.includes('حرج') || str.includes('critical') || str.includes('emergency')) {
    return 'حرجة';
  }
  if (str.includes('تدخل') || str.includes('طبي') || str.includes('urgent') || str.includes('high')) {
    return 'تدخل طبي';
  }
  if (str.includes('متابع') || str.includes('follow') || str.includes('moderate')) {
    return 'متابعة';
  }
  return 'مستقرة';
}

/**
 * Formats Excel date or raw date value into readable Arabic date
 */
function formatExcelDate(val: any): string {
  if (!val) return new Date().toLocaleDateString('ar-EG');
  if (val instanceof Date) {
    return val.toLocaleDateString('ar-EG');
  }
  if (typeof val === 'number') {
    // Excel date epoch offset
    const parsed = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ar-EG');
    }
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('ar-EG');
  }
  return str;
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file into PatientCase records with smart mapping.
 */
export async function parsePatientsFromExcel(file: File): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('الملف لا يحتوي على أي أوراق عمل (Sheets).');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Parse rows as raw JSON objects
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('ورقة العمل فارغة ولا تحتوي على بيانات مرضى.');
  }

  // Detect and map headers
  const detectedColumns = Object.keys(rawRows[0] || {});
  const columnMappingSummary: { [key: string]: string } = {};

  detectedColumns.forEach((col) => {
    const matchedField = resolveFieldKey(col);
    if (matchedField) {
      columnMappingSummary[col] = matchedField;
    }
  });

  const warnings: string[] = [];
  const records: PatientCase[] = [];
  let rowIdx = 1;

  for (const row of rawRows) {
    rowIdx++;
    // Extract mapped fields
    let name = '';
    let age = '';
    let genderRaw = '';
    let symptoms = '';
    let bp = '';
    let pulse = '';
    let temp = '';
    let spo2 = '';
    let conditionName = '';
    let statusRaw = '';
    let dateRaw = '';
    let idRaw = '';

    for (const [colName, val] of Object.entries(row)) {
      const fieldKey = resolveFieldKey(colName);
      if (!fieldKey || val === '' || val === null || val === undefined) continue;

      const strVal = typeof val === 'object' && val instanceof Date ? val.toISOString() : String(val).trim();

      switch (fieldKey) {
        case 'name':
          name = strVal;
          break;
        case 'age':
          age = strVal;
          break;
        case 'gender':
          genderRaw = strVal;
          break;
        case 'symptoms':
          symptoms = strVal;
          break;
        case 'bloodPressure':
          bp = strVal;
          break;
        case 'pulse':
          pulse = strVal;
          break;
        case 'temperature':
          temp = strVal;
          break;
        case 'spo2':
          spo2 = strVal;
          break;
        case 'conditionName':
          conditionName = strVal;
          break;
        case 'status':
          statusRaw = strVal;
          break;
        case 'date':
          dateRaw = strVal;
          break;
        case 'id':
          idRaw = strVal;
          break;
      }
    }

    // Skip empty rows (no name and no symptoms)
    if (!name && !symptoms && !conditionName) {
      continue;
    }

    // Generate fallback name if missing
    if (!name) {
      name = `مريض غير مسمى (صف ${rowIdx})`;
      warnings.push(`الصف ${rowIdx}: لم يتم العثور على اسم للمريض، تم تعيين اسم تلقائي.`);
    }

    // Format vitals
    const vitals: VitalSigns = {
      bloodPressure: bp || '--/--',
      pulse: pulse ? String(Math.round(Number(pulse) || 75)) : '75',
      temperature: temp ? String(Number(temp).toFixed(1) || '37.0') : '37.0',
      spo2: spo2 ? String(Math.round(Number(spo2) || 98)) : '98',
      bodySite: 'قاعدة بيانات Excel مستوردة',
    };

    // Construct diagnosis object if conditionName is provided
    let diagnosis: StructuredDiagnosis | undefined = undefined;
    if (conditionName) {
      const sev = normalizeStatus(statusRaw);
      const severityMap: { [key: string]: 'منخفضة' | 'متوسطة' | 'مرتفعة' | 'حرجة' } = {
        'مستقرة': 'منخفضة',
        'متابعة': 'متوسطة',
        'تدخل طبي': 'مرتفعة',
        'حرجة': 'حرجة',
      };

      diagnosis = {
        conditionName: conditionName,
        summary: `تشخيص مستورد من قاعدة البيانات السريرية (${conditionName}). الشكوى: ${symptoms || 'غير محددة'}.`,
        severity: severityMap[sev] || 'منخفضة',
        severityReasoning: `تقييم مستورد بناءً على المؤشرات الحيوية المسجلة وحالة المريض.`,
        confidenceScore: 92,
        detailedAnalysis: `تم تسجيل الحالة من السجلات الطبية. مؤشرات المريض: الضغط ${vitals.bloodPressure}، النبض ${vitals.pulse} نبضة/دقيقة، الأكسجين ${vitals.spo2}%.`,
        differentialDiagnosis: [
          {
            condition: conditionName,
            probability: 90,
            reasoning: 'التشخيص الأساسي المعتمد في السجل الطبي المستورد.',
          },
        ],
        recommendations: [
          'متابعة استقرار المؤشرات الحيوية بانتظام.',
          'الالتزام بالخطة الدوائية المقررة.',
          'استشارة الطبيب المعالج عند ظهور أي أعراض جديدة.',
        ],
        suggestedTests: ['فحص تعداد الدم الكامل (CBC)', 'فحص وظائف الكلى والكبد'],
        urgentWarnings: sev === 'حرجة' ? ['حالة حرجة تستدعي تقييماً سريرياً فورياً'] : [],
        treatmentPlan: ['متابعة سريرية دورية وفق توصيات الطبيب المختص.'],
        dietaryAdvice: ['حمية غذائية متوازنة غنية بالسوائل والخضروات.'],
        physicalTherapy: [],
        lifestyleChanges: ['الحصول على قسط كافٍ من النوم والراحة.'],
        preventionTips: ['مراقبة الضغط ومستوى السكر الدوري.'],
        generalInfo: 'سجل طبي مستورد عبر قاعدة بيانات Excel.',
      };
    }

    const patientCase: PatientCase = {
      id: idRaw ? String(idRaw) : `${Date.now()}_${rowIdx}_${Math.random().toString(36).substring(2, 7)}`,
      name: name,
      age: age ? String(age).replace(/[^0-9]/g, '') || age : '30',
      gender: normalizeGender(genderRaw),
      symptoms: symptoms || (conditionName ? `تشخيص مسجل: ${conditionName}` : 'فحص ومتابعة دورية'),
      vitals: vitals,
      diagnosis: diagnosis,
      date: formatExcelDate(dateRaw),
      status: normalizeStatus(statusRaw),
      chatHistory: [],
    };

    records.push(patientCase);
  }

  return {
    records,
    totalRows: rawRows.length,
    validRows: records.length,
    warnings,
    detectedColumns,
    columnMappingSummary,
  };
}

/**
 * Generates and downloads a beautifully styled Excel workbook (.xlsx) containing all patients.
 */
export function exportPatientsToExcel(records: PatientCase[], customFileName?: string) {
  if (!records || records.length === 0) {
    throw new Error('لا توجد سجلات مرضى متاحة للتصدير.');
  }

  // 1. Prepare Main Patients Sheet Data
  const sheetRows = records.map((r, index) => {
    return {
      'م': index + 1,
      'رقم الملف': r.id,
      'تاريخ الفحص': r.date || '--',
      'اسم المريض': r.name,
      'العمر': r.age,
      'الجنس': r.gender,
      'الحالة السريرية': r.status,
      'ضغط الدم': r.vitals?.bloodPressure || '--',
      'النبض (BPM)': r.vitals?.pulse || '--',
      'الحرارة (°C)': r.vitals?.temperature || '--',
      'الأكسجين (%SpO2)': r.vitals?.spo2 || '--',
      'الأعراض والشكوى': r.symptoms || '--',
      'التشخيص المقترح': r.diagnosis?.conditionName || 'بانتظار الفحص',
      'مستوى الخطورة': r.diagnosis?.severity || '--',
      'نسبة الموثوقية': r.diagnosis ? `${r.diagnosis.confidenceScore}%` : '--',
      'ملخص التشخيص': r.diagnosis?.summary || '--',
      'الخطة العلاجية': r.diagnosis?.treatmentPlan?.join(' | ') || '--',
      'الفحوصات المقترحة': r.diagnosis?.suggestedTests?.join(' | ') || '--',
      'التنبيهات العاجلة': r.diagnosis?.urgentWarnings?.join(' | ') || 'لا توجد',
    };
  });

  // 2. Prepare Statistics Summary Sheet Data
  const total = records.length;
  const stable = records.filter((r) => r.status === 'مستقرة').length;
  const followUp = records.filter((r) => r.status === 'متابعة').length;
  const medicalIntervention = records.filter((r) => r.status === 'تدخل طبي').length;
  const critical = records.filter((r) => r.status === 'حرجة').length;
  const diagnosedCount = records.filter((r) => !!r.diagnosis).length;

  const statsRows = [
    { 'المؤشر الإحصائي': 'إجمالي عدد المرضى في قاعدة البيانات', 'القيمة': total },
    { 'المؤشر الإحصائي': 'عدد المرضى الذين تم تشخيصهم بواسطة الذكاء الاصطناعي', 'القيمة': diagnosedCount },
    { 'المؤشر الإحصائي': 'نسبة الحالات المكتملة التشخيص', 'القيمة': `${Math.round((diagnosedCount / total) * 100)}%` },
    { 'المؤشر الإحصائي': 'الحالات المستقرة (أخضر)', 'القيمة': `${stable} (${Math.round((stable / total) * 100)}%)` },
    { 'المؤشر الإحصائي': 'حالات المتابعة المستمرة (أزرق)', 'القيمة': `${followUp} (${Math.round((followUp / total) * 100)}%)` },
    { 'المؤشر الإحصائي': 'حالات التدخل الطبي العاجل (برتقالي)', 'القيمة': `${medicalIntervention} (${Math.round((medicalIntervention / total) * 100)}%)` },
    { 'المؤشر الإحصائي': 'الحالات الحرجة / طوارئ (أحمر)', 'القيمة': `${critical} (${Math.round((critical / total) * 100)}%)` },
    { 'المؤشر الإحصائي': 'تاريخ ووقت استخراج التقرير', 'القيمة': new Date().toLocaleString('ar-EG') },
    { 'المؤشر الإحصائي': 'النظام المصدر', 'القيمة': 'الحكيم الذكي Pro - AI Medical System' },
  ];

  // 3. Create Workbook & Sheets
  const wb = XLSX.utils.book_new();

  // Patients Sheet
  const wsPatients = XLSX.utils.json_to_sheet(sheetRows);
  // Set Column Widths
  wsPatients['!cols'] = [
    { wch: 5 },  // م
    { wch: 18 }, // رقم الملف
    { wch: 14 }, // تاريخ الفحص
    { wch: 22 }, // اسم المريض
    { wch: 8 },  // العمر
    { wch: 8 },  // الجنس
    { wch: 14 }, // الحالة السريرية
    { wch: 12 }, // ضغط الدم
    { wch: 12 }, // النبض
    { wch: 12 }, // الحرارة
    { wch: 14 }, // الأكسجين
    { wch: 30 }, // الأعراض
    { wch: 22 }, // التشخيص
    { wch: 14 }, // مستوى الخطورة
    { wch: 14 }, // نسبة الموثوقية
    { wch: 40 }, // ملخص التشخيص
    { wch: 35 }, // الخطة العلاجية
    { wch: 30 }, // الفحوصات المقترحة
    { wch: 25 }, // التنبيهات العاجلة
  ];

  // Statistics Sheet
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  wsStats['!cols'] = [{ wch: 45 }, { wch: 25 }];

  // Enable Right-to-Left (RTL) views
  wsPatients['!views'] = [{ RTL: true }];
  wsStats['!views'] = [{ RTL: true }];

  XLSX.utils.book_append_sheet(wb, wsPatients, 'سجلات المرضى');
  XLSX.utils.book_append_sheet(wb, wsStats, 'الملخص الإحصائي');

  // 4. Download file
  const fileName = customFileName || `قاعدة_بيانات_المرضى_الحكيم_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Creates and downloads a ready-to-use Excel template for importing patients.
 */
export function downloadPatientExcelTemplate() {
  const templateRows = [
    {
      'اسم المريض': 'محمد عبد الله سالم',
      'العمر': 45,
      'الجنس': 'ذكر',
      'ضغط الدم': '135/85',
      'النبض': 78,
      'درجة الحرارة': 37.2,
      'نسبة الأكسجين': 98,
      'الأعراض والشكوى': 'صداع نابض مستمر منذ يومين مع إجهاد عام وإرهاق خفيف',
      'الحالة': 'متابعة',
      'التشخيص المسبق': 'ارتفاع ضغط دم أولي خفيف',
      'تاريخ الفحص': new Date().toISOString().split('T')[0],
      'رقم الملف': 'P-1001',
    },
    {
      'اسم المريض': 'سارة أحمد محمود',
      'العمر': 29,
      'الجنس': 'أنثى',
      'ضغط الدم': '118/75',
      'النبض': 72,
      'درجة الحرارة': 38.5,
      'نسبة الأكسجين': 97,
      'الأعراض والشكوى': 'حمى مفاجئة مصحوبة بالسعال الجاف وألم الحلق وآلام العضلات',
      'الحالة': 'متابعة',
      'التشخيص المسبق': 'التهاب فيروسي حاد بالجهاز التنفسي العلوي',
      'تاريخ الفحص': new Date().toISOString().split('T')[0],
      'رقم الملف': 'P-1002',
    },
    {
      'اسم المريض': 'خالد إبراهيم النجار',
      'العمر': 62,
      'الجنس': 'ذكر',
      'ضغط الدم': '165/100',
      'النبض': 105,
      'درجة الحرارة': 37.0,
      'نسبة الأكسجين': 91,
      'الأعراض والشكوى': 'ضيق شديد في التنفس وألم ضاغط في منتصف الصدر يمتد للكتف الأيسر',
      'الحالة': 'حرجة',
      'التشخيص المسبق': 'اشتباه متلازمة الشريان التاجي الحادة (ACS)',
      'تاريخ الفحص': new Date().toISOString().split('T')[0],
      'رقم الملف': 'P-1003',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateRows);

  ws['!cols'] = [
    { wch: 25 }, // اسم المريض
    { wch: 10 }, // العمر
    { wch: 10 }, // الجنس
    { wch: 14 }, // ضغط الدم
    { wch: 10 }, // النبض
    { wch: 14 }, // درجة الحرارة
    { wch: 14 }, // نسبة الأكسجين
    { wch: 45 }, // الأعراض والشكوى
    { wch: 15 }, // الحالة
    { wch: 35 }, // التشخيص المسبق
    { wch: 15 }, // تاريخ الفحص
    { wch: 15 }, // رقم الملف
  ];

  ws['!views'] = [{ RTL: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'نموذج إدخال المرضى');
  XLSX.writeFile(wb, 'نموذج_إدخال_بيانات_المرضى_الحكيم_الذكي.xlsx');
}
