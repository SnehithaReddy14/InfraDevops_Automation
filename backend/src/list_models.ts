import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

async function list() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Call listModels
    console.log('[List] Requesting model list...');
    // The GoogleGenerativeAI client doesn't expose listModels directly on the main class in some versions,
    // so we can make a direct fetch to list the models.
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('[List] Response:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('[List Error]', err.message);
  }
}

list();
