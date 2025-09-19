'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Clock, 
  Play, 
  Lock,
  Unlock,
  Search,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Room } from '@/types/game';
import { RoomCard } from '@/components/lobby/RoomCard';
import { CreateRoomModal } from '@/components/lobby/CreateRoomModal';
import { getSocketManager } from '@/lib/socket-client';
import { CSSParticleBackground } from '@/components/effects/ParticleBackground';

export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState({
    showFull: true,
    showInProgress: false,
    showPrivate: false,
  });

  // Connect to Socket.IO and load real rooms
  useEffect(() => {
    console.log('🚀 Lobby page useEffect starting...');
    const socketManager = getSocketManager();
    const socket = socketManager.connect();
    console.log('📱 Socket manager created and connect called');

    // Set up event listeners
    socketManager.on('rooms-list', (roomsList: Room[]) => {
      console.log('📋 Received rooms-list:', roomsList);
      console.log('📊 Rooms count:', roomsList.length);
      console.log('📄 Room details:', roomsList.map(r => ({ id: r.id, name: r.name, isPrivate: r.isPrivate, players: r.players.length })));
      setRooms(roomsList);
      setIsLoading(false);
      
      // Force a re-render to make sure UI updates
      console.log('🔄 Updated rooms state, should re-render now');
    });

    socketManager.on('room-created', (room: Room) => {
      setRooms(prev => [room, ...prev]);
    });

    socketManager.on('room-delete-success', (roomId: string) => {
      console.log('🎉 Room deleted successfully:', roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
    });

    socketManager.on('connection-status', (status) => {
      console.log('🔌 Connection status changed to:', status);
      if (status === 'connected') {
        console.log('✅ Connected! Requesting rooms list...');
        // Request rooms list when connected
        socketManager.emit('get-rooms');
        
        // Also test direct socket emit as backup
        const directSocket = socketManager.getSocket();
        if (directSocket?.connected) {
          console.log('🔄 Also trying direct socket emit as backup...');
          directSocket.emit('get-rooms');
        }
      }
    });

    socketManager.on('room-joined', (room: Room, playerId: string) => {
      console.log('Successfully joined room:', room.id);
      router.push(`/game/${room.id}`);
    });

    socketManager.on('error', (error) => {
      console.error('Socket error:', error);
      setError(error.message);
      setIsLoading(false);
      alert(`Error: ${error.message}`);
    });

    // Request initial rooms list
    if (socketManager.isConnected()) {
      console.log('🔄 Already connected, requesting rooms immediately');
      socketManager.emit('get-rooms');
    } else {
      console.log('⏳ Not connected yet, will request rooms when connected');
    }

    // Add timeout to check if we're stuck loading
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ Still loading after 10 seconds, something might be wrong');
        console.log('Current state:', {
          isConnected: socketManager.isConnected(),
          socketId: socketManager.getSocket()?.id,
          roomsCount: rooms.length
        });
      }
    }, 10000);

    return () => {
      clearTimeout(loadingTimeout);
      socketManager.off('rooms-list');
      socketManager.off('room-created');
      socketManager.off('room-delete-success');
      socketManager.off('room-joined');
      socketManager.off('connection-status');
      socketManager.off('error');
    };
  }, []);

  // Filter rooms based on search and filters
  useEffect(() => {
    console.log('🔍 Filtering rooms...');
    console.log('📦 Total rooms:', rooms.length);
    console.log('🎯 Filters:', filters);
    console.log('🔎 Search query:', searchQuery);
    
    let filtered = rooms.filter(room => {
      console.log(`🏠 Checking room ${room.name}:`, { 
        isPrivate: room.isPrivate, 
        isFull: room.players.length >= room.maxPlayers,
        inProgress: room.gameInProgress 
      });
      
      // Search filter
      if (searchQuery && !room.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        console.log(`❌ ${room.name} filtered out by search`);
        return false;
      }

      // Full rooms filter
      if (!filters.showFull && room.players.length >= room.maxPlayers) {
        console.log(`❌ ${room.name} filtered out - room is full`);
        return false;
      }

      // In progress games filter
      if (!filters.showInProgress && room.gameInProgress) {
        console.log(`❌ ${room.name} filtered out - game in progress`);
        return false;
      }

      // Private rooms filter
      if (!filters.showPrivate && room.isPrivate) {
        console.log(`❌ ${room.name} filtered out - room is private`);
        return false;
      }

      console.log(`✅ ${room.name} passed all filters`);
      return true;
    });

    console.log('📋 Filtered rooms count:', filtered.length);
    setFilteredRooms(filtered);
  }, [rooms, searchQuery, filters]);

  const handleCreateRoom = (roomData: { name: string; maxPlayers: number; isPrivate: boolean; maxRounds: number }) => {
    console.log('🏠 Creating room with data:', roomData);
    const socketManager = getSocketManager();
    const socket = socketManager.getSocket();
    
    console.log('🔧 Socket state before emit:', {
      connected: socket?.connected,
      id: socket?.id,
      socketExists: !!socket
    });
    
    console.log('🚀 About to emit create-room via socket manager...');
    socketManager.emit('create-room', roomData);
    console.log('✅ Socket manager emit called');
    
    // Also try direct emit as backup
    if (socket?.connected) {
      console.log('🔄 Also trying direct socket emit as backup...');
      socket.emit('create-room', roomData);
      console.log('✅ Direct socket emit called');
    }
    
    setShowCreateModal(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    console.log('🗑️ Deleting room:', roomId);
    const socketManager = getSocketManager();
    const socket = socketManager.getSocket();
    
    console.log('🔧 Socket state for delete:', {
      connected: socket?.connected,
      id: socket?.id,
      socketExists: !!socket
    });
    
    // Use direct socket emit only since socket manager emit isn't working
    if (socket?.connected) {
      console.log('🔄 Using direct socket delete-room emit...');
      socket.emit('delete-room', roomId);
      console.log('✅ Direct socket delete-room emit called');
    } else {
      console.error('❌ Socket not connected, cannot delete room');
    }
  };


  const handleJoinRoom = (roomId: string) => {
    const playerName = prompt('Enter your name:');
    if (playerName && playerName.trim()) {
      console.log('🚪 Joining room:', roomId, 'with name:', playerName.trim());
      const socketManager = getSocketManager();
      const socket = socketManager.getSocket();
      
      // Use direct socket emit since socket manager emit has issues
      if (socket?.connected) {
        console.log('🔄 Using direct socket join-room emit...');
        socket.emit('join-room', roomId, playerName.trim());
        console.log('✅ Direct socket join-room emit called');
      } else {
        console.error('❌ Socket not connected, cannot join room');
        alert('Connection error. Please refresh and try again.');
      }
    }
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setIsLoading(true);
    const socketManager = getSocketManager();
    console.log('Socket status:', {
      connected: socketManager.isConnected(),
      socketId: socketManager.getSocket()?.id
    });
    socketManager.emit('get-rooms');
    setTimeout(() => setIsLoading(false), 500);
  };

  const toggleFilter = (filterKey: keyof typeof filters) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 relative">
      <CSSParticleBackground />
      {/* Header */}
      <header className="relative z-10 p-6 border-b border-white/20 backdrop-blur-sm bg-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Game Lobby</h1>
              <p className="text-blue-200">Find or create a room to play</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-2 px-4 rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Room</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent backdrop-blur-sm"
            />
          </div>

          {/* Filter Options */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2 text-white">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Show:</span>
            </div>
            
            <button
              onClick={() => toggleFilter('showFull')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.showFull
                  ? 'bg-yellow-500 text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Full Rooms
            </button>

            <button
              onClick={() => toggleFilter('showInProgress')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.showInProgress
                  ? 'bg-yellow-500 text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              In Progress
            </button>

            <button
              onClick={() => toggleFilter('showPrivate')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.showPrivate
                  ? 'bg-yellow-500 text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Private
            </button>
          </div>
        </div>

        {/* Rooms Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Loading rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto">
              <Users className="w-16 h-16 text-white/60 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No rooms found</h3>
              <p className="text-blue-200 mb-6">
                {searchQuery || !filters.showFull || !filters.showInProgress
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to create a room!'}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-2 px-6 rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg"
              >
                Create Room
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                onJoin={handleJoinRoom}
                onDelete={handleDeleteRoom}
                canDelete={true} // For now, allow anyone to delete any room for testing
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
}