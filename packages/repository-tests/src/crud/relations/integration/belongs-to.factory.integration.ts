// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  BelongsToAccessor,
  BelongsToDefinition,
  createBelongsToAccessor,
  Entity,
  EntityCrudRepository,
  EntityNotFoundError,
  Getter,
  juggler,
  ModelDefinition,
  RelationType,
} from '@loopback/repository';
import {expect} from '@loopback/testlab';
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

export function belongsToFactorySuite(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  // Given a Customer and Order models - see definitions at the bottom
  let db: juggler.DataSource;
  let customerRepo: EntityCrudRepository<
    Customer,
    typeof Customer.prototype.id
  >;
  let orderRepo: EntityCrudRepository<Order, typeof Order.prototype.id>;

  describe('BelongsTo relation (integration)', () => {
    let findCustomerOfOrder: BelongsToAccessor<
      Customer,
      typeof Order.prototype.id
    >;

    before(deleteAllModelsInDefaultDataSource);

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        db = ctx.dataSource;
        givenCrudRepositories();
        await ctx.dataSource.automigrate(Customer.name);
        await ctx.dataSource.automigrate(Order.name);
      }),
    );

    before(givenAccessor);
    beforeEach(async function resetDatabase() {
      await Promise.all([customerRepo.deleteAll(), orderRepo.deleteAll()]);
    });

    it('finds an instance of the related model', async () => {
      const customer = await customerRepo.create({
        name: 'Order McForder',
        orders: [],
      });
      const order = await orderRepo.create({
        customerId: customer.id,
        description: 'Order from Order McForder, the hoarder of Mordor',
      });

      const result = await findCustomerOfOrder(order.id);

      expect(result).to.deepEqual(customer);
    });

    it('throws EntityNotFound error when the related model does not exist', async () => {
      const order = await orderRepo.create({
        customerId: 999, // does not exist
        description: 'Order of a fictional customer',
      });

      await expect(findCustomerOfOrder(order.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    //--- HELPERS ---//

    function givenAccessor() {
      findCustomerOfOrder = createBelongsToAccessor(
        Order.definition.relations.customer as BelongsToDefinition,
        Getter.fromValue(customerRepo),
        orderRepo,
      );
    }
  });

  //--- HELPERS ---//

  class Order extends Entity {
    id: number;
    description: string;
    customerId: number;

    static definition = new ModelDefinition('Order')
      .addProperty('id', {type: features.idType, id: true, generated: true})
      .addProperty('description', {type: 'string', required: true})
      .addProperty('customerId', {type: features.idType, required: true})
      .addRelation({
        name: 'customer',
        type: RelationType.belongsTo,
        source: Order,
        target: () => Customer,
        keyFrom: 'customerId',
        keyTo: 'id',
      });
  }

  class Customer extends Entity {
    id: number;
    name: string;
    orders: Order[];

    static definition: ModelDefinition = new ModelDefinition('Customer')
      .addProperty('id', {type: features.idType, id: true, generated: true})
      .addProperty('name', {type: 'string', required: true})
      .addProperty('orders', {type: Order, array: true})
      .addRelation({
        name: 'orders',
        type: RelationType.hasMany,
        targetsMany: true,
        source: Customer,
        target: () => Order,
        keyTo: 'customerId',
      });
  }

  function givenCrudRepositories() {
    customerRepo = new repositoryClass(Customer, db);
    orderRepo = new repositoryClass(Order, db);
  }
}
