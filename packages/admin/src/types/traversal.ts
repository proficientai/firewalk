import type { firestore } from 'firebase-admin';

/**
 * A collection-like traversable object.
 */
export type Traversable<D = firestore.DocumentData> =
  | firestore.CollectionReference<D>
  | firestore.CollectionGroup<D>
  | firestore.Query<D>;

/**
 * The configuration with which a traverser is created.
 */
export interface BaseTraversalConfig {
  /**
   * The number of documents that will be traversed in each batch. Defaults to 250.
   */
  batchSize: number;

  /**
   * Whether to sleep between batches. Defaults to `false`.
   */
  sleepBetweenBatches: boolean;

  /**
   * The amount of time (in ms) to "sleep" before moving on to the next batch. Defaults to 500.
   */
  sleepTimeBetweenBatches: number;

  /**
   * The maximum number of documents that will be traversed. Defaults to `Infinity`.
   */
  maxDocCount: number;
}

/**
 * The configuration with which a fast traverser is created.
 */
export interface FastTraversalConfig extends BaseTraversalConfig {
  /**
   * The maximum number of batches to hold in memory. Defaults to 10.
   */
  maxInMemoryBatchCount: number;
}

/**
 * The configuration that a given traverser uses in sequential traversals.
 */
export interface TraverseEachConfig {
  /**
   * Whether to sleep before moving to the next doc. Defaults to `false`.
   */
  sleepBetweenDocs: boolean;

  /**
   * The amount of time (in ms) to "sleep" before moving to the next doc. Defaults to 500.
   */
  sleepTimeBetweenDocs: number;
}

/**
 * Represents an object that contains the details of a traversal.
 */
export interface TraversalResult {
  /**
   * The number of batches that have been retrieved in this traversal.
   */
  batchCount: number;

  /**
   * The number of documents that have been retrieved in this traversal.
   */
  docCount: number;
}
