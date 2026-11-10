import type { Contract, DB, Job, Milestone, MilestoneStatus, User } from "./types";

// Pure helpers over a DB snapshot. Pages load one snapshot with `await read()` and pass it in,
// so a page costs one database round trip.

const HELD: MilestoneStatus[] = ["FUNDED", "SUBMITTED", "REJECTED"];

export function totals(milestones: Milestone[]) {
  const sum = (pred: (m: Milestone) => boolean) => milestones.filter(pred).reduce((acc, m) => acc + m.amount, 0);
  return {
    total: sum(() => true),
    unfunded: sum((m) => m.status === "PENDING"),
    held: sum((m) => HELD.includes(m.status)),
    released: sum((m) => m.status === "RELEASED"),
  };
}

export type DealDisplayStatus = Job["status"] | "COMPLETED";

/** The deal's status for display: a contracted deal whose milestones are all paid shows as Completed. */
export function dealStatus(db: DB, job: Job): DealDisplayStatus {
  if (job.status !== "CONTRACTED" || !job.contractId) return job.status;
  const milestones = db.milestones.filter((m) => m.contractId === job.contractId);
  return milestones.length > 0 && milestones.every((m) => m.status === "RELEASED") ? "COMPLETED" : job.status;
}

export function dealsFor(db: DB, user: User) {
  return db.jobs.filter((j) => j.clientId === user.id || j.freelancerId === user.id);
}

export function contractsFor(db: DB, user: User) {
  return db.contracts
    .filter((c) => c.clientId === user.id || c.freelancerId === user.id)
    .map((c) => ({ ...c, milestones: milestonesOf(db, c) }));
}

export function milestonesOf(db: DB, c: Contract) {
  return db.milestones.filter((m) => m.contractId === c.id).sort((a, b) => a.index - b.index);
}

export function recentActivity(db: DB, user: User, limit = 8) {
  return contractsFor(db, user)
    .flatMap((c) => c.milestones.flatMap((m) => m.timeline.map((t) => ({ ...t, contract: c, milestone: m }))))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function userName(db: DB, id: string) {
  return db.users.find((u) => u.id === id)?.name ?? "Unknown";
}
