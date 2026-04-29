export interface MigrationContext {
  dryRun: boolean;
  startedAt: Date;
}

export interface PhaseResult {
  read: number;
  written: number;
  skipped?: number;
  warnings?: string[];
}

export type Migrator = (ctx: MigrationContext) => Promise<PhaseResult>;
