'use strict'

const { hostname } = require('node:os')
const { inspect } = require('node:util')
const request = require('../../exporters/common/request')
const uuid = require('crypto-randomuuid')

const host = hostname()

const opts = {
  method: 'POST',
  url: 'http://localhost:8126/debugger/v1/input', // TODO: Get host/port from tracer config
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'text/plain' // TODO: This seems wrong
  }
}

// TODO: Figure out correct logger values
const logger = {
  name: __filename,
  method: '<module>',
  thread_name: `${process.argv0};pid:${process.pid}`,
  thread_id: 42,
  version: 2
}

const ddsource = 'dd_debugger'

module.exports = async function send ({ probe: { id, version, location, language }, service, message }) {
  const payload = {
    service,
    debugger: { // TODO: Technically more efficient to use "debugger.snapshot" key
      snapshot: {
        id: uuid(),
        timestamp: Date.now(),
        evaluationErrors: [],
        // evaluationErrors: [{ expr: 'foo == 42', message: 'foo' }],
        probe: { id, version, location },
        language
      }
    },
    host,
    logger,
    'dd.trace_id': null,
    'dd.span_id': null,
    ddsource,
    message,
    timestamp: Date.now()
    // ddtags: {}
  }

  process._rawDebug('Payload:', inspect(payload, { depth: null, colors: true })) // TODO: Remove

  request(JSON.stringify(payload), opts, (err, data, statusCode) => {
    if (err) throw err // TODO: Handle error
    process._rawDebug('Response:', { statusCode }) // TODO: Remove
    process._rawDebug('Response body:', JSON.parse(data)) // TODO: Remove
  })
}
