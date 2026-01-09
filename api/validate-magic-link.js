// ===============================================
// VALIDATE MAGIC LINK - Vercel Endpoint
// Valida token e retorna email
// ===============================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS
    const origin = req.headers.origin;
    
    if (origin === "https://vguerise.github.io" || 
        origin === "https://mapadeperfumes.com.br" ||
        origin === "http://localhost:3000") {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    if (req.method === "GET") {
        try {
            const { token } = req.query;
            
            if (!token) {
                return res.status(400).json({
                    valid: false,
                    message: 'Token não fornecido'
                });
            }
            
            console.log(`🔍 Validando token: ${token}`);
            
            // Conecta no Supabase
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            // Busca token na tabela
            const { data, error } = await supabase
                .from('entitlements')
                .select('*')
                .eq('magic_token', token)
                .eq('product_id', 'hotmart')
                .eq('status', 'active')
                .single();
            
            if (error || !data) {
                console.log(`❌ Token não encontrado ou inativo`);
                return res.status(200).json({
                    valid: false,
                    message: 'Link inválido ou expirado'
                });
            }
            
            // Verifica se token expirou
            const expiresAt = new Date(data.magic_token_expires);
            const now = new Date();
            
            if (expiresAt < now) {
                console.log(`⏰ Token expirado em: ${expiresAt.toISOString()}`);
                return res.status(200).json({
                    valid: false,
                    message: 'Link expirado. Por favor, faça login com seu email.'
                });
            }
            
            console.log(`✅ Token válido para: ${data.email}`);
            
            // Token válido!
            return res.status(200).json({
                valid: true,
                email: data.email,
                message: 'Acesso liberado!'
            });
            
        } catch (error) {
            console.error('❌ Erro ao validar token:', error);
            
            return res.status(500).json({
                valid: false,
                message: 'Erro interno ao validar link'
            });
        }
    }
    
    return res.status(405).json({ 
        valid: false,
        message: 'Método não permitido' 
    });
}
