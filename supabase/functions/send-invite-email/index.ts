import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { inviteeEmail, inviterName, familyName } = await req.json()

        if (!inviteeEmail || !familyName) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
            console.error('RESEND_API_KEY not configured')
            return new Response(
                JSON.stringify({ error: 'Email service not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const resend = new Resend(resendApiKey)

        const { data, error } = await resend.emails.send({
            from: 'VoucherVault <noreply@vouchervault.app>',
            to: inviteeEmail,
            subject: `${inviterName || 'Jemand'} hat dich zu "${familyName}" eingeladen`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px; }
            .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
            h1 { color: #2563eb; font-size: 24px; margin-bottom: 20px; }
            p { color: #374151; line-height: 1.6; }
            .highlight { background: #eef2ff; padding: 16px; border-radius: 12px; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Du wurdest eingeladen! 🎉</h1>
            <p><strong>${inviterName || 'Ein Benutzer'}</strong> hat dich eingeladen, der Gruppe <strong>"${familyName}"</strong> beizutreten.</p>
            
            <div class="highlight">
              <p style="margin: 0;">Gemeinsam könnt ihr Gutscheine teilen und verwalten.</p>
            </div>
            
            <p>Öffne die VoucherVault App und gehe zu <strong>Einstellungen</strong>, um die Einladung anzunehmen.</p>
            
            <a href="vouchervault://invite" class="button">App öffnen</a>
            
            <div class="footer">
              <p>Diese E-Mail wurde automatisch von VoucherVault gesendet.</p>
            </div>
          </div>
        </body>
        </html>
      `
        })

        if (error) {
            console.error('Resend error:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ success: true, id: data?.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
