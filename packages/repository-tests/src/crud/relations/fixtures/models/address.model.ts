// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Customer, CustomerWithRelations} from './customer.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
  },
})
export class Address extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;
  @property({
    type: 'string',
  })
  street: string;
  @property({
    type: 'string',
    default: '12345',
  })
  zipcode: string;
  @property({
    type: 'string',
    default: 'Toronto',
  })
  city: string;
  @property({
    type: 'string',
    default: 'Ontario',
  })
  province: string;

  @belongsTo(() => Customer)
  customerId: string;
}

export interface AddressRelations {
  customer?: CustomerWithRelations;
}

export type AddressWithRelations = Address & AddressRelations;
