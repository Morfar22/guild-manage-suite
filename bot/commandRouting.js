'use strict';

const fs = require('fs');
const path = require('path');

function loadRouteConfig() {
  const candidates = [
    path.join(__dirname, 'command-routes.json'),
    path.join(__dirname, 'shared', 'command-routes.json'),
    path.join(__dirname, '..', 'shared', 'command-routes.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error(
    `command-routes.json blev ikke fundet. Forsøgte: ${candidates.join(', ')}`
  );
}

const routeConfig = loadRouteConfig();

const routes = routeConfig.routes || [];
const roots = routeConfig.roots || {};
const legacyAliases = routeConfig.legacyAliases || {};

const routeByLogical = new Map(routes.map((route) => [route.logical, route]));
const routeByPath = new Map();
for (const route of routes) {
  if (route.passthrough) continue;
  const key = [route.root, route.group || '', route.sub || ''].join(':');
  routeByPath.set(key, route);
}

function safeGetSubcommand(interaction) {
  try {
    return interaction?.options?.getSubcommand?.(false) || null;
  } catch {
    return null;
  }
}

function safeGetSubcommandGroup(interaction) {
  try {
    return interaction?.options?.getSubcommandGroup?.(false) || null;
  } catch {
    return null;
  }
}

function resolveInteractionCommand(interaction) {
  const root = interaction?.commandName || null;
  if (!root) {
    return {
      logicalName: null,
      handlerName: null,
      root: null,
      group: null,
      subcommand: null,
      grouped: false,
    };
  }

  const group = safeGetSubcommandGroup(interaction);
  const subcommand = safeGetSubcommand(interaction);

  // New grouped structure.
  const groupedRoute = routeByPath.get([root, group || '', subcommand || ''].join(':'));
  if (groupedRoute) {
    return {
      logicalName: groupedRoute.logical,
      handlerName: groupedRoute.handler || groupedRoute.source || groupedRoute.logical,
      root,
      group,
      subcommand,
      grouped: true,
      route: groupedRoute,
    };
  }

  // Dedicated passthrough roots, currently /fivem.
  const passthrough = routes.find((route) => route.passthrough && route.root === root);
  if (passthrough) {
    return {
      logicalName: passthrough.logical,
      handlerName: passthrough.handler || passthrough.source || passthrough.logical,
      root,
      group,
      subcommand,
      grouped: false,
      route: passthrough,
    };
  }

  // Transitional compatibility for legacy composite commands such as
  // /musicquiz start while Discord caches are refreshing.
  if (subcommand) {
    const legacyComposite = routes.find(
      (route) => route.source === root && route.sub === subcommand
    );
    if (legacyComposite) {
      return {
        logicalName: legacyComposite.logical,
        handlerName: legacyComposite.handler || root,
        root,
        group,
        subcommand,
        grouped: false,
        route: legacyComposite,
      };
    }
  }

  // Legacy aliases remain usable through prefix commands and during rollout.
  const canonicalAlias = legacyAliases[root];
  if (canonicalAlias) {
    const route = routeByLogical.get(canonicalAlias);
    return {
      logicalName: canonicalAlias,
      handlerName: root,
      root,
      group,
      subcommand,
      grouped: false,
      route: route || null,
    };
  }

  // Legacy flat slash command while guild command cache is transitioning.
  const directRoute = routeByLogical.get(root);
  if (directRoute) {
    return {
      logicalName: directRoute.logical,
      handlerName: directRoute.handler || directRoute.source || root,
      root,
      group,
      subcommand,
      grouped: false,
      route: directRoute,
    };
  }

  return {
    logicalName: root,
    handlerName: root,
    root,
    group,
    subcommand,
    grouped: false,
    route: null,
  };
}

function resolveLegacyCommandName(commandName) {
  return legacyAliases[commandName] || commandName;
}

function makeSubcommandFromFlat(route, flatDefinition) {
  const nested = Array.isArray(flatDefinition.options)
    ? flatDefinition.options.find((option) => option?.type === 1 && option.name === route.sub)
    : null;

  if (nested) {
    return {
      ...nested,
      type: 1,
      name: route.sub,
    };
  }

  const options = (flatDefinition.options || []).filter(
    (option) => option?.type !== 1 && option?.type !== 2
  );

  return {
    type: 1,
    name: route.sub,
    description: flatDefinition.description || `${route.sub} command`,
    ...(options.length ? { options } : {}),
  };
}

function groupFlatCommandDefinitions(flatDefinitions) {
  const sourceByName = new Map(flatDefinitions.map((definition) => [definition.name, definition]));
  const rootCommands = new Map();

  for (const route of routes) {
    if (route.passthrough) continue;

    const sourceDefinition = sourceByName.get(route.source);
    if (!sourceDefinition) {
      throw new Error(
        `Grouped command route "${route.logical}" mangler source-definition "${route.source}"`
      );
    }

    let rootCommand = rootCommands.get(route.root);
    if (!rootCommand) {
      rootCommand = {
        name: route.root,
        description: roots[route.root]?.description || `${route.root} commands`,
        options: [],
      };
      rootCommands.set(route.root, rootCommand);
    }

    const subcommand = makeSubcommandFromFlat(route, sourceDefinition);

    if (route.group) {
      let groupDefinition = rootCommand.options.find(
        (option) => option.type === 2 && option.name === route.group
      );
      if (!groupDefinition) {
        groupDefinition = {
          type: 2,
          name: route.group,
          description:
            roots[route.root]?.groups?.[route.group] ||
            `${route.group} commands`,
          options: [],
        };
        rootCommand.options.push(groupDefinition);
      }
      groupDefinition.options.push(subcommand);
    } else {
      rootCommand.options.push(subcommand);
    }
  }

  const result = [...rootCommands.values()];

  for (const command of result) {
    if (command.options.length > 25) {
      throw new Error(
        `Discord option limit overskredet for /${command.name}: ${command.options.length}/25`
      );
    }
    for (const option of command.options) {
      if (option.type === 2 && option.options?.length > 25) {
        throw new Error(
          `Discord subcommand limit overskredet for /${command.name} ${option.name}: ${option.options.length}/25`
        );
      }
    }
  }

  return result;
}

function getCanonicalLogicalCommands() {
  return routes.map((route) => route.logical);
}

function getSlashPathForLogical(logicalName) {
  const route = routeByLogical.get(logicalName);
  if (!route) return `/${logicalName}`;
  if (route.passthrough) return `/${route.root}`;

  const parts = [route.root];
  if (route.group) parts.push(route.group);
  if (route.sub) parts.push(route.sub);
  return `/${parts.join(' ')}`;
}

module.exports = {
  routeConfig,
  routes,
  roots,
  legacyAliases,
  resolveInteractionCommand,
  resolveLegacyCommandName,
  groupFlatCommandDefinitions,
  getCanonicalLogicalCommands,
  getSlashPathForLogical,
};
