// ===============================================
// CHECK SUBSCRIPTION - Vercel Endpoint
// Verifica se email é assinante ativo
// ===============================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS - Permite vários origins
    const origin = req.headers.origin;
    
    const allowedOrigins = [
        "https://vguerise.github.io",
        "https://mapadeperfumes.com.br",
        "http://localhost:3000",
        "http://127.0.0.1:5500"
    ];
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    
    // Handle preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    if (req.method === "GET") {
        try {
            const { email } = req.query;
            
            if (!email) {
                return res.status(400).json({
                    isPro: false,
                    error: 'Email não fornecido'
                });
            }
            
            console.log(`🔍 Verificando assinatura para: ${email}`);
            
            // VIP bypass
            if (email.toLowerCase() === 'vguerise@gmail.com') {
                console.log('👑 VIP detectado!');
                return res.status(200).json({
                    isPro: true,
                    email: email,
                    vip: true
                });
            }
            
            // Conecta Supabase
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            // BUSCA SEM FILTRAR product_id (aceita qualquer produto)
            const { data, error } = await supabase
                .from('entitlements')
                .select('*')
                .eq('email', email.toLowerCase())
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) {
                console.error('❌ Erro Supabase:', error);
                return res.status(500).json({
                    isPro: false,
                    error: 'Erro ao verificar assinatura'
                });
            }
            
            // Se encontrou algum registro ativo
            if (data && data.length > 0) {
                const subscription = data[0];
                console.log(`✅ Assinatura ativa encontrada!`);
                console.log(`📦 Product ID: ${subscription.product_id}`);
                console.log(`📅 Criado em: ${subscription.created_at}`);
                
                return res.status(200).json({
                    isPro: true,
                    email: email,
                    activatedAt: subscription.created_at,
                    productId: subscription.product_id
                });
            }
            
            // Não encontrou
            console.log(`❌ Nenhuma assinatura ativa para: ${email}`);
            return res.status(200).json({
                isPro: false,
                email: email,
                message: 'Assinatura não encontrada'
            });
            
        } catch (error) {
            console.error('❌ Erro geral:', error);
            return res.status(500).json({
                isPro: false,
                error: 'Erro interno'
            });
        }
    }
    
    return res.status(405).json({ 
        isPro: false,
        error: 'Método não permitido' 
    });
}
