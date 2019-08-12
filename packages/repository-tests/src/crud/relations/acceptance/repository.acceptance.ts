// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  AnyObject,
  DefaultCrudRepository,
  Entity,
  model,
  property,
} from '@loopback/repository';
import {juggler} from '@loopback/repository/src';
import {expect, skipIf} from '@loopback/testlab';
import {Suite} from 'mocha';
import {
  CrudFeatures,
  CrudRepositoryCtor,
  CrudTestContext,
  DataSourceOptions,
} from '../../..';
import {
  deleteAllModelsInDefaultDataSource,
  withCrudCtx,
} from '../../../helpers.repository-tests';
import {Product} from '../fixtures/models';
import {ProductRepository} from '../fixtures/repositories';

export function hasOneRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  // This test shows the recommended way how to use @loopback/repository
  // together with existing connectors when building LoopBack applications
  describe('Repository in Thinking in LoopBack', () => {
    let repo: ProductRepository;
    let db: juggler.DataSource;

    before(deleteAllModelsInDefaultDataSource);

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        db = ctx.dataSource;
        Product.definition.properties.id.type = features.idType;
        givenProductRepository();
        await ctx.dataSource.automigrate(Product.name);
      }),
    );

    beforeEach(() => repo.deleteAll());

    it('counts models in empty database', async () => {
      expect(await repo.count()).to.deepEqual({count: 0});
    });

    it('creates a new model', async () => {
      const p: Product = await repo.create({name: 'Ink Pen', slug: 'pen'});
      expect(p).instanceof(Product);
      expect.exists(p.id);
    });

    it('can save a model', async () => {
      const p = await repo.create({slug: 'pencil'});

      p.name = 'Red Pencil';
      await repo.save(p);

      await repo.findById(p.id);
      expect(p).to.have.properties({
        slug: 'pencil',
        name: 'Red Pencil',
      });
    });

    it('rejects extra model properties (defaults to strict mode)', async () => {
      await expect(
        repo.create({
          name: 'custom',
          extra: 'additional-data',
        } as AnyObject),
      ).to.be.rejectedWith(/extra.*not defined/);
    });
    // skip this test for MySQL
    skipIf<[(this: Suite) => void], void>(
      !features.freeFormProperties,
      describe,
      'allows models to allow additional properties',
      () => {
        it('allows models to allow additional properties', async () => {
          // TODO(bajtos) Add syntactic sugar to allow the following usage:
          //    @model({strict: false})
          @model({settings: {strict: false}})
          class Flexible extends Entity {
            @property({id: true})
            id: number;
          }
          const flexibleRepo = new DefaultCrudRepository<
            Flexible,
            typeof Flexible.prototype.id
          >(Flexible, db);

          const created = await flexibleRepo.create({
            extra: 'additional data',
          } as AnyObject);
          const stored = await flexibleRepo.findById(created.id);
          expect(stored).to.containDeep({extra: 'additional data'});
        });
      },
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

    function givenProductRepository() {
      repo = new ProductRepository(db);
    }
  });
}
