'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/game/GameBoard';
import { GameState, Room, Player, Card, Suit, GameMove } from '@/types/game';
import { getSocketManager } from '@/lib/socket-client';
import { ArrowLeft, Users, Settings } from 'lucide-react';
import Link from 'next/link';

interface GamePageProps {
  params: Promise<{ roomId: string }>;
}

export default function GamePage({ params }: GamePageProps) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [needsToJoin, setNeedsToJoin] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const loadingRef = useRef(true);
  const roomRef = useRef<Room | null>(null);

  // Sync refs when state changes
  useEffect(() => {
    loadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    console.log('🎮 Game page useEffect starting for room:', roomId);
    const socketManager = getSocketManager();
    const socket = socketManager.connect();
    console.log('Socket manager:', socketManager);
    console.log('Socket:', socket);

    // Handle connection status
    socketManager.on('connection-status', (status) => {
      setIsConnected(status === 'connected');
      
      // Try to rejoin if we reconnect and have stored session
      if (status === 'connected' && typeof window !== 'undefined') {
        const storedPlayerId = localStorage.getItem(`room_${roomId}_playerId`);
        const storedPlayerName = localStorage.getItem(`room_${roomId}_playerName`);
        
        if (storedPlayerId && storedPlayerName) {
          console.log('🔄 Reconnected, attempting to rejoin with stored session...');
          const socket = socketManager.getSocket();
          if (socket?.connected) {
            socket.emit('rejoin-room', roomId, storedPlayerId, storedPlayerName);
          }
        }
      }
    });

    // Handle game events
    socketManager.on('game-started', (newGameState: GameState) => {
      setGameState(newGameState);
      setIsLoading(false);
      loadingRef.current = false;
    });

    socketManager.on('game-state-updated', (newGameState: GameState) => {
      setGameState(newGameState);
    });

    socketManager.on('move-made', (newGameState: GameState, move: GameMove, success: boolean, reason?: string) => {
      if (success) {
        setGameState(newGameState);
      } else {
        console.error('Move failed:', reason);
        setError(reason || 'Move failed');
      }
    });

    socketManager.on('game-ended', (finalGameState: GameState, winner: Player | null) => {
      setGameState(finalGameState);
      // Show game end notification
      console.log('Game ended, winner:', winner);
    });

    socketManager.on('room-joined', (joinedRoom: Room, playerId: string) => {
      setRoom(joinedRoom);
      roomRef.current = joinedRoom;
      setCurrentPlayerId(playerId);
      setIsLoading(false);
      loadingRef.current = false;
      setNeedsToJoin(false);
      setError('');
      
      // Store session data for reconnection
      if (typeof window !== 'undefined') {
        localStorage.setItem(`room_${roomId}_playerId`, playerId);
        localStorage.setItem(`room_${roomId}_playerName`, joinedRoom.players.find(p => p.id === playerId)?.name || '');
      }
    });

    socketManager.on('room-updated', (updatedRoom: Room) => {
      console.log('📝 Room updated event received:', updatedRoom);
      console.log('📝 Players ready status:', updatedRoom.players.map(p => ({ name: p.name, ready: p.isReady })));
      setRoom(updatedRoom);
      roomRef.current = updatedRoom;
    });

    socketManager.on('error', (error) => {
      setError(error.message);
      setIsLoading(false);
      loadingRef.current = false;
    });

    socketManager.on('game-error', (roomId: string, errorMessage: string, playerId?: string) => {
      if (roomId === roomId) {
        setError(errorMessage);
      }
    });


    // Handle room state response
    socketManager.on('room-state', (roomData: Room, playerId: string) => {
      console.log('📱 Received room state:', roomData);
      setRoom(roomData);
      roomRef.current = roomData;
      setCurrentPlayerId(playerId);
      setIsLoading(false);
      loadingRef.current = false;
      setNeedsToJoin(false);
      setError(''); // Clear any errors
    });

    // Handle case where player hasn't joined the room yet
    socketManager.on('room-not-joined', (roomData: Room) => {
      console.log('📱 Room exists but player not joined:', roomData);
      setRoom(roomData);
      roomRef.current = roomData;
      setIsLoading(false);
      loadingRef.current = false;
      setNeedsToJoin(true);
    });

    // Check for stored session data
    if (typeof window !== 'undefined') {
      const storedPlayerId = localStorage.getItem(`room_${roomId}_playerId`);
      const storedPlayerName = localStorage.getItem(`room_${roomId}_playerName`);
      
      if (storedPlayerId && storedPlayerName) {
        console.log('🔄 Found stored session, attempting to rejoin...');
        // Attempt to rejoin with stored credentials
        const socket = socketManager.getSocket();
        if (socket?.connected) {
          socket.emit('rejoin-room', roomId, storedPlayerId, storedPlayerName);
        }
      }
    }

    // If already connected, request room state immediately
    if (socketManager.isConnected()) {
      console.log('🔄 Already connected, requesting room state...');
      const socket = socketManager.getSocket();
      console.log('Socket state check:', socket?.connected, socket?.id);
      if (socket?.connected) {
        console.log('🔄 Using direct socket emit for immediate get-room-state...');
        socket.emit('get-room-state', roomId);
        console.log('✅ Direct socket emitted get-room-state immediately for room:', roomId);
      }
    }

    // Fallback timeout to prevent infinite loading
    const fallbackTimeout = setTimeout(() => {
      // Only show error if we're still loading and don't have room data
      if (loadingRef.current && !roomRef.current) {
        console.warn('⚠️ Room state request timed out, stopping loading...');
        setIsLoading(false);
        loadingRef.current = false;
        setError('Failed to load room. Please try refreshing.');
      }
    }, 10000);

    return () => {
      // Clean up timeout
      clearTimeout(fallbackTimeout);
      
      // Clean up listeners
      socketManager.off('game-started');
      socketManager.off('game-state-updated');
      socketManager.off('move-made');
      socketManager.off('game-ended');
      socketManager.off('room-joined');
      socketManager.off('room-updated');
      socketManager.off('room-state');
      socketManager.off('room-not-joined');
      socketManager.off('connection-status');
      socketManager.off('error');
      socketManager.off('game-error');
    };
  }, [roomId]);

  const handleCardPlay = (card: Card) => {
    console.log('🃏 Card play clicked');
    console.log('Card to play:', card);
    console.log('Room ID:', roomId);
    console.log('Current player ID:', currentPlayerId);
    
    const socketManager = getSocketManager();
    console.log('Socket manager:', socketManager);
    console.log('Socket connected:', socketManager.isConnected());
    console.log('Socket ID:', socketManager.getSocket()?.id);
    
    const move: GameMove = {
      type: 'PLAY_CARD',
      playerId: currentPlayerId,
      card
    };
    
    console.log('Move to emit:', move);
    
    // Get the raw socket and try direct emit
    const rawSocket = socketManager.getSocket();
    if (rawSocket?.connected) {
      console.log('🧪 Testing DIRECT socket emit for make-move');
      try {
        rawSocket.emit('make-move', roomId, move);
        console.log('✅ Direct make-move emit successful');
      } catch (error) {
        console.error('❌ Direct make-move emit failed:', error);
      }
    } else {
      console.error('❌ Raw socket not connected for make-move');
    }
    
    // Also try through socket manager
    console.log('🧪 Testing socket manager emit for make-move');
    socketManager.emit('make-move', roomId, move);
    console.log('Make-move event emitted via manager');
  };

  const handleDrawCard = () => {
    console.log('🎯 handleDrawCard called');
    console.log('Current player ID:', currentPlayerId);
    console.log('Room ID:', roomId);
    
    const socketManager = getSocketManager();
    const move: GameMove = {
      type: 'DRAW_CARD',
      playerId: currentPlayerId
    };
    
    console.log('🎯 Emitting make-move with DRAW_CARD:', move);
    console.log('🎯 Socket manager state:', {
      isConnected: socketManager.isConnected(),
      connectionState: socketManager.getConnectionState(),
      socket: socketManager.getSocket()
    });
    
    // Try direct socket access as well
    const directSocket = socketManager.getSocket();
    console.log('🎯 Direct socket:', directSocket?.connected, directSocket?.id);
    
    socketManager.emit('make-move', roomId, move);
    
    // Also try with direct socket
    if (directSocket?.connected) {
      console.log('🎯 Also trying direct socket emit');
      directSocket.emit('make-move', roomId, move);
    }
  };

  const handleChooseSuit = (suit: Suit) => {
    const socketManager = getSocketManager();
    const move: GameMove = {
      type: 'CHOOSE_SUIT',
      playerId: currentPlayerId,
      suit
    };
    socketManager.emit('make-move', roomId, move);
  };

  const handleSayMau = () => {
    const socketManager = getSocketManager();
    const move: GameMove = {
      type: 'SAY_MAU',
      playerId: currentPlayerId
    };
    socketManager.emit('make-move', roomId, move);
  };

  const handleStartGame = () => {
    console.log('🎮 Start game clicked');
    console.log('Room ID:', roomId);
    console.log('Current room:', room);
    console.log('All players ready:', room ? room.players.every(p => p.isReady) : 'unknown');
    
    const socketManager = getSocketManager();
    console.log('Socket manager:', socketManager);
    console.log('Socket connected:', socketManager.isConnected());
    console.log('Socket ID:', socketManager.getSocket()?.id);
    
    // Get the raw socket and try direct emit
    const rawSocket = socketManager.getSocket();
    console.log('Raw socket:', rawSocket);
    console.log('Raw socket connected:', rawSocket?.connected);
    
    if (rawSocket?.connected) {
      console.log('🧪 Testing DIRECT socket emit for start-game');
      try {
        rawSocket.emit('start-game', roomId);
        console.log('✅ Direct start-game emit successful');
      } catch (error) {
        console.error('❌ Direct start-game emit failed:', error);
      }
    } else {
      console.error('❌ Raw socket not connected for start-game');
    }
    
    // Also try through socket manager
    console.log('🧪 Testing socket manager emit for start-game');
    socketManager.emit('start-game', roomId);
    console.log('Start-game event emitted via manager');
  };

  const handleFillWithBots = () => {
    console.log('🤖 Fill with bots clicked');
    console.log('Room ID:', roomId);
    console.log('Current room:', room);
    console.log('Empty slots:', room ? room.maxPlayers - room.players.length : 'unknown');
    
    const socketManager = getSocketManager();
    console.log('Socket manager:', socketManager);
    console.log('Socket connected:', socketManager.isConnected());
    console.log('Socket ID:', socketManager.getSocket()?.id);
    
    // Get the raw socket and try direct emit (like we did for ready button)
    const rawSocket = socketManager.getSocket();
    console.log('Raw socket:', rawSocket);
    console.log('Raw socket connected:', rawSocket?.connected);
    
    if (rawSocket?.connected) {
      console.log('🧪 Testing DIRECT socket emit for fill-with-bots');
      try {
        rawSocket.emit('fill-with-bots', roomId);
        console.log('✅ Direct fill-with-bots emit successful');
      } catch (error) {
        console.error('❌ Direct fill-with-bots emit failed:', error);
      }
    } else {
      console.error('❌ Raw socket not connected for fill-with-bots');
    }
    
    // Also try through socket manager
    console.log('🧪 Testing socket manager emit for fill-with-bots');
    socketManager.emit('fill-with-bots', roomId);
    console.log('Fill-with-bots event emitted via manager');
  };

  const handleToggleReady = () => {
    console.log('🎯 Toggle ready clicked');
    console.log('Room:', room);
    console.log('Current player ID:', currentPlayerId);
    
    if (!room) {
      console.error('No room found');
      return;
    }
    
    const player = room.players.find(p => p.id === currentPlayerId);
    console.log('Found player:', player);
    
    const newReadyState = !player?.isReady;
    console.log('New ready state:', newReadyState);
    
    const socketManager = getSocketManager();
    console.log('Socket connected:', socketManager.isConnected());
    console.log('Socket ID:', socketManager.getSocket()?.id);
    
    // Get the raw socket and try direct emit
    const rawSocket = socketManager.getSocket();
    console.log('Raw socket:', rawSocket);
    console.log('Raw socket connected:', rawSocket?.connected);
    
    if (rawSocket?.connected) {
      console.log('🧪 Testing DIRECT socket emit');
      try {
        rawSocket.emit('test-event', { test: 'direct emit', roomId, playerId: currentPlayerId });
        console.log('✅ Direct emit successful');
        
        console.log('🎯 Direct emit player-ready');
        rawSocket.emit('player-ready', roomId, newReadyState);
        console.log('✅ Direct player-ready emit successful');
      } catch (error) {
        console.error('❌ Direct emit failed:', error);
      }
    } else {
      console.error('❌ Raw socket not connected');
    }
    
    // Also try through socket manager
    console.log('🧪 Testing socket manager emit');
    socketManager.emit('test-event', { test: 'manager emit', roomId, playerId: currentPlayerId });
    
    console.log('Emitting player-ready via manager:', roomId, newReadyState);
    socketManager.emit('player-ready', roomId, newReadyState);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    const socketManager = getSocketManager();
    socketManager.emit('join-room', roomId, playerName.trim());
    setNeedsToJoin(false);
    setIsLoading(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Game Error</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="flex space-x-3">
            <Link 
              href="/lobby"
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-400 hover:to-blue-500 transition-all duration-200"
            >
              Back to Lobby
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-gray-400 hover:to-gray-500 transition-all duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If we have a game in progress, show the game board
  if (gameState && gameState.status === 'playing') {
    return (
      <div className="relative">
        {/* Header overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-4">
              <Link 
                href="/lobby"
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-white font-bold text-lg">{room?.name}</h1>
                <p className="text-blue-200 text-sm">Game in progress</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-white text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <GameBoard
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          onCardPlay={handleCardPlay}
          onDrawCard={handleDrawCard}
          onChooseSuit={handleChooseSuit}
          onSayMau={handleSayMau}
        />
      </div>
    );
  }

  // Show join room UI if player needs to join
  if (needsToJoin && room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-2">Join Room</h2>
          <p className="text-blue-200 mb-6">{room.name}</p>
          
          <div className="mb-4">
            <p className="text-white text-sm mb-2">
              Players: {room.players.length}/{room.maxPlayers}
            </p>
            {room.gameInProgress && (
              <p className="text-yellow-300 text-sm">
                ⚠️ Game is already in progress
              </p>
            )}
          </div>

          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40 mb-4"
            autoFocus
          />

          {error && (
            <p className="text-red-300 text-sm mb-4">{error}</p>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleJoinRoom}
              disabled={room.players.length >= room.maxPlayers || room.gameInProgress}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-400 hover:to-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
            <Link 
              href="/lobby"
              className="bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-gray-400 hover:to-gray-500 transition-all duration-200"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show waiting room if game hasn't started
  if (room && !gameState) {
    const currentPlayer = room.players.find(p => p.id === currentPlayerId);
    const allPlayersReady = room.players.length >= 2 && room.players.every(p => p.isReady);
    const canStart = allPlayersReady && !room.gameInProgress;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between max-w-7xl mx-auto mb-8">
            <div className="flex items-center space-x-4">
              <Link 
                href="/lobby"
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{room.name}</h1>
                <p className="text-blue-200">Waiting for players...</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-white text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Players */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Players ({room.players.length}/{room.maxPlayers})
                </h2>
                
                <div className="space-y-3">
                  {room.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          player.isBot 
                            ? 'bg-purple-400' 
                            : player.isConnected ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <span className="text-white font-medium">
                          {player.name}
                          {player.isBot && (
                            <span className="text-purple-300 text-sm ml-1">🤖</span>
                          )}
                        </span>
                        {player.id === currentPlayerId && (
                          <span className="text-blue-300 text-sm">(You)</span>
                        )}
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        player.isReady 
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}>
                        {player.isReady ? 'Ready' : 'Not Ready'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ready and Bot buttons */}
                <div className="mt-6 flex flex-col space-y-3">
                  <div className="flex space-x-3">
                    <button
                      onClick={handleToggleReady}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        currentPlayer?.isReady
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500'
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500'
                      }`}
                    >
                      {currentPlayer?.isReady ? 'Not Ready' : 'Ready'}
                    </button>

                    {canStart && (
                      <button
                        onClick={handleStartGame}
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-3 px-6 rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg"
                      >
                        Start Game
                      </button>
                    )}
                  </div>

                  {/* Fill with bots button - only show if there are empty slots */}
                  {room.players.length < room.maxPlayers && (
                    <button
                      onClick={handleFillWithBots}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-400 hover:to-purple-500 transition-all duration-200"
                    >
                      Fill Empty Slots with Bots ({room.maxPlayers - room.players.length} slots)
                    </button>
                  )}
                </div>

                {room.players.length < 2 && (
                  <div className="mt-4 p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <p className="text-yellow-300 text-sm">
                      Need at least 2 players to start the game
                    </p>
                  </div>
                )}
              </div>

              {/* Game Rules */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4">Pis Yedili Rules</h2>
                <div className="space-y-3 text-blue-100">
                  <div>
                    <h3 className="font-medium text-white">Objective</h3>
                    <p className="text-sm">Get rid of all your cards while maximizing penalties for opponents</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-white">Starting Rule</h3>
                    <p className="text-sm">First player must play a Club (♣)</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-white">Special Cards</h3>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>7:</strong> Next player draws 3 cards (stackable)</li>
                      <li>• <strong>8:</strong> Skip next player's turn</li>
                      <li>• <strong>10:</strong> Reverse play direction</li>
                      <li>• <strong>Jack:</strong> Choose the next suit to play</li>
                      <li>• <strong>Ace:</strong> All other players draw 1 card</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium text-white">Tek Rule</h3>
                    <p className="text-sm">Say "Tek" when you have 1 card left!</p>
                  </div>

                  <div>
                    <h3 className="font-medium text-white">Scoring</h3>
                    <p className="text-sm">Ace=11, Jack=25, Queen/King=10, Numbers=face value</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Room not found</h2>
        <Link 
          href="/lobby"
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-400 hover:to-blue-500 transition-all duration-200"
        >
          Back to Lobby
        </Link>
      </div>
    </div>
  );
}