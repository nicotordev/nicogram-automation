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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_storageDir?: string) {
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
}
