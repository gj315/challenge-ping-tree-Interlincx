process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')
var redis = require('../lib/redis')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

// Tests for adding a new target via the /api/targets route.
test.serial.cb('Should add a new target with valid data', function (t) {
  redis.FLUSHDB()

  var addTargetURL = '/api/targets'
  var requestOptions = { method: 'POST', encoding: 'json' }
  var targetObj = _getTestTarget()

  servertest(server(), addTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 200, 'Expected a 200 status code for successful request')
    t.is(res.body.status, 'OK', 'Response indicates a successful operation')

    redis.get(`target:${targetObj.id}`, function (err, targetResp) {
      t.falsy(err, 'there should be no error')
      t.deepEqual(JSON.parse(targetResp), targetObj, 'target object should match')
      t.end()
    })
  }
})

test.serial.cb('Attempt to add a duplicate target', function (t) {
  var addTargetURL = '/api/targets'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }
  var targetObj = _getTestTarget()

  servertest(server(), addTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'no error when adding the duplicate target')

    t.is(res.statusCode, 400, 'correct status code')
    t.is(res.body.status, 'Target already exists. Please try with a different target id.', 'status is ok')
    t.end()
  }
})

test.serial.cb('Attempt to add a target with invalid data', function (t) {
  redis.FLUSHDB()
  var addTargetURL = '/api/targets'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Create an intentionally invalid target object.
  var targetObj = _getTestTarget()
  targetObj = {
    ...targetObj,
    maxAcceptsPerDay: ''
  }

  servertest(server(), addTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 400, 'status code indicates bad request')
    t.is(res.body.status, 'Required fields are absent', 'Error message indicates missing fields')
    t.end()
  }
})

test.serial.cb('Attempt to add a target without sending data', function (t) {
  redis.FLUSHDB()
  var addTargetURL = '/api/targets'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), addTargetURL, requestOptions, handleResponse).end()

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 400, 'status code indicates bad request')
    t.is(res.body.status, 'Unexpected end of JSON input', 'Error message indicates incompvare JSON data')
    t.end()
  }
})

test.serial.cb('Addition of a new target should faild when a field has an incorrect data type', function (t) {
  redis.FLUSHDB()

  var addTargetURL = '/api/targets'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  var targetObj = _getTestTarget()
  targetObj.accept.geoState = 'ny'

  servertest(server(), addTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 400, 'Expected a 400 status code for bad request')
    t.is(res.body.status, 'Both "geoState.$in" and "hour.$in" fields must be arrays.',
      'Error message indicates the expected data type for hour and geoState')
    t.end()
  }
})

function _getTestTarget () {
  return {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
}
