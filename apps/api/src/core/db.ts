import { type Profile } from "../lib/generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export type InstagramProfile = {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
};

export type ScanResult = {
  timestamp: string;
  followers: string[];
  following: string[];
};

export class Database {
  constructor() {
    // storageDir is kept for compatibility with old constructor but unused
  }

  public async upsertProfile(username: string, profileData: Partial<InstagramProfile>): Promise<Profile> {
    return prisma.profile.upsert({
      where: { username },
      update: {
        fullName: profileData.fullName,
        profilePicUrl: profileData.profilePicUrl,
      },
      create: {
        username,
        fullName: profileData.fullName,
        profilePicUrl: profileData.profilePicUrl,
      },
    });
  }

  public async addScan(username: string, scan: ScanResult): Promise<void> {
    // Ensure profile exists first
    const profile = await this.upsertProfile(username, { username });

    await prisma.scan.create({
      data: {
        timestamp: new Date(scan.timestamp),
        profileId: profile.id,
        followers: {
          create: scan.followers.map((f) => ({ username: f })),
        },
        following: {
          create: scan.following.map((f) => ({ username: f })),
        },
      },
    });
  }

  public async getScans(): Promise<ScanResult[]> {
    const scans = await prisma.scan.findMany({
      include: {
        followers: true,
        following: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    return scans.map((s) => ({
      timestamp: s.timestamp.toISOString(),
      followers: s.followers.map((f) => f.username),
      following: s.following.map((f) => f.username),
    }));
  }

  public async getLatestScan(username?: string): Promise<ScanResult | null> {
    const whereClause = username ? { profile: { username } } : {};

    const s = await prisma.scan.findFirst({
      where: whereClause,
      include: {
        followers: true,
        following: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!s) return null;

    return {
      timestamp: s.timestamp.toISOString(),
      followers: s.followers.map((f) => f.username),
      following: s.following.map((f) => f.username),
    };
  }

  public async getDetailedStats(username: string): Promise<{
    followers: { username: string; isFavorite: boolean }[];
    following: { username: string; isFavorite: boolean }[];
    nonFollowers: { username: string; isFavorite: boolean }[];
    fans: { username: string; isFavorite: boolean }[];
  } | null> {
    const s = await prisma.scan.findFirst({
      where: { profile: { username } },
      include: {
        followers: true,
        following: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!s) return null;

    const favorites = new Set((await this.getFavorites()));
    const followersSet = new Set(s.followers.map(f => f.username));
    const followingSet = new Set(s.following.map(f => f.username));
    
    const followers = s.followers.map(f => ({
      username: f.username,
      isFavorite: favorites.has(f.username)
    }));

    const following = s.following.map(f => ({
      username: f.username,
      isFavorite: favorites.has(f.username)
    }));

    const nonFollowers = s.following
      .filter(f => !followersSet.has(f.username))
      .map(f => ({
        username: f.username,
        isFavorite: favorites.has(f.username)
      }));

    const fans = s.followers
      .filter(f => !followingSet.has(f.username))
      .map(f => ({
        username: f.username,
        isFavorite: favorites.has(f.username)
      }));

    return { followers, following, nonFollowers, fans };
  }

  public async getLatestProfileStats(username?: string): Promise<{
    username: string;
    followersCount: number;
    followingCount: number;
    userId: string | null;
  } | null> {
    const whereClause = username ? { profile: { username } } : {};
    
    const s = await prisma.scan.findFirst({
      where: whereClause,
      include: {
        profile: true,
        followers: true,
        following: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!s) return null;

    return {
      username: s.profile.username,
      followersCount: s.followers.length,
      followingCount: s.following.length,
      userId: null,
    };
  }

  public async getFavorites(): Promise<string[]> {
    const favorites = await prisma.favorite.findMany();
    return favorites.map((f) => f.username);
  }

  public async addFavorite(username: string): Promise<void> {
    await prisma.favorite.upsert({
      where: { username },
      update: {},
      create: { username },
    });
  }

  public async removeFavorite(username: string): Promise<void> {
    await prisma.favorite.deleteMany({
      where: { username },
    });
  }

  public async isFavorite(username: string): Promise<boolean> {
    const count = await prisma.favorite.count({
      where: { username },
    });
    return count > 0;
  }

  public async getProfile(userName: string): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: { username: userName },
    });
  }
}
