'use client';

import React, { useState } from 'react';
import { GameState, Player, Card as CardType, Suit } from '@/types/game';
import { Card, CardBack, CardSlot } from './Card';
import { PlayerHand } from './PlayerHand';
import { WinnerModal } from './WinnerModal';
import { getValidCards } from '@/utils/gameLogic';
import { Clock, RotateCcw, Users, MessageCircle } from 'lucide-react';

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
    if (myIndex === -1) return { bottom: null, top: null, left: null, right: null };

    const playerCount = gameState.players.length;
    const positions = { bottom: null as Player | null, top: null as Player | null, left: null as Player | null, right: null as Player | null };

    // Current player is always at the bottom
    positions.bottom = gameState.players[myIndex];

    if (playerCount === 2) {
      positions.top = gameState.players[(myIndex + 1) % playerCount];
    } else if (playerCount === 3) {
      positions.left = gameState.players[(myIndex + 1) % playerCount];
      positions.right = gameState.players[(myIndex + 2) % playerCount];
    } else if (playerCount >= 4) {
      positions.top = gameState.players[(myIndex + 2) % playerCount];
      positions.left = gameState.players[(myIndex + 1) % playerCount];
      positions.right = gameState.players[(myIndex + 3) % playerCount];
    }

    return positions;
  };

  const positions = arrangePlayersAroundTable();
  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const canPlayAnyCard = validCards.length > 0;


  const handleCardPlay = (card: CardType) => {
    if (!isMyTurn) return;
    
    if (card.rank === 'J') {
      setSelectedCard(card);
      setShowSuitSelector(true);
    } else {
      onCardPlay(card);
    }
  };

  const handleSuitChoice = (suit: Suit) => {
    if (selectedCard) {
      onCardPlay(selectedCard);
      onChooseSuit(suit);
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
      {/* Game table background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[800px] h-[600px] game-table opacity-20" />
      </div>

      {/* Main game area */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Top player */}
        <div className="flex-shrink-0 p-4 flex justify-center">
          {positions.top && (
            <PlayerHand
              player={positions.top}
              isCurrentPlayer={positions.top.id === currentTurnPlayer.id}
              position="top"
            />
          )}
        </div>

        {/* Middle section with left player, game area, and right player */}
        <div className="flex-1 flex items-center">
          {/* Left player */}
          <div className="flex-shrink-0 p-4">
            {positions.left && (
              <PlayerHand
                player={positions.left}
                isCurrentPlayer={positions.left.id === currentTurnPlayer.id}
                position="left"
              />
            )}
          </div>

          {/* Central game area */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
            {/* Game status */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-center space-x-6 text-white">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-mono text-lg">
                    {String(Math.floor(getTimeRemaining() / 60)).padStart(2, '0')}:
                    {String(getTimeRemaining() % 60).padStart(2, '0')}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>{gameState.players.length} players</span>
                </div>

                {gameState.direction === 'counterclockwise' && (
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-5 h-5" />
                    <span>Reversed</span>
                  </div>
                )}

                {gameState.drawCount > 0 && (
                  <div className="bg-red-500/20 px-3 py-1 rounded-full border border-red-400/50">
                    <span className="text-red-200 font-semibold">Draw +{gameState.drawCount}</span>
                  </div>
                )}

                {gameState.wildSuit && (
                  <div className="bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/50">
                    <span className="text-purple-200">Wild: {gameState.wildSuit}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card play area */}
            <div className="flex items-center space-x-8">
              {/* Deck */}
              <div className="flex flex-col items-center space-y-2">
                <CardBack 
                  size="large"
                  onClick={isMyTurn ? onDrawCard : undefined}
                  className={`${
                    isMyTurn
                      ? 'ring-2 ring-yellow-400 ring-opacity-60 cursor-pointer hover:ring-yellow-300' 
                      : ''
                  }`}
                />
                <span className="text-white text-sm">
                  {gameState.deck.length} cards
                </span>
                {isMyTurn && (
                  <div className="text-yellow-300 text-xs animate-pulse">
                    {gameState.drawCount > 0 
                      ? `Click to draw +${gameState.drawCount}` 
                      : canPlayAnyCard 
                        ? 'Click to draw (strategic)'
                        : 'Click to draw'
                    }
                  </div>
                )}
              </div>

              {/* Discard pile */}
              <div className="flex flex-col items-center space-y-2">
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
                <span className="text-white text-sm">Discard</span>
              </div>
            </div>

            {/* Action buttons */}
            {isMyTurn && (
              <div className="flex space-x-3">
                {myPlayer?.hand.length === 1 && (
                  <button
                    onClick={onSayMau}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-2 px-4 rounded-lg hover:from-yellow-300 hover:to-yellow-500 transition-all duration-200 shadow-lg"
                  >
                    Say Tek!
                  </button>
                )}
                
                {!canPlayAnyCard && (
                  <button
                    onClick={onDrawCard}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-400 hover:to-blue-500 transition-all duration-200 shadow-lg"
                  >
                    {gameState.drawCount > 0 ? `Draw +${gameState.drawCount}` : 'Draw Card'}
                  </button>
                )}
                
                {canPlayAnyCard && gameState.drawCount === 0 && (
                  <button
                    onClick={onDrawCard}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-400 hover:to-purple-500 transition-all duration-200 shadow-lg opacity-80"
                  >
                    Strategic Draw
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right player */}
          <div className="flex-shrink-0 p-4">
            {positions.right && (
              <PlayerHand
                player={positions.right}
                isCurrentPlayer={positions.right.id === currentTurnPlayer.id}
                position="right"
              />
            )}
          </div>
        </div>

        {/* Bottom player (current user) */}
        <div className="flex-shrink-0 p-4 flex justify-center">
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

        {/* Turn indicator */}
        {!isMyTurn && currentTurnPlayer && (
          <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <div className="text-white text-sm">
              <div className="font-medium">{currentTurnPlayer.name}'s turn</div>
              <div className="text-blue-200 text-xs">Waiting...</div>
            </div>
          </div>
        )}

        {/* Suit selector modal */}
        {showSuitSelector && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-white text-xl font-semibold text-center mb-6">Choose a suit</h3>
              <div className="grid grid-cols-2 gap-4">
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
                      className="bg-white hover:bg-gray-100 p-4 rounded-xl transition-colors flex flex-col items-center space-y-2"
                    >
                      <div className={`text-4xl ${suitInfo.color}`}>
                        {suitInfo.symbol}
                      </div>
                      <div className="text-gray-800 font-medium">
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