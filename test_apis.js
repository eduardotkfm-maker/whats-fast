import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Função simples para ler .env sem dependências externas
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

async function testApis() {
  console.log('🔍 Iniciando testes de API...');
  const env = loadEnv();

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  // 1. Testar Supabase
  if (supabaseUrl && supabaseKey) {
    console.log('\n--- Teste Supabase ---');
    console.log('Conectando em:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.from('transcricoes').select('*').limit(1);
    
    if (error) {
      console.error('❌ Erro no Supabase:', JSON.stringify(error, null, 2));
      if (error.status === 401 || error.code === '42501') {
        console.error('👉 Detalhe: Erro de Permissão (401 ou 42501). Isso confirma que o RLS está bloqueando ou a KEY está errada.');
      }
    } else {
      console.log('✅ Conexão com Supabase OK! Tabela "transcricoes" acessível.');
      // Testar analises também
      const { error: err2 } = await supabase.from('analises').select('*').limit(1);
      if (err2) {
        console.error('❌ Erro na tabela "analises":', err2.message);
      } else {
        console.log('✅ Tabela "analises" também acessível!');
      }
    }
  } else {
    console.error('❌ Configurações do Supabase ausentes no .env');
  }

  // 2. Testar OpenAI Key (Simples fetch)
  if (openaiKey) {
    console.log('\n--- Teste OpenAI ---');
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` }
      });
      if (response.ok) {
        console.log('✅ OpenAI API Key válida!');
      } else {
        const errJson = await response.json();
        console.error('❌ Erro na OpenAI:', errJson.error?.message || response.statusText);
      }
    } catch (err) {
      console.error('❌ Erro de rede ao testar OpenAI:', err.message);
    }
  } else {
    console.error('❌ OPENAI_API_KEY ausente no .env');
  }
}

testApis();
