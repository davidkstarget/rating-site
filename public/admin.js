const socket = io();

const loginPanel = document.querySelector('#login-panel');
const scoreboard = document.querySelector('#scoreboard');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const setupForm = document.querySelector('#setup-form');
const adminError = document.querySelector('#admin-error');
const sessionChip = document.querySelector('#session-chip');
const stageContent = document.querySelector('#stage-content');
const resultStrip = document.querySelector('#result-strip');
const qrCode = document.querySelector('#qr-code');
const qrCodeLarge = document.querySelector('#qr-code-large');
const qrOpenButton = document.querySelector('#qr-open-button');
const qrFullscreen = document.querySelector('#qr-fullscreen');
const qrFullscreenUrl = document.querySelector('#qr-fullscreen-url');
const qrCloseButton = document.querySelector('#qr-close-button');
const voteUrlEl = document.querySelector('#vote-url');
const startButton = document.querySelector('#start-button');
const stopButton = document.querySelector('#stop-button');
const endButton = document.querySelector('#end-button');
const resetButton = document.querySelector('#reset-button');
const ideaCountInput = document.querySelector('#idea-count');
const setupButton = setupForm.querySelector('button[type="submit"]');

let lastState = null;

function openQrFullscreen() {
  qrFullscreen.classList.add('is-open');
  qrFullscreen.setAttribute('aria-hidden', 'false');
  qrCloseButton.focus();
}

function closeQrFullscreen() {
  qrFullscreen.classList.remove('is-open');
  qrFullscreen.setAttribute('aria-hidden', 'true');
  qrOpenButton.focus();
}

function emitCommand(event, payload = {}) {
  adminError.textContent = '';
  socket.emit(event, payload, (response) => {
    if (!response?.ok) {
      adminError.textContent = response?.error || 'Command failed';
    }
  });
}

function voteUrlFromState(state) {
  const baseUrl = state.publicUrl || window.location.origin;
  return new URL(state.votePath || '/vote', baseUrl).toString();
}

function formatAverage(value) {
  return Number(value || 0).toFixed(1);
}

function renderStars(average, className = 'reveal-stars') {
  const roundedAverage = Number(average || 0);
  return `<div class="${className}" aria-label="${formatAverage(roundedAverage)} out of 5 stars">
    ${[1, 2, 3, 4, 5]
      .map((star) => {
        const fill = Math.max(0, Math.min(1, roundedAverage - (star - 1))) * 100;
        return `<span class="meter-star" style="--fill:${fill}%">★</span>`;
      })
      .join('')}
  </div>`;
}

function renderSetup(state) {
  const configuredText = state.ideaCount ? `${state.ideaCount} ideas` : 'Not configured';
  sessionChip.textContent = configuredText;
  stageContent.innerHTML = `
    <div class="empty-stage">
      <p class="eyebrow">Ready when you are</p>
      <h2>Set the class size, then start Idea 1.</h2>
      <p class="stage-copy">The same number is used for students, ideas, and votes needed to close early.</p>
    </div>
  `;
}

function renderReady(state) {
  sessionChip.textContent = `${state.ideaCount} ideas`;
  const nextIdea = state.results.length + 1;
  stageContent.innerHTML = `
    <div class="empty-stage">
      <p class="eyebrow">Next up</p>
      <h2>Idea ${nextIdea}</h2>
      <p class="stage-copy">Start voting when the student finishes presenting.</p>
    </div>
  `;
}

function renderVoting(state) {
  const idea = state.currentIdea;
  const remainingSeconds = Math.ceil((idea?.remainingMs || 0) / 1000);
  const progress = Math.max(0, Math.min(1, (idea?.remainingMs || 0) / 10_000));
  sessionChip.textContent = `Voting: Idea ${idea.ideaNumber}`;
  stageContent.innerHTML = `
    <div class="voting-stage">
      <div class="idea-stack">
        <p class="eyebrow">Now voting</p>
        <h2>Idea ${idea.ideaNumber}</h2>
        <p class="vote-count">${idea.voteCount} / ${state.ideaCount} voted</p>
      </div>
      <div class="countdown" style="--progress:${progress}">
        <span>${remainingSeconds}</span>
      </div>
    </div>
  `;
}

function renderReveal(state) {
  const idea = state.currentIdea;
  sessionChip.textContent = `Result: Idea ${idea.ideaNumber}`;
  stageContent.innerHTML = `
    <div class="reveal-stage">
      <div class="burst" aria-hidden="true"></div>
      <p class="eyebrow">Average rating</p>
      <h2>Idea ${idea.ideaNumber}</h2>
      ${renderStars(idea.average)}
      <div class="score-number">${formatAverage(idea.average)} <span>/ 5</span></div>
      <p class="vote-count">${idea.voteCount} votes counted</p>
    </div>
  `;
}

function renderEnded(state) {
  sessionChip.textContent = 'Final leaderboard';
  const rows = state.topTen
    .map(
      (result, index) => `
        <li>
          <span class="rank">${index + 1}</span>
          <span>Idea ${result.ideaNumber}</span>
          <strong>${formatAverage(result.average)}</strong>
          <small>${result.voteCount} votes</small>
        </li>
      `
    )
    .join('');

  stageContent.innerHTML = `
    <div class="leaderboard-stage">
      <p class="eyebrow">Top 10</p>
      <h2>Final Results</h2>
      <ol class="leaderboard">${rows || '<li>No results yet</li>'}</ol>
    </div>
  `;
}

function renderResults(state) {
  if (!state.results.length) {
    resultStrip.innerHTML = '<span class="muted">No completed ideas yet</span>';
    return;
  }

  resultStrip.innerHTML = state.results
    .map(
      (result) => `
        <div class="result-pill">
          <span>Idea ${result.ideaNumber}</span>
          <strong>${formatAverage(result.average)}</strong>
        </div>
      `
    )
    .join('');
}

function setControlState(state) {
  const configured = Boolean(state.ideaCount);
  const setupLocked = !['setup', 'ready'].includes(state.phase);
  const voting = state.phase === 'voting';
  const ended = state.phase === 'ended';
  const allStarted = configured && state.currentIdea?.ideaNumber >= state.ideaCount && state.phase !== 'ready';

  if (configured && document.activeElement !== ideaCountInput) {
    ideaCountInput.value = state.ideaCount;
  }

  setupForm.classList.toggle('is-disabled', setupLocked);
  ideaCountInput.disabled = setupLocked;
  setupButton.disabled = setupLocked;
  startButton.disabled = !configured || voting || ended || allStarted;
  stopButton.disabled = !voting;
  endButton.disabled = !configured || ended;
  resetButton.disabled = false;
}

function render(state) {
  lastState = state;
  const voteUrl = voteUrlFromState(state);
  const qrSrc = `/qr.svg?url=${encodeURIComponent(voteUrl)}`;
  voteUrlEl.textContent = voteUrl;
  qrFullscreenUrl.textContent = voteUrl;
  qrCode.src = qrSrc;
  qrCodeLarge.src = qrSrc;
  renderResults(state);
  setControlState(state);

  if (state.phase === 'setup') {
    renderSetup(state);
  } else if (state.phase === 'ready') {
    renderReady(state);
  } else if (state.phase === 'voting') {
    renderVoting(state);
  } else if (state.phase === 'reveal') {
    renderReveal(state);
  } else if (state.phase === 'ended') {
    renderEnded(state);
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const pin = new FormData(loginForm).get('pin');
  socket.emit('admin:login', { pin }, (response) => {
    if (!response?.ok) {
      loginError.textContent = response?.error || 'Login failed';
      return;
    }

    loginPanel.classList.add('hidden');
    scoreboard.classList.remove('hidden');
    if (lastState) {
      render(lastState);
    }
  });
});

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const ideaCount = Number(new FormData(setupForm).get('ideaCount'));
  emitCommand('session:configure', { ideaCount });
});

startButton.addEventListener('click', () => emitCommand('idea:start'));
stopButton.addEventListener('click', () => emitCommand('idea:stop'));
endButton.addEventListener('click', () => emitCommand('session:end'));
resetButton.addEventListener('click', () => emitCommand('session:reset'));
qrOpenButton.addEventListener('click', openQrFullscreen);
qrCloseButton.addEventListener('click', closeQrFullscreen);
qrFullscreen.addEventListener('click', (event) => {
  if (event.target === qrFullscreen) {
    closeQrFullscreen();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && qrFullscreen.classList.contains('is-open')) {
    closeQrFullscreen();
  }
});

socket.on('session:state', render);
socket.on('connect_error', () => {
  adminError.textContent = 'Connection lost. Refresh if it does not reconnect.';
});
