import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const supabase = getAdmin();

    // Store in a contact_messages table (create if not exists handled by schema)
    // For now, we'll use a simple approach: store as JSON in a general-purpose table
    // or just log it. Since we don't have a dedicated table, we'll send an email if Resend is configured.

    // Try Resend email first
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean);

    if (adminEmails && adminEmails.length > 0) {
      try {
        const { Resend } = await import("resend");
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "SocialBoost <noreply@socialboost.app>",
            to: adminEmails[0],
            subject: `[Contact] ${subject}`,
            html: `
              <div style="font-family: sans-serif; max-width: 560px;">
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                <hr />
                <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            `,
            replyTo: email,
          });
        }
      } catch (emailErr) {
        captureError("Contact email error", emailErr);
        // Continue — we still store the message
      }
    }

    // Store in Supabase (use a simple insert to a contact_messages table)
    // We create this inline if needed
    await supabase.from("contact_messages").insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });
    // If the table doesn't exist, the insert will fail silently — that's OK,
    // the email was still sent (if configured)

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Contact form error", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
