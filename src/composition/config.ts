export interface CompositionEnvironment {
  readonly DATABASE_URL?: string;
}

export interface CompositionConfig {
  readonly databaseUrl: string;
}

export class MissingCompositionConfigError extends Error {
  public constructor(public readonly key: keyof CompositionEnvironment) {
    super(`${key} is required for application composition.`);
    this.name = "MissingCompositionConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function loadCompositionConfig(
  environment: CompositionEnvironment = process.env,
): CompositionConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (databaseUrl === undefined || databaseUrl === "") {
    throw new MissingCompositionConfigError("DATABASE_URL");
  }

  return {
    databaseUrl,
  };
}
