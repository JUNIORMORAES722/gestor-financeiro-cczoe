require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usuarioRoutes = require("./routes/usuarioRoutes");
const { db, inicializarBanco, isProducao, pool } = require("./config/database");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { mensagem: "Muitas tentativas de login. Tente em 15 minutos." }
});

if (!process.env.JWT_SECRET) {
  console.error("ERRO: JWT_SECRET não foi configurada no arquivo .env.");
  process.exit(1);
}

app.use(helmet());
app.use(cors({
  origin: [
    "https://gestor-financeiro-cczoe.onrender.com",
    "https://juniormoraes722.github.io",
    "http://localhost:3000",
    "http://localhost:5173"
  ],
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.removeHeader("ETag");
  next();
});

app.use(express.static(path.join(__dirname, "../public")));

// ================== HEALTH ==================
app.get("/api/health", (req, res) => {
  return res.json({
    status: "ok",
    mensagem: "Sistema Gestor Financeiro da Igreja funcionando.",
  });
});

// ================== LOGIN ==================
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (
      typeof email !== "string" ||
      typeof senha !== "string" ||
      !email.trim() ||
      !senha
    ) {
      return res.status(400).json({ mensagem: "Informe o e-mail e a senha." });
    }
    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await db
      .prepare(
        `SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email =? LIMIT 1`,
      )
      .get(emailNormalizado);
    if (!usuario || Number(usuario.ativo) !== 1)
      return res.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    const senhaValida = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaValida)
      return res.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );
    return res
      .status(200)
      .json({
        mensagem: "Login realizado com sucesso.",
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
        },
      });
  } catch (erro) {
    console.error("Erro ao realizar login:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível realizar o login." });
  }
});

app.use("/api/usuarios", autenticarToken, usuarioRoutes);

// ================== AUTH ==================
function autenticarToken(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith("Bearer "))
    return res.status(401).json({ mensagem: "Token de acesso não informado." });
  const token = cabecalho.replace("Bearer ", "").trim();
  if (!token)
    return res.status(401).json({ mensagem: "Token de acesso inválido." });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (erro) {
    return res.status(401).json({ mensagem: "Token inválido ou expirado." });
  }
}

// ================== HELPERS ==================
function normalizarValor(valor) {
  if (typeof valor === "number") return valor;
  if (typeof valor !== "string") return NaN;
  const valorTratado = valor
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(valorTratado);
}
function dataValida(data) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data))
    return false;
  const dataConvertida = new Date(`${data}T00:00:00`);
  return (
    !Number.isNaN(dataConvertida.getTime()) &&
    dataConvertida.toISOString().startsWith(data)
  );
}
function obterIdUsuario(req) {
  return Number(req.usuario?.id);
}
function obterDataAtualISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}
async function obterContaPorId(id) {
  return await db
    .prepare(
      `SELECT id, nome, tipo, saldo_inicial, ativo, criado_em FROM contas WHERE id =?`,
    )
    .get(id);
}

// ================== CATEGORIAS ==================
app.get("/api/categorias", autenticarToken, async (req, res) => {
  try {
    const tipo = req.query.tipo;
    let categorias;
    if (tipo === "entrada" || tipo === "saida") {
      categorias = await db
        .prepare(
          `SELECT id, nome, tipo FROM categorias WHERE ativo = 1 AND tipo =? ORDER BY nome`,
        )
        .all(tipo);
    } else {
      categorias = await db
        .prepare(
          `SELECT id, nome, tipo FROM categorias WHERE ativo = 1 ORDER BY tipo, nome`,
        )
        .all();
    }
    return res.json(categorias);
  } catch (erro) {
    console.error("Erro ao listar categorias:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível listar as categorias." });
  }
});

// ================== CONTAS ==================
app.get("/api/contas", autenticarToken, async (req, res) => {
  try {
    const incluirInativas = req.query.incluirInativas === "true";
    const filtroStatus = incluirInativas ? "" : "WHERE contas.ativo = 1";
    const contas = await db
      .prepare(
        `
          SELECT contas.id, contas.nome, contas.tipo, contas.saldo_inicial, contas.ativo, contas.criado_em,
            COALESCE(SUM(CASE WHEN movimentacoes.tipo = 'entrada' THEN movimentacoes.valor ELSE 0 END),0) AS total_entradas,
            COALESCE(SUM(CASE WHEN movimentacoes.tipo = 'saida' THEN movimentacoes.valor ELSE 0 END),0) AS total_saidas,
            (contas.saldo_inicial + COALESCE(SUM(CASE WHEN movimentacoes.tipo = 'entrada' THEN movimentacoes.valor ELSE 0 END),0) - COALESCE(SUM(CASE WHEN movimentacoes.tipo = 'saida' THEN movimentacoes.valor ELSE 0 END),0)) AS saldo_atual
          FROM contas LEFT JOIN movimentacoes ON movimentacoes.conta_id = contas.id ${filtroStatus}
          GROUP BY contas.id, contas.nome, contas.tipo, contas.saldo_inicial, contas.ativo, contas.criado_em
          ORDER BY contas.ativo DESC, contas.nome ASC`,
      )
      .all();
    return res.json(
      contas.map((conta) => ({
        ...conta,
        saldo_inicial: Number(conta.saldo_inicial || 0),
        total_entradas: Number(conta.total_entradas || 0),
        total_saidas: Number(conta.total_saidas || 0),
        saldo_atual: Number(conta.saldo_atual || 0),
      })),
    );
  } catch (erro) {
    console.error("Erro ao listar contas:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível listar as contas." });
  }
});

app.post("/api/contas", autenticarToken, async (req, res) => {
  try {
    const { nome, tipo, saldoInicial } = req.body;
    if (typeof nome !== "string" || !nome.trim())
      return res.status(400).json({ mensagem: "Informe o nome da conta." });
    const nomeNormalizado = nome.trim();
    if (nomeNormalizado.length > 120)
      return res
        .status(400)
        .json({
          mensagem: "O nome da conta deve ter no máximo 120 caracteres.",
        });
    if (typeof tipo !== "string" || !tipo.trim())
      return res.status(400).json({ mensagem: "Informe o tipo da conta." });
    const tipoNormalizado = tipo.trim();
    const saldoInicialNumerico =
      saldoInicial === undefined ||
      saldoInicial === null ||
      String(saldoInicial).trim() === ""
        ? 0
        : normalizarValor(saldoInicial);
    if (!Number.isFinite(saldoInicialNumerico) || saldoInicialNumerico < 0)
      return res
        .status(400)
        .json({ mensagem: "O saldo inicial deve ser maior ou igual a zero." });
    const contaExistente = await db
      .prepare(
        `SELECT id FROM contas WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND ativo = 1 LIMIT 1`,
      )
      .get(nomeNormalizado);
    if (contaExistente)
      return res
        .status(409)
        .json({ mensagem: "Já existe uma conta ativa com esse nome." });
    const resultado = await db
      .prepare(
        `INSERT INTO contas (nome, tipo, saldo_inicial, ativo) VALUES (?,?,?,1)`,
      )
      .run(nomeNormalizado, tipoNormalizado, saldoInicialNumerico);
    return res
      .status(201)
      .json({
        mensagem: "Conta criada com sucesso.",
        conta: await obterContaPorId(resultado.lastInsertRowid),
      });
  } catch (erro) {
    console.error("Erro ao criar conta:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível criar a conta." });
  }
});

app.patch("/api/contas/:id", autenticarToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res
        .status(400)
        .json({ mensagem: "Identificador da conta inválido." });
    const contaAtual = await obterContaPorId(id);
    if (!contaAtual)
      return res.status(404).json({ mensagem: "Conta não encontrada." });
    const { nome, tipo, saldoInicial } = req.body;
    if (typeof nome !== "string" || !nome.trim())
      return res.status(400).json({ mensagem: "Informe o nome da conta." });
    if (typeof tipo !== "string" || !tipo.trim())
      return res.status(400).json({ mensagem: "Informe o tipo da conta." });
    const nomeNormalizado = nome.trim();
    const tipoNormalizado = tipo.trim();
    const saldoInicialNumerico =
      saldoInicial === undefined ||
      saldoInicial === null ||
      String(saldoInicial).trim() === ""
        ? Number(contaAtual.saldo_inicial)
        : normalizarValor(saldoInicial);
    if (!Number.isFinite(saldoInicialNumerico) || saldoInicialNumerico < 0)
      return res
        .status(400)
        .json({ mensagem: "O saldo inicial deve ser maior ou igual a zero." });
    const contaComMesmoNome = await db
      .prepare(
        `SELECT id FROM contas WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND id <>? AND ativo = 1 LIMIT 1`,
      )
      .get(nomeNormalizado, id);
    if (contaComMesmoNome)
      return res
        .status(409)
        .json({ mensagem: "Já existe uma conta ativa com esse nome." });
    await db
      .prepare(
        `UPDATE contas SET nome =?, tipo =?, saldo_inicial =? WHERE id =?`,
      )
      .run(nomeNormalizado, tipoNormalizado, saldoInicialNumerico, id);
    return res.json({
      mensagem: "Conta atualizada com sucesso.",
      conta: await obterContaPorId(id),
    });
  } catch (erro) {
    console.error("Erro ao atualizar conta:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível atualizar a conta." });
  }
});

app.patch("/api/contas/:id/status", autenticarToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ativoRecebido = req.body?.ativo;
    if (!Number.isInteger(id) || id <= 0)
      return res
        .status(400)
        .json({ mensagem: "Identificador da conta inválido." });
    if (typeof ativoRecebido !== "boolean")
      return res
        .status(400)
        .json({
          mensagem: "Informe o status da conta como verdadeiro ou falso.",
        });
    const conta = await obterContaPorId(id);
    if (!conta)
      return res.status(404).json({ mensagem: "Conta não encontrada." });
    const estaAtiva = Number(conta.ativo) === 1;
    if (estaAtiva === ativoRecebido)
      return res.json({
        mensagem: ativoRecebido
          ? "A conta já está ativa."
          : "A conta já está desativada.",
        conta,
      });
    if (!ativoRecebido) {
      const contaPendente = await db
        .prepare(
          `SELECT id FROM contas_pagar WHERE conta_id =? AND status = 'pendente' LIMIT 1`,
        )
        .get(id);
      if (contaPendente)
        return res
          .status(409)
          .json({
            mensagem:
              "Não é possível desativar uma conta vinculada a uma conta a pagar pendente.",
          });
      const contasAtivas = await db
        .prepare(`SELECT COUNT(*) AS total FROM contas WHERE ativo = 1`)
        .get();
      if (Number(contasAtivas.total) <= 1)
        return res
          .status(409)
          .json({
            mensagem:
              "Não é possível desativar a única conta ativa do sistema.",
          });
    }
    await db
      .prepare(`UPDATE contas SET ativo =? WHERE id =?`)
      .run(ativoRecebido ? 1 : 0, id);
    return res.json({
      mensagem: ativoRecebido
        ? "Conta ativada com sucesso."
        : "Conta desativada com sucesso.",
      conta: await obterContaPorId(id),
    });
  } catch (erro) {
    console.error("Erro ao alterar status da conta:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível alterar o status da conta." });
  }
});

// ================== LANÇAMENTOS ==================
app.get("/api/lancamentos", autenticarToken, async (req, res) => {
  try {
    const limiteInformado = Number(req.query.limite);
    const limite =
      Number.isInteger(limiteInformado) &&
      limiteInformado > 0 &&
      limiteInformado <= 200
        ? limiteInformado
        : 100;
    const lancamentos = await db
      .prepare(
        `SELECT movimentacoes.id, movimentacoes.tipo, movimentacoes.descricao, movimentacoes.valor, movimentacoes.data_movimentacao, movimentacoes.observacao, movimentacoes.criado_em, categorias.id AS categoria_id, categorias.nome AS categoria_nome, contas.id AS conta_id, contas.nome AS conta_nome, usuarios.id AS usuario_id, usuarios.nome AS usuario_nome FROM movimentacoes LEFT JOIN categorias ON categorias.id = movimentacoes.categoria_id INNER JOIN contas ON contas.id = movimentacoes.conta_id INNER JOIN usuarios ON usuarios.id = movimentacoes.usuario_id ORDER BY movimentacoes.data_movimentacao DESC, movimentacoes.id DESC LIMIT ?`,
      )
      .all(limite);
    return res.json(lancamentos);
  } catch (erro) {
    console.error("Erro ao listar lançamentos:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível listar os lançamentos." });
  }
});

app.post("/api/lancamentos", autenticarToken, async (req, res) => {
  try {
    const {
      tipo,
      descricao,
      valor,
      dataMovimentacao,
      categoriaId,
      contaId,
      observacao,
    } = req.body;
    if (tipo !== "entrada" && tipo !== "saida")
      return res
        .status(400)
        .json({ mensagem: "O tipo deve ser entrada ou saida." });
    if (typeof descricao !== "string" || !descricao.trim())
      return res
        .status(400)
        .json({ mensagem: "Informe a descrição do lançamento." });
    const valorNumerico = normalizarValor(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0)
      return res
        .status(400)
        .json({ mensagem: "Informe um valor maior que zero." });
    if (!dataValida(dataMovimentacao))
      return res
        .status(400)
        .json({ mensagem: "Informe uma data válida no formato correto." });
    const contaIdNumerico = Number(contaId);
    if (!Number.isInteger(contaIdNumerico) || contaIdNumerico <= 0)
      return res.status(400).json({ mensagem: "Informe uma conta válida." });
    const conta = await db
      .prepare(`SELECT id FROM contas WHERE id =? AND ativo = 1`)
      .get(contaIdNumerico);
    if (!conta)
      return res
        .status(400)
        .json({ mensagem: "A conta informada não existe ou está inativa." });
    let categoriaIdNumerico = null;
    if (
      categoriaId !== undefined &&
      categoriaId !== null &&
      String(categoriaId).trim() !== ""
    ) {
      categoriaIdNumerico = Number(categoriaId);
      if (!Number.isInteger(categoriaIdNumerico) || categoriaIdNumerico <= 0)
        return res
          .status(400)
          .json({ mensagem: "Informe uma categoria válida." });
      const categoria = await db
        .prepare(
          `SELECT id FROM categorias WHERE id =? AND tipo =? AND ativo = 1`,
        )
        .get(categoriaIdNumerico, tipo);
      if (!categoria)
        return res
          .status(400)
          .json({
            mensagem: "A categoria não corresponde ao tipo do lançamento.",
          });
    }
    const resultado = await db
      .prepare(
        `INSERT INTO movimentacoes (tipo, descricao, valor, data_movimentacao, categoria_id, conta_id, usuario_id, observacao) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        tipo,
        descricao.trim(),
        valorNumerico,
        dataMovimentacao,
        categoriaIdNumerico,
        contaIdNumerico,
        obterIdUsuario(req),
        typeof observacao === "string" ? observacao.trim() || null : null,
      );
    const lancamentoCriado = await db
      .prepare(
        `SELECT movimentacoes.id, movimentacoes.tipo, movimentacoes.descricao, movimentacoes.valor, movimentacoes.data_movimentacao, movimentacoes.observacao, categorias.nome AS categoria_nome, contas.nome AS conta_nome FROM movimentacoes LEFT JOIN categorias ON categorias.id = movimentacoes.categoria_id INNER JOIN contas ON contas.id = movimentacoes.conta_id WHERE movimentacoes.id =?`,
      )
      .get(resultado.lastInsertRowid);
    return res
      .status(201)
      .json({
        mensagem: "Lançamento criado com sucesso.",
        lancamento: lancamentoCriado,
      });
  } catch (erro) {
    console.error("Erro ao criar lançamento:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível criar o lançamento." });
  }
});

app.delete("/api/lancamentos/:id", autenticarToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ mensagem: "Identificador inválido." });
    const lancamento = await db
      .prepare(`SELECT id FROM movimentacoes WHERE id =?`)
      .get(id);
    if (!lancamento)
      return res.status(404).json({ mensagem: "Lançamento não encontrado." });
    await db.prepare(`DELETE FROM movimentacoes WHERE id =?`).run(id);
    return res.json({ mensagem: "Lançamento excluído com sucesso." });
  } catch (erro) {
    console.error("Erro ao excluir lançamento:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível excluir o lançamento." });
  }
});

// ================== CONTAS A PAGAR ==================
app.get("/api/contas-pagar", autenticarToken, async (req, res) => {
  try {
    const contas = await db
      .prepare(
        `SELECT contas_pagar.id, contas_pagar.descricao, contas_pagar.valor, contas_pagar.vencimento, contas_pagar.status, contas_pagar.data_pagamento, contas_pagar.observacao, categorias.id AS categoria_id, categorias.nome AS categoria_nome, contas.id AS conta_id, contas.nome AS conta_nome FROM contas_pagar LEFT JOIN categorias ON categorias.id = contas_pagar.categoria_id LEFT JOIN contas ON contas.id = contas_pagar.conta_id ORDER BY CASE contas_pagar.status WHEN 'pendente' THEN 1 WHEN 'paga' THEN 2 ELSE 3 END, contas_pagar.vencimento ASC, contas_pagar.id DESC`,
      )
      .all();
    return res.json(contas);
  } catch (erro) {
    console.error("Erro ao listar contas a pagar:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível listar as contas a pagar." });
  }
});

app.post("/api/contas-pagar", autenticarToken, async (req, res) => {
  try {
    const { descricao, valor, vencimento, categoriaId, contaId, observacao } =
      req.body;
    if (typeof descricao !== "string" || !descricao.trim())
      return res
        .status(400)
        .json({ mensagem: "Informe a descrição da conta." });
    const valorNumerico = normalizarValor(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0)
      return res
        .status(400)
        .json({ mensagem: "Informe um valor maior que zero." });
    if (!dataValida(vencimento))
      return res
        .status(400)
        .json({ mensagem: "Informe um vencimento válido." });
    let categoriaIdNumerico = null;
    if (
      categoriaId !== undefined &&
      categoriaId !== null &&
      String(categoriaId).trim() !== ""
    ) {
      categoriaIdNumerico = Number(categoriaId);
      const categoria = await db
        .prepare(
          `SELECT id FROM categorias WHERE id =? AND tipo = 'saida' AND ativo = 1`,
        )
        .get(categoriaIdNumerico);
      if (
        !Number.isInteger(categoriaIdNumerico) ||
        categoriaIdNumerico <= 0 ||
        !categoria
      )
        return res
          .status(400)
          .json({ mensagem: "A categoria deve ser uma categoria de saída." });
    }
    let contaIdNumerico = null;
    if (
      contaId !== undefined &&
      contaId !== null &&
      String(contaId).trim() !== ""
    ) {
      contaIdNumerico = Number(contaId);
      if (!Number.isInteger(contaIdNumerico) || contaIdNumerico <= 0)
        return res.status(400).json({ mensagem: "Informe uma conta válida." });
      const conta = await db
        .prepare(`SELECT id FROM contas WHERE id =? AND ativo = 1`)
        .get(contaIdNumerico);
      if (!conta)
        return res
          .status(400)
          .json({ mensagem: "A conta informada não existe ou está inativa." });
    }
    const resultado = await db
      .prepare(
        `INSERT INTO contas_pagar (descricao, valor, vencimento, status, categoria_id, conta_id, observacao, usuario_id) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        descricao.trim(),
        valorNumerico,
        vencimento,
        "pendente",
        categoriaIdNumerico,
        contaIdNumerico,
        typeof observacao === "string" ? observacao.trim() || null : null,
        obterIdUsuario(req),
      );
    const contaCriada = await db
      .prepare(
        `SELECT contas_pagar.id, contas_pagar.descricao, contas_pagar.valor, contas_pagar.vencimento, contas_pagar.status, contas_pagar.observacao, categorias.nome AS categoria_nome, contas.nome AS conta_nome FROM contas_pagar LEFT JOIN categorias ON categorias.id = contas_pagar.categoria_id LEFT JOIN contas ON contas.id = contas_pagar.conta_id WHERE contas_pagar.id =?`,
      )
      .get(resultado.lastInsertRowid);
    return res
      .status(201)
      .json({
        mensagem: "Conta a pagar criada com sucesso.",
        conta: contaCriada,
      });
  } catch (erro) {
    console.error("Erro ao criar conta a pagar:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível criar a conta a pagar." });
  }
});

app.patch("/api/contas-pagar/:id/pagar", autenticarToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const contaIdRecebida = Number(req.body.contaId);
    if (!Number.isInteger(id) || id <= 0)
      return res
        .status(400)
        .json({ mensagem: "Identificador da conta inválido." });
    if (!Number.isInteger(contaIdRecebida) || contaIdRecebida <= 0)
      return res
        .status(400)
        .json({ mensagem: "Informe a conta utilizada para o pagamento." });
    const contaPagar = await db
      .prepare(
        `SELECT id, descricao, valor, categoria_id, observacao, status FROM contas_pagar WHERE id =?`,
      )
      .get(id);
    if (!contaPagar)
      return res
        .status(404)
        .json({ mensagem: "Conta a pagar não encontrada." });
    if (contaPagar.status !== "pendente")
      return res
        .status(409)
        .json({ mensagem: "Essa conta já foi paga ou cancelada." });
    const contaPagamento = await db
      .prepare(`SELECT id FROM contas WHERE id =? AND ativo = 1`)
      .get(contaIdRecebida);
    if (!contaPagamento)
      return res
        .status(400)
        .json({ mensagem: "A conta informada não existe ou está inativa." });
    const dataPagamento = obterDataAtualISO();
    await db
      .prepare(
        `UPDATE contas_pagar SET status = 'paga', conta_id =?, data_pagamento =? WHERE id =? AND status = 'pendente'`,
      )
      .run(contaIdRecebida, dataPagamento, id);
    const movimentacao = await db
      .prepare(
        `INSERT INTO movimentacoes (tipo, descricao, valor, data_movimentacao, categoria_id, conta_id, usuario_id, observacao) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        "saida",
        contaPagar.descricao,
        contaPagar.valor,
        dataPagamento,
        contaPagar.categoria_id,
        contaIdRecebida,
        obterIdUsuario(req),
        contaPagar.observacao,
      );
    return res.json({
      mensagem: "Conta marcada como paga e saída registrada.",
      movimentacaoId: Number(movimentacao.lastInsertRowid),
    });
  } catch (erro) {
    console.error("Erro ao pagar conta:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível marcar a conta como paga." });
  }
});

app.patch(
  "/api/contas-pagar/:id/cancelar",
  autenticarToken,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ mensagem: "Identificador inválido." });
      const resultado = await db
        .prepare(
          `UPDATE contas_pagar SET status = 'cancelada' WHERE id =? AND status = 'pendente'`,
        )
        .run(id);
      if (resultado.changes === 0) {
        const conta = await db
          .prepare(`SELECT id, status FROM contas_pagar WHERE id =?`)
          .get(id);
        if (!conta)
          return res
            .status(404)
            .json({ mensagem: "Conta a pagar não encontrada." });
        return res
          .status(409)
          .json({ mensagem: "Somente contas pendentes podem ser canceladas." });
      }
      return res.json({ mensagem: "Conta a pagar cancelada com sucesso." });
    } catch (erro) {
      console.error("Erro ao cancelar conta:", erro);
      return res
        .status(500)
        .json({ mensagem: "Não foi possível cancelar a conta." });
    }
  },
);

app.delete("/api/contas-pagar/:id", autenticarToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ mensagem: "Identificador inválido." });
    const conta = await db
      .prepare(`SELECT id, status FROM contas_pagar WHERE id =?`)
      .get(id);
    if (!conta)
      return res
        .status(404)
        .json({ mensagem: "Conta a pagar não encontrada." });
    if (conta.status === "paga")
      return res
        .status(409)
        .json({ mensagem: "Contas pagas não podem ser excluídas." });
    await db.prepare(`DELETE FROM contas_pagar WHERE id =?`).run(id);
    return res.json({ mensagem: "Conta a pagar excluída com sucesso." });
  } catch (erro) {
    console.error("Erro ao excluir conta:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível excluir a conta." });
  }
});

// ================== RESUMO ==================
app.get("/api/dashboard/resumo", autenticarToken, async (req, res) => {
  try {
    const entradas = await db
      .prepare(
        `SELECT COALESCE(SUM(valor),0) AS total FROM movimentacoes WHERE tipo = 'entrada'`,
      )
      .get();
    const saidas = await db
      .prepare(
        `SELECT COALESCE(SUM(valor),0) AS total FROM movimentacoes WHERE tipo = 'saida'`,
      )
      .get();
    const pendencias = await db
      .prepare(
        `SELECT COALESCE(SUM(valor),0) AS total FROM contas_pagar WHERE status = 'pendente'`,
      )
      .get();
    const saldoInicial = await db
      .prepare(
        `SELECT COALESCE(SUM(saldo_inicial),0) AS total FROM contas WHERE ativo = 1`,
      )
      .get();
    return res.json({
      saldoAtual:
        Number(saldoInicial?.total || 0) +
        Number(entradas?.total || 0) -
        Number(saidas?.total || 0),
      totalEntradas: Number(entradas?.total || 0),
      totalSaidas: Number(saidas?.total || 0),
      contasPendentes: Number(pendencias?.total || 0),
    });
  } catch (erro) {
    console.error("Erro ao carregar resumo:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível carregar o resumo financeiro." });
  }
});

// ================== RELATÓRIO ==================
app.get("/api/relatorios/lancamentos", autenticarToken, async (req, res) => {
  try {
    const { dataInicio, dataFim, tipo, contaId, categoriaId } = req.query;
    const condicoes = [];
    const parametros = [];
    if (dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      condicoes.push("movimentacoes.data_movimentacao >=?");
      parametros.push(dataInicio);
    }
    if (dataFim && /^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
      condicoes.push("movimentacoes.data_movimentacao <=?");
      parametros.push(dataFim);
    }
    if (tipo === "entrada" || tipo === "saida") {
      condicoes.push("movimentacoes.tipo =?");
      parametros.push(tipo);
    }
    const contaIdNumerico = Number(contaId);
    if (contaId && Number.isInteger(contaIdNumerico) && contaIdNumerico > 0) {
      condicoes.push("movimentacoes.conta_id =?");
      parametros.push(contaIdNumerico);
    }
    const categoriaIdNumerico = Number(categoriaId);
    if (
      categoriaId &&
      Number.isInteger(categoriaIdNumerico) &&
      categoriaIdNumerico > 0
    ) {
      condicoes.push("movimentacoes.categoria_id =?");
      parametros.push(categoriaIdNumerico);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const lancamentos = await db
      .prepare(
        `SELECT movimentacoes.id, movimentacoes.tipo, movimentacoes.descricao, movimentacoes.valor, movimentacoes.data_movimentacao, movimentacoes.observacao, categorias.nome AS categoria_nome, contas.nome AS conta_nome, usuarios.nome AS usuario_nome FROM movimentacoes LEFT JOIN categorias ON categorias.id = movimentacoes.categoria_id INNER JOIN contas ON contas.id = movimentacoes.conta_id INNER JOIN usuarios ON usuarios.id = movimentacoes.usuario_id ${where} ORDER BY movimentacoes.data_movimentacao ASC, movimentacoes.id ASC`,
      )
      .all(...parametros);
    let totalEntradas = 0;
    let totalSaidas = 0;
    for (const l of lancamentos) {
      const v = Number(l.valor || 0);
      if (l.tipo === "entrada") totalEntradas += v;
      if (l.tipo === "saida") totalSaidas += v;
    }
    return res.json({
      filtros: {
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        tipo: tipo || "todos",
        contaId: contaId || null,
        categoriaId: categoriaId || null,
      },
      lancamentos: lancamentos.map((item) => ({
        ...item,
        valor: Number(item.valor || 0),
      })),
      totais: {
        quantidade: lancamentos.length,
        entradas: totalEntradas,
        saidas: totalSaidas,
        saldo: totalEntradas - totalSaidas,
      },
    });
  } catch (erro) {
    console.error("Erro ao gerar relatório:", erro);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível gerar o relatório." });
  }
});

app.use("/api", (req, res) => {
  return res.status(404).json({ mensagem: "Rota da API não encontrada." });
});
app.use((req, res) => {
  return res.sendFile(path.join(__dirname, "../public/index.html"));
});

(async () => {
  await inicializarBanco();
  app.listen(PORT, () => {
    console.log(
      `Servidor iniciado em: http://localhost:${PORT} | Producao: ${isProducao}`,
    );
  });
})();
