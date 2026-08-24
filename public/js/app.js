const formularioLogin =
  document.querySelector("#form-login");

const mensagemLogin =
  document.querySelector("#mensagem-login");

const botaoEntrar =
  document.querySelector(".botao-entrar");

if (formularioLogin) {
  formularioLogin.addEventListener(
    "submit",
    async (evento) => {
      evento.preventDefault();

      const email = document
        .querySelector("#email")
        .value
        .trim();

      const senha = document
        .querySelector("#senha")
        .value;

      mensagemLogin.textContent = "";
      mensagemLogin.style.color = "";

      botaoEntrar.disabled = true;
      botaoEntrar.textContent = "Entrando...";

      try {
        const resposta = await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email,
              senha
            })
          }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem ||
              "Não foi possível realizar o login."
          );
        }

        sessionStorage.setItem(
          "token",
          dados.token
        );

        sessionStorage.setItem(
          "usuario",
          JSON.stringify(dados.usuario)
        );

        mensagemLogin.style.color = "#25885b";
        mensagemLogin.textContent =
          "Login realizado. Carregando painel...";

        window.setTimeout(() => {
          window.location.href =
            "/dashboard.html";
        }, 700);
      } catch (erro) {
        console.error("Erro no login:", erro);

        mensagemLogin.style.color = "#c34242";
        mensagemLogin.textContent =
          erro.message ||
          "Não foi possível realizar o login.";
      } finally {
        botaoEntrar.disabled = false;
        botaoEntrar.textContent =
          "Entrar no sistema";
      }
    }
  );
}
