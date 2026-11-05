import Link from "next/link";

export default function PageHeader({ title, description, back, actions }: {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="text-sm text-muted hover:text-fg">
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-6 mt-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="text-sm text-muted mt-1 max-w-3xl">{description}</div>}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "green" }) {
  const color = tone === "amber" ? "text-amber-700" : tone === "green" ? "text-emerald-700" : "text-fg";
  return (
    <div className="panel px-5 py-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 num ${color}`}>{value}</div>
    </div>
  );
}
