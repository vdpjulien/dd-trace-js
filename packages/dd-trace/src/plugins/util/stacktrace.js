'use strict'

const { relative, sep } = require('path')

const cwd = process.cwd()

module.exports = {
  getCallSites,
  getUserLandCallsites,
  getTopUserLandCallsite,
  getRelativeFilename,
  getSpanOriginTags
}

// From https://github.com/felixge/node-stack-trace/blob/ba06dcdb50d465cd440d84a563836e293b360427/index.js#L1
function getCallSites (constructorOpt) {
  const oldLimit = Error.stackTraceLimit
  Error.stackTraceLimit = Infinity

  const dummy = {}

  const v8Handler = Error.prepareStackTrace
  Error.prepareStackTrace = function (_, v8StackTrace) {
    return v8StackTrace
  }
  Error.captureStackTrace(dummy, constructorOpt)

  const v8StackTrace = dummy.stack
  Error.prepareStackTrace = v8Handler
  Error.stackTraceLimit = oldLimit

  return v8StackTrace
}

function getUserLandCallsites (constructorOpt = getUserLandCallsites) {
  const callsites = getCallSites(constructorOpt)
  for (let i = 0; i < callsites.length; i++) {
    const fullPath = callsites[i].getFileName()

    if (fullPath === null) {
      continue
    }
    // *.mjs paths start with the "file://" protocol because ESM supports https imports
    const containsFileProtocol = fullPath.startsWith('file://')
    if (fullPath.startsWith(cwd, containsFileProtocol ? 7 : 0) === false) {
      continue
    }
    const relativePath = getRelativeFilename(fullPath, containsFileProtocol)
    if (relativePath.startsWith('node_modules' + sep) || relativePath.includes(sep + 'node_modules' + sep)) {
      continue
    }

    return i === 0 ? callsites : callsites.slice(i)
  }
}

function getTopUserLandCallsite (constructorOpt) {
  const callsites = getUserLandCallsites(constructorOpt)
  return callsites && callsites[0]
}

// *.mjs paths start with the "file://" protocol because ESM supports https imports
function getRelativeFilename (filename, containsFileProtocol = filename.startsWith('file://')) {
  return relative(cwd, containsFileProtocol ? filename.substring(7) : filename)
}

// TODO: This should be somewhere else specifically related to Span Origin
function getSpanOriginTags (callsite) {
  if (!callsite) return
  const file = callsite.getFileName()
  const line = callsite.getLineNumber()
  const method = callsite.getFunctionName()
  return method
    ? {
        '_dd.entry_location.file': file,
        '_dd.entry_location.line': String(line),
        '_dd.entry_location.method': method
      }
    : {
        '_dd.entry_location.file': file,
        '_dd.entry_location.line': String(line)
      }
}
