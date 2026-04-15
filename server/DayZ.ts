import { storage } from "./storage";
import { EmbedBuilder, TextChannel } from "discord.js";

export interface Kill {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon?: string;
  distance?: number;
  location?: string;
  serverId: number;
}

export async function recordKill(kill: Kill) {
  try {
    // Record kill in database
    await storage.recordKill(kill);

    // Update killer stats
    const killerStats = await storage.getPlayerStats(kill.killerId, kill.serverId);
    if (killerStats) {
      await storage.updatePlayerStats(kill.killerId, {
        kills: (killerStats.kills || 0) + 1,
      });
    }

    // Update victim stats
    const victimStats = await storage.getPlayerStats(kill.victimId, kill.serverId);
    if (victimStats) {
      await storage.updatePlayerStats(kill.victimId, {
        deaths: (victimStats.deaths || 0) + 1,
      });
    }

    // Update faction stats if applicable
    const killerFaction = await storage.getFactionByMember(kill.killerId);
    if (killerFaction) {
      await storage.updateFactionStats(killerFaction.id, {
        kills: (killerFaction.kills || 0) + 1,
      });
    }

    return true;
  } catch (error) {
    console.error("[DayZ] Error recording kill:", error);
    return false;
  }
}

export async function postKillToFeed(
  channel: TextChannel,
  kill: Kill
): Promise<boolean> {
  try {
    const weaponEmoji = getWeaponEmoji(kill.weapon);
    const distanceStr = kill.distance ? `${kill.distance.toFixed(0)}m` : "Unknown";
    const locationStr = kill.location || "Unknown";

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`${weaponEmoji} Kill Feed`)
      .addFields(
        {
          name: "Killer",
          value: `\`${kill.killerName}\``,
          inline: true,
        },
        {
          name: "Victim",
          value: `\`${kill.victimName}\``,
          inline: true,
        },
        {
          name: "Weapon",
          value: kill.weapon || "Unknown",
          inline: true,
        },
        {
          name: "Distance",
          value: distanceStr,
          inline: true,
        },
        {
          name: "Location",
          value: locationStr,
          inline: true,
        }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error("[DayZ] Error posting kill to feed:", error);
    return false;
  }
}

function getWeaponEmoji(weapon?: string): string {
  if (!weapon) return "🔫";
  const lower = weapon.toLowerCase();
  if (lower.includes("mosin") || lower.includes("sniper"))
    return "🎯";
  if (lower.includes("ak") || lower.includes("rifle")) return "🔫";
  if (lower.includes("shotgun")) return "🔱";
  if (lower.includes("pistol") || lower.includes("glock")) return "🔶";
  if (lower.includes("melee") || lower.includes("axe")) return "🪓";
  if (lower.includes("grenade")) return "💣";
  return "🔫";
}

export async function createFaction(
  name: string,
  tag: string,
  leaderId: string,
  leaderName: string
) {
  try {
    const faction = await storage.createFaction({
      name,
      tag,
      leaderId,
      leaderName,
      description: "No description set.",
      color: "#5865F2",
      hq: "Unknown",
      kills: 0,
      treasury: 0,
      territory: "None",
      allies: [],
      enemies: [],
      status: "active",
    });

    // Add leader as member
    await storage.addFactionMember(faction.id, leaderId, leaderName, "leader");

    return faction;
  } catch (error) {
    console.error("[DayZ] Error creating faction:", error);
    return null;
  }
}

export async function inviteFactionMember(
  factionId: number,
  userId: string,
  username: string
) {
  try {
    return await storage.addFactionMember(factionId, userId, username, "member");
  } catch (error) {
    console.error("[DayZ] Error inviting member:", error);
    return null;
  }
}

export async function removeFactionMember(factionId: number, userId: string) {
  try {
    return await storage.removeFactionMember(factionId, userId);
  } catch (error) {
    console.error("[DayZ] Error removing member:", error);
    return false;
  }
}

export async function promoteMember(
  factionId: number,
  userId: string,
  newRank: string
) {
  try {
    return await storage.updateFactionMemberRank(factionId, userId, newRank);
  } catch (error) {
    console.error("[DayZ] Error promoting member:", error);
    return false;
  }
}

export async function getFactionLeaderboard(limit: number = 10) {
  try {
    return await storage.getTopFactions(limit);
  } catch (error) {
    console.error("[DayZ] Error getting leaderboard:", error);
    return [];
  }
}
