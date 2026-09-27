// src/utils/reputationService.js
/**
 * Citizen Reputation & Gamification Engine for NammaDrishti
 * Evaluates citizen contributions, verified reports, and civic consensus participation.
 */

const REPUTATION_STORAGE_KEY = 'nammadrishti_citizen_reputation_v1';
const LEGACY_STORAGE_KEY = 'nammapulse_citizen_reputation_v1';

export const REPUTATION_TIERS = {
  SCOUT: {
    id: 'scout',
    label: 'Bengaluru Scout',
    icon: '🧭',
    minPoints: 0,
    maxPoints: 49,
    description: 'Active city observer sharing on-ground updates.',
    badgeColor: '#38BDF8',
  },
  SENTINEL: {
    id: 'sentinel',
    label: 'Ward Sentinel',
    icon: '🛡️',
    minPoints: 50,
    maxPoints: 149,
    description: 'Trusted civic contributor with multiple validated reports.',
    badgeColor: '#34D399',
  },
  GUARDIAN: {
    id: 'guardian',
    label: 'City Guardian',
    icon: '👑',
    minPoints: 150,
    maxPoints: Infinity,
    description: 'High-reputation community leader protecting urban mobility.',
    badgeColor: '#F59E0B',
  },
};

export const getCitizenTier = (points = 0) => {
  if (points >= REPUTATION_TIERS.GUARDIAN.minPoints) {
    return REPUTATION_TIERS.GUARDIAN;
  }
  if (points >= REPUTATION_TIERS.SENTINEL.minPoints) {
    return REPUTATION_TIERS.SENTINEL;
  }
  return REPUTATION_TIERS.SCOUT;
};

export const getCitizenReputation = () => {
  try {
    const raw = localStorage.getItem(REPUTATION_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data;
    }
  } catch (err) {
    console.warn('[Reputation] Failed to read from localStorage:', err.message);
  }

  // Default initial profile
  return {
    reportsSubmitted: 0,
    reportsVerified: 0,
    clearancesVoted: 0,
    points: 15, // Starting civic karma
  };
};

export const saveCitizenReputation = (profile) => {
  try {
    localStorage.setItem(REPUTATION_STORAGE_KEY, JSON.stringify(profile));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nammadrishti:reputation_updated', { detail: profile })
      );
      window.dispatchEvent(
        new CustomEvent('nammapulse:reputation_updated', { detail: profile })
      );
    }
  } catch (err) {
    console.warn('[Reputation] Failed to save to localStorage:', err.message);
  }
};

export const recordReputationEvent = (eventType) => {
  const current = getCitizenReputation();

  switch (eventType) {
    case 'REPORT_SUBMITTED':
      current.reportsSubmitted += 1;
      current.points += 15;
      break;
    case 'HAZARD_VERIFIED':
      current.reportsVerified += 1;
      current.points += 10;
      break;
    case 'HAZARD_CLEARED':
      current.clearancesVoted += 1;
      current.points += 5;
      break;
    default:
      break;
  }

  saveCitizenReputation(current);
  return current;
};
