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
 * Get the color of a card suit
 */
function getCardColor(suit: Suit): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

/**
 * Validate if a card can be played on top of the current card
 */
export function canPlayCard(cardToPlay: Card, topCard: Card | null, wildSuit: Suit | null, isFirstPlay?: boolean): boolean {
  console.log('🔍 canPlayCard called:', {
    cardToPlay: `${cardToPlay.rank} of ${cardToPlay.suit}`,
    topCard: topCard ? `${topCard.rank} of ${topCard.suit}` : 'null',
    wildSuit,
    isFirstPlay
  });
  
  if (!topCard) {
    // Pis Yedili: First play must be a club
    if (isFirstPlay) {
      const result = cardToPlay.suit === 'clubs';
      console.log('  First play, must be club:', result);
      return result;
    }
    console.log('  No top card, can play anything');
    return true; // Can play any card if no top card (fallback)
  }
  
  // If there's a wild suit chosen (from Jack), must match that suit
  if (wildSuit) {
    const result = cardToPlay.suit === wildSuit || cardToPlay.rank === 'J';
    console.log('  Wild suit active:', wildSuit, 'Result:', result);
    return result;
  }
  
  // Jacks are always playable (wild cards)
  if (cardToPlay.rank === 'J') {
    console.log('  Jack is always playable');
    return true;
  }
  
  // Check all three matching conditions:
  // 1. Same suit (e.g., hearts on hearts)
  // 2. Same rank/number (e.g., 3 on 3, K on K, 10 on 10)
  // 3. Same color (red on red, black on black)
  
  // Debug: Log the raw values being compared
  console.log('  Raw comparison values:', {
    cardToPlayRank: cardToPlay.rank,
    topCardRank: topCard.rank,
    rankType: typeof cardToPlay.rank,
    topRankType: typeof topCard.rank,
    strictEqual: cardToPlay.rank === topCard.rank,
    looseEqual: cardToPlay.rank == topCard.rank
  });
  
  const suitMatch = cardToPlay.suit === topCard.suit;
  const rankMatch = cardToPlay.rank === topCard.rank;
  const cardColor = getCardColor(cardToPlay.suit);
  const topCardColor = getCardColor(topCard.suit);
  const colorMatch = cardColor === topCardColor;
  
  console.log('  Matching checks:', {
    suitMatch: `${cardToPlay.suit} === ${topCard.suit} = ${suitMatch}`,
    rankMatch: `"${cardToPlay.rank}" === "${topCard.rank}" = ${rankMatch}`,
    colorMatch: `${cardColor} === ${topCardColor} = ${colorMatch}`
  });
  
  // Card can be played if ANY of these conditions are true
  const canPlay = suitMatch || rankMatch || colorMatch;
  console.log('  Final result:', canPlay, '(suit:', suitMatch, 'rank:', rankMatch, 'color:', colorMatch, ')');
  
  return canPlay;
}

/**
 * Validate a player's move
 */
export function validateMove(gameState: GameState, move: GameMove): { valid: boolean; reason?: string } {
  const { players, currentPlayerIndex, topCard, wildSuit, drawCount } = gameState;
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
      // Can say Tek when player has exactly 1 card
      if (currentPlayer.hand.length !== 1) {
        return { valid: false, reason: 'Can only say Tek when you have 1 card' };
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
  let newState = { ...gameState };
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
  
  // Reset draw count and seven stack
  newState.drawCount = 0;
  newState.sevenStack = 0;
  
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
    case '7': // Draw 3 cards (stackable) - Pis Yedili rule
      newState.sevenStack = (newState.sevenStack || 0) + 1;
      newState.drawCount = newState.sevenStack * 3;
      break;
    
    case '8': // Skip next player
      newState.skipNext = true;
      break;
    
    case '10': // Reverse direction - Pis Yedili rule
      newState.direction = newState.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
      break;
    
    case 'J': // Wild card - choose suit (handled separately)
      // Suit will be chosen in a separate move
      break;
    
    case 'A': // All other players draw 1 card - Pis Yedili rule
      // This is handled server-side, client doesn't need to implement
      break;
    
    default:
      // Clear any stacked 7s when other cards are played
      newState.sevenStack = 0;
      newState.drawCount = 0;
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
export function getValidCards(hand: Card[], topCard: Card | null, wildSuit: Suit | null, drawCount: number, isFirstPlay?: boolean): Card[] {
  console.log('📋 getValidCards called with:', {
    handSize: hand.length,
    topCard: topCard ? `${topCard.rank} of ${topCard.suit}` : 'null',
    wildSuit,
    drawCount,
    isFirstPlay
  });
  
  // Special case: If there are accumulated draws from 7s, only 7s can be played
  if (drawCount > 0) {
    console.log('  ⚠️ Draw count is', drawCount, '- only 7s can be played to stack or player must draw');
    const sevens = hand.filter(card => card.rank === '7');
    console.log('  7s in hand:', sevens.map(c => `${c.rank} of ${c.suit}`));
    return sevens;
  }
  
  // Log each card being checked
  console.log('  Checking each card in hand:');
  hand.forEach(card => {
    const canPlay = canPlayCard(card, topCard, wildSuit, isFirstPlay);
    console.log(`    ${card.rank} of ${card.suit}: ${canPlay ? '✅' : '❌'}`);
  });
  
  // Filter cards that can be played
  const validCards = hand.filter(card => canPlayCard(card, topCard, wildSuit, isFirstPlay));
  
  // Simple debug to see what's being validated
  if (topCard) {
    console.log(`📌 Valid cards for ${topCard.rank} of ${topCard.suit}:`, 
      validCards.map(c => `${c.rank} of ${c.suit}`).join(', ') || 'NONE'
    );
  }
  
  return validCards;
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