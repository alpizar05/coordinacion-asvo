/** ISO calendar dates supported by the forms and PostgreSQL (there is no year zero).
 * @param {string} value
 * @returns {boolean}
 */
export function validFormDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-') && new Date(value).toJSON()?.slice(0, 10) === value;
}
