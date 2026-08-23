export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="space-y-6">
        <h1 className="font-outfit text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Privacy & Data Handling Policy
        </h1>
        <p className="text-slate-600 leading-relaxed">
          DocSureInd is committed to protecting the privacy of students and applicants. Because identity documents contain sensitive personal identifiers, the prototype is built with a <strong>&quot;Zero-Retention&quot;</strong> data model.
        </p>

        <hr className="border-slate-200" />

        <div className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">
            1. How Your Documents Are Processed
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            When you upload documents on DocSureInd:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>
              Files are sent as in-memory streams to the backend server.
            </li>
            <li>
              The server routes the document data securely to Vertex AI (Gemini 2.5 Flash) using encrypted channels for OCR and classification.
            </li>
            <li>
              Only structured JSON metadata (e.g. candidate name, document type, certificate number, expiry dates) is returned and evaluated.
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">
            2. Deletion Guarantee
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            DocSureInd does not store raw images or PDFs of uploaded documents on permanent storage disks. Once the analysis is completed (which takes 2-5 seconds), the files are immediately released from server memory. No database logs of document images are created.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">
            3. Recommendations for Prototyping
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
            For testing the prototype, we strongly recommend uploading only <strong>redacted</strong> documents (where Aadhaar numbers, detailed bank account balances, or signatures are blacked out) or synthetic/fake sample files.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-outfit text-xl font-bold text-slate-900">
            4. Compliance
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Our data protection principles align with India&apos;s Digital Personal Data Protection (DPDP) Act.
          </p>
        </div>
      </div>
    </main>
  );
}
