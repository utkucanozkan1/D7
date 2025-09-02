'use client';

import { useEffect, useState } from 'react';
import { Room } from '@/types/game';
import { Users, Clock, Play, Lock, Unlock, Trash2 } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  onJoin: (roomId: string) => void;
  onDelete?: (roomId: string) => void;
  canDelete?: boolean;
}

export function RoomCard({ room, onJoin, onDelete, canDelete }: RoomCardProps) {
  const [mounted, setMounted] = useState(false);
  const playerCount = room.players.length;
  const isFull = playerCount >= room.maxPlayers;
  const canJoin = !room.gameInProgress && !isFull;

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const getStatusColor = () => {
    if (room.gameInProgress) return 'text-red-400';
    if (isFull) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusText = () => {
    if (room.gameInProgress) return 'In Progress';
    if (isFull) return 'Full';
    return 'Waiting';
  };

  const getTimeSince = () => {
    const now = new Date();
    const created = new Date(room.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/20 transition-all duration-200 card-hover">
      {/* Room Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {room.name}
            </h3>
            {room.isPrivate ? (
              <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            ) : (
              <Unlock className="w-4 h-4 text-green-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center space-x-3 text-sm text-blue-200">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{mounted ? getTimeSince() : 'Loading...'}</span>
            </div>
            <span className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
        
        {/* Delete Button */}
        {canDelete && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Are you sure you want to delete room "${room.name}"?`)) {
                onDelete(room.id);
              }
            }}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete Room"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Player Count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-300" />
          <span className="text-white font-medium">
            {playerCount}/{room.maxPlayers} players
          </span>
        </div>
        
        {/* Player Progress Bar */}
        <div className="flex-1 ml-4">
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isFull 
                  ? 'bg-yellow-400' 
                  : room.gameInProgress 
                    ? 'bg-red-400' 
                    : 'bg-green-400'
              }`}
              style={{ width: `${(playerCount / room.maxPlayers) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Player List */}
      {room.players.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {room.players.slice(0, 6).map((player, index) => (
              <div
                key={player.id}
                className="bg-white/20 text-white text-xs px-2 py-1 rounded-full"
              >
                {player.name}
                {!player.isConnected && (
                  <span className="ml-1 text-red-300">●</span>
                )}
                {player.isReady && room.gameInProgress && (
                  <span className="ml-1 text-green-300">●</span>
                )}
              </div>
            ))}
            {room.players.length > 6 && (
              <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                +{room.players.length - 6}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => onJoin(room.id)}
        disabled={!canJoin}
        className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
          canJoin
            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg hover:shadow-xl'
            : room.gameInProgress
              ? 'bg-white/10 text-white/50 cursor-not-allowed border border-white/20'
              : 'bg-white/10 text-white/50 cursor-not-allowed border border-white/20'
        }`}
      >
        {room.gameInProgress ? (
          <>
            <Play className="w-4 h-4" />
            <span>Spectate</span>
          </>
        ) : isFull ? (
          <>
            <Users className="w-4 h-4" />
            <span>Full</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>Join Room</span>
          </>
        )}
      </button>
    </div>
  );
}