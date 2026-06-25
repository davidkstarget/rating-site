const VOTE_DURATION_MS = 10_000;
const RUNI_EMAIL_SUFFIX = '@post.runi.ac.il';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidRuniEmail(email) {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.endsWith(RUNI_EMAIL_SUFFIX);
}

function assertValidIdeaCount(ideaCount) {
  if (!Number.isInteger(ideaCount) || ideaCount < 1 || ideaCount > 40) {
    throw new Error('ideaCount must be an integer between 1 and 40');
  }
}

function assertValidRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating must be an integer between 1 and 5');
  }
}

function averageForVotes(votes) {
  if (votes.size === 0) {
    return 0;
  }

  const total = [...votes.values()].reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / votes.size) * 100) / 100;
}

function summarizeIdea(idea) {
  if (!idea) {
    return null;
  }

  return {
    ideaNumber: idea.ideaNumber,
    status: idea.status,
    openedAt: idea.openedAt,
    closedAt: idea.closedAt,
    voteCount: idea.votes.size,
    average: averageForVotes(idea.votes)
  };
}

class SessionStore {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.reset();
  }

  reset() {
    this.ideaCount = null;
    this.phase = 'setup';
    this.currentIdeaNumber = null;
    this.ideas = new Map();
    return this.getState();
  }

  configure({ ideaCount }) {
    assertValidIdeaCount(ideaCount);

    this.ideaCount = ideaCount;
    this.phase = 'ready';
    this.currentIdeaNumber = null;
    this.ideas = new Map();

    return this.getState();
  }

  startNextIdea() {
    if (!this.ideaCount) {
      throw new Error('Configure the session before starting an idea');
    }

    if (this.phase === 'voting') {
      throw new Error('An idea is already open for voting');
    }

    const nextIdeaNumber = this.currentIdeaNumber === null ? 1 : this.currentIdeaNumber + 1;
    if (nextIdeaNumber > this.ideaCount) {
      throw new Error('All configured ideas have already been started');
    }

    const openedAt = this.now();
    this.currentIdeaNumber = nextIdeaNumber;
    this.ideas.set(nextIdeaNumber, {
      ideaNumber: nextIdeaNumber,
      status: 'open',
      openedAt,
      closedAt: null,
      votes: new Map()
    });
    this.phase = 'voting';

    return this.getState();
  }

  submitVote({ email, rating }) {
    const normalizedEmail = normalizeEmail(email);
    assertValidRating(rating);

    if (!isValidRuniEmail(normalizedEmail)) {
      throw new Error('Use a valid @post.runi.ac.il email address');
    }

    if (this.phase !== 'voting') {
      throw new Error('There is no idea open for voting');
    }

    const idea = this.getCurrentIdea();
    idea.votes.set(normalizedEmail, rating);

    if (idea.votes.size >= this.ideaCount) {
      this.closeCurrentIdea();
    }

    return this.getState();
  }

  tick() {
    if (this.phase !== 'voting') {
      return this.getState();
    }

    const idea = this.getCurrentIdea();
    if (this.now() - idea.openedAt >= VOTE_DURATION_MS) {
      this.closeCurrentIdea();
    }

    return this.getState();
  }

  stopCurrentIdea() {
    if (this.phase !== 'voting') {
      throw new Error('There is no idea open for voting');
    }

    this.closeCurrentIdea();
    return this.getState();
  }

  endSession() {
    if (this.phase === 'voting') {
      this.closeCurrentIdea();
    }

    if (!this.ideaCount) {
      throw new Error('Configure the session before ending it');
    }

    this.phase = 'ended';
    return this.getState();
  }

  getState() {
    const currentIdea = this.getCurrentIdea();
    const currentSummary = summarizeIdea(currentIdea);
    const remainingMs =
      this.phase === 'voting' && currentIdea
        ? Math.max(0, VOTE_DURATION_MS - (this.now() - currentIdea.openedAt))
        : 0;

    return {
      phase: this.phase,
      ideaCount: this.ideaCount,
      currentIdea: currentSummary
        ? {
            ...currentSummary,
            remainingMs
          }
        : null,
      results: this.getResults(),
      topTen: this.getTopTen()
    };
  }

  closeCurrentIdea() {
    const idea = this.getCurrentIdea();
    if (!idea || idea.status === 'closed') {
      return;
    }

    idea.status = 'closed';
    idea.closedAt = this.now();
    this.phase = 'reveal';
  }

  getCurrentIdea() {
    if (this.currentIdeaNumber === null) {
      return null;
    }

    return this.ideas.get(this.currentIdeaNumber) || null;
  }

  getResults() {
    return [...this.ideas.values()]
      .filter((idea) => idea.status === 'closed')
      .map(summarizeIdea)
      .sort((a, b) => a.ideaNumber - b.ideaNumber);
  }

  getTopTen() {
    return this.getResults()
      .toSorted((a, b) => {
        if (b.average !== a.average) {
          return b.average - a.average;
        }

        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }

        return a.ideaNumber - b.ideaNumber;
      })
      .slice(0, 10);
  }
}

module.exports = {
  RUNI_EMAIL_SUFFIX,
  SessionStore,
  VOTE_DURATION_MS,
  isValidRuniEmail,
  normalizeEmail
};
