"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FreelancerRules, JobStatus, NegotiationMessage, Offer, Role } from "@/lib/types";
import { useAction } from "./useAction";
import { inr } from "./format";
import { IconLock } from "./icons";

type Props = {
  jobId: string;
  status: JobStatus;
  contractId: string | null;
  offer: Offer | null;
  messages: NegotiationMessage[];
  viewerRole: Role;
  clientName: string;
  freelancerName: string;
  privateRules: FreelancerRules | null;
};

type TurnResponse = { clientSeemsToAccept: boolean; guardrail?: string };

export default function DealRoom(props: Props) {
  const router = useRouter();
  const chat = useAction();
  const accept = useAction();
  const [draft, setDraft] = useState("");
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResponse | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const isClient = props.viewerRole === "CLIENT";
  const isOpen = props.status === "NEGOTIATING";
  const agentName = `${props.freelancerName.split(" ")[0]}'s agent`;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [props.messages.length, outgoing]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || chat.busy) return;
    setDraft("");
    setOutgoing(text);
    const res = await chat.run<TurnResponse>(`/api/jobs/${props.jobId}/messages`, { content: text });
    setOutgoing(null);
    if (res) setLastTurn(res);
  }

  async function acceptOffer() {
    const res = await accept.run<{ contractId: string }>(`/api/jobs/${props.jobId}/accept`);
    if (res?.contractId) router.push(`/contracts/${res.contractId}`);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <section className="panel flex flex-col h-[600px]">
        <header className="flex items-center justify-between px-4 h-12 border-b border-edge">
          <h2 className="text-sm font-semibold">Negotiation</h2>
          <span className="text-xs text-muted">{isOpen ? `Negotiating with ${agentName}` : "Closed"}</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {props.messages.map((m) => (
            <Message key={m.id} message={m} clientName={props.clientName} agentName={agentName} />
          ))}
          {outgoing && (
            <>
              <Message message={{ id: "out", jobId: "", sender: "CLIENT", content: outgoing, createdAt: "" }} clientName={props.clientName} agentName={agentName} />
              <p className="text-xs text-muted">{agentName} is typing…</p>
            </>
          )}
          <div ref={bottom} />
        </div>

        {isOpen && isClient && (
          <form onSubmit={send} className="border-t border-edge p-3 flex gap-2">
            <input
              className="field"
              placeholder="Propose a price, deadline or scope change"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={chat.busy}
            />
            <button className="btn-primary" disabled={chat.busy || !draft.trim()}>Send</button>
          </form>
        )}
        {isOpen && !isClient && (
          <p className="border-t border-edge px-4 py-3 text-xs text-muted">
            Your agent is handling this negotiation. Switch to the client account to reply.
          </p>
        )}
        {chat.error && <p className="px-4 pb-3 text-xs text-red-700">{chat.error}</p>}
      </section>

      <aside className="space-y-4">
        <section className="panel">
          <header className="px-4 h-12 flex items-center border-b border-edge">
            <h2 className="text-sm font-semibold">Current terms</h2>
          </header>
          {props.offer ? (
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted">Price</dt><dd className="text-right font-semibold num">{inr(props.offer.price)}</dd>
                <dt className="text-muted">Delivery</dt><dd className="text-right num">{props.offer.deadlineDays} days</dd>
                <dt className="text-muted">Milestones</dt><dd className="text-right num">{props.offer.milestones.length}</dd>
              </dl>
              <ol className="mt-4 pt-4 border-t border-edge space-y-2 text-sm">
                {props.offer.milestones.map((name, i) => (
                  <li key={i} className="flex gap-2"><span className="text-subtle num w-4">{i + 1}</span><span>{name}</span></li>
                ))}
              </ol>
              {lastTurn?.guardrail && (
                <p className="mt-4 text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">{lastTurn.guardrail}</p>
              )}
              {isOpen && isClient && (
                <button onClick={acceptOffer} disabled={accept.busy} className="btn-primary w-full mt-4">
                  {accept.busy ? "Drafting contract…" : `Accept terms · ${inr(props.offer.price)}`}
                </button>
              )}
              {accept.error && <p className="text-xs text-red-700 mt-2">{accept.error}</p>}
              {props.contractId && <Link href={`/contracts/${props.contractId}`} className="btn-secondary w-full mt-4">Open contract</Link>}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted">No terms proposed yet. Send a message to start.</p>
          )}
        </section>

        {props.privateRules && (
          <section className="panel p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><IconLock className="w-3.5 h-3.5" />Agent limits</h3>
            <p className="text-xs text-muted mt-1">Only visible to you. Enforced server-side.</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm mt-3">
              <dt className="text-muted">Floor price</dt><dd className="text-right num">{inr(props.privateRules.floorPrice)}</dd>
              <dt className="text-muted">Opening price</dt><dd className="text-right num">{inr(props.privateRules.targetPrice)}</dd>
              <dt className="text-muted">Min. deadline</dt><dd className="text-right num">{props.privateRules.minDeadlineDays} days</dd>
              <dt className="text-muted">Revisions</dt><dd className="text-right num">{props.privateRules.maxRevisions}</dd>
            </dl>
            <Link href="/settings" className="text-xs text-accent hover:underline mt-3 inline-block">Edit limits</Link>
          </section>
        )}
      </aside>
    </div>
  );
}

function Message({ message, clientName, agentName }: { message: NegotiationMessage; clientName: string; agentName: string }) {
  if (message.sender === "SYSTEM") {
    return <p className="text-center text-xs text-muted">{message.content}</p>;
  }
  const mine = message.sender === "CLIENT";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-xs text-muted mb-1">{mine ? clientName : agentName}</span>
      <div className={`max-w-[78%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${mine ? "bg-accent text-white" : "bg-canvas border border-edge"}`}>
        {message.content}
      </div>
      {message.offer && !mine && (
        <span className="text-xs text-muted mt-1 num">Proposed {inr(message.offer.price)} · {message.offer.deadlineDays} days</span>
      )}
    </div>
  );
}
