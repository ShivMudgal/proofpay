import Link from "next/link";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { contractsFor, totals, userName } from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import { shortDate, inr } from "@/components/format";

export default async function Contracts() {
  const user = await currentUser();
  const db = await read();
  const contracts = contractsFor(db, user);
  return (
    <>
      <PageHeader title="Contracts" description="Milestone contracts created from accepted deals." />
      <div className="panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Contract</th><th className="th">{user.role === "CLIENT" ? "Freelancer" : "Client"}</th>
              <th className="th">Progress</th><th className="th text-right">Value</th>
              <th className="th text-right">In escrow</th><th className="th text-right">Paid</th><th className="th">Created</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => {
              const t = totals(c.milestones);
              const done = c.milestones.filter((m) => m.status === "RELEASED").length;
              return (
                <tr key={c.id} className="hover:bg-canvas">
                  <td className="td"><Link href={`/contracts/${c.id}`} className="font-medium hover:text-accent">{c.title}</Link></td>
                  <td className="td text-muted">{userName(db, user.role === "CLIENT" ? c.freelancerId : c.clientId)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(done / c.milestones.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted num">{done}/{c.milestones.length}</span>
                    </div>
                  </td>
                  <td className="td text-right num">{inr(c.totalAmount)}</td>
                  <td className="td text-right num text-amber-700">{inr(t.held)}</td>
                  <td className="td text-right num text-emerald-700">{inr(t.released)}</td>
                  <td className="td text-muted">{shortDate(c.createdAt)}</td>
                </tr>
              );
            })}
            {contracts.length === 0 && (
              <tr><td colSpan={7} className="td text-center text-muted py-12">No contracts yet. Accept terms in a deal to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
