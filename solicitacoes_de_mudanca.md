# Registro de Solicitações de Mudança - Whats-Fast

Este arquivo contém todas as mudanças solicitadas pelo usuário ao assistente.

## Solicitações

### [2026-03-18] Criação do Registro de Mudanças
- [x] Criar arquivo `.md` para salvar todas as solicitações de mudança.

### [2026-03-18] Migração para o Supabase
- [x] Configurar integração com Supabase para salvar histórico de análises.
- [x] Criar tabelas no banco de dados e refatorar o frontend.

### [2026-03-18] Scripts Supabase
- [x] Salvar scripts SQL (`schema.sql`) na pasta `supabase`.

### [2026-03-18] Migração para Edge Functions
- [x] Migrar endpoint de transcrição (Whisper) do `server.js` (Express) para Deno no Supabase.
- [x] Remover servidor Node.js e tornar a aplicação 100% serverless/frontend.

### [2026-03-18] Refatoração da UI (Seletor de Histórico)
- [/] Criar seletor (dropdown) para carregar análises direto do cache ou Supabase sem precisar re-upar o ZIP.
