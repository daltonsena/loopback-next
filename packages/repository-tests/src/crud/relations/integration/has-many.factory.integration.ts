// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  createHasManyRepositoryFactory,
  Entity,
  EntityCrudRepository,
  Getter,
  HasManyDefinition,
  HasManyRepository,
  HasManyRepositoryFactory,
  juggler,
  ModelDefinition,
  RelationType,
} from '@loopback/repository';
import {expect, toJSON} from '@loopback/testlab';
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

export function hasManyFactorySuite(
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
  let reviewRepo: EntityCrudRepository<Review, typeof Review.prototype.id>;

  describe('HasMany relation (integration)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingCustomerId: any;

    let customerOrderRepo: HasManyRepository<Order>;
    let customerAuthoredReviewFactoryFn: HasManyRepositoryFactory<
      Review,
      typeof Customer.prototype.id
    >;
    let customerApprovedReviewFactoryFn: HasManyRepositoryFactory<
      Review,
      typeof Customer.prototype.id
    >;

    before(deleteAllModelsInDefaultDataSource);

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        db = ctx.dataSource;
        givenCrudRepositories();
        await givenPersistedCustomerInstance();
        givenConstrainedRepositories();
        givenRepositoryFactoryFunctions();
        await ctx.dataSource.automigrate(Review.name);
        await ctx.dataSource.automigrate(Customer.name);
        await ctx.dataSource.automigrate(Order.name);
      }),
    );

    beforeEach(async function resetDatabase() {
      await orderRepo.deleteAll();
      await reviewRepo.deleteAll();
    });

    it('can create an instance of the related model', async () => {
      const order = await customerOrderRepo.create({
        description: 'an order desc',
        customerId: existingCustomerId,
      });
      const persisted = await orderRepo.findById(order.id);
      expect(toJSON(order)).to.deepEqual(toJSON(persisted));
    });

    it('can find an instance of the related model', async () => {
      const order = await customerOrderRepo.create({
        description: 'an order desc',
        customerId: existingCustomerId,
      });
      const notMyOrder = await orderRepo.create({
        description: "someone else's order desc",
        customerId: existingCustomerId + 1, // a different customerId,
      });

      const persistedOrders = await orderRepo.find({
        where: {
          customerId: existingCustomerId,
        },
      });

      const orders = await customerOrderRepo.find();
      expect(toJSON(orders)).to.deepEqual(toJSON(persistedOrders));
      expect(toJSON(orders)).to.containEql(toJSON(order));
      expect(toJSON(orders)).to.not.containEql(toJSON(notMyOrder));
    });

    it('finds appropriate related model instances for multiple relations', async () => {
      // note(shimks): roundabout way of creating reviews with 'approves'
      // ideally, the review repository should have a approve function
      // which should 'approve' a review
      // On another note, this test should be separated for 'create' and 'find'
      await customerAuthoredReviewFactoryFn(existingCustomerId).create({
        description: 'my wonderful review',
        approvedId: existingCustomerId + 1,
      });
      await customerAuthoredReviewFactoryFn(existingCustomerId + 1).create({
        description: 'smash that progenitor loving approve button',
        approvedId: existingCustomerId,
      });

      const reviewsApprovedByCustomerOne = await customerApprovedReviewFactoryFn(
        existingCustomerId,
      ).find();
      const reviewsApprovedByCustomerTwo = await customerApprovedReviewFactoryFn(
        existingCustomerId + 1,
      ).find();

      const persistedReviewsApprovedByCustomerOne = await reviewRepo.find({
        where: {
          approvedId: existingCustomerId,
        },
      });
      const persistedReviewsApprovedByCustomerTwo = await reviewRepo.find({
        where: {
          approvedId: existingCustomerId + 1,
        },
      });

      expect(reviewsApprovedByCustomerOne).to.eql(
        persistedReviewsApprovedByCustomerOne,
      );
      expect(reviewsApprovedByCustomerTwo).to.eql(
        persistedReviewsApprovedByCustomerTwo,
      );
    });

    //--- HELPERS ---//

    async function givenPersistedCustomerInstance() {
      const customer = await customerRepo.create({name: 'a customer'});
      existingCustomerId = customer.id;
    }

    function givenConstrainedRepositories() {
      const orderFactoryFn = createHasManyRepositoryFactory<
        Order,
        typeof Order.prototype.id,
        typeof Customer.prototype.id
      >(
        Customer.definition.relations.orders as HasManyDefinition,
        Getter.fromValue(orderRepo),
      );

      customerOrderRepo = orderFactoryFn(existingCustomerId);
    }

    function givenRepositoryFactoryFunctions() {
      customerAuthoredReviewFactoryFn = createHasManyRepositoryFactory(
        Customer.definition.relations.reviewsAuthored as HasManyDefinition,
        Getter.fromValue(reviewRepo),
      );
      customerApprovedReviewFactoryFn = createHasManyRepositoryFactory(
        Customer.definition.relations.reviewsApproved as HasManyDefinition,
        Getter.fromValue(reviewRepo),
      );
    }
  });

  function givenCrudRepositories() {
    customerRepo = new repositoryClass(Customer, db);
    orderRepo = new repositoryClass(Order, db);
    reviewRepo = new repositoryClass(Review, db);
  }

  //--- HELPERS ---//

  class Order extends Entity {
    id: string;
    description: string;
    customerId: string;

    static definition = new ModelDefinition('Order')
      .addProperty('id', {type: features.idType, id: true, generated: true})
      .addProperty('description', {type: 'string', required: true})
      .addProperty('customerId', {type: 'string'})
      .addRelation({
        name: 'customer',
        type: RelationType.belongsTo,
        source: Order,
        target: () => Customer,
        keyFrom: 'customerId',
        keyTo: 'id',
      });
  }

  class Review extends Entity {
    id: string;
    description: string;
    authorId: string;
    approvedId: string;

    static definition = new ModelDefinition('Review')
      .addProperty('id', {type: features.idType, id: true, generated: true})
      .addProperty('description', {type: 'string', required: true})
      .addProperty('authorId', {type: features.idType, required: false})
      .addProperty('approvedId', {type: features.idType, required: false});
  }

  class Customer extends Entity {
    id: string;
    name: string;
    orders: Order[];
    reviewsAuthored: Review[];
    reviewsApproved: Review[];

    static definition: ModelDefinition = new ModelDefinition('Customer')
      .addProperty('id', {type: features.idType, id: true, generated: true})
      .addProperty('name', {type: 'string', required: true})
      .addProperty('orders', {type: Order, array: true})
      .addProperty('reviewsAuthored', {type: Review, array: true})
      .addProperty('reviewsApproved', {type: Review, array: true})
      .addRelation({
        name: 'orders',
        type: RelationType.hasMany,
        targetsMany: true,
        source: Customer,
        target: () => Order,
        keyTo: 'customerId',
      })
      .addRelation({
        name: 'reviewsAuthored',
        type: RelationType.hasMany,
        targetsMany: true,
        source: Customer,
        target: () => Review,
        keyTo: 'authorId',
      })
      .addRelation({
        name: 'reviewsApproved',
        type: RelationType.hasMany,
        targetsMany: true,
        source: Customer,
        target: () => Review,
        keyTo: 'approvedId',
      });
  }
}
