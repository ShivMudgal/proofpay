import type { Contract, Job, Milestone, NegotiationMessage, Offer } from "./types";

// Ready-made deals so judges see a contract and an open negotiation straight away.
// Fixed IDs keep `npm run showcase` idempotent. There are no PayPal IDs here on purpose:
// both contract milestones are unfunded, so every PayPal ID in the app comes from a real sandbox call.

export const SHOWCASE_JOB_IDS = ["job_showcase_wedding", "job_showcase_cafe"] as const;

export interface ShowcaseDeal {
  job: Job;
  messages: NegotiationMessage[];
  contract: Contract | null;
  milestones: Milestone[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function showcaseDeals(now = new Date()): ShowcaseDeal[] {
  const t = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
  return [weddingDeal(t), cafeDeal(t)];
}

// a) Agreed and contracted: two unfunded milestones, ready for the client to fund with PayPal.
function weddingDeal(t: (ms: number) => string): ShowcaseDeal {
  const jobId = "job_showcase_wedding";
  const contractId = "ct_showcase_wedding";
  const created = -26 * HOUR;

  const opening: Offer = {
    price: 36000,
    deadlineDays: 14,
    scope: "Portfolio site with homepage, gallery with lightbox, about page and booking form, deployed online",
    milestones: ["Gallery design and homepage", "Booking form and launch"],
  };
  const agreed: Offer = { ...opening, price: 32000 };

  const job: Job = {
    id: jobId,
    clientId: "u_client",
    freelancerId: "u_freelancer",
    title: "Portfolio website for a wedding photographer",
    description:
      "I'm a wedding photographer and need a portfolio website: a homepage with a big hero photo, a gallery of my best work, an about page, and a booking form where couples can send their wedding date. It must look good on phones and be live online.",
    budgetMin: 25000,
    budgetMax: 40000,
    status: "CONTRACTED",
    currentOffer: agreed,
    contractId,
    createdAt: t(created),
  };

  const msg = (n: number, sender: NegotiationMessage["sender"], content: string, offer?: Offer): NegotiationMessage => ({
    id: `m_showcase_wedding_${n}`,
    jobId,
    sender,
    content,
    ...(offer && { offer }),
    createdAt: t(created + n * 4 * 60_000),
  });

  const messages = [
    msg(0, "SYSTEM", "Negotiation started with Arjun Mehta's agent."),
    msg(1, "CLIENT", "Hi! I'd like the portfolio site live before wedding season. Can you do it for ₹28,000?"),
    msg(
      2,
      "AGENT",
      "Thanks for the details! For a homepage, a lightbox gallery, an about page and a booking form, deployed online, I can offer ₹36,000 over 14 days in two milestones.",
      opening,
    ),
    msg(3, "CLIENT", "That's a bit above what I planned. Could you meet me at ₹32,000 if I send all the photos and text upfront?"),
    msg(
      4,
      "AGENT",
      "Having all the content upfront saves time, so ₹32,000 works. Same scope and 14 days, split into Gallery design and homepage, then Booking form and launch.",
      agreed,
    ),
    msg(5, "CLIENT", "Perfect, I accept. Let's do it."),
    msg(6, "SYSTEM", "Terms accepted at ₹32,000. Contract drafted with 2 milestones."),
  ];

  const contract: Contract = {
    id: contractId,
    jobId,
    clientId: "u_client",
    freelancerId: "u_freelancer",
    title: "Portfolio website for a wedding photographer",
    summary:
      "A responsive portfolio site for a wedding photographer with a hero homepage, a lightbox gallery, an about page and a booking form, delivered in two milestones and deployed to a public URL.",
    totalAmount: 32000,
    currency: "INR",
    createdAt: t(created + 30 * 60_000),
  };

  const milestone = (index: number, name: string, amount: number, dueInDays: number, acceptanceCriteria: string[]): Milestone => ({
    id: `ms_showcase_wedding_${index + 1}`,
    contractId,
    index,
    name,
    amount,
    dueDate: t(created + dueInDays * DAY),
    acceptanceCriteria,
    status: "PENDING",
    paypalOrderId: null,
    authorizationId: null,
    captureId: null,
    timeline: [{ at: contract.createdAt, label: "Milestone created" }],
  });

  const milestones = [
    milestone(0, "Gallery design and homepage", 12800, 6, [
      "Homepage has a full-width hero image with the photographer's name and a 'Book a date' button",
      "A gallery page shows at least 12 photos in a responsive grid",
      "Clicking a gallery photo opens it in a larger lightbox view that can be closed",
      "Pages work at 375px width with no horizontal scrolling",
    ]),
    milestone(1, "Booking form and launch", 19200, 14, [
      "An about page introduces the photographer with a portrait photo and a short bio",
      "The booking form has name, email, wedding date and message fields, all required",
      "Submitting the form shows a confirmation message",
      "The site is deployed at a public URL and the page title mentions wedding photography",
    ]),
  ];

  return { job, messages, contract, milestones };
}

// b) Still negotiating: the agent has made an offer and the client can keep haggling.
function cafeDeal(t: (ms: number) => string): ShowcaseDeal {
  const jobId = "job_showcase_cafe";
  const created = -3 * HOUR;

  const offer: Offer = {
    price: 18500,
    deadlineDays: 7,
    scope: "Link-in-bio landing page with menu and launch offer, 9 Instagram post and 6 story templates in our brand colours, and a 7-day launch posting calendar",
    milestones: ["Landing page and brand templates", "Launch calendar and handover"],
  };

  const job: Job = {
    id: jobId,
    clientId: "u_client",
    freelancerId: "u_freelancer",
    title: "Social media launch kit for a cafe",
    description:
      "We're opening a small cafe next month and need a social media launch kit: a link-in-bio landing page with our menu and opening offer, Instagram post and story templates using our existing logo and colours, and a posting calendar for launch week.",
    budgetMin: 12000,
    budgetMax: 20000,
    status: "NEGOTIATING",
    currentOffer: offer,
    contractId: null,
    createdAt: t(created),
  };

  const messages: NegotiationMessage[] = [
    { id: "m_showcase_cafe_0", jobId, sender: "SYSTEM", content: "Negotiation started with Arjun Mehta's agent.", createdAt: t(created) },
    {
      id: "m_showcase_cafe_1",
      jobId,
      sender: "CLIENT",
      content: "Hi! We open in four weeks. Could you put the whole launch kit together for ₹12,000?",
      createdAt: t(created + 5 * 60_000),
    },
    {
      id: "m_showcase_cafe_2",
      jobId,
      sender: "AGENT",
      content:
        "Congratulations on the opening! I can build the link-in-bio page with your menu and offer, 9 post and 6 story templates in your colours, and a launch-week calendar for ₹18,500, delivered in 7 days.",
      offer,
      createdAt: t(created + 7 * 60_000),
    },
  ];

  return { job, messages, contract: null, milestones: [] };
}
