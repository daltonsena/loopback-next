import {juggler} from '@loopback/repository';
import {
  AddressRepository,
  CustomerRepository,
  OrderRepository,
  ShipmentRepository,
} from './fixtures/repositories';

export function givenBoundCrudRepositories(db: juggler.DataSource) {
  const customerRepo: CustomerRepository = new CustomerRepository(
    db,
    async () => orderRepo,
    async () => addressRepo,
  );
  const orderRepo: OrderRepository = new OrderRepository(
    db,
    async () => customerRepo,
    async () => shipmentRepo,
  );
  const shipmentRepo: ShipmentRepository = new ShipmentRepository(
    db,
    async () => orderRepo,
  );
  const addressRepo: AddressRepository = new AddressRepository(
    db,
    async () => customerRepo,
  );

  return {customerRepo, orderRepo, shipmentRepo, addressRepo};
}
