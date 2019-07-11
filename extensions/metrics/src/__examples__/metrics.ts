// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/rest-explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RestApplication} from '@loopback/rest';
import {MetricsComponent} from '../';

async function main() {
  const app = new RestApplication({rest: {port: process.env.PORT || 3000}});
  app.component(MetricsComponent);
  await app.start();
  console.log(app.restServer.url);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
