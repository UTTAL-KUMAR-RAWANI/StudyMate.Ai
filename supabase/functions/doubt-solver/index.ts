
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
    
    const { question, context } = requestData;
    
    if (!question || question.trim() === '') {
      console.error('No question provided');
      return new Response(
        JSON.stringify({ error: 'No question provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create the prompt for academic question answering
    const prompt = `As an educational AI assistant, please provide a detailed and informative answer to the following academic question:\n\n${question}\n\n${context ? `Additional context: ${context}` : ''}`;
    
    console.log('Calling Gemini API for doubt solver');
    
    try {
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
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      console.log('Gemini API response status:', response.status);
      
      // Check for non-successful status code
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error response:', errorData);
        return new Response(
          JSON.stringify({ 
            error: `Gemini API error: ${errorData.error?.message || JSON.stringify(errorData)}` 
          }),
          { 
            status: 502, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts?.[0]?.text) {
        console.error('No content generated from Gemini API:', data);
        return new Response(
          JSON.stringify({ error: 'Failed to generate answer', details: data }),
          { 
            status: 422, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      const generatedAnswer = data.candidates[0].content.parts[0].text;
      console.log('Successfully generated answer');
      
      return new Response(
        JSON.stringify({ answer: generatedAnswer }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (apiError) {
      console.error('Error calling Gemini API:', apiError);
      return new Response(
        JSON.stringify({ error: `Error calling Gemini API: ${apiError.message}` }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in doubt-solver function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
