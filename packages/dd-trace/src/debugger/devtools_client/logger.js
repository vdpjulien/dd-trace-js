'use strict'

const { workerData: { logPort } } = require('node:worker_threads')

const logLevels = ['debug', 'info', 'warn', 'error']
const logger = {}

for (const level of logLevels) {
  // TODO: Only send back meesage to the parentPort if log level is active
  logger[level] = (...args) => logPort.postMessage({ level, args })
}

module.exports = logger
