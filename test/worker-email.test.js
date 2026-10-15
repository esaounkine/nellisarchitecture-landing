const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../worker/email.js');
const fields = {
  form: 'brief', name: 'Ann', email: 'ann@example.com', phone: '1', message: 'Hello\nthere',
};

test('subject names the form and the sender', async () => {
  const { subject } = await load();
  assert.equal(subject(fields), 'Website form: brief — Ann');
  assert.equal(subject({ ...fields, name: '' }), 'Website form: brief — ann@example.com');
});

test('subject is 150 characters or less', async () => {
  const { subject } = await load();
  assert.equal(subject({ ...fields, name: 'a'.repeat(200) }).length, 150);
});

test('body lists the fields, then the message', async () => {
  const { body } = await load();
  const want = 'Form: brief\nName: Ann\nEmail: ann@example.com\nPhone: 1\n\nHello\nthere\n';
  assert.equal(body(fields), want);
});

test('send uses the EMAIL binding with MAIL_FROM and replyTo the sender', async () => {
  const { send, subject, body } = await load();
  const calls = [];
  const env = {
    MAIL_FROM: 'website@nellisarchitecture.com',
    EMAIL: { send: async (m) => calls.push(m) },
  };
  await send(env, fields);
  assert.deepEqual(calls, [{
    from: 'website@nellisarchitecture.com',
    to: 'hello@nellisarchitecture.com',
    replyTo: 'ann@example.com',
    subject: subject(fields),
    text: body(fields),
  }]);
});
