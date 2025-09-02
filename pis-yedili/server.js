const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory storage for development
const rooms = new Map();
const gameStates = new Map();
const playerSockets = new Map();

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
      origin: dev ? 'http://localhost:3000' : false,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Initialize socket data
    socket.data = {
      isAuthenticated: false,
      joinedAt: new Date(),
      lastSeen: new Date(),
    };

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
      console.log(`Received get-room-state event from ${socket.id}`);
      handleGetRoomState(socket, roomId);
    });

    // Game events
    socket.on('player-ready', (roomId, ready) => handlePlayerReady(socket, roomId, ready));
    socket.on('start-game', (roomId) => handleStartGame(socket, roomId));

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

  function handleLeaveRoom(socket, roomId) {
    try {
      const room = rooms.get(roomId);
      if (!room) return;

      const playerId = socket.data.playerId;
      if (!playerId) return;

      room.players = room.players.filter(p => p.id !== playerId);
      
      if (room.players.length === 0) {
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
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { 
          code: 'ROOM_NOT_FOUND', 
          message: 'Room not found' 
        });
        return;
      }

      // Find the player in the room by socket ID
      let playerId = null;
      for (const [pid, socketId] of playerSockets.entries()) {
        if (socketId === socket.id) {
          playerId = pid;
          break;
        }
      }

      if (!playerId) {
        socket.emit('error', { 
          code: 'PLAYER_NOT_IN_ROOM', 
          message: 'You are not in this room' 
        });
        return;
      }

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
      const room = rooms.get(roomId);
      const playerId = socket.data.playerId;
      
      if (!room || !playerId) return;

      const player = room.players.find(p => p.id === playerId);
      if (!player) return;

      player.isReady = ready;
      rooms.set(roomId, room);

      io.to(roomId).emit('player-ready-status', roomId, playerId, ready);
      io.to(roomId).emit('room-updated', room);
      
      console.log(`Player ${playerId} ready status: ${ready} in room ${roomId}`);
    } catch (error) {
      console.error('Error updating player ready status:', error);
    }
  }

  function handleStartGame(socket, roomId) {
    const room = rooms.get(roomId);
    const playerId = socket.data.playerId;

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
    
    // Start the discard pile with the first card from the remaining deck
    const topCard = deck.pop();
    const discardPile = [topCard];
    console.log(`Starting card: ${topCard.rank} of ${topCard.suit}`);
    
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
        saidMau: false
      })),
      currentPlayerIndex: 0,
      direction: 'clockwise',
      status: 'playing',
      deck: deck, // Remaining cards in deck
      discardPile: discardPile,
      topCard: topCard,
      drawCount: 0,
      skipNext: false,
      wildSuit: null,
      startedAt: new Date(),
      finishedAt: null,
      winner: null,
      turnStartTime: new Date(),
      turnTimeLimit: 30,
      rules: {
        maxPlayers: room.maxPlayers,
        initialHandSize: 7,
        turnTimeLimit: 30,
        specialCards: {
          '7': { type: 'draw', value: 2 },
          '8': { type: 'skip' },
          'J': { type: 'wild' },
          'A': { type: 'reverse' }
        }
      }
    };

    room.gameInProgress = true;
    rooms.set(roomId, room);
    gameStates.set(roomId, gameState);

    io.to(roomId).emit('game-started', gameState);
    broadcastRoomsList();

    console.log(`Game started for room ${roomId} by ${playerId}`);
  }

  function handleDisconnect(socket) {
    const playerId = socket.data.playerId;
    const roomId = socket.data.roomId;
    
    if (playerId && roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.isConnected = false;
          rooms.set(roomId, room);
          
          socket.to(roomId).emit('player-disconnected', roomId, playerId);
          io.to(roomId).emit('room-updated', room);
        }
      }
      
      playerSockets.delete(playerId);
    }
    
    console.log(`Client disconnected: ${socket.id}`);
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