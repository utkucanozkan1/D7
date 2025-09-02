'use client';

import { useState, useEffect, use } from 'react';
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

  useEffect(() => {
    console.log('🎮 Game page useEffect starting for room:', roomId);
    const socketManager = getSocketManager();
    const socket = socketManager.connect();
    console.log('Socket manager:', socketManager);
    console.log('Socket:', socket);

    // Handle connection status
    socketManager.on('connection-status', (status) => {
      setIsConnected(status === 'connected');
    });

    // Handle game events
    socketManager.on('game-started', (newGameState: GameState) => {
      setGameState(newGameState);
      setIsLoading(false);
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
      setCurrentPlayerId(playerId);
      setIsLoading(false);
    });

    socketManager.on('room-updated', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socketManager.on('error', (error) => {
      setError(error.message);
      setIsLoading(false);
    });

    socketManager.on('game-error', (roomId: string, errorMessage: string, playerId?: string) => {
      if (roomId === roomId) {
        setError(errorMessage);
      }
    });

    // Request current room state when page loads
    socketManager.on('connection-status', (status) => {
      console.log('🔌 Connection status changed to:', status);
      if (status === 'connected') {
        console.log('🔌 Connected to server, requesting room state...');
        // Request current room state using direct socket emit
        const socket = socketManager.getSocket();
        console.log('Socket for get-room-state:', socket?.connected, socket?.id);
        if (socket?.connected) {
          console.log('🔄 Using direct socket emit for get-room-state...');
          socket.emit('get-room-state', roomId);
          console.log('✅ Direct socket emitted get-room-state for room:', roomId);
        }
      }
    });

    // Handle room state response
    socketManager.on('room-state', (roomData: Room, playerId: string) => {
      console.log('📱 Received room state:', roomData);
      setRoom(roomData);
      setCurrentPlayerId(playerId);
      setIsLoading(false);
    });

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
      if (isLoading) {
        console.warn('⚠️ Room state request timed out, stopping loading...');
        setIsLoading(false);
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
      socketManager.off('connection-status');
      socketManager.off('error');
      socketManager.off('game-error');
    };
  }, [roomId]);

  const handleCardPlay = (card: Card) => {
    const socketManager = getSocketManager();
    const move: GameMove = {
      type: 'PLAY_CARD',
      playerId: currentPlayerId,
      card
    };
    socketManager.emit('make-move', roomId, move);
  };

  const handleDrawCard = () => {
    const socketManager = getSocketManager();
    const move: GameMove = {
      type: 'DRAW_CARD',
      playerId: currentPlayerId
    };
    socketManager.emit('make-move', roomId, move);
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
    const socketManager = getSocketManager();
    socketManager.emit('start-game', roomId);
  };

  const handleToggleReady = () => {
    if (!room) return;
    const player = room.players.find(p => p.id === currentPlayerId);
    const newReadyState = !player?.isReady;
    
    const socketManager = getSocketManager();
    socketManager.emit('player-ready', roomId, newReadyState);
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
                          player.isConnected ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <span className="text-white font-medium">{player.name}</span>
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

                {/* Ready button */}
                <div className="mt-6 flex space-x-3">
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
                <h2 className="text-xl font-semibold text-white mb-4">Game Rules</h2>
                <div className="space-y-3 text-blue-100">
                  <div>
                    <h3 className="font-medium text-white">Objective</h3>
                    <p className="text-sm">Be the first to play all your cards</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-white">Special Cards</h3>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>7:</strong> Next player draws 2 cards (stackable)</li>
                      <li>• <strong>8:</strong> Skip next player's turn</li>
                      <li>• <strong>Jack:</strong> Choose the next suit to play</li>
                      <li>• <strong>Ace:</strong> Reverse play direction</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium text-white">Mau Rule</h3>
                    <p className="text-sm">Say "Mau" when you have 2 cards left!</p>
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