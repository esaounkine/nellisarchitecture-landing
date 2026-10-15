const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../worker/form.js');
const base = {
  form: 'contact', name: 'Ann', email: 'ann@example.com', phone: '+971 1', message: 'Hi', bot: null,
};

test('parse reads the fields: the message from massage, the Turnstile token', async () => {
  const { parse } = await load();
  const data = new FormData();
  Object.entries({
    form: 'brief',
    name: 'A',
    email: 'a@b.co',
    phone: '1',
    massage: 'M',
    'bot-field': '',
    'cf-turnstile-response': 'T',
    files: 'F',
  }).forEach(([k, v]) => data.append(k, v));
  assert.deepEqual(parse(data), {
    form: 'brief',
    name: 'A',
    email: 'a@b.co',
    phone: '1',
    message: 'M',
    bot: '',
    token: 'T',
    files: 'F',
  });
});

test('validate passes a good contact form', async () => {
  const { validate } = await load();
  assert.deepEqual(validate(base), {
    fields: {
      form: 'contact', name: 'Ann', email: 'ann@example.com', phone: '+971 1', message: 'Hi',
    },
  });
});

test('validate: missing optional fields become empty strings', async () => {
  const { validate } = await load();
  const { fields } = validate({ form: 'brief', email: 'a@b.co' });
  assert.deepEqual(fields, {
    form: 'brief', name: '', email: 'a@b.co', phone: '', message: '',
  });
});

test('validate: a filled honeypot drops the message', async () => {
  const { validate } = await load();
  assert.deepEqual(validate({ ...base, bot: 'x' }), { drop: true });
});

test('validate: an unknown form name fails', async () => {
  const { validate } = await load();
  assert.deepEqual(validate({ ...base, form: 'other' }), { field: 'form' });
  assert.deepEqual(validate({ ...base, form: null }), { field: 'form' });
});

test('validate: a bad or missing email fails', async () => {
  const { validate } = await load();
  ['', 'ann', 'ann@', 'a b@c.d', 'ann@example', null].forEach((email) => {
    assert.deepEqual(validate({ ...base, email }), { field: 'email' }, String(email));
  });
});

test('validate: a file in a text field counts as empty', async () => {
  const { validate } = await load();
  const file = new Blob(['x']);
  assert.equal(validate({ ...base, name: file }).fields.name, '');
});

test('validate: limits pass at the limit and fail one over', async () => {
  const { validate } = await load();
  assert.ok(validate({ ...base, name: 'a'.repeat(200) }).fields);
  assert.deepEqual(validate({ ...base, name: 'a'.repeat(201) }), { field: 'name' });
  assert.ok(validate({ ...base, phone: '1'.repeat(50) }).fields);
  assert.deepEqual(validate({ ...base, phone: '1'.repeat(51) }), { field: 'phone' });
  assert.ok(validate({ ...base, message: 'm'.repeat(5000) }).fields);
  assert.deepEqual(validate({ ...base, message: 'm'.repeat(5001) }), { field: 'message' });
  const local = 'a'.repeat(64);
  const email254 = `${local}@${'b'.repeat(254 - local.length - 5)}.com`;
  assert.equal(email254.length, 254);
  assert.ok(validate({ ...base, email: email254 }).fields);
  assert.deepEqual(validate({ ...base, email: `a${email254}` }), { field: 'email' });
});

test('validate strips CR and LF from single-line fields, keeps them in the message', async () => {
  const { validate } = await load();
  const { fields } = validate({
    ...base, name: 'Ann\r\nBcc: x@y.z', email: 'ann@example.com\n', phone: '1\r2', message: 'a\nb',
  });
  assert.equal(fields.name, 'AnnBcc: x@y.z');
  assert.equal(fields.email, 'ann@example.com');
  assert.equal(fields.phone, '12');
  assert.equal(fields.message, 'a\nb');
});
