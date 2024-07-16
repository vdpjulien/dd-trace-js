'use strict'

const { join } = require('node:path')
const { Worker, MessageChannel } = require('node:worker_threads')
const log = require('../log')

let worker = null

exports.start = function (rc) {
  if (worker !== null) return

  log.debug('Starting Dynamic Instrumentation client...')

  rc.on('LIVE_DEBUGGING', (action, conf) => {
    rcChannel.port2.postMessage({ action, conf })
  })

  rc.on('LIVE_DEBUGGING_SYMBOL_DB', (action, conf) => {
    // TODO: Implement
    process._rawDebug('-- RC: LIVE_DEBUGGING_SYMBOL_DB', action, conf)
  })

  const rcChannel = new MessageChannel()

  worker = new Worker(
    join(__dirname, 'devtools_client', 'index.js'),
    {
      execArgv: [], // Avoid worker thread inheriting the `-r` command line argument
      workerData: { rcPort: rcChannel.port1 },
      transferList: [rcChannel.port1]
    }
  )

  worker.unref()

  worker.on('online', () => {
    log.debug(`Dynamic Instrumentation worker thread started successfully (thread id: ${worker.threadId})`)
  })

  // TODO: How should we handle errors?
  worker.on('error', (err) => process._rawDebug('DevTools client error:', err))

  // TODO: How should we handle exits?
  worker.on('exit', (code) => {
    log.debug(`Dynamic Instrumentation worker thread exited with code ${code}`)
    if (code !== 0) {
      throw new Error(`DevTools client stopped with unexpected exit code: ${code}`)
    }
  })
}
