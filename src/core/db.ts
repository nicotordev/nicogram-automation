import * as fs from "node:fs";
import * as path from "node:path";

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

export type DatabaseSchema = {
  profiles: Record<string, InstagramProfile>;
  scans: ScanResult[];
};

export class JsonDatabase {
  private dbPath: string;
  private data: DatabaseSchema;

  constructor(storageDir: string, dbName = "database.json") {
    this.dbPath = path.join(storageDir, dbName);
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (!fs.existsSync(this.dbPath)) {
      return { profiles: {}, scans: [] };
    }
    try {
      const content = fs.readFileSync(this.dbPath, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to load DB, starting fresh", e);
      return { profiles: {}, scans: [] };
    }
  }

  public save(): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  public addScan(scan: ScanResult) {
    this.data.scans.push(scan);
    this.save();
  }

  public upsertProfile(username: string, profile: Partial<InstagramProfile>) {
    const existing = this.data.profiles[username] || { username };
    this.data.profiles[username] = { ...existing, ...profile };
  }

  public getScans(): ScanResult[] {
    return this.data.scans;
  }
}
