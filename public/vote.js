const socket = io();

const emailPanel = document.querySelector('#email-panel');
const votePanel = document.querySelector('#vote-panel');
const emailForm = document.querySelector('#email-form');
const emailInput = document.querySelector('#student-email');
const emailError = document.querySelector('#email-error');
const studentStatus = document.querySelector('#student-status');
const studentIdea = document.querySelector('#student-idea');
const starButtons = [...document.querySelectorAll('#star-buttons button')];
const voteMessage = document.querySelector('#vote-message');

let registeredEmail = window.localStorage.getItem('ratingSiteEmail') || '';
let currentIdeaNumber = null;
let selectedRating = null;

function setStars(rating) {
  selectedRating = rating;
  starButtons.forEach((button) => {
    const value = Number(button.dataset.rating);
    button.classList.toggle('selected', value <= rating);
  });
}

function showVotePanel() {
  emailPanel.classList.add('hidden');
  votePanel.classList.remove('hidden');
}

function registerEmail(email) {
  emailError.textContent = '';
  socket.emit('student:register', { email }, (response) => {
    if (!response?.ok) {
      emailError.textContent = response?.error || 'Email registration failed';
      return;
    }

    registeredEmail = response.email;
    window.localStorage.setItem('ratingSiteEmail', registeredEmail);
    showVotePanel();
  });
}

function renderVoting(state) {
  const idea = state.currentIdea;
  if (currentIdeaNumber !== idea.ideaNumber) {
    currentIdeaNumber = idea.ideaNumber;
    setStars(0);
    voteMessage.textContent = '';
  }

  studentIdea.textContent = `Idea ${idea.ideaNumber}`;
  studentStatus.textContent = `${idea.voteCount} votes in`;
  starButtons.forEach((button) => {
    button.disabled = false;
  });
}

function renderWaiting(state) {
  const label =
    state.phase === 'reveal'
      ? 'Vote closed. Watch the projected result.'
      : state.phase === 'ended'
        ? 'Session ended. Watch the final leaderboard.'
        : 'Waiting for the next idea.';

  studentIdea.textContent = state.phase === 'setup' ? 'Not started' : 'Ready';
  studentStatus.textContent = label;
  starButtons.forEach((button) => {
    button.disabled = true;
  });
}

function renderState(state) {
  if (!registeredEmail) {
    return;
  }

  showVotePanel();
  if (state.phase === 'voting' && state.currentIdea) {
    renderVoting(state);
  } else {
    renderWaiting(state);
  }
}

emailForm.addEventListener('submit', (event) => {
  event.preventDefault();
  registerEmail(new FormData(emailForm).get('email'));
});

starButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const rating = Number(button.dataset.rating);
    setStars(rating);
    socket.emit('vote:submit', { rating }, (response) => {
      if (!response?.ok) {
        voteMessage.textContent = response?.error || 'Vote failed';
        return;
      }

      voteMessage.textContent = 'Vote received';
    });
  });
});

socket.on('session:state', renderState);
socket.on('connect', () => {
  if (registeredEmail) {
    emailInput.value = registeredEmail;
    registerEmail(registeredEmail);
  }
});
