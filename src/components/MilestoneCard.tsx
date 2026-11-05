"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { Milestone, Submission } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { useAction } from "./useAction";
import { dateTime, shortDate, inr } from "./format";
import { IconCheck, IconChevron, IconX } from "./icons";

type Viewer = "CLIENT" | "FREELANCER" | "OTHER";

type Props = {
  milestone: Milestone;
  lastSubmission: Submission | null;
  attempts: number;
  viewer: Viewer;
  paypalClientId: string;
  charge: { currency: string; value: string };
};

export default function MilestoneCard({ milestone: m, lastSubmission, attempts, viewer, paypalClientId, charge }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const review = lastSubmission?.result;

  return (
    <article className="panel">
      <header className="flex items-center gap-3 px-5 h-14 border-b border-edge">
        <span className="text-xs font-medium text-subtle num">{String(m.index + 1).padStart(2, "0")}</span>
        <h3 className="font-semibold truncate">{m.name}</h3>
        <StatusBadge status={m.status} />
        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-muted">Due {shortDate(m.dueDate)}</span>
          <span className="font-semibold num">{inr(m.amount)}</span>
        </div>
      </header>

      <div className="grid md:grid-cols-[1fr_300px]">
        <div className="p-5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Acceptance criteria</h4>
          <ul className="space-y-2.5">
            {m.acceptanceCriteria.map((text, i) => {
              const r = review?.criteria[i];
              return (
                <li key={i} className="flex gap-2.5 text-sm">
                  <CriterionMark state={!r ? "open" : r.passed ? "pass" : "fail"} />
                  <div>
                    <div>{text}</div>
                    {r && <div className={`text-xs mt-0.5 ${r.passed ? "text-muted" : "text-red-700"}`}>{r.reason}</div>}
                  </div>
                </li>
              );
            })}
          </ul>

          {review && (
            <div className={`mt-5 rounded-md border px-4 py-3 text-sm ${review.overallPass ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{review.overallPass ? "Review passed" : "Changes requested"}</span>
                <span className="text-xs text-muted num">Score {review.score}/100 · Attempt {attempts}</span>
              </div>
              <p className="text-muted mt-1">{review.summary}</p>
              {lastSubmission && <p className="text-xs text-muted mt-2 truncate">Submitted {lastSubmission.type.toLowerCase()}: {lastSubmission.value}</p>}
            </div>
          )}

          <button onClick={() => setHistoryOpen(!historyOpen)} className="mt-5 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <IconChevron className={`w-3.5 h-3.5 transition-transform ${historyOpen ? "rotate-90" : ""}`} />
            Activity ({m.timeline.length})
          </button>
          {historyOpen && (
            <ol className="mt-3 space-y-3 border-l border-edge ml-1.5 pl-4">
              {m.timeline.map((t, i) => (
                <li key={i} className="text-sm relative">
                  <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-edge-strong" />
                  <div>{t.label}</div>
                  <div className="text-xs text-muted">{dateTime(t.at)}{t.detail ? ` · ${t.detail}` : ""}</div>
                </li>
              ))}
            </ol>
          )}

          {(m.authorizationId || m.captureId) && (
            <dl className="mt-5 pt-4 border-t border-edge grid grid-cols-[110px_1fr] gap-y-1 text-xs">
              {m.paypalOrderId && <><dt className="text-muted">PayPal order</dt><dd className="font-mono">{m.paypalOrderId}</dd></>}
              {m.authorizationId && <><dt className="text-muted">Authorization</dt><dd className="font-mono">{m.authorizationId}</dd></>}
              {m.captureId && <><dt className="text-muted">Capture</dt><dd className="font-mono">{m.captureId}</dd></>}
            </dl>
          )}
        </div>

        <div className="p-5 border-t md:border-t-0 md:border-l border-edge bg-canvas/50">
          <ActionPanel m={m} viewer={viewer} paypalClientId={paypalClientId} charge={charge} />
        </div>
      </div>
    </article>
  );
}

function CriterionMark({ state }: { state: "open" | "pass" | "fail" }) {
  if (state === "pass") return <span className="mt-0.5 grid place-items-center w-4 h-4 rounded-full bg-emerald-600 text-white shrink-0"><IconCheck className="w-3 h-3" /></span>;
  if (state === "fail") return <span className="mt-0.5 grid place-items-center w-4 h-4 rounded-full bg-red-600 text-white shrink-0"><IconX className="w-2.5 h-2.5" /></span>;
  return <span className="mt-0.5 w-4 h-4 rounded-full border border-edge-strong shrink-0" />;
}

function ActionPanel({ m, viewer, paypalClientId, charge }: { m: Milestone; viewer: Viewer; paypalClientId: string; charge: Props["charge"] }) {
  if (m.status === "RELEASED") return <Note title="Paid" body={`${inr(m.amount)} was captured and paid to the freelancer.`} />;
  if (m.status === "VOIDED") return <Note title="Cancelled" body="The authorization was voided. The client was not charged." />;

  if (viewer === "CLIENT") {
    return m.status === "PENDING" ? <FundForm m={m} paypalClientId={paypalClientId} charge={charge} /> : <HeldPanel m={m} />;
  }
  if (viewer === "FREELANCER") {
    if (m.status === "PENDING") return <Note title="Awaiting funding" body="You'll be able to submit once the client funds this milestone." />;
    if (m.status === "SUBMITTED") return <Note title="In review" body="Your submission is being checked against the criteria." />;
    return <SubmitForm m={m} />;
  }
  return <Note title="Read only" body="You are not a party to this contract." />;
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-sm text-muted mt-1">{body}</p>
    </div>
  );
}

function FundForm({ m, paypalClientId, charge }: { m: Milestone; paypalClientId: string; charge: Props["charge"] }) {
  const router = useRouter();
  const { run, busy, error, setError } = useAction();

  async function createOrder() {
    const res = await fetch(`/api/milestones/${m.id}/order`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    return body.orderId as string;
  }

  async function fundWithoutSdk() {
    try {
      const orderId = await createOrder();
      await run(`/api/milestones/${m.id}/authorize`, { orderId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-3">
      <Note title="Fund milestone" body={`${inr(m.amount)} will be authorized and held. You're charged only when the work is approved.`} />
      {charge.currency !== "INR" && (
        <p className="text-xs text-muted">PayPal will authorize {charge.currency} {charge.value} (international settlement).</p>
      )}
      {paypalClientId ? (
        <PayPalScriptProvider options={{ clientId: paypalClientId, intent: "authorize", currency: charge.currency, components: "buttons" }}>
          <PayPalButtons
            style={{ layout: "vertical", shape: "rect", label: "pay", height: 40 }}
            createOrder={createOrder}
            onApprove={async (data) => {
              await run(`/api/milestones/${m.id}/authorize`, { orderId: data.orderID });
              router.refresh();
            }}
            onError={(err) => setError(String(err))}
          />
        </PayPalScriptProvider>
      ) : (
        <button onClick={fundWithoutSdk} disabled={busy} className="btn-primary w-full">
          {busy ? "Authorizing…" : `Authorize ${inr(m.amount)}`}
        </button>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function HeldPanel({ m }: { m: Milestone }) {
  const { run, busy, error } = useAction();
  const body =
    m.status === "REJECTED"
      ? "The last submission didn't meet all criteria. The freelancer can resubmit."
      : m.status === "SUBMITTED"
        ? "Work has been submitted and is being reviewed."
        : "Waiting for the freelancer to submit work.";

  return (
    <div className="space-y-3">
      <Note title={`${inr(m.amount)} in escrow`} body={`${body} Payment is released automatically when every criterion passes.`} />
      {m.status !== "SUBMITTED" && (
        <button
          className="btn-danger w-full"
          disabled={busy}
          onClick={() => confirm("Cancel this milestone and void the authorization?") && run(`/api/milestones/${m.id}/void`)}
        >
          {busy ? "Cancelling…" : "Cancel and release hold"}
        </button>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

const SUBMISSION_TYPES = [
  { key: "GITHUB", label: "Repository", placeholder: "https://github.com/user/repo" },
  { key: "URL", label: "Live URL", placeholder: "https://example.com" },
  { key: "TEXT", label: "Text", placeholder: "Paste the deliverable" },
] as const;

function SubmitForm({ m }: { m: Milestone }) {
  const { run, busy, error } = useAction();
  const [type, setType] = useState<(typeof SUBMISSION_TYPES)[number]["key"]>("GITHUB");
  const [value, setValue] = useState("");
  const current = SUBMISSION_TYPES.find((t) => t.key === type)!;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(`/api/milestones/${m.id}/submit`, { type, value });
      }}
    >
      <Note
        title={m.status === "REJECTED" ? "Resubmit work" : "Submit work"}
        body={`${inr(m.amount)} is in escrow and will be released if the submission meets every criterion.`}
      />
      <div className="grid grid-cols-3 rounded-md border border-edge-strong bg-panel p-0.5 text-xs">
        {SUBMISSION_TYPES.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setType(t.key)}
            className={`rounded py-1.5 font-medium ${type === t.key ? "bg-canvas text-fg shadow-sm" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {type === "TEXT" ? (
        <textarea className="field h-24 py-2" value={value} onChange={(e) => setValue(e.target.value)} placeholder={current.placeholder} required />
      ) : (
        <input className="field" value={value} onChange={(e) => setValue(e.target.value)} placeholder={current.placeholder} required />
      )}
      <button className="btn-primary w-full" disabled={busy || !value.trim()}>{busy ? "Reviewing…" : "Submit for review"}</button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
