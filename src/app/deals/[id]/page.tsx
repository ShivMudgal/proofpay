import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import PageHeader from "@/components/PageHeader";
import { DealBadge } from "@/components/StatusBadge";
import { dealStatus } from "@/lib/queries";
import DealRoom from "@/components/DealRoom";
import { inr } from "@/components/format";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await read();
  const job = db.jobs.find((j) => j.id === id);
  if (!job) notFound();

  const user = await currentUser();
  const client = db.users.find((u) => u.id === job.clientId)!;
  const freelancer = db.users.find((u) => u.id === job.freelancerId)!;
  const rules = db.rules.find((r) => r.freelancerId === freelancer.id)!;

  return (
    <>
      <PageHeader
        back={{ href: "/deals", label: "Deals" }}
        title={job.title}
        description={
          <span className="flex items-center gap-3">
            <DealBadge status={dealStatus(db, job)} />
            <span>{client.name} · {freelancer.name}</span>
            <span className="num">Budget {inr(job.budgetMin)} – {inr(job.budgetMax)}</span>
          </span>
        }
        actions={job.contractId && <Link href={`/contracts/${job.contractId}`} className="btn-secondary">View contract</Link>}
      />
      <div className="panel px-5 py-4 mb-6 text-sm text-muted leading-relaxed">{job.description}</div>
      <DealRoom
        jobId={job.id}
        status={job.status}
        contractId={job.contractId}
        offer={job.currentOffer}
        messages={db.messages.filter((m) => m.jobId === id)}
        viewerRole={user.role}
        clientName={client.name}
        freelancerName={freelancer.name}
        privateRules={user.role === "FREELANCER" ? rules : null}
      />
    </>
  );
}
