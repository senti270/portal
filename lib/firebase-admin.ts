import * as admin from 'firebase-admin';

function getAdminAuth(): admin.auth.Auth {
  if (admin.apps.length === 0) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      try {
        const cert = JSON.parse(key);
        admin.initializeApp({ credential: admin.credential.cert(cert) });
      } catch (e) {
        console.error('Firebase Admin: FIREBASE_SERVICE_ACCOUNT_KEY JSON parse error', e);
        throw e;
      }
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
  }
  return admin.auth();
}

export { admin, getAdminAuth };
