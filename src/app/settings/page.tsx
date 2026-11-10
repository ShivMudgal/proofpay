import { read } from "@/lib/db";
import { currentUser } from "@/lib/session";
import PageHeader from "@/components/PageHeader";
import RulesForm from "@/components/RulesForm";

export default async function Settings() {
  const user = await currentUser();
  if (user.role !== "FREELANCER") {
    return (
      <>
        <PageHeader title="Agent settings" />
        <p className="text-sm text-muted">Agent settings are available to freelancer accounts.</p>
      </>
    );
  }
  const rules = (await read()).rules.find((r) => r.freelancerId === user.id)!;
  return (
    <>
      <PageHeader
        title="Agent settings"
        description="Limits your negotiation agent works within. Clients never see these values, and the floor price is enforced on the server."
      />
      <div className="panel max-w-3xl">
        <RulesForm rules={rules} paypalEmail={user.paypalEmail} />
      </div>
    </>
  );
}
