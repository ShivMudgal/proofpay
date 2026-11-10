import Link from "next/link";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { contractsFor, dealsFor, recentActivity, totals, userName } from "@/lib/queries";
import PageHeader, { Stat } from "@/components/PageHeader";
import { DealBadge } from "@/components/StatusBadge";
import { dateTime, inr } from "@/components/format";
import { IconPlus } from "@/components/icons";
import ResetButton from "@/components/ResetButton";

export default async function Overview() {
  const user = await currentUser();
  const db = await read();
  const deals = dealsFor(db, user);
  const contracts = contractsFor(db, user);
  const t = totals(contracts.flatMap((c) => c.milestones));
  const activity = recentActivity(db, user);

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description={user.role === "CLIENT" ? "Track your deals, funded milestones and payments." : "Track your deals, submissions and payouts."}
        actions={user.role === "CLIENT" && (
          <Link href="/deals/new" className="btn-primary"><IconPlus />New deal</Link>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Contract value" value={inr(t.total)} />
        <Stat label="Unfunded" value={inr(t.unfunded)} />
        <Stat label="In escrow" value={inr(t.held)} tone="amber" />
        <Stat label={user.role === "CLIENT" ? "Paid out" : "Received"} value={inr(t.released)} tone="green" />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12 border-b border-edge">
            <h2 className="text-sm font-semibold">Deals</h2>
            <Link href="/deals" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr><th className="th">Deal</th><th className="th">Counterparty</th><th className="th">Terms</th><th className="th">Status</th></tr>
            </thead>
            <tbody>
              {deals.slice(0, 6).map((d) => (
                <tr key={d.id} className="hover:bg-canvas">
                  <td className="td">
                    <Link href={d.contractId ? `/contracts/${d.contractId}` : `/deals/${d.id}`} className="font-medium hover:text-accent">{d.title}</Link>
                  </td>
                  <td className="td text-muted">{userName(db, user.role === "CLIENT" ? d.freelancerId : d.clientId)}</td>
                  <td className="td num">{d.currentOffer ? `${inr(d.currentOffer.price)} · ${d.currentOffer.deadlineDays}d` : <span className="text-subtle">No offer yet</span>}</td>
                  <td className="td"><DealBadge status={d.status} /></td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr><td colSpan={4} className="td text-center text-muted py-10">No deals yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="px-4 h-12 flex items-center border-b border-edge">
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          <ul className="divide-y divide-edge">
            {activity.map((a, i) => (
              <li key={i} className="px-4 py-3">
                <Link href={`/contracts/${a.contract.id}`} className="block">
                  <div className="text-sm">{a.label}</div>
                  <div className="text-xs text-muted mt-0.5 truncate">{a.milestone.name} · {dateTime(a.at)}</div>
                </Link>
              </li>
            ))}
            {activity.length === 0 && <li className="px-4 py-10 text-sm text-muted text-center">Nothing yet.</li>}
          </ul>
        </section>
      </div>

      <div className="mt-8 text-right"><ResetButton /></div>
    </>
  );
}
