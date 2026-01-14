export interface Grant {
  id: string;
  title: string;
  organization: string;
  description: string;
  issueAreas: string[];
  fundingMin: number;
  fundingMax: number;
  deadline: string;
  eligibility: string[];
  kpis: string[];
  applicationUrl: string;
}

export const mockGrants: Grant[] = [
  {
    id: "1",
    title: "Community Care Innovation Grant",
    organization: "Singapore Community Foundation",
    description: "Supporting innovative elderly care programs that promote active aging and community integration.",
    issueAreas: ["Elderly Care", "Community Development"],
    fundingMin: 50000,
    fundingMax: 200000,
    deadline: "2026-03-15",
    eligibility: [
      "Registered charity or IPC",
      "Operating for at least 2 years",
      "Serving elderly population"
    ],
    kpis: [
      "Number of beneficiaries reached",
      "Program sustainability plan",
      "Community partnerships"
    ],
    applicationUrl: "https://grants.gov.sg/example1"
  },
  {
    id: "2",
    title: "Youth Mental Health Initiative",
    organization: "Ministry of Social and Family Development",
    description: "Funding for programs addressing mental health challenges among youth aged 13-25.",
    issueAreas: ["Mental Health", "Youth Development"],
    fundingMin: 30000,
    fundingMax: 150000,
    deadline: "2026-04-30",
    eligibility: [
      "Registered charity",
      "Experience in youth services",
      "Qualified mental health professionals"
    ],
    kpis: [
      "Youth engagement rates",
      "Mental health outcomes",
      "Peer support network size"
    ],
    applicationUrl: "https://grants.gov.sg/example2"
  },
  {
    id: "3",
    title: "Digital Inclusion Fund",
    organization: "Infocomm Media Development Authority",
    description: "Bridging the digital divide for low-income families and seniors through technology training.",
    issueAreas: ["Digital Literacy", "Social Inclusion"],
    fundingMin: 20000,
    fundingMax: 100000,
    deadline: "2026-02-28",
    eligibility: [
      "Non-profit organization",
      "Proven track record in digital education",
      "Partnership with tech providers"
    ],
    kpis: [
      "Number trained",
      "Digital literacy improvement",
      "Device distribution"
    ],
    applicationUrl: "https://grants.gov.sg/example3"
  },
  {
    id: "4",
    title: "Environmental Sustainability Grant",
    organization: "National Environment Agency",
    description: "Support for community-led environmental projects promoting sustainability and climate action.",
    issueAreas: ["Environment", "Climate Action"],
    fundingMin: 10000,
    fundingMax: 80000,
    deadline: "2026-05-15",
    eligibility: [
      "Community groups or charities",
      "Environmental focus",
      "Measurable impact metrics"
    ],
    kpis: [
      "Carbon reduction achieved",
      "Community participation",
      "Behavior change outcomes"
    ],
    applicationUrl: "https://grants.gov.sg/example4"
  },
  {
    id: "5",
    title: "Arts for Social Change",
    organization: "National Arts Council",
    description: "Funding creative projects that use arts to address social issues and build community cohesion.",
    issueAreas: ["Arts & Culture", "Social Cohesion"],
    fundingMin: 15000,
    fundingMax: 120000,
    deadline: "2026-03-30",
    eligibility: [
      "Arts organizations or collectives",
      "Social impact focus",
      "Community engagement plan"
    ],
    kpis: [
      "Audience reach",
      "Community feedback",
      "Social impact measurement"
    ],
    applicationUrl: "https://grants.gov.sg/example5"
  }
];

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0
  }).format(amount);
}

// Helper function to format deadline
export function formatDeadline(dateString: string): string {
  const date = new Date(dateString);
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