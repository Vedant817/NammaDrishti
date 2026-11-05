// One Express process owns the in-memory index. Mutations are serialized by the
// server and acknowledged only after a single atomic Firestore batch commits.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

function createFirebaseStore(projectId) {
  const app = initializeApp({ projectId, credential: applicationDefault() }, 'incident-backend');
  const db = getFirestore(app);
  return { ...createIncidentRepository(db), auth: getAuth(app) };
}

function createIncidentRepository(db) {
  const collection = db.collection('incidents');
  let previous = new Map();
  return {
    async load() {
      const snapshot = await collection.get();
      const items = snapshot.docs.map(doc => doc.data());
      previous = new Map(items.map(item => [item.id, JSON.stringify(item)]));
      return items;
    },
    async save(items) {
      for (const item of items) {
        if (typeof item.id !== 'string' || !item.id || item.id.includes('/') || item.id === '.' || item.id === '..' || Buffer.byteLength(item.id) > 1500) {
          throw new Error('Invalid Firestore incident ID');
        }
      }
      const next = new Map(items.map(item => [item.id, JSON.stringify(item)]));
      const changes = items.filter(item => previous.get(item.id) !== next.get(item.id));
      const deleted = [...previous.keys()].filter(id => !next.has(id));
      // Fail closed rather than splitting an operation into partial commits.
      if (changes.length + deleted.length > 500) throw new Error('Firestore atomic write limit exceeded');
      if (!changes.length && !deleted.length) return;
      const batch = db.batch();
      for (const item of changes) batch.set(collection.doc(item.id), JSON.parse(next.get(item.id)));
      for (const id of deleted) batch.delete(collection.doc(id));
      await batch.commit();
      previous = next;
    },
  };
}

module.exports = { createFirebaseStore, createIncidentRepository };
