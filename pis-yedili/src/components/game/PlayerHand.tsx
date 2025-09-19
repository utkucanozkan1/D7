'use client';

import { Card as CardComponent } from './Card';
import { Card as CardType, Player } from '@/types/game';
import { sortHand } from '@/utils/cardDeck';
import { Users } from 'lucide-react';

interface PlayerHandProps {
  player: Player;
  isCurrentPlayer?: boolean;
  isMyHand?: boolean;
  validCards?: string[]; // Card IDs that can be played
  onCardPlay?: (card: CardType) => void;
  position: 'bottom' | 'top' | 'left' | 'right';
  showCardCount?: boolean;
}

export function PlayerHand({
  player,
  isCurrentPlayer = false,
  isMyHand = false,
  validCards = [],
  onCardPlay,
  position,
  showCardCount = true
}: PlayerHandProps) {
  const sortedHand = isMyHand ? sortHand(player.hand) : player.hand;
  
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'flex-row justify-center';
      case 'left':
        return 'flex-col items-center';
      case 'right':
        return 'flex-col items-center';
      default: // bottom
        return 'flex-row justify-center';
    }
  };

  const getCardSpacing = () => {
    const cardCount = player.hand.length;
    if (cardCount <= 5) return 'space-x-2';
    if (cardCount <= 10) return 'space-x-1';
    return '-space-x-2'; // Overlap cards when many
  };

  const handleCardClick = (card: CardType) => {
    if (isMyHand && onCardPlay && validCards.includes(card.id)) {
      onCardPlay(card);
    }
  };

  const renderPlayerInfo = () => (
    <div className={`flex items-center ${
      position === 'left' || position === 'right' ? 'flex-col space-y-1' : 'space-x-2'
    } ${
      position === 'left' || position === 'right' ? '' : 'mb-2'
    } ${
      isCurrentPlayer ? 'text-yellow-400' : 'text-white'
    } ${
      isCurrentPlayer ? 'turn-indicator' : ''
    } transition-all duration-300`}>
      <div className="relative">
        <Users className={`w-4 h-4 ${isCurrentPlayer ? 'text-yellow-400' : 'text-blue-300'}`} />
        {isCurrentPlayer && (
          <div className="absolute -inset-1 bg-yellow-400 rounded-full animate-ping opacity-75" />
        )}
      </div>
      <span className={`font-medium ${isCurrentPlayer ? 'font-bold text-lg' : ''} transition-all duration-300`}>
        {player.name}
      </span>
      {showCardCount && !isMyHand && (
        <span className="text-sm opacity-75">({player.handCount} cards)</span>
      )}
      {!player.isConnected && (
        <span className="text-red-400 text-xs animate-pulse">(Disconnected)</span>
      )}
      {isCurrentPlayer && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <span className="text-xs font-bold">YOUR TURN</span>
        </div>
      )}
    </div>
  );

  const renderCards = () => {
    if (!isMyHand) {
      // Show face-down cards for other players with overlapping for many cards
      const maxVisibleCards = 5;
      const visibleCardCount = Math.min(player.handCount, maxVisibleCards);

      return (
        <div className="flex -space-x-3">
          {Array.from({ length: visibleCardCount }).map((_, index) => (
            <CardComponent
              key={`${player.id}-card-${index}`}
              card={{ id: `hidden-${index}`, suit: 'spades', rank: 'A' }}
              faceDown={true}
              size="small"
              className="transform hover:scale-105"
              style={{ zIndex: index }}
            />
          ))}
          {player.handCount > maxVisibleCards && (
            <div className="flex items-center justify-center w-8 h-12 bg-gray-800/80 rounded text-white text-xs font-bold ml-1 border border-gray-600">
              +{player.handCount - maxVisibleCards}
            </div>
          )}
        </div>
      );
    }

    // Show actual cards for player's own hand
    return (
      <div className={`flex ${getCardSpacing()} items-end`}>
        {sortedHand.map((card, index) => {
          const isPlayable = validCards.includes(card.id);
          const isHighlighted = isCurrentPlayer && isPlayable;
          
          return (
            <div
              key={card.id}
              className="relative"
              style={{ zIndex: sortedHand.length - index }}
            >
              <CardComponent
                card={card}
                onClick={() => handleCardClick(card)}
                isPlayable={isPlayable}
                isHighlighted={isHighlighted}
                disabled={!isCurrentPlayer}
                className={`
                  transform transition-all duration-200
                  ${isHighlighted ? 'hover:scale-110 hover:-translate-y-2' : 'hover:scale-105'}
                  ${isPlayable ? 'cursor-pointer' : ''}
                `}
              />
              {isPlayable && isCurrentPlayer && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (position === 'bottom') {
    return (
      <div className="flex flex-col items-center space-y-2">
        {renderPlayerInfo()}
        {renderCards()}
        {isMyHand && showCardCount && (
          <div className="text-sm text-blue-200">
            {player.hand.length} card{player.hand.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  if (position === 'top') {
    return (
      <div className="flex flex-col items-center space-y-2">
        {renderCards()}
        {renderPlayerInfo()}
      </div>
    );
  }

  if (position === 'left') {
    return (
      <div className="flex flex-col items-center space-y-1 -rotate-90">
        {/* Cards first, then name (name appears toward center after rotation) */}
        {renderCards()}
        <div className="rotate-180">
          {renderPlayerInfo()}
        </div>
      </div>
    );
  }

  if (position === 'right') {
    return (
      <div className="flex flex-col items-center space-y-1 rotate-90">
        {/* Cards first, then name (name appears toward center after rotation) */}
        {renderCards()}
        <div className="rotate-180">
          {renderPlayerInfo()}
        </div>
      </div>
    );
  }

  return null;
}

// Mini version for game status display
export function MiniPlayerHand({ 
  player, 
  isCurrentPlayer = false,
  className = '' 
}: { 
  player: Player; 
  isCurrentPlayer?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center space-x-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm ${
      isCurrentPlayer ? 'ring-2 ring-yellow-400' : ''
    } ${className}`}>
      <div className={`w-3 h-3 rounded-full ${
        player.isConnected ? 'bg-green-400' : 'bg-red-400'
      }`} />
      <span className="text-white font-medium text-sm">{player.name}</span>
      <div className="flex items-center space-x-1">
        {Array.from({ length: Math.min(player.handCount, 5) }).map((_, i) => (
          <div key={i} className="w-2 h-3 bg-blue-600 rounded-sm" />
        ))}
        {player.handCount > 5 && (
          <span className="text-xs text-blue-200">+{player.handCount - 5}</span>
        )}
      </div>
      {isCurrentPlayer && (
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}