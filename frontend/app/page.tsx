import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col justify-center">
      {/* Hero section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-700/10 ring-inset mb-6 animate-pulse-slow">
              Now Supporting: Tamil Nadu Student Scholarship Demo
            </span>
            <h1 className="font-outfit text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Check Document Readiness For{" "}
              <span className="text-gradient font-extrabold">Scholarship Applications</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Avoid application rejection at e-Sevai centers. DocSureInd uses Vertex AI Gemini to securely verify candidate names, certificate expiries, and document completeness in seconds.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/check"
                className="rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-indigo-500 hover:shadow-indigo-100 hover:-translate-y-0.5 transition-all"
                id="btn-hero-get-started"
              >
                Verify Documents Now &rarr;
              </Link>
              <Link
                href="/about"
                className="text-base font-semibold leading-6 text-slate-900 hover:text-indigo-600 transition-colors"
              >
                Learn Rules <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative background gradients */}
        <div className="absolute top-1/2 left-1/2 -z-10 h-[50rem] w-[50rem] -translate-y-1/2 -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-100 to-cyan-100 opacity-40 blur-3xl" />
      </section>

      {/* Feature details grid */}
      <section className="bg-white py-16 sm:py-24 border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">Smart Verification</h2>
            <p className="mt-2 font-outfit text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Automatic analysis, deterministic validation
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              
              {/* Feature 1 */}
              <div className="flex flex-col bg-slate-50 p-6 rounded-2xl border border-slate-200/60 hover:shadow-md transition-shadow">
                <dt className="flex items-center gap-x-3 text-base font-bold leading-7 text-slate-900">
                  <span className="text-2xl">📋</span>
                  Fuzzy Name Alignment
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Matches variations like <strong>&quot;R. Vignesh&quot;</strong>, <strong>&quot;Vignesh R&quot;</strong>, and <strong>&quot;VIGNESH RAMAN&quot;</strong> across certificates using fuzzy logic, highlighting major discrepancies.
                  </p>
                </dd>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col bg-slate-50 p-6 rounded-2xl border border-slate-200/60 hover:shadow-md transition-shadow">
                <dt className="flex items-center gap-x-3 text-base font-bold leading-7 text-slate-900">
                  <span className="text-2xl">⏳</span>
                  Certificate Expiration Check
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Extracts and checks expiration dates on critical documents (e.g., Income Certificates), warning you in advance if renewals are required.
                  </p>
                </dd>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col bg-slate-50 p-6 rounded-2xl border border-slate-200/60 hover:shadow-md transition-shadow">
                <dt className="flex items-center gap-x-3 text-base font-bold leading-7 text-slate-900">
                  <span className="text-2xl">🔊</span>
                  Tamil Audio Explanations
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">
                    Enables users to click a speaker button to hear all validation errors and warnings explained clearly in spoken Tamil using text-to-speech.
                  </p>
                </dd>
              </div>

            </dl>
          </div>
        </div>
      </section>

      {/* Step by step guide */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center mb-16">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">How It Works</h2>
            <p className="mt-2 font-outfit text-3xl font-bold tracking-tight text-slate-900">
              Four steps to verification confidence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="relative p-6 bg-white rounded-xl border border-slate-200 text-center">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">1</span>
              <p className="mt-4 font-bold text-slate-900">Select Service</p>
              <p className="mt-2 text-sm text-slate-600">Choose the specific Tamil Nadu scholarship rule set you want to check against.</p>
            </div>
            <div className="relative p-6 bg-white rounded-xl border border-slate-200 text-center">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">2</span>
              <p className="mt-4 font-bold text-slate-900">Upload Files</p>
              <p className="mt-2 text-sm text-slate-600">Upload redacted or synthetic PDFs or images of required documents.</p>
            </div>
            <div className="relative p-6 bg-white rounded-xl border border-slate-200 text-center">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">3</span>
              <p className="mt-4 font-bold text-slate-900">Get Readiness Score</p>
              <p className="mt-2 text-sm text-slate-600">Instantly inspect missing items, mismatches, and extracted metadata.</p>
            </div>
            <div className="relative p-6 bg-white rounded-xl border border-slate-200 text-center">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">4</span>
              <p className="mt-4 font-bold text-slate-900">Review & Translate</p>
              <p className="mt-2 text-sm text-slate-600">Translate findings into simple Tamil and hear issues spoken aloud.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety and privacy banner */}
      <section className="bg-indigo-900 text-white py-12 px-6 sm:px-12 text-center rounded-2xl max-w-7xl mx-auto w-full mb-16 shadow-xl">
        <h3 className="font-outfit text-2xl font-bold">🔒 Secure In-Memory Processing</h3>
        <p className="mt-2 text-indigo-200 max-w-2xl mx-auto text-sm">
          DocSureInd is designed with candidate privacy in mind. Files are processed instantly in memory, analyzed via Vertex AI, and immediately discarded. No records of identity documents or raw certificates are stored.
        </p>
        <Link href="/privacy" className="inline-flex mt-4 text-xs font-semibold text-indigo-300 hover:text-white underline">
          Read our data deletion policy &rarr;
        </Link>
      </section>
    </main>
  );
}
