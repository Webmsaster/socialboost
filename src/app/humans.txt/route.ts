/**
 * humans.txt — an older web tradition for crediting the people
 * behind a site.
 */
export async function GET() {
  const body = `/* TEAM */
Built with care by the SocialBoost team.
Contact: hello@socialboost.app
Site: https://socialboost.app

/* THANKS */
Our customers — you make this possible.
The open-source community — Next.js, React, Tailwind, shadcn/ui,
Supabase, Stripe, OpenAI, Vercel, and countless others.

/* SITE */
Last update: ${new Date().toISOString().split("T")[0]}
Standards: HTML5, CSS3, JavaScript, TypeScript, WCAG 2.1 AA
Components: Next.js, React, Tailwind CSS, shadcn/ui
Backend: Supabase (PostgreSQL), Stripe
AI: OpenAI
Hosted on: Vercel
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
