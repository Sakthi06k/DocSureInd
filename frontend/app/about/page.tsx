import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="space-y-8">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tamil Nadu Post-Matric Scholarship Scheme Rules
          </h1>
          <p className="mt-2 text-slate-600">
            Official BC/MBC/DNC student welfare guidelines and check rules enforced by DocSureInd.
          </p>
        </div>

        <hr className="border-slate-200" />

        {/* Requirements Card */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-outfit text-xl font-bold text-slate-900 mb-4">Required Documents Checklist</h2>
          <p className="text-sm text-slate-600 mb-6">
            The BC/MBC/DNC Post-Matric scholarship scheme requires e-Sevai operators or students to submit these four primary certificates:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">💰</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Income Certificate</p>
                <p className="text-xs text-slate-500 mt-1">
                  Enforces income ceiling criteria (typically family income under ₹2.5 Lakhs). Must be active and valid.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">👥</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Community Certificate</p>
                <p className="text-xs text-slate-500 mt-1">
                  Confirms the candidate belongs to Backward Classes (BC), Most Backward Classes (MBC), or Denotified Communities (DNC).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">🎓</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Student ID / Bonafide</p>
                <p className="text-xs text-slate-500 mt-1">
                  Issued by a recognized school, college, or university confirming active registration and academic year details.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">🏦</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Bank Passbook Front Page</p>
                <p className="text-xs text-slate-500 mt-1">
                  Required to confirm details like IFSC code, bank branch, and account holder name to enable direct DBT transfers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Verification Logic explanation */}
        <section className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">Programmatic Verification Rules</h2>
          <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              DocSureInd runs deterministic, rules-based validations on fields extracted by Vertex AI Gemini:
            </p>
            <ul className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Fuzzy Name & Token Verification:</strong> Student name must match across all certificates. We run fuzzy token-sorting comparisons to support name-order variations (e.g. <code>Karthikeyan S</code> vs <code>S Karthikeyan</code>) as minor review warnings instead of hard rejection errors.
              </li>
              <li>
                <strong>Income Expiry Check:</strong> Checks certificate issue and expiry dates. If expired, raises a blocking error.
              </li>
              <li>
                <strong>AI Confidence Check:</strong> Extracted fields (certificate number, names) with confidence metrics under 80% are flagged for manual operator inspection.
              </li>
            </ul>
          </div>
        </section>

        {/* Official resources */}
        <section className="bg-slate-900 text-white rounded-2xl p-6">
          <h2 className="font-outfit text-lg font-bold">Official Government Sources</h2>
          <p className="text-slate-300 text-sm mt-1">
            Always refer to the official Backward Classes Welfare department portal guidelines.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="https://www.bcmbcmw.tn.gov.in/welfare_schemes_education.htm"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-all"
            >
              Backward Classes Welfare Portal &rarr;
            </a>
            <a
              href="https://www.tnscholarship.tn.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-all"
            >
              Tamil Nadu Scholarship Portal &rarr;
            </a>
          </div>
        </section>

        <div className="text-center">
          <Link
            href="/check"
            className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
          >
            Go to Verification Console
          </Link>
        </div>
      </div>
    </main>
  );
}
