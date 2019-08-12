// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect} from '@loopback/testlab';
import {
  deleteAllModelsInDefaultDataSource,
  withCrudCtx,
} from '../../../helpers.repository-tests';
import {
  CrudFeatures,
  CrudRepositoryCtor,
  CrudTestContext,
  DataSourceOptions,
} from '../../../types.repository-tests';
import {Customer, Order, Shipment} from '../fixtures/models';
import {
  CustomerRepository,
  OrderRepository,
  ShipmentRepository,
} from '../fixtures/repositories';
import {givenBoundCrudRepositories} from '../helpers';

export function belongsToRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  describe('BelongsTo relation (acceptance)', () => {
    before(deleteAllModelsInDefaultDataSource);

    // Given a Customer and Order models - see definitions at the bottom
    let customerRepo: CustomerRepository;
    let orderRepo: OrderRepository;
    let shipmentRepo: ShipmentRepository;

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        ({customerRepo, orderRepo, shipmentRepo} = givenBoundCrudRepositories(
          ctx.dataSource,
        ));
        const models = [Customer, Order, Shipment];
        await ctx.dataSource.automigrate(models.map(m => m.name));
      }),
    );

    beforeEach(async () => {
      await orderRepo.deleteAll();
    });

    it('can find customer of order', async () => {
      const customer = await customerRepo.create({
        name: 'Order McForder',
        parentId: '1',
      });
      const order = await orderRepo.create({
        customerId: customer.id,
        description: 'Order from Order McForder, the hoarder of Mordor',
      });

      const result = await orderRepo.customer(order.id);
      expect(result).to.deepEqual(customer);
    });

    it('can find shipment of order with a custom foreign key name', async () => {
      const shipment = await shipmentRepo.create({
        name: 'Tuesday morning shipment',
      });
      const order = await orderRepo.create({
        // eslint-disable-next-line @typescript-eslint/camelcase
        shipment_id: shipment.id,
        description: 'Order that is shipped Tuesday morning',
      });
      const result = await orderRepo.shipment(order.id);
      expect(result).to.deepEqual(shipment);
    });
  });
}
