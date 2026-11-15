-- Unified public game search index. Source records remain authoritative.
CREATE TABLE IF NOT EXISTS game_search_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('kingdom','alliance','territory','skin')),
  entity_key TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  UNIQUE(entity_type, entity_key)
);

CREATE VIRTUAL TABLE IF NOT EXISTS game_search_fts USING fts5(
  title,
  subtitle,
  content='game_search_documents',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3 4'
);

CREATE TRIGGER IF NOT EXISTS game_search_documents_ai AFTER INSERT ON game_search_documents BEGIN
  INSERT INTO game_search_fts(rowid,title,subtitle) VALUES(new.id,new.title,new.subtitle);
END;
CREATE TRIGGER IF NOT EXISTS game_search_documents_ad AFTER DELETE ON game_search_documents BEGIN
  INSERT INTO game_search_fts(game_search_fts,rowid,title,subtitle) VALUES('delete',old.id,old.title,old.subtitle);
END;
CREATE TRIGGER IF NOT EXISTS game_search_documents_au AFTER UPDATE ON game_search_documents BEGIN
  INSERT INTO game_search_fts(game_search_fts,rowid,title,subtitle) VALUES('delete',old.id,old.title,old.subtitle);
  INSERT INTO game_search_fts(rowid,title,subtitle) VALUES(new.id,new.title,new.subtitle);
END;

INSERT OR IGNORE INTO game_search_documents(entity_type,entity_key,title,subtitle)
SELECT 'kingdom',CAST(id AS TEXT),kingdom_name,'Poder '||power FROM kingdoms;
INSERT OR IGNORE INTO game_search_documents(entity_type,entity_key,title,subtitle)
SELECT 'alliance',CAST(id AS TEXT),name,tag||' '||substr(description,1,120) FROM alliances;
INSERT OR IGNORE INTO game_search_documents(entity_type,entity_key,title,subtitle)
SELECT 'territory',CAST(id AS TEXT),name,terrain||' '||coalesce(resource_type,'')||' nível '||level FROM world_territories;
INSERT OR IGNORE INTO game_search_documents(entity_type,entity_key,title,subtitle)
SELECT 'skin',CAST(id AS TEXT),name,'Skin cosmética' FROM skins;

CREATE TRIGGER IF NOT EXISTS game_search_kingdom_ai AFTER INSERT ON kingdoms BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('kingdom',CAST(new.id AS TEXT),new.kingdom_name,'Poder '||new.power)
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_kingdom_au AFTER UPDATE OF kingdom_name,power ON kingdoms BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('kingdom',CAST(new.id AS TEXT),new.kingdom_name,'Poder '||new.power)
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_kingdom_ad AFTER DELETE ON kingdoms BEGIN
  DELETE FROM game_search_documents WHERE entity_type='kingdom' AND entity_key=CAST(old.id AS TEXT);
END;

CREATE TRIGGER IF NOT EXISTS game_search_alliance_ai AFTER INSERT ON alliances BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('alliance',CAST(new.id AS TEXT),new.name,new.tag||' '||substr(new.description,1,120))
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_alliance_au AFTER UPDATE OF name,tag,description,level ON alliances BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('alliance',CAST(new.id AS TEXT),new.name,new.tag||' '||substr(new.description,1,120))
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_alliance_ad AFTER DELETE ON alliances BEGIN
  DELETE FROM game_search_documents WHERE entity_type='alliance' AND entity_key=CAST(old.id AS TEXT);
END;

CREATE TRIGGER IF NOT EXISTS game_search_territory_ai AFTER INSERT ON world_territories BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('territory',CAST(new.id AS TEXT),new.name,new.terrain||' '||coalesce(new.resource_type,'')||' nível '||new.level)
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_territory_au AFTER UPDATE OF name,terrain,resource_type,level ON world_territories BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('territory',CAST(new.id AS TEXT),new.name,new.terrain||' '||coalesce(new.resource_type,'')||' nível '||new.level)
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_territory_ad AFTER DELETE ON world_territories BEGIN
  DELETE FROM game_search_documents WHERE entity_type='territory' AND entity_key=CAST(old.id AS TEXT);
END;

CREATE TRIGGER IF NOT EXISTS game_search_skin_ai AFTER INSERT ON skins BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('skin',CAST(new.id AS TEXT),new.name,'Skin cosmética')
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_skin_au AFTER UPDATE OF name ON skins BEGIN
  INSERT INTO game_search_documents(entity_type,entity_key,title,subtitle)
  VALUES('skin',CAST(new.id AS TEXT),new.name,'Skin cosmética')
  ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle;
END;
CREATE TRIGGER IF NOT EXISTS game_search_skin_ad AFTER DELETE ON skins BEGIN
  DELETE FROM game_search_documents WHERE entity_type='skin' AND entity_key=CAST(old.id AS TEXT);
END;

CREATE INDEX IF NOT EXISTS idx_game_search_documents_type ON game_search_documents(entity_type,title);
INSERT INTO game_search_fts(game_search_fts) VALUES('rebuild');
