'use strict'

const EBT = require('epidemic-broadcast-trees')
const pify = require('pify')
const pump = require('pump')

const pullStreamToStream = require('pull-stream-to-stream')

const { createJsonSerializeStream } = require('../util/jsonSerializeStream')

module.exports = function (client, node, clientState) {
  function createStream (streamId) {
    const stream = pullStreamToStream(ebt.createStream(streamId))
    return pump(
      stream,
      createJsonSerializeStream(),
      stream
    )
  }

  node.on('peer:connect', (peerInfo) => {
    attemptDialEbt(peerInfo)
  })

  node.handle('/kitsunet/test/ebt/0.0.1', (_, conn) => {
    console.log('MetaMask Mesh Testing - incomming kitsunet connection')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) {
        console.error(err)
        return
      }
      const peerId = peerInfo.id.toB58String()
      ebt.request(peerId, true)
      const stream = createStream(peerId)
      pump(stream, pullStreamToStream(conn), stream)
    })
  })

  async function attemptDialEbt (peerInfo) {
    const peerId = peerInfo.id.toB58String()
    // attempt connection
    try {
      // console.log('MetaMask Mesh Testing - kitsunet dial', peerId)
      const conn = await pify(node.dialProtocol).call(node, peerInfo, '/kitsunet/test/ebt/0.0.1')
      console.log('MetaMask Mesh Testing - kitsunet-ebt dial success', peerId)
      ebt.request(peerId, true)
      const stream = createStream(peerId)
      pump(stream, pullStreamToStream(conn), stream)
    } catch (err) {
      console.log('MetaMask Mesh Testing - kitsunet-ebt dial failed:', peerId, err.message)
    }
  }

  function append (msg, cb) {
    store[msg.author] = store[msg.author] || []
    if (msg.sequence - 1 !== store[msg.author].length) {
      cb(new Error('out of order'))
    } else {
      store[msg.author].push(msg)
      ebt.onAppend(msg)
      cb(null, msg)
    }
  }

  function ebtAppend (msg) {
    append(msg, (err) => {
      if (err) {
        console.error(err)
        return
      }
      clientState.ebtState = msg
      client.submitNetworkState()
    })
  }

  const store = {}
  const clocks = {}

  const ebt = EBT({
    id: node.idStr,
    // logging: true,
    getClock: function (id, cb) {
      // load the peer clock for id.
      cb(null, clocks[id] || {})
    },
    setClock: function (id, clock) {
      // set clock doesn't have take a cb, but it's okay to be async.
      clocks[id] = clock
    },
    getAt: function (pair, cb) {
      if (!store[pair.id] || !store[pair.id][pair.sequence - 1]) {
        cb(new Error(`not found - ${pair.id}:${pair.sequence}`))
      } else {
        cb(null, store[pair.id][pair.sequence - 1])
      }
    },
    append
  })

  setInterval(() => {
    // console.dir(global.ebt)
    clientState.ebt = Array
      .from(new Set(Object.values(store).reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        []
      ).map((m) => m.content)))
  }, 1000)

  return {
    append: ebtAppend,
    createStream
  }
}
