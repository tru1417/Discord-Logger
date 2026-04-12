export async function initializeDatabase() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id TEXT,
        username TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        moderator_id TEXT,
        command TEXT,
        moderator_name TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_name TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS rules (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        severity TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_configs (
        id SERIAL PRIMARY KEY,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        is_auto_role BOOLEAN DEFAULT false,
        rank INTEGER DEFAULT 0,
        permissions JSONB,
        reaction_message_id TEXT,
        reaction_emoji TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_list_members (
        id SERIAL PRIMARY KEY,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        added_by_id TEXT NOT NULL,
        added_by_name TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'add',
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dayz_servers (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        battlemetrics_id TEXT NOT NULL,
        player_count INTEGER DEFAULT 0,
        max_players INTEGER DEFAULT 60,
        map TEXT NOT NULL,
        wipe_date TIMESTAMP,
        active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS factions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        tag TEXT NOT NULL,
        leader_id TEXT NOT NULL,
        leader_name TEXT NOT NULL,
        description TEXT DEFAULT 'No description set.' NOT NULL,
        color TEXT DEFAULT '#5865F2' NOT NULL,
        hq TEXT DEFAULT 'Unknown' NOT NULL,
        kills INTEGER DEFAULT 0 NOT NULL,
        treasury DECIMAL(10, 2) DEFAULT 0.00,
        territory TEXT DEFAULT 'None',
        allies TEXT[] DEFAULT ARRAY[]::TEXT[],
        enemies TEXT[] DEFAULT ARRAY[]::TEXT[],
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS faction_members (
        id SERIAL PRIMARY KEY,
        faction_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        playtime_hours DECIMAL(10, 2) DEFAULT 0.00,
        rank TEXT DEFAULT 'member' NOT NULL,
        role_permissions JSONB DEFAULT '{}',
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        server_id INTEGER NOT NULL,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        playtime_hours DECIMAL(10, 2) DEFAULT 0.00,
        last_seen TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kills_log (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL,
        killer_id TEXT NOT NULL,
        killer_name TEXT NOT NULL,
        victim_id TEXT NOT NULL,
        victim_name TEXT NOT NULL,
        weapon TEXT,
        distance DECIMAL(10, 2),
        location TEXT,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS server_events (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        player_id TEXT,
        player_name TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leaderboards (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        rank INTEGER,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        kd_ratio DECIMAL(10, 2) DEFAULT 0.00,
        playtime_hours DECIMAL(10, 2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("Database tables initialized");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}
