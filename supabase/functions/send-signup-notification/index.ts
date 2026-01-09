import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const adminEmail = Deno.env.get("ADMIN_EMAIL");

        if (!resendApiKey) {
            throw new Error("Missing RESEND_API_KEY");
        }
        if (!adminEmail) {
            throw new Error("Missing ADMIN_EMAIL");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const resend = new Resend(resendApiKey);

        const payload = await req.json();
        const record = payload.record; // payload.record from database webhook

        if (!record || !record.user_id) {
            console.log("No record or user_id in payload", payload);
            return new Response(
                JSON.stringify({ message: "No record found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Processing signup notification for user_id: ${record.user_id}`);

        // Fetch user email from auth.users using the admin client
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(record.user_id);

        if (userError || !user) {
            console.error("Error fetching user:", userError);
            throw new Error("Could not find user: " + (userError?.message || "Unknown error"));
        }

        const email = user.email;
        const fullName = record.full_name || "Unknown Name";

        // Send email
        const { data, error } = await resend.emails.send({
            from: "TrainingSmart <onboarding@resend.dev>",
            to: adminEmail,
            subject: `New User Signup: ${fullName}`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>New User Signup</h1>
          <p>A new user has signed up and is pending approval.</p>
          <ul>
            <li><strong>Name:</strong> ${fullName}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>User ID:</strong> ${record.user_id}</li>
            <li><strong>Status:</strong> ${record.status}</li>
          </ul>
          <p>
            <a href="${supabaseUrl}/dashboard" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Go to Dashboard
            </a>
          </p>
        </div>
      `,
        });

        if (error) {
            console.error("Error sending email:", error);
            throw error;
        }

        console.log("Email sent successfully:", data);

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

    } catch (error) {
        console.error("Error in send-signup-notification:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
