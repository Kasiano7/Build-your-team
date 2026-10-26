import type { ErrorCode } from '@byt/shared';

const MESSAGES: Record<ErrorCode, string> = {
  INVALID_PAYLOAD: 'Saisie invalide.',
  RATE_LIMITED: 'Trop de requêtes, réessayez dans un instant.',
  ROOM_NOT_FOUND: 'Aucun salon ne correspond à ce code.',
  ROOM_FULL: 'Ce salon est complet.',
  GAME_ALREADY_STARTED: 'La partie a déjà commencé.',
  NOT_IN_ROOM: "Vous n'êtes pas dans ce salon.",
  INVALID_SESSION: 'Session expirée : rejoignez à nouveau le salon.',
  NOT_HOST: "Seul l'hôte peut faire cela.",
  NOT_ENOUGH_PLAYERS: 'Il faut au moins 2 joueurs pour lancer.',
  WRONG_PHASE: "Action impossible à ce moment de la partie.",
  STALE_AUCTION: 'Cette enchère est terminée.',
  AUCTION_NOT_OPEN: "L'enchère n'est pas ouverte.",
  NOT_ELIGIBLE: 'Aucune place compatible ou budget insuffisant pour ce joueur.',
  ALREADY_PASSED: 'Vous avez passé sur ce joueur.',
  ALREADY_HIGHEST: 'Vous êtes déjà le meilleur enchérisseur.',
  BID_TOO_LOW: 'Surenchéri ! Une offre plus haute est arrivée avant la vôtre.',
  INSUFFICIENT_BUDGET: 'Budget insuffisant : il faut garder de quoi compléter votre équipe.',
  HIGHEST_CANNOT_PASS: 'Vous menez l’enchère : votre offre est engageante.',
  INVALID_SLOT: 'Emplacement invalide.',
  INCOMPATIBLE_SLOT: 'Poste incompatible avec ce joueur.',
  FORMATION_LOCKED: 'La formation est fixe dans ce mode.',
  UNKNOWN_FORMATION: 'Formation inconnue.',
  CANNOT_VOTE_OWN_TEAM: 'Vous ne pouvez pas voter pour votre équipe.',
  ALREADY_VOTED: 'Vote déjà enregistré.',
  UNKNOWN_TARGET: 'Équipe inconnue.',
  VOTE_CLOSED: 'Le vote est clos.',
  UNKNOWN_PACK: 'Univers indisponible.',
  INTERNAL: 'Connexion au serveur impossible. Vérifiez votre réseau.',
};

export function errorMessage(code: ErrorCode, details?: Record<string, unknown>): string {
  if (code === 'INSUFFICIENT_BUDGET' && typeof details?.maximum === 'number') {
    return `Budget insuffisant : maximum ${details.maximum}M (réserve pour vos postes restants).`;
  }
  if (code === 'BID_TOO_LOW' && typeof details?.minimum === 'number') {
    return `Offre trop basse : minimum ${details.minimum}M.`;
  }
  return MESSAGES[code] ?? 'Erreur inattendue.';
}
