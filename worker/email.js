const TO = 'hello@nellisarchitecture.com';

export const subject = (fields) => `Website form: ${fields.form} — ${fields.name || fields.email}`
  .slice(0, 150);

export const body = (fields) => [
  `Form: ${fields.form}`,
  `Name: ${fields.name}`,
  `Email: ${fields.email}`,
  `Phone: ${fields.phone}`,
  '',
  fields.message,
  '',
].join('\n');

export const send = (env, fields) => env.EMAIL.send({
  from: env.MAIL_FROM,
  to: TO,
  replyTo: fields.email,
  subject: subject(fields),
  text: body(fields),
});
