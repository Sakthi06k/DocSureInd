"use client";

import { FormEvent, useState, useEffect } from "react";
import Link from "next/link";

type ExtractedField = {
  value?: string;
  confidence: number;
  evidence?: string;
};

type ExtractedDocument = {
  document_type: string;
  document_type_confidence: number;
  fields: Record<string, ExtractedField>;
  warnings: string[];
};

type Issue = {
  code: string;
  severity: "error" | "warning" | "review";
  title: string;
  explanation: string;
  document_ids: string[];
  official_source?: string;
  rule_id?: string;
};

type Result = {
  status: "READY" | "CORRECTIONS_REQUIRED" | "MANUAL_REVIEW_REQUIRED" | "UNABLE_TO_VERIFY";
  ready: boolean;
  score: number;
  documents: ExtractedDocument[];
  issues: Issue[];
  disclaimer: string;
};

type TamilTranslationItem = {
  code: string;
  translated_title: string;
  translated_explanation: string;
};

type Citation = {
  source_id: string;
  title: string;
  department: string;
  url: string;
  excerpt: string;
  retrieved_on: string;
};

type RAGResponse = {
  grounded: boolean;
  answer: string;
  citations: Citation[];
  disclaimer: string;
};

// Tamil fallback dictionary for standard error codes
const TAMIL_FALLBACK_DICTIONARY: Record<string, { title: string; explanation: string }> = {
  "missing_income_certificate": {
    title: "வருமானச் சான்றிதழ் இல்லை",
    explanation: "உங்கள் ஆவணத் தொகுப்பில் வருமானச் சான்றிதழ் கண்டறியப்படவில்லை. தயவுசெய்து வருமானச் சான்றிதழைப் பதிவேற்றவும்."
  },
  "missing_community_certificate": {
    title: "ஜாதிச் சான்றிதழ் இல்லை",
    explanation: "உங்கள் ஆவணத் தொகுப்பில் ஜாதிச் சான்றிதழ் கண்டறியப்படவில்லை. தயவுசெய்து ஜாதிச் சான்றிதழைப் பதிவேற்றவும்."
  },
  "missing_student_id": {
    title: "மாணவர் அடையாள அட்டை இல்லை",
    explanation: "மாணவர் அடையாள அட்டை அல்லது போனஃபைட் சான்றிதழ் கண்டறியப்படவில்லை. தயவுசெய்து பதிவேற்றவும்."
  },
  "missing_bank_passbook": {
    title: "வங்கி புத்தக நகல் இல்லை",
    explanation: "வங்கி கணக்கு புத்தகத்தின் முதல் பக்க நகல் கண்டறியப்படவில்லை. தயவுசெய்து பதிவேற்றவும்."
  },
  "unknown_document": {
    title: "அடையாளம் தெரியாத ஆவணம்",
    explanation: "சில கோப்புகளை எங்களால் வகைப்படுத்த முடியவில்லை. சரியான சான்றிதழைப் பதிவேற்றியுள்ளீர்களா என்பதைச் சரிபார்க்கவும்."
  }
};

const TAMIL_NUMBERS = ["ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது", "பத்து"];

// Question translation dictionary
const QUESTION_TAMIL_MAP: Record<string, string> = {
  "is_adult_fresh_ordinary": "நீங்கள் புதிய சாதாரண பாஸ்போர்ட்டுக்கு விண்ணப்பிக்கும் வயது வந்தவரா (18+)?",
  "name_changed": "விண்ணப்பதாரர் சட்டப்பூர்வமாக தனது பெயரை மாற்றியுள்ளாரா?",
  "is_individual_correction": "தனிநபர் பான் கார்டுக்கான விவரங்களை திருத்துகிறீர்களா?",
  "correcting_name": "பான் கார்டில் உங்கள் பெயரை திருத்துகிறீர்களா?",
  "correcting_dob": "பான் கார்டில் உங்கள் பிறந்த தேதியை திருத்துகிறீர்களா?",
  "correcting_address": "பான் கார்டில் உங்கள் குடியிருப்பு முகவரியை திருத்துகிறீர்களா?",
  "using_aadhaar_route": "ஆதார் அடிப்படையிலான இ-கேஒய்சி முறையைப் பயன்படுத்தி சமர்ப்பிக்கிறீர்களா?"
};

const QUESTION_HINDI_MAP: Record<string, string> = {
  "is_adult_fresh_ordinary": "क्या आप एक वयस्क आवेदक (18+) हैं जो नए साधारण पासपोर्ट के लिए आवेदन कर रहे हैं?",
  "name_changed": "क्या आवेदक ने कानूनी रूप से अपना नाम बदल लिया है?",
  "is_individual_correction": "क्या आप एक व्यक्तिगत पैन कार्ड के लिए विवरण सही कर रहे हैं?",
  "correcting_name": "क्या आप पैन कार्ड पर अपना नाम सही कर रहे हैं?",
  "correcting_dob": "क्या आप पैन कार्ड पर अपनी जन्मतिथि सही कर रहे हैं?",
  "correcting_address": "क्या आप पैन कार्ड पर अपना आवासीय पता सही कर रहे हैं?",
  "using_aadhaar_route": "क्या आप आधार-आधारित ई-केवाईसी मार्ग का उपयोग करके जमा कर रहे हैं?"
};

// Metadata fields translation dictionary
const FIELD_TAMIL_MAP: Record<string, string> = {
  "Holder Name": "பெயர்தாரர் பெயர்",
  "Certificate ID": "சான்றிதழ் எண்",
  "Date of Birth": "பிறந்த தேதி",
  "Issue Date": "வழங்கப்பட்ட தேதி",
  "Expiry Date": "காலாவதி தேதி",
  "Annual Income": "ஆண்டு வருமானம்",
  "Community / Caste": "வகுப்பு / சாதி",
  "Bank Holder": "வங்கி கணக்கு வைத்திருப்பவர்",
  "Bank Acc (Last 4)": "வங்கி கணக்கு (கடைசி 4)",
  "Bank IFSC": "வங்கி IFSC குறியீடு",
  "Institution Name": "நிறுவனத்தின் பெயர்",
  "Academic Year": "கல்வியாண்டு"
};

const FIELD_HINDI_MAP: Record<string, string> = {
  "Holder Name": "धारक का नाम",
  "Certificate ID": "प्रमाण पत्र संख्या",
  "Date of Birth": "जन्म तिथि",
  "Issue Date": "जारी करने की तिथि",
  "Expiry Date": "समाप्ति तिथि",
  "Annual Income": "वार्षिक आय",
  "Community / Caste": "समुदाय / जाति",
  "Bank Holder": "बैंक खाताधारक",
  "Bank Acc (Last 4)": "बैंक खाता (अंतिम 4)",
  "Bank IFSC": "बैंक आईएफएससी",
  "Institution Name": "संस्थान का नाम",
  "Academic Year": "शैक्षणिक वर्ष"
};

export default function CheckPage() {
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>("tn_post_matric_scholarship_bc");
  const [template, setTemplate] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Selected Language State
  const [language, setLanguage] = useState<"en" | "ta" | "hi">("en");

  // Tamil Translation state
  const [tamilIssues, setTamilIssues] = useState<Record<string, TamilTranslationItem>>({});
  const [translating, setTranslating] = useState(false);
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);

  // RAG explanation states
  const [ragLoading, setRagLoading] = useState<Record<string, boolean>>({});
  const [ragAnswers, setRagAnswers] = useState<Record<string, RAGResponse>>({});
  const [customQuestions, setCustomQuestions] = useState<Record<string, string>>({});

  // Helper function to translate string elements dynamically
  const t = (en: string, ta: string, hi?: string) => {
    if (language === "ta") return ta;
    if (language === "hi") return hi || en;
    return en;
  };

  // Fetch templates list on mount
  useEffect(() => {
    async function loadTemplatesList() {
      try {
        const res = await fetch("/api/templates?include_drafts=false");
        if (res.ok) {
          const list = await res.json();
          setTemplatesList(list);
        }
      } catch (e) {
        console.error("Failed to load templates list", e);
      }
    }
    loadTemplatesList();
  }, []);

  // Sync template_id from query params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTemplateId = searchParams.get("template_id");
      if (urlTemplateId) {
        setTemplateId(urlTemplateId);
      }
    }
  }, []);

  // Fetch template details when selected template changes
  useEffect(() => {
    async function loadTemplateDetails() {
      if (!templateId) return;
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (res.ok) {
          const data = await res.json();
          setTemplate(data);
          // Initialize default answers
          const initialAnswers: Record<string, any> = {};
          data.questionnaire?.forEach((q: any) => {
            if (q.type === "boolean") {
              initialAnswers[q.id] = q.id.startsWith("is_") ? true : false;
            } else if (q.type === "select") {
              initialAnswers[q.id] = q.allowed_values?.[0] || "";
            } else {
              initialAnswers[q.id] = "";
            }
          });
          setAnswers(initialAnswers);
          setResult(null);
          setTamilIssues({});
          setRagAnswers({});
          setFiles([]);
        }
      } catch (e) {
        console.error("Failed to load template details", e);
      }
    }
    loadTemplateDetails();
  }, [templateId]);

  // Load browser voices dynamically based on selected language
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        let targetVoice = null;
        if (language === "ta") {
          targetVoice =
            voices.find((voice) => voice.lang.toLowerCase().startsWith("ta")) ??
            voices.find((voice) => voice.name.toLowerCase().includes("tamil"));
        } else if (language === "hi") {
          targetVoice =
            voices.find((voice) => voice.lang.toLowerCase().startsWith("hi")) ??
            voices.find((voice) => voice.name.toLowerCase().includes("hindi"));
        }
        setActiveVoice(targetVoice || null);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [language]);

  // Check if answers reflect an unsupported scenario
  const isUnsupported = () => {
    if (templateId === "passport_fresh_adult_ordinary" && answers.is_adult_fresh_ordinary === false) {
      return true;
    }
    if (templateId === "pan_correction_individual" && answers.is_individual_correction === false) {
      return true;
    }
    return false;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUnsupported()) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    if (isUnsupported()) return;
    const validFiles = newFiles.filter(file => {
      const isAccepted = ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
      const isUnderLimit = file.size <= 8 * 1024 * 1024;
      return isAccepted && isUnderLimit;
    });

    setFiles(prev => {
      const combined = [...prev, ...validFiles];
      return combined.slice(0, 6);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Speaks validation issues, fallback to English speech synthesis if matching voice is missing
  const speakReport = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    if (!result) return;

    const isTargetVoiceAvailable = activeVoice !== null;
    const speakLang = (language === "en" || !isTargetVoiceAvailable) ? "en" : language;

    const errorCount = result.issues.filter(i => i.severity === "error").length;
    const reviewCount = result.issues.filter(i => i.severity !== "error").length;

    const getExplanationText = (issue: Issue): string => {
      if (speakLang === "ta") {
        if (tamilIssues[issue.code]) return tamilIssues[issue.code].translated_explanation;
        if (TAMIL_FALLBACK_DICTIONARY[issue.code]) return TAMIL_FALLBACK_DICTIONARY[issue.code].explanation;
      }
      return issue.explanation;
    };

    const getTitleText = (issue: Issue): string => {
      if (speakLang === "ta") {
        if (tamilIssues[issue.code]) return tamilIssues[issue.code].translated_title;
        if (TAMIL_FALLBACK_DICTIONARY[issue.code]) return TAMIL_FALLBACK_DICTIONARY[issue.code].title;
      }
      return issue.title;
    };

    if (result.issues.length === 0) {
      const okMsg = speakLang === "ta" 
        ? "ஆவண சரிபார்ப்பில் பிழைகள் எதுவும் கண்டறியப்படவில்லை. உங்களது ஆவணங்கள் தயாராக உள்ளன."
        : speakLang === "hi"
        ? "दस्तावेज़ सत्यापन में कोई त्रुटि नहीं मिली। आपके दस्तावेज़ तैयार हैं।"
        : "No errors were detected in your document package. Your documents are ready.";
      
      const announcement = new SpeechSynthesisUtterance(okMsg);
      announcement.lang = speakLang === "ta" ? "ta-IN" : speakLang === "hi" ? "hi-IN" : "en-US";
      if (activeVoice) announcement.voice = activeVoice;
      window.speechSynthesis.speak(announcement);
      return;
    }
    
    let introText = "";
    if (speakLang === "ta") {
      introText = `சரிபார்ப்பு முடிவு. உங்களது தயார்நிலை மதிப்பெண் நூற்றுக்கு ${result.score} ஆகும். `;
      if (errorCount > 0) {
        const errorCountTamil = TAMIL_NUMBERS[errorCount - 1] || errorCount.toString();
        introText += `${errorCountTamil} முக்கியமான பிழைகளும், `;
      }
      if (reviewCount > 0) {
        const reviewCountTamil = TAMIL_NUMBERS[reviewCount - 1] || reviewCount.toString();
        introText += `${reviewCountTamil} மறுபரிசீலனை செய்ய வேண்டிய குறிப்புகளும் கண்டறியப்பட்டுள்ளன. `;
      }
      introText += "விவரங்கள் பின்வருமாறு:";
    } else if (speakLang === "hi") {
      introText = `सत्यापन जांच पूरी हो गई है। आपका तैयारी स्कोर 100 में से ${result.score} है। `;
      if (errorCount > 0) {
        introText += `हमें ${errorCount} महत्वपूर्ण त्रुटियां मिली हैं, `;
      }
      if (reviewCount > 0) {
        introText += `और ${reviewCount} मैनुअल समीक्षाएं हैं। `;
      }
      introText += "विवरण इस प्रकार है:";
    } else {
      introText = `Verification check completed. Your readiness score is ${result.score} out of 100. `;
      if (errorCount > 0) {
        introText += `We found ${errorCount} critical errors, `;
      }
      if (reviewCount > 0) {
        introText += `and ${reviewCount} manual reviews. `;
      }
      introText += "Here are the details:";
    }

    const introUtterance = new SpeechSynthesisUtterance(introText);
    introUtterance.lang = speakLang === "ta" ? "ta-IN" : speakLang === "hi" ? "hi-IN" : "en-US";
    if (activeVoice) introUtterance.voice = activeVoice;
    window.speechSynthesis.speak(introUtterance);

    result.issues.forEach((issue, idx) => {
      const title = getTitleText(issue);
      const explanation = getExplanationText(issue);
      
      let textToSpeak = "";
      if (speakLang === "ta") {
        const numTamil = TAMIL_NUMBERS[idx] || (idx + 1).toString();
        textToSpeak = `குறிப்பு ${numTamil}: ${title}. விளக்கம்: ${explanation}`;
      } else if (speakLang === "hi") {
        textToSpeak = `मुद्दा ${idx + 1}: ${title}. विवरण: ${explanation}`;
      } else {
        textToSpeak = `Issue ${idx + 1}: ${title}. Explanation: ${explanation}`;
      }
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = speakLang === "ta" ? "ta-IN" : speakLang === "hi" ? "hi-IN" : "en-US";
      if (activeVoice) utterance.voice = activeVoice;
      window.speechSynthesis.speak(utterance);
    });
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Submit files to FastAPI
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isUnsupported()) return;
    setError("");
    setLoading(true);
    setResult(null);
    setTamilIssues({});
    setRagAnswers({});
    stopSpeaking();

    const formData = new FormData();
    formData.append("template_id", templateId);
    formData.append("template_version", template?.version || "1.0.0");
    formData.append("answers_json", JSON.stringify(answers));
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = "Analysis failed.";
        try {
          const errObj = JSON.parse(errText);
          errMsg = errObj.detail || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const data: Result = await response.json();
      setResult(data);

      if (data.issues && data.issues.length > 0) {
        translateIssues(data.issues);
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Analysis request failed.");
    } finally {
      setLoading(false);
    }
  }

  // Request Tamil translations from backend
  async function translateIssues(issuesList: Issue[]) {
    setTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: issuesList }),
      });

      if (response.ok) {
        const list: TamilTranslationItem[] = await response.json();
        const mapping: Record<string, TamilTranslationItem> = {};
        list.forEach(item => {
          mapping[item.code] = item;
        });
        setTamilIssues(mapping);
      }
    } catch (e) {
      console.error("Translation request failed: ", e);
    } finally {
      setTranslating(false);
    }
  }

  // Query Grounded RAG guidelines query API
  async function askGuidelines(ruleId: string, customText?: string) {
    if (!ruleId || !template) return;
    
    setRagLoading(prev => ({ ...prev, [ruleId]: true }));
    const question = customText || "Explain why this document check exists and list what official certificates are accepted.";
    
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          template_version: template.version,
          rule_id: ruleId,
          question,
          language
        }),
      });

      if (response.ok) {
        const data: RAGResponse = await response.json();
        setRagAnswers(prev => ({ ...prev, [ruleId]: data }));
      }
    } catch (e) {
      console.error("Guidelines query failed", e);
    } finally {
      setRagLoading(prev => ({ ...prev, [ruleId]: false }));
    }
  }

  return (
    <main className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 lg:py-12 flex-1 print-report">
      
      {/* Global CSS for Print-friendly view override */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-report {
            max-width: 100% !important;
            padding: 0 !important;
            font-size: 11pt !important;
          }
          .issue-card, .citation-card {
            break-inside: avoid !important;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 1rem !important;
            padding: 1rem !important;
            border-radius: 12px !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Dynamic Header Translation & Language Selector Dropdown */}
      <div className="text-center mb-8 no-print space-y-4">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t("Verification Console", "சரிபார்ப்பு கன்சோல்", "सत्यापन कंसोल")}
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          {t(
            "Evaluate your application documents readiness against reviewed Indian public service policies.",
            "மதிப்பாய்வு செய்யப்பட்ட இந்திய பொதுச் சேவை கொள்கைகளுக்கு எதிராக உங்கள் ஆவணங்களின் தயார்நிலையை மதிப்பிடுங்கள்.",
            "समीक्षा की गई भारतीय सार्वजनिक सेवा नीतियों के खिलाफ अपने आवेदन दस्तावेजों की तैयारी का मूल्यांकन करें।"
          )}
        </p>

        {/* Premium Multi-lingual Selector Dropdown */}
        <div className="flex justify-center items-center gap-2 pt-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            🌐 {t("Language / மொழி / भाषा:", "மொழி / Language / மொழி:", "भाषा / Language / மொழி:")}
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "ta" | "hi")}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs bg-white font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            <option value="en">English (US)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Upload Form Area */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm no-print">
          <h2 className="font-outfit text-lg font-bold text-slate-950 mb-4">
            {t("1. Setup & Upload", "1. அமைவு & பதிவேற்றம்", "1. सेटअप और अपलोड")}
          </h2>
          
          <form onSubmit={submit} className="space-y-6">
            
            {/* Template Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t("Application Rule Template", "விண்ணப்ப விதி டெம்ப்ளேட்", "आवेदन नियम टेम्पलेट")}
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm bg-slate-50 font-medium"
              >
                {templatesList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.status === "DRAFT" ? " (DRAFT)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* DRAFT Warning Banner */}
            {template && template.status === "DRAFT" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                ⚠️ <strong>{t("DRAFT Template", "வரைவு டெம்ப்ளேட்", "ड्राफ्ट टेम्पलेट")}</strong>: {t("This checklist ruleset is currently a draft under verification. Requirements may change based on official updates.", "இந்த சரிபார்ப்பு விதித்தொகுப்பு தற்போது சரிபார்ப்பின் கீழ் உள்ள வரைவு ஆகும். அதிகாரப்பூர்வ புதுப்பிப்புகளின் அடிப்படையில் தேவைகள் மாறக்கூடும்.", "यह चेकलिस्ट नियम सेट वर्तमान में सत्यापन के अधीन एक ड्राफ्ट है। आधिकारिक अपडेट के आधार पर आवश्यकताएं बदल सकती हैं।")}
              </div>
            )}

            {/* Dynamic Questionnaire Form Fields */}
            {template && template.questionnaire && template.questionnaire.length > 0 && (
              <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t("Scenario Declarations", "சூழ்நிலை அறிவிப்புகள்", "परिदृश्य घोषणाएं")}
                </h3>
                {template.questionnaire.map((q: any) => (
                  <div key={q.id} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">
                      {language === "ta" && QUESTION_TAMIL_MAP[q.id] 
                        ? QUESTION_TAMIL_MAP[q.id] 
                        : language === "hi" && QUESTION_HINDI_MAP[q.id]
                        ? QUESTION_HINDI_MAP[q.id]
                        : q.label}
                    </label>
                    {q.type === "boolean" ? (
                      <select
                        value={answers[q.id]?.toString() ?? "false"}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value === "true",
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white font-medium"
                      >
                        <option value="true">{t("Yes", "ஆம்", "हाँ")}</option>
                        <option value="false">{t("No", "இல்லை", "नहीं")}</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Unsupported Scenario Banner */}
            {isUnsupported() ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 space-y-1">
                <strong>{t("Unsupported Scenario", "ஆதரிக்கப்படாத சூழ்நிலை", "असमर्थित परिदृश्य")}</strong>
                <p>{t("This circumstance is not currently supported by the verified DocSureInd template. Please consult the official authority.", "இந்தச் சூழ்நிலை தற்போது சரிபார்க்கப்பட்ட DocSureInd டெம்ப்ளேட்டால் ஆதரிக்கப்படவில்லை. தயவுசெய்து உத்தியோகபூர்வ அதிகாரியை அணுகவும்.", "यह परिस्थिति वर्तमान में सत्यापित DocSureInd टेम्पलेट द्वारा समर्थित नहीं है। कृपया आधिकारिक प्राधिकरण से परामर्श करें।")}</p>
              </div>
            ) : (
              <>
                {/* Privacy warning instruction */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                  🔒 <strong>{t("Privacy Warning", "தனியுரிமை எச்சரிக்கை", "गोपनीयता चेतावनी")}</strong>: {t("For this competition prototype, upload only synthetic or properly redacted documents. Do not upload real Aadhaar, PAN, passport, bank, or other identity documents.", "இந்த முன்மாதிரிக்கு, செயற்கை அல்லது திருத்தப்பட்ட ஆவணங்களை மட்டுமே பதிவேற்றவும். உண்மையான ஆதார், பான், பாஸ்போர்ட், வங்கி அல்லது பிற அடையாள ஆவணங்களை பதிவேற்ற வேண்டாம்.", "इस प्रतियोगिता प्रोटोटाइप के लिए, केवल कृत्रिम या ठीक से संपादित दस्तावेज ही अपलोड करें। वास्तविक आधार, पैन, पासपोर्ट, बैंक या अन्य पहचान दस्तावेज अपलोड न करें।")}
                </div>

                {/* Drag & Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/20"
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    id="file-input-field"
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files ?? []))
                    }
                    className="hidden"
                  />
                  <label htmlFor="file-input-field" className="cursor-pointer block">
                    <span className="text-3xl block mb-2">📁</span>
                    <span className="block text-sm font-bold text-slate-800">
                      {t("Drag & drop files here", "கோப்புகளை இங்கே இழுத்துப் போடவும்", "फ़ाइलों को यहाँ खींचें और छोड़ें")}
                    </span>
                    <span className="block text-xs text-slate-400 mt-1">
                      {t("or click to select (PDF, JPG, PNG up to 8MB)", "அல்லது தேர்ந்தெடுக்க கிளிக் செய்யவும் (PDF, JPG, PNG 8MB வரை)", "या चुनने के लिए क्लिक करें (पीडीएफ, जेपीजी, पीएनजी 8 एमबी तक)")}
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* Uploaded File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("Selected Files", "தேர்ந்தெடுக்கப்பட்ட கோப்புகள்", "चयनित फ़ाइलें")} ({files.length}/6)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    {t("Clear All", "அனைத்தையும் நீக்கு", "सभी साफ करें")}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/60 text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-400 text-sm">📄</span>
                        <span className="font-medium text-slate-700 truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-slate-400">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              disabled={loading || files.length === 0 || isUnsupported()}
              className="w-full flex justify-center items-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
              id="btn-trigger-analysis"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("Processing (AI extraction)...", "செயலாக்கப்படும் (AI பிரித்தெடுத்தல்)...", "प्रसंस्करण (एआई निष्कर्षण)...")}
                </span>
              ) : (
                t("Run Verification Check", "சரிபார்ப்புச் சோதனையை இயக்கு", "सत्यापन जांच चलाएं")
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        {/* Results Panel */}
        <section className="lg:col-span-7 space-y-6">
          {!result && !loading && (
            <div className="border border-slate-200 border-dashed rounded-2xl p-16 text-center bg-white shadow-sm h-full flex flex-col justify-center items-center no-print">
              <span className="text-4xl mb-4">🔍</span>
              <h3 className="font-outfit text-base font-bold text-slate-800">
                {t("No verification results", "சரிபார்ப்பு முடிவுகள் இல்லை", "कोई सत्यापन परिणाम नहीं")}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {t("Upload your document package and click \"Run Verification Check\" to inspect details.", "விவரங்களை ஆய்வு செய்ய உங்கள் ஆவண தொகுப்பைப் பதிவேற்றி, \"சரிபார்ப்புச் சோதனையை இயக்கு\" என்பதைக் கிளிக் செய்யவும்.", "अपने दस्तावेज़ पैकेज को अपलोड करें और विवरणों का निरीक्षण करने के लिए \"सत्यापन जांच चलाएं\" पर क्लिक करें।")}
              </p>
            </div>
          )}

          {loading && (
            <div className="border border-slate-200 rounded-2xl p-16 text-center bg-white shadow-sm h-full flex flex-col justify-center items-center no-print">
              <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="font-outfit text-base font-bold text-slate-800">
                {t("Analyzing Documents", "ஆவணங்களை ஆய்வு செய்கிறது", "दस्तावेजों का विश्लेषण किया जा रहा है")}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {t("Vertex AI Gemini is extracting structured fields and running rules validation...", "Vertex AI ஜெமினி கட்டமைக்கப்பட்ட புலங்களைப் பிரித்தெடுத்து விதிகள் சரிபார்ப்பை இயக்குகிறது...", "Vertex एआई जेमिनी संरचित फ़ील्ड निकाल रहा है और नियम सत्यापन चला रहा है...")}
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Header card with readiness score */}
              {(() => {
                const status = getStatusStyles(result.status, language);
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg}`}>
                        {status.text}
                      </span>
                      <h3 className="font-outfit text-xl font-bold text-slate-900 mt-2">
                        {t("Readiness Summary", "தயார்நிலை சுருக்கம்", "तैयारी का सारांश")}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        {status.desc}
                      </p>
                    </div>

                    {/* Circular Score Gauge */}
                    <div className="relative flex items-center justify-center">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke={result.score >= 80 ? "#10b981" : result.score >= 50 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (251.2 * result.score) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="font-outfit font-extrabold text-2xl text-slate-800">{result.score}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          {t("Score", "மதிப்பெண்", "अंक")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action buttons (Speech, Print) */}
              <div className="flex flex-wrap gap-2 items-center justify-between no-print">
                <span className="text-xs font-semibold text-slate-500">
                  {t("2. Issues Report", "2. பிழைகள் அறிக்கை", "2. मुद्दों की रिपोर्ट")}
                </span>
                <div className="flex gap-2 items-center">
                  {language === "ta" && activeVoice === null && (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      ⚠️ {t("Tamil TTS voice missing on device. Falling back to English audio.", "தமிழ் குரல் உங்கள் சாதனத்தில் நிறுவப்படவில்லை. ஆங்கில குரலில் ஒலிக்கப்படுகிறது.", "तमिल आवाज आपके डिवाइस पर नहीं है। अंग्रेजी में सुनाया जाएगा।")}
                    </span>
                  )}
                  {language === "hi" && activeVoice === null && (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      ⚠️ {t("Hindi TTS voice missing on device. Falling back to English audio.", "இந்தி குரல் உங்கள் சாதனத்தில் நிறுவப்படவில்லை. ஆங்கில குரலில் ஒலிக்கப்படுகிறது.", "हिंदी आवाज आपके डिवाइस पर नहीं है। अंग्रेजी में सुनाया जाएगा।")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={speakReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                  >
                    <span>🔊</span> {t("Speak", "பேசு", "बोलें")}
                  </button>
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all cursor-pointer"
                    title="Stop Audio"
                  >
                    ■
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
                  >
                    {t("Print friendly Report", "அச்சிடக்கூடிய அறிக்கை", "प्रिंट के अनुकूल रिपोर्ट")}
                  </button>
                </div>
              </div>

              {/* Issues List */}
              {result.issues.length === 0 ? (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
                  <span className="text-2xl block mb-2">🎉</span>
                  <p className="font-bold text-emerald-950 text-sm">
                    {t("Perfect package checklist!", "சரியான ஆவணத் தொகுப்பு!", "बिल्कुल सही पैकेज चेकलिस्ट!")}
                  </p>
                  <p className="text-xs text-emerald-800/80 mt-1">
                    {t("No mismatches, expiries, or missing documents found.", "முரண்பாடுகள், காலாவதிகள் அல்லது விடுபட்ட ஆவணங்கள் எதுவும் கண்டறியப்படவில்லை.", "कोई विसंगति, समाप्ति या गायब दस्तावेज़ नहीं मिले।")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.issues.map((issue, idx) => {
                    const isError = issue.severity === "error";
                    const isWarning = issue.severity === "warning";
                    const isTamilAvailable = language === "ta" && (tamilIssues[issue.code] || TAMIL_FALLBACK_DICTIONARY[issue.code]);
                    
                    const displayTitle = isTamilAvailable
                      ? (tamilIssues[issue.code]?.translated_title ?? TAMIL_FALLBACK_DICTIONARY[issue.code]?.title)
                      : issue.title;

                    const displayExplanation = isTamilAvailable
                      ? (tamilIssues[issue.code]?.translated_explanation ?? TAMIL_FALLBACK_DICTIONARY[issue.code]?.explanation)
                      : issue.explanation;

                    const ruleId = issue.rule_id;

                    return (
                      <div
                        key={idx}
                        className={`issue-card border rounded-2xl p-5 shadow-sm transition-all bg-white ${
                          isError 
                            ? "border-rose-100 hover:border-rose-300" 
                            : isWarning 
                            ? "border-slate-100 hover:border-slate-300" 
                            : "border-amber-100 hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">
                            {isError ? "🛑" : isWarning ? "⚠️" : "🔍"}
                          </span>
                          <div className="space-y-1 flex-1">
                            <h4 className={`text-sm font-bold ${
                              isError ? "text-rose-950" : isWarning ? "text-slate-900" : "text-amber-950"
                            }`}>
                              {displayTitle}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {displayExplanation}
                            </p>

                            {/* Original source link */}
                            {issue.official_source && (
                              <div className="pt-2 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 hover:underline no-print">
                                🔗 <a href={issue.official_source} target="_blank" rel="noreferrer">
                                  {t("Official Guidelines Reference", "அதிகாரப்பூர்வ வழிகாட்டுதல்கள் குறிப்பு", "आधिकारिक दिशानिर्देश संदर्भ")}
                                </a>
                              </div>
                            )}

                            {/* RAG Grounded Guidelines Assistant Widget Box */}
                            {ruleId && (
                              <div className="mt-4 border-t border-slate-100 pt-4 space-y-3 no-print">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {t("Official Guidelines Assistant", "உத்தியோகபூர்வ வழிகாட்டுதல்கள் உதவியாளர்", "आधिकारिक दिशानिर्देश सहायक")}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => askGuidelines(ruleId)}
                                    disabled={ragLoading[ruleId]}
                                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
                                  >
                                    {ragLoading[ruleId] ? t("Loading Excerpts...", "பத்திகளை ஏற்றுகிறது...", "अंश लोड हो रहे हैं...") : `🔍 ${t("Ask Official Guidelines", "உத்தியோகபூர்வ வழிகாட்டலைக் கேட்கவும்", "आधिकारिक दिशानिर्देशों से पूछें")}`}
                                  </button>
                                </div>

                                {/* Custom Ask Input */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder={t("Ask custom question about this requirement...", "இந்தத் தேவை குறித்து தனிப்பயன் கேள்வியைக் கேளுங்கள்...", "इस आवश्यकता के बारे में कस्टम प्रश्न पूछें...")}
                                    value={customQuestions[ruleId] || ""}
                                    onChange={(e) => setCustomQuestions(prev => ({ ...prev, [ruleId]: e.target.value }))}
                                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => askGuidelines(ruleId, customQuestions[ruleId])}
                                    disabled={ragLoading[ruleId] || !customQuestions[ruleId]}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                                  >
                                    {t("Ask", "கேள்", "पूछें")}
                                  </button>
                                </div>

                                {/* RAG Guidelines Output */}
                                {ragAnswers[ruleId] && (
                                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs space-y-3">
                                    <div className="text-slate-800 leading-relaxed whitespace-pre-line">
                                      {ragAnswers[ruleId].answer}
                                    </div>

                                    {/* Citations list */}
                                    {ragAnswers[ruleId].citations && ragAnswers[ruleId].citations.length > 0 && (
                                      <div className="space-y-2 border-t border-slate-200/60 pt-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                          {t("Grounded Citations", "அடிப்படைக் குறிப்புகள்", "आधारित उद्धरण")} ({ragAnswers[ruleId].citations.length})
                                        </span>
                                        {ragAnswers[ruleId].citations.map((cit, cIdx) => (
                                          <div key={cIdx} className="citation-card bg-white border border-slate-200/40 rounded-lg p-3 text-[11px] space-y-1.5">
                                            <div className="flex items-center justify-between gap-4 font-bold text-slate-800">
                                              <span>{cit.title}</span>
                                              <a href={cit.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                                                {t("Link", "இணைப்பு", "लिंक")}
                                              </a>
                                            </div>
                                            <p className="text-slate-400 text-[10px] uppercase font-semibold">
                                              {cit.department} • {t("Retrieved", "பெறப்பட்டது", "प्राप्त किया गया")} {cit.retrieved_on}
                                            </p>
                                            <blockquote className="border-l-2 border-slate-200 pl-2 text-slate-500 italic">
                                              &quot;{cit.excerpt}&quot;
                                            </blockquote>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="text-[10px] text-slate-400 italic">
                                      {ragAnswers[ruleId].disclaimer}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extracted Metadata list view */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-500 block">
                  {t("3. Extracted Metadata Details", "3. பிரித்தெடுக்கப்பட்ட மெட்டாடேட்டா விவரங்கள்", "3. निकाले गए मेटाडेटा विवरण")}
                </span>
                {result.documents.map((doc, index) => (
                  <details
                    key={index}
                    className="group border border-slate-200 rounded-2xl bg-slate-50/50 overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div className="text-xs font-bold text-slate-900">
                          {doc.document_type.replace(/_/g, " ").toUpperCase()}{" "}
                          <span className="text-[10px] font-medium text-slate-400">
                            ({intToConfidencePercentage(doc.document_type_confidence)}% {t("confidence", "நம்பகத்தன்மை", "विश्वास")})
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">
                        ▼
                      </span>
                    </summary>

                    <div className="p-4 border-t border-slate-100 bg-white text-xs space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow label="Holder Name" field={doc.fields?.holder_name} language={language} />
                        <FieldRow label="Certificate ID" field={doc.fields?.certificate_number} mask={true} maskFn={maskValue} language={language} />
                        <FieldRow label="Date of Birth" field={doc.fields?.date_of_birth} language={language} />
                        <FieldRow label="Issue Date" field={doc.fields?.issue_date} language={language} />
                        <FieldRow label="Expiry Date" field={doc.fields?.expiry_date} language={language} />
                        <FieldRow label="Annual Income" field={doc.fields?.annual_income} language={language} />
                        <FieldRow label="Community / Caste" field={doc.fields?.community} language={language} />
                        <FieldRow label="Bank Holder" field={doc.fields?.bank_account_holder} language={language} />
                        <FieldRow label="Bank Acc (Last 4)" field={doc.fields?.bank_account_last4} language={language} />
                        <FieldRow label="Bank IFSC" field={doc.fields?.ifsc} language={language} />
                        <FieldRow label="Institution Name" field={doc.fields?.institution_name} language={language} />
                        <FieldRow label="Academic Year" field={doc.fields?.academic_year} language={language} />
                      </div>
                    </div>
                  </details>
                ))}
              </div>

              {/* Printable Disclaimer box */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
                📢 <strong>{t("Disclaimer", "பொறுப்புத் துறப்பு", "अस्वीकरण")}</strong>: {result.disclaimer} {t("DocSureInd is a preparation assistant and does not guarantee official approval or acceptance.", "DocSureInd ஒரு தயாரிப்பு உதவியாளர் மற்றும் உத்தியோகபூர்வ ஒப்புதல் அல்லது ஏற்பிற்கு உத்தரவாதம் அளிக்காது.", "DocSureInd एक तैयारी सहायक है और आधिकारिक अनुमोदन या स्वीकृति की गारंटी नहीं देता है।")}
              </div>

            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function intToConfidencePercentage(val: number): number {
  return Math.round(val * 100);
}

type FieldRowProps = {
  label: string;
  field?: ExtractedField;
  mask?: boolean;
  maskFn?: (val: string | undefined) => string;
  language?: "en" | "ta" | "hi";
};

function FieldRow({ label, field, mask = false, maskFn, language = "en" }: FieldRowProps) {
  if (!field || (!field.value && field.confidence === 0)) return null;

  const displayVal = mask && maskFn ? maskFn(field.value) : (field.value || "—");
  const isTamil = language === "ta";
  const isHindi = language === "hi";

  const getTranslatedLabel = (lbl: string): string => {
    if (isTamil && FIELD_TAMIL_MAP[lbl]) return FIELD_TAMIL_MAP[lbl];
    if (isHindi && FIELD_HINDI_MAP[lbl]) return FIELD_HINDI_MAP[lbl];
    return lbl;
  };

  const getConfSuffix = (): string => {
    if (isTamil) return "நம்பகத்தன்மை";
    if (isHindi) return "विश्वास";
    return "Conf";
  };

  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-50 pb-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {getTranslatedLabel(label)}
      </span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-semibold text-slate-800 text-xs">{displayVal}</span>
        <span className="text-[9px] font-medium text-slate-400 uppercase bg-slate-100 px-1 py-0.5 rounded">
          {Math.round(field.confidence * 100)}% {getConfSuffix()}
        </span>
      </div>
    </div>
  );
}

function maskValue(val: string | undefined): string {
  if (!val) return "—";
  const stripped = val.trim();
  if (stripped.length <= 4) return "••••";
  return `••••${stripped.slice(-4)}`;
}

function getStatusStyles(status: string, language: string = "en") {
  const t = (en: string, ta: string, hi: string) => {
    if (language === "ta") return ta;
    if (language === "hi") return hi;
    return en;
  };
  
  switch (status) {
    case "UNABLE_TO_VERIFY":
      return {
        text: t("UNABLE TO VERIFY", "சரிபார்க்க முடியவில்லை", "सत्यापन नहीं हो सका"),
        bg: "bg-slate-100 text-slate-700 ring-slate-700/10",
        desc: t(
          "The uploaded files could not be classified. Please verify file content and formats.",
          "பதிவேற்றப்பட்ட கோப்புகளை வகைப்படுத்த முடியவில்லை. கோப்பு உள்ளடக்கம் மற்றும் வடிவங்களை சரிபார்க்கவும்.",
          "अपलोड की गई फ़ाइलों को वर्गीकृत नहीं किया जा सका। कृपया फ़ाइल सामग्री और स्वरूपों की जाँच करें।"
        )
      };
    case "CORRECTIONS_REQUIRED":
      return {
        text: t("CORRECTIONS REQUIRED", "திருத்தங்கள் தேவை", "संशोधन आवश्यक"),
        bg: "bg-rose-50 text-rose-700 ring-rose-700/10",
        desc: t(
          "We detected blocking inconsistencies (such as missing files or name mismatches). Correct them before applying.",
          "ஆவணங்களில் முரண்பாடுகளை கண்டறிந்துள்ளோம் (விடுபட்ட கோப்புகள் அல்லது பெயர் முரண்பாடு). விண்ணப்பிக்கும் முன் அவற்றை திருத்தவும்.",
          "हमने विसंगतियों (जैसे लापता फ़ाइलें या नाम विसंगतियां) का पता लगाया है। आवेदन करने से पहले उन्हें ठीक करें।"
        )
      };
    case "MANUAL_REVIEW_REQUIRED":
      return {
        text: t("MANUAL REVIEW REQUIRED", "மறுபரிசீலனை தேவை", "मैनुअल समीक्षा आवश्यक"),
        bg: "bg-amber-50 text-amber-700 ring-amber-700/10",
        desc: t(
          "No blocking errors were found, but some low-confidence fields require manual confirmation.",
          "தடுக்கும் பிழைகள் எதுவும் கண்டறியப்படவில்லை, ஆனால் சில தெளிவற்ற புலங்கள் கைமுறை சரிபார்ப்பை கோருகின்றன.",
          "कोई भी गंभीर त्रुटि नहीं मिली, लेकिन कुछ कम-आत्मविश्वास वाले फ़ील्ड्स के लिए मैन्युअल पुष्टि की आवश्यकता है।"
        )
      };
    case "READY":
    default:
      return {
        text: t("READY", "தயாராக உள்ளது", "तैयार"),
        bg: "bg-emerald-50 text-emerald-700 ring-emerald-700/10",
        desc: t(
          "No blocking inconsistency was detected in the uploaded document fields.",
          "பதிவேற்றப்பட்ட ஆவணங்களில் எந்தவித முரண்பாடும் கண்டறியப்படவில்லை.",
          "अपलोड किए गए दस्तावेज़ फ़ील्ड में कोई गंभीर विसंगति नहीं मिली।"
        )
      };
  }
}
