import type { firestore } from 'firebase-admin';
import type {
  BatchMigrator,
  MigrationPredicate,
  MigrationResult,
  SetDataGetter,
  SetOptions,
  SetPartialDataGetter,
  Traverser,
  UpdateDataGetter,
  UpdateFieldValueGetter,
} from '../../api';
import { InvalidConfigError } from '../../errors';
import { isPositiveInteger } from '../utils';
import { AbstractMigrator, RegisteredCallbacks } from './abstract';
import { IllegalArgumentError } from '../errors';

export class BasicBatchMigratorImpl<D> extends AbstractMigrator<D> implements BatchMigrator<D> {
  static readonly #MAX_BATCH_WRITE_DOC_COUNT = 500;

  public constructor(
    public readonly traverser: Traverser<D>,
    registeredCallbacks?: RegisteredCallbacks<D>,
    migrationPredicates?: MigrationPredicate<D>[]
  ) {
    super(registeredCallbacks, migrationPredicates);
    this.#validateTraverserCompatibility();
  }

  #validateTraverserCompatibility(): void {
    const { batchSize } = this.traverser.traversalConfig;
    const maxBatchWriteDocCount = BasicBatchMigratorImpl.#MAX_BATCH_WRITE_DOC_COUNT;
    if (
      typeof batchSize === 'number' &&
      (!isPositiveInteger(batchSize) || batchSize > maxBatchWriteDocCount)
    ) {
      throw new InvalidConfigError(
        `The 'batchSize' field in the traversal config of a BatchMigrator's traverser must be a positive integer less than or equal to ${maxBatchWriteDocCount}. In Firestore, each write batch can write to a maximum of ${maxBatchWriteDocCount} documents.`
      );
    }
  }

  public withPredicate(predicate: MigrationPredicate<D>): BatchMigrator<D> {
    return new BasicBatchMigratorImpl(this.traverser, this.registeredCallbacks, [
      ...this.migrationPredicates,
      predicate,
    ]);
  }

  public withTraverser(traverser: Traverser<D>): BatchMigrator<D> {
    return new BasicBatchMigratorImpl(
      traverser,
      this.registeredCallbacks,
      this.migrationPredicates
    );
  }

  public set(
    data: firestore.PartialWithFieldValue<D>,
    options: SetOptions
  ): Promise<MigrationResult>;

  public set(data: firestore.WithFieldValue<D>): Promise<MigrationResult>;

  public async set(
    data: firestore.PartialWithFieldValue<D> | firestore.WithFieldValue<D>,
    options?: SetOptions
  ): Promise<MigrationResult> {
    return this.#migrate((writeBatch, doc) => {
      if (options === undefined) {
        // Signature 2
        writeBatch.set(doc.ref, data as firestore.WithFieldValue<D>);
      } else {
        // Signature 1
        writeBatch.set(doc.ref, data as firestore.PartialWithFieldValue<D>, options);
      }
    });
  }

  public setWithDerivedData(
    getData: SetPartialDataGetter<D>,
    options: SetOptions
  ): Promise<MigrationResult>;

  public setWithDerivedData(getData: SetDataGetter<D>): Promise<MigrationResult>;

  public async setWithDerivedData(
    getData: SetPartialDataGetter<D> | SetDataGetter<D>,
    options?: SetOptions
  ): Promise<MigrationResult> {
    return this.#migrate((writeBatch, doc) => {
      if (options === undefined) {
        // Signature 2
        const data = (getData as SetDataGetter<D>)(doc);
        writeBatch.set(doc.ref, data);
      } else {
        // Signature 1
        const data = (getData as SetPartialDataGetter<D>)(doc);
        writeBatch.set(doc.ref, data, options);
      }
    });
  }

  public update(
    data: firestore.UpdateData<D>,
    precondition?: firestore.Precondition
  ): Promise<MigrationResult>;

  public update(
    field: string | firestore.FieldPath,
    value: any,
    ...moreFieldsOrPrecondition: any[]
  ): Promise<MigrationResult>;

  public update(
    dataOrField: firestore.UpdateData<D> | string | firestore.FieldPath,
    preconditionOrValue?: any,
    ...moreFieldsOrPrecondition: any[]
  ): Promise<MigrationResult> {
    return this.#migrate((writeBatch, doc) => {
      if (
        typeof dataOrField === 'string' ||
        dataOrField instanceof this.firestoreConstructor.FieldPath
      ) {
        // Signature 2
        const field = dataOrField;
        const value = preconditionOrValue;
        writeBatch.update(doc.ref, field, value, ...moreFieldsOrPrecondition);
      } else if (dataOrField !== undefined) {
        // Signature 1
        const data = dataOrField;
        const precondition = preconditionOrValue as firestore.Precondition | undefined;
        if (precondition === undefined) {
          writeBatch.update(doc.ref, data);
        } else {
          writeBatch.update(doc.ref, data, precondition);
        }
      } else {
        throw new IllegalArgumentError(
          `Unsupported signature detected. The 'dataOrField' argument cannot be undefined. The 'dataOrField' argument must be a string, a FieldPath, or an object.`
        );
      }
    });
  }

  public updateWithDerivedData(
    getData: UpdateDataGetter<D>,
    precondition?: firestore.Precondition
  ): Promise<MigrationResult>;

  public updateWithDerivedData(getData: UpdateFieldValueGetter<D>): Promise<MigrationResult>;

  public updateWithDerivedData(
    getData: (
      doc: firestore.QueryDocumentSnapshot<D>
    ) => ReturnType<UpdateDataGetter<D>> | ReturnType<UpdateFieldValueGetter<D>>,
    precondition?: firestore.Precondition
  ): Promise<MigrationResult> {
    return this.#migrate((writeBatch, doc) => {
      const data = getData(doc);
      if (Array.isArray(data)) {
        // Signature 2
        writeBatch.update(doc.ref, ...(data as [string | firestore.FieldPath, any, ...any[]]));
      } else if (data !== undefined) {
        // Signature 1
        if (precondition === undefined) {
          writeBatch.update(doc.ref, data);
        } else {
          writeBatch.update(doc.ref, data, precondition);
        }
      } else {
        throw new IllegalArgumentError(
          `Unsupported signature detected. The 'data' argument cannot be undefined. The 'data' argument must be an array, an object, or a valid Firestore update signature.`
        );
      }
    });
  }

  async #migrate(
    migrateDoc: (writeBatch: firestore.WriteBatch, doc: firestore.QueryDocumentSnapshot<D>) => void
  ): Promise<MigrationResult> {
    return this.migrateWithTraverser(async (batchDocs) => {
      let migratedDocCount = 0;
      const writeBatch = this.firestoreInstance.batch();
      batchDocs.forEach((doc) => {
        if (this.shouldMigrateDoc(doc)) {
          migrateDoc(writeBatch, doc);
          migratedDocCount++;
        }
      });
      await writeBatch.commit();
      return migratedDocCount;
    });
  }
}
