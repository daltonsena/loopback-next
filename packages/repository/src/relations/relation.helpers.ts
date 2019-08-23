// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as debugFactory from 'debug';
import * as _ from 'lodash';
import {
  AnyObject,
  Entity,
  EntityCrudRepository,
  Filter,
  Inclusion,
  Options,
  Where,
} from '..';
const debug = debugFactory('loopback:repository:relation-helpers');

/**
 * Finds model instances that contain any of the provided foreign key values.
 *
 * @param targetRepository - The target repository where the model instances are found
 * @param fkName - Name of the foreign key
 * @param fkValues - One value or array of values of the foreign key to be included
 * @param scope - Additional scope constraints (not currently supported)
 * @param options - Options for the operations
 */
export async function findByForeignKeys<
  Target extends Entity,
  TargetRelations extends object,
  ForeignKey extends StringKeyOf<Target>
>(
  targetRepository: EntityCrudRepository<Target, unknown, TargetRelations>,
  fkName: ForeignKey,
  fkValues: Target[ForeignKey][] | Target[ForeignKey],
  scope?: Filter<Target>,
  options?: Options,
): Promise<(Target & TargetRelations)[]> {
  // throw error if scope is defined and non-empty
  // see https://github.com/strongloop/loopback-next/issues/3453
  if (scope && !_.isEmpty(scope)) {
    throw new Error('scope is not supported');
  }

  let value;

  if (Array.isArray(fkValues)) {
    if (fkValues.length === 0) return [];
    value = fkValues.length === 1 ? fkValues[0] : {inq: fkValues};
  } else {
    value = fkValues;
  }

  const where = ({[fkName]: value} as unknown) as Where<Target>;
  const targetFilter = {where};

  return targetRepository.find(targetFilter, options);
}

type StringKeyOf<T> = Extract<keyof T, string>;

/**
 * Returns model instances that include related models that have a registered
 * resolver.
 *
 * @param targetRepository - The target repository where the model instances are found
 * @param entities - An array of entity instances or data
 * @param include -Inclusion filter
 * @param options - Options for the operations
 */

export async function includeRelatedModels<
  T extends Entity,
  Relations extends object = {}
>(
  targetRepository: EntityCrudRepository<T, unknown, Relations>,
  entities: T[],
  include?: Inclusion<T>[],
  options?: Options,
): Promise<(T & Relations)[]> {
  const result = entities as (T & Relations)[];
  if (!include) return result;

  const invalidInclusions = include.filter(
    inclusionFilter => !isInclusionAllowed(targetRepository, inclusionFilter),
  );
  if (invalidInclusions.length) {
    const msg =
      'Invalid "filter.include" entries: ' +
      invalidInclusions
        .map(inclusionFilter => JSON.stringify(inclusionFilter))
        .join('; ');
    const err = new Error(msg);
    Object.assign(err, {
      code: 'INVALID_INCLUSION_FILTER',
    });
    throw err;
  }

  const resolveTasks = include.map(async inclusionFilter => {
    const relationName = inclusionFilter.relation;
    const resolver = targetRepository.inclusionResolvers.get(relationName)!;
    const targets = await resolver(entities, inclusionFilter, options);

    result.forEach((entity, ix) => {
      const src = entity as AnyObject;
      src[relationName] = targets[ix];
    });
  });

  await Promise.all(resolveTasks);

  return result;
}
/**
 * Checks if the resolver of the inclusion relation is registered
 * in the inclusionResolver of the target repository
 *
 * @param targetRepository - The target repository where the relations are registered
 * @param include - Inclusion filter
 */
function isInclusionAllowed<T extends Entity, Relations extends object = {}>(
  targetRepository: EntityCrudRepository<T, unknown, Relations>,
  include: Inclusion,
): boolean {
  const relationName = include.relation;
  if (!relationName) {
    debug('isInclusionAllowed for %j? No: missing relation name', include);
    return false;
  }
  const allowed = targetRepository.inclusionResolvers.has(relationName);
  debug('isInclusionAllowed for %j (relation %s)? %s', include, allowed);
  return allowed;
}

/** Returns an array of arrays. Each nested array has one or more instance
 * as a result of one to many relations.
 * 
 * @param sourceIds - One value or array of values of the target key
 * @param targetEntities - target entities that satisfy targetKey's value (ids).
 * @param targetKey - name of the target key
 * 
 * @return 
 */
export function flattenTargetsOfOneToManyRelation<Target extends Entity>(
  sourceIds: unknown[],
  targetEntities: Target[],
  targetKey: StringKeyOf<Target>,
): (Target[] | undefined)[] {
  const lookup = buildLookupMap<unknown, Target, Target[]>(
    targetEntities,
    targetKey,
    reduceAsArray,
  );

  return flattenMapByKeys(sourceIds, lookup);
}

/** Returns an array of instaces, which's indexes map the sourceIds' indexes 
 * 
 * @param sourceIds - One value or array of values (of the target key)
 * @param targetMap - a map that matches sourceIds with instances
 */
export function flattenMapByKeys<T>(
  sourceIds: unknown[],
  targetMap: Map<unknown, T>,
): (T | undefined)[] {
  const result: (T | undefined)[] = new Array(sourceIds.length);
  // should we change the for loop to:

  for (const ix in sourceIds) {
    const key = sourceIds[ix];
    const target = targetMap.get(key);
    result[ix] = target;
  }
  // for(const i of sourceIds.keys()){
  //   const key = sourceIds[i];
  //   const target = targetMap.get(key);
  //   result[i] = target;
  // }

  return result;
}

// TODO(bajtos) add test coverage
/** Returns a map which map key values(ids) to instances.
 * 
 * @param list - an array of instances
 * @param keyName - key name of the source
 * @param reducer - a strategy to reduce inputs to single item or array
 */
export function buildLookupMap<Key, InType, OutType = InType>(
  list: InType[],
  keyName: StringKeyOf<InType>,
  reducer: (accumulator: OutType | undefined, current: InType) => OutType,
): Map<Key, OutType> {
  const lookup = new Map<Key, OutType>();
  for (const entity of list) {
    // get a correct key value
    const key = getKeyValue(entity, keyName) as Key;
    // these 3 steps are to set up the map, the map differs according to the reducer.
    const original = lookup.get(key);
    const reduced = reducer(original, entity);
    lookup.set(key, reduced);
  }
  return lookup;
}
/** returns value of a key. Aim to resolve ObjectId problem of Mongo
 * 
 * @param model - target model
 * @param keyName - target key that gets the value from
 */
export function getKeyValue<T>(model: T, keyName: string) {
  const rawKey = (model as AnyObject)[keyName];
  // Hacky workaround for MongoDB, see _SPIKE_.md for details
  if (typeof rawKey === 'object' && rawKey.constructor.name === 'ObjectID') {
    return rawKey.toString();
  }
  return rawKey;
}

/** Returns an array of instance. For HasMany relation usage.
 * 
 * @param acc 
 * @param it 
 */
export function reduceAsArray<T>(acc: T[] | undefined, it: T) {
  if (acc) acc.push(it);
  else acc = [it];
  return acc;
}