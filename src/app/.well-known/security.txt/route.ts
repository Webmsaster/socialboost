/**
 * security.txt per RFC 9116.
 * Lets security researchers know how to report vulnerabilities.
 */
export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app";

  // Expires one year from build time
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const body = `Contact: mailto:security@socialboost.app
Contact: ${baseUrl}/contact
Expires: ${expires.toISOString()}
Preferred-Languages: en, de
Canonical: ${baseUrl}/.well-known/security.txt
Policy: ${baseUrl}/privacy
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
