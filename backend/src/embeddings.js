const OpenAI = require('openai');
require('dotenv').config({ path: __dirname + '/../../.env' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  if (!text || text.trim().length === 0) return null;
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.slice(0, 8000), // max token limit
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Embedding error:', err.message);
    return null;
  }
}

module.exports = { getEmbedding };
