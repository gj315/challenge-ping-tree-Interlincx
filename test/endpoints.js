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

// Tests for retrieving all targets from the /api/targets route.
test.serial.cb('Retrieve all target from database', function (t) {
  redis.FLUSHDB()

  var primaryTarget = _getTestTarget()
  var secondaryTarget = {
    ...primaryTarget,
    id: '3'
  }

  var allTestTargets = [primaryTarget, secondaryTarget]
  _addTargetsToRedis(allTestTargets)

  var getTargetsURL = '/api/targets'
  var requestOptions = {
    method: 'GET',
    encoding: 'json'
  }

  servertest(server(), getTargetsURL, requestOptions, handleResponse)

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 200, 'Expected status code of 200 for a successful request')
    t.is(res.body.status, 'OK', 'Response indicates a successful operation')
    t.truthy(res.body.data)
    t.truthy(res.body.data.length === 2)
    t.deepEqual(res.body.data, allTestTargets)

    t.end()
  }
})

test.serial.cb('Retrieve targets when the database us empty', function (t) {
  redis.FLUSHDB()

  var getTargetsURL = '/api/targets'
  var requestOptions = {
    method: 'GET',
    encoding: 'json'
  }

  servertest(server(), getTargetsURL, requestOptions, handleResponse)

  function handleResponse (err, res) {
    t.falsy(err, 'there should be no error')

    t.is(res.statusCode, 200, 'Expected status code of 200 for a successful request')
    t.is(res.body.status, 'OK', 'Response indicates a succssful operation')
    t.end()
  }
})

// Test cases for the endpoint '/api/target/:id' to ensure correct retrieval of target data.
test.serial.cb('Retrieve Target by ID', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var getTargetURL = '/api/target/1'
  var requestOptions = {
    method: 'GET',
    encoding: 'json'
  }

  servertest(server(), getTargetURL, requestOptions, handleResponse)

  function handleResponse (err, resp) {
    t.falsy(err, 'No error encountered')

    t.is(resp.statusCode, 200, 'Correct status code received')
    t.is(resp.body.status, 'OK', 'Status field is as expected')
    t.deepEqual(resp.body.target, targetObj, 'Target data matches the expected data')

    t.end()
  }
})

test.serial.cb('Should return 404 when trying to get a non-existent target by ID', function (t) {
  redis.FLUSHDB()

  var getTargetURL = '/api/target/3'
  var requestOptions = {
    method: 'GET',
    encoding: 'json'
  }

  servertest(server(), getTargetURL, requestOptions, handleResponse)

  function handleResponse (err, resp) {
    t.falsy(err, 'No error encountered')

    t.is(resp.statusCode, 404, 'Received expected status code for non-existent target')
    t.is(resp.body.status, 'Target does not exist with this ID', 'Received expected status message')
    t.end()
  }
})

test.serial.cb('Should return 404 when trying to get a target with a non-numeric ID', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var getTargetsURL = '/api/target/id1'
  var requestOptions = {
    method: 'GET',
    encoding: 'json'
  }

  servertest(server(), getTargetsURL, requestOptions, handleResponse)

  function handleResponse (err, resp) {
    t.falsy(err, 'No error encountered')

    t.is(resp.statusCode, 400, 'Received expected status code for invalid ID')
    t.is(resp.body.status, 'Id param should be a positive integer', 'Received expected status message for invalid ID')
    t.end()
  }
})

// Test cases for the endpoint '/api/target/:id' to update the target with the targetId
test.serial.cb('Update the specified target using its ID', function (t) {
  redis.FLUSHDB()

  var initalTarget = _getTestTarget()
  _addTargetsToRedis([initalTarget])
  initalTarget = {
    ...initalTarget,
    value: '2',
    maxAcceptsPerDay: '30'
  }

  var updateTargetURL = '/api/target/1'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), updateTargetURL, requestOptions, handleResponse).end(JSON.stringify(initalTarget))

  function handleResponse (err, resp) {
    t.falsy(err, 'No error occurred.')

    t.is(resp.statusCode, 200, 'Expected status code to be 200.')
    t.is(resp.body.status, 'OK', 'Expected status to be OK.')

    redis.get(`target:${initalTarget.id}`, function (err, retrievedValue) {
      t.falsy(err, 'No error while retrieving from Redis.')

      t.deepEqual(JSON.parse(retrievedValue), initalTarget, 'Retrieved target should match updated values.')
      t.end()
    })
  }
})

test.serial.cb('Should return an error when attempting to update a target using an ID that is not a number', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var updateTargetURL = 'api/target/id'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), updateTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'Expected no error to occur.')

    t.is(res.statusCode, 400, 'Expected status code to be 400 for invalid ID.')
    t.is(res.body.status, 'Id param should be a positive integer', 'Expected status message to indicates required ID parameter.')
    t.end()
  }
})

test.serial.cb('Should return an error when trying to update a target with a non-existent ID', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  targetObj = {
    ...targetObj,
    value: '2',
    maxAcceptsPerDay: '30'
  }

  var updatedTargetURL = '/api/target/5263'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), updatedTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'Expected no error during the operation.')

    t.is(res.statusCode, 404, 'Expected status code to be 404 for non-existent target.')
    t.is(res.body.status, 'The specified target ID does not exist. Please enter a valid target ID', 'Expected status message to indicate target does not exist.')

    t.end()
  }
})

test.serial.cb('Should return and error when updating a target with and invalid geoState value', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var updateTargetURL = '/api/target/1'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  targetObj.accept = {
    geoState: 'ns',
    hour: {
      $in: ['13', '14', '15']
    }
  }

  servertest(server(), updateTargetURL, requestOptions, handleResponse).end(JSON.stringify(targetObj))

  function handleResponse (err, res) {
    t.falsy(err, 'Expectd no error during the request.')

    t.is(res.statusCode, 400, 'Expected status code to be 400 for invalid input.')
    t.is(res.body.status, 'Both "geoState.$in" and "hour.$in" fields must be arrays.', 'Expected status message to indicate hour and geoState should be arrays.')
    t.end()
  }
})

test.serial.cb('Should return an error when attempting to update a target with an empty payload', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var updateTargetURL = '/api/target/1'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), updateTargetURL, requestOptions, handleResponse).end('{}')

  function handleResponse (err, res) {
    t.falsy(err, 'Expected no error during the request.')

    t.is(res.statusCode, 400, 'Expected status code to be 400 due to empty data')
    t.is(res.body.status, 'Required fields are absent', 'Expected status message to indicate the necessity of at least one field.')

    t.end()
  }
})

// Test scenarios for the decision-making endpoint /route.
test.serial.cb('Retrieve target decision using test visitor data', function (t) {
  redis.FLUSHDB()

  var testVisitor = _getTestVisitorInfo()
  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(testVisitor))

  function handleResponse (err, res) {
    t.falsy(err, 'Should not have any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, targetObj.url, 'Should match the expected target URL')
    t.end()
  }
})

test.serial.cb('Should reject target decision due to invalid visitor timestamp', function (t) {
  redis.FLUSHDB()

  var wrongDateTime = '10-12-201:23:32'

  var visitorInfo = _getTestVisitorInfo()
  visitorInfo = {
    ...visitorInfo,
    timestamp: wrongDateTime
  }

  var targetObj = _getTestTarget()

  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 400, 'Should return a 400 status code')
    t.is(res.body.status, 'The timestamp should be in the Date format.', 'Status message should indicate invalid timestamp')
    t.end()
  }
})

test.serial.cb('Should reject target decision due to invalid visitor geoState', function (t) {
  redis.FLUSHDB()

  var wrongGeoState = 'RAJ'
  var visitorInfo = _getTestVisitorInfo()
  visitorInfo = {
    ...visitorInfo,
    geoState: wrongGeoState
  }

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')
    t.is(res.statusCode, 400, 'Should return a 400 status code')
    t.is(res.body.status, 'geoState must be a string of length 2', 'Status message should indicate invalid geoState')
    t.end()
  }
})

test.serial.cb('Should reject target decision with an empty visitor object', function (t) {
  redis.FLUSHDB()

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end('{}')

  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 400, 'Should return a 400 status code')
    t.is(res.body.status, 'Required fields are missing', 'Status message should indicate missing required fields')
    t.end()
  }
})

test.serial.cb('Should reject target decision due to missing visitor fields', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  delete visitorInfo.geoState

  var targetObj = _getTestTarget()
  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')
    t.is(res.statusCode, 400, 'Should return a 400 status code')
    t.is(res.body.status, 'Required fields are missing', 'Status message should indicate missing required fields')
    t.end()
  }
})

test.serial.cb('Should select lower-priority target if top target exhausts its daily accepts', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  var testTargetHigherValue = _getTestTarget()
  testTargetHigherValue = {
    ...testTargetHigherValue,
    id: 3,
    value: '30',
    url: 'http://test3.com'
  }

  var testTargets = [
    _getTestTarget(),
    testTargetHigherValue
  ]

  _addTargetsToRedis(testTargets)

  redis.set('target:3:acceptsToday', 10)

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Execute the test
  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  // Response handling
  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, testTargets[0].url, 'Expected target URL should be selected')
    t.end()
  }
})

test.serial.cb('Should select the highest-priority target for the visitor', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  var testTargetHigherValue = _getTestTarget()
  testTargetHigherValue = {
    ...testTargetHigherValue,
    id: 3,
    value: '30',
    url: 'http://test3.com'
  }

  var testTargets = [
    _getTestTarget(),
    testTargetHigherValue
  ]

  _addTargetsToRedis(testTargets)

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Execute the test
  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  // Response handling
  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, testTargets[1].url, 'Highest-priority target URL should be selected')
    t.end()
  }
})

test.serial.cb('Should decline decision if no available targets remain', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  var targetObj = _getTestTarget()

  targetObj = {
    ...targetObj,
    maxAcceptsPerDay: 0
  }

  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Execute the test
  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  // Response handling
  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, 'reject', 'Decision should indicate target rejection')
    t.end()
  }
})

test.serial.cb('Should reject target with mismatched timestamp', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  visitorInfo = {
    ...visitorInfo,
    timestamp: '2019-07-12T21:39:59.513Z'
  }

  var targetObj = _getTestTarget()

  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Execute the test
  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  // Response handling
  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, 'reject', 'Decision should indicate target rejection')
    t.end()
  }
})

test.serial.cb('Should reject target with mismatched state', function (t) {
  redis.FLUSHDB()

  var visitorInfo = _getTestVisitorInfo()
  visitorInfo = {
    ...visitorInfo,
    geoState: 'RA'
  }

  var targetObj = _getTestTarget()

  _addTargetsToRedis([targetObj])

  var decisionURL = '/route'
  var requestOptions = {
    method: 'POST',
    encoding: 'json'
  }

  // Execute the test
  servertest(server(), decisionURL, requestOptions, handleResponse)
    .end(JSON.stringify(visitorInfo))

  // Response handling
  function handleResponse (err, res) {
    t.falsy(err, 'Should not encounter any errors')

    t.is(res.statusCode, 200, 'Should return a 200 status code')
    t.is(res.body.decision, 'reject', 'Decision should indicate target rejection')
    t.end()
  }
})

function _getTestVisitorInfo () {
  return {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2018-07-19T14:28:59.513Z'
  }
}

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

function _addTargetsToRedis (targets) {
  targets.forEach(function (target) {
    var targetKey = `target:${target.id}`
    var targetValue = JSON.stringify(target)

    redis.set(targetKey, targetValue)
    redis.sadd('targets', targetKey)
  })
}
