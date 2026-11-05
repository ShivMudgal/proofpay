"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "./useAction";

const EMPTY = { title: "", description: "", budgetMin: "10000", budgetMax: "20000" };

export default function PostJobForm() {
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [form, setForm] = useState(EMPTY);

  const bind = (key: keyof typeof EMPTY) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run<{ jobId: string }>("/api/jobs", form);
    if (res) router.push(`/deals/${res.jobId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="field-label">Title</label>
        <input className="field" placeholder="Portfolio website for a photography studio" required {...bind("title")} />
      </div>
      <div>
        <label className="field-label">Scope of work</label>
        <textarea className="field h-32 py-2" placeholder="Pages, features and anything that must be included." required {...bind("description")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Budget from (₹)</label>
          <input className="field num" type="number" min={1} {...bind("budgetMin")} />
        </div>
        <div>
          <label className="field-label">Budget to (₹)</label>
          <input className="field num" type="number" min={1} {...bind("budgetMax")} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-edge">
        <button className="btn-primary mt-4" disabled={busy}>{busy ? "Creating…" : "Create deal"}</button>
      </div>
    </form>
  );
}
