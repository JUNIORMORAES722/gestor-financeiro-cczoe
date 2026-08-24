const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const isProducao =!!process.env.DATABASE_URL;
let pool = null;
let sqliteDb = null;

if (isProducao) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("-> Banco: PostgreSQL Neon (produção)");
} else {
  const Database = require("better-sqlite3");
  const pastaData = path.resolve(__dirname, "../../data");
  if (!fs.existsSync(pastaData)) fs.mkdirSync(pastaData, { recursive: true });
  const caminhoBanco = path.join(pastaData, "gestor-financeiro.db");
  sqliteDb = new Database(caminhoBanco);
  sqliteDb.pragma("foreign_keys = ON");
  sqliteDb.pragma("journal_mode = WAL");
  console.log("-> Banco: SQLite local");
}

const db = {
  prepare: (sql) => {
    if (isProducao) {
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      return {
        get: async (...params) => {
          const r = await pool.query(pgSql, params);
          return r.rows[0];
        },
        all: async (...params) => {
          const r = await pool.query(pgSql, params);
          return r.rows;
        },
        run: async (...params) => {
          // Para INSERT
          const isInsert = pgSql.trim().toLowerCase().startsWith("insert");
          const finalSql = isInsert &&!pgSql.toLowerCase().includes("returning")? pgSql + " RETURNING id" : pgSql;
          const r = await pool.query(finalSql, params);
          return {
            lastInsertRowid: r.rows[0]?.id || 0,
            changes: r.rowCount
          };
        }
      };
    } else {
      const stmt = sqliteDb.prepare(sql);
      return {
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
        run: (...params) => stmt.run(...params)
      };
    }
  },
  exec: async (sql) => {
    if (isProducao) await pool.query(sql);
    else sqliteDb.exec(sql);
  }
};

async function criarTabelas() {
  if (isProducao) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'usuario',
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contas (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        saldo_inicial REAL NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS movimentacoes (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
        descricao TEXT NOT NULL,
        valor REAL NOT NULL CHECK(valor > 0),
        data_movimentacao TEXT NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id),
        conta_id INTEGER NOT NULL REFERENCES contas(id),
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        observacao TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contas_pagar (
        id SERIAL PRIMARY KEY,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL CHECK(valor > 0),
        vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'paga', 'cancelada')),
        categoria_id INTEGER REFERENCES categorias(id),
        conta_id INTEGER REFERENCES contas(id),
        data_pagamento TEXT,
        observacao TEXT,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'usuario',
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        saldo_inicial REAL NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS movimentacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
        descricao TEXT NOT NULL,
        valor REAL NOT NULL CHECK(valor > 0),
        data_movimentacao TEXT NOT NULL,
        categoria_id INTEGER,
        conta_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        observacao TEXT,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (conta_id) REFERENCES contas(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      );
      CREATE TABLE IF NOT EXISTS contas_pagar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL CHECK(valor > 0),
        vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'paga', 'cancelada')),
        categoria_id INTEGER,
        conta_id INTEGER,
        data_pagamento TEXT,
        observacao TEXT,
        usuario_id INTEGER NOT NULL,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (conta_id) REFERENCES contas(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      );
    `);
  }
}

async function criarAdministradorInicial() {
  const emailOriginal = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME || "Administrador";
  if (!emailOriginal ||!senha) {
    console.warn("Admin não criado: confira ADMIN_EMAIL e ADMIN_SENHA no.env");
    return;
  }
  const email = emailOriginal.trim().toLowerCase();
  const adminExiste = await db.prepare("SELECT id FROM usuarios WHERE email =?").get(email);
  if (!adminExiste) {
    const senhaHash = bcrypt.hashSync(senha, 10);
    await db.prepare(`INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)`).run(nome, email, senhaHash, "administrador");
    console.log("Usuário administrador inicial criado");
  }
}

async function criarDadosIniciais() {
  const totalContas = await db.prepare("SELECT COUNT(*) AS total FROM contas").get();
  if (Number(totalContas.total) === 0) {
    await db.prepare(`INSERT INTO contas (nome, tipo, saldo_inicial) VALUES (?,?,?)`).run("Caixa Principal", "caixa", 0);
  }
  const totalCategorias = await db.prepare("SELECT COUNT(*) AS total FROM categorias").get();
  if (Number(totalCategorias.total) === 0) {
    const categorias = [["Dízimos","entrada"],["Ofertas","entrada"],["Doações","entrada"],["Eventos","entrada"],["Água e Energia","saida"],["Manutenção","saida"],["Material de Escritório","saida"],["Ação Social","saida"]];
    for (const [n,t] of categorias) {
      await db.prepare(`INSERT INTO categorias (nome, tipo) VALUES (?,?)`).run(n,t);
    }
  }
}

async function inicializarBanco() {
  await criarTabelas();
  await criarAdministradorInicial();
  await criarDadosIniciais();
}

module.exports = { db, inicializarBanco, isProducao, pool };