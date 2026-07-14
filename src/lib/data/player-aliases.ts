export const PLAYER_ALIAS_OVERRIDES: Record<string,string>={
  'aidan pirc':'aidan-pirc', 'aiden':'aiden', 'player':'unknown-player'
};
export function slugifyName(name:string){return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown-player'}
export function canonicalPlayerId(name:string){const key=name.trim().toLowerCase(); return PLAYER_ALIAS_OVERRIDES[key] ?? slugifyName(name)}
