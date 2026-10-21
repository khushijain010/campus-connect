// College email helpers, mirroring server/src/constants.js. IIT Roorkee addresses carry the department as a
// subdomain (khushi@ece.iitr.ac.in); any department subdomain is accepted.
export const DEFAULT_SUFFIXES = ['iitr.ac.in'];
export const EMAIL_EXAMPLE = 'name@ece.iitr.ac.in';

export function emailDomain(email) {
  const m = String(email || '').trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+)$/);
  return m ? m[1] : '';
}

export function isCollegeEmail(email, suffixes = DEFAULT_SUFFIXES) {
  const domain = emailDomain(email);
  return !!domain && suffixes.some((s) => domain === s || domain.endsWith(`.${s}`));
}

/** "khushi@ece.iitr.ac.in" → the department whose email code is "ece" (or null). */
export function departmentFromEmail(email, departmentInfo = []) {
  const domain = emailDomain(email);
  if (!domain.endsWith('.iitr.ac.in')) return null;
  const code = domain.slice(0, -'.iitr.ac.in'.length).split('.').pop();
  return departmentInfo.find((d) => d.codes?.includes(code))?.value || null;
}
