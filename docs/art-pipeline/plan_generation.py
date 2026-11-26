"""Offline production queue. Does not contact providers or require credentials."""
import argparse
import json
from pathlib import Path

CATALOG = Path(__file__).resolve().parents[1] / "eldoria-art-catalog.json"
GROUPS = {
    "economy": {"farm", "lumber_mill", "quarry", "iron_mine", "warehouse", "market"},
    "military": {"barracks", "archery_range", "stable", "wall", "watchtower", "siege_workshop"},
    "special": {"academy", "hospital", "embassy", "dragon_nest", "summon_altar"},
}
TROOP_DESCRIPTIONS = {
    "militia": "leather tunic, simple spear and wooden shield",
    "swordsman": "chainmail, sword, round shield",
    "spearman": "long spear, leather armor",
    "archer": "longbow, quiver, cloth hood",
    "crossbowman": "crossbow, leather cuirass",
    "cavalry": "light cavalry, separate horse and rider rigs",
    "knight": "plate armor, warhorse, separate horse and rider rigs",
    "mage": "blue robes, crystal staff",
    "catapult": "wooden throwing-arm siege engine, mechanical rig",
    "ram": "roofed wooden battering ram, wheels, mechanical rig",
    "trebuchet": "counterweight siege engine, mechanical rig",
}
def queue(catalog, group="all"):
    rows = []
    for b in catalog["buildings"]:
        category = "castle" if b["id"] == "castle" else next(k for k,v in GROUPS.items() if b["id"] in v)
        if group not in ("all", category):
            continue
        for v in b["variants"]:
            rows.append({"id": f'{b["id"]}_L{v["minLevel"]}', "provider":"meshy", "group":category,
                         "prompt":v["prompt"], "path":v["file"], "budgets":b["lodTriangles"]})
    for key, group_name in (("troops","troops"), ("dragons","dragons")):
        if group not in ("all", group_name):
            continue
        for a in catalog[key]:
            detail = TROOP_DESCRIPTIONS[a["id"]] if key == "troops" else f'{a["element"]} dragon, {a["rarity"]} rarity, four legs, two wings, distinctive anatomy'
            rows.append({"id":a["id"],"provider":"tripo","group":group_name,"path":a["file"],
                         "budgets":a["lodTriangles"],"prompt":f"Original Eldoria medieval realistic 3D game asset, {detail}, PBR, clean riggable topology, no background, no baked lighting."})
    if len({r["id"] for r in rows}) != len(rows):
        raise ValueError("Duplicate job ID")
    return rows

def main():
    p=argparse.ArgumentParser()
    p.add_argument("group", choices=["all","castle",*GROUPS,"troops","dragons"], default="all", nargs="?")
    p.add_argument("--limit", type=int)
    args=p.parse_args()
    if args.limit is not None and args.limit < 1:
        p.error("--limit must be positive")
    rows=queue(json.loads(CATALOG.read_text(encoding="utf-8")),args.group)
    print(json.dumps(rows[:args.limit], ensure_ascii=False, indent=2))

if __name__=="__main__":
    main()
