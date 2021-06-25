import { firestore } from 'firebase-admin';
import { createBatchMigrator, createTraverser, createFastTraverser, FastTraverser } from '../src';

type ProjectDoc = {
  isCompleted: boolean;
  completedAt: Date;
};

const projects = firestore().collection('projects') as firestore.CollectionReference<ProjectDoc>;

const fastTraverser = createFastTraverser(projects);
const fastTraverserCI = new FastTraverser(projects);
const slowTraverser = createTraverser(projects);

fastTraverserCI.traverse(async (docs) => {
  //
});

const ssss = fastTraverserCI.withConfig({}).withConfig({});

fastTraverser.traverse(async (docs) => {
  //
});

slowTraverser.traverse(async (docs) => {
  //
});

const slowTraversable = slowTraverser.traversable;

// Ideally this should have a narrow type
fastTraverser.traversable;

const defaultMigrator1 = createBatchMigrator(fastTraverser);
const defaultMigrator2 = createBatchMigrator(projects, { batchSize: 250 });

const fastMigrator = createBatchMigrator(fastTraverser);