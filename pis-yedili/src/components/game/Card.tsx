'use client';

import { Card as CardType, Suit, Rank } from '@/types/game';
import { getCardDisplay } from '@/utils/cardDeck';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isPlayable?: boolean;
  isHighlighted?: boolean;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Card({
  card,
  onClick,
  isPlayable = false,
  isHighlighted = false,
  size = 'medium',
  faceDown = false,
  disabled = false,
  className = ''
}: CardProps) {
  const { color, symbol } = getCardDisplay(card);
  
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-12 h-16 text-xs';
      case 'large':
        return 'w-20 h-28 text-lg';
      default:
        return 'w-16 h-24 text-sm';
    }
  };

  const getColorClasses = () => {
    if (faceDown) return 'text-blue-600';
    return color === 'red' ? 'text-red-500' : 'text-black';
  };

  const baseClasses = `
    ${getSizeClasses()}
    ${getColorClasses()}
    bg-white rounded-lg border-2 border-gray-300
    flex flex-col justify-between
    font-bold select-none
    transition-all duration-200
    shadow-md
    ${className}
  `;

  const interactionClasses = `
    ${onClick && !disabled ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
    ${isPlayable ? 'ring-2 ring-green-400 ring-opacity-60' : ''}
    ${isHighlighted ? 'ring-2 ring-yellow-400 ring-opacity-80 shadow-lg' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  const handleClick = () => {
    if (onClick && !disabled) {
      onClick();
    }
  };

  if (faceDown) {
    return (
      <div 
        className={`${baseClasses} ${interactionClasses} bg-gradient-to-br from-blue-600 to-blue-800`}
        onClick={handleClick}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white rounded-full opacity-60" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${interactionClasses}`}
      onClick={handleClick}
    >
      {/* Top left corner */}
      <div className="p-1 leading-none">
        <div>{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>

      {/* Center symbol */}
      <div className="flex-1 flex items-center justify-center">
        <div className={`${size === 'large' ? 'text-3xl' : size === 'small' ? 'text-lg' : 'text-2xl'}`}>
          {symbol}
        </div>
      </div>

      {/* Bottom right corner (rotated) */}
      <div className="p-1 leading-none rotate-180 self-end">
        <div>{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>
    </div>
  );
}

// Card back component for deck
export function CardBack({ 
  size = 'medium', 
  onClick,
  className = '' 
}: { 
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
}) {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-12 h-16';
      case 'large':
        return 'w-20 h-28';
      default:
        return 'w-16 h-24';
    }
  };

  return (
    <div 
      className={`
        ${getSizeClasses()}
        bg-gradient-to-br from-blue-600 to-blue-800
        rounded-lg border-2 border-blue-700
        flex items-center justify-center
        font-bold select-none
        transition-all duration-200
        shadow-md
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="w-8 h-8 border-2 border-white rounded-full opacity-60" />
    </div>
  );
}

// Empty slot component
export function CardSlot({ 
  size = 'medium', 
  className = '',
  children 
}: { 
  size?: 'small' | 'medium' | 'large';
  className?: string;
  children?: React.ReactNode;
}) {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-12 h-16';
      case 'large':
        return 'w-20 h-28';
      default:
        return 'w-16 h-24';
    }
  };

  return (
    <div 
      className={`
        ${getSizeClasses()}
        border-2 border-dashed border-gray-400
        rounded-lg
        flex items-center justify-center
        text-gray-400
        ${className}
      `}
    >
      {children}
    </div>
  );
}