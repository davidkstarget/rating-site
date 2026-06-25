require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const { SessionStore, isValidRuniEmail, normalizeEmail } = require('./sessionStore');

const DEFAULT_ADMIN_PIN = '2468';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp({
  adminPin = process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN,
  publicUrl = process.env.PUBLIC_URL || '',
  startTicker = true,
  tickIntervalMs = 250,
  store = new SessionStore()
} = {}) {
  const app = express();
  const io = new Server({
    serveClient: true
  });

  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/', (_req, res) => {
    res.redirect('/admin');
  });
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
  });
  app.get('/vote', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'vote.html'));
  });
  app.get('/qr.svg', async (req, res, next) => {
    try {
      const targetUrl = String(req.query.url || '').trim();
      if (!targetUrl) {
        res.status(400).type('text/plain').send('Missing url');
        return;
      }

      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#14213d',
          light: '#ffffff'
        }
      });
      res.type('image/svg+xml').send(svg);
    } catch (error) {
      next(error);
    }
  });
  app.use(express.static(PUBLIC_DIR));

  function stateForClient() {
    return {
      ...store.getState(),
      votePath: '/vote',
      publicUrl
    };
  }

  function broadcastState() {
    io.emit('session:state', stateForClient());
  }

  function acknowledge(ack, payload) {
    if (typeof ack === 'function') {
      ack(payload);
    }
  }

  function handleCommand(socket, ack, command) {
    if (!socket.data.isAdmin) {
      acknowledge(ack, { ok: false, error: 'Admin login required' });
      return;
    }

    try {
      const state = command();
      broadcastState();
      acknowledge(ack, { ok: true, state });
    } catch (error) {
      acknowledge(ack, { ok: false, error: error.message });
    }
  }

  io.on('connection', (socket) => {
    socket.emit('session:state', stateForClient());

    socket.on('admin:login', (payload, ack) => {
      const pin = typeof payload === 'string' ? payload : payload?.pin;
      if (String(pin || '') !== String(adminPin)) {
        acknowledge(ack, { ok: false, error: 'Invalid admin PIN' });
        return;
      }

      socket.data.isAdmin = true;
      acknowledge(ack, { ok: true });
      socket.emit('session:state', stateForClient());
    });

    socket.on('session:configure', (payload, ack) => {
      handleCommand(socket, ack, () => store.configure({ ideaCount: Number(payload?.ideaCount) }));
    });

    socket.on('idea:start', (_payload, ack) => {
      handleCommand(socket, ack, () => store.startNextIdea());
    });

    socket.on('idea:stop', (_payload, ack) => {
      handleCommand(socket, ack, () => store.stopCurrentIdea());
    });

    socket.on('session:end', (_payload, ack) => {
      handleCommand(socket, ack, () => store.endSession());
    });

    socket.on('session:reset', (_payload, ack) => {
      handleCommand(socket, ack, () => store.reset());
    });

    socket.on('student:register', (payload, ack) => {
      const email = normalizeEmail(payload?.email);
      if (!isValidRuniEmail(email)) {
        acknowledge(ack, { ok: false, error: 'Use a valid @post.runi.ac.il email address' });
        return;
      }

      socket.data.studentEmail = email;
      acknowledge(ack, { ok: true, email });
    });

    socket.on('vote:submit', (payload, ack) => {
      if (!socket.data.studentEmail) {
        acknowledge(ack, { ok: false, error: 'Enter your RUNI email before voting' });
        return;
      }

      try {
        const state = store.submitVote({
          email: socket.data.studentEmail,
          rating: Number(payload?.rating)
        });
        broadcastState();
        acknowledge(ack, { ok: true, state });
      } catch (error) {
        acknowledge(ack, { ok: false, error: error.message });
      }
    });
  });

  let ticker = null;
  if (startTicker) {
    let previousState = JSON.stringify(store.getState());
    ticker = setInterval(() => {
      const state = store.tick();
      const nextState = JSON.stringify(state);
      if (nextState !== previousState) {
        previousState = nextState;
        broadcastState();
      }
    }, tickIntervalMs);
    ticker.unref?.();
  }

  io.on('close', () => {
    if (ticker) {
      clearInterval(ticker);
    }
  });

  return { app, io, store };
}

if (require.main === module) {
  const { app, io } = createApp();
  const server = http.createServer(app);
  io.attach(server);

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Classroom rating site listening on port ${port}`);
    if (!process.env.ADMIN_PIN) {
      console.log(`ADMIN_PIN is not set; using development PIN ${DEFAULT_ADMIN_PIN}`);
    }
  });
}

module.exports = {
  DEFAULT_ADMIN_PIN,
  createApp
};
