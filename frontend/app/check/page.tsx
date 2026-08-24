"use client";

import { FormEvent, useState, useEffect } from "react";

type ExtractedField = {
  value?: string;
  confidence: number;
  evidence?: string;
};

type ExtractedDocument = {
  document_type: string;
  document_type_confidence: number;
  holder_name: ExtractedField;
  date_of_birth: ExtractedField;
  certificate_number: ExtractedField;
  issue_date: ExtractedField;
  expiry_date: ExtractedField;
  annual_income: ExtractedField;
  community: ExtractedField;
  bank_account_holder: ExtractedField;
  bank_account_last4: ExtractedField;
  ifsc: ExtractedField;
  institution_name: ExtractedField;
  academic_year: ExtractedField;
  warnings: string[];
};

type Issue = {
  code: string;
  severity: "error" | "warning" | "review";
  title: string;
  explanation: string;
  document_ids: string[];
  official_source?: string;
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

// Tamil fallback dictionary for standard error codes (ensures instant availability and voice reading success)
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

export default function CheckPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Tamil Translation state
  const [tamilIssues, setTamilIssues] = useState<Record<string, TamilTranslationItem>>({});
  const [translating, setTranslating] = useState(false);
  const [showTamil, setShowTamil] = useState(false);
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Load browser voices for Tamil Speech Synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Check for ta first, then fall back to name matching tamil
        const taVoice =
          voices.find((voice) =>
            voice.lang.toLowerCase().startsWith("ta")
          ) ??
          voices.find((voice) =>
            voice.name.toLowerCase().includes("tamil")
          ) ?? null;
        setActiveVoice(taVoice);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Handle file drops
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isAccepted = [
        "application/pdf",
        "image/jpeg",
        "image/png"
      ].includes(file.type);
      const isUnderLimit = file.size <= 8 * 1024 * 1024; // 8MB
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

  // Speaks validation issues in Tamil using browser SpeechSynthesis
  const speakTamilReport = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    // Cancel active speech before starting a new request
    window.speechSynthesis.cancel();

    if (!result) return;

    const errorCount = result.issues.filter(i => i.severity === "error").length;
    const reviewCount = result.issues.filter(i => i.severity !== "error").length;

    // Fallback if Tamil voice is unavailable: read details in English instead of remaining silent
    if (!activeVoice) {
      alert("Tamil audio is unavailable on this device. Falling back to English speech synthesis.");
      
      let introText = `Verification result. Your readiness score is ${result.score} out of 100. `;
      if (errorCount > 0) {
        introText += `We found ${errorCount} critical errors, and `;
      }
      if (reviewCount > 0) {
        introText += `${reviewCount} manual review notes. `;
      }
      introText += "The details are as follows:";

      const introUtterance = new SpeechSynthesisUtterance(introText);
      introUtterance.lang = "en-US";
      window.speechSynthesis.speak(introUtterance);

      result.issues.forEach((issue, idx) => {
        const textToSpeak = `Note ${idx + 1}: ${issue.title}. Explanation: ${issue.explanation}`;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      });
      return;
    }

    // Getter helper for translations that checks local fallback dictionary as well
    const getTamilText = (issue: Issue): string => {
      if (showTamil && tamilIssues[issue.code]) {
        return tamilIssues[issue.code].translated_explanation;
      }
      const code = issue.code;
      if (TAMIL_FALLBACK_DICTIONARY[code]) {
        return TAMIL_FALLBACK_DICTIONARY[code].explanation;
      }
      if (code.includes("name_mismatch")) {
        return "பெயர் முரண்பாடு கண்டறியப்பட்டது. வெவ்வேறு ஆவணங்களில் பெயர்கள் பொருந்தவில்லை. சரிபார்க்கவும்.";
      }
      if (code.includes("name_variation")) {
        return "ஆவணங்களில் பெயரின் எழுத்துக்களிலோ அல்லது இடைவெளியிலோ சிறிய மாற்றம் உள்ளது. சரிபார்க்கவும்.";
      }
      if (code.includes("expired_")) {
        return "சான்றிதழின் காலம் முடிந்துவிட்டது. புதிய சான்றிதழைப் பதிவேற்றவும்.";
      }
      if (code.includes("low_confidence_")) {
        return "ஆவணத்தில் உள்ள சில விவரங்கள் தெளிவாக இல்லை. கைமுறையாகச் சரிபார்க்கவும்.";
      }
      if (code.includes("duplicate_")) {
        return "ஒரே சான்றிதழ் ஒன்றுக்கு மேற்பட்ட முறை பதிவேற்றப்பட்டுள்ளது.";
      }
      return issue.explanation;
    };

    const getTamilTitle = (issue: Issue): string => {
      if (showTamil && tamilIssues[issue.code]) {
        return tamilIssues[issue.code].translated_title;
      }
      const code = issue.code;
      if (TAMIL_FALLBACK_DICTIONARY[code]) {
        return TAMIL_FALLBACK_DICTIONARY[code].title;
      }
      if (code.includes("name_mismatch")) return "பெயர் முரண்பாடு";
      if (code.includes("name_variation")) return "பெயர் எழுத்துப் பிழை";
      if (code.includes("expired_")) return "காலாவதியான சான்றிதழ்";
      if (code.includes("low_confidence_")) return "தெளிவற்ற விவரங்கள்";
      if (code.includes("duplicate_")) return "இரட்டைப் பதிவு";
      return issue.title;
    };

    if (result.issues.length === 0) {
      const announcement = new SpeechSynthesisUtterance(
        "ஆவண சரிபார்ப்பில் பிழைகள் எதுவும் கண்டறியப்படவில்லை. உங்களது ஆவணங்கள் தயாராக உள்ளன."
      );
      announcement.lang = "ta-IN";
      if (activeVoice) announcement.voice = activeVoice;
      window.speechSynthesis.speak(announcement);
      return;
    }
    
    let introText = `சரிபார்ப்பு முடிவு. உங்களது தயார்நிலை மதிப்பெண் நூற்றுக்கு ${result.score} ஆகும். `;
    if (errorCount > 0) {
      const errorCountTamil = TAMIL_NUMBERS[errorCount - 1] || errorCount.toString();
      introText += `${errorCountTamil} முக்கியமான பிழைகளும், `;
    }
    if (reviewCount > 0) {
      const reviewCountTamil = TAMIL_NUMBERS[reviewCount - 1] || reviewCount.toString();
      introText += `${reviewCountTamil} மறுபரிசீலனை செய்ய வேண்டிய குறிப்புகளும் கண்டறியப்பட்டுள்ளன. `;
    }
    introText += "விவரங்கள் பின்வருமாறு:";

    const introUtterance = new SpeechSynthesisUtterance(introText);
    introUtterance.lang = "ta-IN";
    if (activeVoice) introUtterance.voice = activeVoice;
    window.speechSynthesis.speak(introUtterance);

    // Speak each issue's Tamil translation using Tamil index values
    result.issues.forEach((issue, idx) => {
      const numTamil = TAMIL_NUMBERS[idx] || (idx + 1).toString();
      const title = getTamilTitle(issue);
      const explanation = getTamilText(issue);
      const textToSpeak = `குறிப்பு ${numTamil}: ${title}. விளக்கம்: ${explanation}`;
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "ta-IN";
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
    setError("");
    setLoading(true);
    setResult(null);
    setTamilIssues({});
    setShowTamil(false);
    stopSpeaking();

    const formData = new FormData();
    formData.append("service_id", "tn_post_matric_scholarship_bc");
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

  // Map status categories to styling
  const getStatusStyles = (status: string) => {
    switch (status) {
      case "UNABLE_TO_VERIFY":
        return {
          text: "UNABLE TO VERIFY",
          bg: "bg-slate-100 text-slate-700 ring-slate-700/10",
          desc: "The uploaded files could not be classified. Please verify file content and formats."
        };
      case "CORRECTIONS_REQUIRED":
        return {
          text: "CORRECTIONS REQUIRED",
          bg: "bg-rose-50 text-rose-700 ring-rose-700/10",
          desc: "We detected blocking inconsistencies (such as missing files or name mismatches). Correct them before applying."
        };
      case "MANUAL_REVIEW_REQUIRED":
        return {
          text: "MANUAL REVIEW REQUIRED",
          bg: "bg-amber-50 text-amber-700 ring-amber-700/10",
          desc: "No blocking errors were found, but some low-confidence fields require manual confirmation."
        };
      case "READY":
      default:
        return {
          text: "READY",
          bg: "bg-emerald-50 text-emerald-700 ring-emerald-700/10",
          desc: "No blocking inconsistency was detected in the uploaded document fields."
        };
    }
  };

  return (
    <main className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 lg:py-12 flex-1">
      <div className="text-center mb-8">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Verification Console
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          Upload certificates to run structured analysis against BC/MBC Post-Matric Scholarship rules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload Form Area */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-outfit text-lg font-bold text-slate-950 mb-4">1. Upload Package</h2>
          
          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Application Rule Template
              </label>
              <select className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm bg-slate-50 font-medium">
                <option value="tn_post_matric_scholarship_bc">Tamil Nadu Post-Matric Scholarship for BC/MBC/DNC</option>
              </select>
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
                  Drag & drop files here
                </span>
                <span className="block text-xs text-slate-400 mt-1">
                  or click to select (PDF, JPG, PNG up to 8MB)
                </span>
              </label>
            </div>

            {/* Uploaded File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">
                    Selected Files ({files.length}/6)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    Clear All
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
              disabled={loading || files.length === 0}
              className="w-full flex justify-center items-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
              id="btn-trigger-analysis"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing (AI extraction takes time)...
                </span>
              ) : (
                "Run Verification Check"
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
            <div className="border border-slate-200 border-dashed rounded-2xl p-16 text-center bg-white shadow-sm h-full flex flex-col justify-center items-center">
              <span className="text-4xl mb-4">🔍</span>
              <h3 className="font-outfit text-base font-bold text-slate-800">No verification results</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Upload your document package and click &quot;Run Verification Check&quot; to inspect details.
              </p>
            </div>
          )}

          {loading && (
            <div className="border border-slate-200 rounded-2xl p-16 text-center bg-white shadow-sm h-full flex flex-col justify-center items-center">
              <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="font-outfit text-base font-bold text-slate-800">Analyzing Documents</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Vertex AI Gemini is extracting structured information and running name-matching validation...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Header card with readiness score */}
              {(() => {
                const status = getStatusStyles(result.status);
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg}`}>
                        {status.text}
                      </span>
                      <h3 className="font-outfit text-xl font-bold text-slate-900 mt-2">
                        Readiness Summary
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
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Score</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Translation controls */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">2. Issues Report</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTamil(!showTamil)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-all cursor-pointer ${
                      showTamil 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {showTamil ? "Show English Report" : "தமிழ் விளக்கம் (Tamil translation)"}
                  </button>
                  <button
                    type="button"
                    onClick={speakTamilReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                  >
                    <span>🔊</span> Speak (தமிழ்)
                  </button>
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all cursor-pointer"
                    title="Stop Audio"
                  >
                    ■
                  </button>
                </div>
              </div>

              {/* Issues List */}
              {result.issues.length === 0 ? (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
                  <span className="text-2xl block mb-2">🎉</span>
                  <p className="font-bold text-emerald-950 text-sm">Perfect package checklist!</p>
                  <p className="text-xs text-emerald-800/80 mt-1">No mismatches, expiries, or missing documents found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.issues.map((issue) => {
                    const isError = issue.severity === "error";
                    const isReview = issue.severity === "review";
                    const hasTamil = showTamil && tamilIssues[issue.code];
                    
                    const speakOneIssue = () => {
                      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
                      window.speechSynthesis.cancel();
                      
                      const useTamil = showTamil && activeVoice !== null;
                      const title = useTamil && tamilIssues[issue.code] ? tamilIssues[issue.code].translated_title : issue.title;
                      const expl = useTamil && tamilIssues[issue.code] ? tamilIssues[issue.code].translated_explanation : issue.explanation;
                      const text = `${title}. ${expl}`;
                      
                      const utterance = new SpeechSynthesisUtterance(text);
                      utterance.lang = useTamil ? "ta-IN" : "en-US";
                      if (useTamil && activeVoice) {
                        utterance.voice = activeVoice;
                      }
                      window.speechSynthesis.speak(utterance);
                    };

                    return (
                      <div
                        key={issue.code}
                        className={`border rounded-2xl p-4 bg-white shadow-sm flex items-start gap-3 transition-colors ${
                          isError 
                            ? "border-rose-200 hover:bg-rose-50/10" 
                            : isReview 
                              ? "border-amber-200 hover:bg-amber-50/10" 
                              : "border-slate-200 hover:bg-slate-50/20"
                        }`}
                      >
                        <span 
                          onClick={speakOneIssue}
                          className={`text-lg p-1 rounded-lg cursor-pointer hover:scale-105 transition-transform ${
                            isError ? "bg-rose-50 text-rose-600" : isReview ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                          }`}
                          title="Speak this issue"
                        >
                          {isError ? "⛔" : isReview ? "⚠️" : "ℹ️"}
                        </span>
                        
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {hasTamil ? tamilIssues[issue.code].translated_title : issue.title}
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isError ? "bg-rose-50 text-rose-700" : isReview ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {hasTamil ? tamilIssues[issue.code].translated_explanation : issue.explanation}
                          </p>

                          {/* Render associated file badges */}
                          {issue.document_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {issue.document_ids.map(id => {
                                const indexVal = parseInt(id);
                                const doc = result.documents[indexVal];
                                const filename = files[indexVal]?.name || "uploaded-file";
                                return (
                                  <span key={id} className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200">
                                    📄 {doc ? doc.document_type.replace("_", " ").toUpperCase() : "Unknown"} ({filename})
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {issue.official_source && (
                            <div className="pt-2">
                              <a
                                href={issue.official_source}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-500 underline"
                              >
                                View official requirement source &rarr;
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extracted Metadata Inspector */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-outfit text-base font-bold text-slate-950">3. Extracted Metadata Inspection</h3>
                
                {/* Information Tip Note explaining Model-Reported Confidence */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl text-xs text-blue-800">
                  <p className="font-bold">💡 Verification Tip:</p>
                  <p className="mt-1">
                    Model-reported confidence is an AI estimate. Compare the extracted value with the highlighted source text to verify accuracy.
                  </p>
                </div>

                <div className="space-y-4">
                  {result.documents.map((doc, idx) => {
                    const filename = files[idx]?.name || "N/A";
                    return (
                      <details key={idx} className="group border border-slate-100 rounded-xl overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors select-none">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📄</span>
                            <div>
                              <span className="font-bold text-sm text-slate-800 uppercase tracking-tight">
                                Doc #{idx + 1}: {doc.document_type.replace("_", " ")}
                              </span>
                              <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                                File: {filename} (Model-reported classification confidence: {intPercent(doc.document_type_confidence)}%)
                              </span>
                            </div>
                          </div>
                          <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        
                        <div className="p-4 border-t border-slate-100 bg-white text-xs space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldRow label="Holder Name" field={doc.holder_name} />
                            <FieldRow label="Certificate ID" field={doc.certificate_number} />
                            <FieldRow label="Date of Birth" field={doc.date_of_birth} />
                            <FieldRow label="Issue Date" field={doc.issue_date} />
                            <FieldRow label="Expiry Date" field={doc.expiry_date} />
                            <FieldRow label="Annual Income" field={doc.annual_income} />
                            <FieldRow label="Community / Caste" field={doc.community} />
                            <FieldRow label="Bank Holder" field={doc.bank_account_holder} />
                            <FieldRow label="Bank Acc (Last 4)" field={doc.bank_account_last4} />
                            <FieldRow label="Bank IFSC" field={doc.ifsc} />
                            <FieldRow label="Institution Name" field={doc.institution_name} />
                            <FieldRow label="Academic Year" field={doc.academic_year} />
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-slate-400 leading-relaxed text-center italic bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                {result.disclaimer}
              </p>

            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// Helper formatting percentage
function intPercent(val: number) {
  return Math.round(val * 100);
}

// Field Display Row Helper Component with low-confidence warning indicators
function FieldRow({ label, field }: { label: string; field: ExtractedField }) {
  if (!field || field.value === undefined || field.value === null) return null;
  const isLowConfidence = field.confidence < 0.80;
  
  return (
    <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-4 transition-colors ${
      isLowConfidence ? "border-amber-200 bg-amber-50/20" : "border-slate-100 bg-slate-50/30"
    }`}>
      <div>
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="font-semibold text-slate-800 mt-0.5 block flex items-center gap-1.5">
          {field.value}
          {isLowConfidence && (
            <span className="text-[10px] text-amber-600" title="Low Confidence - Verify manually">⚠️</span>
          )}
        </span>
        {field.evidence && (
          <span className="block text-[10px] text-slate-400 mt-1 italic leading-tight">
            &quot;{field.evidence}&quot;
          </span>
        )}
      </div>
      <div className="text-right">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
          isLowConfidence ? "bg-amber-50 text-amber-700" : "bg-indigo-50/50 text-indigo-600"
        }`}>
          {intPercent(field.confidence)}%
        </span>
      </div>
    </div>
  );
}
