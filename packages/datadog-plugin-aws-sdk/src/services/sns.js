'use strict'
const { CONTEXT_PROPAGATION_KEY, getHeadersSize } = require('../../../dd-trace/src/datastreams/processor')
const { encodePathwayContext } = require('../../../dd-trace/src/datastreams/pathway')
const log = require('../../../dd-trace/src/log')
const BaseAwsSdkPlugin = require('../base')

class Sns extends BaseAwsSdkPlugin {
  static get id () { return 'sns' }
  static get peerServicePrecursors () { return ['topicname'] }

  generateTags (params, operation, response) {
    if (!params) return {}

    if (!params.TopicArn && !(response.data && response.data.TopicArn)) return {}
    const TopicArn = params.TopicArn || response.data.TopicArn
    const topicName = getTopicName(TopicArn)
    return {
      'resource.name': `${operation} ${params.TopicArn || response.data.TopicArn}`,
      'aws.sns.topic_arn': TopicArn,
      'topicname': topicName
    }

    // TODO: should arn be sanitized or quantized in some way here,
    // for example if it contains a phone number?
  }

  operationFromRequest (request) {
    switch (request.operation) {
      case 'publish':
      case 'publishBatch':
        return this.operationName({
          type: 'messaging',
          kind: 'producer'
        })
    }

    return this.operationName({
      id: 'aws',
      type: 'web',
      kind: 'client',
      awsService: 'sns'
    })
  }

  requestInject (span, request) {
    const { operation, params } = request

    if (!params) return

    switch (operation) {
      case 'publish':
        this._injectMessageAttributes(span, params)
        break
      case 'publishBatch':
        if (params.PublishBatchRequestEntries && params.PublishBatchRequestEntries.length > 0) {
          this._injectMessageAttributes(span, params.PublishBatchRequestEntries[0])
        }
        break
    }
  }

  _injectMessageAttributes (span, params) {
    if (!params.MessageAttributes) {
      params.MessageAttributes = {}
    }
    if (Object.keys(params.MessageAttributes).length >= 10) { // SNS quota
      log.info('Message attributes full, skipping trace context injection')
      return
    }
    const ddInfo = {}
    if (this.config.dsmEnabled) {
      const payloadSize = getHeadersSize(params)
      const topicName = getTopicName(params.TopicArn)
      const dataStreamsContext = this.tracer
        .setCheckpoint(['direction:out', `topic:${topicName}`, 'type:sns'], span, payloadSize)
      const pathwayCtx = encodePathwayContext(dataStreamsContext)
      ddInfo[CONTEXT_PROPAGATION_KEY] = pathwayCtx.toJSON()
    }
    this.tracer.inject(span, 'text_map', ddInfo)
    params.MessageAttributes._datadog = {
      DataType: 'Binary',
      BinaryValue: Buffer.from(JSON.stringify(ddInfo)) // BINARY types are automatically base64 encoded
    }
  }
}

function getTopicName (topicArn) {
  // Split the ARN into its parts
  // ex.'arn:aws:sns:us-east-1:123456789012:my-topic'
  const arnParts = topicArn.split(':')

  // Get the topic name from the last part of the ARN
  return arnParts[arnParts.length - 1]
}

module.exports = Sns
