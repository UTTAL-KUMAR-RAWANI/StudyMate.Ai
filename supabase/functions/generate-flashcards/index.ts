
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
    
    const { text, subject, count } = requestData;
    
    if (!text || text.trim() === '') {
      console.error('No text provided for flashcard generation');
      return new Response(
        JSON.stringify({ error: 'No text provided for flashcard generation' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create the prompt for flashcard generation
    const cardCount = count || 10;
    const prompt = `Create ${cardCount} flashcards from the following text about ${subject || 'this topic'}. Each flashcard should have a clear question on the front and a comprehensive answer on the back. Format your response as a JSON array with objects containing 'front' and 'back' properties for each flashcard. Only return the JSON array, nothing else.\n\nText: ${text}`;
    
    console.log('Calling Gemini API for flashcard generation');
    
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
        JSON.stringify({ error: 'Failed to generate flashcards', details: data }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Successfully generated flashcards text');
    
    // Try to parse the JSON response
    try {
      // Clean up the response to extract just the JSON array
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      
      const flashcards = JSON.parse(jsonString);
      
      if (!Array.isArray(flashcards) || !flashcards.every(card => card.front && card.back)) {
        throw new Error('Invalid flashcard format received from AI');
      }
      
      return new Response(
        JSON.stringify({ flashcards }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (parseError) {
      console.error('Error parsing AI response as JSON:', parseError, 'Response was:', generatedText);
      
      // Fall back to a simple text-based extraction
      const flashcards = [];
      const sections = generatedText.split(/Flashcard \d+:/gi).filter(Boolean);
      
      for (const section of sections) {
        const parts = section.split(/Front:|Back:/gi).filter(Boolean);
        if (parts.length >= 2) {
          flashcards.push({
            front: parts[0].trim(),
            back: parts[1].trim()
          });
        }
      }
      
      if (flashcards.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse flashcards from AI response',
            rawResponse: generatedText 
          }),
          { 
            status: 422, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ flashcards }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in generate-flashcards function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
