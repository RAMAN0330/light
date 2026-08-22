export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
}

export interface SchemaForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
}
