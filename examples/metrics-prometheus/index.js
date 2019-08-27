// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/example-metrics-prometheus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

const main = require('./dist').main;

if (require.main === module) {
  main().catch(err => {
    console.error('Fails to run examples.', err);
    process.exit(1);
  });
}
