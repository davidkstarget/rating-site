const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { io: Client } = require('socket.io-client');

const { createApp } = require('../src/server');

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function createHarness() {
  const { app, io } = createApp({ adminPin: '2468', startTicker: false });
  const httpServer = http.createServer(app);
  io.attach(httpServer);

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  const url = `http://127.0.0.1:${port}`;

  async function connect() {
    const socket = Client(url, { transports: ['websocket'] });
    const connected = once(socket, 'connect');
    const stateReceived = once(socket, 'session:state');
    await connected;
    await stateReceived;
    return socket;
  }

  async function close(...sockets) {
    for (const socket of sockets) {
      if (socket?.connected) {
        socket.disconnect();
      }
    }
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }

  return { close, connect };
}

test('admin can configure, start, stop, end, and reset a session', async () => {
  const harness = await createHarness();
  const admin = await harness.connect();

  try {
    assert.deepEqual(await emitWithAck(admin, 'admin:login', { pin: '2468' }), { ok: true });

    let response = await emitWithAck(admin, 'session:configure', { ideaCount: 2 });
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'ready');

    response = await emitWithAck(admin, 'idea:start');
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'voting');
    assert.equal(response.state.currentIdea.ideaNumber, 1);

    response = await emitWithAck(admin, 'idea:stop');
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'reveal');

    response = await emitWithAck(admin, 'session:end');
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'ended');

    response = await emitWithAck(admin, 'session:reset');
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'setup');
  } finally {
    await harness.close(admin);
  }
});

test('student registration validates RUNI email and voting closes at ideaCount', async () => {
  const harness = await createHarness();
  const admin = await harness.connect();
  const studentOne = await harness.connect();
  const studentTwo = await harness.connect();

  try {
    await emitWithAck(admin, 'admin:login', { pin: '2468' });
    await emitWithAck(admin, 'session:configure', { ideaCount: 2 });
    await emitWithAck(admin, 'idea:start');

    assert.deepEqual(await emitWithAck(studentOne, 'student:register', { email: 'bad@example.com' }), {
      ok: false,
      error: 'Use a valid @post.runi.ac.il email address'
    });

    assert.deepEqual(await emitWithAck(studentOne, 'student:register', { email: 'ONE@POST.RUNI.AC.IL' }), {
      ok: true,
      email: 'one@post.runi.ac.il'
    });
    assert.deepEqual(await emitWithAck(studentTwo, 'student:register', { email: 'two@post.runi.ac.il' }), {
      ok: true,
      email: 'two@post.runi.ac.il'
    });

    let response = await emitWithAck(studentOne, 'vote:submit', { rating: 4 });
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'voting');

    response = await emitWithAck(studentTwo, 'vote:submit', { rating: 5 });
    assert.equal(response.ok, true);
    assert.equal(response.state.phase, 'reveal');
    assert.equal(response.state.currentIdea.average, 4.5);
  } finally {
    await harness.close(admin, studentOne, studentTwo);
  }
});

test('students cannot run admin actions without a valid admin login', async () => {
  const harness = await createHarness();
  const student = await harness.connect();

  try {
    let response = await emitWithAck(student, 'session:configure', { ideaCount: 2 });
    assert.equal(response.ok, false);
    assert.equal(response.error, 'Admin login required');

    response = await emitWithAck(student, 'admin:login', { pin: 'wrong' });
    assert.equal(response.ok, false);
    assert.equal(response.error, 'Invalid admin PIN');
  } finally {
    await harness.close(student);
  }
});
