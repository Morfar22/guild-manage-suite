import routeConfig from '../../shared/command-routes.json';

type FlatCommand = {
  name: string;
  description?: string;
  options?: Array<Record<string, any>>;
  [key: string]: any;
};

type CommandRoute = {
  logical: string;
  category: string;
  source: string;
  handler?: string;
  root: string;
  group?: string;
  sub?: string;
  passthrough?: boolean;
};

const routes = routeConfig.routes as CommandRoute[];
const roots = routeConfig.roots as Record<string, { description?: string; groups?: Record<string, string> }>;
const routeByLogical = new Map(routes.map((route) => [route.logical, route]));

function makeSubcommandFromFlat(route: CommandRoute, flatDefinition: FlatCommand) {
  const nested = (flatDefinition.options || []).find(
    (option) => option?.type === 1 && option.name === route.sub
  );

  if (nested) {
    return { ...nested, type: 1, name: route.sub };
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

export function groupFlatCommandDefinitions(flatDefinitions: FlatCommand[]) {
  const sourceByName = new Map(flatDefinitions.map((definition) => [definition.name, definition]));
  const rootCommands = new Map<string, any>();

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
        (option: any) => option.type === 2 && option.name === route.group
      );
      if (!groupDefinition) {
        groupDefinition = {
          type: 2,
          name: route.group,
          description: roots[route.root]?.groups?.[route.group] || `${route.group} commands`,
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
      throw new Error(`Discord option limit overskredet for /${command.name}`);
    }
    for (const option of command.options) {
      if (option.type === 2 && option.options?.length > 25) {
        throw new Error(`Discord subcommand limit overskredet for /${command.name} ${option.name}`);
      }
    }
  }

  return result;
}

export const canonicalLogicalCommands = routes.map((route) => route.logical);


export function getCommandSlashPath(logicalName: string): string {
  const route = routeByLogical.get(logicalName);
  if (!route) return `/${logicalName}`;
  if (route.passthrough) return `/${route.root}`;

  const parts = [route.root];
  if (route.group) parts.push(route.group);
  if (route.sub) parts.push(route.sub);
  return `/${parts.join(' ')}`;
}
