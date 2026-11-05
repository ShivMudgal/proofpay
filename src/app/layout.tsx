import "./globals.css";
import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { read } from "@/lib/db";
import { paypalLive } from "@/lib/paypal";
import { aiLive } from "@/lib/llm";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ProofPay",
  description: "Milestone escrow for freelance work, powered by PayPal.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const { users } = read();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar
            users={users}
            currentId={user.id}
            role={user.role}
            env={{ paypal: paypalLive ? "Sandbox" : "Demo", ai: aiLive ? "Gemini" : "Offline" }}
          />
          <main className="flex-1 min-w-0">
            <div className="mx-auto max-w-[1180px] px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
