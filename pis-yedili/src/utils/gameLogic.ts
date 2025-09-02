import { Card, GameState, Player, Suit, Rank, GameMove, defaultGameRules, GameDirection } from '@/types/game';
import { 
  createDeck, 
  shuffleDeck, 
  dealCards, 
  drawCards, 
  getTopCard, 
  reshuffleDiscardPile,
  removeCardFromHand,
  findCardInHand
} from './cardDeck';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initialize a new game state
 */
export function initializeGame(roomId: string, players: Player[]): GameState {
  // Create and shuffle a new deck
  const deck = shuffleDeck(createDeck());
  
  // Deal cards to players
  const { hands, remainingDeck } = dealCards(deck, players.length, defaultGameRules.initialHandSize);
  
  // Set up player hands
  const gamePlayers = players.map((player, index) => ({
    ...player,
    hand: hands[index],
    handCount: hands[index].length,
    isReady: true, // All players are ready when game starts
    position: index
  }));
  
  // Get the starting card for discard pile
  const { topCard, remainingDeck: finalDeck } = getTopCard(remainingDeck);
  
  // If the starting card is a special card, reshuffle
  let startingCard = topCard;
  let gameDeck = finalDeck;
  
  if (startingCard && isSpecialCardForStart(startingCard)) {
    // Put the special card back and reshuffle
    const reshuffledDeck = shuffleDeck([...finalDeck, startingCard]);
    const result = getTopCard(reshuffledDeck);
    startingCard = result.topCard;
    gameDeck = result.remainingDeck;
  }
  
  const gameState: GameState = {
    id: uuidv4(),
    roomId,
    players: gamePlayers,
    currentPlayerIndex: 0,
    direction: 'clockwise',
    status: 'playing',
    deck: gameDeck,
    discardPile: startingCard ? [startingCard] : [],
    topCard: startingCard,
    drawCount: 0,
    skipNext: false,
    wildSuit: null,
    startedAt: new Date(),
    finishedAt: null,
    winner: null,
    turnStartTime: new Date(),
    turnTimeLimit: defaultGameRules.turnTimeLimit
  };
  
  return gameState;
}

/**
 * Check if a card is a special card that shouldn't start the game
 */
function isSpecialCardForStart(card: Card): boolean {
  return ['7', '8', 'J'].includes(card.rank);
}

/**
 * Validate if a card can be played on top of the current card
 */
export function canPlayCard(cardToPlay: Card, topCard: Card | null, wildSuit: Suit | null): boolean {
  if (!topCard) {
    return true; // Can play any card if no top card
  }
  
  // If there's a wild suit chosen (from Jack), must match that suit
  if (wildSuit) {
    return cardToPlay.suit === wildSuit || cardToPlay.rank === 'J';
  }
  
  // Normal matching: same suit or same rank
  return cardToPlay.suit === topCard.suit || cardToPlay.rank === topCard.rank;
}

/**
 * Validate a player's move
 */
export function validateMove(gameState: GameState, move: GameMove): { valid: boolean; reason?: string } {
  const { players, currentPlayerIndex, topCard, wildSuit, drawCount, skipNext } = gameState;
  const currentPlayer = players[currentPlayerIndex];
  
  // Check if it's the player's turn
  if (move.playerId !== currentPlayer.id) {
    return { valid: false, reason: 'Not your turn' };
  }
  
  switch (move.type) {
    case 'PLAY_CARD':
      if (!move.card) {
        return { valid: false, reason: 'No card specified' };
      }
      
      // Check if player has the card
      const { card } = findCardInHand(currentPlayer.hand, move.card.id);
      if (!card) {
        return { valid: false, reason: 'You do not have this card' };
      }
      
      // If there are accumulated draw cards, player must draw or play a 7
      if (drawCount > 0 && move.card.rank !== '7') {
        return { valid: false, reason: 'You must play a 7 or draw cards' };
      }
      
      // Check if card can be played
      if (!canPlayCard(move.card, topCard, wildSuit)) {
        return { valid: false, reason: 'Card cannot be played on current card' };
      }
      
      return { valid: true };
    
    case 'DRAW_CARD':
      // Can't draw if there are forced draws pending and player has a 7
      if (drawCount > 0) {
        const hasSeven = currentPlayer.hand.some(card => card.rank === '7');
        if (hasSeven) {
          return { valid: false, reason: 'You must play a 7 or draw the accumulated cards' };
        }
      }
      
      return { valid: true };
    
    case 'CHOOSE_SUIT':
      if (!move.suit) {
        return { valid: false, reason: 'No suit specified' };
      }
      
      // Can only choose suit after playing a Jack
      if (!wildSuit && topCard?.rank !== 'J') {
        return { valid: false, reason: 'Can only choose suit after playing a Jack' };
      }
      
      return { valid: true };
    
    case 'SAY_MAU':
      // Can say Mau when player has exactly 2 cards (after playing one, will have 1)
      if (currentPlayer.hand.length !== 2) {
        return { valid: false, reason: 'Can only say Mau when you have 2 cards' };
      }
      
      return { valid: true };
    
    default:
      return { valid: false, reason: 'Invalid move type' };
  }
}

/**
 * Apply a move to the game state
 */
export function applyMove(gameState: GameState, move: GameMove): GameState {
  const validation = validateMove(gameState, move);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  
  let newGameState = { ...gameState };
  const currentPlayer = newGameState.players[newGameState.currentPlayerIndex];
  
  switch (move.type) {
    case 'PLAY_CARD':
      newGameState = handlePlayCard(newGameState, move.card!);
      break;
    
    case 'DRAW_CARD':
      newGameState = handleDrawCard(newGameState);
      break;
    
    case 'CHOOSE_SUIT':
      newGameState = handleChooseSuit(newGameState, move.suit!);
      break;
    
    case 'SAY_MAU':
      // Mau declaration is handled in UI feedback, no state change needed
      break;
  }
  
  // Check for win condition
  if (currentPlayer.hand.length === 0) {
    newGameState.status = 'finished';
    newGameState.winner = currentPlayer.id;
    newGameState.finishedAt = new Date();
  }
  
  return newGameState;
}

/**
 * Handle playing a card
 */
function handlePlayCard(gameState: GameState, cardToPlay: Card): GameState {
  const newState = { ...gameState };
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  
  // Remove card from player's hand
  const { newHand } = removeCardFromHand(currentPlayer.hand, cardToPlay.id);
  currentPlayer.hand = newHand;
  currentPlayer.handCount = newHand.length;
  
  // Add card to discard pile
  newState.discardPile = [...newState.discardPile, cardToPlay];
  newState.topCard = cardToPlay;
  
  // Handle special card effects
  newState = handleSpecialCardEffect(newState, cardToPlay);
  
  // Clear wild suit if not a Jack
  if (cardToPlay.rank !== 'J') {
    newState.wildSuit = null;
  }
  
  // Move to next turn (unless skipped by special card)
  if (!newState.skipNext) {
    newState.currentPlayerIndex = getNextPlayerIndex(newState);
  } else {
    // Skip one player
    newState.currentPlayerIndex = getNextPlayerIndex(newState);
    newState.currentPlayerIndex = getNextPlayerIndex(newState);
    newState.skipNext = false;
  }
  
  newState.turnStartTime = new Date();
  
  return newState;
}

/**
 * Handle drawing cards
 */
function handleDrawCard(gameState: GameState): GameState {
  const newState = { ...gameState };
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  
  // Determine how many cards to draw
  let cardsToDraw = newState.drawCount > 0 ? newState.drawCount : 1;
  
  // Check if deck needs reshuffling
  if (newState.deck.length < cardsToDraw) {
    const { newDeck, topCard } = reshuffleDiscardPile(newState.discardPile);
    newState.deck = [...newState.deck, ...newDeck];
    newState.discardPile = topCard ? [topCard] : [];
    newState.topCard = topCard;
  }
  
  // Draw the cards
  const { drawnCards, remainingDeck } = drawCards(newState.deck, cardsToDraw);
  newState.deck = remainingDeck;
  
  // Add drawn cards to player's hand
  currentPlayer.hand = [...currentPlayer.hand, ...drawnCards];
  currentPlayer.handCount = currentPlayer.hand.length;
  
  // Reset draw count
  newState.drawCount = 0;
  
  // Move to next player
  newState.currentPlayerIndex = getNextPlayerIndex(newState);
  newState.turnStartTime = new Date();
  
  return newState;
}

/**
 * Handle choosing a suit (after playing a Jack)
 */
function handleChooseSuit(gameState: GameState, suit: Suit): GameState {
  return {
    ...gameState,
    wildSuit: suit
  };
}

/**
 * Handle special card effects
 */
function handleSpecialCardEffect(gameState: GameState, card: Card): GameState {
  const newState = { ...gameState };
  
  switch (card.rank) {
    case '7': // Draw 2 cards (stackable)
      newState.drawCount += 2;
      break;
    
    case '8': // Skip next player
      newState.skipNext = true;
      break;
    
    case 'J': // Wild card - choose suit (handled separately)
      // Suit will be chosen in a separate move
      break;
    
    case 'A': // Reverse direction (in some variants)
      newState.direction = newState.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
      break;
  }
  
  return newState;
}

/**
 * Get the next player index based on direction
 */
function getNextPlayerIndex(gameState: GameState): number {
  const { currentPlayerIndex, direction, players } = gameState;
  const playerCount = players.length;
  
  if (direction === 'clockwise') {
    return (currentPlayerIndex + 1) % playerCount;
  } else {
    return (currentPlayerIndex - 1 + playerCount) % playerCount;
  }
}

/**
 * Check if a player can make any valid move
 */
export function canPlayerMove(gameState: GameState, playerId: string): boolean {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return false;
  
  const { topCard, wildSuit, drawCount } = gameState;
  
  // If there are accumulated draws, check if player has a 7
  if (drawCount > 0) {
    return player.hand.some(card => card.rank === '7');
  }
  
  // Check if any card in hand can be played
  return player.hand.some(card => canPlayCard(card, topCard, wildSuit));
}

/**
 * Get valid cards that can be played from a hand
 */
export function getValidCards(hand: Card[], topCard: Card | null, wildSuit: Suit | null, drawCount: number): Card[] {
  // If there are accumulated draws, only 7s can be played
  if (drawCount > 0) {
    return hand.filter(card => card.rank === '7');
  }
  
  // Otherwise, return cards that match the current card
  return hand.filter(card => canPlayCard(card, topCard, wildSuit));
}

/**
 * Calculate penalty points for remaining cards in hand
 */
export function calculatePenaltyPoints(hand: Card[]): number {
  return hand.reduce((total, card) => {
    switch (card.rank) {
      case 'A': return total + 11;
      case 'K': case 'Q': case 'J': return total + 10;
      case '7': case '8': return total + 20; // Special cards worth more
      default: return total + parseInt(card.rank);
    }
  }, 0);
}

/**
 * Check if game should end due to timeout or other conditions
 */
export function shouldEndGame(gameState: GameState): { shouldEnd: boolean; reason?: string } {
  // Check for winner
  if (gameState.winner) {
    return { shouldEnd: true, reason: 'Player won' };
  }
  
  // Check for turn timeout (in a real implementation, you'd track this)
  const now = new Date();
  const turnDuration = now.getTime() - gameState.turnStartTime!.getTime();
  if (turnDuration > gameState.turnTimeLimit * 1000) {
    return { shouldEnd: false }; // Handle timeout by forcing draw/skip
  }
  
  // Check if all players except one have disconnected
  const connectedPlayers = gameState.players.filter(p => p.isConnected);
  if (connectedPlayers.length <= 1) {
    return { shouldEnd: true, reason: 'Insufficient players' };
  }
  
  return { shouldEnd: false };
}