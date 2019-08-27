// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/extension-metrics
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RestApplication, RestServerConfig} from '@loopback/rest';
import {givenHttpServerConfig, supertest} from '@loopback/testlab';
import * as os from 'os';
import pEvent from 'p-event';
import * as path from 'path';
import {promisify} from 'util';
import {MetricsComponent} from '../..';
import {MetricsBindings} from '../../keys';
import {MetricsOptions} from '../../types';

const runShell = require('@loopback/build/bin/utils').runShell;

// Only run the test on Travis with Linux
const verb =
  process.env.TRAVIS && os.platform() === 'linux' ? describe : describe.skip;
verb('Metrics (with push gateway)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(30000);
  before(async () => {
    const child = runShell(
      path.join(__dirname, '../../../bin/start-pushgateway.sh'),
      [],
    );
    await pEvent(child, 'close');
  });

  after(async () => {
    const child = runShell(
      path.join(__dirname, '../../../bin/stop-pushgateway.sh'),
      [],
    );
    await pEvent(child, 'close');
  });

  let app: RestApplication;
  const gwUrl = 'http://127.0.0.1:9091';

  afterEach(async () => {
    if (app) await app.stop();
    (app as unknown) = undefined;
  });

  beforeEach(async () => {
    await givenAppWithCustomConfig({
      // Push metrics each 10 ms
      pushGateway: {url: gwUrl, interval: 10},
    });
  });

  it('pushes metrics to gateway', async () => {
    // Wait for 100 ms
    await promisify(setTimeout)(100);
    const request = supertest(gwUrl);
    // Now we expect to get LoopBack metrics from the push gateway
    await request.get('/metrics').expect(200, /job="loopback"/);
  });

  async function givenAppWithCustomConfig(config: MetricsOptions) {
    app = givenRestApplication();
    app.configure(MetricsBindings.COMPONENT).to(config);
    app.component(MetricsComponent);
    await app.start();
  }

  function givenRestApplication(config?: RestServerConfig) {
    const rest = Object.assign({}, givenHttpServerConfig(), config);
    return new RestApplication({rest});
  }
});
