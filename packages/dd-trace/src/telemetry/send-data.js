
const request = require('../exporters/common/request')

function getHeaders (config, application, reqType) {
  const headers = {
    'content-type': 'application/json',
    'dd-telemetry-api-version': 'v2',
    'dd-telemetry-request-type': reqType,
    'dd-client-library-language': application.language_name,
    'dd-client-library-version': application.tracer_version
  }
  const debug = config.telemetry && config.telemetry.debug
  if (debug) {
    headers['dd-telemetry-debug-enabled'] = 'true'
  }
  return headers
}

let seqId = 0

function getPayload (payload) {
  // Some telemetry endpoints payloads accept collections of elements such as the 'logs' endpoint.
  // 'logs' request type payload is meant to send library logs to Datadog’s backend.
  if (Array.isArray(payload)) {
    return payload
  } else {
    const { logger, tags, serviceMapping, ...trimmedPayload } = payload
    return trimmedPayload
  }
}

function sendData (config, application, host, reqType, payload = {}, cb = () => {}) {
  const {
    hostname,
    port,
    url
  } = config

  let namingSchemaVer
  if (config.namingSchemaVer) {
    namingSchemaVer = parseInt(config.namingSchemaVer.charAt(1))
  } else {
    namingSchemaVer = ''
  }
  const options = {
    url,
    hostname,
    port,
    method: 'POST',
    path: '/telemetry/proxy/api/v2/apmtelemetry',
    headers: getHeaders(config, application, reqType)
  }
  const data = JSON.stringify({
    api_version: 'v2',
    naming_schema_version: namingSchemaVer,
    request_type: reqType,
    tracer_time: Math.floor(Date.now() / 1000),
    runtime_id: config.tags['runtime-id'],
    seq_id: ++seqId,
    payload: getPayload(payload),
    application,
    host
  })

  request(data, options, (error) => {
    if (error && process.env.DD_API_KEY) {
      const backendHeader = { 'DD-API-KEY': process.env.DD_API_KEY, ...options.headers }
      const backendOptions = {
        url: 'https://all-http-intake.logs.datad0g.com/api/v2/apmtelemetry',
        headers: backendHeader,
        ...options
      }
      request(data, backendOptions, () => {})
    }

    // call the callback function so that we can track the error and payload
    cb(error, { 'payload': payload, reqType: reqType })
  })
}

module.exports = { sendData }
