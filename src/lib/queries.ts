import { read } from "./db";
import type { Contract, Milestone, MilestoneStatus, User } from "./types";

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

export function dealsFor(user: User) {
  return read().jobs.filter((j) => j.clientId === user.id || j.freelancerId === user.id);
}

export function contractsFor(user: User) {
  const db = read();
  return db.contracts
    .filter((c) => c.clientId === user.id || c.freelancerId === user.id)
    .map((c) => ({ ...c, milestones: milestonesOf(c) }));
}

export function milestonesOf(c: Contract) {
  return read()
    .milestones.filter((m) => m.contractId === c.id)
    .sort((a, b) => a.index - b.index);
}

export function recentActivity(user: User, limit = 8) {
  const contracts = contractsFor(user);
  return contracts
    .flatMap((c) => c.milestones.flatMap((m) => m.timeline.map((t) => ({ ...t, contract: c, milestone: m }))))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function userName(id: string) {
  return read().users.find((u) => u.id === id)?.name ?? "Unknown";
}
