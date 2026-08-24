const token = sessionStorage.getItem("token");
const usuarioSalvo =
  sessionStorage.getItem("usuario");

// ================================================
// ELEMENTOS GERAIS
// ================================================

const mensagemDashboard =
  document.querySelector("#mensagem-dashboard");

const mensagemLancamento =
  document.querySelector("#mensagem-lancamento");

const mensagemContaPagar =
  document.querySelector("#mensagem-conta-pagar");

const botaoSair =
  document.querySelector("#botao-sair");

// ================================================
// RELATÓRIO FINANCEIRO
// ================================================

const formFiltrosRelatorio =
  document.querySelector("#form-filtros-relatorio");

const dataInicioRelatorio =
  document.querySelector("#relatorio-data-inicio");

const dataFimRelatorio =
  document.querySelector("#relatorio-data-fim");

const tipoRelatorio =
  document.querySelector("#relatorio-tipo");

const contaRelatorio =
  document.querySelector("#relatorio-conta");

const categoriaRelatorio =
  document.querySelector("#relatorio-categoria");

const botaoGerarRelatorio =
  document.querySelector("#botao-gerar-relatorio");

const botaoImprimirRelatorio =
  document.querySelector(
    "#botao-imprimir-relatorio"
  );

const botaoLimparFiltros =
  document.querySelector("#botao-limpar-filtros");

const listaRelatorio =
  document.querySelector("#lista-relatorio");

const mensagemRelatorio =
  document.querySelector("#mensagem-relatorio");


// ================================================
// LANÇAMENTO
// ================================================

const formLancamento =
  document.querySelector("#form-lancamento");

const tipoLancamento =
  document.querySelector("#tipo-lancamento");

const categoriaLancamento =
  document.querySelector("#categoria-lancamento");

const contaLancamento =
  document.querySelector("#conta-lancamento");

const listaLancamentos =
  document.querySelector("#lista-lancamentos");

const botaoSalvarLancamento =
  document.querySelector(
    "#botao-salvar-lancamento"
  );


// ================================================
// CONTAS A PAGAR
// ================================================

const formContaPagar =
  document.querySelector("#form-conta-pagar");

const categoriaContaPagar =
  document.querySelector(
    "#categoria-conta-pagar"
  );

const contaContaPagar =
  document.querySelector("#conta-conta-pagar");

const listaContasPagar =
  document.querySelector("#lista-contas-pagar");

const botaoSalvarContaPagar =
  document.querySelector(
    "#botao-salvar-conta-pagar"
  );

const filtroStatusContas =
  document.querySelector(
    "#filtro-status-contas"
  );

const filtroBuscaContas =
  document.querySelector(
    "#filtro-busca-contas"
  );

// ================================================
// GERENCIAMENTO DE USUÁRIOS (NOVAS VARIÁVEIS)
// ================================================

const formUsuario = document.querySelector("#form-usuario");
const nomeUsuarioForm = document.querySelector("#nome-usuario-form");
const emailUsuarioForm = document.querySelector("#email-usuario-form");
const senhaUsuarioForm = document.querySelector("#senha-usuario-form");
const perfilUsuarioForm = document.querySelector("#perfil-usuario-form");
const botaoSalvarUsuario = document.querySelector("#botao-salvar-usuario");
const botaoCancelarEdicaoUsuario = document.querySelector("#botao-cancelar-edicao-usuario");
const mensagemUsuario = document.querySelector("#mensagem-usuario");
const listaUsuarios = document.querySelector("#lista-usuarios");

let usuarioEmEdicaoId = null; // Variável para controlar qual usuário está sendo editado


// ================================================
// RELATÓRIO FINANCEIRO
// ================================================

async function carregarFiltrosRelatorio() {
  const [contas, categorias] =
    await Promise.all([
      requisicaoApi("/api/contas"),
      requisicaoApi("/api/categorias")
    ]);

  preencherSelectRelatorio(
    contaRelatorio,
    contas,
    "Todas as contas",
    "nome"
  );

  preencherSelectRelatorio(
    categoriaRelatorio,
    categorias,
    "Todas as categorias",
    "nome"
  );
}


function preencherSelectRelatorio(
  select,
  itens,
  textoInicial,
  propriedadeTexto
) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  const opcaoInicial =
    document.createElement("option");

  opcaoInicial.value = "";
  opcaoInicial.textContent = textoInicial;
  select.appendChild(opcaoInicial);

  for (const item of itens) {
    const opcao =
      document.createElement("option");

    opcao.value = item.id;
    opcao.textContent =
      item[propriedadeTexto];

    select.appendChild(opcao);
  }
}


async function gerarRelatorio() {
  const dataInicio =
    dataInicioRelatorio.value;

  const dataFim =
    dataFimRelatorio.value;

  if (dataInicio && dataFim && dataInicio > dataFim) {
    throw new Error(
      "A data inicial não pode ser maior que a data final."
    );
  }

  const parametros =
    new URLSearchParams();

  if (dataInicio) {
    parametros.set(
      "dataInicio",
      dataInicio
    );
  }

  if (dataFim) {
    parametros.set(
      "dataFim",
      dataFim
    );
  }

  if (tipoRelatorio.value) {
    parametros.set(
      "tipo",
      tipoRelatorio.value
    );
  }

  if (contaRelatorio.value) {
    parametros.set(
      "contaId",
      contaRelatorio.value
    );
  }

  if (categoriaRelatorio.value) {
    parametros.set(
      "categoriaId",
      categoriaRelatorio.value
    );
  }

  const caminho =
    `/api/relatorios/lancamentos?${parametros.toString()}`;

  const dados =
    await requisicaoApi(caminho);

  preencherResumoRelatorio(dados);
  preencherTabelaRelatorio(
    dados.lancamentos || []
  );

  botaoImprimirRelatorio.disabled = false;

  mensagemRelatorio.textContent =
    "Relatório gerado com sucesso.";

  mensagemRelatorio.className =
    "mensagem-formulario sucesso";
}


function preencherResumoRelatorio(dados) {
  const totais =
    dados.totais || {};

  document.querySelector(
    "#relatorio-total-entradas"
  ).textContent =
    formatarMoeda(totais.entradas);

  document.querySelector(
    "#relatorio-total-saidas"
  ).textContent =
    formatarMoeda(totais.saidas);

  document.querySelector(
    "#relatorio-saldo"
  ).textContent =
    formatarMoeda(totais.saldo);

  document.querySelector(
    "#relatorio-quantidade"
  ).textContent =
    Number(totais.quantidade || 0);

  document.querySelector(
    "#relatorio-total-tabela"
  ).textContent =
    formatarMoeda(
      Number(totais.entradas || 0) -
      Number(totais.saidas || 0)
    );

  document.querySelector(
    "#relatorio-data-emissao"
  ).textContent =
    new Date().toLocaleString("pt-BR");

  document.querySelector(
    "#relatorio-periodo"
  ).textContent =
    obterPeriodoRelatorio();

  document.querySelector(
    "#relatorio-filtros-aplicados"
  ).textContent =
    obterFiltrosAplicados();
}


function preencherTabelaRelatorio(lancamentos) {
  listaRelatorio.innerHTML = "";

  if (!lancamentos.length) {
    listaRelatorio.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="tabela-vazia"
        >
          Nenhum lançamento encontrado
          para os filtros informados.
        </td>
      </tr>
    `;

    return;
  }

  for (const lancamento of lancamentos) {
    const linha =
      document.createElement("tr");

    const ehEntrada =
      lancamento.tipo === "entrada";

    const classeTipo =
      ehEntrada
        ? "tipo-entrada"
        : "tipo-saida";

    const classeValor =
      ehEntrada
        ? "valor-entrada"
        : "valor-saida";

    const sinal =
      ehEntrada ? "+" : "-";

    linha.innerHTML = `
      <td>
        ${formatarData(
          lancamento.data_movimentacao
        )}
      </td>

      <td>
        <span class="etiqueta-tipo ${classeTipo}">
          ${ehEntrada ? "Entrada" : "Saída"}
        </span>
      </td>

      <td>
        <strong>
          ${escaparHtml(
            lancamento.descricao
          )}
        </strong>
      </td>

      <td>
        ${escaparHtml(
          lancamento.categoria_nome ||
          "Sem categoria"
        )}
      </td>

      <td>
        ${escaparHtml(
          lancamento.conta_nome || "-"
        )}
      </td>

      <td>
        ${lancamento.observacao
          ? escaparHtml(
              lancamento.observacao
            )
          : "-"}
      </td>

      <td
        class="coluna-valor ${classeValor}"
      >
        ${sinal}
        ${formatarMoeda(
          lancamento.valor
        )}
      </td>
    `;

    listaRelatorio.appendChild(linha);
  }
}


function obterPeriodoRelatorio() {
  const inicio =
    dataInicioRelatorio.value;

  const fim =
    dataFimRelatorio.value;

  if (inicio && fim) {
    return `${formatarData(inicio)} até ${formatarData(fim)}`;
  }

  if (inicio) {
    return `A partir de ${formatarData(inicio)}`;
  }

  if (fim) {
    return `Até ${formatarData(fim)}`;
  }

  return "Todos os períodos";
}


function obterFiltrosAplicados() {
  const filtros = [];

  if (dataInicioRelatorio.value) {
    filtros.push(
      `Início: ${formatarData(dataInicioRelatorio.value)}`
    );
  }

  if (dataFimRelatorio.value) {
    filtros.push(
      `Fim: ${formatarData(dataFimRelatorio.value)}`
    );
  }

  if (tipoRelatorio.value) {
    filtros.push(
      tipoRelatorio.value === "entrada"
        ? "Tipo: Entradas"
        : "Tipo: Saídas"
    );
  }

  if (contaRelatorio.value) {
    filtros.push(
      `Conta: ${
        contaRelatorio.options[
          contaRelatorio.selectedIndex
        ].textContent
      }`
    );
  }

  if (categoriaRelatorio.value) {
    filtros.push(
      `Categoria: ${
        categoriaRelatorio.options[
          categoriaRelatorio.selectedIndex
        ].textContent
      }`
    );
  }

  return filtros.length
    ? filtros.join(" • ")
    : "Nenhum filtro";
}

// ================================================
// GERENCIAMENTO DE CONTAS
// ================================================

const formConta =
  document.querySelector("#form-conta");

const nomeConta =
  document.querySelector("#nome-conta");

const tipoConta =
  document.querySelector("#tipo-conta");

const saldoInicialConta =
  document.querySelector(
    "#saldo-inicial-conta"
  );

const botaoSalvarConta =
  document.querySelector(
    "#botao-salvar-conta"
  );

const botaoCancelarEdicaoConta =
  document.querySelector(
    "#botao-cancelar-edicao-conta"
  );

const mensagemConta =
  document.querySelector("#mensagem-conta");

const listaGerenciamentoContas =
  document.querySelector(
    "#lista-gerenciamento-contas"
  );

let contaEmEdicaoId = null;


// ================================================
// INICIALIZAÇÃO
// ================================================

if (!token) {
  window.location.href = "/";
} else {
  carregarUsuario();
  definirDataAtual();
  definirVencimentoAtual();
  inicializarDashboard();
}


async function inicializarDashboard() {
  try {
    await Promise.all([
      carregarResumo(),
      carregarContas(),
      carregarContasGerenciamento(),
      carregarCategorias(),
      carregarLancamentos(),
      carregarContasPagar(),
      carregarFiltrosRelatorio(),
      carregarUsuarios() // Adicione esta linha!
    ]);
  } catch (erro) {
    console.error(erro);

    mostrarMensagemDashboard(
      erro.message,
      "erro"
    );
  }
}


// ================================================
// REQUISIÇÕES
// ================================================

async function requisicaoApi(
  url,
  opcoes = {}
) {
  const resposta = await fetch(url, {
    cache: "no-store",
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const dados = await resposta
    .json()
    .catch(() => ({}));

  if (resposta.status === 401) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");

    window.location.href = "/";

    throw new Error(
      "Sua sessão expirou."
    );
  }

  if (!resposta.ok) {
    throw new Error(
      dados.mensagem ||
        "Não foi possível concluir a operação."
    );
  }

  return dados;
}


// ================================================
// USUÁRIO E RESUMO
// ================================================

function carregarUsuario() {
  if (!usuarioSalvo) {
    return;
  }

  try {
    const usuario =
      JSON.parse(usuarioSalvo);

    const elementoNome =
      document.querySelector(
        "#nome-usuario"
      );

    if (elementoNome) {
      elementoNome.textContent =
        `Olá, ${usuario.nome}`;
    }
  } catch (erro) {
    console.error(
      "Não foi possível carregar o usuário:",
      erro
    );
  }
}


async function carregarResumo() {
  const dados = await requisicaoApi(
    "/api/dashboard/resumo"
  );

  document.querySelector(
    "#saldo-atual"
  ).textContent =
    formatarMoeda(dados.saldoAtual);

  document.querySelector(
    "#total-entradas"
  ).textContent =
    formatarMoeda(dados.totalEntradas);

  document.querySelector(
    "#total-saidas"
  ).textContent =
    formatarMoeda(dados.totalSaidas);

  document.querySelector(
    "#contas-pendentes"
  ).textContent =
    formatarMoeda(dados.contasPendentes);
}


// ================================================
// CARREGAR CONTAS NOS FORMULÁRIOS
// ================================================

async function carregarContas() {
  const contas = await requisicaoApi(
    "/api/contas"
  );

  preencherSelectContas(
    contaLancamento,
    contas,
    "Selecione uma conta"
  );

  preencherSelectContas(
    contaContaPagar,
    contas,
    "Selecione uma conta"
  );
}


function preencherSelectContas(
  select,
  contas,
  textoInicial
) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!contas.length) {
    const opcao =
      document.createElement("option");

    opcao.value = "";
    opcao.textContent =
      "Nenhuma conta disponível";

    select.appendChild(opcao);

    return;
  }

  const opcaoInicial =
    document.createElement("option");

  opcaoInicial.value = "";
  opcaoInicial.textContent =
    textoInicial;

  select.appendChild(opcaoInicial);

  for (const conta of contas) {
    const opcao =
      document.createElement("option");

    opcao.value = conta.id;
    opcao.textContent = conta.nome;

    select.appendChild(opcao);
  }
}


// ================================================
// CATEGORIAS
// ================================================

async function carregarCategorias() {
  const tipo = tipoLancamento.value;

  const categorias = await requisicaoApi(
    `/api/categorias?tipo=${encodeURIComponent(tipo)}`
  );

  categoriaLancamento.innerHTML = "";

  const opcaoSemCategoria =
    document.createElement("option");

  opcaoSemCategoria.value = "";
  opcaoSemCategoria.textContent =
    "Sem categoria";

  categoriaLancamento.appendChild(
    opcaoSemCategoria
  );

  for (const categoria of categorias) {
    const opcao =
      document.createElement("option");

    opcao.value = categoria.id;
    opcao.textContent = categoria.nome;

    categoriaLancamento.appendChild(opcao);
  }
}


async function carregarCategoriasSaida() {
  const categorias = await requisicaoApi(
    "/api/categorias?tipo=saida"
  );

  categoriaContaPagar.innerHTML = "";

  const opcaoSemCategoria =
    document.createElement("option");

  opcaoSemCategoria.value = "";
  opcaoSemCategoria.textContent =
    "Sem categoria";

  categoriaContaPagar.appendChild(
    opcaoSemCategoria
  );

  for (const categoria of categorias) {
    const opcao =
      document.createElement("option");

    opcao.value = categoria.id;
    opcao.textContent = categoria.nome;

    categoriaContaPagar.appendChild(opcao);
  }
}


// ================================================
// LANÇAMENTOS RECENTES
// ================================================

async function carregarLancamentos() {
  const lancamentos = await requisicaoApi(
    "/api/lancamentos?limite=100"
  );

  listaLancamentos.innerHTML = "";

  if (!lancamentos.length) {
    listaLancamentos.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="tabela-vazia"
        >
          Nenhum lançamento cadastrado.
        </td>
      </tr>
    `;

    return;
  }

  for (const lancamento of lancamentos) {
    const linha = document.createElement("tr");

    const classeTipo =
      lancamento.tipo === "entrada"
        ? "tipo-entrada"
        : "tipo-saida";

    const sinal =
      lancamento.tipo === "entrada"
        ? "+"
        : "-";

    linha.innerHTML = `
      <td>
        <span
          class="etiqueta-tipo ${classeTipo}"
        >
          ${
            lancamento.tipo === "entrada"
              ? "Entrada"
              : "Saída"
          }
        </span>
      </td>

      <td>
        <strong>
          ${escaparHtml(
            lancamento.descricao
          )}
        </strong>
      </td>

      <td
        class="${classeTipo} valor-tabela"
      >
        ${sinal}
        ${formatarMoeda(lancamento.valor)}
      </td>

      <td>
        ${
          lancamento.observacao
            ? escaparHtml(
                lancamento.observacao
              )
            : "-"
        }
      </td>

      <td>
        ${escaparHtml(
          lancamento.categoria_nome ||
            "Sem categoria"
        )}
      </td>

      <td>
        ${formatarData(
          lancamento.data_movimentacao
        )}
      </td>

      <td>
        ${escaparHtml(
          lancamento.conta_nome || "-"
        )}
      </td>
    `;

    listaLancamentos.appendChild(linha);
  }
}

// ================================================
// GERENCIAMENTO DE CONTAS
// ================================================

async function carregarContasGerenciamento() {
  const contas = await requisicaoApi(
    "/api/contas?incluirInativas=true"
  );

  listaGerenciamentoContas.innerHTML = "";

  if (!contas.length) {
    listaGerenciamentoContas.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="tabela-vazia"
        >
          Nenhuma conta cadastrada.
        </td>
      </tr>
    `;

    return;
  }

  for (const conta of contas) {
    const linha = document.createElement("tr");

    const contaAtiva =
      Number(conta.ativo) === 1;

    const classeStatus = contaAtiva
      ? "status-paga"
      : "status-cancelada";

    const textoStatus = contaAtiva
      ? "Ativa"
      : "Inativa";

    const textoAcao = contaAtiva
      ? "Desativar"
      : "Ativar";

    const saldoAtual =
      Number(conta.saldo_atual || 0);

    const totalEntradas =
      Number(conta.total_entradas || 0);

    const totalSaidas =
      Number(conta.total_saidas || 0);

    const classeSaldo =
      saldoAtual < 0
        ? "tipo-saida"
        : "tipo-entrada";

    linha.innerHTML = `
      <td>
        <strong>
          ${escaparHtml(conta.nome)}
        </strong>
      </td>

      <td>
        ${escaparHtml(conta.tipo)}
      </td>

      <td class="valor-tabela">
        ${formatarMoeda(
          conta.saldo_inicial
        )}
      </td>

      <td class="tipo-entrada valor-tabela">
        ${formatarMoeda(totalEntradas)}
      </td>

      <td class="tipo-saida valor-tabela">
        ${formatarMoeda(totalSaidas)}
      </td>

      <td
        class="${classeSaldo} valor-tabela"
      >
        ${formatarMoeda(saldoAtual)}
      </td>

      <td>
        <span
          class="etiqueta-status ${classeStatus}"
        >
          ${textoStatus}
        </span>
      </td>

      <td class="acoes-tabela">
        <button
          type="button"
          class="botao-editar-conta"
          data-id="${conta.id}"
        >
          Editar
        </button>

        <button
          type="button"
          class="botao-status-conta"
          data-id="${conta.id}"
          data-ativo="${contaAtiva}"
        >
          ${textoAcao}
        </button>
      </td>
    `;

    listaGerenciamentoContas.appendChild(linha);
  }
}


function limparFormularioConta() {
  contaEmEdicaoId = null;

  formConta.reset();

  saldoInicialConta.value = "0,00";

  botaoSalvarConta.textContent =
    "Cadastrar conta";

  botaoCancelarEdicaoConta.hidden = true;

  mensagemConta.textContent = "";

  mensagemConta.className =
    "mensagem-formulario";
}


function preencherFormularioConta(
  conta
) {
  contaEmEdicaoId =
    Number(conta.id);

  nomeConta.value =
    conta.nome || "";

  tipoConta.value =
    conta.tipo || "";

  saldoInicialConta.value =
    formatarValorParaInput(
      conta.saldo_inicial
    );

  botaoSalvarConta.textContent =
    "Salvar alterações";

  botaoCancelarEdicaoConta.hidden =
    false;

  mensagemConta.textContent =
    "Editando conta selecionada.";

  mensagemConta.className =
    "mensagem-formulario";
}


function formatarValorParaInput(valor) {
  const numero = Number(valor || 0);

  return numero.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}


// ================================================
// FORMULÁRIO DE CONTAS
// ================================================

formConta.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    const idEmEdicao =
      contaEmEdicaoId;

    const editando =
      Number.isInteger(idEmEdicao);

    const dados = {
      nome: nomeConta.value.trim(),
      tipo: tipoConta.value.trim(),
      saldoInicial:
        saldoInicialConta.value
    };

    botaoSalvarConta.disabled = true;

    botaoSalvarConta.textContent =
      editando
        ? "Salvando..."
        : "Cadastrando...";

    mensagemConta.textContent = "";

    mensagemConta.className =
      "mensagem-formulario";

    try {
      const resposta =
        await requisicaoApi(
          editando
            ? `/api/contas/${idEmEdicao}`
            : "/api/contas",
          {
            method: editando
              ? "PATCH"
              : "POST",
            body: JSON.stringify(dados)
          }
        );

      limparFormularioConta();

      mostrarMensagemConta(
        resposta.mensagem ||
          "Conta salva com sucesso.",
        "sucesso"
      );

      await Promise.all([
        carregarContas(),
        carregarContasGerenciamento(),
        carregarResumo()
      ]);
    } catch (erro) {
      console.error(
        "Erro ao salvar conta:",
        erro
      );

      mostrarMensagemConta(
        erro.message,
        "erro"
      );
    } finally {
      botaoSalvarConta.disabled = false;

      if (contaEmEdicaoId === null) {
        botaoSalvarConta.textContent =
          "Cadastrar conta";
      } else {
        botaoSalvarConta.textContent =
          "Salvar alterações";
      }
    }
  }
);


botaoCancelarEdicaoConta.addEventListener(
  "click",
  () => {
    limparFormularioConta();
  }
);


listaGerenciamentoContas.addEventListener(
  "click",
  async (evento) => {
    const botaoEditar =
      evento.target.closest(
        ".botao-editar-conta"
      );

    const botaoStatus =
      evento.target.closest(
        ".botao-status-conta"
      );

    if (botaoEditar) {
      const id =
        Number(botaoEditar.dataset.id);

      try {
        const contas =
          await requisicaoApi(
            "/api/contas?incluirInativas=true"
          );

        const conta =
          contas.find(
            (item) =>
              Number(item.id) === id
          );

        if (conta) {
          preencherFormularioConta(
            conta
          );

          formConta.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      } catch (erro) {
        console.error(
          "Erro ao carregar conta:",
          erro
        );

        mostrarMensagemDashboard(
          erro.message,
          "erro"
        );
      }

      return;
    }

    if (!botaoStatus) {
      return;
    }

    const id =
      Number(botaoStatus.dataset.id);

    const atualmenteAtiva =
      botaoStatus.dataset.ativo === "true";

    const novoStatus =
      !atualmenteAtiva;

    const textoConfirmacao =
      novoStatus
        ? "Ativar esta conta?"
        : "Desativar esta conta?";

    if (
      !window.confirm(textoConfirmacao)
    ) {
      return;
    }

    botaoStatus.disabled = true;

    botaoStatus.textContent =
      novoStatus
        ? "Ativando..."
        : "Desativando...";

    try {
      await requisicaoApi(
        `/api/contas/${id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ativo: novoStatus
          })
        }
      );

      if (
        Number(contaEmEdicaoId) === id
      ) {
        limparFormularioConta();
      }

      await Promise.all([
        carregarContas(),
        carregarContasGerenciamento(),
        carregarResumo()
      ]);

      mostrarMensagemDashboard(
        novoStatus
          ? "Conta ativada com sucesso."
          : "Conta desativada com sucesso.",
        "sucesso"
      );
    } catch (erro) {
      console.error(
        "Erro ao alterar status da conta:",
        erro
      );

      mostrarMensagemDashboard(
        erro.message,
        "erro"
      );

      botaoStatus.disabled = false;

      botaoStatus.textContent =
        novoStatus
          ? "Ativar"
          : "Desativar";
    }
  }
);


// ================================================
// GERENCIAMENTO DE USUÁRIOS (NOVAS FUNÇÕES)
// ================================================

async function carregarUsuarios() {
  listaUsuarios.innerHTML = `
    <tr>
      <td colspan="4" class="tabela-vazia">Carregando usuários...</td>
    </tr>
  `;
  try {
    const usuarios = await requisicaoApi("/api/usuarios");

    listaUsuarios.innerHTML = ""; // Limpa o "Carregando usuários..."

    if (!usuarios.length) {
      listaUsuarios.innerHTML = `
        <tr>
          <td colspan="4" class="tabela-vazia">Nenhum usuário cadastrado.</td>
        </tr>
      `;
      return;
    }

    for (const usuario of usuarios) {
      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td><strong>${escaparHtml(usuario.nome)}</strong></td>
        <td>${escaparHtml(usuario.email)}</td>
        <td>${escaparHtml(usuario.perfil)}</td>
        <td class="acoes-tabela">
          <button type="button" class="botao-editar-usuario" data-id="${usuario.id}">Editar</button>
          <button type="button" class="botao-excluir-usuario" data-id="${usuario.id}">Excluir</button>
        </td>
      `;
      listaUsuarios.appendChild(linha);
    }
  } catch (erro) {
    console.error("Erro ao carregar usuários:", erro);
    listaUsuarios.innerHTML = `
      <tr>
        <td colspan="4" class="tabela-vazia">Erro ao carregar usuários: ${erro.message}</td>
      </tr>
    `;
    mostrarMensagemDashboard(erro.message, "erro");
  }
}

function limparFormularioUsuario() {
  usuarioEmEdicaoId = null;
  formUsuario.reset();
  senhaUsuarioForm.placeholder = "Deixe em branco para não alterar";
  botaoSalvarUsuario.textContent = "Cadastrar Usuário";
  botaoCancelarEdicaoUsuario.hidden = true;
  mensagemUsuario.textContent = "";
  mensagemUsuario.className = "mensagem-formulario";
}

function preencherFormularioUsuario(usuario) {
  usuarioEmEdicaoId = Number(usuario.id);
  nomeUsuarioForm.value = usuario.nome || "";
  emailUsuarioForm.value = usuario.email || "";
  senhaUsuarioForm.value = ""; // Nunca preenche a senha por segurança
  senhaUsuarioForm.placeholder = "Deixe em branco para não alterar"; // Mantém o placeholder
  perfilUsuarioForm.value = usuario.perfil || "usuario";
  botaoSalvarUsuario.textContent = "Salvar alterações";
  botaoCancelarEdicaoUsuario.hidden = false;
  mensagemUsuario.textContent = "Editando usuário selecionado.";
  mensagemUsuario.className = "mensagem-formulario";
}


// ================================================
// FORMULÁRIO DE LANÇAMENTO
// ================================================

formLancamento.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    limparMensagemLancamento();

    const dados = {
      tipo: tipoLancamento.value,

      descricao: document.querySelector(
        "#descricao-lancamento"
      ).value.trim(),

      valor: document.querySelector(
        "#valor-lancamento"
      ).value,

      dataMovimentacao:
        document.querySelector(
          "#data-lancamento"
        ).value,

      categoriaId:
        categoriaLancamento.value || null,

      contaId:
        contaLancamento.value,

      observacao:
        document.querySelector(
          "#observacao-lancamento"
        ).value.trim()
    };

    botaoSalvarLancamento.disabled =
      true;

    botaoSalvarLancamento.textContent =
      "Salvando...";

    try {
      await requisicaoApi(
        "/api/lancamentos",
        {
          method: "POST",
          body: JSON.stringify(dados)
        }
      );

      mostrarMensagemLancamento(
        "Lançamento salvo com sucesso.",
        "sucesso"
      );

      limparFormularioLancamento();

      await Promise.all([
        carregarResumo(),
        carregarContasGerenciamento(),
        carregarLancamentos()
      ]);
    } catch (erro) {
      console.error(
        "Erro ao salvar lançamento:",
        erro
      );

      mostrarMensagemLancamento(
        erro.message,
        "erro"
      );
    } finally {
      botaoSalvarLancamento.disabled =
        false;

      botaoSalvarLancamento.textContent =
        "Salvar lançamento";
    }
  }
);


tipoLancamento.addEventListener(
  "change",
  async () => {
    try {
      await carregarCategorias();
    } catch (erro) {
      mostrarMensagemLancamento(
        erro.message,
        "erro"
      );
    }
  }
);


function limparFormularioLancamento() {
  document.querySelector(
    "#descricao-lancamento"
  ).value = "";

  document.querySelector(
    "#valor-lancamento"
  ).value = "";

  document.querySelector(
    "#observacao-lancamento"
  ).value = "";

  definirDataAtual();
}


// ================================================
// FORMULÁRIO DE CONTAS A PAGAR
// ================================================

formContaPagar.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    limparMensagemContaPagar();

    const dados = {
      descricao:
        document.querySelector(
          "#descricao-conta-pagar"
        ).value.trim(),

      valor:
        document.querySelector(
          "#valor-conta-pagar"
        ).value,

      vencimento:
        document.querySelector(
          "#vencimento-conta-pagar"
        ).value,

      categoriaId:
        categoriaContaPagar.value || null,

      contaId:
        contaContaPagar.value || null,

      observacao:
        document.querySelector(
          "#observacao-conta-pagar"
        ).value.trim()
    };

    botaoSalvarContaPagar.disabled =
      true;

    botaoSalvarContaPagar.textContent =
      "Salvando...";

    try {
      await requisicaoApi(
        "/api/contas-pagar",
        {
          method: "POST",
          body: JSON.stringify(dados)
        }
      );

      mostrarMensagemContaPagar(
        "Conta cadastrada com sucesso.",
        "sucesso"
      );

      formContaPagar.reset();

      definirVencimentoAtual();

      await Promise.all([
        carregarResumo(),
        carregarContasPagar()
      ]);
    } catch (erro) {
      console.error(
        "Erro ao salvar conta a pagar:",
        erro
      );

      mostrarMensagemContaPagar(
        erro.message,
        "erro"
      );
    } finally {
      botaoSalvarContaPagar.disabled =
        false;

      botaoSalvarContaPagar.textContent =
        "Salvar conta";
    }
  }
);


// ================================================
// LISTAGEM DE CONTAS A PAGAR
// ================================================

async function carregarContasPagar() {
  const todasContas =
    await requisicaoApi(
      "/api/contas-pagar"
    );

  const contas =
    filtrarContasPagar(todasContas);

  listaContasPagar.innerHTML = "";

  if (!contas.length) {
    listaContasPagar.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="tabela-vazia"
        >
          Nenhuma conta cadastrada.
        </td>
      </tr>
    `;

    return;
  }

  for (const conta of contas) {
    const linha =
      document.createElement("tr");

    const classeStatus =
      conta.status === "pendente"
        ? "status-pendente"
        : conta.status === "paga"
          ? "status-paga"
          : "status-cancelada";

    const textoStatus =
      conta.status === "pendente"
        ? "Pendente"
        : conta.status === "paga"
          ? "Paga"
          : "Cancelada";

    let acoes = "";

    if (conta.status === "pendente") {
      acoes += `
        <button
          type="button"
          class="botao-pagar"
          data-id="${conta.id}"
          data-conta-id="${
            conta.conta_id || ""
          }"
        >
          Pagar
        </button>

        <button
          type="button"
          class="botao-cancelar"
          data-id="${conta.id}"
        >
          Cancelar
        </button>
      `;
    }

    if (conta.status !== "paga") {
      acoes += `
        <button
          type="button"
          class="botao-excluir"
          data-id="${conta.id}"
        >
          Excluir
        </button>
      `;
    }

     if (acoes === "") {
      acoes = "--------";
    }

    linha.innerHTML = `
      <td>
        ${formatarData(conta.vencimento)}
      </td>

      <td>
        <strong>
          ${escaparHtml(conta.descricao)}
        </strong>
      </td>

      <td>
        ${
          conta.observacao
            ? escaparHtml(
                conta.observacao
              )
            : "-"
        }
      </td>

      <td>
        ${escaparHtml(
          conta.categoria_nome ||
            "Sem categoria"
        )}
      </td>

      <td>
        ${escaparHtml(
          conta.conta_nome || "-"
        )}
      </td>

      <td>
        <span
          class="etiqueta-status ${classeStatus}"
        >
          ${textoStatus}
        </span>
      </td>

      <td class="valor-tabela">
        ${formatarMoeda(conta.valor)}
      </td>

      <td class="acoes-tabela">
        ${acoes}
      </td>
    `;

    listaContasPagar.appendChild(linha);
  }
}


// ================================================
// AÇÕES DE CONTAS A PAGAR
// ================================================

listaContasPagar.addEventListener(
  "click",
  async (evento) => {
    const botaoPagar =
      evento.target.closest(
        ".botao-pagar"
      );

    const botaoCancelar =
      evento.target.closest(
        ".botao-cancelar"
      );

    const botaoExcluir =
      evento.target.closest(
        ".botao-excluir"
      );

    try {
      if (botaoPagar) {
        const id =
          botaoPagar.dataset.id;

        const contaId =
          botaoPagar.dataset.contaId;

        if (!contaId) {
          throw new Error(
            "A conta de pagamento não foi definida."
          );
        }

        const confirmou =
          window.confirm(
            "Ao pagar, uma saída será criada automaticamente. Continuar?"
          );

        if (!confirmou) {
          return;
        }

        botaoPagar.disabled = true;
        botaoPagar.textContent =
          "Pagando...";

        await requisicaoApi(
          `/api/contas-pagar/${id}/pagar`,
          {
            method: "PATCH",
            body: JSON.stringify({
              contaId: Number(contaId)
            })
          }
        );

        await Promise.all([
          carregarResumo(),
          carregarLancamentos(),
          carregarContasPagar()
        ]);

        mostrarMensagemDashboard(
          "Conta paga e saída registrada.",
          "sucesso"
        );

        return;
      }

      if (botaoCancelar) {
        const id =
          botaoCancelar.dataset.id;

        if (
          !window.confirm(
            "Cancelar esta conta?"
          )
        ) {
          return;
        }

        botaoCancelar.disabled = true;
        botaoCancelar.textContent =
          "Cancelando...";

        await requisicaoApi(
          `/api/contas-pagar/${id}/cancelar`,
          {
            method: "PATCH"
          }
        );

        await Promise.all([
          carregarResumo(),
          carregarContasPagar()
        ]);

        mostrarMensagemDashboard(
          "Conta cancelada com sucesso.",
          "sucesso"
        );

        return;
      }

      if (botaoExcluir) {
        const id =
          botaoExcluir.dataset.id;

        if (
          !window.confirm(
            "Excluir esta conta?"
          )
        ) {
          return;
        }

        botaoExcluir.disabled = true;
        botaoExcluir.textContent =
          "Excluindo...";

        await requisicaoApi(
          `/api/contas-pagar/${id}`,
          {
            method: "DELETE"
          }
        );

        await Promise.all([
          carregarResumo(),
          carregarContasPagar()
        ]);

        mostrarMensagemDashboard(
          "Conta excluída com sucesso.",
          "sucesso"
        );
      }
    } catch (erro) {
      console.error(erro);

      mostrarMensagemDashboard(
        erro.message,
        "erro"
      );
    }
  }
);


// ================================================
// EVENT LISTENERS (NOVOS PARA USUÁRIOS)
// ================================================

formUsuario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const idEmEdicao = usuarioEmEdicaoId;
  const editando = Number.isInteger(idEmEdicao);

  const dados = {
    nome: nomeUsuarioForm.value.trim(),
    email: emailUsuarioForm.value.trim(),
    perfil: perfilUsuarioForm.value,
  };

  // Adiciona a senha apenas se ela for preenchida no formulário
  if (senhaUsuarioForm.value) {
    dados.senha = senhaUsuarioForm.value;
  }

  botaoSalvarUsuario.disabled = true;
  botaoSalvarUsuario.textContent = editando ? "Salvando..." : "Cadastrando...";
  mensagemUsuario.textContent = "";
  mensagemUsuario.className = "mensagem-formulario";

  try {
    const resposta = await requisicaoApi(
      editando ? `/api/usuarios/${idEmEdicao}` : "/api/usuarios",
      {
        method: editando ? "PATCH" : "POST",
        body: JSON.stringify(dados),
      }
    );

    limparFormularioUsuario();
    mostrarMensagemUsuario(
      resposta.mensagem || (editando ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso."),
      "sucesso"
    );
    await carregarUsuarios(); // Recarrega a lista de usuários
  } catch (erro) {
    console.error("Erro ao salvar usuário:", erro);
    mostrarMensagemUsuario(erro.message, "erro");
  } finally {
    botaoSalvarUsuario.disabled = false;
    botaoSalvarUsuario.textContent = editando ? "Salvar alterações" : "Cadastrar Usuário";
  }
});

botaoCancelarEdicaoUsuario.addEventListener("click", () => {
  limparFormularioUsuario();
});

listaUsuarios.addEventListener("click", async (evento) => {
  const botaoEditar = evento.target.closest(".botao-editar-usuario");
  const botaoExcluir = evento.target.closest(".botao-excluir-usuario");

  try {
    if (botaoEditar) {
      const id = Number(botaoEditar.dataset.id);
      const usuarios = await requisicaoApi("/api/usuarios"); // Busca todos para encontrar o específico
      const usuario = usuarios.find((item) => Number(item.id) === id);

      if (usuario) {
        preencherFormularioUsuario(usuario);
        formUsuario.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.id);

      if (!window.confirm("Tem certeza que deseja excluir este usuário?")) {
        return;
      }

      botaoExcluir.disabled = true;
      botaoExcluir.textContent = "Excluindo...";

      await requisicaoApi(`/api/usuarios/${id}`, {
        method: "DELETE",
      });

      mostrarMensagemDashboard("Usuário excluído com sucesso.", "sucesso");
      await carregarUsuarios(); // Recarrega a lista de usuários
    }
  } catch (erro) {
    console.error("Erro na ação de usuário:", erro);
    mostrarMensagemDashboard(erro.message, "erro");
    // Reabilita o botão se houver erro (se for o botão de excluir)
    if (botaoExcluir) {
      botaoExcluir.disabled = false;
      botaoExcluir.textContent = "Excluir";
    }
  }
});


// ================================================
// FILTROS DE CONTAS A PAGAR
// ================================================

function filtrarContasPagar(contas) {
  const statusSelecionado =
    filtroStatusContas.value;

  const textoBusca =
    filtroBuscaContas.value
      .trim()
      .toLowerCase();

  return contas.filter((conta) => {
    const correspondeStatus =
      !statusSelecionado ||
      conta.status === statusSelecionado;

    const correspondeBusca =
      !textoBusca ||
      String(conta.descricao || "")
        .toLowerCase()
        .includes(textoBusca);

    return (
      correspondeStatus &&
      correspondeBusca
    );
  });
}


filtroStatusContas.addEventListener(
  "change",
  () => {
    carregarContasPagar().catch((erro) => {
      console.error(
        "Erro ao filtrar por status:",
        erro
      );

      mostrarMensagemDashboard(
        erro.message,
        "erro"
      );
    });
  }
);


let temporizadorBuscaContas;

filtroBuscaContas.addEventListener(
  "input",
  () => {
    clearTimeout(
      temporizadorBuscaContas
    );

    temporizadorBuscaContas =
      setTimeout(() => {
        carregarContasPagar().catch(
          (erro) => {
            console.error(
              "Erro ao buscar contas:",
              erro
            );

            mostrarMensagemDashboard(
              erro.message,
              "erro"
            );
          }
        );
      }, 300);
  }
);


// ================================================
// SESSÃO
// ================================================

botaoSair.addEventListener(
  "click",
  () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");

    window.location.href = "/";
  }
);


// ================================================
// DATAS
// ================================================

function definirDataAtual() {
  const campoData =
    document.querySelector(
      "#data-lancamento"
    );

  if (!campoData) {
    return;
  }

  campoData.value =
    obterDataAtualISO();
}


function definirVencimentoAtual() {
  const campo =
    document.querySelector(
      "#vencimento-conta-pagar"
    );

  if (!campo) {
    return;
  }

  campo.value =
    obterDataAtualISO();
}


function obterDataAtualISO() {
  const hoje = new Date();

  const ano =
    hoje.getFullYear();

  const mes =
    String(
      hoje.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      hoje.getDate()
    ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}


function formatarData(data) {
  if (!data) {
    return "-";
  }

  const partes =
    String(data).split("-");

  if (partes.length !== 3) {
    return data;
  }

  return `
    ${partes[2]}/${partes[1]}/${partes[0]}
  `.trim();
}


// ================================================
// FORMATAÇÃO E MENSAGENS
// ================================================

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}


function escaparHtml(valor) {
  return String(valor)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function mostrarMensagemLancamento(
  texto,
  tipo
) {
  mensagemLancamento.textContent =
    texto;

  mensagemLancamento.className =
    `mensagem-formulario ${tipo}`;
}


function limparMensagemLancamento() {
  mensagemLancamento.textContent =
    "";

  mensagemLancamento.className =
    "mensagem-formulario";
}


function mostrarMensagemContaPagar(
  texto,
  tipo
) {
  mensagemContaPagar.textContent =
    texto;

  mensagemContaPagar.className =
    `mensagem-formulario ${tipo}`;
}


function limparMensagemContaPagar() {
  mensagemContaPagar.textContent =
    "";

  mensagemContaPagar.className =
    "mensagem-formulario";
}


function mostrarMensagemConta(
  texto,
  tipo
) {
  mensagemConta.textContent =
    texto;

  mensagemConta.className =
    `mensagem-formulario ${tipo}`;
}

// NOVA FUNÇÃO DE MENSAGEM PARA USUÁRIOS
function mostrarMensagemUsuario(texto, tipo) {
  mensagemUsuario.textContent = texto;
  mensagemUsuario.className = `mensagem-formulario ${tipo}`;
}


function mostrarMensagemDashboard(
  texto,
  tipo
) {
  mensagemDashboard.textContent =
    texto;

  mensagemDashboard.className =
    `mensagem-dashboard ${tipo}`;
}

formFiltrosRelatorio.addEventListener(
  "submit",
  (evento) => {
    evento.preventDefault();
  }
);


botaoGerarRelatorio.addEventListener(
  "click",
  async () => {
    botaoGerarRelatorio.disabled = true;
    botaoGerarRelatorio.textContent =
      "Gerando...";

    mensagemRelatorio.textContent = "";

    try {
      await gerarRelatorio();
    } catch (erro) {
      console.error(
        "Erro ao gerar relatório:",
        erro
      );

      mensagemRelatorio.textContent =
        erro.message;

      mensagemRelatorio.className =
        "mensagem-formulario erro";
    } finally {
      botaoGerarRelatorio.disabled = false;
      botaoGerarRelatorio.textContent =
        "Gerar relatório";
    }
  }
);


botaoImprimirRelatorio.addEventListener(
  "click",
  () => {
    window.print();
  }
);


botaoLimparFiltros.addEventListener(
  "click",
  () => {
    formFiltrosRelatorio.reset();

    listaRelatorio.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="tabela-vazia"
        >
          Use os filtros e clique em
          “Gerar relatório”.
        </td>
      </tr>
    `;

    document.querySelector(
      "#relatorio-total-entradas"
    ).textContent = "R$ 0,00";

    document.querySelector(
      "#relatorio-total-saidas"
    ).textContent = "R$ 0,00";

    document.querySelector(
      "#relatorio-saldo"
    ).textContent = "R$ 0,00";

    document.querySelector(
      "#relatorio-quantidade"
    ).textContent = "0";

    document.querySelector(
      "#relatorio-total-tabela"
    ).textContent = "R$ 0,00";

    document.querySelector(
      "#relatorio-periodo"
    ).textContent =
      "Todos os períodos";

    document.querySelector(
      "#relatorio-filtros-aplicados"
    ).textContent =
      "Nenhum filtro";

    botaoImprimirRelatorio.disabled =
      true;

    mensagemRelatorio.textContent = "";
    mensagemRelatorio.className =
      "mensagem-formulario";
  }
);

