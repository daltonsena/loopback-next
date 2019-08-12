// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {EntityNotFoundError, Filter} from '@loopback/repository';
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
import {Address, Customer} from '../fixtures/models';
import {AddressRepository, CustomerRepository} from '../fixtures/repositories';
import {givenBoundCrudRepositories} from '../helpers';

export function hasOneRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  describe('hasOne relation (acceptance)', () => {
    let customerRepo: CustomerRepository;
    let addressRepo: AddressRepository;
    let existingCustomerId: string;

    before(deleteAllModelsInDefaultDataSource);

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        ({customerRepo, addressRepo} = givenBoundCrudRepositories(
          ctx.dataSource,
        ));
        const models = [Customer, Address];
        await ctx.dataSource.automigrate(models.map(m => m.name));
      }),
    );

    beforeEach(async () => {
      await addressRepo.deleteAll();
      existingCustomerId = (await givenPersistedCustomerInstance()).id;
      // convert the type as it is generated as type number(in-memory, MySQL) or objectid(Mongo)
      existingCustomerId = existingCustomerId.toString();
    });

    it('can create an instance of the related model', async () => {
      const address = await createCustomerAddress(existingCustomerId, {
        street: '123 test avenue',
      });
      expect(address.toObject()).to.containDeep({
        customerId: existingCustomerId,
        street: '123 test avenue',
      });

      expect(address.customerId).eql(existingCustomerId);

      const persisted = await addressRepo.findById(address.id);
      expect(persisted.toObject()).to.deepEqual(address.toObject());
    });

    // We do not enforce referential integrity at the moment. It is up to
    // our users to set up unique constraint(s) between related models at the
    // database level
    it.skip('refuses to create related model instance twice', async () => {
      const address = await createCustomerAddress(existingCustomerId, {
        street: '123 test avenue',
      });
      await expect(
        createCustomerAddress(existingCustomerId, {
          street: '456 test street',
        }),
      ).to.be.rejectedWith(/Duplicate entry for Address.customerId/);
      expect(address.toObject()).to.containDeep({
        customerId: existingCustomerId,
        street: '123 test avenue',
      });

      const persisted = await addressRepo.findById(address.id);
      expect(persisted.toObject()).to.deepEqual(address.toObject());
    });

    it('can find instance of the related model', async () => {
      const address = await createCustomerAddress(existingCustomerId, {
        street: '123 test avenue',
      });
      const foundAddress = await findCustomerAddress(existingCustomerId);
      expect(foundAddress).to.containEql(address);
      expect(toJSON(foundAddress)).to.deepEqual(toJSON(address));

      const persisted = await addressRepo.find({
        where: {customerId: existingCustomerId},
      });
      expect(persisted[0]).to.deepEqual(foundAddress);
    });

    // FIXME(b-admike): make sure the test fails with compiler error
    it.skip('ignores where filter to find related model instance', async () => {
      const foundAddress = await findCustomerAddressWithFilter(
        existingCustomerId,
        // the compiler should complain that the where field is
        // not accepted in the filter object for the get() method
        // if the following line is uncommented
        {
          where: {street: '456 test road'},
        },
      );

      const persisted = await addressRepo.find({
        where: {customerId: existingCustomerId},
      });
      // TODO: make sure this test fails when where condition is supplied
      // compiler should have errored out (?)
      expect(persisted[0]).to.deepEqual(foundAddress);
    });

    it('reports EntityNotFound error when related model is deleted', async () => {
      const address = await createCustomerAddress(existingCustomerId, {
        street: '123 test avenue',
      });
      await addressRepo.deleteById(address.id);

      await expect(findCustomerAddress(existingCustomerId)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('can PATCH hasOne instances', async () => {
      const address = await createCustomerAddress(existingCustomerId, {
        street: '1 Amedee Bonnet',
        zipcode: '69740',
        city: 'Genas',
        province: 'Rhone',
      });

      const patchObject = {city: 'Lyon-Genas'};
      const arePatched = await patchCustomerAddress(
        existingCustomerId,
        patchObject,
      );

      expect(arePatched).to.deepEqual({count: 1});
      const patchedData = await addressRepo.findById(address.id);
      // make mongo happy
      if (features.convertIdType) {
        address.id = address.id.toString();
      }

      expect(toJSON(patchedData)).to.deepEqual({
        id: address.id,
        customerId: existingCustomerId,
        street: '1 Amedee Bonnet',
        zipcode: '69740',
        city: 'Lyon-Genas',
        province: 'Rhone',
      });
    });

    it('patches the related instance only', async () => {
      const bob = await customerRepo.create({name: 'Bob'});
      await customerRepo.address(bob.id).create({city: 'Paris'});

      const alice = await customerRepo.create({name: 'Alice'});
      await customerRepo.address(alice.id).create({city: 'London'});

      const result = await patchCustomerAddress(alice.id, {
        city: 'New York',
      });

      expect(result).to.deepEqual({count: 1});

      const found = await customerRepo.address(bob.id).get();
      expect(toJSON(found)).to.containDeep({city: 'Paris'});
    });

    it('throws an error when PATCH tries to change the foreignKey', async () => {
      await expect(
        patchCustomerAddress(existingCustomerId, {
          customerId: existingCustomerId + 1,
        }),
      ).to.be.rejectedWith(/Property "customerId" cannot be changed!/);
    });

    it('can DELETE hasOne relation instances', async () => {
      await createCustomerAddress(existingCustomerId, {
        street: '1 Amedee Bonnet',
        zipcode: '69740',
        city: 'Genas',
        province: 'Rhone',
      });

      const areDeleted = await deleteCustomerAddress(existingCustomerId);
      expect(areDeleted).to.deepEqual({count: 1});

      await expect(findCustomerAddress(existingCustomerId)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('deletes the related model instance only', async () => {
      const bob = await customerRepo.create({name: 'Bob'});
      await customerRepo.address(bob.id).create({city: 'Paris'});

      const alice = await customerRepo.create({name: 'Alice'});
      await customerRepo.address(alice.id).create({city: 'London'});

      const result = await deleteCustomerAddress(alice.id);

      expect(result).to.deepEqual({count: 1});

      const found = await addressRepo.find();
      expect(found).to.have.length(1);
    });

    /*---------------- HELPERS -----------------*/

    async function createCustomerAddress(
      customerId: string,
      addressData: Partial<Address>,
    ): Promise<Address> {
      return customerRepo.address(customerId).create(addressData);
    }

    async function findCustomerAddress(customerId: string) {
      return customerRepo.address(customerId).get();
    }

    async function findCustomerAddressWithFilter(
      customerId: string,
      filter: Filter<Address>,
    ) {
      return customerRepo.address(customerId).get(filter);
    }
    async function patchCustomerAddress(
      customerId: string,
      addressData: Partial<Address>,
    ) {
      return customerRepo.address(customerId).patch(addressData);
    }

    async function deleteCustomerAddress(customerId: string) {
      return customerRepo.address(customerId).delete();
    }

    async function givenPersistedCustomerInstance() {
      return customerRepo.create({name: 'a customer'});
    }
  });
}
