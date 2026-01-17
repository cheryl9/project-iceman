const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NPOProfile {
  organization_name: string;
  organization_type: string;
  registration_status?: string;
  issue_areas: string[];
  project_types: string[];
  funding_min: number;
  funding_max: number;
  funding_urgency?: string;
  years_operating: number;
  staff_size: number;
  mission: string;
  description?: string;
}

export interface FirebaseGrant {
  id?: string;
  firestore_id?: string;
  source: string;
  source_url: string;
  title: string;
  agency: string;
  about: string;
  who_can_apply: string;
  when_to_apply: string;
  funding: string;
  how_to_apply: string;
  grant_profile: {
    issue_areas: string[];
    scope_tags: string[];
    funding: {
      cap_amount_sgd?: number;
      min_amount_sgd?: number;
      raw?: string;
    };
    eligibility: {
      organization_types: string[];
      requirements: string[];
    };
    application_window: {
      is_open_all_year: boolean;
      start_date?: string;
      end_date?: string;
      dates?: string[];
      raw?: string;
    };
  };
  features?: any;
  sections?: any[];
  others?: any[];
  documents_required?: string[];
  metadata?: any;
}

export interface GrantMatch {
  grant_id: string;
  grant_name: string;
  agency: string;
  match_score: number;
  confidence: string;
  component_scores: Record<string, number>;
  detailed_scores?: any;
  reasoning: string;
  strengths: string[];
  concerns: string[];
  action_items: string[];
  grant_url: string;
}

/**
 * Fetch all grants from Firebase via backend
 */
export async function fetchGrants(): Promise<FirebaseGrant[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/grants`);
    if (!response.ok) {
      throw new Error(`Failed to fetch grants: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching grants:', error);
    throw error;
  }
}

export async function saveNPOProfile(profile: NPOProfile) {
  const response = await fetch(`${API_BASE_URL}/api/npo/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  
  if (!response.ok) throw new Error('Failed to save profile');
  return await response.json();
}


export async function getNPOProfile(userId: string) {
  const response = await fetch(`${API_BASE_URL}/api/npo/profile/${userId}`);
  if (!response.ok) throw new Error('Profile not found');
  return await response.json();
}

export async function calculateMatches(profile: NPOProfile, limit: number = 20) {
  const response = await fetch(`${API_BASE_URL}/api/match/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npo_profile: profile, limit }),
  });
  
  if (!response.ok) throw new Error('Failed to calculate matches');
  return await response.json();
}


export async function getRecommendations(userId: string, limit: number = 20) {
  const response = await fetch(`${API_BASE_URL}/api/match/recommendations/${userId}?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch recommendations');
  return await response.json();
}


export async function saveSwipe(userId: string, grantId: string, action: 'like' | 'dislike', matchScore: number) {
  const response = await fetch(`${API_BASE_URL}/api/swipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, grant_id: grantId, action, match_score: matchScore }),
  });
  
  if (!response.ok) throw new Error('Failed to save swipe');
  return await response.json();
}

export async function getGrantsSummary() {
  const response = await fetch(`${API_BASE_URL}/api/grants/summary`);
  if (!response.ok) throw new Error('Failed to fetch summary');
  return await response.json();
}

export async function getSavedGrants(userId: string): Promise<FirebaseGrant[]> {
  const response = await fetch(`${API_BASE_URL}/api/saved/${userId}`);
  if (!response.ok) throw new Error('Failed to fetch saved grants');
  const data = await response.json();
  return data.saved_grants || [];
}
