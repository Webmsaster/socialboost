import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { sendReviewApprovedEmail, sendReviewRejectedEmail } from "@/lib/email";

// GET: List posts pending review for user's organizations
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if user is admin/owner of any org
    const { data: memberships } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("accepted", true)
      .in("role", ["owner", "admin"]);

    if (!memberships || memberships.length === 0) {
      // If not in any org, show own pending_review posts
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, platform, topic, content, hashtags, tone, status, created_at, user_id")
        .eq("user_id", user.id)
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });

      if (error) {
        captureError("Review fetch error", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
      }
      return NextResponse.json({ posts: posts || [], canReview: false });
    }

    // Get all org member user IDs for the user's orgs
    const orgIds = memberships.map((m) => m.org_id);
    const { data: orgMembers } = await supabase
      .from("org_members")
      .select("user_id")
      .in("org_id", orgIds)
      .eq("accepted", true);

    const memberUserIds = [...new Set((orgMembers || []).map((m) => m.user_id).filter(Boolean))];

    if (memberUserIds.length === 0) {
      return NextResponse.json({ posts: [], canReview: true });
    }

    // Fetch pending_review posts from all org members
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, platform, topic, content, hashtags, tone, status, created_at, user_id, profiles(full_name, email)")
      .in("user_id", memberUserIds)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    if (error) {
      captureError("Review fetch error", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({ posts: posts || [], canReview: true });
  } catch (error) {
    captureError("Review error", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST: Submit a post for review
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    const { error } = await supabase
      .from("posts")
      .update({ status: "pending_review" })
      .eq("id", postId)
      .eq("user_id", user.id)
      .eq("status", "draft");

    if (error) {
      captureError("Submit review error", error);
      return NextResponse.json({ error: "Failed to submit for review" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Submit review error", error);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}

// PATCH: Approve or reject a post
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { postId, action, note } = await request.json() as {
      postId: string;
      action: "approve" | "reject";
      note?: string;
    };

    if (!postId || !action) {
      return NextResponse.json({ error: "Missing postId or action" }, { status: 400 });
    }

    // Verify the reviewer has admin/owner access to the post author's org
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .eq("status", "pending_review")
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found or not pending review" }, { status: 404 });
    }

    // Check if reviewer is admin/owner in same org as post author
    const { data: reviewerOrgs } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("accepted", true)
      .in("role", ["owner", "admin"]);

    const { data: authorOrgs } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", post.user_id)
      .eq("accepted", true);

    const reviewerOrgIds = new Set((reviewerOrgs || []).map((o) => o.org_id));
    const hasAccess = (authorOrgs || []).some((o) => reviewerOrgIds.has(o.org_id))
      || post.user_id === user.id; // Can also review own posts

    if (!hasAccess) {
      return NextResponse.json({ error: "Not authorized to review this post" }, { status: 403 });
    }

    const newStatus = action === "approve" ? "approved" : "draft";

    const { error } = await supabase
      .from("posts")
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      })
      .eq("id", postId);

    if (error) {
      captureError("Review action error", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    // Send notification email to post author
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", post.user_id)
      .single();

    const { data: reviewerProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const reviewerName = reviewerProfile?.full_name || reviewerProfile?.email || "A team member";

    if (authorProfile?.email) {
      const postTopic = "your post";
      if (action === "approve") {
        sendReviewApprovedEmail(authorProfile.email, postTopic, reviewerName, note);
      } else {
        sendReviewRejectedEmail(authorProfile.email, postTopic, reviewerName, note);
      }
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (error) {
    captureError("Review action error", error);
    return NextResponse.json({ error: "Failed to process review" }, { status: 500 });
  }
}
