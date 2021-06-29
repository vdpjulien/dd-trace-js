'use strict'
const { expect } = require('chai')
const { LibAppSec } = require('../native')

const TEST_RULE = {
  "rules": [
    {
      "rule_id": "rule_941110",
      "filters": [
        {
          "operator": "@rx",
          "targets": [
            "REQUEST_HEADERS:user-agent-0",
            "REQUEST_COOKIES-0",
            "ARGS-0",
            "ARGS_NAMES-1",
            "ARGS-1",
            "REQUEST_COOKIES_NAMES-0",
            "ARGS-2",
            "REQUEST_FILENAME-0",
            "ARGS_NAMES-2",
            "ARGS_NAMES-0",
            "REQUEST_HEADERS:referer-0"
          ],
          "transformations": [
            "removeNulls"
          ],
          "value": "<script[^>]*>[\\s\\S]*?",
          "options": {
            "case_sensitive": false,
            "min_length": 8
          }
        }
      ]
    },
    {
      "rule_id": "rule_ua_60012",
      "filters": [
        {
          "operator": "@rx",
          "targets": [
            "REQUEST_HEADERS:User-Agent-0"
          ],
          "transformations": [],
          "value": "^Arachni\\/v",
          "options": {}
        }
      ]
    }
  ],
  "flows": [
    {
      "name": "xss-blocking",
      "steps": [
        {
          "id": "start",
          "rule_ids": [
            "rule_941110"
          ],
          "on_match": "exit_block"
        }
      ]
    },
    {
      "name": "security_scanner-monitoring",
      "steps": [
        {
          "id": "start",
          "rule_ids": [
            "rule_ua_60012"
          ],
          "on_match": "exit_monitor"
        }
      ]
    }
  ],
  "manifest": {
    "REQUEST_COOKIES-0": {
      "inherit_from": "server.request.cookies",
      "run_on_key": false,
      "run_on_value": true
    },
    "REQUEST_COOKIES_NAMES-0": {
      "inherit_from": "server.request.cookies",
      "run_on_key": true,
      "run_on_value": false
    },
    "REQUEST_FILENAME-0": {
      "inherit_from": "server.request.uri.raw",
      "run_on_key": false,
      "run_on_value": true,
      "processor": [
        {
          "transforms": [
            "_sqr_filename"
          ]
        }
      ]
    },
    "REQUEST_HEADERS:user-agent-0": {
      "inherit_from": "server.request.headers.no_cookies",
      "run_on_key": false,
      "run_on_value": true,
      "key_access": {
        "is_allowlist": true,
        "paths": [
          [
            "user-agent"
          ]
        ]
      }
    },
    "REQUEST_HEADERS:referer-0": {
      "inherit_from": "server.request.headers.no_cookies",
      "run_on_key": false,
      "run_on_value": true,
      "key_access": {
        "is_allowlist": true,
        "paths": [
          [
            "referer"
          ]
        ]
      }
    },
    "ARGS_NAMES-0": {
      "inherit_from": "server.request.body",
      "run_on_key": true,
      "run_on_value": false
    },
    "ARGS_NAMES-1": {
      "inherit_from": "server.request.query",
      "run_on_key": true,
      "run_on_value": false
    },
    "ARGS_NAMES-2": {
      "inherit_from": "server.request.path_params",
      "run_on_key": true,
      "run_on_value": false
    },
    "ARGS-0": {
      "inherit_from": "server.request.body",
      "run_on_key": false,
      "run_on_value": true
    },
    "ARGS-1": {
      "inherit_from": "server.request.query",
      "run_on_key": false,
      "run_on_value": true
    },
    "ARGS-2": {
      "inherit_from": "server.request.path_params",
      "run_on_key": false,
      "run_on_value": true
    },
    "REQUEST_HEADERS:User-Agent-0": {
      "inherit_from": "server.request.headers.no_cookies",
      "run_on_key": false,
      "run_on_value": true,
      "key_access": {
        "is_allowlist": true,
        "paths": [
          [
            "user-agent"
          ]
        ]
      }
    }
  },
  "config": {
    "max_rule_timing": 0
  }
}

describe('LibAppSec', () => {
  beforeEach(() => {
    LibAppSec.clearAll
  })

  it('should refuse a bad config', () => {
    const badInit = () => new LibAppSec('{')
    expect(badInit).to.throw()
  })

  it('should run the WAD e2e', () => {
    const lib = new LibAppSec(JSON.stringify(TEST_RULE));
    const r1 = lib.run({}, 10000)
    expect(r1.status).to.equal(undefined)
    expect(r1.record).to.equal(undefined)
    const r2 = lib.run({ 'server.request.uri.raw': '/<script>' }, 10000)
    expect(r2.status).to.equal('raise')
    expect(r2.record).to.not.equal(undefined)
    const r3 = lib.run({
      'server.request.headers.no_cookies': {
        host: 'localhost:1337', 'user-agent': 'Arachni/v1'
      }
    }, 10000)
    expect(r3.status).to.equal(undefined)
    expect(r3.record).to.not.equal(undefined)
  })
})
