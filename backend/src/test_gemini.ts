import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

async function test() {
  try {
    console.log('[Test] Calling Gemini API...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Hello, tell me what is 2+2? Output only the answer.');
    console.log('[Test] Response:', result.response.text().trim());
  } catch (error: any) {
    console.error('[Test Error] Gemini call failed:', error.message);
  }
}

test();
