const { getFirestore, FieldValue } = require('firebase-admin/firestore')

async function incrementCatalogueViewBySlug(slug) {
  const db = getFirestore()
  const snap = await db.collection('catalogues').where('slug', '==', String(slug || '')).limit(1).get()
  if (snap.empty) return { ok: false, found: false }
  await snap.docs[0].ref.update({
    viewCount: FieldValue.increment(1),
  })
  return { ok: true, found: true }
}

module.exports = { incrementCatalogueViewBySlug }
