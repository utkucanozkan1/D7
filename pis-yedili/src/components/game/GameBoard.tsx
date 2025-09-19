'use client';

import React, { useState, useEffect } from 'react';
import { GameState, Player, Card as CardType, Suit } from '@/types/game';
import { Card, CardBack, CardSlot } from './Card';
import { PlayerHand } from './PlayerHand';
import { WinnerModal } from './WinnerModal';
import { getValidCards } from '@/utils/gameLogic';
import { Clock, RotateCcw, Users, MessageCircle, Zap } from 'lucide-react';
import { CSSParticleBackground } from '@/components/effects/ParticleBackground';

interface GameBoardProps {
  gameState: GameState;
  currentPlayerId: string;
  onCardPlay: (card: CardType) => void;
  onDrawCard: () => void;
  onChooseSuit: (suit: Suit) => void;
  onSayMau: () => void;
  onContinueToNextRound?: () => void;
  onNewGame?: () => void;
  onLeaveLobby?: () => void;
  showWinnerModal?: boolean;
  onCloseWinnerModal?: () => void;
}

export function GameBoard({
  gameState,
  currentPlayerId,
  onCardPlay,
  onDrawCard,
  onChooseSuit,
  onSayMau,
  onContinueToNextRound,
  onNewGame,
  onLeaveLobby,
  showWinnerModal = false,
  onCloseWinnerModal
}: GameBoardProps) {
  const [showSuitSelector, setShowSuitSelector] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string>('');
  const [showActionFeedback, setShowActionFeedback] = useState(false);
  const [gameAnnouncement, setGameAnnouncement] = useState<string>('');
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId;
  
  // Get valid cards that can be played
  const validCards = myPlayer 
    ? getValidCards(myPlayer.hand, gameState.topCard, gameState.wildSuit, gameState.drawCount, gameState.isFirstPlay)
    : [];
  const validCardIds = validCards.map(c => c.id);
  
  // Debug: Log validation state when top card changes
  React.useEffect(() => {
    if (gameState.topCard && myPlayer) {
      console.log('🎮 Current game state:', {
        topCard: `${gameState.topCard.rank} of ${gameState.topCard.suit}`,
        myHand: myPlayer.hand.map(c => `${c.rank} of ${c.suit}`),
        validCards: validCards.map(c => `${c.rank} of ${c.suit}`),
        validCardIds: validCardIds,
        wildSuit: gameState.wildSuit,
        drawCount: gameState.drawCount
      });
      
      // Check specifically for matching ranks
      const matchingRanks = myPlayer.hand.filter(c => c.rank === gameState.topCard?.rank);
      if (matchingRanks.length > 0) {
        console.log('⚠️ RANK MATCH CHECK:', {
          topCard: `${gameState.topCard.rank} of ${gameState.topCard.suit}`,
          yourMatchingCards: matchingRanks.map(c => `${c.rank} of ${c.suit}`),
          shouldBeValid: true,
          actuallyValid: matchingRanks.some(c => validCardIds.includes(c.id)),
          drawCount: gameState.drawCount,
          wildSuit: gameState.wildSuit
        });
      }
    }
  }, [gameState.topCard?.id, myPlayer?.hand]);

  // Arrange players around the table
  const arrangePlayersAroundTable = () => {
    const myIndex = gameState.players.findIndex(p => p.id === currentPlayerId);
    if (myIndex === -1) return {
      bottom: null,
      top: [],
      left: [],
      right: []
    };

    const playerCount = gameState.players.length;
    const positions = {
      bottom: null as Player | null,
      top: [] as Player[],
      left: [] as Player[],
      right: [] as Player[]
    };

    // Current player is always at the bottom
    positions.bottom = gameState.players[myIndex];

    if (playerCount === 2) {
      positions.top = [gameState.players[(myIndex + 1) % playerCount]];
    } else if (playerCount === 3) {
      positions.left = [gameState.players[(myIndex + 1) % playerCount]];
      positions.right = [gameState.players[(myIndex + 2) % playerCount]];
    } else if (playerCount === 4) {
      positions.top = [gameState.players[(myIndex + 2) % playerCount]];
      positions.left = [gameState.players[(myIndex + 1) % playerCount]];
      positions.right = [gameState.players[(myIndex + 3) % playerCount]];
    } else if (playerCount === 5) {
      positions.top = [
        gameState.players[(myIndex + 2) % playerCount],
        gameState.players[(myIndex + 3) % playerCount]
      ];
      positions.left = [gameState.players[(myIndex + 1) % playerCount]];
      positions.right = [gameState.players[(myIndex + 4) % playerCount]];
    } else if (playerCount === 6) {
      positions.top = [
        gameState.players[(myIndex + 2) % playerCount],
        gameState.players[(myIndex + 3) % playerCount],
        gameState.players[(myIndex + 4) % playerCount]
      ];
      positions.left = [gameState.players[(myIndex + 1) % playerCount]];
      positions.right = [gameState.players[(myIndex + 5) % playerCount]];
    }

    return positions;
  };

  const positions = arrangePlayersAroundTable();
  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const canPlayAnyCard = validCards.length > 0;


  const showFeedback = (message: string) => {
    setActionFeedback(message);
    setShowActionFeedback(true);
    setTimeout(() => setShowActionFeedback(false), 2000);
  };

  const handleCardPlay = (card: CardType) => {
    if (!isMyTurn) {
      showFeedback("It's not your turn!");
      return;
    }

    if (card.rank === 'J') {
      setSelectedCard(card);
      setShowSuitSelector(true);
      showFeedback('Choose a suit for your Jack!');
    } else {
      onCardPlay(card);
      showFeedback(`Played ${card.rank} of ${card.suit}!`);
    }
  };

  const handleSuitChoice = (suit: Suit) => {
    if (selectedCard) {
      onCardPlay(selectedCard);
      onChooseSuit(suit);
      showFeedback(`Jack played! Changed suit to ${suit}!`);
    }
    setShowSuitSelector(false);
    setSelectedCard(null);
  };

  const getTimeRemaining = () => {
    if (!gameState.turnStartTime) return gameState.turnTimeLimit;
    
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(gameState.turnStartTime).getTime()) / 1000);
    return Math.max(0, gameState.turnTimeLimit - elapsed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 relative overflow-hidden">
      <CSSParticleBackground />
      {/* Game table background */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
        <div className="w-[300px] h-[200px] sm:w-[500px] sm:h-[400px] md:w-[800px] md:h-[600px] game-table opacity-30" />
      </div>

      {/* Main game area */}
      <div className="relative z-10 min-h-screen flex flex-col p-2 sm:p-4">
        {/* Top players */}
        <div className="flex-shrink-0 p-1 sm:p-2 md:p-4 flex justify-center">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            {positions.top.map((player) => (
              <PlayerHand
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentTurnPlayer.id}
                position="top"
              />
            ))}
          </div>
        </div>

        {/* Middle section - Mobile-friendly layout */}
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0">
          {/* Left players - Responsive positioning */}
          <div className="flex md:flex-col justify-center items-center gap-2 md:gap-4 order-2 md:order-1">
            {positions.left.map((player) => (
              <PlayerHand
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentTurnPlayer.id}
                position={positions.left.length > 0 ? "left" : "top"}
              />
            ))}
          </div>

          {/* Central game area */}
          <div className="flex flex-col items-center justify-center space-y-4 md:space-y-8 order-1 md:order-2 flex-1">
            {/* Game status */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-4 border border-white/20 shadow-2xl w-full max-w-md">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-white text-xs sm:text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className={`w-5 h-5 ${getTimeRemaining() < 10 ? 'text-red-400 animate-pulse' : ''}`} />
                  <span className={`font-mono text-lg ${getTimeRemaining() < 10 ? 'text-red-400 font-bold' : ''}`}>
                    {String(Math.floor(getTimeRemaining() / 60)).padStart(2, '0')}:
                    {String(getTimeRemaining() % 60).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-300" />
                  <span>{gameState.players.length} players</span>
                </div>

                {gameState.direction === 'counterclockwise' && (
                  <div className="flex items-center space-x-2 animate-bounce">
                    <RotateCcw className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-300 font-semibold">Reversed</span>
                  </div>
                )}

                {gameState.drawCount > 0 && (
                  <div className="bg-red-500/30 px-3 py-1 rounded-full border border-red-400/50 animate-pulse shadow-lg">
                    <span className="text-red-200 font-bold">Draw +{gameState.drawCount}</span>
                  </div>
                )}

                {gameState.wildSuit && (
                  <div className="bg-purple-500/30 px-3 py-1 rounded-full border border-purple-400/50 shadow-lg">
                    <span className="text-purple-200 font-semibold">Wild: {gameState.wildSuit}</span>
                  </div>
                )}

                {gameState.isFirstPlay && (
                  <div className="bg-green-500/30 px-3 py-1 rounded-full border border-green-400/50 animate-pulse">
                    <span className="text-green-200 font-semibold">First Play: Clubs Only</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card play area - Mobile responsive */}
            <div className="flex items-start justify-center gap-4 sm:gap-8 md:gap-12 h-32 sm:h-36 md:h-40 w-full">
              {/* Deck */}
              <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px] md:min-w-[100px]">
                <div className="h-24 sm:h-32 md:h-36 flex items-center justify-center mb-2 sm:mb-3">
                  <CardBack
                    size="large"
                    onClick={isMyTurn ? onDrawCard : undefined}
                    className={`${
                      isMyTurn
                        ? 'ring-2 ring-yellow-400 ring-opacity-60 cursor-pointer hover:ring-yellow-300'
                        : ''
                    }`}
                  />
                </div>
                <div className="text-center">
                  <span className="text-white text-xs sm:text-sm font-medium">
                    {gameState.deck.length} cards
                  </span>
                  {isMyTurn && (
                    <div className="text-yellow-300 text-xs animate-pulse mt-1 hidden sm:block">
                      {gameState.drawCount > 0
                        ? `Draw +${gameState.drawCount}`
                        : canPlayAnyCard
                          ? 'Strategic'
                          : 'Draw'
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Discard pile */}
              <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px] md:min-w-[100px]">
                <div className="h-24 sm:h-32 md:h-36 flex items-center justify-center mb-2 sm:mb-3">
                  {gameState.topCard ? (
                    <Card
                      card={gameState.topCard}
                      size="large"
                      isHighlighted={isMyTurn}
                    />
                  ) : (
                    <CardSlot size="large">
                      <span className="text-xs">Empty</span>
                    </CardSlot>
                  )}
                </div>
                <span className="text-white text-xs sm:text-sm font-medium text-center">Discard</span>
              </div>
            </div>

            {/* Action buttons - Mobile responsive */}
            <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[48px] sm:min-h-[56px] items-center justify-center mt-4 sm:mt-8 md:mt-15 px-2">
              {isMyTurn && (
                <>
                  {myPlayer?.hand.length === 2 && !myPlayer?.saidTek && (
                    <button
                      onClick={() => {
                        onSayMau();
                        showFeedback('Called Tek!');
                      }}
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold py-3 px-4 sm:py-3 sm:px-6 text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-yellow-300 hover:to-yellow-500 transition-all duration-300 shadow-2xl transform hover:scale-105 celebration animate-pulse min-h-[44px] touch-manipulation"
                    >
                      🗣️ Say Tek!
                    </button>
                  )}

                  {myPlayer?.hand.length === 2 && myPlayer?.saidTek && (
                    <div className="bg-green-500/20 px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-green-400/50 animate-pulse">
                      <span className="text-green-200 font-semibold text-sm sm:text-base">✅ TEK Declared!</span>
                    </div>
                  )}

                  {!canPlayAnyCard && (
                    <button
                      onClick={() => {
                        onDrawCard();
                        showFeedback(gameState.drawCount > 0 ? `Drew +${gameState.drawCount} cards!` : 'Drew a card!');
                      }}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 px-4 sm:px-6 text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-blue-400 hover:to-blue-500 transition-all duration-300 shadow-2xl transform hover:scale-105 min-h-[44px] touch-manipulation"
                    >
                      🃏 {gameState.drawCount > 0 ? `Draw +${gameState.drawCount}` : 'Draw Card'}
                    </button>
                  )}

                  {canPlayAnyCard && gameState.drawCount === 0 && (
                    <button
                      onClick={() => {
                        onDrawCard();
                        showFeedback('Strategic draw!');
                      }}
                      className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-3 px-4 sm:px-6 text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-purple-400 hover:to-purple-500 transition-all duration-300 shadow-2xl transform hover:scale-105 opacity-80 min-h-[44px] touch-manipulation"
                    >
                      🎯 Strategic Draw
                    </button>
                  )}
                </>
              )}

            </div>
          </div>

          {/* Right players - Responsive positioning */}
          <div className="flex md:flex-col justify-center items-center gap-2 md:gap-4 order-3 md:order-3">
            {positions.right.map((player) => (
              <PlayerHand
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentTurnPlayer.id}
                position={positions.right.length > 0 ? "right" : "top"}
              />
            ))}
          </div>
        </div>

        {/* Bottom player (current user) */}
        <div className="flex-shrink-0 p-2 sm:p-4 flex justify-center">
          {positions.bottom && (
            <PlayerHand
              player={positions.bottom}
              isCurrentPlayer={positions.bottom.id === currentTurnPlayer.id}
              isMyHand={true}
              validCards={validCardIds}
              onCardPlay={handleCardPlay}
              position="bottom"
            />
          )}
        </div>

        {/* Turn indicator - Mobile responsive */}
        {!isMyTurn && currentTurnPlayer && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/20 z-40">
            <div className="text-white text-xs sm:text-sm">
              <div className="font-medium truncate max-w-[120px] sm:max-w-none">{currentTurnPlayer.name}'s turn</div>
              <div className="text-blue-200 text-xs">Waiting...</div>
            </div>
          </div>
        )}

        {/* Action Feedback - Mobile responsive */}
        {showActionFeedback && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 px-4">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 sm:px-6 rounded-lg sm:rounded-xl shadow-2xl border border-white/20 backdrop-blur-sm max-w-[280px] sm:max-w-none">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                <span className="font-semibold text-sm sm:text-base truncate">{actionFeedback}</span>
              </div>
            </div>
          </div>
        )}

        {/* Suit selector modal - Mobile responsive */}
        {showSuitSelector && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20 w-full max-w-xs sm:max-w-md">
              <h3 className="text-white text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6">Choose a suit</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map((suit) => {
                  const suitInfo = {
                    hearts: { color: 'text-red-500', symbol: '♥️', name: 'Hearts' },
                    diamonds: { color: 'text-red-500', symbol: '♦️', name: 'Diamonds' },
                    clubs: { color: 'text-black', symbol: '♣️', name: 'Clubs' },
                    spades: { color: 'text-black', symbol: '♠️', name: 'Spades' }
                  }[suit];
                  
                  return (
                    <button
                      key={suit}
                      onClick={() => handleSuitChoice(suit)}
                      className="bg-white hover:bg-gray-100 p-3 sm:p-4 rounded-lg sm:rounded-xl transition-colors flex flex-col items-center space-y-1 sm:space-y-2 min-h-[80px] sm:min-h-[100px] touch-manipulation"
                    >
                      <div className={`text-2xl sm:text-4xl ${suitInfo.color}`}>
                        {suitInfo.symbol}
                      </div>
                      <div className="text-gray-800 font-medium text-xs sm:text-sm">
                        {suitInfo.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Winner Modal */}
        {showWinnerModal && gameState.winner && (
          <WinnerModal
            winner={gameState.players.find(p => p.id === gameState.winner)!}
            isRoundWin={!gameState.isGameComplete}
            isGameComplete={gameState.isGameComplete}
            currentRound={gameState.currentRound}
            maxRounds={gameState.maxRounds}
            roundWinners={gameState.roundWinners}
            players={gameState.players}
            onContinue={onContinueToNextRound}
            onNewGame={onNewGame}
            onLeaveLobby={onLeaveLobby}
          />
        )}
      </div>
    </div>
  );
}