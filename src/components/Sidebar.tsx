"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Role, User } from "@/lib/types";
import { IconChat, IconFile, IconHome, IconSettings, IconWallet } from "./icons";

type Props = {
  users: User[];
  currentId: string;
  role: Role;
  env: { paypal: string; ai: string };
};

export default function Sidebar({ users, currentId, role, env }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const links = [
    { href: "/", label: "Overview", icon: IconHome },
    { href: "/deals", label: "Deals", icon: IconChat },
    { href: "/contracts", label: "Contracts", icon: IconFile },
    { href: "/payments", label: "Payments", icon: IconWallet },
    ...(role === "FREELANCER" ? [{ href: "/settings", label: "Agent settings", icon: IconSettings }] : []),
  ];

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/deals" && path.startsWith("/jobs")));

  async function switchUser(id: string) {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <aside className="w-60 shrink-0 border-r border-edge bg-panel">
      <div className="sticky top-0 h-screen flex flex-col">
      <div className="h-14 px-5 flex items-center border-b border-edge">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <rect width="24" height="24" rx="6" fill="#3538cd" />
            <path d="M8 17V7h4.5a3 3 0 0 1 0 6H8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <span className="font-semibold tracking-tight">ProofPay</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-md px-2.5 h-9 text-sm font-medium ${
              isActive(href) ? "bg-canvas text-fg" : "text-muted hover:text-fg hover:bg-canvas"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-edge space-y-3">
        <div className="px-2.5 text-xs text-muted space-y-1">
          <div className="flex justify-between"><span>PayPal</span><span className="text-fg">{env.paypal}</span></div>
          <div className="flex justify-between"><span>AI</span><span className="text-fg">{env.ai}</span></div>
        </div>
        <div className={pending ? "opacity-60" : ""}>
          <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">Signed in as</div>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => switchUser(u.id)}
              className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left ${u.id === currentId ? "bg-canvas" : "hover:bg-canvas"}`}
            >
              <span className={`grid place-items-center w-7 h-7 rounded-full text-[11px] font-semibold ${u.id === currentId ? "bg-accent text-white" : "bg-gray-100 text-muted"}`}>
                {u.avatar}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{u.name}</span>
                <span className="block text-xs text-muted">{u.role === "CLIENT" ? "Client" : "Freelancer"}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      </div>
    </aside>
  );
}
