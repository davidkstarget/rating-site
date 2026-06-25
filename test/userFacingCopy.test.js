const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('projected admin UI uses classroom-facing copy', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'admin.js'), 'utf8');
  const copy = `${html}\n${js}`;

  for (const phrase of [
    'Live voting',
    'Classroom Scoreboard',
    'Not configured',
    'Ready when you are',
    'Set the class size',
    'Students / ideas',
    'Completed ideas',
    'No completed ideas yet',
    'Start next idea',
    'Stop voting',
    'End session',
    'Reset',
    'Scores so far',
    'Scores will appear here after each idea',
    'result-strip',
    'results-band'
  ]) {
    assert.equal(copy.includes(phrase), false, `Unexpected internal-sounding phrase: ${phrase}`);
  }

  for (const phrase of [
    'Idea Pitch Ratings',
    'Set up class',
    'Presenters today',
    'Open voting for Idea',
    'Voting open for Idea',
    'Close voting',
    'Show final top 10',
    'Start over',
    'Scan to vote',
    'Tap QR to enlarge'
  ]) {
    assert.equal(copy.includes(phrase), true, `Missing user-facing phrase: ${phrase}`);
  }
});

test('student phone UI uses friendly voting language', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'vote.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'vote.js'), 'utf8');
  const copy = `${html}\n${js}`;

  for (const phrase of ['Cast your vote', 'Vote received', 'Waiting for the next idea']) {
    assert.equal(copy.includes(phrase), false, `Unexpected generic phrase: ${phrase}`);
  }

  for (const phrase of ['Rate this idea', 'Join the vote', 'Thanks, your rating is in']) {
    assert.equal(copy.includes(phrase), true, `Missing student-facing phrase: ${phrase}`);
  }
});
