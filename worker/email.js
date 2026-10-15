const TO = {
  contact: 'hello@nellisarchitecture.com',
  brief: 'people@nellisarchitecture.com',
};
const SUBJECT = 'Form submitted on the website';

export const recipient = (fields) => TO[fields.form];

/* files: [{ name, url }], one download link for each uploaded file. */
export const body = (fields, files = []) => [
  `Form: ${fields.form}`,
  `Name: ${fields.name}`,
  `Email: ${fields.email}`,
  `Phone: ${fields.phone}`,
  '',
  fields.message,
  '',
  ...(files.length ? ['Files:', ...files.map((f) => `${f.name}: ${f.url}`), ''] : []),
].join('\n');

export const send = (env, fields, files) => env.EMAIL.send({
  from: env.MAIL_FROM,
  to: recipient(fields),
  replyTo: fields.email,
  subject: SUBJECT,
  text: body(fields, files),
});
