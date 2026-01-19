export interface Grant {
  id: string;
  title: string;
  organization: string;
  description: string;
  issueAreas: string[];
  scope: string;
  fundingMin: number;
  fundingMax: number;
  fundingRaw?: string;
  deadline: string;
  eligibility: string[];
  kpis: string[];
  applicationUrl: string;
  // AI matching fields
  matchScore?: number;
  confidence?: string;
  reasoning?: string;
  strengths?: string[];
  concerns?: string[];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatDeadline(dateString: string): string {
  if (!dateString || dateString === 'No deadline specified') return 'No deadline';
  
  const date = new Date(dateString);
  
  // If date is invalid, return the original string (it's likely a description like "Rolling")
  if (isNaN(date.getTime())) {
    return dateString;
  }
  
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays < 7) return `${diffDays} days left`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks left`;
  return date.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
}
