// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/example-metrics-prometheus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {MetricsComponent} from '@loopback/extension-metrics';
import {RestApplication} from '@loopback/rest';

export async function main() {
  const app = new RestApplication({rest: {port: process.env.PORT || 3000}});
  app.component(MetricsComponent);
  await app.start();
  console.log(app.restServer.url);
}
