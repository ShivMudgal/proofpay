import type { DB } from "./types";

export function seedData(): DB {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u_client",
        name: "Riya Sharma",
        email: "riya@example.com",
        role: "CLIENT",
        paypalEmail: "client@personal.example.com",
        avatar: "RS",
      },
      {
        id: "u_freelancer",
        name: "Arjun Mehta",
        email: "arjun@example.com",
        role: "FREELANCER",
        paypalEmail: process.env.DEMO_FREELANCER_PAYPAL_EMAIL || "freelancer@business.example.com",
        avatar: "AM",
      },
    ],
    rules: [
      {
        freelancerId: "u_freelancer",
        floorPrice: 15000,
        targetPrice: 22000,
        minDeadlineDays: 5,
        maxRevisions: 2,
        skills: "Next.js, React, Tailwind, Node.js APIs, landing pages, dashboards",
        notes: "Prefer 2-3 milestones. Always include a deployed preview link. No logo design.",
      },
    ],
    jobs: [],
    messages: [],
    contracts: [],
    milestones: [],
    submissions: [],
    webhookEvents: [],
  };
}
