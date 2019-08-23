// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect, toJSON} from '@loopback/testlab';
import {buildLookupMap, InclusionResolver, reduceAsArray, findByForeignKeys} from '../../../..';
import {
  Category,
  CategoryRepository,
  Product,
  ProductRepository,
  testdb,
} from './relations-helpers-fixtures';
import { Entity } from '../../../../model';

describe('buildLoopupMap', () => {
  let productRepo: ProductRepository;
  let categoryRepo: CategoryRepository;

  before(() => {
    productRepo = new ProductRepository(testdb);
    categoryRepo = new CategoryRepository(testdb, async () => productRepo);
  });

  beforeEach(async () => {
    await productRepo.deleteAll();
    await categoryRepo.deleteAll();
  });

  it("get the result of using reduceAsArray strategy", async() => {
    const pens = await productRepo.create({name: 'pens', categoryId: 1});
    const pencils = await productRepo.create({name: 'pencils', categoryId: 1});
    const eraser = await productRepo.create({name: 'eraser', categoryId: 2});
    const products = await findByForeignKeys(productRepo, 'categoryId', 1);
    // const list = [{id: 1, name: 'product 1', categoryId: 1},
    //               {id: 2, name: 'product 2', categoryId: 1},
    //               {id: 3, name: 'product 3', categoryId: 2}
    //              ];
    const result = await buildLookupMap<Product[], Category[]>(products, 'categoryId', reduceAsArray);
    expect(result).to.be.eql([[pens, pencils]]);
    });
});
