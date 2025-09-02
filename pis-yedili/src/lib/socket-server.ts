import { Server as IOServer } from 'socket.io';
import { Server } from 'http';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  ChatMessage,
  SOCKET_ERRORS 
} from '@/types/socket';
import { Room, Player, GameState } from '@/types/game';
import { getGameManager } from '@/lib/gameManager';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for development (replace with database in production)
const rooms = new Map<string, Room>();
const gameStates = new Map<string, GameState>();
const playerSockets = new Map<string, string>(); // playerId -> socketId

export class SocketServer {
  private io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  constructor(server: Server) {
    this.io = new IOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_APP_URL 
          : 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Initialize socket data
      socket.data = {
        isAuthenticated: false,
        joinedAt: new Date(),
        lastSeen: new Date(),
      };

      // Room management events
      socket.on('create-room', (roomData) => this.handleCreateRoom(socket, roomData));
      socket.on('join-room', (roomId, playerName) => this.handleJoinRoom(socket, roomId, playerName));
      socket.on('leave-room', (roomId) => this.handleLeaveRoom(socket, roomId));
      socket.on('get-rooms', () => this.handleGetRooms(socket));

      // Game events
      socket.on('start-game', (roomId) => this.handleStartGame(socket, roomId));
      socket.on('make-move', (roomId, move) => this.handleMakeMove(socket, roomId, move));
      socket.on('player-ready', (roomId, ready) => this.handlePlayerReady(socket, roomId, ready));

      // Chat events
      socket.on('send-message', (roomId, message) => this.handleSendMessage(socket, roomId, message));

      // Connection events
      socket.on('ping', () => socket.emit('pong'));
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // Update last seen timestamp periodically
      const lastSeenInterval = setInterval(() => {
        socket.data.lastSeen = new Date();
      }, 30000); // Every 30 seconds

      socket.on('disconnect', () => {
        clearInterval(lastSeenInterval);
      });
    });
  }

  private handleCreateRoom(socket: any, roomData: { name: string; maxPlayers: number; isPrivate: boolean }) {
    try {
      // Validate room data
      if (!roomData.name || roomData.name.trim().length === 0) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.INVALID_ROOM_NAME, 
          message: 'Room name is required' 
        });
        return;
      }

      if (roomData.maxPlayers < 2 || roomData.maxPlayers > 6) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.INVALID_ROOM_NAME, 
          message: 'Max players must be between 2 and 6' 
        });
        return;
      }

      const roomId = uuidv4();
      const room: Room = {
        id: roomId,
        name: roomData.name.trim(),
        players: [],
        maxPlayers: roomData.maxPlayers,
        isPrivate: roomData.isPrivate,
        gameInProgress: false,
        createdAt: new Date(),
        createdBy: socket.id,
      };

      rooms.set(roomId, room);
      socket.emit('room-created', room);
      
      // Broadcast updated room list to all clients
      this.broadcastRoomsList();
      
      console.log(`Room created: ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to create room' 
      });
    }
  }

  private handleJoinRoom(socket: any, roomId: string, playerName: string) {
    try {
      // Validate player name
      if (!playerName || playerName.trim().length === 0) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.INVALID_PLAYER_NAME, 
          message: 'Player name is required' 
        });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.ROOM_NOT_FOUND, 
          message: 'Room not found' 
        });
        return;
      }

      // Check if room is full
      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.ROOM_FULL, 
          message: 'Room is full' 
        });
        return;
      }

      // Check if game is already in progress
      if (room.gameInProgress) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.GAME_ALREADY_STARTED, 
          message: 'Game is already in progress' 
        });
        return;
      }

      // Check if player name is already taken in this room
      if (room.players.some(p => p.name === playerName.trim())) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.INVALID_PLAYER_NAME, 
          message: 'Player name is already taken' 
        });
        return;
      }

      // Create new player
      const playerId = uuidv4();
      const player: Player = {
        id: playerId,
        name: playerName.trim(),
        hand: [],
        handCount: 0,
        isReady: false,
        isConnected: true,
        position: room.players.length,
      };

      // Add player to room
      room.players.push(player);
      rooms.set(roomId, room);

      // Update socket data
      socket.data.playerId = playerId;
      socket.data.playerName = playerName.trim();
      socket.data.roomId = roomId;
      socket.data.isAuthenticated = true;

      // Track player socket
      playerSockets.set(playerId, socket.id);

      // Join socket room for real-time updates
      socket.join(roomId);

      // Notify player they joined successfully
      socket.emit('room-joined', room, playerId);

      // Notify other players in the room
      socket.to(roomId).emit('player-joined', roomId, player);
      
      // Broadcast updated room to all clients in the room
      this.io.to(roomId).emit('room-updated', room);
      
      // Broadcast updated room list to lobby
      this.broadcastRoomsList();
      
      console.log(`Player ${playerName} (${playerId}) joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to join room' 
      });
    }
  }

  private handleLeaveRoom(socket: any, roomId: string) {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return;
      }

      const playerId = socket.data.playerId;
      if (!playerId) {
        return;
      }

      // Remove player from room
      room.players = room.players.filter(p => p.id !== playerId);
      
      // If room is empty, delete it
      if (room.players.length === 0) {
        rooms.delete(roomId);
        gameStates.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        // Update positions of remaining players
        room.players.forEach((player, index) => {
          player.position = index;
        });
        rooms.set(roomId, room);
      }

      // Clean up socket data
      playerSockets.delete(playerId);
      socket.leave(roomId);
      socket.data.playerId = undefined;
      socket.data.playerName = undefined;
      socket.data.roomId = undefined;

      // Notify player they left
      socket.emit('room-left', roomId);

      // Notify other players
      socket.to(roomId).emit('player-left', roomId, playerId);
      
      if (room.players.length > 0) {
        this.io.to(roomId).emit('room-updated', room);
      }
      
      // Broadcast updated room list
      this.broadcastRoomsList();
      
      console.log(`Player ${playerId} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  private handleGetRooms(socket: any) {
    const roomsList = Array.from(rooms.values())
      .filter(room => !room.isPrivate) // Only show public rooms
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    socket.emit('rooms-list', roomsList);
  }

  private handlePlayerReady(socket: any, roomId: string, ready: boolean) {
    try {
      const room = rooms.get(roomId);
      const playerId = socket.data.playerId;
      
      if (!room || !playerId) {
        return;
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        return;
      }

      player.isReady = ready;
      rooms.set(roomId, room);

      // Broadcast ready status change
      this.io.to(roomId).emit('player-ready-status', roomId, playerId, ready);
      this.io.to(roomId).emit('room-updated', room);
      
      console.log(`Player ${playerId} ready status: ${ready} in room ${roomId}`);
    } catch (error) {
      console.error('Error updating player ready status:', error);
    }
  }

  private handleStartGame(socket: any, roomId: string) {
    try {
      const room = rooms.get(roomId);
      const playerId = socket.data.playerId;

      if (!room) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.ROOM_NOT_FOUND, 
          message: 'Room not found' 
        });
        return;
      }

      if (!playerId || !room.players.some(p => p.id === playerId)) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.PLAYER_NOT_IN_ROOM, 
          message: 'You are not in this room' 
        });
        return;
      }

      if (room.gameInProgress) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.GAME_ALREADY_STARTED, 
          message: 'Game is already in progress' 
        });
        return;
      }

      if (room.players.length < 2) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.INSUFFICIENT_PLAYERS, 
          message: 'Need at least 2 players to start' 
        });
        return;
      }

      // Check if all players are ready
      const unreadyPlayers = room.players.filter(p => !p.isReady);
      if (unreadyPlayers.length > 0) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.PLAYER_NOT_READY, 
          message: 'All players must be ready to start' 
        });
        return;
      }

      // Start the game
      const gameManager = getGameManager();
      const gameState = gameManager.startGame(room);

      // Update room status
      room.gameInProgress = true;
      rooms.set(roomId, room);

      // Store game state
      gameStates.set(roomId, gameState);

      // Notify all players in the room
      this.io.to(roomId).emit('game-started', gameState);
      this.broadcastRoomsList();

      console.log(`Game started for room ${roomId} by ${playerId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('game-error', roomId, error instanceof Error ? error.message : 'Failed to start game');
    }
  }

  private handleMakeMove(socket: any, roomId: string, move: any) {
    try {
      const playerId = socket.data.playerId;

      if (!playerId) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.PLAYER_NOT_IN_ROOM, 
          message: 'You are not in a room' 
        });
        return;
      }

      const gameManager = getGameManager();
      const gameState = gameManager.getGame(roomId);

      if (!gameState) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.GAME_NOT_STARTED, 
          message: 'Game not found or not started' 
        });
        return;
      }

      // Ensure move has playerId
      const moveWithPlayer = { ...move, playerId };

      // Make the move
      const result = gameManager.makeMove(roomId, moveWithPlayer);

      if (result.success && result.gameState) {
        // Update stored game state
        gameStates.set(roomId, result.gameState);

        // Notify all players of the move result
        this.io.to(roomId).emit('move-made', result.gameState, moveWithPlayer, true);

        // Emit any additional events
        result.events.forEach(event => {
          switch (event.type) {
            case 'CARD_PLAYED':
              this.io.to(roomId).emit('game-state-updated', result.gameState);
              break;
            case 'CARD_DRAWN':
              this.io.to(roomId).emit('game-state-updated', result.gameState);
              break;
            case 'GAME_ENDED':
              this.io.to(roomId).emit('game-ended', result.gameState, event.winner);
              // Update room status
              const room = rooms.get(roomId);
              if (room) {
                room.gameInProgress = false;
                rooms.set(roomId, room);
                this.broadcastRoomsList();
              }
              break;
            case 'SUIT_CHOSEN':
              this.io.to(roomId).emit('game-state-updated', result.gameState);
              break;
            case 'PLAYER_SAID_MAU':
              // Could add special notification here
              break;
          }
        });

        console.log(`Move made in room ${roomId} by ${playerId}:`, moveWithPlayer);
      } else {
        // Move failed - notify the player
        socket.emit('move-made', gameState, moveWithPlayer, false, result.error);
        
        // Emit invalid move events
        result.events.forEach(event => {
          if (event.type === 'INVALID_MOVE') {
            socket.emit('game-error', roomId, event.reason, playerId);
          }
        });

        console.log(`Invalid move in room ${roomId} by ${playerId}: ${result.error}`);
      }
    } catch (error) {
      console.error('Error making move:', error);
      socket.emit('game-error', roomId, error instanceof Error ? error.message : 'Failed to make move', socket.data.playerId);
    }
  }

  private handleSendMessage(socket: any, roomId: string, messageText: string) {
    try {
      const playerId = socket.data.playerId;
      const playerName = socket.data.playerName;
      
      if (!playerId || !playerName) {
        socket.emit('error', { 
          code: SOCKET_ERRORS.PLAYER_NOT_IN_ROOM, 
          message: 'You must be in a room to send messages' 
        });
        return;
      }

      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      const message: ChatMessage = {
        id: uuidv4(),
        playerId,
        playerName,
        message: messageText.trim(),
        timestamp: new Date(),
        type: 'chat',
      };

      // Broadcast message to all players in the room
      this.io.to(roomId).emit('message-received', roomId, message);
      
      console.log(`Message sent in room ${roomId} by ${playerName}: ${messageText}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  private handleDisconnect(socket: any) {
    const playerId = socket.data.playerId;
    const roomId = socket.data.roomId;
    
    if (playerId && roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.isConnected = false;
          rooms.set(roomId, room);
          
          // Handle game disconnection
          const gameManager = getGameManager();
          const updatedGameState = gameManager.handlePlayerDisconnect(roomId, playerId);
          
          if (updatedGameState) {
            gameStates.set(roomId, updatedGameState);
            
            // If game ended due to disconnection
            if (updatedGameState.status === 'finished') {
              this.io.to(roomId).emit('game-ended', updatedGameState, null);
              room.gameInProgress = false;
              rooms.set(roomId, room);
              this.broadcastRoomsList();
            } else {
              this.io.to(roomId).emit('game-state-updated', updatedGameState);
            }
          }
          
          // Notify other players of disconnection
          socket.to(roomId).emit('player-disconnected', roomId, playerId);
          this.io.to(roomId).emit('room-updated', room);
        }
      }
      
      // Clean up
      playerSockets.delete(playerId);
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  }

  private broadcastRoomsList() {
    const roomsList = Array.from(rooms.values())
      .filter(room => !room.isPrivate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    this.io.emit('rooms-list', roomsList);
  }

  public getIO() {
    return this.io;
  }
}

// Export singleton instance
let socketServer: SocketServer | null = null;

export function initializeSocketServer(server: Server): SocketServer {
  if (!socketServer) {
    socketServer = new SocketServer(server);
  }
  return socketServer;
}

export function getSocketServer(): SocketServer | null {
  return socketServer;
}