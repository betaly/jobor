# Jobor: Advanced Job Queue Management for Node.js

Jobor is a versatile job queue management system for Node.js applications, allowing developers to schedule and process
jobs efficiently. It supports both in-memory and persistent job bufstore solutions, and it offers a flexible approach to
processing jobs either on the server or in worker processes.

## Features

- **Flexible Processing Modes**: Choose between server or worker modes to process jobs where it makes the most sense for
  your application.
- **Multiple Queue Adapters**: Supports in-memory queues for development and BullMQ for robust, production-ready
  queuing.
- **Extensible Storage Options**: Built-in support for in-memory bufstore, with the ability to extend to Redis for
  distributed, persistent job queues.
- **Process Contexts**: Manage process modes dynamically within your application to optimize resource utilization.
- **Robust and Scalable**: Designed to handle both small-scale applications and large, distributed systems.

## Installation

```bash
npm install jobor
# or
yarn add jobor
```

## Getting Started

```ts
import {Jobor} from 'jobor';

// Initialize Jobor with BullMQ adapter and Redis bufstore
const jobor = new Jobor({
  adapter: {name: 'bullmq'},
  bufstore: {name: 'redis'},
  processMode: 'server',
});
```

### Create Queues

```ts
const queue = jobor.createQueue({
  name: 'send-email',
  process: async job => {
    // Replace with your email sending logic
    console.log(`Email sent to ${job.data.to}`);
  },
});
```

### Add Jobs to the Queue

```ts
import {Job} from 'jobor';

await queue.add(
  new Job({
    name: 'send-email',
    data: {to: 'user@example.com', subject: 'Welcome!'},
  }),
);
console.log('Email job added to the queue.');
```

## Configuration

Configure Jobor to match the needs of your application:

```ts
const joborOptions = {
  adapter: {name: 'bullmq' /* BullMQ specific options */},
  bufstore: {name: 'redis' /* Redis specific options */},
  processMode: 'server', // Can be 'server' or 'worker'
};

const jobor = new Jobor(joborOptions);
```

## Process Mode

You can manage the processing context dynamically:

```ts
import {ProcessContext} from 'jobor';

// Set the global process mode
ProcessContext.setProcessMode('worker');

// Instantiate a new context
const processContext = new ProcessContext();

console.log(processContext.isServer); // false
console.log(processContext.isWorker); // true
```

## Server and Worker Modes

Jobor supports two processing modes:

- **Server**: The server mode is designed to process jobs in the same process as the application. This is useful for
  small-scale applications that do not require a dedicated worker process.
- **Worker**: The worker mode is designed to process jobs in a separate process from the application. This is useful for
  large-scale applications that require a dedicated worker process.

```ts
// Both server and worker process.
import {Jobor, Job} from 'jobor';

const jobor = new Jobor({
  adapter: {name: 'bullmq'}, // memory adapter is not supported in worker mode.
  bufstore: {name: 'redis'},
  processMode: 'server', // or 'worker' in worker process
});

const queue = jobor.createQueue({
  name: 'send-email',
  process: async job => {
    // Replace with your email sending logic
    console.log(`Email sent to ${job.data.to}`);
  },
});

// In `server` process
await queue.add(
  new Job({
    name: 'send-email',
    data: {to: 'tom@example.com', subject: 'Welcome!'},
  }),
);

console.log('Email job added to the queue.');

// In `worker` process
jobor.start();
```

## Queue Adapters

Jobor supports two queue adapters currently:

- **In-Memory**: A simple, in-memory queue adapter that is useful for development and testing.
- **BullMQ**: A robust, production-ready queue adapter that uses Redis for persistent bufstore.

### In-Memory Adapter

```ts
const {Jobor} = require('jobor');

const jobor = new Jobor({
  adapter: {
    name: 'memory',
    concurrency: 1, // Optional. Default is 1
    poolInterval: 200, // Optional. Default is 200ms
  },
});
```

### BullMQ Adapter

```ts
const {Jobor} = require('jobor');

const jobor = new Jobor({
  adapter: {
    name: 'bullmq',
    // BullMQ specific options
  },
});
```

## Storage

Jobor supports two bufstore options currently:

- **In-Memory**: A simple, in-memory bufstore solution that is useful for development and testing.
- **Redis**: A distributed, persistent bufstore solution that is useful for production applications.

### In-Memory Storage

```ts
const {Jobor} = require('jobor');

const jobor = new Jobor({
  bufstore: {name: 'memory'}, // No options
});
```

### Redis Storage

```ts
const {Jobor} = require('jobor');

const jobor = new Jobor({
  bufstore: {
    name: 'redis',
    // Redis specific options
  },
});
```

## Advanced Usage

Jobor is built to be extended:

- Create custom adapters by implementing the `JobQueueAdapter` interface.
- Develop custom bufstore solutions with the `JobBufStore` interface.

## Contributing

We welcome contributions of all kinds from the community! Please see the
[contributing guide](https://github.com/betaly/jobor/blob/main/CONTRIBUTING.md) for more information.

## License

Jobor is released under the [MIT License](https://github.com/betaly/jobor/blob/main/LICENSE).

## Support

Need help? Open an issue in our [GitHub repository](https://github.com/betaly/jobor/issues).

Remember to update the README with any specifics about your project, such as additional configuration options, features,
or examples that can help users get started with Jobor.
