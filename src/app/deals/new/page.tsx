import { currentUser } from "@/lib/session";
import PageHeader from "@/components/PageHeader";
import PostJobForm from "@/components/PostJobForm";

export default async function NewDeal() {
  const user = await currentUser();
  return (
    <>
      <PageHeader
        title="New deal"
        back={{ href: "/deals", label: "Deals" }}
        description="Describe the work clearly. Specific requirements make for better acceptance criteria."
      />
      {user.role === "CLIENT" ? (
        <div className="panel p-6 max-w-2xl"><PostJobForm /></div>
      ) : (
        <p className="text-sm text-muted">Only clients can create deals. Switch accounts in the sidebar.</p>
      )}
    </>
  );
}
