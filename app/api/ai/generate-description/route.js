/**
 * AI Description Generation API Route
 * 
 * Generates or enhances product descriptions using Google Gemini AI.
 * 
 * POST /api/ai/generate-description
 * Body: {
 *   field: 'summary' | 'description',
 *   mode: 'generate' | 'enhance',
 *   productData: { title, brand, categoryId, brandCategoryId, specifications, filters, tags, businessTypeSlugs, sku },
 *   existingText: string (optional, for enhance mode)
 * }
 */

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildAIPrompt } from '@/lib/utils/aiPromptBuilder';

/**
 * POST /api/ai/generate-description
 */
export async function POST(request) {
  try {
    // Check API key
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key not configured. Please set AI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { field, mode, productData, existingText } = body;

    // Validate required fields
    if (!field || !mode || !productData) {
      return NextResponse.json(
        { error: 'Missing required fields: field, mode, and productData are required' },
        { status: 400 }
      );
    }

    if (field !== 'summary' && field !== 'description') {
      return NextResponse.json(
        { error: 'Invalid field. Must be "summary" or "description"' },
        { status: 400 }
      );
    }

    if (mode !== 'generate' && mode !== 'enhance') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "generate" or "enhance"' },
        { status: 400 }
      );
    }

    // For enhance mode, existingText is required
    if (mode === 'enhance' && (!existingText || existingText.trim().length === 0)) {
      return NextResponse.json(
        { error: 'existingText is required for enhance mode' },
        { status: 400 }
      );
    }

    // Build structured prompt
    const prompt = await buildAIPrompt(productData, mode, field, existingText || '');

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use gemini-1.5-flash for faster, cost-effective responses
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Configure generation settings
    const generationConfig = {
      temperature: 0.7, // Balanced creativity
      topK: 40,
      topP: 0.95,
      maxOutputTokens: field === 'summary' ? 200 : 500, // Shorter for summary, longer for description
    };

    // Generate content (pass prompt as string directly)
    const result = await model.generateContent(prompt, {
      generationConfig,
    });

    const response = await result.response;
    const generatedText = response.text().trim();

    // Validate response
    if (!generatedText || generatedText.length === 0) {
      return NextResponse.json(
        { error: 'AI generated empty response. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      text: generatedText,
      field,
      mode,
    });
  } catch (error) {
    console.error('Error generating AI description:', error);

    // Handle specific Gemini API errors
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your AI_API_KEY environment variable.' },
        { status: 401 }
      );
    }

    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to generate description', details: error.message },
      { status: 500 }
    );
  }
}

