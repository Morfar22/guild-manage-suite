const { SlashCommandBuilder } = require('discord.js');

const FIVEM_GROUPS = {
  moderation: [
    { name: 'kick', description: 'Kick en spiller fra serveren', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
      { type: 'string', name: 'reason', description: 'Årsag' },
    ]},
    { name: 'kickall', description: 'Kick alle spillere fra serveren', permission: 'admin', options: [
      { type: 'string', name: 'reason', description: 'Årsag', required: true },
    ]},
    { name: 'ban', description: 'Ban en spiller', permission: 'admin', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
      { type: 'string', name: 'duration', description: 'Varighed', required: true, choices: [
        ['1 time','1h'], ['1 dag','1d'], ['7 dage','7d'], ['30 dage','30d'], ['Permanent','permanent'],
      ]},
      { type: 'string', name: 'reason', description: 'Årsag', required: true },
    ]},
    { name: 'warn', description: 'Advar en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
      { type: 'string', name: 'reason', description: 'Årsag', required: true },
    ]},
    { name: 'jail', description: 'Fængsl en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
      { type: 'integer', name: 'time', description: 'Tid i minutter', required: true },
      { type: 'string', name: 'reason', description: 'Årsag' },
    ]},
    { name: 'unjail', description: 'Løslad en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
    ]},
    { name: 'freeze', description: 'Frys en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
    ]},
    { name: 'unfreeze', description: 'Frigør en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
    ]},
    { name: 'spectate', description: 'Spectate en spiller', permission: 'mod', options: [
      { type: 'integer', name: 'id', description: 'Spillerens server ID', required: true },
    ]},
  ],
  player: [
    { name: 'kill', description: 'Dræb en spiller', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'revive', description: 'Genopliv en spiller', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'revive-all', description: 'Genopliv alle spillere', permission: 'god', options: []},
    { name: 'heal', description: 'Heal en spiller', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'armor', description: 'Giv fuld armor', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'sethealth', description: 'Sæt health', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'integer', name:'amount', description:'Health 0-200', required:true, min:0, max:200 },
    ]},
    { name: 'setarmor', description: 'Sæt armor', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'integer', name:'amount', description:'Armor 0-100', required:true, min:0, max:100 },
    ]},
    { name: 'sethunger', description: 'Sæt sult', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'integer', name:'amount', description:'Sult 0-100', required:true, min:0, max:100 },
    ]},
    { name: 'setthirst', description: 'Sæt tørst', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'integer', name:'amount', description:'Tørst 0-100', required:true, min:0, max:100 },
    ]},
    { name: 'setstress', description: 'Sæt stress', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'integer', name:'amount', description:'Stress 0-100', required:true, min:0, max:100 },
    ]},
    { name: 'setmodel', description: 'Skift ped model', permission: 'admin', options: [
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'model', description:'Ped model', required:true },
    ]},
    { name: 'logout', description: 'Log en spiller ud af karakteren', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'identifiers', description: 'Vis identifiers', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'permissions', description: 'Vis framework/ACE permissions', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'godmode', description: 'Toggle godmode', permission: 'god', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'invisible', description: 'Toggle usynlighed', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name: 'noclip', description: 'Toggle noclip', permission: 'admin', options: [{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
  ],
  teleport: [
    { name:'player', description:'Teleportér en spiller', permission:'mod', options:[
      { type:'string', name:'type', description:'Teleport-type', required:true, choices:[['Koordinater','coords'],['Preset','preset']]},
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'number', name:'x', description:'X koordinat' },
      { type:'number', name:'y', description:'Y koordinat' },
      { type:'number', name:'z', description:'Z koordinat' },
      { type:'string', name:'location', description:'Preset: pillbox, mrpd, airport, legion, paleto, sandy' },
      { type:'boolean', name:'keepvehicle', description:'Behold spilleren i køretøj' },
    ]},
    { name:'all', description:'Teleportér alle spillere', permission:'god', options:[
      { type:'string', name:'type', description:'Teleport-type', required:true, choices:[['Koordinater','coords'],['Preset','preset']]},
      { type:'number', name:'x', description:'X koordinat' },
      { type:'number', name:'y', description:'Y koordinat' },
      { type:'number', name:'z', description:'Z koordinat' },
      { type:'string', name:'location', description:'Preset lokation' },
    ]},
    { name:'bring', description:'Bring en spiller til dig', permission:'mod', options:[{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
    { name:'goto', description:'Gå til en spiller', permission:'mod', options:[{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
  ],
  vehicle: [
    { name:'spawn', description:'Spawn køretøj til en spiller', permission:'god', options:[
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'spawncode', description:'Køretøjets spawncode', required:true },
      { type:'string', name:'plate', description:'Nummerplade' },
    ]},
    { name:'delete', description:'Slet spillerens køretøj', permission:'admin', options:[{ type:'integer', name:'id', description:'Spillerens server ID' }]},
    { name:'repair', description:'Reparer spillerens køretøj', permission:'mod', options:[{ type:'integer', name:'id', description:'Spillerens server ID' }]},
  ],
  weapon: [
    { name:'give', description:'Giv et våben', permission:'god', options:[
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'weapon', description:'Fx WEAPON_PISTOL', required:true },
      { type:'integer', name:'ammo', description:'Ammunition' },
    ]},
    { name:'remove', description:'Fjern et våben', permission:'admin', options:[
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'weapon', description:'Våbenkode', required:true },
    ]},
    { name:'clear', description:'Fjern alle våben', permission:'admin', options:[{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
  ],
  economy: [
    { name:'money', description:'Administrer spillerens penge', permission:'admin', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Tilføj','add'],['Fjern','remove'],['Sæt','set'],['Vis','inspect']]},
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'type', description:'Pengetype', choices:[['Cash','cash'],['Bank','bank'],['Crypto','crypto']]},
      { type:'integer', name:'amount', description:'Beløb', min:0 },
    ]},
    { name:'inventory', description:'Administrer inventory', permission:'admin', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Giv','give'],['Tag','take'],['Vis','inspect'],['Ryd','clear']]},
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'item', description:'Item navn' },
      { type:'integer', name:'count', description:'Antal', min:1 },
    ]},
  ],
  jobs: [
    { name:'job', description:'Administrer job', permission:'admin', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Sæt','set'],['Fyr','fire'],['Vis','inspect']]},
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'job', description:'Job navn' },
      { type:'integer', name:'grade', description:'Grade', min:0 },
    ]},
    { name:'gang', description:'Administrer gang', permission:'admin', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Sæt','set'],['Fjern','remove'],['Vis','inspect']]},
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'gang', description:'Gang navn' },
      { type:'integer', name:'grade', description:'Grade', min:0 },
    ]},
    { name:'clothing-menu', description:'Åbn tøjmenu', permission:'admin', options:[{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
  ],
  server: [
    { name:'info', description:'Vis serverstatus', permission:'user', options:[] },
    { name:'players', description:'Vis online spillere', permission:'mod', options:[] },
    { name:'count', description:'Vis online antal', permission:'user', options:[] },
    { name:'announcement', description:'Send announcement til alle spillere', permission:'mod', options:[{ type:'string', name:'message', description:'Besked', required:true }]},
    { name:'message', description:'Send privat besked til spiller', permission:'mod', options:[
      { type:'integer', name:'id', description:'Spillerens server ID', required:true },
      { type:'string', name:'message', description:'Besked', required:true },
    ]},
    { name:'time', description:'Sæt server-tid', permission:'admin', options:[{ type:'integer', name:'hour', description:'Time 0-23', required:true, min:0, max:23 }]},
    { name:'weather', description:'Sæt vejr eller blackout', permission:'admin', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Sæt vejr','set'],['Toggle blackout','blackout']]},
      { type:'string', name:'weather', description:'Vejrtype', choices:[
        ['Clear','CLEAR'],['Extra Sunny','EXTRASUNNY'],['Clouds','CLOUDS'],['Overcast','OVERCAST'],['Rain','RAIN'],['Thunder','THUNDER'],['Snow','SNOW'],['Blizzard','BLIZZARD'],['Foggy','FOGGY'],['XMAS','XMAS'],
      ]},
    ]},
    { name:'resource', description:'Administrer server resources', permission:'god', options:[
      { type:'string', name:'action', description:'Handling', required:true, choices:[['Ensure','ensure'],['Start','start'],['Stop','stop'],['Restart','restart'],['Refresh','refresh'],['List','list'],['Inspect','inspect']]},
      { type:'string', name:'name', description:'Resource navn' },
    ]},
    { name:'screenshot', description:'Tag screenshot af en spiller', permission:'god', options:[{ type:'integer', name:'id', description:'Spillerens server ID', required:true }]},
  ],
  whitelist: [
    { name:'toggle', description:'Slå whitelist til/fra', permission:'admin', options:[] },
    { name:'add', description:'Tilføj Discord-bruger til whitelist', permission:'admin', options:[{ type:'string', name:'discord_id', description:'Discord bruger ID', required:true }]},
    { name:'remove', description:'Fjern Discord-bruger fra whitelist', permission:'admin', options:[{ type:'string', name:'discord_id', description:'Discord bruger ID', required:true }]},
    { name:'check', description:'Tjek whitelist-status', permission:'mod', options:[{ type:'string', name:'discord_id', description:'Discord bruger ID', required:true }]},
  ],
};

const LEVELS = ['user', 'mod', 'admin', 'god'];

function addOption(builder, option) {
  const configure = (o) => {
    o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required));
    if (option.choices && option.choices.length && typeof o.addChoices === 'function') {
      o.addChoices(...option.choices.map(([name, value]) => ({ name, value })));
    }
    if (option.min !== undefined && typeof o.setMinValue === 'function') o.setMinValue(option.min);
    if (option.max !== undefined && typeof o.setMaxValue === 'function') o.setMaxValue(option.max);
    return o;
  };

  if (option.type === 'integer') return builder.addIntegerOption(configure);
  if (option.type === 'number') return builder.addNumberOption(configure);
  if (option.type === 'boolean') return builder.addBooleanOption(configure);
  if (option.type === 'channel') return builder.addChannelOption(configure);
  return builder.addStringOption(configure);
}

function buildFiveMCommand() {
  const command = new SlashCommandBuilder()
    .setName('fivem')
    .setDescription('Administrer din FiveM server');

  for (const [groupName, subcommands] of Object.entries(FIVEM_GROUPS)) {
    command.addSubcommandGroup((group) => {
      group.setName(groupName).setDescription(`FiveM ${groupName}`);
      for (const def of subcommands) {
        group.addSubcommand((sub) => {
          sub.setName(def.name).setDescription(def.description);
          for (const option of def.options || []) addOption(sub, option);
          return sub;
        });
      }
      return group;
    });
  }

  return command;
}

function getFiveMDefinition(group, subcommand) {
  return FIVEM_GROUPS[group]?.find((entry) => entry.name === subcommand) || null;
}

function getFiveMPermission(group, subcommand) {
  return getFiveMDefinition(group, subcommand)?.permission || 'god';
}

function permissionAtLeast(actual, required) {
  return LEVELS.indexOf(actual) >= LEVELS.indexOf(required);
}

function queueCommandName(group, subcommand) {
  return `${group}_${subcommand}`;
}

module.exports = {
  FIVEM_GROUPS,
  LEVELS,
  buildFiveMCommand,
  getFiveMDefinition,
  getFiveMPermission,
  permissionAtLeast,
  queueCommandName,
};
