/**
 * Shared Firebase Admin initialization for Node scripts in this folder.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

export function loadDotEnv() {
  for (const name of ['.env', '.env.local']) {
    const fp = join(projectRoot, name);
    if (!existsSync(fp)) continue;
    const text = readFileSync(fp, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"'))
        || (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

function resolveCredentialPath(p) {
  if (!p) return null;
  if (p.startsWith('/')) return p;
  return resolvePath(projectRoot, p);
}

export function initAdmin() {
  loadDotEnv();

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonRaw) {
    const cred = JSON.parse(jsonRaw);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    return;
  }

  const candidates = [];
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    candidates.push(resolveCredentialPath(envPath));
  }
  candidates.push(join(__dirname, 'serviceAccount.json'));
  candidates.push(resolvePath(projectRoot, 'scripts/serviceAccount.json'));

  for (const filePath of candidates) {
    if (filePath && existsSync(filePath)) {
      const cred = JSON.parse(readFileSync(filePath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      return;
    }
  }

  const projectId =
    process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.VITE_FIREBASE_PROJECT_ID
    || process.env.FIREBASE_PROJECT_ID;

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
    return;
  } catch {
    // fall through
  }

  console.error(`
Missing Firebase Admin credentials.

Do this once:
  1. Firebase Console → Project settings → Service accounts → Generate new private key
  2. Save the file as:  scripts/serviceAccount.json
     (same folder as this script; that path is gitignored)

Or add to .env.local in the project root:
  GOOGLE_APPLICATION_CREDENTIALS=./scripts/serviceAccount.json

Or:  export GOOGLE_APPLICATION_CREDENTIALS="/full/path/to/your-key.json"

Or if you use gcloud:  gcloud auth application-default login
`);
  process.exit(1);
}

export { admin };
