// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  DefaultCrudRepository,
  Entity,
  juggler,
  model,
  property,
} from '@loopback/repository';
import {expect} from '@loopback/testlab';
import {
  deleteAllModelsInDefaultDataSource,
  withCrudCtx,
} from '../helpers.repository-tests';
import {
  CrudFeatures,
  CrudRepositoryCtor,
  CrudTestContext,
  DataSourceOptions,
} from '../types.repository-tests';

export function nestedModelsPropertiesSuite(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  // This test shows the recommended way how to use @loopback/repository
  // together with existing connectors when building LoopBack applications
  describe('Nested models properties', () => {
    let db: juggler.DataSource;

    before(deleteAllModelsInDefaultDataSource);

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        db = ctx.dataSource;
      }),
    );

    it('allows models to allow nested model properties', async () => {
      @model()
      class Role extends Entity {
        @property()
        name: string;
      }

      @model()
      class Address extends Entity {
        @property()
        street: string;
      }

      @model()
      class User extends Entity {
        @property({
          type: 'number',
          id: true,
          generated: true,
        })
        id: number;

        @property({type: 'string'})
        name: string;

        @property.array(Role)
        roles: Role[];

        @property()
        address: Address;
      }

      const userRepo = new DefaultCrudRepository<
        User,
        typeof User.prototype.id
      >(User, db);

      const models = [User, Role, Address];
      await db.automigrate(models.map(m => m.name));

      const user = {
        name: 'foo',
        roles: [{name: 'admin'}, {name: 'user'}],
        address: {street: 'backstreet'},
      };
      const created = await userRepo.create(user);

      const stored = await userRepo.findById(created.id);
      expect(stored).to.containDeep(user);
    });
  });
}
