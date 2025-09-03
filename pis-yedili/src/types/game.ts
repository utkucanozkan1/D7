export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  handCount: number; // For other players, we only show count
  isReady: boolean;
  isConnected: boolean;
  position: number; // Position around the table (0-5)
  isBot?: boolean; // True for AI players
  // Game state properties
  hasDrawnThisTurn?: boolean;
  saidMau?: boolean; // Keep for Mau Mau compatibility
  saidTek?: boolean; // Pis Yedili: declare "tek" when down to 1 card
  score?: number; // Running score for the game
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  gameInProgress: boolean;
  createdAt: Date;
  createdBy: string;
}

export type GameDirection = 'clockwise' | 'counterclockwise';
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'paused';

export interface GameState {
  id: string;
  roomId: string;
  players: Player[];
  currentPlayerIndex: number;
  direction: GameDirection;
  status: GameStatus;
  deck: Card[];
  discardPile: Card[];
  topCard: Card | null;
  drawCount: number; // For accumulated draw cards
  skipNext: boolean;
  wildSuit: Suit | null; // When jack is played, chosen suit
  startedAt: Date | null;
  finishedAt: Date | null;
  winner: string | null;
  turnStartTime: Date | null;
  turnTimeLimit: number; // seconds
  // Pis Yedili specific properties
  isFirstPlay?: boolean; // First play must be a club
  sevenStack?: number; // Count of consecutive 7s played
  rules?: GameRules; // Game rules including scoring
}

// Pis Yedili special card effects
export interface SpecialCardEffect {
  type: 'draw' | 'skip' | 'reverse' | 'wild' | 'draw_all';
  value?: number; // For draw cards (e.g., 3 for "draw 3")
  suit?: Suit; // For wild cards
  stackable?: boolean; // For cards that can be stacked (like 7s)
}

export interface GameRules {
  maxPlayers: number;
  initialHandSize: number;
  turnTimeLimit: number; // seconds
  gameType?: string; // 'mau-mau' or 'pis-yedili'
  mustStartWithClub?: boolean; // Pis Yedili rule
  specialCards: {
    [key in Rank]?: SpecialCardEffect;
  };
  scoring?: {
    [key in Rank]?: number; // Point values for cards
  };
  bonusPenalties?: {
    [key: string]: number; // Extra penalties for ending with special cards
  };
}

// Default Mau Mau rules
export const defaultGameRules: GameRules = {
  maxPlayers: 6,
  initialHandSize: 7,
  turnTimeLimit: 30,
  gameType: 'mau-mau',
  specialCards: {
    '7': { type: 'draw', value: 2 }, // Draw 2 cards
    '8': { type: 'skip' }, // Skip next player
    'J': { type: 'wild' }, // Choose suit
    'A': { type: 'reverse' }, // Reverse direction (in some variants)
  },
};

// Pis Yedili rules
export const pisYediliRules: GameRules = {
  maxPlayers: 7,
  initialHandSize: 7,
  turnTimeLimit: 30,
  gameType: 'pis-yedili',
  mustStartWithClub: true,
  specialCards: {
    '7': { type: 'draw', value: 3, stackable: true }, // Draw 3 cards, stackable
    '8': { type: 'skip' }, // Skip next player
    '10': { type: 'reverse' }, // Reverse direction
    'J': { type: 'wild' }, // Jack changes suit
    'A': { type: 'draw_all', value: 1 }, // All other players draw 1
  },
  scoring: {
    'A': 11, // Ace = 11 points
    'J': 25, // Jack = 25 points  
    'Q': 10, // Queen = 10 points
    'K': 10, // King = 10 points
    // Number cards = face value (2-10)
  },
  bonusPenalties: {
    '7': 10, // Extra penalty for ending with 7
    'J': 15, // Extra penalty for ending with Jack
    'Joker': 20 // Extra penalty for ending with Joker
  }
};

// Game events for real-time updates
export type GameEvent = 
  | { type: 'GAME_STARTED'; gameState: GameState }
  | { type: 'CARD_PLAYED'; playerId: string; card: Card; gameState: GameState }
  | { type: 'CARD_DRAWN'; playerId: string; count: number; gameState: GameState }
  | { type: 'TURN_CHANGED'; currentPlayerIndex: number; gameState: GameState }
  | { type: 'GAME_ENDED'; winner: Player; gameState: GameState }
  | { type: 'PLAYER_SAID_MAU'; playerId: string }
  | { type: 'SUIT_CHOSEN'; suit: Suit; gameState: GameState }
  | { type: 'INVALID_MOVE'; playerId: string; reason: string };

export interface GameMove {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'CHOOSE_SUIT' | 'SAY_MAU';
  playerId: string;
  card?: Card;
  suit?: Suit;
}