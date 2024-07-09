'use strict'

const { breakpoints } = require('./state')
const session = require('./session')

module.exports = {
  getLocalStateForBreakpoint,
  toObject
}

async function getLocalStateForBreakpoint (params) {
  const scope = params.callFrames[0].scopeChain[0]
  if (scope.type !== 'local') {
    throw new Error(`Unexpcted scope type: ${scope.type}`)
  }
  const conf = breakpoints.get(params.hitBreakpoints[0]) // TODO: Handle multiple breakpoints
  return await getObjectWithChildren(scope.object.objectId, conf)
}

async function getObjectWithChildren (objectId, conf, depth = 0) {
  const { result } = (await session.post('Runtime.getProperties', {
    objectId,
    ownProperties: true
    // accessorPropertiesOnly: true, // true: only return get/set accessor properties
    // generatePreview: true, // true: generate `value.preview` object with details (including content) of maps and sets
    // nonIndexedPropertiesOnly: true // true: do not get array elements
  }))

  // TODO: Deside if we should filter out enumerable properties or not:
  // result = result.filter((e) => e.enumerable)

  if (depth < conf.capture.maxReferenceDepth) {
    for (const entry of result) {
      if (entry?.value?.type === 'object' && entry?.value?.objectId) {
        entry.value.properties = await getObjectWithChildren(entry.value.objectId, conf, depth + 1)
      }
    }
  }

  return result
}

function toObject (state) {
  if (state === undefined) return '<object>'
  const obj = {}
  for (const prop of state) {
    obj[prop.name] = getPropVal(prop)
  }
  return obj
}

function toArray (state) {
  if (state === undefined) return '<array>'
  const arr = []
  for (const elm of state) {
    if (elm.enumerable === false) continue // the value of the `length` property should not be part of the array
    arr.push(getPropVal(elm))
  }
  return arr
}

function getPropVal (prop) {
  const value = prop.value ?? prop.get
  switch (value.type) {
    case 'object':
      return getObjVal(value)
    case 'symbol':
      return value.description // TODO: Should we really send this as a string?
    case 'function':
      return '<function>'
    case 'undefined':
      return undefined // TODO: We can't send undefined values over JSON
    case 'boolean':
    case 'string':
    case 'number':
      return value.value
    default:
      // TODO: Remove before shipping
      throw new Error(`Unknown type: ${prop}`)
  }
}

function getObjVal (obj) {
  switch (obj.subtype) {
    case undefined:
      return toObject(obj.properties)
    case 'array':
      return toArray(obj.properties)
    case 'null':
      return null
    // case 'set': // TODO: Verify if we need set as well
    case 'map':
    case 'regexp':
      return obj.description // TODO: How should we actually handle this?
    default:
      // TODO: Remove before shipping
      throw new Error(`Unknown subtype: ${obj}`)
  }
}
