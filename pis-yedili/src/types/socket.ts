import { GameState, GameMove, Room, Player } from './game';

// Client to Server events
export interface ClientToServerEvents {
  // Room management
  'create-room': (roomData: { name: string; maxPlayers: number; isPrivate: boolean }) => void;
  'join-room': (roomId: string, playerName: string) => void;
  'leave-room': (roomId: string) => void;
  'delete-room': (roomId: string) => void;
  'get-rooms': () => void;
  'get-room-state': (roomId: string) => void;
  
  // Game actions
  'start-game': (roomId: string) => void;
  'make-move': (roomId: string, move: GameMove) => void;
  'player-ready': (roomId: string, ready: boolean) => void;
  'fill-with-bots': (roomId: string) => void;
  
  // Chat
  'send-message': (roomId: string, message: string) => void;
  
  // Connection
  'ping': () => void;
}

// Server to Client events
export interface ServerToClientEvents {
  // Room management responses
  'room-created': (room: Room) => void;
  'room-joined': (room: Room, playerId: string) => void;
  'room-left': (roomId: string) => void;
  'room-deleted': (roomId: string) => void;
  'room-delete-success': (roomId: string) => void;
  'rooms-list': (rooms: Room[]) => void;
  'room-updated': (room: Room) => void;
  'room-state': (room: Room, playerId: string) => void;
  
  // Game state updates
  'game-started': (gameState: GameState) => void;
  'game-state-updated': (gameState: GameState) => void;
  'game-ended': (gameState: GameState, winner: Player) => void;
  'move-made': (gameState: GameState, move: GameMove, success: boolean, reason?: string) => void;
  'player-ready-status': (roomId: string, playerId: string, ready: boolean) => void;
  
  // Player events
  'player-joined': (roomId: string, player: Player) => void;
  'player-left': (roomId: string, playerId: string) => void;
  'player-disconnected': (roomId: string, playerId: string) => void;
  'player-reconnected': (roomId: string, playerId: string) => void;
  
  // Chat events
  'message-received': (roomId: string, message: ChatMessage) => void;
  'typing-start': (roomId: string, playerId: string) => void;
  'typing-stop': (roomId: string, playerId: string) => void;
  
  // Error handling
  'error': (error: SocketError) => void;
  'game-error': (roomId: string, error: string, playerId?: string) => void;
  
  // Connection
  'pong': () => void;
  'connection-status': (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

// Inter-server events (for potential scaling)
export interface InterServerEvents {
  'room-sync': (room: Room) => void;
  'game-sync': (gameState: GameState) => void;
}

// Socket data attached to each connection
export interface SocketData {
  playerId?: string;
  playerName?: string;
  roomId?: string;
  isAuthenticated: boolean;
  joinedAt: Date;
  lastSeen: Date;
}

// Chat message structure
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'game-event';
}

// Socket error types
export interface SocketError {
  code: string;
  message: string;
  details?: any;
}

// Common socket error codes
export const SOCKET_ERRORS = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  PLAYER_NOT_IN_ROOM: 'PLAYER_NOT_IN_ROOM',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  GAME_NOT_STARTED: 'GAME_NOT_STARTED',
  INVALID_MOVE: 'INVALID_MOVE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  PLAYER_NOT_READY: 'PLAYER_NOT_READY',
  INSUFFICIENT_PLAYERS: 'INSUFFICIENT_PLAYERS',
  INVALID_ROOM_NAME: 'INVALID_ROOM_NAME',
  INVALID_PLAYER_NAME: 'INVALID_PLAYER_NAME',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Socket connection states
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// Room filters for lobby
export interface RoomFilter {
  showFull?: boolean;
  showInProgress?: boolean;
  showPrivate?: boolean;
  playerCount?: { min: number; max: number };
  sortBy?: 'created' | 'players' | 'name';
  sortOrder?: 'asc' | 'desc';
}