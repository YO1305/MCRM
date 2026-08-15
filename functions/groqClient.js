const Groq = require('groq-sdk')

const GROQ_MODEL = 'llama-3.1-8b-instant'

function createGroqClient(apiKey) {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set')
  }
  return new Groq({ apiKey })
}

module.exports = { createGroqClient, GROQ_MODEL }
