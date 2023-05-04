const { test } = require('brittle')
const utils = require('../src/utils')

test('assert', t => {
  t.execution(utils.assert(true))
  t.exception(() => utils.assert(false))
})

test('validatePresent', t => {
  t.execution(utils.validatePresent('foo', 'foo'))

  t.exception(() => utils.validatePresent(undefined, 'bar'), 'bar is requried')
  t.exception(() => utils.validatePresent(null, 'zar'), 'zar is required')
})

test('validateType', t => {
  t.execution(utils.validateType('foo', 'string', 'foo'))
  t.execution(utils.validateType(1, 'number', 'bar'))
  t.execution(utils.validateType([1, 2, 3], Array.isArray, 'zar'))

  t.exception(() => utils.validateType('foo', 'number', 'foo'), 'foo must be of type number')
  t.exception(() => utils.validateType(1, 'string', 'bar'), 'bar must be of type string')
  t.exception(() => utils.validateType(1, Array.isArray, 'zar'), 'zar must be of type isArray')
})

test('validateNotEmpty', t => {
  t.execution(utils.validateNotEmpty('foo', 'foo'))

  t.exception(() => utils.validateNotEmpty('', 'bar'), 'bar must not be empty')
  t.exception(() => utils.validateNotEmpty([], 'zar'), 'zar must not be empty')
})

test('validateNumericString', t => {
  t.execution(utils.validateNumericString('1', 'foo'))
  t.execution(() => utils.validateNumericString('1.1', 'zar'), 'zar must be a numeric string')

  t.exception(() => utils.validateNumericString('foo', 'bar'), 'bar must be a numeric string')
})

test('isEmptyObject', t => {
  t.ok(utils.isEmptyObject({}))
  t.ok(utils.isEmptyObject(null))

  t.not(() => utils.isEmptyObject({ foo: 'bar' }), 'object is not empty')
})
