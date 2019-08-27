// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Customer, CustomerWithRelations} from './customer.model';

@model()
export class Address extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string | number;
  @property({
    type: 'string',
  })
  street: string;
  @property({
    type: 'string',
  })
  zipcode: string;
  @property({
    type: 'string',
  })
  city: string;
  @property({
    type: 'string',
  })
  province: string;

  @belongsTo(() => Customer)
  customerId: string | number;
}

export interface AddressRelations {
  customer?: CustomerWithRelations;
}

export type AddressWithRelations = Address & AddressRelations;
