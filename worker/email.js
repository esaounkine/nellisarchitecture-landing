const TO = {
  contact: 'hello@nellisarchitecture.com',
  brief: 'people@nellisarchitecture.com',
};
const SUBJECT = 'Form submitted on the website';

export const recipient = (fields) => TO[fields.form];

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
  to: recipient(fields),
  replyTo: fields.email,
  subject: SUBJECT,
  text: body(fields),
});
