'use client';

import { Player } from '@/types/game';
import { Trophy, Crown, Star, Target } from 'lucide-react';

interface WinnerModalProps {
  winner: Player;
  isRoundWin: boolean;
  isGameComplete?: boolean;
  currentRound?: number;
  maxRounds?: number;
  roundWinners?: string[];
  players?: Player[];
  onContinue?: () => void;
  onNewGame?: () => void;
  onLeaveLobby?: () => void;
}

export function WinnerModal({
  winner,
  isRoundWin,
  isGameComplete = false,
  currentRound,
  maxRounds,
  roundWinners = [],
  players = [],
  onContinue,
  onNewGame,
  onLeaveLobby
}: WinnerModalProps) {
  // Calculate round wins for each player
  const roundWinCounts = players.reduce((acc, player) => {
    acc[player.id] = roundWinners.filter(winnerId => winnerId === player.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Get final rankings when game is complete
  const finalRankings = players
    .map(player => ({
      ...player,
      roundWins: roundWinCounts[player.id] || 0
    }))
    .sort((a, b) => b.roundWins - a.roundWins);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-yellow-400/20 to-orange-500/20 backdrop-blur-md rounded-3xl border border-yellow-300/30 p-8 w-full max-w-lg shadow-2xl">
        
        {/* Header with trophy */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            {isGameComplete ? (
              <Crown className="w-20 h-20 text-yellow-400 animate-pulse" />
            ) : (
              <Trophy className="w-16 h-16 text-yellow-400" />
            )}
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-2">
            {isGameComplete ? 'Game Complete!' : isRoundWin ? 'Round Winner!' : 'Winner!'}
          </h2>
          
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-xl py-2 px-6 rounded-full inline-block">
            🎉 {winner.name} 🎉
          </div>
        </div>

        {/* Round info for round wins */}
        {isRoundWin && !isGameComplete && (
          <div className="text-center mb-6">
            <p className="text-white text-lg mb-2">
              Round {currentRound} Winner!
            </p>
            {maxRounds && (
              <div className="flex justify-center items-center space-x-2 text-blue-200">
                <Target className="w-4 h-4" />
                <span>Round {currentRound} of {maxRounds}</span>
              </div>
            )}
          </div>
        )}

        {/* Final game rankings */}
        {isGameComplete && finalRankings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white text-lg font-semibold mb-3 text-center">Final Standings</h3>
            <div className="space-y-2">
              {finalRankings
                .sort((a, b) => (a.score || 0) - (b.score || 0)) // Sort by lowest score first
                .map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 
                      ? 'bg-yellow-500/20 border border-yellow-400/50' 
                      : 'bg-white/10 border border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-400 text-black' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-orange-400 text-black' :
                      'bg-white/20 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{player.name}</span>
                    {index === 0 && <Crown className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-white font-semibold">{player.roundWins}</span>
                    </div>
                    <div className="text-white font-semibold">
                      {player.score || 0} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current round standings for round wins */}
        {isRoundWin && !isGameComplete && players.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white text-lg font-semibold mb-3 text-center">Scoreboard</h3>
            <div className="space-y-2">
              {players
                .sort((a, b) => (a.score || 0) - (b.score || 0)) // Sort by lowest score first
                .map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === winner.id 
                      ? 'bg-yellow-500/20 border border-yellow-400/50' 
                      : 'bg-white/10 border border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-400 text-black' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-orange-400 text-black' :
                      'bg-white/20 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{player.name}</span>
                    {player.id === winner.id && <span className="text-yellow-400 text-xs">Round Winner!</span>}
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-white font-semibold text-sm">
                        {player.score || 0} pts
                      </div>
                      {player.roundScore !== undefined && (
                        <div className="text-gray-300 text-xs">
                          +{player.roundScore} this round
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-400" />
                      <span className="text-white font-semibold text-sm">
                        {roundWinCounts[player.id] || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col space-y-3">
          {!isGameComplete && onContinue && (
            <button
              onClick={onContinue}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-400 hover:to-green-500 transition-all duration-200 shadow-lg"
            >
              Continue to Next Round
            </button>
          )}
          
          {isGameComplete && onNewGame && (
            <button
              onClick={onNewGame}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-400 hover:to-blue-500 transition-all duration-200 shadow-lg"
            >
              Play Again
            </button>
          )}
          
          {onLeaveLobby && (
            <button
              onClick={onLeaveLobby}
              className="w-full py-3 px-4 bg-white/20 border border-white/30 text-white font-medium rounded-lg hover:bg-white/30 transition-colors"
            >
              Back to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}