// DB Schema Parser — detects tables, columns, primary/foreign keys from SQL/ORM files

export interface DbColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isNullable: boolean;
  references?: { table: string; column: string };
  defaultValue?: string;
}

export interface DbTable {
  name: string;
  columns: DbColumn[];
  file: string;
  line?: number;
  engine?: string;
  relations: DbRelation[];
  app?: string;
  modelName?: string;
  dbTableName?: string;
}

export interface DbRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-many' | 'many-to-one' | 'many-to-many' | 'one-to-one';
}

export interface DbSchema {
  tables: DbTable[];
  relations: DbRelation[];
  files: string[];
  source: 'sql' | 'django' | 'sqlalchemy' | 'prisma' | 'sequelize' | 'mongoose' | 'typeorm' | 'mixed';
}

export interface SchemaColumn { name: string; type: string; nullable: boolean; isPrimary: boolean; }
export interface SchemaFK { column: string; referencedTable: string; referencedColumn: string; }
export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaFK[];
  app?: string;
  file?: string;
  line?: number;
  modelName?: string;
  dbTableName?: string;
}
export interface FlowSchema { tables: SchemaTable[]; }

// SQL type keywords for normalizing
const SQL_TYPES = ['INT','INTEGER','BIGINT','SMALLINT','TINYINT','DECIMAL','NUMERIC','FLOAT','DOUBLE','REAL',
  'VARCHAR','CHAR','TEXT','MEDIUMTEXT','LONGTEXT','NVARCHAR','NCHAR','CLOB',
  'DATE','DATETIME','TIMESTAMP','TIME','YEAR',
  'BOOLEAN','BOOL','BIT',
  'BLOB','BINARY','VARBINARY','BYTEA','JSON','JSONB','UUID','ENUM','SET',
  'SERIAL','BIGSERIAL','SMALLSERIAL','AUTOINCREMENT'];

function normalizeType(raw: string): string {
  if (!raw) return 'TEXT';
  const upper = raw.trim().toUpperCase().split('(')[0].split(' ')[0];
  if (SQL_TYPES.includes(upper)) return raw.trim().split(/\s+/).slice(0, 2).join(' ');
  return raw.trim();
}

// Parse raw CREATE TABLE SQL
function parseSQLCreateTable(sql: string, file: string): DbTable[] {
  const tables: DbTable[] = [];
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\)\s*(?:ENGINE\s*=\s*(\w+))?/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(sql)) !== null) {
    const tname = match[1];
    const body = match[2];
    const engine = match[3];
    const columns: DbColumn[] = [];
    const relations: DbRelation[] = [];

    const lines = body.split(/,(?![^(]*\))/g);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      // PRIMARY KEY constraint
      const pkConstraint = line.match(/^\s*(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkConstraint) {
        const pks = pkConstraint[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
        pks.forEach(pk => {
          const col = columns.find(c => c.name.toLowerCase() === pk.toLowerCase());
          if (col) col.isPrimaryKey = true;
        });
        continue;
      }

      // FOREIGN KEY constraint
      const fkConstraint = line.match(/^\s*(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i);
      if (fkConstraint) {
        const fkCols = fkConstraint[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
        const refTable = fkConstraint[2];
        const refCols = fkConstraint[3].split(',').map(c => c.trim().replace(/[`"]/g, ''));
        fkCols.forEach((fc, i) => {
          const col = columns.find(c => c.name.toLowerCase() === fc.toLowerCase());
          if (col) { col.isForeignKey = true; col.references = { table: refTable, column: refCols[i] || refCols[0] }; }
          relations.push({ fromTable: tname, fromColumn: fc, toTable: refTable, toColumn: refCols[i] || refCols[0], type: 'many-to-one' });
        });
        continue;
      }

      // UNIQUE constraint
      const uniqueConstraint = line.match(/^\s*(?:CONSTRAINT\s+\w+\s+)?UNIQUE\s*(?:KEY\s+\w+\s*)?\(([^)]+)\)/i);
      if (uniqueConstraint) {
        const uqs = uniqueConstraint[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
        uqs.forEach(uq => {
          const col = columns.find(c => c.name.toLowerCase() === uq.toLowerCase());
          if (col) col.isUnique = true;
        });
        continue;
      }

      // INDEX / KEY
      if (/^\s*(?:INDEX|KEY|FULLTEXT|SPATIAL)/i.test(line)) {
        const idxMatch = line.match(/\(([^)]+)\)/);
        if (idxMatch) {
          idxMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, '')).forEach(ic => {
            const col = columns.find(c => c.name.toLowerCase() === ic.toLowerCase());
            if (col) col.isIndexed = true;
          });
        }
        continue;
      }

      // Column definition
      const colMatch = line.match(/^\s*[`"]?(\w+)[`"]?\s+([\w\s(),']+?)(?:\s+(NOT NULL|NULL|PRIMARY KEY|UNIQUE|AUTO_INCREMENT|DEFAULT\s+\S+|REFERENCES\s+\w+\s*\(\w+\))[\s\S]*)?$/i);
      if (colMatch && colMatch[1].toUpperCase() !== 'CHECK') {
        const col: DbColumn = {
          name: colMatch[1],
          type: normalizeType(colMatch[2]),
          isPrimaryKey: /PRIMARY\s+KEY/i.test(line),
          isForeignKey: /REFERENCES/i.test(line),
          isUnique: /\bUNIQUE\b/i.test(line),
          isIndexed: false,
          isNullable: !/NOT NULL/i.test(line) && !/PRIMARY KEY/i.test(line),
        };
        const refMatch = line.match(/REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i);
        if (refMatch) {
          col.references = { table: refMatch[1], column: refMatch[2].trim().replace(/[`"]/g, '') };
          relations.push({ fromTable: tname, fromColumn: col.name, toTable: refMatch[1], toColumn: col.references.column, type: 'many-to-one' });
        }
        const defMatch = line.match(/DEFAULT\s+(\S+)/i);
        if (defMatch) col.defaultValue = defMatch[1];
        columns.push(col);
      }
    }

    tables.push({ name: tname, columns, file, engine, relations });
  }
  return tables;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function getDjangoAppName(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/').filter(Boolean);
  const filename = parts[parts.length - 1] || '';
  if (filename === 'models.py') return parts[parts.length - 2] || 'root';
  const modelsIdx = parts.lastIndexOf('models');
  if (modelsIdx > 0) return parts[modelsIdx - 1];
  return parts.length > 1 ? parts[parts.length - 2] : 'root';
}

function splitLinesWithOffsets(content: string) {
  const lines = content.split(/\r?\n/);
  let offset = 0;
  return lines.map((text, index) => {
    const start = offset;
    offset += text.length + 1;
    return { text, index, start };
  });
}

function parenDelta(text: string): number {
  let delta = 0;
  let quote = '';
  let escaped = false;
  for (const ch of text) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') delta++;
    else if (ch === ')') delta--;
  }
  return delta;
}

function extractFirstArg(args: string): string {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) return args.slice(0, i).trim();
  }
  return args.trim();
}

function normalizeDjangoRef(raw: string, app: string, modelName: string): string | null {
  if (!raw) return null;
  let ref = raw.trim();
  const quoted = ref.match(/^['"]([^'"]+)['"]$/);
  if (quoted) ref = quoted[1];
  ref = ref.replace(/^settings\./, '');
  if (ref === 'self') return `${app}.${modelName}`;
  if (ref === 'AUTH_USER_MODEL') return 'auth.User';
  if (/^[A-Z]\w*$/.test(ref)) return `${app}.${ref}`;
  if (/^[\w]+\.[A-Z]\w*$/.test(ref)) return ref;
  const modelMatch = ref.match(/([A-Z]\w*)$/);
  return modelMatch ? `${app}.${modelMatch[1]}` : null;
}

function collectDjangoFields(bodyLines: Array<{ text: string; index: number; start: number }>) {
  const fields: Array<{ name: string; type: string; args: string; line: number }> = [];
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].text;
    const m = line.match(/^\s{4,}(\w+)\s*=\s*(?:models\.)?(\w+)\s*\(/);
    if (!m || m[1] === 'Meta' || m[1].startsWith('_')) continue;
    let statement = line;
    let depth = parenDelta(line);
    while (depth > 0 && i + 1 < bodyLines.length) {
      i++;
      statement += '\n' + bodyLines[i].text;
      depth += parenDelta(bodyLines[i].text);
    }
    const argsStart = statement.indexOf('(') + 1;
    const argsEnd = statement.lastIndexOf(')');
    fields.push({
      name: m[1],
      type: m[2],
      args: argsEnd >= argsStart ? statement.slice(argsStart, argsEnd) : '',
      line: bodyLines[i].index + 1,
    });
  }
  return fields;
}

function extractDjangoMetaDbTable(body: string): string | undefined {
  const meta = body.match(/class\s+Meta\s*:\s*([\s\S]*?)(?=\n\s{4}\S|\s*$)/);
  const m = meta && meta[1].match(/\bdb_table\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : undefined;
}

// Parse Django models
export function parseDjangoModels(content: string, file: string): DbTable[] {
  const tables: DbTable[] = [];
  const app = getDjangoAppName(file);
  const allLines = splitLinesWithOffsets(content);
  for (let i = 0; i < allLines.length; i++) {
    const classMatch = allLines[i].text.match(/^(\s*)class\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (!classMatch) continue;
    const classIndent = classMatch[1].length;
    const modelName = classMatch[2];
    const bases = classMatch[3];
    if (!/(^|[.\s,])Model\b|models\.Model/.test(bases)) continue;

    const bodyLines: Array<{ text: string; index: number; start: number }> = [];
    for (let j = i + 1; j < allLines.length; j++) {
      const text = allLines[j].text;
      if (text.trim()) {
        const indent = (text.match(/^\s*/) || [''])[0].length;
        if (indent <= classIndent) break;
      }
      bodyLines.push(allLines[j]);
    }
    const classBody = bodyLines.map(l => l.text).join('\n');
    const dbTableName = extractDjangoMetaDbTable(classBody);
    const tableName = `${app}.${modelName}`;
    const columns: DbColumn[] = [];
    const relations: DbRelation[] = [];
    const fields = collectDjangoFields(bodyLines);
    for (const field of fields) {
      const fname = field.name;
      const ftype = field.type;
      const fargs = field.args;
      const isPK = fname === 'id' || /primary_key\s*=\s*True/i.test(fargs);
      const isFK = /ForeignKey|OneToOneField|ManyToManyField/i.test(ftype);
      const isUniq = /unique\s*=\s*True/i.test(fargs);
      const isNull = /null\s*=\s*True/i.test(fargs);
      const isManyToMany = /ManyToManyField/i.test(ftype);
      const col: DbColumn = {
        name: fname + (isFK && !isManyToMany ? '_id' : ''),
        type: ftype.replace(/Field$/, ''),
        isPrimaryKey: isPK,
        isForeignKey: isFK,
        isUnique: isUniq,
        isIndexed: /db_index\s*=\s*True/i.test(fargs),
        isNullable: isNull,
      };
      if (isFK) {
        const refTable = normalizeDjangoRef(extractFirstArg(fargs), app, modelName);
        if (refTable) {
          col.references = { table: refTable, column: 'id' };
          relations.push({ fromTable: tableName, fromColumn: col.name, toTable: refTable, toColumn: 'id', type: ftype.includes('ManyToMany') ? 'many-to-many' : ftype.includes('OneToOne') ? 'one-to-one' : 'many-to-one' });
        }
      }
      columns.push(col);
    }
    if (!columns.some(c => c.isPrimaryKey)) {
      columns.unshift({ name: 'id', type: 'Auto', isPrimaryKey: true, isForeignKey: false, isUnique: true, isIndexed: true, isNullable: false });
    }
    if (columns.length > 0) tables.push({ name: tableName, columns, file, line: getLineNumber(content, allLines[i].start), relations, app, modelName, dbTableName });
  }
  return tables;
}

// Parse SQLAlchemy models
function parseSQLAlchemy(content: string, file: string): DbTable[] {
  const tables: DbTable[] = [];
  const classRe = /class\s+(\w+)\s*\(\s*(?:Base|db\.Model|[\w.]+)\s*\)\s*:/gi;
  let cm: RegExpExecArray | null;
  const content2 = content;
  while ((cm = classRe.exec(content2)) !== null) {
    const tname = cm[1];
    const startIdx = cm.index + cm[0].length;
    const classBody = content2.slice(startIdx, content2.length);
    const columns: DbColumn[] = [];
    const relations: DbRelation[] = [];
    let colM: RegExpExecArray | null;
    const colBodyRe = /^\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(?:mapped_column|Column)\s*\(([^)]+)\)/gm;
    while ((colM = colBodyRe.exec(classBody)) !== null) {
      const fname = colM[1];
      const fargs = colM[2];
      const typeMatch = fargs.match(/(?:^|\s)(String|Integer|Float|Boolean|DateTime|Date|Text|JSON|UUID|Enum|BigInteger|SmallInteger|Numeric|LargeBinary)(?:\(|,|\s|$)/i);
      const isPK = /primary_key\s*=\s*True/i.test(fargs);
      const isFK = /ForeignKey/i.test(fargs);
      const isUniq = /unique\s*=\s*True/i.test(fargs);
      const isNull = /nullable\s*=\s*True/i.test(fargs);
      const col: DbColumn = {
        name: fname,
        type: typeMatch ? typeMatch[1] : 'Column',
        isPrimaryKey: isPK,
        isForeignKey: isFK,
        isUnique: isUniq,
        isIndexed: /index\s*=\s*True/i.test(fargs),
        isNullable: isNull || !isPK,
      };
      if (isFK) {
        const refMatch = fargs.match(/ForeignKey\s*\(\s*['"]([^.'"]+)\.([^'"]+)['"]/i);
        if (refMatch) {
          col.references = { table: refMatch[1], column: refMatch[2] };
          relations.push({ fromTable: tname, fromColumn: fname, toTable: refMatch[1], toColumn: refMatch[2], type: 'many-to-one' });
        }
      }
      columns.push(col);
    }
    if (columns.length > 0) tables.push({ name: tname, columns, file, relations });
  }
  return tables;
}

// Parse Prisma schema
function parsePrisma(content: string, file: string): DbTable[] {
  const tables: DbTable[] = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let mm: RegExpExecArray | null;
  while ((mm = modelRe.exec(content)) !== null) {
    const tname = mm[1];
    const body = mm[2];
    const columns: DbColumn[] = [];
    const relations: DbRelation[] = [];
    const fieldLines = body.split('\n');
    for (const fl of fieldLines) {
      const trimmed = fl.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('@')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      const fname = parts[0];
      const ftype = parts[1].replace('?', '').replace('[]', '');
      const isPK = /@id/.test(fl);
      const isUniq = /@unique/.test(fl);
      const isRelation = /@relation/.test(fl) || /[A-Z]/.test(ftype[0]);
      const isFK = isRelation;
      if (isRelation && !/String|Int|Boolean|Float|DateTime|Json|Bytes|Decimal|BigInt/.test(ftype)) continue;
      const col: DbColumn = {
        name: fname,
        type: ftype,
        isPrimaryKey: isPK,
        isForeignKey: isFK,
        isUnique: isUniq,
        isIndexed: /@index/.test(fl),
        isNullable: trimmed.includes('?'),
      };
      columns.push(col);
    }
    if (columns.length > 0) tables.push({ name: tname, columns, file, relations });
  }
  return tables;
}

// Detect schema file type
function detectSchemaType(file: string, content: string): 'sql' | 'django' | 'sqlalchemy' | 'prisma' | 'sequelize' | 'none' {
  const ext = file.split('.').pop()?.toLowerCase() || '';
  if (ext === 'sql' || /CREATE\s+TABLE/i.test(content)) return 'sql';
  if (file.endsWith('.prisma') || /^datasource\s+db/m.test(content)) return 'prisma';
  if (/class\s+\w+\s*\([^)]*models\.Model[^)]*\)\s*:/m.test(content) || /models\.(\w+Field|ForeignKey|OneToOneField|ManyToManyField)\s*\(/m.test(content)) return 'django';
  if (/(?:Column|mapped_column)\s*\(\s*(?:String|Integer|Boolean|DateTime)/m.test(content) && /class\s+\w+\s*\(/m.test(content)) return 'sqlalchemy';
  return 'none';
}

export function parseDbSchema(files: Array<{ path: string; content: string | null }>): DbSchema {
  const allTables: DbTable[] = [];
  const allRelations: DbRelation[] = [];
  const schemaFiles: string[] = [];
  const sourceTypes = new Set<string>();

  for (const f of files) {
    if (!f.content) continue;
    const type = detectSchemaType(f.path, f.content);
    if (type === 'none') continue;
    schemaFiles.push(f.path);
    sourceTypes.add(type);
    let tables: DbTable[] = [];
    if (type === 'sql') tables = parseSQLCreateTable(f.content, f.path);
    else if (type === 'django') tables = parseDjangoModels(f.content, f.path);
    else if (type === 'sqlalchemy') tables = parseSQLAlchemy(f.content, f.path);
    else if (type === 'prisma') tables = parsePrisma(f.content, f.path);
    allTables.push(...tables);
    tables.forEach(t => allRelations.push(...t.relations));
  }

  // Deduplicate tables by name (keep last defined)
  const tableMap = new Map<string, DbTable>();
  allTables.forEach(t => tableMap.set(t.name.toLowerCase(), t));

  const srcArr = Array.from(sourceTypes);
  const source: DbSchema['source'] = srcArr.length > 1 ? 'mixed' : (srcArr[0] as DbSchema['source']) || 'sql';

  return {
    tables: Array.from(tableMap.values()),
    relations: allRelations,
    files: schemaFiles,
    source,
  };
}

export function dbSchemaToFlowSchema(schema: DbSchema | { tables: DbTable[]; relations?: DbRelation[] }): FlowSchema {
  const relations = schema.relations || schema.tables.flatMap(t => t.relations || []);
  return {
    tables: schema.tables.map(t => {
      const fks = relations
        .filter(r => r.fromTable === t.name)
        .map(r => ({ column: r.fromColumn || 'id', referencedTable: r.toTable, referencedColumn: r.toColumn || 'id' }));
      return {
        name: t.name,
        app: t.app,
        file: t.file,
        line: t.line,
        modelName: t.modelName,
        dbTableName: t.dbTableName,
        columns: t.columns.map(c => ({
          name: c.name,
          type: c.type || '',
          nullable: !!c.isNullable,
          isPrimary: !!c.isPrimaryKey,
        })),
        foreignKeys: fks,
      };
    }),
  };
}
