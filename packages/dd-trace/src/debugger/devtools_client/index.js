'use strict'

const { breakpoints } = require('./state')
const session = require('./session')
const { getLocalStateForBreakpoint, toObject } = require('./snapshot')
const send = require('./send')
const { ackEmitting } = require('./status')
require('./remote_config')
const log = require('../../log')

// The `session.connectToMainThread()` method called above doesn't "register" any active handles, so the worker thread
// will exit with code 0 once when reaches the end of the file unless we do something to keep it alive:
setInterval(() => {}, 1000 * 60)

session.on('Debugger.paused', async ({ params }) => {
  const start = process.hrtime.bigint()
  const conf = breakpoints.get(params.hitBreakpoints[0]) // TODO: Handle multiple breakpoints
  const state = conf.captureSnapshot ? await getLocalStateForBreakpoint(params) : undefined
  await session.post('Debugger.resume')
  const diff = process.hrtime.bigint() - start // TODO: Should we log this using some sort of telemetry?

  await send({
    probe: {
      id: conf.id,
      version: conf.version, // TODO: Is this the same version?
      location: {
        file: conf.where.sourceFile,
        lines: conf.where.lines // TODO: Is it right to give the whole array here?
      },
      language: conf.language
    },
    service: 'watson-nodejs-demo-app', // TODO: Get this from tracer config
    message: conf.template // TODO: Process template
  })

  ackEmitting(conf)

  // TODO: Remove before shipping
  log.debug(
    '\nLocal state:\n' +
    '--------------------------------------------------\n' +
    stateToString(state) +
    '--------------------------------------------------\n' +
    '\nStats:\n' +
    '--------------------------------------------------\n' +
    `   Total state JSON size: ${JSON.stringify(state).length} bytes\n` +
    `Processed was paused for: ${Number(diff) / 1000000} ms\n` +
    '--------------------------------------------------\n'
  )
})

// TODO: Remove this function before shipping
function stateToString (state) {
  if (state === undefined) return '<not captured>'
  state = toObject(state)
  let str = ''
  for (const [name, value] of Object.entries(state)) {
    str += `${name}: ${color(value)}\n`
  }
  return str
}

// TODO: Remove this function before shipping
function color (obj) {
  return require('node:util').inspect(obj, { depth: null, colors: true })
}
