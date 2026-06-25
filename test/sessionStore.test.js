const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SessionStore,
  isValidRuniEmail,
  normalizeEmail
} = require('../src/sessionStore');

test('validates and normalizes RUNI post email addresses', () => {
  assert.equal(normalizeEmail('  STUDENT@POST.RUNI.AC.IL  '), 'student@post.runi.ac.il');
  assert.equal(isValidRuniEmail('student@post.runi.ac.il'), true);
  assert.equal(isValidRuniEmail('student@runi.ac.il'), false);
  assert.equal(isValidRuniEmail('student@gmail.com'), false);
  assert.equal(isValidRuniEmail('not-an-email'), false);
});

test('requires ideaCount to be an integer from 1 to 40', () => {
  const store = new SessionStore({ now: () => 1000 });

  assert.throws(() => store.configure({ ideaCount: 0 }), /1 and 40/);
  assert.throws(() => store.configure({ ideaCount: 41 }), /1 and 40/);
  assert.throws(() => store.configure({ ideaCount: 2.5 }), /1 and 40/);

  const state = store.configure({ ideaCount: 3 });
  assert.equal(state.ideaCount, 3);
  assert.equal(state.phase, 'ready');
});

test('replaces duplicate votes from the same email before close', () => {
  const store = new SessionStore({ now: () => 1000 });
  store.configure({ ideaCount: 3 });
  store.startNextIdea();

  store.submitVote({ email: 'student@post.runi.ac.il', rating: 2 });
  const state = store.submitVote({ email: ' STUDENT@POST.RUNI.AC.IL ', rating: 5 });

  assert.equal(state.currentIdea.voteCount, 1);
  assert.equal(state.currentIdea.average, 5);
});

test('closes an idea early when unique votes reach ideaCount', () => {
  const store = new SessionStore({ now: () => 1000 });
  store.configure({ ideaCount: 2 });
  store.startNextIdea();

  store.submitVote({ email: 'one@post.runi.ac.il', rating: 4 });
  const state = store.submitVote({ email: 'two@post.runi.ac.il', rating: 5 });

  assert.equal(state.phase, 'reveal');
  assert.equal(state.currentIdea.status, 'closed');
  assert.equal(state.currentIdea.average, 4.5);
  assert.equal(state.currentIdea.voteCount, 2);
});

test('closes an idea after ten seconds even without all votes', () => {
  let currentTime = 1000;
  const store = new SessionStore({ now: () => currentTime });
  store.configure({ ideaCount: 3 });
  store.startNextIdea();
  store.submitVote({ email: 'one@post.runi.ac.il', rating: 3 });

  currentTime = 10_999;
  assert.equal(store.tick().phase, 'voting');

  currentTime = 11_000;
  const state = store.tick();
  assert.equal(state.phase, 'reveal');
  assert.equal(state.currentIdea.average, 3);
});

test('manual stop closes the active idea and preserves its result', () => {
  const store = new SessionStore({ now: () => 1000 });
  store.configure({ ideaCount: 3 });
  store.startNextIdea();
  store.submitVote({ email: 'one@post.runi.ac.il', rating: 2 });
  store.submitVote({ email: 'two@post.runi.ac.il', rating: 4 });

  const state = store.stopCurrentIdea();

  assert.equal(state.phase, 'reveal');
  assert.equal(state.currentIdea.average, 3);
  assert.equal(state.results[0].ideaNumber, 1);
});

test('top ten ranks by average, vote count, then idea number', () => {
  const store = new SessionStore({ now: () => 1000 });
  store.configure({ ideaCount: 12 });
  const fixtures = new Map([
    [1, { rating: 5, votes: 12 }],
    [2, { rating: 5, votes: 11 }],
    [3, { rating: 4, votes: 12 }],
    [4, { rating: 5, votes: 1 }],
    [5, { rating: 4, votes: 5 }],
    [6, { rating: 2, votes: 1 }],
    [7, { rating: 3, votes: 1 }],
    [8, { rating: 1, votes: 1 }],
    [9, { rating: 4, votes: 1 }],
    [10, { rating: 2, votes: 2 }],
    [11, { rating: 3, votes: 2 }],
    [12, { rating: 1, votes: 2 }]
  ]);

  for (let idea = 1; idea <= 12; idea += 1) {
    store.startNextIdea();
    const { rating, votes } = fixtures.get(idea);
    for (let voter = 1; voter <= votes; voter += 1) {
      store.submitVote({ email: `student${idea}-${voter}@post.runi.ac.il`, rating });
    }
    if (store.getState().phase === 'voting') {
      store.stopCurrentIdea();
    }
  }

  const topTen = store.endSession().topTen;

  assert.equal(topTen.length, 10);
  assert.deepEqual(
    topTen.slice(0, 3).map((result) => result.ideaNumber),
    [1, 2, 4]
  );
  assert.equal(topTen.at(-1).ideaNumber, 6);
});
