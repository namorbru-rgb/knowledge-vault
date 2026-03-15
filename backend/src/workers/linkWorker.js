require('dotenv').config({ path: __dirname + '/../../.env' });
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const supabase = require('../supabase');
const { getEmbedding } = require('../embeddings');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scrapeUrl(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeVault/1.0)' },
      maxRedirects: 5
    });
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, aside').remove();
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const mainText = $('main, article, .content, #content, body').first().text()
      .replace(/\s+/g, ' ').trim().slice(0, 5000);
    return { title, description, mainText };
  } catch (err) {
    console.error('Scrape error:', err.message);
    return { title: url, description: '', mainText: '' };
  }
}

async function summarizeContent(title, text) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Summarize this web page in 2-3 sentences and extract 5 relevant tags.\n\nTitle: ${title}\n\nContent: ${text.slice(0, 3000)}\n\nRespond as JSON: {"summary": "...", "tags": ["tag1", "tag2"]}`
      }],
      max_tokens: 300
    });
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{.*\}/s);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Summary error:', err.message);
  }
  return { summary: text.slice(0, 200), tags: [] };
}

async function processLink(link) {
  console.log('Processing link:', link.id, link.url);
  try {
    await supabase.from('kv_links').update({ status: 'processing' }).eq('id', link.id);
    const { title, description, mainText } = await scrapeUrl(link.url);
    const { summary, tags } = await summarizeContent(title, mainText);
    const embeddingText = `${title}\n${description}\n${summary}`;
    const embedding = await getEmbedding(embeddingText);
    await supabase.from('kv_links').update({
      title: title || link.title,
      description,
      main_text: mainText.slice(0, 10000),
      summary,
      tags,
      embedding,
      status: 'done'
    }).eq('id', link.id);
    console.log('Link processed:', link.id, title);
  } catch (err) {
    console.error('Link processing error:', link.id, err.message);
    await supabase.from('kv_links').update({ status: 'error' }).eq('id', link.id);
  }
}

async function runWorker() {
  const { data: pendingLinks } = await supabase
    .from('kv_links').select('*').eq('status', 'pending').limit(5);
  if (pendingLinks && pendingLinks.length > 0) {
    for (const link of pendingLinks) {
      await processLink(link);
    }
  }
}

runWorker();
setInterval(runWorker, 15000);
console.log('Link worker started');
