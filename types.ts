
export interface Player {
  id: string;
  name: string;
}

export interface MatchResult {
  winnerId: string;
  redScore: number;
  whiteScore: number;
  details: string; // e.g. "Men, Kote"
}

export interface Match {
  id: number;
  // If null, it means the slot is waiting for a winner from another match
  redPlayerId: string | null; 
  whitePlayerId: string | null;
  
  // Navigation logic
  winnerToMatchId: number | null; // ID of the next match the winner goes to
  winnerToSlot: 'red' | 'white' | null; // Explicitly target a slot
  
  loserToMatchId: number | null; // Optional
  loserToSlot: 'red' | 'white' | null; // Explicitly target a slot
  
  result: MatchResult | null;
}

export interface TournamentData {
  id: string; // Unique ID for storage
  lastUpdated: number; // Timestamp
  title: string;
  players: Player[];
  matches: Match[];
  totalMatches: number;
  status: 'SETUP' | 'ACTIVE' | 'FINISHED';
}

export interface ExtractedData {
  title: string;
  totalMatches: number;
  players: string[];
}