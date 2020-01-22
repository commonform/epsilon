const MESSAGE_CHANNELS = require('./message-channels')

module.exports = Object.keys(MESSAGE_CHANNELS)
  .reduce((channels, messageType) => {
    const channel = MESSAGE_CHANNELS[messageType]
    return channels.includes(channel)
      ? channels
      : channels.concat(channel)
  }, [])
