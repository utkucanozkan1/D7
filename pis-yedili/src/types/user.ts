// User profile and preferences
export interface User {
  id: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  lastSeen: Date;
  isOnline: boolean;
  preferences: UserPreferences;
  stats: UserStats;
}

// User preferences and settings
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  chatEnabled: boolean;
  notificationsEnabled: boolean;
  cardAnimations: boolean;
  turnTimeout: number; // seconds
  autoSort: boolean;
  language: 'en' | 'tr'; // English or Turkish
  cardStyle: 'classic' | 'modern' | 'minimal';
}

// User game statistics
export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  averageGameDuration: number; // minutes
  fastestWin: number; // seconds
  longestGame: number; // seconds
  cardsPlayed: number;
  specialCardsUsed: number;
  mauCallsCorrect: number;
  mauCallsMissed: number;
  timeouts: number;
  disconnections: number;
  favoriteCard?: string; // Most played card
  achievements: Achievement[];
}

// Achievement system
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// Session data for temporary users (not persisted)
export interface GuestSession {
  id: string;
  name: string;
  joinedAt: Date;
  currentRoomId?: string;
  isGuest: true;
  temporaryPreferences: Partial<UserPreferences>;
}

// Union type for authenticated and guest users
export type CurrentUser = User | GuestSession;

// User actions and events
export type UserAction = 
  | { type: 'UPDATE_PROFILE'; data: Partial<User> }
  | { type: 'UPDATE_PREFERENCES'; data: Partial<UserPreferences> }
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  | { type: 'UPDATE_STATS'; stats: Partial<UserStats> };

// Default user preferences
export const defaultUserPreferences: UserPreferences = {
  theme: 'system',
  soundEnabled: true,
  chatEnabled: true,
  notificationsEnabled: true,
  cardAnimations: true,
  turnTimeout: 30,
  autoSort: true,
  language: 'en',
  cardStyle: 'classic',
};

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_WIN: {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first game of Pis Yedili',
    icon: '🏆',
    rarity: 'common' as const,
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Win a game in under 2 minutes',
    icon: '⚡',
    rarity: 'rare' as const,
  },
  SEVEN_MASTER: {
    id: 'seven_master',
    name: 'Seven Master',
    description: 'Play 100 seven cards',
    icon: '🎯',
    rarity: 'epic' as const,
  },
  PERFECT_MAU: {
    id: 'perfect_mau',
    name: 'Perfect Mau',
    description: 'Never miss a Mau call in 10 consecutive games',
    icon: '💎',
    rarity: 'legendary' as const,
  },
  SOCIAL_BUTTERFLY: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Send 500 chat messages',
    icon: '💬',
    rarity: 'common' as const,
  },
} as const;

// User presence status
export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  currentActivity?: {
    type: 'in-lobby' | 'in-game' | 'spectating';
    roomId?: string;
  };
}