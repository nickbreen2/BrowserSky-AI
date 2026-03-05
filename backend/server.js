// Spirit.AI Backend Proxy Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in environment variables.');
  console.error('Please create a .env file with your OpenAI API key.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors({
  origin: '*', // In production, restrict to extension origin
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// System prompt for Spirit.AI
const SYSTEM_PROMPT = `You are Spirit.AI, a browser-based assistant.
Answer the user's question using only the provided webpage content (title, URL, and extracted text).
If the webpage content does not contain the answer, say so explicitly.
Be concise and accurate. Do not invent details.`;

/**
 * Formats the user prompt with page context and question
 */
function formatUserPrompt(question, pageContext) {
  return `Page Title: ${pageContext.title}
Page URL: ${pageContext.url}

Page Content:
${pageContext.text}

User Question: ${question}`;
}

/**
 * POST /api/chat
 * Handles chat requests from the extension
 */
app.post('/api/chat', async (req, res) => {
  console.log('=== Incoming request ===');
  console.log('Question:', req.body.question);
  console.log('Model:', req.body.model || 'gpt-4o-mini');
  console.log('Request body keys:', Object.keys(req.body));
  console.log('Has pageContext:', !!req.body.pageContext);
  if (req.body.pageContext) {
    console.log('PageContext keys:', Object.keys(req.body.pageContext));
  }
  console.log('========================');
  
  try {
    const { question, pageContext, model } = req.body;

    // Validate request
    if (!question || !pageContext) {
      return res.status(400).json({
        error: 'Missing required fields: question and pageContext are required'
      });
    }

    if (!pageContext.title || !pageContext.url || !pageContext.text) {
      console.log('❌ Validation failed: Invalid pageContext');
      return res.status(400).json({
        error: 'Invalid pageContext: must include title, url, and text'
      });
    }

    console.log('✅ Validation passed');

    // Determine model to use
    const modelToUse = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';
    const fallbackModel = process.env.FALLBACK_MODEL || 'gpt-3.5-turbo';

    // Format prompts
    const userPrompt = formatUserPrompt(question, pageContext);
    console.log('User prompt length:', userPrompt.length);

    let response;
    let modelUsed = modelToUse;

    try {
      console.log('📞 About to call OpenAI with model:', modelToUse);
      // Attempt to call OpenAI with primary model
      response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      console.log('✅ OpenAI response received');
      console.log('Response length:', response.choices[0]?.message?.content?.length || 0);
    } catch (modelError) {
      console.error('Error calling OpenAI:', modelError);
      // If primary model fails, try fallback
      if (modelError.status === 404 || modelError.code === 'model_not_found') {
        console.warn(`Model ${modelToUse} not available, falling back to ${fallbackModel}`);
        modelUsed = fallbackModel;
        
        response = await openai.chat.completions.create({
          model: fallbackModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });
      } else {
        throw modelError;
      }
    }

    // Extract response
    const answer = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
    console.log('📤 Sending response back to client');
    console.log('Answer length:', answer.length);

    // Return response
    res.json({
      answer,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      },
      model: modelUsed
    });
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('Error processing chat request:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    });

    // Handle different error types
    if (error.status === 401 || error.status === 403) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your OpenAI API key configuration.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error.status === 500 || error.status === 502 || error.status === 503) {
      return res.status(503).json({
        error: 'OpenAI service is temporarily unavailable. Please try again later.'
      });
    }

    // Generic error
    res.status(500).json({
      error: error.message || 'An unexpected error occurred while processing your request.'
    });
  }
});

/**
 * POST /api/chat/vision
 * Handles vision requests — sends a screenshot to GPT-4o instead of text
 */
app.post('/api/chat/vision', async (req, res) => {
  console.log('=== Incoming vision request ===');
  console.log('Question:', req.body.question);
  console.log('Has screenshot:', !!req.body.screenshot);
  console.log('==============================');

  try {
    const { question, screenshot, pageInfo, model } = req.body;

    if (!question || !screenshot) {
      return res.status(400).json({
        error: 'Missing required fields: question and screenshot are required'
      });
    }

    const modelToUse = model || process.env.DEFAULT_MODEL || 'gpt-4o';
    const url = pageInfo?.url || 'unknown';
    const title = pageInfo?.title || 'unknown';

    const systemPrompt = `You are Spirit.AI, a browser-based assistant.
You are given a screenshot of a webpage. Answer the user's question based on what you can see in the screenshot.
If the screenshot does not contain the answer, say so explicitly.
Be concise and accurate. Do not invent details.`;

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Page Title: ${title}\nPage URL: ${url}\n\nUser Question: ${question}`
            },
            {
              type: 'image_url',
              image_url: { url: screenshot, detail: 'high' }
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const answer = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
    console.log('✅ Vision response sent');

    res.json({
      answer,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      },
      model: modelToUse
    });
  } catch (error) {
    console.error('Error processing vision request:', error);

    if (error.status === 401 || error.status === 403) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({
      error: error.message || 'An unexpected error occurred while processing your request.'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Spirit.AI backend server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

