'use strict'

const { AbortController } = require('node-abort-controller')

describe('blocking', () => {
  const defaultBlockedTemplate = {
    html: 'block test',
    json: '{ "block": true }'
  }

  const config = {
    appsec: {
      blockedTemplateHtml: 'htmlBodyéé',
      blockedTemplateJson: 'jsonBody'
    }
  }

  let log
  let block, setTemplates, updateBlockingConfiguration
  let req, res, rootSpan

  beforeEach(() => {
    log = {
      warn: sinon.stub()
    }

    const blocking = proxyquire('../src/appsec/blocking', {
      '../log': log,
      './blocked_templates': defaultBlockedTemplate
    })

    block = blocking.block
    setTemplates = blocking.setTemplates
    updateBlockingConfiguration = blocking.updateBlockingConfiguration

    req = {
      headers: {}
    }

    res = {
      setHeader: sinon.stub(),
      writeHead: sinon.stub(),
      end: sinon.stub()
    }
    res.writeHead.returns(res)

    rootSpan = {
      addTags: sinon.stub()
    }
  })

  describe('block', () => {
    beforeEach(() => {
      setTemplates(config)
    })

    it('should log warn and not send blocking response when headers have already been sent', () => {
      res.headersSent = true
      block(req, res, rootSpan)

      expect(log.warn).to.have.been
        .calledOnceWithExactly('Cannot send blocking response when headers have already been sent')
      expect(rootSpan.addTags).to.not.have.been.called
      expect(res.setHeader).to.not.have.been.called
      expect(res.end).to.not.have.been.called
    })

    it('should send blocking response with html type if present in the headers', () => {
      req.headers.accept = 'text/html'
      block(req, res, rootSpan)

      expect(rootSpan.addTags).to.have.been.calledOnceWithExactly({ 'appsec.blocked': 'true' })
      expect(res.setHeader).to.have.been.calledTwice
      expect(res.setHeader.firstCall).to.have.been.calledWithExactly('Content-Type', 'text/html; charset=utf-8')
      expect(res.setHeader.secondCall).to.have.been.calledWithExactly('Content-Length', 12)
      expect(res.end).to.have.been.calledOnceWithExactly('htmlBodyéé')
    })

    it('should send blocking response with json type if present in the headers in priority', () => {
      req.headers.accept = 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8, application/json'
      block(req, res, rootSpan)

      expect(rootSpan.addTags).to.have.been.calledOnceWithExactly({ 'appsec.blocked': 'true' })
      expect(res.setHeader).to.have.been.calledTwice
      expect(res.setHeader.firstCall).to.have.been.calledWithExactly('Content-Type', 'application/json')
      expect(res.setHeader.secondCall).to.have.been.calledWithExactly('Content-Length', 8)
      expect(res.end).to.have.been.calledOnceWithExactly('jsonBody')
    })

    it('should send blocking response with json type if neither html or json is present in the headers', () => {
      block(req, res, rootSpan)

      expect(rootSpan.addTags).to.have.been.calledOnceWithExactly({ 'appsec.blocked': 'true' })
      expect(res.setHeader).to.have.been.calledTwice
      expect(res.setHeader.firstCall).to.have.been.calledWithExactly('Content-Type', 'application/json')
      expect(res.setHeader.secondCall).to.have.been.calledWithExactly('Content-Length', 8)
      expect(res.end).to.have.been.calledOnceWithExactly('jsonBody')
    })

    it('should send blocking response and call abortController if passed in arguments', () => {
      const abortController = new AbortController()
      block(req, res, rootSpan, abortController)

      expect(rootSpan.addTags).to.have.been.calledOnceWithExactly({ 'appsec.blocked': 'true' })
      expect(res.setHeader).to.have.been.calledTwice
      expect(res.setHeader.firstCall).to.have.been.calledWithExactly('Content-Type', 'application/json')
      expect(res.setHeader.secondCall).to.have.been.calledWithExactly('Content-Length', 8)
      expect(res.end).to.have.been.calledOnceWithExactly('jsonBody')
      expect(abortController.signal.aborted).to.be.true
    })
  })

  describe('block with default templates', () => {
    const config = {
      appsec: {
        blockedTemplateHtml: undefined,
        blockedTemplateJson: undefined
      }
    }

    it('should block with default html template', () => {
      req.headers.accept = 'text/html'
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.html)
    })

    it('should block with default json template', () => {
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.json)
    })
  })

  describe('block with custom actions', () => {
    const config = {
      appsec: {
        blockedTemplateHtml: undefined,
        blockedTemplateJson: undefined
      }
    }

    it('should block with default html template and custom status', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'auto'
        }
      })
      req.headers.accept = 'text/html'
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.html)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with default json template and custom status ' +
        'when type is forced to json and accept is html', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'json'
        }
      })
      req.headers.accept = 'text/html'
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.json)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with default html template and custom status ' +
        'when type is forced to html and accept is html', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'html'
        }
      })
      req.headers.accept = 'text/html'
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.html)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with default json template and custom status', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'auto'
        }
      })
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.json)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with default json template and custom status ' +
        'when type is forced to json and accept is not defined', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'json'
        }
      })
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.json)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with default html template and custom status ' +
        'when type is forced to html and accept is not defined', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'block_request',
        parameters: {
          status_code: 401,
          type: 'html'
        }
      })
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.end).to.have.been.calledOnceWithExactly(defaultBlockedTemplate.html)
      expect(res.statusCode).to.be.equal(401)
    })

    it('should block with custom redirect', () => {
      updateBlockingConfiguration({
        id: 'block',
        type: 'redirect_request',
        parameters: {
          status_code: 301,
          location: '/you-have-been-blocked'
        }
      })
      setTemplates(config)

      block(req, res, rootSpan)

      expect(res.writeHead).to.have.been.calledOnceWithExactly(301, {
        'Location': '/you-have-been-blocked'
      })
      expect(res.end).to.have.been.calledOnce
    })
  })
})