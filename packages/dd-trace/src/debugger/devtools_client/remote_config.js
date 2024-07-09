'use strict'

const { workerData: { rcPort } } = require('node:worker_threads')
const { scripts, probes, breakpoints } = require('./state')
const log = require('./logger')
const session = require('./session')
const { ackReceived, ackInstalled, ackError } = require('./status')

let sessionStarted = false

rcPort.on('message', ({ action, conf }) => {
  if (!sessionStarted) {
    start()
      .then(() => {
        processMsg(action, conf).catch(processMsgErrorHandler)
      })
      .catch(startupErrorHandler)
  } else {
    processMsg(action, conf).catch(processMsgErrorHandler)
  }
})

function startupErrorHandler (err) {
  // TODO: Handle error: If we can't start, we should disable all of DI
  throw err
}

function processMsgErrorHandler (err) {
  // TODO: Handle error
  throw err
}

async function start () {
  sessionStarted = true
  await session.post('Debugger.enable')
}

async function stop () {
  sessionStarted = false
  await session.post('Debugger.disable')
}

async function processMsg (action, conf) {
  log.debug('Processing probe update of type "%s" with config:', action, conf)

  ackReceived(conf)

  switch (action) {
    case 'unapply':
      await removeBreakpoint(conf)
      break
    case 'apply':
      await addBreakpoint(conf)
      break
    case 'modify':
      await removeBreakpoint(conf)
      await addBreakpoint(conf)
      break
    default:
      throw new Error(`Unknown remote configuration action: ${action}`)
  }
}

async function addBreakpoint (conf) {
  // TODO: Figure out what to do about the full path
  const path = `file:///Users/thomas.watson/go/src/github.com/DataDog/debugger-demos/nodejs/${conf.where.sourceFile}`

  try {
    const { breakpointId } = await session.post('Debugger.setBreakpoint', {
      location: {
        scriptId: scripts.get(path),
        // TODO: Support multiple lines
        lineNumber: conf.where.lines[0] - 1 // Beware! lineNumber is zero-indexed
      }
      // TODO: Support conditions
      // condition: "request.params.name === 'break'"
    })

    probes.set(conf.id, breakpointId)
    breakpoints.set(breakpointId, conf)

    ackInstalled(conf)
  } catch (err) {
    log.error(err) // TODO: Is there a standard format og loggering errors from the tracer?
    ackError(err, conf)
  }
}

async function removeBreakpoint ({ id }) {
  if (!probes.has(id)) {
    throw new Error(`Unknown prope id: ${id}`) // TODO: Log error instead
  }
  const breakpointId = probes.get(id)
  await session.post('Debugger.removeBreakpoint', { breakpointId })
  probes.delete(id)
  breakpoints.delete(breakpointId)

  if (breakpoints.size === 0) await stop()
}
