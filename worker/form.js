const FORMS = ['contact', 'brief'];
const LIMITS = {
  name: 200, email: 254, phone: 50, message: 5000,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value) => (typeof value === 'string' ? value : '');
const line = (value) => text(value).replace(/[\r\n]/g, '').trim();

export const parse = (formData) => ({
  form: formData.get('form'),
  name: formData.get('name'),
  email: formData.get('email'),
  phone: formData.get('phone'),
  message: formData.get('massage'),
  bot: formData.get('bot-field'),
});

/* Returns { drop: true } for a bot, { field } for a bad field, else { fields }. */
export const validate = (raw) => {
  if (text(raw.bot)) return { drop: true };
  const fields = {
    form: line(raw.form),
    name: line(raw.name),
    email: line(raw.email),
    phone: line(raw.phone),
    message: text(raw.message).trim(),
  };
  if (!FORMS.includes(fields.form)) return { field: 'form' };
  if (!EMAIL.test(fields.email)) return { field: 'email' };
  const long = Object.keys(LIMITS).find((key) => fields[key].length > LIMITS[key]);
  if (long) return { field: long };
  return { fields };
};
