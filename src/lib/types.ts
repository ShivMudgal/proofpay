export type Role = "CLIENT" | "FREELANCER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  paypalEmail: string;
  avatar: string;
}

export interface FreelancerRules {
  freelancerId: string;
  floorPrice: number;
  targetPrice: number;
  minDeadlineDays: number;
  maxRevisions: number;
  skills: string;
  notes: string;
}

export type JobStatus = "NEGOTIATING" | "AGREED" | "CONTRACTED";

export interface Offer {
  price: number;
  deadlineDays: number;
  scope: string;
  milestones: string[];
}

export interface Job {
  id: string;
  clientId: string;
  freelancerId: string;
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  status: JobStatus;
  currentOffer: Offer | null;
  contractId: string | null;
  createdAt: string;
}

export interface NegotiationMessage {
  id: string;
  jobId: string;
  sender: "CLIENT" | "AGENT" | "SYSTEM";
  content: string;
  offer?: Offer | null;
  createdAt: string;
}

export type MilestoneStatus =
  | "PENDING"
  | "FUNDED"
  | "SUBMITTED"
  | "REJECTED"
  | "RELEASED"
  | "VOIDED";

export interface CriterionResult {
  text: string;
  passed: boolean;
  reason: string;
}

export interface VerificationResult {
  criteria: CriterionResult[];
  overallPass: boolean;
  score: number;
  summary: string;
  engine: "gemini" | "rules";
}

export interface Submission {
  id: string;
  milestoneId: string;
  type: "GITHUB" | "URL" | "TEXT";
  value: string;
  result: VerificationResult | null;
  createdAt: string;
}

export interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
}

export interface Milestone {
  id: string;
  contractId: string;
  index: number;
  name: string;
  amount: number;
  dueDate: string;
  acceptanceCriteria: string[];
  status: MilestoneStatus;
  paypalOrderId: string | null;
  authorizationId: string | null;
  captureId: string | null;
  timeline: TimelineEvent[];
}

export interface Contract {
  id: string;
  jobId: string;
  clientId: string;
  freelancerId: string;
  title: string;
  summary: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface DB {
  users: User[];
  rules: FreelancerRules[];
  jobs: Job[];
  messages: NegotiationMessage[];
  contracts: Contract[];
  milestones: Milestone[];
  submissions: Submission[];
  webhookEvents: { id: string; type: string; at: string }[];
}
