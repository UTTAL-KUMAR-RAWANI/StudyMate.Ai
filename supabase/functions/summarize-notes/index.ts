
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate if the API key is available
    if (!geminiApiKey) {
      console.error('Gemini API key is not set');
      return new Response(
        JSON.stringify({ error: 'API key configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const requestData = await req.json().catch(error => {
      console.error('Error parsing request JSON:', error);
      throw new Error('Invalid request format');
    });
    
    const { text, summaryType, summaryLength } = requestData;
    
    if (!text || text.trim() === '') {
      console.error('No text provided for summarization');
      return new Response(
        JSON.stringify({ error: 'No text provided for summarization' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Adjust the prompt based on summary type and length
    let prompt = `Summarize the following text in a ${summaryType} style, capturing about ${summaryLength}% of the original content:\n\n${text}`;
    
    if (summaryType === 'bullet') {
      prompt = `Create bullet points for the key information in the following text, capturing about ${summaryLength}% of the original content:\n\n${text}`;
    }
    
    console.log('Calling Gemini API with prompt length:', prompt.length);
    
    // Updated API endpoint to use the gemini-2.0-flash model
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });
    
    const data = await response.json();
    console.log('Gemini API response status:', response.status);
    
    // Check for errors in the Gemini API response
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${data.error?.message || JSON.stringify(data)}` }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts?.[0]?.text) {
      console.error('No content generated from Gemini API:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary from the provided text', details: data }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Successfully generated summary');
    
    return new Response(
      JSON.stringify({ summary: generatedText }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in summarize-notes function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
