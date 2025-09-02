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
  drawCount: number; // For accumulated draw-two cards
  skipNext: boolean;
  wildSuit: Suit | null; // When jack is played, chosen suit
  startedAt: Date | null;
  finishedAt: Date | null;
  winner: string | null;
  turnStartTime: Date | null;
  turnTimeLimit: number; // seconds
}

// Mau Mau special card effects
export interface SpecialCardEffect {
  type: 'draw' | 'skip' | 'reverse' | 'wild' | 'block';
  value?: number; // For draw cards (e.g., 2 for "draw 2")
  suit?: Suit; // For wild cards
}

export interface GameRules {
  maxPlayers: number;
  initialHandSize: number;
  turnTimeLimit: number; // seconds
  specialCards: {
    [key in Rank]?: SpecialCardEffect;
  };
}

// Default Mau Mau rules
export const defaultGameRules: GameRules = {
  maxPlayers: 6,
  initialHandSize: 7,
  turnTimeLimit: 30,
  specialCards: {
    '7': { type: 'draw', value: 2 }, // Draw 2 cards
    '8': { type: 'skip' }, // Skip next player
    'J': { type: 'wild' }, // Choose suit
    'A': { type: 'reverse' }, // Reverse direction (in some variants)
  },
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