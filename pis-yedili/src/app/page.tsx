'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Users, Settings, HelpCircle, Trophy } from 'lucide-react';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleQuickPlay = () => {
    if (playerName.trim()) {
      // Quick play functionality will be implemented later
      console.log('Quick play with:', playerName);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-green-800 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-48 bg-white rounded-lg rotate-12 shadow-lg"></div>
        <div className="absolute top-40 right-32 w-32 h-48 bg-red-500 rounded-lg -rotate-12 shadow-lg"></div>
        <div className="absolute bottom-32 left-1/3 w-32 h-48 bg-black rounded-lg rotate-6 shadow-lg"></div>
        <div className="absolute bottom-40 right-20 w-32 h-48 bg-yellow-400 rounded-lg -rotate-6 shadow-lg"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
              P
            </div>
            <h1 className="text-2xl font-bold text-white">Pis Yedili</h1>
          </div>
          
          <div className="flex space-x-4">
            <button className="text-white hover:text-yellow-300 transition-colors">
              <Settings className="w-6 h-6" />
            </button>
            <button className="text-white hover:text-yellow-300 transition-colors">
              <HelpCircle className="w-6 h-6" />
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <h2 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Pis Yedili
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-2">
              The Classic Turkish Card Game
            </p>
            <p className="text-lg text-blue-200 opacity-80">
              Play Mau Mau online with friends around the world
            </p>
          </div>

          {/* Quick Play Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-6">Quick Play</h3>
            
            <div className="max-w-md mx-auto space-y-4">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                maxLength={20}
              />
              
              <button
                onClick={handleQuickPlay}
                disabled={!playerName.trim()}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-3 px-6 rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Play className="w-5 h-5" />
                <span>Find Game</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Link 
              href="/lobby"
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-200 group"
            >
              <Users className="w-8 h-8 text-blue-300 mb-3 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-white mb-2">Browse Rooms</h3>
              <p className="text-blue-200 text-sm">Join existing games or create your own room</p>
            </Link>

            <button className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-200 group">
              <Trophy className="w-8 h-8 text-yellow-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-white mb-2">Leaderboard</h3>
              <p className="text-blue-200 text-sm">Check your stats and rankings</p>
            </button>

            <button className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-200 group">
              <HelpCircle className="w-8 h-8 text-green-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-white mb-2">How to Play</h3>
              <p className="text-blue-200 text-sm">Learn the rules and strategies</p>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex flex-wrap justify-center items-center space-x-6 text-blue-200 text-sm">
            <span>© 2025 Pis Yedili</span>
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <button className="hover:text-white transition-colors">Terms of Service</button>
            <button className="hover:text-white transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
