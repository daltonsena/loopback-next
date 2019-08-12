// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  belongsTo,
  Entity,
  hasMany,
  hasOne,
  model,
  property,
} from '@loopback/repository';
import {Address, AddressWithRelations} from './address.model';
import {Order, OrderWithRelations} from './order.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
  },
})
export class Customer extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
  })
  name: string;

  @hasMany(() => Order)
  orders: Order[];

  @hasOne(() => Address)
  address: Address;

  @hasMany(() => Customer, {keyTo: 'parentId'})
  customers?: Customer[];

  @belongsTo(() => Customer)
  parentId?: string;
}

export interface CustomerRelations {
  address?: AddressWithRelations;
  orders?: OrderWithRelations[];
  customers?: CustomerWithRelations[];
  parentCustomer?: CustomerWithRelations;
}

export type CustomerWithRelations = Customer & CustomerRelations;
