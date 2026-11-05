"use client";
import { useState } from "react";
import type { FreelancerRules } from "@/lib/types";
import { useAction } from "./useAction";

type Form = Omit<FreelancerRules, "freelancerId"> & { paypalEmail: string };

export default function RulesForm({ rules, paypalEmail }: { rules: FreelancerRules; paypalEmail: string }) {
  const { run, busy, error } = useAction();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Form>({ ...rules, paypalEmail });

  const bind = (key: keyof Form) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setSaved(false);
      setForm({ ...form, [key]: e.target.value });
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await run("/api/rules", form, "PUT")) setSaved(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <Section title="Pricing" hint="The agent opens at the opening price and never goes below the floor.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Floor price (₹)"><input className="field num" type="number" {...bind("floorPrice")} /></Field>
          <Field label="Opening price (₹)"><input className="field num" type="number" {...bind("targetPrice")} /></Field>
        </div>
      </Section>
      <Section title="Delivery" hint="Applied to every negotiation.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum deadline (days)"><input className="field num" type="number" {...bind("minDeadlineDays")} /></Field>
          <Field label="Revisions included"><input className="field num" type="number" {...bind("maxRevisions")} /></Field>
        </div>
      </Section>
      <Section title="Profile" hint="Used by the agent to decide what work to take on.">
        <div className="space-y-4">
          <Field label="Skills"><input className="field" {...bind("skills")} /></Field>
          <Field label="Notes"><textarea className="field h-24 py-2" {...bind("notes")} /></Field>
        </div>
      </Section>
      <Section title="Payouts" hint="Released milestone payments are sent to this PayPal account. Use your sandbox business account while testing.">
        <Field label="PayPal email"><input className="field" type="email" {...bind("paypalEmail")} /></Field>
      </Section>
      <div className="flex items-center justify-end gap-3 px-6 py-4">
        {error && <p className="text-sm text-red-700 mr-auto">{error}</p>}
        {saved && <span className="text-sm text-muted">Saved</span>}
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 px-6 py-6 border-b border-edge">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted mt-1">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
