export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalPosts: number;
  publishedPosts: number;
  platforms: number;
  streak: number;
  seriesCount: number;
  teamMembers: number;
  favoriteCount: number;
}

export const achievements: Achievement[] = [
  {
    id: "first_post",
    title: "First Steps",
    description: "Create your first post",
    icon: "🚀",
    check: (s) => s.totalPosts >= 1,
  },
  {
    id: "ten_posts",
    title: "Content Machine",
    description: "Create 10 posts",
    icon: "⚡",
    check: (s) => s.totalPosts >= 10,
  },
  {
    id: "fifty_posts",
    title: "Prolific Creator",
    description: "Create 50 posts",
    icon: "🏆",
    check: (s) => s.totalPosts >= 50,
  },
  {
    id: "hundred_posts",
    title: "Content Legend",
    description: "Create 100 posts",
    icon: "👑",
    check: (s) => s.totalPosts >= 100,
  },
  {
    id: "first_publish",
    title: "Going Live",
    description: "Publish your first post",
    icon: "📡",
    check: (s) => s.publishedPosts >= 1,
  },
  {
    id: "multi_platform",
    title: "Platform Diversifier",
    description: "Use 3+ platforms",
    icon: "🌐",
    check: (s) => s.platforms >= 3,
  },
  {
    id: "all_platforms",
    title: "Omnipresent",
    description: "Use all 5 platforms",
    icon: "🎯",
    check: (s) => s.platforms >= 5,
  },
  {
    id: "streak_3",
    title: "Consistency Starter",
    description: "3-day posting streak",
    icon: "🔥",
    check: (s) => s.streak >= 3,
  },
  {
    id: "streak_7",
    title: "Week Warrior",
    description: "7-day posting streak",
    icon: "💪",
    check: (s) => s.streak >= 7,
  },
  {
    id: "streak_30",
    title: "Monthly Master",
    description: "30-day posting streak",
    icon: "⭐",
    check: (s) => s.streak >= 30,
  },
  {
    id: "first_series",
    title: "Automation Begins",
    description: "Create your first content series",
    icon: "🔄",
    check: (s) => s.seriesCount >= 1,
  },
  {
    id: "team_player",
    title: "Team Player",
    description: "Invite a team member",
    icon: "🤝",
    check: (s) => s.teamMembers >= 2,
  },
  {
    id: "curator",
    title: "Curator",
    description: "Favorite 5 posts",
    icon: "⭐",
    check: (s) => s.favoriteCount >= 5,
  },
];

export function getUnlockedAchievements(stats: UserStats): Achievement[] {
  return achievements.filter((a) => a.check(stats));
}

export function getLockedAchievements(stats: UserStats): Achievement[] {
  return achievements.filter((a) => !a.check(stats));
}
