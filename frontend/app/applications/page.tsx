"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TemplateInfo = {
  id: string;
  name: string;
  department: string;
  scope: string;
  status: "VERIFIED" | "DRAFT";
  version: string;
  verified_on: string | null;
  supported_scenarios: string[];
  unsupported_scenarios: string[];
};

export default function ApplicationsPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/templates?include_drafts=false");
        if (res.ok) {
          const list = await res.json();
          setTemplates(list);
        }
      } catch (e) {
        console.error("Failed to load templates", e);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            DocSureInd Application Catalogue
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-500">
            Select a public service template to evaluate your application readiness.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="Search templates or departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            No matching templates found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                        {t.scope}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mt-2">{t.name}</h2>
                    </div>
                    
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ring-1 ring-inset ${
                        t.status === "VERIFIED"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    {t.department}
                  </p>

                  <div className="border-t border-slate-100 my-4"></div>

                  {/* Scenarios Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    {/* Supported */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-emerald-700 flex items-center gap-1">
                        ✓ Supported Scenarios
                      </h3>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {t.supported_scenarios.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Unsupported */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-rose-700 flex items-center gap-1">
                        ✗ Unsupported Scenarios
                      </h3>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {t.unsupported_scenarios.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Card Action footer */}
                <div className="bg-slate-50 px-6 py-4 sm:px-8 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Version {t.version} {t.verified_on && `• Verified ${t.verified_on}`}
                  </div>
                  
                  <Link
                    href={`/check?template_id=${t.id}`}
                    className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                  >
                    Start Checker
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
