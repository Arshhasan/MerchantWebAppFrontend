import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const CALLABLE_NAME = 'sendSupportContactEmail';

export async function sendSupportContactEmail(params) {
  const fn = httpsCallable(functions, CALLABLE_NAME);
  const result = await fn(params);
  return result.data || {};
}
