// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/extension-metrics
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  asGlobalInterceptor,
  bind,
  BindingScope,
  Interceptor,
  InvocationContext,
  Provider,
  ValueOrPromise,
} from '@loopback/context';
import {Counter, Gauge, Histogram, Summary} from 'prom-client';

@bind(asGlobalInterceptor('metrics'), {scope: BindingScope.SINGLETON})
export class MetricsInterceptor implements Provider<Interceptor> {
  private gauge = new Gauge({
    name: 'loopback_invocation_duration_seconds',
    help: 'method invocation',
    labelNames: ['targetName'],
  });

  private histogram = new Histogram({
    name: 'loopback_invocation_duration_histogram',
    help: 'method invocation histogram',
    labelNames: ['targetName'],
  });

  private counter = new Counter({
    name: 'loopback_invocation_total',
    help: 'method invocation counts',
    labelNames: ['targetName'],
  });

  private summary = new Summary({
    name: 'loopback_invocation_duration_summary',
    help: 'method invocation summary',
    labelNames: ['targetName'],
  });

  constructor() {}

  value() {
    return this.intercept.bind(this);
  }

  async intercept<T>(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<T>,
  ) {
    const endGauge = this.gauge.startTimer({
      targetName: invocationCtx.targetName,
    });
    const endHistogram = this.histogram.startTimer({
      targetName: invocationCtx.targetName,
    });
    const endSummary = this.summary.startTimer({
      targetName: invocationCtx.targetName,
    });
    try {
      this.counter.inc();
      return await next();
    } finally {
      endGauge();
      endHistogram();
      endSummary();
    }
  }
}
