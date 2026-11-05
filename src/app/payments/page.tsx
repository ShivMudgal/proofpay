import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { contractsFor, totals } from "@/lib/queries";
import PageHeader, { Stat } from "@/components/PageHeader";
import MilestonesGrid, { type Row } from "@/components/MilestonesGrid";
import { inr } from "@/components/format";

export default async function Payments() {
  const user = await currentUser();
  const { submissions } = read();
  const contracts = contractsFor(user);
  const milestones = contracts.flatMap((c) => c.milestones);

  const rows: Row[] = contracts.flatMap((c) =>
    c.milestones.map((m) => {
      const subs = submissions.filter((s) => s.milestoneId === m.id);
      const review = subs.at(-1)?.result ?? null;
      return {
        contractId: c.id,
        contract: c.title,
        milestone: m.name,
        amount: m.amount,
        status: m.status,
        score: review?.score ?? null,
        passed: review ? `${review.criteria.filter((x) => x.passed).length}/${review.criteria.length}` : "—",
        attempts: subs.length,
        due: m.dueDate,
        authorizationId: m.authorizationId ?? "",
        captureId: m.captureId ?? "",
      };
    })
  );

  const t = totals(milestones);
  const reviewed = rows.filter((r) => r.score !== null);
  const avgScore = reviewed.length ? Math.round(reviewed.reduce((a, r) => a + (r.score ?? 0), 0) / reviewed.length) : null;

  return (
    <>
      <PageHeader title="Payments" description="Escrow state for every milestone, synced with PayPal." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="In escrow" value={inr(t.held)} tone="amber" />
        <Stat label="Paid" value={inr(t.released)} tone="green" />
        <Stat label="Reviews run" value={String(rows.reduce((a, r) => a + r.attempts, 0))} />
        <Stat label="Average review score" value={avgScore === null ? "—" : `${avgScore}/100`} />
      </div>
      <div className="panel overflow-hidden">
        <MilestonesGrid rows={rows} />
      </div>
    </>
  );
}
