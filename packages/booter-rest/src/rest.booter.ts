// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/booter-rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  ArtifactOptions,
  BaseArtifactBooter,
  BootBindings,
  booter,
} from '@loopback/boot';
import {
  Application,
  config,
  ControllerClass,
  CoreBindings,
  inject,
} from '@loopback/core';
import {DefaultCrudRepository, Entity, Model} from '@loopback/repository';
import {defineCrudRestController} from '@loopback/rest-crud';
import * as debugFactory from 'debug';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';

const debug = debugFactory('loopback:boot:rest-booter');
const readFile = promisify(fs.readFile);

@booter('rest')
export class RestBooter extends BaseArtifactBooter {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE) public app: Application,
    @inject(BootBindings.PROJECT_ROOT) projectRoot: string,
    @config()
    public booterConfig: ArtifactOptions = {},
  ) {
    super(
      projectRoot,
      // Set booter options if passed in via bootConfig
      Object.assign({}, RestDefaults, booterConfig),
    );
  }

  async configure(): Promise<void> {
    await super.configure();
    // TODO: scan extensions contributing API patterns
    console.log('rootDir', this.projectRoot);
    console.log('dirs', this.dirs);
  }

  async load(): Promise<void> {
    // Important: don't call `super.load()` here, it would try to load
    // classes via `loadClassesFromFiles` - that does not make sense for JSON
    // files
    await Promise.all(this.discovered.map(f => this.setupModel(f)));
  }

  async setupModel(configFile: string): Promise<void> {
    const cfg = JSON.parse(await readFile(configFile, {encoding: 'utf-8'}));
    debug(
      'Loaded model config from %s',
      path.relative(this.projectRoot, configFile),
      config,
    );

    const modelClass = await this.app.get<typeof Model & {prototype: Model}>(
      `models.${cfg.model}`,
    );

    // TODO: use ExtensionPoint to resolve the pattern
    if (cfg.pattern !== 'CrudRest') {
      throw new Error(`Unsupported API pattern ${cfg.pattern}`);
    }
    const controllerClass = createCrudRestController(modelClass, cfg);

    this.app.controller(controllerClass);

    debug('Registered controller class', controllerClass.name);
  }
}

function createCrudRestController(
  modelClass: typeof Model & {prototype: Model},
  modelConfig: ModelConfig,
): ControllerClass {
  if (!(modelClass.prototype instanceof Entity)) {
    throw new Error(
      `CrudRestController requires an Entity, Models are not supported. (Model name: ${modelClass.name})`,
    );
  }
  const entityClass = modelClass as (typeof Entity & {prototype: Entity});

  const CrudRestController = defineCrudRestController(
    entityClass,
    // important - forward the entire config object to allow controller
    // factories to accept additional (custom) config options
    modelConfig,
  );

  const factory = new Function(
    'entityClass',
    'CrudRestController',
    'DefaultCrudRepository',
    `
  return class ${entityClass.name}Controller extends CrudRestController {
    constructor(db) {
      const repo = new DefaultCrudRepository(entityClass, db);
      super(repo);
    }
  };
  `,
  );
  const controllerClass = factory(
    entityClass,
    CrudRestController,
    DefaultCrudRepository,
  );

  inject(`datasources.${modelConfig.dataSource}`)(
    controllerClass,
    // FIXME(bajtos) fix our decorator typedefs to accept undefined member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undefined as any,
    0,
  );

  return controllerClass;
}

/**
 * Default ArtifactOptions for ControllerBooter.
 */
export const RestDefaults: ArtifactOptions = {
  dirs: [
    // public-models should live outside of "dist"
    '../public-models',
  ],
  extensions: ['.config.json'],
  nested: true,
};

export type ModelConfig = {
  model: string;
  pattern: string;
  dataSource: string;
  basePath: string;
  [patternSpecificSetting: string]: unknown;
};
