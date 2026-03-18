// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo enviado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada no Supabase' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // A OpenAI prefere extensões válidas (ex: ogg em vez de opus para Whisper via formData)
    const originalName = file.name || 'audio.ogg';
    const newName = originalName.replace(/\.opus$/i, '.ogg');

    // Preparar envio para a OpenAI
    const openaiFormData = new FormData()
    openaiFormData.append('file', file, newName)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('language', 'pt')
    openaiFormData.append('response_format', 'text') // Retorna texto puro em vez de JSON

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error(`Whisper API erro ${response.status}:`, errorMsg);
      
      return new Response(JSON.stringify({ error: errorMsg, transcription: `[ERRO: ${errorMsg}]` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transcriptionText = await response.text();

    return new Response(JSON.stringify({ transcription: transcriptionText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Erro na Edge Function Transcribe:', error)
    return new Response(JSON.stringify({ error: error.message, transcription: '[ERRO: Áudio Inaudível]' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
