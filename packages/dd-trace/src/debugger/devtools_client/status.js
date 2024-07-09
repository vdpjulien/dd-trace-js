'use strict'

const { inspect } = require('node:util')
const request = require('../../exporters/common/request')
const FormData = require('../../exporters/common/form-data')

module.exports = {
  ackReceived,
  ackInstalled,
  ackEmitting,
  ackError
}

const STATUSES = {
  RECEIVED: 'RECEIVED',
  INSTALLED: 'INSTALLED',
  EMITTING: 'EMITTING',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  BLOCKED: 'BLOCKED'
}

function ackReceived ({ id: probeId, version }) {
  send(statusPayload(probeId, version, STATUSES.RECEIVED, `Received definition for probe ${probeId}.`))
}

function ackInstalled ({ id: probeId, version }) {
  send(statusPayload(probeId, version, STATUSES.INSTALLED, `Instrumented probe ${probeId}.`))
}

function ackEmitting ({ id: probeId, version }) {
  send(statusPayload(probeId, version, STATUSES.EMITTING, `Instrumented probe ${probeId}.`))
}

function ackError (err, { id: probeId, version }) {
  const payload = statusPayload(probeId, version, STATUSES.ERROR, err.message)
  payload.debugger.diagnostics.exception = {
    type: err.code,
    message: err.message,
    stacktrace: err.stack
  }
  send(payload)
}

function send (payload) {
  process._rawDebug('Diagnostics request event.json:', inspect(payload, { depth: null, colors: true })) // TODO: Remove

  const form = new FormData()

  form.append(
    'event',
    JSON.stringify(payload),
    { filename: 'event.json', contentType: 'application/json; charset=utf-8' }
  )

  const options = {
    method: 'POST',
    url: 'http://localhost:8126/debugger/v1/diagnostics', // TODO: Get host/port from tracer config
    headers: form.getHeaders()
  }

  process._rawDebug('Diagnostics request options:', options) // TODO: Remove

  request(form, options, (err, data, statusCode) => {
    if (err) throw err // TODO: Handle error
    process._rawDebug('Response:', { statusCode }) // TODO: Remove
    process._rawDebug('Response body:', JSON.parse(data)) // TODO: Remove
  })
}

function statusPayload (probeId, version, status, message) {
  return {
    ddsource: 'dd_debugger',
    message,
    debugger: {
      diagnostics: { probeId, version, status }
    }
  }
}
