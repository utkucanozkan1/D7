import { GameState, Room, Player, GameMove, GameEvent } from '@/types/game';
import { 
  initializeGame, 
  applyMove, 
  validateMove, 
  canPlayerMove,
  shouldEndGame,
  completeRound,
  startNextRound,
  checkRoundCompletion
} from '@/utils/gameLogic';
import { v4 as uuidv4 } from 'uuid';

/**
 * Game Manager handles game state and operations
 */
export class GameManager {
  private games = new Map<string, GameState>();
  private gameTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Start a new game for a room
   */
  public startGame(room: Room): GameState {
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start a game');
    }

    if (room.players.some(player => !player.isReady)) {
      throw new Error('All players must be ready');
    }

    // Initialize game state with round configuration
    const gameState = initializeGame(
      room.id, 
      room.players, 
      room.maxRounds || 1, 
      1, 
      []
    );
    
    // Store the game
    this.games.set(room.id, gameState);
    
    // Start turn timer
    this.startTurnTimer(gameState);
    
    console.log(`Game started for room ${room.id} with ${room.players.length} players, ${room.maxRounds || 1} rounds`);
    
    return gameState;
  }

  /**
   * Get game state by room ID
   */
  public getGame(roomId: string): GameState | null {
    return this.games.get(roomId) || null;
  }

  /**
   * Make a move in the game
   */
  public makeMove(roomId: string, move: GameMove): { 
    success: boolean; 
    gameState?: GameState; 
    error?: string;
    events: GameEvent[];
  } {
    const gameState = this.games.get(roomId);
    if (!gameState) {
      return { success: false, error: 'Game not found', events: [] };
    }

    if (gameState.status !== 'playing') {
      return { success: false, error: 'Game is not active', events: [] };
    }

    // Validate the move
    const validation = validateMove(gameState, move);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.reason, 
        events: [{ type: 'INVALID_MOVE', playerId: move.playerId, reason: validation.reason || 'Invalid move' }]
      };
    }

    try {
      // Apply the move
      const newGameState = applyMove(gameState, move);
      this.games.set(roomId, newGameState);

      // Generate events based on the move
      const events = this.generateMoveEvents(gameState, newGameState, move);

      // Restart turn timer
      this.startTurnTimer(newGameState);

      // Check if game should end
      const endCheck = shouldEndGame(newGameState);
      if (endCheck.shouldEnd) {
        this.endGame(roomId, endCheck.reason);
      }

      return { 
        success: true, 
        gameState: newGameState, 
        events 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        events: []
      };
    }
  }

  /**
   * Force a player to draw cards (due to timeout or penalty)
   */
  public forceDrawCards(roomId: string, playerId: string, reason: string = 'timeout'): GameState | null {
    const gameState = this.games.get(roomId);
    if (!gameState) return null;

    const drawMove: GameMove = {
      type: 'DRAW_CARD',
      playerId
    };

    const result = this.makeMove(roomId, drawMove);
    if (result.success) {
      console.log(`Forced ${playerId} to draw cards due to ${reason}`);
      return result.gameState!;
    }

    return null;
  }

  /**
   * Handle player disconnect
   */
  public handlePlayerDisconnect(roomId: string, playerId: string): GameState | null {
    const gameState = this.games.get(roomId);
    if (!gameState) return null;

    // Mark player as disconnected
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    // Check if game should end due to too few connected players
    const connectedPlayers = gameState.players.filter(p => p.isConnected);
    if (connectedPlayers.length < 2) {
      this.endGame(roomId, 'Insufficient connected players');
    }

    this.games.set(roomId, gameState);
    return gameState;
  }

  /**
   * Handle player reconnect
   */
  public handlePlayerReconnect(roomId: string, playerId: string): GameState | null {
    const gameState = this.games.get(roomId);
    if (!gameState) return null;

    // Mark player as connected
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
    }

    this.games.set(roomId, gameState);
    return gameState;
  }

  /**
   * End a game
   */
  public endGame(roomId: string, reason?: string): GameState | null {
    const gameState = this.games.get(roomId);
    if (!gameState) return null;

    // Clear turn timer
    const timer = this.gameTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.gameTimers.delete(roomId);
    }

    // Update game state
    gameState.status = 'finished';
    gameState.finishedAt = new Date();
    
    if (!gameState.winner && reason) {
      // Find player with fewest cards if no winner
      const playersWithCards = gameState.players
        .filter(p => p.isConnected)
        .sort((a, b) => a.hand.length - b.hand.length);
      
      if (playersWithCards.length > 0) {
        gameState.winner = playersWithCards[0].id;
      }
    }

    this.games.set(roomId, gameState);
    console.log(`Game ended for room ${roomId}: ${reason}`);
    
    return gameState;
  }

  /**
   * Continue to next round
   */
  public continueToNextRound(roomId: string): GameState | null {
    const gameState = this.games.get(roomId);
    if (!gameState) return null;

    if (gameState.status !== 'finished' || gameState.isGameComplete) {
      return null; // Can't continue if not at end of round or if game is complete
    }

    // Start next round
    const nextRoundGameState = startNextRound(gameState);
    this.games.set(roomId, nextRoundGameState);
    
    // Start turn timer for new round
    this.startTurnTimer(nextRoundGameState);
    
    console.log(`Starting round ${nextRoundGameState.currentRound} for room ${roomId}`);
    
    return nextRoundGameState;
  }

  /**
   * Clean up finished games
   */
  public cleanupGame(roomId: string): void {
    this.games.delete(roomId);
    const timer = this.gameTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.gameTimers.delete(roomId);
    }
    console.log(`Cleaned up game for room ${roomId}`);
  }

  /**
   * Get all active games
   */
  public getActiveGames(): GameState[] {
    return Array.from(this.games.values()).filter(game => game.status === 'playing');
  }

  /**
   * Start turn timer
   */
  private startTurnTimer(gameState: GameState): void {
    // Clear existing timer
    const existingTimer = this.gameTimers.get(gameState.roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.handleTurnTimeout(gameState.roomId);
    }, gameState.turnTimeLimit * 1000);

    this.gameTimers.set(gameState.roomId, timer);
  }

  /**
   * Handle turn timeout
   */
  private handleTurnTimeout(roomId: string): void {
    const gameState = this.games.get(roomId);
    if (!gameState || gameState.status !== 'playing') {
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log(`Turn timeout for player ${currentPlayer.id} in room ${roomId}`);

    // Force player to draw cards
    this.forceDrawCards(roomId, currentPlayer.id, 'turn timeout');
  }

  /**
   * Generate events based on move
   */
  private generateMoveEvents(oldState: GameState, newState: GameState, move: GameMove): GameEvent[] {
    const events: GameEvent[] = [];
    const currentPlayer = oldState.players[oldState.currentPlayerIndex];

    switch (move.type) {
      case 'PLAY_CARD':
        if (move.card) {
          events.push({
            type: 'CARD_PLAYED',
            playerId: move.playerId,
            card: move.card,
            gameState: newState
          });

          // Check for Mau situation (player has 1 card left)
          const playerAfterMove = newState.players.find(p => p.id === move.playerId);
          if (playerAfterMove && playerAfterMove.hand.length === 1) {
            events.push({
              type: 'PLAYER_SAID_MAU',
              playerId: move.playerId
            });
          }

          // Check for round/game end
          if (newState.winner) {
            const winner = newState.players.find(p => p.id === newState.winner);
            if (winner) {
              const completion = checkRoundCompletion(newState);
              
              if (completion.gameComplete) {
                // Complete the round and determine final winner
                const finalGameState = completeRound(newState, newState.winner);
                this.games.set(newState.roomId, finalGameState);
                
                const finalWinner = finalGameState.players.find(p => p.id === finalGameState.winner);
                if (finalWinner) {
                  events.push({
                    type: 'FINAL_GAME_ENDED',
                    winner: finalWinner,
                    gameState: finalGameState,
                    roundWinners: finalGameState.roundWinners || []
                  });
                }
              } else {
                // Just a round end
                const roundCompleteState = completeRound(newState, newState.winner);
                this.games.set(newState.roomId, roundCompleteState);
                
                events.push({
                  type: 'ROUND_ENDED',
                  winner,
                  gameState: roundCompleteState,
                  roundNumber: roundCompleteState.currentRound || 1
                });
              }
            }
          }
        }
        break;

      case 'DRAW_CARD':
        events.push({
          type: 'CARD_DRAWN',
          playerId: move.playerId,
          count: oldState.drawCount > 0 ? oldState.drawCount : 1,
          gameState: newState
        });
        break;

      case 'CHOOSE_SUIT':
        if (move.suit) {
          events.push({
            type: 'SUIT_CHOSEN',
            suit: move.suit,
            gameState: newState
          });
        }
        break;
    }

    // Always add turn change event if current player changed
    if (oldState.currentPlayerIndex !== newState.currentPlayerIndex) {
      events.push({
        type: 'TURN_CHANGED',
        currentPlayerIndex: newState.currentPlayerIndex,
        gameState: newState
      });
    }

    return events;
  }
}

// Singleton instance
let gameManager: GameManager | null = null;

export function getGameManager(): GameManager {
  if (!gameManager) {
    gameManager = new GameManager();
  }
  return gameManager;
}