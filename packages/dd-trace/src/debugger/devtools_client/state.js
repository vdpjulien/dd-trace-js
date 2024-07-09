'use strict'

const session = require('./session')

const scripts = new Map()

module.exports = {
  scripts,
  probes: new Map(),
  breakpoints: new Map()
}

// Known params.url protocols:
// - `node:` - Ignored, as we don't want to instrument Node.js internals
// - `wasm:` - Ignored, as we don't support instrumenting WebAssembly
// - `file:` - Regular on disk file
// Unknown params.url values:
// - `structured-stack` - Not sure what this is, but should just be ignored
// - `` - Not sure what this is, but should just be ignored
session.on('Debugger.scriptParsed', ({ params }) => {
  if (params.url.startsWith('file:')) {
    scripts.set(params.url, params.scriptId)
  }
})
