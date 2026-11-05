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
    jobs: [
      {
        id: "job_demo",
        clientId: "u_client",
        freelancerId: "u_freelancer",
        title: "Landing page for my home-baking business",
        description:
          "I need a responsive landing page for 'Riya's Bakes' with a hero section, a menu of 6 items with prices, a contact form, and Instagram link. Should be deployed online.",
        budgetMin: 10000,
        budgetMax: 20000,
        status: "NEGOTIATING",
        currentOffer: null,
        contractId: null,
        createdAt: now,
      },
    ],
    messages: [
      {
        id: "m_sys",
        jobId: "job_demo",
        sender: "SYSTEM",
        content:
          "Negotiation started with Arjun Mehta's agent.",
        createdAt: now,
      },
    ],
    contracts: [],
    milestones: [],
    submissions: [],
    webhookEvents: [],
  };
}
