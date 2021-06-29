import type { firestore } from 'firebase-admin';

/**
 * A function that takes a document snapshot and derives the data with which to update that document.
 */
export type UpdateDataGetter<D> = (
  snapshot: firestore.QueryDocumentSnapshot<D>
) => firestore.UpdateData;