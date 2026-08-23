import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="space-y-8">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tamil Nadu Scholarship Guidelines
          </h1>
          <p className="mt-2 text-slate-600">
            Understand the rules, required documents, and verification parameters used by DocSureInd.
          </p>
        </div>

        <hr className="border-slate-200" />

        {/* Requirements Card */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-outfit text-xl font-bold text-slate-900 mb-4">Required Documents Checklist</h2>
          <p className="text-sm text-slate-600 mb-6">
            The following four documents must be uploaded for a successful validation check.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">💰</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Income Certificate</p>
                <p className="text-xs text-slate-500 mt-1">Must be active (typically valid for 6 months from the date of issue).</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">👥</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Community Certificate</p>
                <p className="text-xs text-slate-500 mt-1">Permanent certificate confirming the applicant&apos;s caste/category details.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">🎓</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Student ID / Bonafide</p>
                <p className="text-xs text-slate-500 mt-1">Issued by the current school or college to prove enrollment status.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xl">🏦</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">Bank Passbook Front Page</p>
                <p className="text-xs text-slate-500 mt-1">Showing candidate name, account number, and IFSC code.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Verification Logic explanation */}
        <section className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">Verification Logic Rules</h2>
          <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              When documents are uploaded, DocSureInd performs the following programmatic checks:
            </p>
            <ul className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Fuzzy Name Alignment:</strong> The candidate name on the Student ID, Income Certificate, and Community Certificate must match. We run a fuzzy ratio comparison. Spacing differences like <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">R Vignesh</code> vs <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">Vignesh R</code> are flagged for manual review, while completely different names (e.g. <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">Vignesh</code> vs <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">Aravind</code>) will result in a hard blocking mismatch error.
              </li>
              <li>
                <strong>Expiry Validation:</strong> The Income Certificate is checked to ensure it hasn&apos;t expired relative to the current date.
              </li>
              <li>
                <strong>AI Confidence Check:</strong> If Vertex AI reads any field (like a certificate serial number or name) with a confidence level under 80%, it flags that specific field for manual confirmation.
              </li>
            </ul>
          </div>
        </section>

        {/* Official resources */}
        <section className="bg-slate-900 text-white rounded-2xl p-6">
          <h2 className="font-outfit text-lg font-bold">Official Government Sources</h2>
          <p className="text-slate-300 text-sm mt-1">
            Always refer to the official portal for rules and submission deadlines.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="https://www.tnscholarship.tn.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-all"
            >
              Tamil Nadu Scholarship Portal &rarr;
            </a>
            <a
              href="https://www.tn.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-all"
            >
              TN Government Homepage &rarr;
            </a>
          </div>
        </section>

        <div className="text-center">
          <Link
            href="/check"
            className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
          >
            Ready to Verify? Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
