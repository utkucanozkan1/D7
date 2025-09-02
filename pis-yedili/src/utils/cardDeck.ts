import { Card, Suit, Rank } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';

// Standard 52-card deck suits and ranks
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a standard 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: uuidv4()
      });
    }
  }
  
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm for randomizing card order
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]; // Create a copy to avoid mutating original
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Deal cards from the deck to players
 */
export function dealCards(
  deck: Card[], 
  playerCount: number, 
  cardsPerPlayer: number = 7
): { hands: Card[][], remainingDeck: Card[] } {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let deckIndex = 0;
  
  // Deal cards in round-robin fashion
  for (let cardNum = 0; cardNum < cardsPerPlayer; cardNum++) {
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
      if (deckIndex < deck.length) {
        hands[playerIndex].push(deck[deckIndex]);
        deckIndex++;
      }
    }
  }
  
  // Return remaining deck (excluding dealt cards)
  const remainingDeck = deck.slice(deckIndex);
  
  return { hands, remainingDeck };
}

/**
 * Draw cards from the deck
 */
export function drawCards(deck: Card[], count: number): { drawnCards: Card[], remainingDeck: Card[] } {
  if (count > deck.length) {
    // If we need more cards than available, return all remaining cards
    return {
      drawnCards: [...deck],
      remainingDeck: []
    };
  }
  
  const drawnCards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  
  return { drawnCards, remainingDeck };
}

/**
 * Get the top card from the deck (for starting the discard pile)
 */
export function getTopCard(deck: Card[]): { topCard: Card | null, remainingDeck: Card[] } {
  if (deck.length === 0) {
    return { topCard: null, remainingDeck: [] };
  }
  
  return {
    topCard: deck[0],
    remainingDeck: deck.slice(1)
  };
}

/**
 * Reshuffle the discard pile back into the deck (keeping the top card)
 */
export function reshuffleDiscardPile(discardPile: Card[]): { newDeck: Card[], topCard: Card | null } {
  if (discardPile.length <= 1) {
    return { newDeck: [], topCard: discardPile[0] || null };
  }
  
  // Keep the top card, shuffle the rest back into deck
  const topCard = discardPile[discardPile.length - 1];
  const cardsToShuffle = discardPile.slice(0, -1);
  const newDeck = shuffleDeck(cardsToShuffle);
  
  return { newDeck, topCard };
}

/**
 * Sort a hand of cards for better display
 */
export function sortHand(hand: Card[]): Card[] {
  const suitOrder: { [key in Suit]: number } = {
    'spades': 0,
    'hearts': 1,
    'diamonds': 2,
    'clubs': 3
  };
  
  const rankOrder: { [key in Rank]: number } = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };
  
  return [...hand].sort((a, b) => {
    // First sort by suit
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;
    
    // Then sort by rank within the same suit
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}

/**
 * Get card display information
 */
export function getCardDisplay(card: Card): { color: 'red' | 'black', symbol: string, unicodeSymbol: string } {
  const suitInfo = {
    hearts: { color: 'red' as const, symbol: '♥', unicodeSymbol: '♥️' },
    diamonds: { color: 'red' as const, symbol: '♦', unicodeSymbol: '♦️' },
    clubs: { color: 'black' as const, symbol: '♣', unicodeSymbol: '♣️' },
    spades: { color: 'black' as const, symbol: '♠', unicodeSymbol: '♠️' }
  };
  
  return suitInfo[card.suit];
}

/**
 * Check if a card is a special card (has special effects in Mau Mau)
 */
export function isSpecialCard(card: Card): boolean {
  const specialRanks: Rank[] = ['7', '8', 'J', 'A'];
  return specialRanks.includes(card.rank);
}

/**
 * Get the numeric value of a card for scoring
 */
export function getCardValue(card: Card): number {
  const values: { [key in Rank]: number } = {
    'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 2, 'Q': 3, 'K': 4
  };
  
  return values[card.rank];
}

/**
 * Calculate the total value of a hand (for penalty scoring)
 */
export function calculateHandValue(hand: Card[]): number {
  return hand.reduce((total, card) => total + getCardValue(card), 0);
}

/**
 * Find a card in a hand by its ID
 */
export function findCardInHand(hand: Card[], cardId: string): { card: Card | null, index: number } {
  const index = hand.findIndex(card => card.id === cardId);
  return {
    card: index !== -1 ? hand[index] : null,
    index: index !== -1 ? index : -1
  };
}

/**
 * Remove a card from a hand by its ID
 */
export function removeCardFromHand(hand: Card[], cardId: string): { newHand: Card[], removedCard: Card | null } {
  const { card, index } = findCardInHand(hand, cardId);
  
  if (index === -1) {
    return { newHand: hand, removedCard: null };
  }
  
  const newHand = [...hand];
  newHand.splice(index, 1);
  
  return { newHand, removedCard: card };
}