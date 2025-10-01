'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../helper')

test('example route returns not found', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/example'
  })

  assert.equal(res.statusCode, 404)
  const payload = JSON.parse(res.payload)
  assert.equal(payload.error, 'Not Found')
})

// inject callback style:
//
// test('example is loaded', (t) => {
//   t.plan(2)
//   const app = await build(t)
//
//   app.inject({
//     url: '/example'
//   }, (err, res) => {
//     t.error(err)
//     assert.equal(res.payload, 'this is an example')
//   })
// })
