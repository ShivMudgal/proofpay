import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { paypalLive } from "@/lib/paypal";
import { milestonesOf, totals } from "@/lib/queries";
import { paypalCharge } from "@/lib/money";
import PageHeader, { Stat } from "@/components/PageHeader";
import MilestoneCard from "@/components/MilestoneCard";
import { shortDate, inr } from "@/components/format";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await read();
  const contract = db.contracts.find((c) => c.id === id);
  if (!contract) notFound();

  const user = await currentUser();
  const milestones = milestonesOf(db, contract);
  const t = totals(milestones);
  const client = db.users.find((u) => u.id === contract.clientId)!;
  const freelancer = db.users.find((u) => u.id === contract.freelancerId)!;
  const viewer = user.id === contract.clientId ? "CLIENT" : user.id === contract.freelancerId ? "FREELANCER" : "OTHER";
  const clientId = paypalLive ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "" : "";

  return (
    <>
      <PageHeader
        back={{ href: "/contracts", label: "Contracts" }}
        title={contract.title}
        description={<>{client.name} → {freelancer.name} · Created {shortDate(contract.createdAt)} · <span className="font-mono text-xs">{contract.id}</span></>}
        actions={<Link href={`/deals/${contract.jobId}`} className="btn-secondary">Negotiation history</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Contract value" value={inr(contract.totalAmount)} />
        <Stat label="Unfunded" value={inr(t.unfunded)} />
        <Stat label="In escrow" value={inr(t.held)} tone="amber" />
        <Stat label="Paid" value={inr(t.released)} tone="green" />
      </div>

      <p className="text-sm text-muted mb-6">{contract.summary}</p>

      <div className="space-y-4">
        {milestones.map((m) => {
          const subs = db.submissions.filter((s) => s.milestoneId === m.id);
          return (
            <MilestoneCard
              key={m.id}
              milestone={m}
              lastSubmission={subs.at(-1) ?? null}
              attempts={subs.length}
              viewer={viewer}
              paypalClientId={clientId}
              charge={paypalCharge(m.amount)}
            />
          );
        })}
      </div>
    </>
  );
}
