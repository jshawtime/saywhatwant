/**
 * SayWhatWant Durable Objects Worker
 * 
 * Routes all requests to the MessageQueue Durable Object.
 * Clean, simple worker that just forwards to DO.
 */

import { MessageQueue } from './durable-objects/MessageQueue.js';

export { MessageQueue };

export default {
  async fetch(request, env, ctx) {
    // Get the Durable Object stub
    const id = env.MESSAGE_QUEUE.idFromName('global-queue');
    const stub = env.MESSAGE_QUEUE.get(id);
    
    // Forward request to DO
    return stub.fetch(request);
  }
};

