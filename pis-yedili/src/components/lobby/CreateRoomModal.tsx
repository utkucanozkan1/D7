'use client';

import { useState } from 'react';
import { X, Users, Lock, Unlock, Plus, Minus } from 'lucide-react';

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (roomData: { name: string; maxPlayers: number; isPrivate: boolean }) => void;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim()) {
      return;
    }

    setIsCreating(true);
    
    try {
      await onCreate({
        name: roomName.trim(),
        maxPlayers,
        isPrivate,
      });
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const adjustMaxPlayers = (delta: number) => {
    const newValue = maxPlayers + delta;
    if (newValue >= 2 && newValue <= 6) {
      setMaxPlayers(newValue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create New Room</h2>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              maxLength={30}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              required
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-blue-200">
                Choose a memorable name for your room
              </span>
              <span className="text-xs text-blue-200">
                {roomName.length}/30
              </span>
            </div>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Maximum Players
            </label>
            <div className="flex items-center justify-between bg-white/20 border border-white/30 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-white">
                <Users className="w-5 h-5" />
                <span>Players</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => adjustMaxPlayers(-1)}
                  disabled={maxPlayers <= 2}
                  className="p-1 text-white hover:bg-white/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                
                <span className="text-white font-semibold text-lg w-8 text-center">
                  {maxPlayers}
                </span>
                
                <button
                  type="button"
                  onClick={() => adjustMaxPlayers(1)}
                  disabled={maxPlayers >= 6}
                  className="p-1 text-white hover:bg-white/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-blue-200 mt-1">
              Choose between 2-6 players (recommended: 3-4 players)
            </p>
          </div>

          {/* Privacy Setting */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Room Privacy
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  !isPrivate
                    ? 'bg-green-500/20 border-green-400 text-white'
                    : 'bg-white/10 border-white/30 text-white/70 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Unlock className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Public Room</div>
                    <div className="text-sm opacity-80">Anyone can join</div>
                  </div>
                </div>
                {!isPrivate && <div className="w-2 h-2 bg-green-400 rounded-full" />}
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isPrivate
                    ? 'bg-yellow-500/20 border-yellow-400 text-white'
                    : 'bg-white/10 border-white/30 text-white/70 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Lock className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Private Room</div>
                    <div className="text-sm opacity-80">Invite only</div>
                  </div>
                </div>
                {isPrivate && <div className="w-2 h-2 bg-yellow-400 rounded-full" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white/10 border border-white/30 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!roomName.trim() || isCreating}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}