export type Category =
  | 'Eligibility'
  | 'Financial'
  | 'Technical'
  | 'Declarations'
  | 'Other';
export type Status = 'supported' | 'gap' | 'needs_review';
export interface Requirement {
  id: string;
  clause: string;
  category: Category;
  source: string;
  mandatory: boolean;
}
export interface Bidder {
  id: string;
  name: string;
}
export interface Document {
  id: string;
  name: string;
  kind: 'tender' | 'evidence';
  bidderId: string | null;
  key: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  text: string;
  pages: number;
}
export interface Finding {
  requirementId: string;
  status: Status;
  reason: string;
  documentId: string | null;
  quote: string;
}
export interface Review {
  status: 'compliant' | 'non_compliant' | 'clarification';
  note: string;
  reviewer: string;
  at: string;
}
export interface Run {
  id: string;
  bidderId: string;
  at: string;
  mode: 'ai' | 'assisted';
  model: string | null;
  contentVersion: number;
  requirements?: Requirement[];
  findings: Finding[];
  reviews: Record<string, Review>;
}
export interface Audit {
  id: string;
  action: string;
  at: string;
  actor: string;
  detail: string;
}
export interface BidData {
  requirements: Requirement[];
  bidders: Bidder[];
  documents: Document[];
  runs: Run[];
  audit: Audit[];
  contentVersion: number;
  demo?: boolean;
}
export interface Bid {
  id: string;
  title: string;
  reference: string;
  buyer: string;
  deadline: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  data: BidData;
}
export const categories: Category[] = [
  'Eligibility',
  'Financial',
  'Technical',
  'Declarations',
  'Other',
];
export const statusLabels: Record<Status, string> = {
  supported: 'Evidence supports',
  gap: 'Evidence gap',
  needs_review: 'Needs review',
};
export function latestRun(bid: Bid, bidderId: string) {
  return [...bid.data.runs].reverse().find((r) => r.bidderId === bidderId);
}
export function currentRuns(bid: Bid) {
  return bid.data.bidders
    .map((b) => latestRun(bid, b.id))
    .filter(
      (r): r is Run => !!r && r.contentVersion === bid.data.contentVersion,
    );
}
