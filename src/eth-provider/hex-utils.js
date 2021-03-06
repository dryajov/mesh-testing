const ethjsUtil = require('ethjs-util')

function incrementHexNumber (hexNum) {
  return formatHex(ethjsUtil.intToHex((parseInt(hexNum, 16) + 1)))
}

function formatHex (hexNum) {
  let stripped = ethjsUtil.stripHexPrefix(hexNum)
  while (stripped[0] === '0') {
    stripped = stripped.substr(1)
  }
  return `0x${stripped}`
}

module.exports = {
  incrementHexNumber,
  formatHex
}
