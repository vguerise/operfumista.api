import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    
    if (origin === "https://vguerise.github.io" || origin === "http://localhost:3000") {
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
            const { email } = req.query;
            
            if (!email) {
                return res.status(400).json({
                    isPro: false,
                    error: 'Email não fornecido'
                });
            }
            
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            const { data, error } = await supabase
                .from('entitlements')
                .select('*')
                .eq('email', email.toLowerCase().trim())
                .eq('product_id', 'hotmart')
                .eq('status', 'active')
                .single();
            
            if (error) {
                console.log(`Email não encontrado: ${email}`);
                return res.status(200).json({
                    isPro: false,
                    email: email
                });
            }
            
            console.log(`Email ativo: ${email}`);
            
            return res.status(200).json({
                isPro: true,
                email: email,
                activatedAt: data.updated_at
            });
            
        } catch (error) {
            console.error('Erro ao verificar assinatura:', error);
            
            return res.status(500).json({
                isPro: false,
                error: 'Erro interno'
            });
        }
    }
    
    return res.status(405).json({ error: 'Método não permitido' });
}
