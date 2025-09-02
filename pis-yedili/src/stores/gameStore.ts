import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GameState, Room, Player, Card, GameMove, Suit } from '@/types/game';
import { getSocketManager } from '@/lib/socket-client';

interface GameStore {
  // Game state
  gameState: GameState | null;
  room: Room | null;
  currentPlayerId: string;
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;

  // Actions
  setGameState: (gameState: GameState) => void;
  setRoom: (room: Room) => void;
  setCurrentPlayerId: (playerId: string) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Game actions
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: (roomId: string) => void;
  startGame: (roomId: string) => void;
  playCard: (roomId: string, card: Card) => void;
  drawCard: (roomId: string) => void;
  chooseSuit: (roomId: string, suit: Suit) => void;
  sayMau: (roomId: string) => void;
  toggleReady: (roomId: string) => void;

  // Initialization
  initialize: () => void;
  cleanup: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    gameState: null,
    room: null,
    currentPlayerId: '',
    isConnected: false,
    error: null,
    isLoading: false,

    // Basic setters
    setGameState: (gameState) => set({ gameState }),
    setRoom: (room) => set({ room }),
    setCurrentPlayerId: (playerId) => set({ currentPlayerId: playerId }),
    setConnected: (connected) => set({ isConnected: connected }),
    setError: (error) => set({ error }),
    setLoading: (loading) => set({ isLoading: loading }),

    // Game actions
    joinRoom: (roomId, playerName) => {
      const socketManager = getSocketManager();
      socketManager.emit('join-room', roomId, playerName);
    },

    leaveRoom: (roomId) => {
      const socketManager = getSocketManager();
      socketManager.emit('leave-room', roomId);
    },

    startGame: (roomId) => {
      const socketManager = getSocketManager();
      socketManager.emit('start-game', roomId);
    },

    playCard: (roomId, card) => {
      const { currentPlayerId } = get();
      const move: GameMove = {
        type: 'PLAY_CARD',
        playerId: currentPlayerId,
        card
      };
      const socketManager = getSocketManager();
      socketManager.emit('make-move', roomId, move);
    },

    drawCard: (roomId) => {
      const { currentPlayerId } = get();
      const move: GameMove = {
        type: 'DRAW_CARD',
        playerId: currentPlayerId
      };
      const socketManager = getSocketManager();
      socketManager.emit('make-move', roomId, move);
    },

    chooseSuit: (roomId, suit) => {
      const { currentPlayerId } = get();
      const move: GameMove = {
        type: 'CHOOSE_SUIT',
        playerId: currentPlayerId,
        suit
      };
      const socketManager = getSocketManager();
      socketManager.emit('make-move', roomId, move);
    },

    sayMau: (roomId) => {
      const { currentPlayerId } = get();
      const move: GameMove = {
        type: 'SAY_MAU',
        playerId: currentPlayerId
      };
      const socketManager = getSocketManager();
      socketManager.emit('make-move', roomId, move);
    },

    toggleReady: (roomId) => {
      const { room, currentPlayerId } = get();
      if (!room) return;
      
      const player = room.players.find(p => p.id === currentPlayerId);
      const newReadyState = !player?.isReady;
      
      const socketManager = getSocketManager();
      socketManager.emit('player-ready', roomId, newReadyState);
    },

    // Socket initialization and cleanup
    initialize: () => {
      const socketManager = getSocketManager();
      const socket = socketManager.connect();

      // Connection status
      socketManager.on('connection-status', (status) => {
        set({ isConnected: status === 'connected' });
      });

      // Room events
      socketManager.on('room-joined', (joinedRoom: Room, playerId: string) => {
        set({ 
          room: joinedRoom, 
          currentPlayerId: playerId, 
          isLoading: false,
          error: null 
        });
      });

      socketManager.on('room-updated', (updatedRoom: Room) => {
        set({ room: updatedRoom });
      });

      socketManager.on('room-left', (roomId: string) => {
        set({ 
          room: null, 
          gameState: null, 
          currentPlayerId: '',
          error: null 
        });
      });

      // Game events
      socketManager.on('game-started', (newGameState: GameState) => {
        set({ 
          gameState: newGameState, 
          isLoading: false,
          error: null 
        });
      });

      socketManager.on('game-state-updated', (newGameState: GameState) => {
        set({ gameState: newGameState });
      });

      socketManager.on('move-made', (newGameState: GameState, move: GameMove, success: boolean, reason?: string) => {
        if (success) {
          set({ gameState: newGameState, error: null });
        } else {
          set({ error: reason || 'Move failed' });
          // Clear error after 3 seconds
          setTimeout(() => {
            set({ error: null });
          }, 3000);
        }
      });

      socketManager.on('game-ended', (finalGameState: GameState, winner: Player | null) => {
        set({ gameState: finalGameState });
        // Could add additional logic here for game end handling
      });

      // Player events
      socketManager.on('player-joined', (roomId: string, player: Player) => {
        const { room } = get();
        if (room && room.id === roomId) {
          const updatedRoom = {
            ...room,
            players: [...room.players, player]
          };
          set({ room: updatedRoom });
        }
      });

      socketManager.on('player-left', (roomId: string, playerId: string) => {
        const { room } = get();
        if (room && room.id === roomId) {
          const updatedRoom = {
            ...room,
            players: room.players.filter(p => p.id !== playerId)
          };
          set({ room: updatedRoom });
        }
      });

      socketManager.on('player-disconnected', (roomId: string, playerId: string) => {
        const { room, gameState } = get();
        if (room && room.id === roomId) {
          const updatedRoom = {
            ...room,
            players: room.players.map(p => 
              p.id === playerId ? { ...p, isConnected: false } : p
            )
          };
          set({ room: updatedRoom });
        }
        if (gameState && gameState.roomId === roomId) {
          const updatedGameState = {
            ...gameState,
            players: gameState.players.map(p => 
              p.id === playerId ? { ...p, isConnected: false } : p
            )
          };
          set({ gameState: updatedGameState });
        }
      });

      socketManager.on('player-reconnected', (roomId: string, playerId: string) => {
        const { room, gameState } = get();
        if (room && room.id === roomId) {
          const updatedRoom = {
            ...room,
            players: room.players.map(p => 
              p.id === playerId ? { ...p, isConnected: true } : p
            )
          };
          set({ room: updatedRoom });
        }
        if (gameState && gameState.roomId === roomId) {
          const updatedGameState = {
            ...gameState,
            players: gameState.players.map(p => 
              p.id === playerId ? { ...p, isConnected: true } : p
            )
          };
          set({ gameState: updatedGameState });
        }
      });

      socketManager.on('player-ready-status', (roomId: string, playerId: string, ready: boolean) => {
        const { room } = get();
        if (room && room.id === roomId) {
          const updatedRoom = {
            ...room,
            players: room.players.map(p => 
              p.id === playerId ? { ...p, isReady: ready } : p
            )
          };
          set({ room: updatedRoom });
        }
      });

      // Error handling
      socketManager.on('error', (error) => {
        set({ 
          error: error.message, 
          isLoading: false 
        });
        // Clear error after 5 seconds
        setTimeout(() => {
          set({ error: null });
        }, 5000);
      });

      socketManager.on('game-error', (roomId: string, errorMessage: string, playerId?: string) => {
        set({ error: errorMessage });
        // Clear error after 3 seconds
        setTimeout(() => {
          set({ error: null });
        }, 3000);
      });

      console.log('Game store initialized with Socket.IO');
    },

    cleanup: () => {
      const socketManager = getSocketManager();
      
      // Remove all listeners
      socketManager.off('connection-status');
      socketManager.off('room-joined');
      socketManager.off('room-updated');
      socketManager.off('room-left');
      socketManager.off('game-started');
      socketManager.off('game-state-updated');
      socketManager.off('move-made');
      socketManager.off('game-ended');
      socketManager.off('player-joined');
      socketManager.off('player-left');
      socketManager.off('player-disconnected');
      socketManager.off('player-reconnected');
      socketManager.off('player-ready-status');
      socketManager.off('error');
      socketManager.off('game-error');

      // Reset state
      set({
        gameState: null,
        room: null,
        currentPlayerId: '',
        isConnected: false,
        error: null,
        isLoading: false
      });

      console.log('Game store cleaned up');
    }
  }))
);

// Auto-initialize on first use
let initialized = false;
export const initializeGameStore = () => {
  if (!initialized) {
    useGameStore.getState().initialize();
    initialized = true;
  }
};

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useGameStore.getState().cleanup();
  });
}