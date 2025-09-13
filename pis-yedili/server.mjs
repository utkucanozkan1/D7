import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 6050;

const app = next({ dev, hostname });
const handle = app.getRequestHandler();

// In-memory storage for development
const rooms = new Map();
const gameStates = new Map();
const playerSockets = new Map();
const roomTransitions = new Set(); // Track rooms in transition

// Card game constants and utilities
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a standard 52-card deck
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: uuidv4()
      });
    }
  }
  return deck;
}

// Shuffle deck using Fisher-Yates algorithm
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate penalty points for remaining cards in hand
function calculatePenaltyPoints(hand) {
  return hand.reduce((total, card) => {
    switch (card.rank) {
      case 'A': return total + 11;
      case 'K': case 'Q': case 'J': return total + 10;
      case '7': case '8': return total + 20; // Special cards worth more
      default: return total + parseInt(card.rank);
    }
  }, 0);
}

// Deal cards to players
function dealCards(deck, playerCount, cardsPerPlayer = 7) {
  const hands = Array(playerCount).fill(null).map(() => []);
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < playerCount; p++) {
      if (deck.length > 0) {
        hands[p].push(deck.pop());
      }
    }
  }
  
  return hands;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IO setup
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? `http://localhost:${port}` : false,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    console.log(`Total connected clients: ${io.engine.clientsCount}`);

    // Initialize socket data
    socket.data = {
      isAuthenticated: false,
      joinedAt: new Date(),
      lastSeen: new Date(),
    };

    // Debug: Log all events this socket receives
    socket.onAny((event, ...args) => {
      console.log(`🎧 Socket ${socket.id} received event: ${event}`, args);
    });

    // Send a test event immediately to verify connection is working
    console.log(`Sending welcome message to ${socket.id}`);
    socket.emit('rooms-list', []);  // Send empty rooms list to test

    // Room management events
    socket.on('create-room', (roomData) => {
      console.log(`Received create-room event from ${socket.id}`);
      handleCreateRoom(socket, roomData);
    });
    socket.on('join-room', (roomId, playerName) => {
      console.log(`Received join-room event from ${socket.id}`);
      handleJoinRoom(socket, roomId, playerName);
    });
    socket.on('leave-room', (roomId) => {
      console.log(`Received leave-room event from ${socket.id}`);
      handleLeaveRoom(socket, roomId);
    });
    socket.on('get-rooms', () => {
      console.log(`Received get-rooms event from ${socket.id}`);
      handleGetRooms(socket);
    });
    socket.on('delete-room', (roomId) => {
      console.log(`Received delete-room event from ${socket.id}`);
      handleDeleteRoom(socket, roomId);
    });
    socket.on('get-room-state', (roomId) => {
      console.log(`📞 GET-ROOM-STATE EVENT: Received get-room-state event from ${socket.id} for room ${roomId}`);
      socket.emit('debug-response', { message: 'get-room-state received', roomId, timestamp: new Date() });
      handleGetRoomState(socket, roomId);
    });
    socket.on('rejoin-room', (roomId, playerId, playerName) => {
      console.log(`Received rejoin-room event from ${socket.id}`);
      handleRejoinRoom(socket, roomId, playerId, playerName);
    });

    // Game events
    socket.on('player-ready', (roomId, ready) => {
      console.log(`🎯 Received player-ready event from ${socket.id} for room ${roomId}, ready: ${ready}`);
      console.log(`🎯 Socket data at ready time:`, socket.data);
      handlePlayerReady(socket, roomId, ready);
    });
    
    // Add test event to see if socket is working at all
    socket.on('test-event', (data) => {
      console.log(`🧪 Test event received from ${socket.id}:`, data);
    });
    
    socket.on('start-game', async (roomId) => await handleStartGame(socket, roomId));
    socket.on('fill-with-bots', async (roomId) => await handleFillWithBots(socket, roomId));
    socket.on('make-move', async (roomId, move) => await handleMakeMove(socket, roomId, move));
    socket.on('continue-to-next-round', async (roomId) => {
      console.log(`📞 CONTINUE EVENT RECEIVED: continue-to-next-round from ${socket.id} for room ${roomId}`);
      console.log(`🔍 CONTINUE EVENT DEBUG: Socket connected: ${socket.connected}, Socket authenticated: ${socket.data.isAuthenticated}`);
      await handleContinueToNextRound(socket, roomId);
    });

    // Testing/Debug events
    socket.on('simulate-round-win', async (roomId) => {
      try {
        console.log(`🎮 Simulating round win for room ${roomId}`);
        console.log('Socket data:', socket.data);
        console.log('Room exists:', rooms.has(roomId));
        console.log('Game state exists:', gameStates.has(roomId));

        const gameState = gameStates.get(roomId);
        const room = rooms.get(roomId);
        const playerId = socket.data.playerId;

        if (!gameState || !room) {
          console.log('Game state or room not found');
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room or game not found' });
          return;
        }

        if (!playerId) {
          console.log('Player not found');
          socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: 'Player not found' });
          return;
        }

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) {
          console.log('Player not found in game');
          socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: 'Player not found in game' });
          return;
        }

        // Simulate winning the round
        const currentRound = gameState.currentRound || 1;
        const maxRounds = gameState.maxRounds || 1;
        const newRoundWinners = [...(gameState.roundWinners || []), playerId];

        // Calculate scores
        gameState.players = gameState.players.map(player => {
          const roundScore = player.id === playerId ? 0 : calculatePenaltyPoints(player.hand);
          const totalScore = (player.score || 0) + roundScore;
          return {
            ...player,
            roundScore,
            score: totalScore
          };
        });

        gameState.status = 'finished';
        gameState.winner = playerId;
        gameState.finishedAt = new Date();
        gameState.roundWinners = newRoundWinners;

        if (currentRound >= maxRounds) {
          // Game complete
          const overallWinner = gameState.players.reduce((best, player) => {
            const bestScore = best.score || 0;
            const playerScore = player.score || 0;
            return playerScore < bestScore ? player : best;
          });

          gameState.winner = overallWinner.id;
          gameState.isGameComplete = true;

          io.to(roomId).emit('final-game-ended', gameState, overallWinner, newRoundWinners);

          // Update room status
          room.gameInProgress = false;
          rooms.set(roomId, room);
          broadcastRoomsList();
        } else {
          // Round ended but game continues
          room.gameInProgress = false;
          room.currentRound = currentRound;
          room.roundWinners = gameState.roundWinners;
          rooms.set(roomId, room);
          broadcastRoomsList();

          io.to(roomId).emit('round-ended', gameState, currentPlayer, currentRound);
        }

        // Update game state
        gameStates.set(roomId, gameState);
        console.log(`✅ Round win simulation complete for ${currentPlayer.name}`);
      } catch (error) {
        console.error('Error in simulate-round-win:', error);
        socket.emit('error', { code: 'SIMULATION_ERROR', message: 'Failed to simulate round win' });
      }
    });

    // Connection events
    socket.on('ping', () => socket.emit('pong'));
    socket.on('disconnect', () => handleDisconnect(socket));
  });

  // Event handlers
  function handleCreateRoom(socket, roomData) {
    try {
      console.log(`Create room request from ${socket.id}:`, roomData);

      if (!roomData.name || roomData.name.trim().length === 0) {
        console.log('Invalid room name');
        socket.emit('error', {
          code: 'INVALID_ROOM_NAME',
          message: 'Room name is required'
        });
        return;
      }
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const room = {
        id: roomId,
        name: roomData.name.trim(),
        players: [],
        maxPlayers: roomData.maxPlayers || 4,
        isPrivate: roomData.isPrivate || false,
        gameInProgress: false,
        createdAt: new Date(),
        createdBy: socket.id,
        maxRounds: roomData.maxRounds || 1,
        currentRound: 1,
        roundWinners: []
      };

      rooms.set(roomId, room);
      console.log(`Room created: ${roomId}, total rooms: ${rooms.size}`);
      socket.emit('room-created', room);

      broadcastRoomsList();
      console.log(`Room created: ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create room'
      });
    }
  }
  function handleJoinRoom(socket, roomId, playerName) {
    try {
      if (!playerName || playerName.trim().length === 0) {
        socket.emit('error', {
          code: 'INVALID_PLAYER_NAME',
          message: 'Player name is required'
        });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found'
        });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', {
          code: 'ROOM_FULL',
          message: 'Room is full'
        });
        return;
      }

      if (room.players.some(p => p.name === playerName.trim())) {
        socket.emit('error', {
          code: 'INVALID_PLAYER_NAME',
          message: 'Player name is already taken'
        });
        return;
      }

      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = {
        id: playerId,
        name: playerName.trim(),
        hand: [],
        handCount: 0,
        isReady: false,
        isConnected: true,
        position: room.players.length,
      };

      room.players.push(player);
      rooms.set(roomId, room);

      socket.data.playerId = playerId;
      socket.data.playerName = playerName.trim();
      socket.data.roomId = roomId;
      socket.data.isAuthenticated = true;

      playerSockets.set(playerId, socket.id);
      socket.join(roomId);

      socket.emit('room-joined', room, playerId);
      socket.to(roomId).emit('player-joined', roomId, player);
      io.to(roomId).emit('room-updated', room);

      broadcastRoomsList();
      console.log(`Player ${playerName} (${playerId}) joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join room'
      });
    }
}

  function handleRejoinRoom(socket, roomId, playerId, playerName) {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        console.log(`Rejoin failed: room ${roomId} not found`);
        socket.emit('error', { 
          code: 'ROOM_NOT_FOUND', 
          message: 'Room not found' 
        });
        return;
      }

      // Check if player exists in the room
      const existingPlayer = room.players.find(p => p.id === playerId);
      
      if (existingPlayer) {
        // Player exists, update their connection
        console.log(`Player ${playerId} rejoining room ${roomId}`);
        existingPlayer.isConnected = true;
        
        // Update socket mapping
        playerSockets.set(playerId, socket.id);
        
        // Update socket data
        socket.data.playerId = playerId;
        socket.data.playerName = playerName;
        socket.data.roomId = roomId;
        socket.data.isAuthenticated = true;
        
        // Join room
        socket.join(roomId);
        
        // Send room state
        socket.emit('room-joined', room, playerId);
        socket.to(roomId).emit('player-reconnected', roomId, playerId);
        io.to(roomId).emit('room-updated', room);
        
        // Send game state if game is in progress
        const gameState = gameStates.get(roomId);
        if (gameState && room.gameInProgress) {
          socket.emit('game-state-updated', gameState);
        }
        
        console.log(`Player ${playerName} (${playerId}) successfully rejoined room ${roomId}`);
      } else {
        // Player doesn't exist in room, treat as new join
        console.log(`Player ${playerId} not found in room, treating as new join`);
        handleJoinRoom(socket, roomId, playerName);
      }
    } catch (error) {
      console.error('Error rejoining room:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to rejoin room' 
      });
    }
  }

  function handleLeaveRoom(socket, roomId) {
    try {
      const room = rooms.get(roomId);
      if (!room) return;

      const playerId = socket.data.playerId;
      if (!playerId) return;

      room.players = room.players.filter(p => p.id !== playerId);
      
      if (room.players.length === 0) {
        if (roomTransitions.has(roomId)) {
          console.log(`🔒 PROTECTION: Prevented deletion of room ${roomId} - in transition`);
          return;
        }
        console.log(`🗑️ ROOM DELETION: Room ${roomId} deleted (empty) - triggered by handleLeaveRoom`);
        console.log(`🔍 DELETION STACK TRACE:`, new Error().stack);
        rooms.delete(roomId);
        gameStates.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        room.players.forEach((player, index) => {
          player.position = index;
        });
        rooms.set(roomId, room);
      }

      playerSockets.delete(playerId);
      socket.leave(roomId);
      socket.data.playerId = undefined;
      socket.data.playerName = undefined;
      socket.data.roomId = undefined;

      socket.emit('room-left', roomId);
      socket.to(roomId).emit('player-left', roomId, playerId);
      
      if (room.players.length > 0) {
        io.to(roomId).emit('room-updated', room);
      }
      
      broadcastRoomsList();
      console.log(`Player ${playerId} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  function handleGetRooms(socket) {
    const roomsList = Array.from(rooms.values())
      .filter(room => !room.isPrivate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    console.log(`Sending ${roomsList.length} rooms to client ${socket.id}`);
    socket.emit('rooms-list', roomsList);
  }

  function handleGetRoomState(socket, roomId) {
    try {
      console.log(`🔍 GET ROOM STATE: Request for room ${roomId} from socket ${socket.id}`);
      console.log(`🔍 ROOMS DEBUG: Total rooms: ${rooms.size}, Available room IDs: ${Array.from(rooms.keys())}`);

      const room = rooms.get(roomId);
      if (!room) {
        console.log(`❌ GET ROOM STATE: Room ${roomId} not found when requested by ${socket.id}`);
        console.log(`🔍 AVAILABLE ROOMS:`, Array.from(rooms.entries()).map(([id, r]) => ({ id, name: r.name, players: r.players.length })));
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found'
        });
        return;
      }

      console.log(`✅ GET ROOM STATE: Room ${roomId} found, processing...`);

      // Find the player in the room by socket ID
      let playerId = null;
      for (const [pid, socketId] of playerSockets.entries()) {
        if (socketId === socket.id) {
          playerId = pid;
          break;
        }
      }

      // If player is not in the room, they might be navigating directly to the URL
      // Send room info but indicate they need to join
      if (!playerId) {
        console.log(`Player ${socket.id} not in room ${roomId}, sending room info for preview`);
        socket.emit('room-not-joined', room);
        return;
      }

      // Check if player is actually in the room
      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        console.log(`Player ${playerId} not found in room ${roomId}`);
        socket.emit('room-not-joined', room);
        return;
      }

      // Update socket data for authentication
      console.log(`Setting socket data for player ${playerId} in room ${roomId}`);
      socket.data.playerId = playerId;
      socket.data.playerName = player.name;
      socket.data.roomId = roomId;
      socket.data.isAuthenticated = true;
      console.log(`Socket data set:`, socket.data);

      // Join the socket.io room
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);

      console.log(`Sending room state for ${roomId} to player ${playerId}`);
      socket.emit('room-state', room, playerId);

      // Also send current game state if game is in progress
      const gameState = gameStates.get(roomId);
      if (gameState && room.gameInProgress) {
        socket.emit('game-state-updated', gameState);
      }
      
    } catch (error) {
      console.error('Error getting room state:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to get room state' 
      });
    }
  }

  function handleDeleteRoom(socket, roomId) {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { 
          code: 'ROOM_NOT_FOUND', 
          message: 'Room not found' 
        });
        return;
      }

      // Check if the socket is the room creator
      if (room.createdBy !== socket.id) {
        socket.emit('error', { 
          code: 'UNAUTHORIZED', 
          message: 'Only the room creator can delete the room' 
        });
        return;
      }

      // Notify all players in the room that it's being deleted
      io.to(roomId).emit('room-deleted', roomId);
      
      // Remove the room
      console.log(`🗑️ ROOM DELETION: Room ${roomId} deleted (handleDeleteRoom) by socket ${socket.id}`);
      console.log(`🔍 DELETION STACK TRACE:`, new Error().stack);
      rooms.delete(roomId);
      gameStates.delete(roomId);
      
      console.log(`Room ${roomId} deleted by ${socket.id}, total rooms: ${rooms.size}`);
      
      // Broadcast updated rooms list
      broadcastRoomsList();
      
      socket.emit('room-delete-success', roomId);
    } catch (error) {
      console.error('Error deleting room:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to delete room' 
      });
    }
  }

  function handlePlayerReady(socket, roomId, ready) {
    try {
      console.log(`handlePlayerReady called - roomId: ${roomId}, ready: ${ready}, socketId: ${socket.id}`);
      const room = rooms.get(roomId);
      const playerId = socket.data.playerId;
      
      console.log(`Player ID from socket data: ${playerId}`);
      console.log(`Room found: ${!!room}`);
      
      if (!room) {
        console.log('Room not found for ready status update');
        socket.emit('error', { 
          code: 'ROOM_NOT_FOUND', 
          message: 'Room not found' 
        });
        return;
      }
      
      if (!playerId) {
        console.log('Player ID not found in socket data');
        socket.emit('error', { 
          code: 'PLAYER_NOT_AUTHENTICATED', 
          message: 'Player not authenticated' 
        });
        return;
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        console.log(`Player ${playerId} not found in room`);
        socket.emit('error', { 
          code: 'PLAYER_NOT_IN_ROOM', 
          message: 'Player not in room' 
        });
        return;
      }

      player.isReady = ready;
      rooms.set(roomId, room);

      io.to(roomId).emit('player-ready-status', roomId, playerId, ready);
      io.to(roomId).emit('room-updated', room);
      
      console.log(`Player ${playerId} ready status updated to ${ready} in room ${roomId}`);
    } catch (error) {
      console.error('Error updating player ready status:', error);
      socket.emit('error', { 
        code: 'READY_UPDATE_FAILED', 
        message: 'Failed to update ready status' 
      });
    }
  }

  function handleFillWithBots(socket, roomId) {
    try {
      console.log(`Fill with bots request from ${socket.id} for room ${roomId}`);
      const room = rooms.get(roomId);
      
      if (!room) {
        console.log('Room not found for fill with bots');
        socket.emit('error', { 
          code: 'ROOM_NOT_FOUND', 
          message: 'Room not found' 
        });
        return;
      }

      // Only authenticated players can fill with bots
      const playerId = socket.data.playerId;
      if (!playerId || !room.players.find(p => p.id === playerId)) {
        console.log('Unauthorized fill with bots request');
        socket.emit('error', { 
          code: 'UNAUTHORIZED', 
          message: 'Not authorized to fill with bots' 
        });
        return;
      }

      const botsToAdd = room.maxPlayers - room.players.length;
      
      if (botsToAdd <= 0) {
        console.log('Room is already full');
        socket.emit('error', { 
          code: 'ROOM_FULL', 
          message: 'Room is already full' 
        });
        return;
      }

      // Add bot players
      const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana'];
      
      for (let i = 0; i < botsToAdd; i++) {
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const botName = botNames[room.players.length % botNames.length];
        
        const botPlayer = {
          id: botId,
          name: botName,
          hand: [],
          handCount: 0,
          isReady: true, // Bots are always ready
          isConnected: true,
          position: room.players.length,
          isBot: true
        };

        room.players.push(botPlayer);
        console.log(`Added bot player: ${botName} (${botId})`);
      }

      rooms.set(roomId, room);
      
      io.to(roomId).emit('room-updated', room);
      
      console.log(`Successfully added ${botsToAdd} bot players to room ${roomId}`);
    } catch (error) {
      console.error('Error filling with bots:', error);
      socket.emit('error', { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to fill with bots' 
      });
    }
  }

  async function handleStartGame(socket, roomId) {
    try {
      console.log(`🎮 GAME START: handleStartGame called for room ${roomId} by socket ${socket.id}`);
      console.log(`🔍 GAME START DEBUG: Rooms exist: ${rooms.size}, Room exists: ${rooms.has(roomId)}`);
      console.log(`🔍 GAME START DEBUG: Game states exist: ${gameStates.size}, Game state exists: ${gameStates.has(roomId)}`);

      const room = rooms.get(roomId);
      const playerId = socket.data.playerId;

      console.log(`🔍 GAME START DATA:`, {
        roomExists: !!room,
        playerId,
        roomPlayersCount: room?.players?.length || 0,
        gameInProgress: room?.gameInProgress,
        socketData: socket.data,
        roomDetails: room ? {
          id: room.id,
          name: room.name,
          players: room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady })),
          currentRound: room.currentRound,
          maxRounds: room.maxRounds
        } : null
      });

    if (!room) {
      socket.emit('error', { 
        code: 'ROOM_NOT_FOUND', 
        message: 'Room not found' 
      });
      return;
    }

    if (!playerId || !room.players.some(p => p.id === playerId)) {
      socket.emit('error', { 
        code: 'PLAYER_NOT_IN_ROOM', 
        message: 'You are not in this room' 
      });
      return;
    }

    if (room.gameInProgress) {
      socket.emit('error', {
        code: 'GAME_ALREADY_STARTED',
        message: 'Game is already in progress'
      });
      return;
    }

    // Ensure game state is clean (handleContinueToNextRound should have done this already)
    if (gameStates.has(roomId)) {
      console.log(`⚠️ Found existing game state, cleaning up`);
      gameStates.delete(roomId);
    }

    if (room.players.length < 2) {
      socket.emit('error', { 
        code: 'INSUFFICIENT_PLAYERS', 
        message: 'Need at least 2 players to start' 
      });
      return;
    }

    const unreadyPlayers = room.players.filter(p => !p.isReady);
    if (unreadyPlayers.length > 0) {
      socket.emit('error', { 
        code: 'PLAYER_NOT_READY', 
        message: 'All players must be ready to start' 
      });
      return;
    }

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    console.log(`Created and shuffled deck with ${deck.length} cards`);
    
    // Deal cards to players
    const hands = dealCards(deck, room.players.length, 7);
    console.log(`Dealt cards to ${room.players.length} players`);
    
    // Pis Yedili rule: Game must start with a Club
    // Find the first player who has a club, or give them one
    let startingPlayerIndex = 0;
    let hasClubPlayer = -1;
    
    // Check if any player has a club
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(card => card.suit === 'clubs')) {
        hasClubPlayer = i;
        break;
      }
    }
    
    // If no player has a club, give the first player a club from the deck
    if (hasClubPlayer === -1) {
      let clubCard = deck.find(card => card.suit === 'clubs');
      if (clubCard) {
        // Remove club from deck and give to first player
        deck.splice(deck.indexOf(clubCard), 1);
        hands[0].push(clubCard);
        hasClubPlayer = 0;
      }
    }
    
    startingPlayerIndex = hasClubPlayer >= 0 ? hasClubPlayer : 0;
    
    // Pis Yedili: Start with empty discard pile - first player must play a club
    const discardPile = [];
    const topCard = null; // No starting card, first player must play a club
    
    console.log(`Pis Yedili game starting - Player ${startingPlayerIndex} must play a club first`);
    console.log(`Discard pile is empty, topCard is null`);
    
    // Create game state with actual card data
    const gameState = {
      id: `game_${Date.now()}`,
      roomId,
      players: room.players.map((p, index) => ({
        ...p,
        hand: hands[index], // Real cards dealt to player
        handCount: hands[index].length,
        position: index,
        hasDrawnThisTurn: false,
        saidMau: false, // Keep for compatibility, but use saidTek for Pis Yedili
        saidTek: false, // Pis Yedili: declare "tek" when down to 1 card
        score: p.score || 0, // Running score for the game (preserve from previous rounds)
        roundScore: 0 // Points from current round
      })),
      currentPlayerIndex: startingPlayerIndex,
      direction: 'clockwise',
      status: 'playing',
      deck: deck, // Remaining cards in deck
      discardPile: discardPile,
      topCard: topCard,
      drawCount: 0, // For stacking 7s
      skipNext: false,
      wildSuit: null, // When Jack is played
      isFirstPlay: true, // First play must be a club
      sevenStack: 0, // Count of consecutive 7s played
      startedAt: new Date(),
      finishedAt: null,
      winner: null,
      turnStartTime: new Date(),
      turnTimeLimit: 30,
      maxRounds: room.maxRounds || 1,
      currentRound: room.currentRound || 1,
      roundWinners: room.roundWinners || [],
      isGameComplete: false,
      rules: {
        maxPlayers: room.maxPlayers,
        initialHandSize: 7,
        turnTimeLimit: 30,
        gameType: 'pis-yedili',
        mustStartWithClub: true,
        specialCards: {
          '7': { type: 'draw', value: 3, stackable: true }, // Pis Yedili: draw 3, stackable
          '8': { type: 'skip' }, // Skip next player
          '10': { type: 'reverse' }, // Pis Yedili: 10 reverses direction (not Ace)
          'J': { type: 'wild' }, // Jack changes suit
          'A': { type: 'draw_all', value: 1 } // Pis Yedili: All other players draw 1
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
          'Joker': 20 // Extra penalty for ending with Joker (if used)
        }
      }
    };

    room.gameInProgress = true;
    rooms.set(roomId, room);
    gameStates.set(roomId, gameState);

    console.log(`📡 Emitting game-started event to room ${roomId}`, {
      gameId: gameState.id,
      status: gameState.status,
      currentRound: gameState.currentRound,
      playersCount: gameState.players.length
    });
    io.to(roomId).emit('game-started', gameState);
    broadcastRoomsList();

    console.log(`✅ Game started for room ${roomId} by ${playerId}`);

    // Check if current player is a bot and process their turn
    setTimeout(() => processBotTurn(roomId), 1000);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start game'
      });
    }
  }

  function handleMakeMove(socket, roomId, move) {
    try {
      console.log(`🎯 Received make-move from ${socket.id}:`, move);
      console.log(`🔍 Room access check - roomId: ${roomId}, rooms exist: ${rooms.has(roomId)}, gameStates exist: ${gameStates.has(roomId)}`);
      
      const gameState = gameStates.get(roomId);
      const playerId = socket.data.playerId;
      
      if (!gameState) {
        console.log('Game state not found');
        socket.emit('move-made', null, move, false, 'Game not found');
        return;
      }
      
      if (!playerId) {
        console.log('Player not authenticated');
        socket.emit('move-made', null, move, false, 'Player not authenticated');
        return;
      }
      
      // Validate it's the player's turn
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.id !== playerId) {
        console.log(`Not player's turn. Current: ${currentPlayer?.id}, Requesting: ${playerId}`);
        socket.emit('move-made', gameState, move, false, 'Not your turn');
        return;
      }
      
      console.log(`🎮 Processing move for ${currentPlayer.name}`);
      
      // Apply the move
      const success = applyMove(gameState, move);
      
      if (success) {
        // Update game state
        gameStates.set(roomId, gameState);
        
        console.log(`✅ Move successful, broadcasting to room ${roomId}`);
        
        // Broadcast the successful move
        io.to(roomId).emit('move-made', gameState, move, true);
        io.to(roomId).emit('game-state-updated', gameState);
        
        // Check if round ended
        if (currentPlayer.handCount === 0) {
          console.log(`🏆 HUMAN PLAYER WON: ${currentPlayer.name} (${currentPlayer.id}) won the round in room ${roomId}`);
          const currentRound = gameState.currentRound || 1;
          const maxRounds = gameState.maxRounds || 1;
          const newRoundWinners = [...(gameState.roundWinners || []), currentPlayer.id];
          console.log(`📊 Round info: current=${currentRound}, max=${maxRounds}, complete=${currentRound >= maxRounds}`);
          
          // Calculate scores for all players based on remaining cards
          gameState.players = gameState.players.map(player => {
            const roundScore = player.id === currentPlayer.id ? 0 : calculatePenaltyPoints(player.hand);
            const totalScore = (player.score || 0) + roundScore;
            
            return {
              ...player,
              roundScore,
              score: totalScore
            };
          });
          
          gameState.status = 'finished';
          gameState.winner = currentPlayer.id;
          gameState.finishedAt = new Date();
          gameState.roundWinners = newRoundWinners;
          
          if (currentRound >= maxRounds) {
            // Game complete - determine overall winner (lowest score wins)
            const overallWinner = gameState.players.reduce((best, player) => {
              const bestScore = best.score || 0;
              const playerScore = player.score || 0;
              return playerScore < bestScore ? player : best;
            });
            
            gameState.winner = overallWinner.id;
            gameState.isGameComplete = true;
            
            io.to(roomId).emit('final-game-ended', gameState, overallWinner, newRoundWinners);
            console.log(`🏆 Final game ended, overall winner: ${overallWinner.name} with ${overallWinner.score} points`);
            
            // Update room status
            const room = rooms.get(roomId);
            if (room) {
              room.gameInProgress = false;
              rooms.set(roomId, room);
              broadcastRoomsList();
            }
          } else {
            // Round ended but game continues
            // Update room status for round end
            const room = rooms.get(roomId);
            console.log(`🔍 HUMAN ROUND END - Room found: ${!!room}, Room ID: ${roomId}`);
            if (room) {
              console.log(`🔄 Updating room state for human win - gameInProgress: ${room.gameInProgress} -> false`);
              room.gameInProgress = false; // Mark game as paused between rounds
              room.currentRound = currentRound;
              room.roundWinners = gameState.roundWinners;
              rooms.set(roomId, room);
              console.log(`✅ Room state updated for human win, rooms count: ${rooms.size}`);
              broadcastRoomsList();
            } else {
              console.log(`❌ CRITICAL: Room ${roomId} not found when human won round!`);
            }
            
            io.to(roomId).emit('round-ended', gameState, currentPlayer, currentRound);
            console.log(`🎯 Round ${currentRound} ended, winner: ${currentPlayer.name}`);
          }
          return;
        }
        
        // Schedule next bot turn if needed (after human move)
        setTimeout(() => processBotTurn(roomId), 1000);
      } else {
        console.log('❌ Move failed validation');
        socket.emit('move-made', gameState, move, false, 'Invalid move');
      }
    } catch (error) {
      console.error('Error handling make-move:', error);
      socket.emit('move-made', null, move, false, 'Internal error');
    }
  }

  function processBotTurn(roomId) {
    try {
      console.log(`🤖 processBotTurn called for room ${roomId}`);
      console.log(`🔍 Available game states:`, Array.from(gameStates.keys()));
      const gameState = gameStates.get(roomId);
      if (!gameState) {
        console.log(`🤖 No game state found for room ${roomId}`);
        console.log(`🔍 Current game states:`, Array.from(gameStates.entries()).map(([k, v]) => ({ roomId: k, status: v.status })));
        return;
      }
      if (gameState.status !== 'playing') {
        console.log(`🤖 Game not playing, status: ${gameState.status}`);
        return;
      }

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer) {
        console.log(`🤖 No current player found, index: ${gameState.currentPlayerIndex}`);
        console.log(`🤖 Available players:`, gameState.players.map((p, i) => ({ index: i, name: p.name, isBot: p.isBot })));
        return;
      }
      if (!currentPlayer.isBot) {
        console.log(`🤖 Current player ${currentPlayer.name} is not a bot, skipping`);
        console.log(`🤖 Player details:`, { name: currentPlayer.name, isBot: currentPlayer.isBot, id: currentPlayer.id });
        return; // Not a bot's turn
      }

      console.log(`🤖 Processing bot turn for ${currentPlayer.name} in room ${roomId}`);
      console.log(`🤖 Bot player details:`, {
        name: currentPlayer.name,
        handCount: currentPlayer.handCount,
        actualHandSize: currentPlayer.hand ? currentPlayer.hand.length : 'unknown',
        isBot: currentPlayer.isBot
      });
      
      // Bot AI logic
      const botMove = getBotMove(gameState, currentPlayer);
      
      if (botMove) {
        console.log(`🤖 Bot ${currentPlayer.name} making move:`, botMove);
        
        // Apply the bot's move
        console.log(`🎮 Applying bot move:`, botMove);
        const success = applyMove(gameState, botMove);
        console.log(`🎮 Bot move applied, success:`, success);
        
        if (success) {
          // Update game state
          gameStates.set(roomId, gameState);
          
          // Broadcast the move
          io.to(roomId).emit('move-made', gameState, botMove, true);
          io.to(roomId).emit('game-state-updated', gameState);
          
          // Check if game ended
          if (currentPlayer.handCount === 0) {
            const currentRound = gameState.currentRound || 1;
            const maxRounds = gameState.maxRounds || 1;
            const newRoundWinners = [...(gameState.roundWinners || []), currentPlayer.id];
            
            // Calculate scores for all players based on remaining cards
            gameState.players = gameState.players.map(player => {
              const roundScore = player.id === currentPlayer.id ? 0 : calculatePenaltyPoints(player.hand);
              const totalScore = (player.score || 0) + roundScore;
              
              return {
                ...player,
                roundScore,
                score: totalScore
              };
            });
            
            gameState.status = 'finished';
            gameState.winner = currentPlayer.id;
            gameState.finishedAt = new Date();
            gameState.roundWinners = newRoundWinners;
            
            if (currentRound >= maxRounds) {
              // Game complete - determine overall winner (lowest score wins)
              const overallWinner = gameState.players.reduce((best, player) => {
                const bestScore = best.score || 0;
                const playerScore = player.score || 0;
                return playerScore < bestScore ? player : best;
              });
              
              gameState.winner = overallWinner.id;
              gameState.isGameComplete = true;
              
              io.to(roomId).emit('final-game-ended', gameState, overallWinner, newRoundWinners);
              console.log(`🏆 Final game ended (bot), overall winner: ${overallWinner.name} with ${overallWinner.score} points`);
              
              // Update room status
              const room = rooms.get(roomId);
              if (room) {
                room.gameInProgress = false;
                rooms.set(roomId, room);
                broadcastRoomsList();
              }
            } else {
              // Round ended but game continues
              // Update room status for round end
              const room = rooms.get(roomId);
              console.log(`🔍 BOT ROUND END - Room found: ${!!room}, Room ID: ${roomId}`);
              if (room) {
                console.log(`🔄 Updating room state - gameInProgress: ${room.gameInProgress} -> false`);
                room.gameInProgress = false; // Mark game as paused between rounds
                room.currentRound = currentRound;
                room.roundWinners = gameState.roundWinners;
                rooms.set(roomId, room);
                console.log(`✅ Room state updated, rooms count: ${rooms.size}`);
                broadcastRoomsList();
              } else {
                console.log(`❌ CRITICAL: Room ${roomId} not found when bot won round!`);
              }
              
              io.to(roomId).emit('round-ended', gameState, currentPlayer, currentRound);
              console.log(`🎯 Round ${currentRound} ended (bot), winner: ${currentPlayer.name}`);
            }
            return;
          }
          
          // Schedule next bot turn if needed
          setTimeout(() => processBotTurn(roomId), 1000);
        } else {
          console.log(`❌ Bot move FAILED for ${currentPlayer.name}:`, botMove);
        }
      } else {
        console.log(`❌ No bot move returned for ${currentPlayer.name}`);
      }
    } catch (error) {
      console.error('Error processing bot turn:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  function getBotMove(gameState, botPlayer) {
    console.log(`🤖 getBotMove called for ${botPlayer.name}`, {
      handCount: botPlayer.handCount,
      actualHandLength: botPlayer.hand ? botPlayer.hand.length : 'no hand array',
      topCard: gameState.topCard ? `${gameState.topCard.rank} of ${gameState.topCard.suit}` : null,
      drawCount: gameState.drawCount,
      isFirstPlay: gameState.isFirstPlay
    });
    
    // Debug: Log bot's actual hand
    console.log(`🃏 Bot ${botPlayer.name}'s hand:`, botPlayer.hand ? botPlayer.hand.map(c => `${c.rank} of ${c.suit}`).join(', ') : 'NO HAND ARRAY');
    
    // Simple bot AI logic for Pis Yedili
    
    // If bot has exactly 1 card and hasn't said Tek yet, say Tek first
    if (botPlayer.handCount === 1 && !botPlayer.saidTek) {
      console.log(`🤖 Bot ${botPlayer.name} saying Tek (1 card left)`);
      return {
        type: 'SAY_MAU',
        playerId: botPlayer.id
      };
    }
    
    console.log(`🔍 Calling getValidCardsForBot...`);
    const validCards = getValidCardsForBot(botPlayer.hand, gameState);
    console.log(`🤖 Valid cards for ${botPlayer.name}:`, validCards.length, 'cards:', validCards.map(c => `${c.rank} of ${c.suit}`));
    
    if (validCards.length > 0) {
      // For now, just play the first valid card
      const cardToPlay = validCards[0];
      console.log(`🤖 Bot ${botPlayer.name} playing card: ${cardToPlay.rank} of ${cardToPlay.suit}`);
      
      const move = {
        type: 'PLAY_CARD',
        playerId: botPlayer.id,
        card: cardToPlay
      };
      console.log(`🤖 Returning PLAY_CARD move:`, move);
      return move;
    } else {
      // No valid cards, draw a card
      console.log(`🤖 Bot ${botPlayer.name} has no valid cards, drawing card`);
      const move = {
        type: 'DRAW_CARD',
        playerId: botPlayer.id
      };
      console.log(`🤖 Returning DRAW_CARD move:`, move);
      return move;
    }
  }


  function getValidCardsForBot(hand, gameState) {
    const { topCard, wildSuit, drawCount, isFirstPlay } = gameState;
    
    // If there are accumulated draws, only 7s can be played
    if (drawCount > 0) {
      return hand.filter(card => card.rank === '7');
    }
    
    // If it's the first play, only clubs can be played
    if (isFirstPlay && !topCard) {
      return hand.filter(card => card.suit === 'clubs');
    }
    
    // If no top card, can play any card
    if (!topCard) {
      return hand;
    }
    
    // If there's a wild suit (from Jack), must match that suit
    if (wildSuit) {
      return hand.filter(card => card.suit === wildSuit || card.rank === 'J');
    }
    
    // Jacks are always playable (wild cards)
    const jacks = hand.filter(card => card.rank === 'J');
    
    // Normal matching: same suit or same rank (no color matching)
    const normalMatches = hand.filter(card => 
      card.suit === topCard.suit || 
      card.rank === topCard.rank
    );
    
    // Combine jacks with normal matches (avoid duplicates)
    const validCards = [...jacks];
    normalMatches.forEach(card => {
      if (!validCards.some(c => c.id === card.id)) {
        validCards.push(card);
      }
    });
    
    return validCards;
  }

  function ensureDeckHasCards(gameState, cardsNeeded = 1) {
    if (gameState.deck.length >= cardsNeeded) {
      return true;
    }
    
    console.log(`Deck has ${gameState.deck.length} cards, need ${cardsNeeded}. Reshuffling discard pile...`);
    
    if (gameState.discardPile.length > 1) {
      // Keep the top card, reshuffle the rest
      const topCard = gameState.topCard;
      const cardsToShuffle = gameState.discardPile.slice(0, -1); // All except the top card
      
      // Shuffle the discard pile
      for (let i = cardsToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsToShuffle[i], cardsToShuffle[j]] = [cardsToShuffle[j], cardsToShuffle[i]];
      }
      
      // Add shuffled cards to deck
      gameState.deck.push(...cardsToShuffle);
      gameState.discardPile = topCard ? [topCard] : [];
      
      console.log(`Reshuffled ${cardsToShuffle.length} cards. Deck now has ${gameState.deck.length} cards.`);
    }
    
    return gameState.deck.length >= cardsNeeded;
  }

  function applyMove(gameState, move) {
    // This is a simplified version - you'd want full move validation here
    const player = gameState.players.find(p => p.id === move.playerId);
    if (!player) return false;

    if (move.type === 'SAY_MAU') {
      // Handle Say Tek (Pis Yedili equivalent of Say Mau)
      if (player.handCount === 1) {
        player.saidTek = true;
        console.log(`🗣️ Player ${player.name} said Tek! (has ${player.handCount} card left)`);
        return true;
      } else {
        console.log(`❌ Player ${player.name} tried to say Tek but has ${player.handCount} cards`);
        return false;
      }
    } else if (move.type === 'PLAY_CARD') {
      // Remove card from player's hand
      const cardIndex = player.hand.findIndex(c => c.id === move.card.id);
      if (cardIndex === -1) return false;
      
      player.hand.splice(cardIndex, 1);
      player.handCount = player.hand.length;
      
      // Add card to discard pile
      gameState.discardPile.push(move.card);
      gameState.topCard = move.card;
      
      // Handle special card effects
      handleSpecialCardEffect(gameState, move.card);
      
      // Clear wild suit after playing a non-Jack card
      // (Wild suit only lasts until someone plays a matching card)
      if (move.card.rank !== 'J') {
        gameState.wildSuit = null;
      }
      
      // Clear first play flag
      if (gameState.isFirstPlay) {
        gameState.isFirstPlay = false;
      }
      
      // Move to next player
      nextPlayer(gameState);
      
      return true;
    } else if (move.type === 'DRAW_CARD') {
      // Determine how many cards to draw
      let cardsToDraw = gameState.drawCount > 0 ? gameState.drawCount : 1;
      
      // Ensure deck has enough cards
      if (!ensureDeckHasCards(gameState, cardsToDraw)) {
        console.log('Not enough cards available for drawing');
        return false;
      }
      
      // Draw the cards
      for (let i = 0; i < cardsToDraw; i++) {
        const drawnCard = gameState.deck.pop();
        if (drawnCard) {
          player.hand.push(drawnCard);
        }
      }
      player.handCount = player.hand.length;
      
      // Reset draw count and 7-stack after drawing
      gameState.drawCount = 0;
      gameState.sevenStack = 0;
      
      // Move to next player
      nextPlayer(gameState);
      return true;
    }
    
    return false;
  }

  function handleSpecialCardEffect(gameState, card) {
    // Implement Pis Yedili special card effects
    switch (card.rank) {
      case '7':
        gameState.sevenStack = (gameState.sevenStack || 0) + 1;
        gameState.drawCount = gameState.sevenStack * 3; // 3 cards per 7
        break;
      case '8':
        gameState.skipNext = true;
        break;
      case '10':
        gameState.direction = gameState.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
        break;
      case 'J':
        // For bot, choose a suit they have most of
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const suitCounts = suits.map(suit => ({
          suit,
          count: gameState.players[gameState.currentPlayerIndex].hand.filter(c => c.suit === suit).length
        }));
        gameState.wildSuit = suitCounts.sort((a, b) => b.count - a.count)[0].suit;
        break;
      case 'A':
        // All other players draw 1 card
        const otherPlayersCount = gameState.players.length - 1;
        if (ensureDeckHasCards(gameState, otherPlayersCount)) {
          gameState.players.forEach((p, index) => {
            if (index !== gameState.currentPlayerIndex && gameState.deck.length > 0) {
              const drawnCard = gameState.deck.pop();
              p.hand.push(drawnCard);
              p.handCount = p.hand.length;
            }
          });
        }
        break;
      default:
        // Clear any stacked 7s
        gameState.sevenStack = 0;
        gameState.drawCount = 0;
        break;
    }
  }

  function nextPlayer(gameState) {
    const playerCount = gameState.players.length;
    
    if (gameState.skipNext) {
      // Skip the next player
      gameState.skipNext = false;
      if (gameState.direction === 'clockwise') {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 2) % playerCount;
      } else {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex - 2 + playerCount) % playerCount;
      }
    } else {
      // Normal next player
      if (gameState.direction === 'clockwise') {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % playerCount;
      } else {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex - 1 + playerCount) % playerCount;
      }
    }
    
    gameState.turnStartTime = new Date();
  }

  function handleDisconnect(socket) {
    const playerId = socket.data.playerId;
    const roomId = socket.data.roomId;
    
    console.log(`🔌 DISCONNECT: Socket ${socket.id} disconnected, playerId: ${playerId}, roomId: ${roomId}`);
    
    if (playerId && roomId) {
      const room = rooms.get(roomId);
      console.log(`🔍 DISCONNECT: Room found: ${!!room}, players count: ${room?.players?.length || 0}`);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        console.log(`🔍 DISCONNECT: Player found: ${!!player}, player name: ${player?.name || 'unknown'}`);
        if (player) {
          player.isConnected = false;
          rooms.set(roomId, room);
          
          socket.to(roomId).emit('player-disconnected', roomId, playerId);
          io.to(roomId).emit('room-updated', room);
          
          console.log(`Player ${playerId} disconnected from room ${roomId} but keeping in room`);
          
          // Set a timeout to remove the player if they don't reconnect within 5 minutes
          console.log(`⏰ Setting 5-minute timeout for player ${playerId} in room ${roomId}`);
          setTimeout(() => {
            console.log(`⏰ TIMEOUT TRIGGERED: Checking player ${playerId} in room ${roomId}`);
            const currentRoom = rooms.get(roomId);
            if (currentRoom) {
              const currentPlayer = currentRoom.players.find(p => p.id === playerId);
              if (currentPlayer && !currentPlayer.isConnected) {
                console.log(`⏰ REMOVING: Player ${playerId} hasn't reconnected, removing from room`);
                // Player hasn't reconnected, remove them
                currentRoom.players = currentRoom.players.filter(p => p.id !== playerId);
                
                if (currentRoom.players.length === 0) {
                  if (roomTransitions.has(roomId)) {
                    console.log(`🔒 PROTECTION: Prevented deletion of room ${roomId} - in transition (timeout)`);
                    return;
                  }
                  console.log(`🗑️ ROOM DELETION: Room ${roomId} deleted (empty after timeout) - player ${playerId} timeout`);
                  console.log(`🔍 DELETION STACK TRACE:`, new Error().stack);
                  rooms.delete(roomId);
                  gameStates.delete(roomId);
                  console.log(`Room ${roomId} deleted (empty after timeout)`);
                } else {
                  rooms.set(roomId, currentRoom);
                  io.to(roomId).emit('room-updated', currentRoom);
                }
                
                console.log(`Player ${playerId} removed from room ${roomId} after timeout`);
                broadcastRoomsList();
              } else {
                console.log(`⏰ SKIP: Player ${playerId} has reconnected or room state changed`);
              }
            } else {
              console.log(`⏰ SKIP: Room ${roomId} no longer exists`);
            }
          }, 300000); // 5 minutes
        }
      }
      
      // Don't delete from playerSockets immediately, just mark as disconnected
      // playerSockets.delete(playerId);
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  }

  async function handleContinueToNextRound(socket, roomId) {
    try {
      console.log(`🔄 ROUND TRANSITION START: Continue to next round request for room ${roomId} from ${socket.id}`);

      // Mark room as in transition to prevent deletion
      roomTransitions.add(roomId);
      console.log(`🔒 PROTECTION: Room ${roomId} marked as in transition`);

      console.log(`🔍 ROOMS DEBUG: Total rooms: ${rooms.size}, Room exists: ${rooms.has(roomId)}`);
      console.log(`🔍 GAME STATES DEBUG: Total game states: ${gameStates.size}, Game state exists: ${gameStates.has(roomId)}`);

      const gameState = gameStates.get(roomId);
      const room = rooms.get(roomId);

      if (!gameState || !room) {
        console.log(`❌ CRITICAL ERROR: Room or game not found - gameState: ${!!gameState}, room: ${!!room}`);
        console.log(`🔍 Available rooms:`, Array.from(rooms.keys()));
        console.log(`🔍 Available game states:`, Array.from(gameStates.keys()));
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room or game not found' });
        return;
      }

      console.log(`📊 GAME STATE CHECK: status="${gameState.status}", isGameComplete=${gameState.isGameComplete}`);
      console.log(`📊 ROOM STATE CHECK: gameInProgress=${room.gameInProgress}, currentRound=${room.currentRound}, maxRounds=${room.maxRounds}`);

      if (gameState.status !== 'finished' || gameState.isGameComplete) {
        console.log(`❌ Invalid state for continuing - status: ${gameState.status}, complete: ${gameState.isGameComplete}`);
        socket.emit('error', { code: 'INVALID_STATE', message: 'Cannot continue to next round' });
        return;
      }

      const playerId = socket.data.playerId;
      if (!playerId || !room.players.some(p => p.id === playerId)) {
        console.log(`❌ Player not authorized - playerId: ${playerId}, players: ${room.players.map(p => p.id)}`);
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not authorized' });
        return;
      }

      console.log(`🎯 TRANSITION STEP 1: Starting round transition for room ${roomId}`);

      // 1. Save player scores from the finished game
      const playerScores = {};
      gameState.players.forEach(p => {
        playerScores[p.id] = p.score || 0;
      });
      console.log(`💾 TRANSITION STEP 2: Saved player scores:`, playerScores);

      // 2. Update room for next round
      const nextRound = (room.currentRound || 1) + 1;
      room.currentRound = nextRound;
      room.roundWinners = gameState.roundWinners || [];
      room.gameInProgress = false;
      console.log(`🔄 TRANSITION STEP 3: Updated room - nextRound: ${nextRound}, gameInProgress: ${room.gameInProgress}`);

      // 3. Reset players with preserved scores
      room.players = room.players.map(player => ({
        ...player,
        score: playerScores[player.id] || 0,
        hand: [],
        handCount: 0,
        saidTek: false,
        hasDrawnThisTurn: false,
        isReady: true
      }));
      console.log(`👥 TRANSITION STEP 4: Reset players with scores:`, room.players.map(p => ({name: p.name, score: p.score, ready: p.isReady})));

      // 4. Clean up old game state
      gameStates.delete(roomId);
      rooms.set(roomId, room);
      console.log(`🗑️ TRANSITION STEP 5: Cleaned game state, rooms count: ${rooms.size}`);

      console.log(`📡 TRANSITION STEP 6: Broadcasting next-round-started event`);

      // 5. Broadcast the round transition
      io.to(roomId).emit('next-round-started', {
        roundNumber: nextRound,
        totalRounds: room.maxRounds || 1
      });

      io.to(roomId).emit('room-updated', room);
      console.log(`📡 TRANSITION STEP 7: Broadcasted events`);

      // 6. Start the new game
      console.log(`🎮 TRANSITION STEP 8: About to start new game for round ${nextRound}`);
      console.log(`🔍 PRE-START CHECK: Room exists: ${rooms.has(roomId)}, Room gameInProgress: ${room.gameInProgress}`);

      // Double check room still exists before starting
      const roomCheck = rooms.get(roomId);
      if (!roomCheck) {
        console.log(`❌ CRITICAL: Room disappeared before starting new game!`);
        socket.emit('error', { code: 'ROOM_DISAPPEARED', message: 'Room was deleted during transition' });
        return;
      }

      try {
        await handleStartGame(socket, roomId);
        console.log(`✅ ROUND TRANSITION COMPLETE: Round transition completed successfully`);
      } catch (startGameError) {
        console.error(`💥 ERROR in handleStartGame:`, startGameError);
        console.error(`💥 START GAME ERROR STACK:`, startGameError.stack);

        // Check if room still exists after error
        console.log(`🔍 POST-ERROR CHECK: Room exists: ${rooms.has(roomId)}`);

        socket.emit('error', {
          code: 'START_GAME_FAILED',
          message: 'Failed to start new round game: ' + startGameError.message
        });
      } finally {
        // Always remove transition protection
        roomTransitions.delete(roomId);
        console.log(`🔓 PROTECTION: Room ${roomId} transition protection removed`);
      }

    } catch (error) {
      console.error('💥 ROUND TRANSITION ERROR:', error);
      console.error('💥 ERROR STACK:', error.stack);
      roomTransitions.delete(roomId); // Remove protection on error
      socket.emit('error', { code: 'INTERNAL_ERROR', message: 'Failed to continue to next round' });
    }
  }

  function broadcastRoomsList() {
    const roomsList = Array.from(rooms.values())
      .filter(room => !room.isPrivate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    io.emit('rooms-list', roomsList);
  }

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server is ready`);
  });
});