const socket = io();

const loginPanel = document.querySelector('#login-panel');
const scoreboard = document.querySelector('#scoreboard');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const setupForm = document.querySelector('#setup-form');
const adminError = document.querySelector('#admin-error');
const sessionChip = document.querySelector('#session-chip');
const stageContent = document.querySelector('#stage-content');
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
const VOTE_DURATION_MS = 20_000;

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
  const configuredText = state.ideaCount ? `${state.ideaCount} presenters` : 'Set up class';
  sessionChip.textContent = configuredText;
  stageContent.innerHTML = `
    <div class="empty-stage">
      <p class="eyebrow">Welcome</p>
      <h2>Let the ideas begin.</h2>
      <p class="stage-copy">Choose how many presenters are here today. Students can scan the QR and get ready to rate.</p>
    </div>
  `;
}

function renderReady(state) {
  sessionChip.textContent = `${state.ideaCount} presenters`;
  const nextIdea = state.results.length + 1;
  stageContent.innerHTML = `
    <div class="empty-stage">
      <p class="eyebrow">Next presenter</p>
      <h2>Idea ${nextIdea}</h2>
      <p class="stage-copy">When the pitch is finished, open voting for the class.</p>
    </div>
  `;
}

function renderVoting(state) {
  const idea = state.currentIdea;
  const remainingSeconds = Math.ceil((idea?.remainingMs || 0) / 1000);
  const progress = Math.max(0, Math.min(1, (idea?.remainingMs || 0) / VOTE_DURATION_MS));
  sessionChip.textContent = `Voting open: Idea ${idea.ideaNumber}`;
  stageContent.innerHTML = `
    <div class="voting-stage">
      <div class="idea-stack">
        <p class="eyebrow">Voting is open</p>
        <h2>Idea ${idea.ideaNumber}</h2>
        <p class="vote-count">${idea.voteCount} of ${state.ideaCount} ratings in</p>
      </div>
      <div class="countdown" style="--progress:${progress}">
        <span>${remainingSeconds}</span>
      </div>
    </div>
  `;
}

function renderReveal(state) {
  const idea = state.currentIdea;
  sessionChip.textContent = `Score: Idea ${idea.ideaNumber}`;
  stageContent.innerHTML = `
    <div class="reveal-stage">
      <div class="burst" aria-hidden="true"></div>
      <p class="eyebrow">Class rating</p>
      <h2>Idea ${idea.ideaNumber}</h2>
      ${renderStars(idea.average)}
      <div class="score-number">${formatAverage(idea.average)} <span>/ 5</span></div>
      <p class="vote-count">${idea.voteCount} students rated this idea</p>
    </div>
  `;
}

function renderEnded(state) {
  sessionChip.textContent = 'Final top 10';
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
      <p class="eyebrow">Class favorites</p>
      <h2>Top 10 ideas</h2>
      <ol class="leaderboard">${rows || '<li>No scores yet</li>'}</ol>
    </div>
  `;
}

function setControlState(state) {
  const configured = Boolean(state.ideaCount);
  const setupLocked = !['setup', 'ready'].includes(state.phase);
  const voting = state.phase === 'voting';
  const ended = state.phase === 'ended';
  const lastStartedIdea = state.currentIdea?.ideaNumber || state.results.length || 0;
  const nextIdeaNumber = lastStartedIdea + 1;
  const allStarted = configured && nextIdeaNumber > state.ideaCount;

  if (configured && document.activeElement !== ideaCountInput) {
    ideaCountInput.value = state.ideaCount;
  }

  if (voting && state.currentIdea) {
    startButton.textContent = `Voting open for Idea ${state.currentIdea.ideaNumber}`;
  } else if (!configured) {
    startButton.textContent = 'Open voting for Idea 1';
  } else if (allStarted) {
    startButton.textContent = 'All ideas rated';
  } else {
    startButton.textContent = `Open voting for Idea ${nextIdeaNumber}`;
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
