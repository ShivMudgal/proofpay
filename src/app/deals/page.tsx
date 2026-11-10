import Link from "next/link";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { dealStatus, dealsFor, userName } from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import { DealBadge } from "@/components/StatusBadge";
import { shortDate, inr } from "@/components/format";
import { IconPlus } from "@/components/icons";

export default async function Deals() {
  const user = await currentUser();
  const db = await read();
  const deals = dealsFor(db, user);
  return (
    <>
      <PageHeader
        title="Deals"
        description="Negotiations between clients and freelancers. Accepted deals become milestone contracts."
        actions={user.role === "CLIENT" && <Link href="/deals/new" className="btn-primary"><IconPlus />New deal</Link>}
      />
      <div className="panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Deal</th><th className="th">Client</th><th className="th">Freelancer</th>
              <th className="th text-right">Budget</th><th className="th text-right">Current offer</th>
              <th className="th">Created</th><th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="hover:bg-canvas">
                <td className="td"><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.title}</Link></td>
                <td className="td text-muted">{userName(db, d.clientId)}</td>
                <td className="td text-muted">{userName(db, d.freelancerId)}</td>
                <td className="td text-right num text-muted">{inr(d.budgetMin)} – {inr(d.budgetMax)}</td>
                <td className="td text-right num">{d.currentOffer ? inr(d.currentOffer.price) : "—"}</td>
                <td className="td text-muted">{shortDate(d.createdAt)}</td>
                <td className="td"><DealBadge status={dealStatus(db, d)} /></td>
              </tr>
            ))}
            {deals.length === 0 && <tr><td colSpan={7} className="td text-center text-muted py-12">No deals yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
