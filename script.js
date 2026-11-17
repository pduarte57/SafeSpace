// Armazenamento local
const CHAVE_DADOS_LOCAL = 'safespace_dados_v1';

function carregarDadosSalvos() {
    try {
        const conteudo = window.localStorage.getItem(CHAVE_DADOS_LOCAL);
        if (!conteudo) return {};

        const dados = JSON.parse(conteudo);
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.warn('Não foi possível carregar os dados salvos do SafeSpace.', erro);
        return {};
    }
}

const dadosSalvos = carregarDadosSalvos();

function obterListaSalva(nome) {
    return Array.isArray(dadosSalvos[nome]) ? dadosSalvos[nome] : [];
}

function salvarDados() {
    const dados = {
        versao: 1,
        bancoDeUsuarios,
        bancoDeEmocoes,
        bancoDeDiario,
        bancoContatosSOS,
        bancoDeMetas,
        bancoDeProntuarios,
        bancoDeMensagens,
        bancoDeHorarios,
        bancoDeNotificacoes,
        proximoId
    };

    try {
        window.localStorage.setItem(CHAVE_DADOS_LOCAL, JSON.stringify(dados));
        return true;
    } catch (erro) {
        console.error('Não foi possível salvar os dados do SafeSpace no navegador.', erro);
        return false;
    }
}

let bancoDeUsuarios = obterListaSalva('bancoDeUsuarios');
let bancoDeEmocoes = obterListaSalva('bancoDeEmocoes');
let bancoDeDiario = obterListaSalva('bancoDeDiario');
let bancoContatosSOS = obterListaSalva('bancoContatosSOS');
let bancoDeMetas = obterListaSalva('bancoDeMetas');
let bancoDeProntuarios = obterListaSalva('bancoDeProntuarios');
let bancoDeMensagens = obterListaSalva('bancoDeMensagens');
let bancoDeHorarios = obterListaSalva('bancoDeHorarios');
let bancoDeNotificacoes = obterListaSalva('bancoDeNotificacoes');

const metasDemonstracao = [
    { texto: 'Praticar atividade física 3x na semana', concluida: false },
    { texto: 'Fazer higiene do sono antes de dormir', concluida: true }
];

let usuarioAtual = null;
let pacienteSelecionadoId = null;
let proximoId = Number.isSafeInteger(dadosSalvos.proximoId) ? Math.max(100, dadosSalvos.proximoId) : 100;
let usuarioAguardandoSelecao = null;
let contextoSelecaoPsicologo = null;
let psicologoPendenteId = null;
let agendaPacientePendente = null;
let agendaPsicologoPendente = null;
let temporizadorAvisoTrocaPsicologo = null;
const registrosRecentes = { emocao: null, diario: null, prontuario: null, mensagem: null };

// Elementos principais
const telaEntrada = document.getElementById('tela-entrada');
const telaAutenticacao = document.getElementById('tela-autenticacao');
const telaPaciente = document.getElementById('tela-paciente');
const telaPsicologo = document.getElementById('tela-psicologo');

// IDs de suporte
const inputChatPaciente = document.getElementById('chat-txt-paciente');
const inputChatPsicologo = document.getElementById('chat-txt-psicologo');
const descricaoEmocao = document.getElementById('descricao-emocao');
const telaSelecaoPsicologo = document.getElementById('tela-selecao-psicologo');
const listaPsicologosDisponiveis = document.getElementById('lista-psicologos-disponiveis');
const textoSelecaoPsicologo = document.getElementById('texto-selecao-psicologo');
const statusSelecaoPsicologo = document.getElementById('status-selecao-psicologo');
const btnConfirmarPsicologo = document.getElementById('btn-confirmar-psicologo');
const btnCancelarSelecaoPsicologo = document.getElementById('btn-cancelar-selecao-psicologo');

if (telaEntrada) {
    telaEntrada.classList.remove('escondido');
}

function gerarId(prefixo = 'id') {
    const id = `${prefixo}-${Date.now()}-${proximoId}`;
    proximoId += 1;
    return id;
}

function resetarTutoriais() {
    document.querySelectorAll('.ajuda-box').forEach(tutorial => {
        tutorial.open = false;
    });
}

// Limpa os campos temporários das contas
function limparCamposTemporarios(perfil = 'todos') {
    const paineis = perfil === 'todos'
        ? ['tela-paciente', 'tela-psicologo']
        : [perfil === 'paciente' ? 'tela-paciente' : 'tela-psicologo'];

    paineis.forEach(id => {
        const painel = document.getElementById(id);
        if (!painel) return;

        painel.querySelectorAll('input, textarea').forEach(campo => {
            if (campo.type === 'checkbox' || campo.type === 'radio') {
                campo.checked = false;
            } else {
                campo.value = '';
            }
        });
    });

    if (perfil === 'todos' || perfil === 'paciente') {
        const feedback = document.getElementById('feedback-sos');
        if (feedback) {
            if (feedback.dataset.timeoutId) clearTimeout(Number(feedback.dataset.timeoutId));
            feedback.classList.remove('visivel');
            feedback.textContent = '';
            delete feedback.dataset.timeoutId;
        }
        resetarExercicioCrise();
        atualizarContadorTextarea(descricaoEmocao, 'contador-emocao', 300);
        atualizarContadorTextarea(inputChatPaciente, 'chat-contador-paciente', 2000);
        ajustarAlturaChat(inputChatPaciente);
    }
    if (perfil === 'todos' || perfil === 'psicologo') {
        atualizarContadorTextarea(inputChatPsicologo, 'chat-contador-psicologo', 2000);
        ajustarAlturaChat(inputChatPsicologo);
    }
    limparErros();
}

// Limpa o aviso de troca de psicólogo
function cancelarAvisoTrocaPsicologo() {
    if (temporizadorAvisoTrocaPsicologo !== null) {
        clearTimeout(temporizadorAvisoTrocaPsicologo);
        temporizadorAvisoTrocaPsicologo = null;
    }
}

let entradaEmTransicao = false;
function entrarNoSite() {
    if (entradaEmTransicao) return;
    const abrirAutenticacao = () => {
        telaEntrada.classList.add('escondido');
        telaAutenticacao.classList.remove('escondido');
        entradaEmTransicao = false;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        abrirAutenticacao();
        return;
    }
    entradaEmTransicao = true;
    window.setTimeout(abrirAutenticacao, 150);
}

function alternarAbas(aba) {
    const formLogin = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro');
    const btnLogin = document.getElementById('btn-aba-login');
    const btnCadastro = document.getElementById('btn-aba-cadastro');

    limparErros();

    if (aba === 'login') {
        formLogin.classList.remove('escondido');
        formCadastro.classList.add('escondido');
        btnLogin.classList.add('aba-ativa');
        btnCadastro.classList.remove('aba-ativa');
    } else {
        formCadastro.classList.remove('escondido');
        formLogin.classList.add('escondido');
        btnCadastro.classList.add('aba-ativa');
        btnLogin.classList.remove('aba-ativa');
    }
}

// Efeito leve ao clicar nos botões
function animarCliqueBotao(evento) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const botao = evento.target.closest('button, a.btn-ligar');
    if (!botao || botao.disabled) return;
    botao.classList.remove('clique-animado');
    void botao.offsetWidth;
    botao.classList.add('clique-animado');
}
document.addEventListener('pointerdown', animarCliqueBotao);
document.addEventListener('keydown', evento => {
    if (evento.key === 'Enter' || evento.key === ' ') animarCliqueBotao(evento);
});

// Realce rápido após salvar
function animarSalvamento(perfil, modulo) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bloco = document.querySelector(`#tela-${perfil} [data-modulo="${modulo}"]`);
    if (!bloco) return;
    bloco.classList.remove('salvamento-animado');
    void bloco.offsetWidth;
    bloco.classList.add('salvamento-animado');
}

// Validação
function limparErros() {
    document.querySelectorAll('.erro-texto').forEach(el => {
        el.classList.add('escondido');
        el.textContent = '';
    });
}

function mostrarErro(id, mensagem) {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.classList.remove('escondido');
}

function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

function validarSenha(senha) {
    const temLetra = /[a-zA-Z]/.test(senha);
    const temNumero = /[0-9]/.test(senha);
    return temLetra && temNumero && senha.length >= 8;
}

// Formatação de telefones
function validarTelefone(fone) {
    const texto = String(fone).trim();
    const formatoPermitido = /^(?:\d{10,11}|\d{2}[\s-]?\d{4,5}-?\d{4}|\(\d{2}\)\s?\d{4,5}-?\d{4})$/;
    if (!formatoPermitido.test(texto)) return false;

    const numero = texto.replace(/\D/g, '');
    if (numero.length !== 10 && numero.length !== 11) return false;

    const ddds = new Set([
        '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
        '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
        '51','53','54','55','61','62','63','64','65','66','67','68','69',
        '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89',
        '91','92','93','94','95','96','97','98','99'
    ]);
    if (!ddds.has(numero.slice(0, 2))) return false;
    return numero.length === 10 || numero[2] === '9';
}

function formatarTelefone(fone) {
    if (!validarTelefone(fone)) return null;
    const numero = fone.replace(/\D/g, '');
    const final = numero.slice(-4);
    const inicio = numero.slice(2, -4);
    return `(${numero.slice(0, 2)}) ${inicio}-${final}`;
}

function configurarTelefoneSOS() {
    const campo = document.getElementById('sos-fone');
    if (!campo) return;
    campo.addEventListener('blur', () => {
        const formatado = formatarTelefone(campo.value);
        if (formatado) campo.value = formatado;
    });
    campo.addEventListener('input', () => {
        const erro = document.getElementById('erro-sos-fone');
        if (erro) erro.classList.add('escondido');
    });
}

configurarTelefoneSOS();

function formatarNomeUsuario(usuario) {
    if (!usuario) return 'Usuário';
    return usuario.nome?.trim() || usuario.email;
}

function formatarData(dataIso) {
    if (!dataIso) return '';
    const data = new Date(`${dataIso}T12:00:00`);
    return data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
    });
}

function formatarDataCurta(dataIso) {
    if (!dataIso) return '';
    return new Date(`${dataIso}T12:00:00`).toLocaleDateString('pt-BR');
}

function obterDataAtualISO() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function criarHorariosModelo(psicologoId) {
    const novosSlots = [];
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);

    let diasAdicionados = 0;
    let deslocamento = 1;
    const horarios = ['09:00', '15:00'];

    while (diasAdicionados < 7) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() + deslocamento);
        deslocamento += 1;

        const diaSemana = data.getDay();
        if (diaSemana === 0 || diaSemana === 6) continue;

        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const dataIso = `${ano}-${mes}-${dia}`;

        horarios.forEach((hora, indice) => {
            novosSlots.push({
                id: gerarId('horario'),
                data: dataIso,
                hora,
                status: diasAdicionados % 3 === 1 && indice === 1 ? 'Indisponível' : 'Livre',
                psicologoId,
                agendadoPor: null
            });
        });

        diasAdicionados += 1;
    }

    return novosSlots;
}

function garantirHorariosDoPsicologo(psicologo) {
    if (!psicologo || psicologo.perfil !== 'psicologo') return;

    const possuiHorarios = bancoDeHorarios.some(slot => slot.psicologoId === psicologo.email);
    if (possuiHorarios) return;

    bancoDeHorarios.push(...criarHorariosModelo(psicologo.email));
    salvarDados();
}

// Relação paciente <-> psicólogo
function obterPacientesDoPsicologo(psicologoId = usuarioAtual?.email) {
    if (!psicologoId) return [];

    return bancoDeUsuarios
        .filter(usuario => usuario.perfil === 'paciente' && usuario.psicologoId === psicologoId)
        .sort((a, b) => formatarNomeUsuario(a).localeCompare(formatarNomeUsuario(b), 'pt-BR'));
}

function escolherPsicologoParaPaciente() {
    const psicologos = bancoDeUsuarios.filter(usuario => usuario.perfil === 'psicologo');
    if (psicologos.length === 0) return null;

    return [...psicologos].sort((a, b) => {
        const qtdA = obterPacientesDoPsicologo(a.email).length;
        const qtdB = obterPacientesDoPsicologo(b.email).length;
        return qtdA - qtdB;
    })[0];
}

function estabelecerVinculo(usuario) {
    if (!usuario) return;

    if (usuario.perfil === 'psicologo') {
        garantirHorariosDoPsicologo(usuario);
    }
}

function obterPsicologosDisponiveis() {
    return bancoDeUsuarios
        .filter(usuario => usuario.perfil === 'psicologo' && usuario.aceitaNovosPacientes !== false)
        .sort((a, b) => formatarNomeUsuario(a).localeCompare(formatarNomeUsuario(b), 'pt-BR'));
}

function abrirSelecaoPsicologo(paciente, contexto = 'troca') {
    if (!paciente || paciente.perfil !== 'paciente' || !telaSelecaoPsicologo) return;

    usuarioAguardandoSelecao = paciente;
    contextoSelecaoPsicologo = contexto;
    psicologoPendenteId = paciente.psicologoId || null;

    const titulo = document.getElementById('titulo-selecao-psicologo');
    if (titulo) {
        titulo.textContent = contexto === 'cadastro' ? 'Escolha seu psicólogo' : 'Escolha um novo psicólogo';
    }

    if (textoSelecaoPsicologo) {
        textoSelecaoPsicologo.textContent = contexto === 'cadastro'
            ? 'Escolha um profissional disponível para acompanhar seu atendimento.'
            : 'Você pode trocar de psicólogo quando não tiver uma consulta agendada.';
    }

    if (btnCancelarSelecaoPsicologo) {
        btnCancelarSelecaoPsicologo.textContent = contexto === 'cadastro' ? 'Continuar sem escolher' : 'Cancelar';
    }

    renderizarSelecaoPsicologos();
    telaSelecaoPsicologo.classList.remove('escondido');
}

function renderizarSelecaoPsicologos() {
    if (!listaPsicologosDisponiveis) return;

    listaPsicologosDisponiveis.innerHTML = '';
    const psicologos = obterPsicologosDisponiveis();

    if (psicologos.length === 0) {
        const vazio = document.createElement('div');
        vazio.classList.add('selecao-vazia');
        vazio.textContent = 'Nenhum psicólogo está disponível para novos pacientes no momento.';
        listaPsicologosDisponiveis.appendChild(vazio);
        psicologoPendenteId = null;
        if (btnConfirmarPsicologo) btnConfirmarPsicologo.disabled = true;
        return;
    }

    psicologos.forEach(psicologo => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.classList.add('card-psicologo');
        if (psicologo.email === psicologoPendenteId) {
            botao.classList.add('selecionado');
        }

        const nome = document.createElement('strong');
        nome.textContent = formatarNomeUsuario(psicologo);

        const email = document.createElement('span');
        email.textContent = psicologo.email;

        const disponibilidade = document.createElement('small');
        disponibilidade.textContent = 'Disponível para novos pacientes';

        botao.appendChild(nome);
        botao.appendChild(email);
        botao.appendChild(disponibilidade);
        botao.addEventListener('click', () => selecionarPsicologoPendente(psicologo.email));
        listaPsicologosDisponiveis.appendChild(botao);
    });

    if (btnConfirmarPsicologo) {
        const selecaoValida = psicologos.some(psicologo => psicologo.email === psicologoPendenteId);
        btnConfirmarPsicologo.disabled = !selecaoValida;
    }
}

function selecionarPsicologoPendente(psicologoId) {
    if (!usuarioAguardandoSelecao) return;

    const psicologo = obterPsicologosDisponiveis().find(usuario => usuario.email === psicologoId);
    if (!psicologo) return;

    psicologoPendenteId = psicologo.email;
    renderizarSelecaoPsicologos();

    if (statusSelecaoPsicologo) {
        statusSelecaoPsicologo.classList.remove('escondido');
        statusSelecaoPsicologo.classList.remove('aviso');
        statusSelecaoPsicologo.textContent = `Selecionado: ${formatarNomeUsuario(psicologo)}. Clique em Confirmar para concluir.`;
    }
}

function confirmarSelecaoPsicologo() {
    if (!usuarioAguardandoSelecao || !psicologoPendenteId) return;

    const psicologo = bancoDeUsuarios.find(usuario =>
        usuario.email === psicologoPendenteId && usuario.perfil === 'psicologo' && usuario.aceitaNovosPacientes !== false
    );

    if (!psicologo) {
        if (statusSelecaoPsicologo) {
            statusSelecaoPsicologo.classList.remove('escondido');
            statusSelecaoPsicologo.classList.add('aviso');
            statusSelecaoPsicologo.textContent = 'Esse psicólogo não está mais disponível para novos pacientes.';
        }
        renderizarSelecaoPsicologos();
        return;
    }

    usuarioAguardandoSelecao.psicologoId = psicologo.email;
    garantirHorariosDoPsicologo(psicologo);
    salvarDados();

    const usuarioConfirmado = usuarioAguardandoSelecao;
    const contexto = contextoSelecaoPsicologo;

    fecharJanelaSelecaoPsicologo();

    if (contexto === 'cadastro') {
        iniciarSessao(usuarioConfirmado);
    } else if (usuarioAtual?.perfil === 'paciente') {
        carregarModulosPaciente();
    }

    usuarioAguardandoSelecao = null;
    contextoSelecaoPsicologo = null;
    psicologoPendenteId = null;
}

function fecharJanelaSelecaoPsicologo() {
    if (telaSelecaoPsicologo) telaSelecaoPsicologo.classList.add('escondido');
    if (statusSelecaoPsicologo) {
        statusSelecaoPsicologo.classList.add('escondido');
        statusSelecaoPsicologo.classList.remove('aviso');
        statusSelecaoPsicologo.textContent = '';
    }
}

function fecharSelecaoPsicologo() {
    const contexto = contextoSelecaoPsicologo;
    fecharJanelaSelecaoPsicologo();

    if (contexto === 'cadastro') {
        const usuarioNovo = usuarioAguardandoSelecao;
        usuarioAguardandoSelecao = null;
        contextoSelecaoPsicologo = null;
        psicologoPendenteId = null;
        iniciarSessao(usuarioNovo);
    } else {
        usuarioAguardandoSelecao = null;
        contextoSelecaoPsicologo = null;
        psicologoPendenteId = null;
    }
}

function obterPsicologoDoPaciente(paciente = usuarioAtual) {
    if (!paciente?.psicologoId) return null;
    return bancoDeUsuarios.find(usuario => usuario.email === paciente.psicologoId) || null;
}

function obterPacienteSelecionado() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'psicologo') return null;

    const pacientes = obterPacientesDoPsicologo();
    if (pacientes.length === 0) {
        pacienteSelecionadoId = null;
        return null;
    }

    let paciente = pacientes.find(item => item.email === pacienteSelecionadoId);
    if (!paciente) {
        paciente = pacientes[0];
        pacienteSelecionadoId = paciente.email;
    }

    return paciente;
}

function atualizarInformacaoVinculo() {
    cancelarAvisoTrocaPsicologo();
    const relacaoPaciente = document.getElementById('relacao-paciente');
    const relacaoPsicologo = document.getElementById('relacao-psicologo');

    if (usuarioAtual?.perfil === 'paciente' && relacaoPaciente) {
        relacaoPaciente.innerHTML = '';
        const psicologo = obterPsicologoDoPaciente();
        relacaoPaciente.classList.remove('aviso');

        const texto = document.createElement('span');
        if (psicologo) {
            texto.textContent = `Terapeuta vinculado: ${formatarNomeUsuario(psicologo)} (${psicologo.email}).`;
        } else {
            relacaoPaciente.classList.add('aviso');
            texto.textContent = 'Nenhum psicólogo está vinculado ainda.';
        }

        const mensagemPadrao = texto.textContent;
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.classList.add('btn-relacao');
        botao.textContent = psicologo ? 'Trocar psicólogo' : 'Escolher psicólogo';
        botao.addEventListener('click', () => {
            const consulta = obterConsultaAtivaDoPaciente();
            if (consulta) {
                cancelarAvisoTrocaPsicologo();
                const pacienteDaMensagem = usuarioAtual.email;
                relacaoPaciente.classList.add('aviso');
                texto.textContent = 'Cancele sua consulta atual antes de trocar de psicólogo.';
                temporizadorAvisoTrocaPsicologo = setTimeout(() => {
                    if (usuarioAtual?.email === pacienteDaMensagem && relacaoPaciente.contains(texto)) {
                        texto.textContent = mensagemPadrao;
                        relacaoPaciente.classList.toggle('aviso', !psicologo);
                    }
                    temporizadorAvisoTrocaPsicologo = null;
                }, 5000);
                return;
            }
            abrirSelecaoPsicologo(usuarioAtual, 'troca');
        });

        relacaoPaciente.appendChild(texto);
        relacaoPaciente.appendChild(botao);
    }

    if (usuarioAtual?.perfil === 'psicologo' && relacaoPsicologo) {
        relacaoPsicologo.innerHTML = '';
        const pacientes = obterPacientesDoPsicologo();
        const selecionado = obterPacienteSelecionado();
        relacaoPsicologo.classList.remove('aviso');

        const texto = document.createElement('span');
        if (pacientes.length === 0) {
            relacaoPsicologo.classList.add('aviso');
            texto.textContent = 'Nenhum paciente vinculado ainda.';
        } else {
            texto.textContent = `Paciente selecionado: ${formatarNomeUsuario(selecionado)} (${selecionado.email}). Os módulos abaixo mostram somente os dados desse paciente.`;
        }

        const disponibilidade = document.createElement('button');
        disponibilidade.type = 'button';
        disponibilidade.classList.add('btn-disponibilidade');
        disponibilidade.classList.toggle('indisponivel', usuarioAtual.aceitaNovosPacientes === false);
        disponibilidade.textContent = usuarioAtual.aceitaNovosPacientes === false
            ? 'Não aceitar novos pacientes'
            : 'Disponível para novos pacientes';
        disponibilidade.addEventListener('click', alternarDisponibilidadePsicologo);

        relacaoPsicologo.appendChild(texto);
        relacaoPsicologo.appendChild(disponibilidade);
    }
}

function alternarDisponibilidadePsicologo() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    usuarioAtual.aceitaNovosPacientes = usuarioAtual.aceitaNovosPacientes === false;
    salvarDados();
    atualizarInformacaoVinculo();
    renderizarSeletorPacientes();
} 

function renderizarSeletorPacientes() {
    const container = document.getElementById('seletor-pacientes-psicologo');
    if (!container || usuarioAtual?.perfil !== 'psicologo') return;

    container.innerHTML = '';
    const pacientes = obterPacientesDoPsicologo();

    if (pacientes.length === 0) {
        return;
    }

    const titulo = document.createElement('div');
    titulo.classList.add('seletor-titulo');
    titulo.textContent = `Meus pacientes (${pacientes.length})`;

    const lista = document.createElement('div');
    lista.classList.add('seletor-lista');

    pacientes.forEach(paciente => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.classList.add('btn-paciente-selecao');
        if (paciente.email === pacienteSelecionadoId) {
            botao.classList.add('ativo');
        }

        const nome = document.createElement('strong');
        nome.textContent = formatarNomeUsuario(paciente);

        const email = document.createElement('span');
        email.textContent = paciente.email;

        botao.appendChild(nome);
        botao.appendChild(email);
        botao.addEventListener('click', () => selecionarPaciente(paciente.email));
        lista.appendChild(botao);
    });

    container.appendChild(titulo);
    container.appendChild(lista);
}

function selecionarPaciente(email) {
    if (!usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    const paciente = obterPacientesDoPsicologo().find(item => item.email === email);
    if (!paciente || pacienteSelecionadoId === paciente.email) return;

    pacienteSelecionadoId = paciente.email;
    agendaPsicologoPendente = null;
    limparCamposTemporarios('psicologo');
    atualizarInformacaoVinculo();
    renderizarSeletorPacientes();
    renderizarModulosPsicologoSelecionado();
}

// Dados iniciais de cada paciente
function inicializarDadosPaciente(paciente) {
    if (!paciente || paciente.perfil !== 'paciente') return;

    const possuiMeta = bancoDeMetas.some(meta => meta.pacienteId === paciente.email);
    if (!possuiMeta) {
        metasDemonstracao.forEach(meta => {
            bancoDeMetas.push({
                id: gerarId('meta'),
                pacienteId: paciente.email,
                texto: meta.texto,
                concluida: meta.concluida
            });
        });
        salvarDados();
    }
}

// Autenticação
function cadastrarUsuario() {
    limparErros();

    const nome = document.getElementById('cad-nome').value.trim();
    const email = document.getElementById('cad-email').value.trim().toLowerCase();
    const senha = document.getElementById('cad-senha').value;
    const perfil = document.querySelector('input[name="cad-perfil"]:checked').value;
    let bloqueiaCadastro = false;

    if (!nome || nome.length < 2) {
        mostrarErro('erro-cad-nome', 'Digite um nome ou apelido com pelo menos 2 caracteres.');
        bloqueiaCadastro = true;
    }

    if (!validarEmail(email)) {
        mostrarErro('erro-cad-email', 'Digite um e-mail válido, como exemplo@email.com.');
        bloqueiaCadastro = true;
    }

    if (!validarSenha(senha)) {
        mostrarErro('erro-cad-senha', 'A senha deve ter no mínimo 8 caracteres, contendo pelo menos 1 letra e 1 número.');
        bloqueiaCadastro = true;
    }

    if (bancoDeUsuarios.some(usuario => usuario.email === email)) {
        mostrarErro('erro-cad-email', 'Este e-mail já está cadastrado no sistema.');
        bloqueiaCadastro = true;
    }

    if (bloqueiaCadastro) return;

    const novoUsuario = {
        nome,
        email,
        senha,
        perfil,
        psicologoId: null,
        aceitaNovosPacientes: perfil === 'psicologo'
    };

    bancoDeUsuarios.push(novoUsuario);
    estabelecerVinculo(novoUsuario);
    inicializarDadosPaciente(novoUsuario);
    salvarDados();

    document.getElementById('form-cadastro').reset();

    if (perfil === 'paciente') {
        abrirSelecaoPsicologo(novoUsuario, 'cadastro');
    } else {
        iniciarSessao(novoUsuario);
    }
}

document.getElementById('form-cadastro').addEventListener('submit', function(evento) {
    evento.preventDefault();
    cadastrarUsuario();
});

document.getElementById('form-login').addEventListener('submit', function(evento) {
    evento.preventDefault();
    limparErros();

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const senha = document.getElementById('login-senha').value;
    const perfil = document.querySelector('input[name="login-perfil"]:checked').value;

    if (!validarEmail(email)) {
        mostrarErro('erro-login-email', 'Digite um e-mail válido.');
        return;
    }

    const usuarioEncontrado = bancoDeUsuarios.find(usuario =>
        usuario.email === email && usuario.senha === senha && usuario.perfil === perfil
    );

    if (!usuarioEncontrado) {
        mostrarErro('erro-login-geral', 'E-mail, senha ou perfil incorretos.');
        return;
    }

    iniciarSessao(usuarioEncontrado);
});

function iniciarSessao(usuario) {
    if (!usuario) return;

    cancelarAvisoTrocaPsicologo();
    limparCamposTemporarios();
    usuarioAtual = usuario;
    estabelecerVinculo(usuarioAtual);
    inicializarDadosPaciente(usuarioAtual);
    pacienteSelecionadoId = null;
    agendaPacientePendente = null;
    agendaPsicologoPendente = null;
    paginaAtual = 'inicio';
    resetarTutoriais();
    fecharJanelaSelecaoPsicologo();

    telaEntrada.classList.add('escondido');
    telaAutenticacao.classList.add('escondido');
    telaPaciente.classList.add('escondido');
    telaPsicologo.classList.add('escondido');

    if (usuarioAtual.perfil === 'paciente') {
        telaPaciente.classList.remove('escondido');
        carregarModulosPaciente();
    } else {
        telaPsicologo.classList.remove('escondido');
        carregarModulosPsicologo();
    }

    aplicarModoNavegacao();
}

// Carrega os módulos
function carregarModulosPaciente() {
    resetarExercicioCrise();
    atualizarPerfilPaciente();
    atualizarInformacaoVinculo();
    const psicologo = obterPsicologoDoPaciente();
    garantirHorariosDoPsicologo(psicologo);
    renderizarContatosSOS();
    renderizarListaPaciente();
    renderizarDiarioPaciente();
    renderizarMetas();
    renderizarAgendaPaciente();
    renderizarChat('paciente');
    renderizarResumoPaciente();
    renderizarNotificacoesPaciente();
}

function carregarModulosPsicologo() {
    atualizarPerfilPsicologo();
    estabelecerVinculo(usuarioAtual);
    const paciente = obterPacienteSelecionado();
    garantirHorariosDoPsicologo(usuarioAtual);
    renderizarSeletorPacientes();
    atualizarInformacaoVinculo();
    renderizarModulosPsicologoSelecionado();
    renderizarAgendaPsicologo();
    renderizarResumoPsicologo();
    renderizarNotificacoesPsicologo();
}

function renderizarModulosPsicologoSelecionado() {
    renderizarListaPsicologo();
    renderizarDashboard();
    renderizarDiarioPsicologo();
    renderizarProntuarios();
    renderizarChat('psicologo');
    renderizarResumoPsicologo();
    renderizarNotificacoesPsicologo();
}

function atualizarPerfilPaciente() {
    const box = document.getElementById('perfil-resumo-paciente');
    if (!box || !usuarioAtual) return;
    box.textContent = `${formatarNomeUsuario(usuarioAtual)} • ${usuarioAtual.email}`;
}

function atualizarPerfilPsicologo() {
    const box = document.getElementById('perfil-resumo-psicologo');
    if (!box || !usuarioAtual) return;
    box.textContent = `${formatarNomeUsuario(usuarioAtual)} • ${usuarioAtual.email}`;
}

// SOS
function adicionarContatoSOS() {
    limparErros();

    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const nome = document.getElementById('sos-nome').value.trim();
    const fone = document.getElementById('sos-fone').value.trim();

    if (!nome) return;

    const telefoneFormatado = formatarTelefone(fone);
    if (!telefoneFormatado) {
        mostrarErro('erro-sos-fone', 'Digite um número válido!');
        return;
    }

    bancoContatosSOS.push({
        id: gerarId('sos'),
        pacienteId: usuarioAtual.email,
        nome,
        fone: telefoneFormatado
    });
    salvarDados();

    document.getElementById('sos-nome').value = '';
    document.getElementById('sos-fone').value = '';
    renderizarContatosSOS();
    renderizarResumoPaciente();
}

function excluirContatoSOS(idContato) {
    const indice = bancoContatosSOS.findIndex(contato =>
        contato.id === idContato && contato.pacienteId === usuarioAtual?.email
    );

    if (indice === -1) return;
    bancoContatosSOS.splice(indice, 1);
    salvarDados();
    renderizarContatosSOS();
    renderizarResumoPaciente();
}

function renderizarContatosSOS() {
    const lista = document.getElementById('lista-contatos-sos');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    lista.innerHTML = '';
    const contatos = bancoContatosSOS.filter(contato => contato.pacienteId === usuarioAtual.email);

    if (contatos.length === 0) {
        lista.innerHTML = '<p>Nenhum contato cadastrado.</p>';
        return;
    }

    contatos.forEach(contato => {
        const item = document.createElement('div');
        item.classList.add('contato-item');

        const info = document.createElement('div');
        info.classList.add('contato-info');

        const nome = document.createElement('strong');
        nome.textContent = contato.nome;

        const fone = document.createElement('span');
        fone.textContent = contato.fone;

        info.appendChild(nome);
        info.appendChild(fone);

        const acoes = document.createElement('div');
        acoes.classList.add('contato-acoes');

        const ligar = document.createElement('a');
        ligar.classList.add('btn-ligar');
        ligar.href = `tel:+55${contato.fone.replace(/\D/g, '')}`;
        ligar.textContent = 'Ligar';
        ligar.title = 'Abrir aplicativo de telefone, se disponível';
        ligar.addEventListener('click', () => iniciarLigacao(contato.fone));

        const copiar = document.createElement('button');
        copiar.type = 'button';
        copiar.classList.add('btn-copiar-contato');
        copiar.textContent = 'Copiar';
        copiar.addEventListener('click', () => copiarNumero(contato.fone, copiar));

        const excluir = document.createElement('button');
        excluir.type = 'button';
        excluir.classList.add('btn-excluir-contato');
        excluir.textContent = 'Excluir';
        excluir.addEventListener('click', () => excluirContatoSOS(contato.id));

        acoes.appendChild(ligar);
        acoes.appendChild(copiar);
        acoes.appendChild(excluir);
        item.appendChild(info);
        item.appendChild(acoes);
        lista.appendChild(item);
    });
}

function gerarExercicioCrise(tipo) {
    const box = document.getElementById('exibicao-exercicio');
    if (!box) return;

    box.classList.remove('escondido');

    if (tipo === 'respiracao') {
        box.innerHTML = '<strong>Respiração (4-4-4-4):</strong><br>1. Inspire por 4s.<br>2. Segure por 4s.<br>3. Expire por 4s.<br>4. Faça uma pausa por 4s.';
    } else {
        box.innerHTML = '<strong>Exercício dos 5 sentidos (5-4-3-2-1):</strong><br>Encontre: 5 coisas visíveis, 4 tocáveis, 3 audíveis, 2 com cheiro e 1 com sabor.';
    }
}

function resetarExercicioCrise() {
    const box = document.getElementById('exibicao-exercicio');
    if (!box) return;
    box.classList.add('escondido');
    box.innerHTML = '';
}

// Abre o telefone e copia o número como alternativa
function iniciarLigacao(numero) {
    void copiarNumero(numero, null, 'ligacao');
}

// Copiar números
async function copiarNumero(numero, botao = null, modo = 'copiar') {
    const numeroLimpo = String(numero).replace(/[^0-9]/g, '');
    if (!numeroLimpo) return false;

    let copiou = false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(numeroLimpo);
            copiou = true;
        }
    } catch (erro) {
        copiou = false;
    }

    if (!copiou) {
        const auxiliar = document.createElement('textarea');
        auxiliar.value = numeroLimpo;
        auxiliar.setAttribute('readonly', '');
        auxiliar.style.position = 'fixed';
        auxiliar.style.opacity = '0';
        document.body.appendChild(auxiliar);
        auxiliar.select();
        try {
            copiou = document.execCommand('copy');
        } catch (erro) {
            copiou = false;
        }
        auxiliar.remove();
    }

    const feedback = document.getElementById('feedback-sos');
    if (feedback) {
        if (modo === 'ligacao') {
            feedback.textContent = copiou
                ? `Tentando abrir o aplicativo de telefone. Se ele não abrir, o número ${numeroLimpo} já está copiado.`
                : `Tentando abrir o aplicativo de telefone. Se ele não abrir, use o botão Copiar ou copie o número ${numeroLimpo}.`;
        } else {
            feedback.textContent = copiou
                ? `Número ${numeroLimpo} copiado. Cole no telefone para ligar.`
                : `Não foi possível copiar automaticamente. Número: ${numeroLimpo}.`;
        }
        feedback.classList.add('visivel');
        clearTimeout(Number(feedback.dataset.timeoutId));
        feedback.dataset.timeoutId = setTimeout(() => {
            feedback.classList.remove('visivel');
            feedback.textContent = '';
            delete feedback.dataset.timeoutId;
        }, 5500);
    }

    if (copiou && botao) {
        const textoOriginal = botao.dataset.textoOriginal || botao.textContent;
        botao.dataset.textoOriginal = textoOriginal;
        botao.textContent = 'Copiado!';
        setTimeout(() => {
            if (botao) botao.textContent = textoOriginal;
        }, 1800);
    }

    return copiou;
}

// Emoções
function obterEmocoesDoPaciente(pacienteId) {
    return bancoDeEmocoes
        .filter(registro => registro.pacienteId === pacienteId)
        .sort((a, b) => b.timestamp - a.timestamp);
}

function registrarEmocao(nomeEmocao, nomeArquivoImg) {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const dataAtual = new Date();
    const descricao = descricaoEmocao?.value.trim() || '';
    const horario = dataAtual.toLocaleDateString('pt-BR') + ' às ' + dataAtual.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const idRegistro = gerarId('emocao');
    bancoDeEmocoes.push({
        id: idRegistro,
        pacienteId: usuarioAtual.email,
        nome: nomeEmocao,
        img: nomeArquivoImg,
        descricao,
        horario,
        timestamp: dataAtual.getTime()
    });
    salvarDados();
    registrosRecentes.emocao = idRegistro;

    if (descricaoEmocao) {
        descricaoEmocao.value = '';
        atualizarContadorTextarea(descricaoEmocao, 'contador-emocao', 300);
    }

    renderizarListaPaciente();
    registrosRecentes.emocao = null;
    animarSalvamento('paciente', 'emocoes');
    renderizarListaPsicologo();
    renderizarDashboard();
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
    renderizarNotificacoesPaciente();
    renderizarNotificacoesPsicologo();
}

function excluirRegistro(idRegistro) {
    const indice = bancoDeEmocoes.findIndex(registro =>
        registro.id === idRegistro && registro.pacienteId === usuarioAtual?.email
    );

    if (indice === -1) return;

    bancoDeEmocoes.splice(indice, 1);
    salvarDados();
    renderizarListaPaciente();
    renderizarListaPsicologo();
    renderizarDashboard();
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
}

function renderizarListaPaciente() {
    const lista = document.getElementById('lista-registros-paciente');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    lista.innerHTML = '';
    const registros = obterEmocoesDoPaciente(usuarioAtual.email);

    if (registros.length === 0) {
        lista.innerHTML = '<p>Nenhum registro no momento.</p>';
        return;
    }

    registros.forEach(registro => {
        const item = document.createElement('div');
        item.classList.add('registro-paciente-item');
        if (registro.id === registrosRecentes.emocao) item.classList.add('registro-animado');

        const info = document.createElement('div');
        const cabecalho = document.createElement('div');

        const img = document.createElement('img');
        img.src = registro.img;
        img.alt = registro.nome;
        img.classList.add('img-emocao-hist');

        const nome = document.createElement('strong');
        nome.textContent = registro.nome;

        const data = document.createElement('div');
        data.classList.add('registro-data-sub');
        data.textContent = registro.horario;

        cabecalho.appendChild(img);
        cabecalho.appendChild(nome);
        info.appendChild(cabecalho);

        if (registro.descricao) {
            const descricao = document.createElement('div');
            descricao.classList.add('registro-emocao-desc');
            descricao.textContent = registro.descricao;
            info.appendChild(descricao);
        }

        info.appendChild(data);

        const excluir = document.createElement('button');
        excluir.type = 'button';
        excluir.classList.add('btn-excluir-registro');
        excluir.textContent = 'Excluir';
        excluir.addEventListener('click', () => excluirRegistro(registro.id));

        item.appendChild(info);
        item.appendChild(excluir);
        lista.appendChild(item);
    });
}

function renderizarListaPsicologo() {
    const lista = document.getElementById('lista-emocoes');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    lista.innerHTML = '';
    const paciente = obterPacienteSelecionado();

    if (!paciente) {
        lista.innerHTML = '<p>Nenhum paciente selecionado.</p>';
        return;
    }

    const registros = obterEmocoesDoPaciente(paciente.email);

    if (registros.length === 0) {
        lista.innerHTML = '<p>Nenhum registro de emoção encontrado para este paciente.</p>';
        return;
    }

    registros.forEach(registro => {
        const item = document.createElement('p');

        const img = document.createElement('img');
        img.src = registro.img;
        img.alt = registro.nome;
        img.classList.add('img-emocao-hist');

        const strong = document.createElement('strong');
        strong.textContent = registro.nome;

        item.appendChild(img);
        item.appendChild(strong);

        if (registro.descricao) {
            const descricao = document.createTextNode(` - ${registro.descricao}`);
            item.appendChild(descricao);
        }

        const horario = document.createTextNode(` (${registro.horario})`);
        item.appendChild(horario);
        lista.appendChild(item);
    });
}

function renderizarDashboard() {
    const container = document.getElementById('dashboard-grafico');
    if (!container || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    container.innerHTML = '';
    const paciente = obterPacienteSelecionado();

    if (!paciente) {
        container.innerHTML = '<p>Nenhum paciente selecionado para gerar o gráfico.</p>';
        return;
    }

    const registros = obterEmocoesDoPaciente(paciente.email);
    if (registros.length === 0) {
        container.innerHTML = '<p>Nenhum registro de emoção para analisar.</p>';
        return;
    }

    const contagem = {};
    registros.forEach(registro => {
        contagem[registro.nome] = (contagem[registro.nome] || 0) + 1;
    });

    const total = registros.length;
    const emocaoOrdenada = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

    emocaoOrdenada.forEach(([nome, quantidade]) => {
        const pct = Math.round((quantidade / total) * 100);
        const linha = document.createElement('div');
        linha.classList.add('grafico-linha');

        const rotulo = document.createElement('div');
        rotulo.classList.add('grafico-rotulo');
        rotulo.textContent = nome;

        const barraFundo = document.createElement('div');
        barraFundo.classList.add('grafico-barra-fundo');

        const barraPreenchida = document.createElement('div');
        barraPreenchida.classList.add('grafico-barra-preenchida');
        barraPreenchida.style.width = `${pct}%`;

        const porcentagem = document.createElement('div');
        porcentagem.textContent = `${pct}%`;

        barraFundo.appendChild(barraPreenchida);
        linha.appendChild(rotulo);
        linha.appendChild(barraFundo);
        linha.appendChild(porcentagem);
        container.appendChild(linha);
    });
}

// Diário
function salvarDiario() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const texto = document.getElementById('diario-texto').value.trim();
    const compartilhado = document.getElementById('diario-compartilhar').checked;

    if (!texto) return;

    const agora = new Date();
    const idNota = gerarId('diario');
    bancoDeDiario.push({
        id: idNota,
        pacienteId: usuarioAtual.email,
        texto,
        compartilhado,
        data: agora.toLocaleDateString('pt-BR'),
        timestamp: agora.getTime()
    });
    salvarDados();

    document.getElementById('diario-texto').value = '';
    document.getElementById('diario-compartilhar').checked = false;
    registrosRecentes.diario = idNota;
    renderizarDiarioPaciente();
    registrosRecentes.diario = null;
    animarSalvamento('paciente', 'diario');
    renderizarDiarioPsicologo();
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
    renderizarNotificacoesPaciente();
    renderizarNotificacoesPsicologo();
}

function renderizarDiarioPaciente() {
    const lista = document.getElementById('lista-diario-paciente');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    lista.innerHTML = '';
    const busca = document.getElementById('busca-diario-paciente')?.value.trim().toLowerCase() || '';

    const notas = bancoDeDiario
        .filter(nota => nota.pacienteId === usuarioAtual.email)
        .filter(nota => !busca || `${nota.texto} ${nota.data}`.toLowerCase().includes(busca))
        .sort((a, b) => b.timestamp - a.timestamp);

    if (notas.length === 0) {
        lista.innerHTML = busca ? '<p>Nenhuma nota encontrada com essa busca.</p>' : '<p>Nenhuma nota registrada.</p>';
        return;
    }

    notas.forEach(nota => {
        const p = document.createElement('p');
        if (nota.id === registrosRecentes.diario) p.classList.add('registro-animado');
        const status = nota.compartilhado ? 'Compartilhado com terapeuta' : 'Privado';
        p.textContent = `[${status}] ${nota.data}: ${nota.texto}`;
        lista.appendChild(p);
    });
}

function renderizarDiarioPsicologo() {
    const lista = document.getElementById('lista-diario-psicologo');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    lista.innerHTML = '';
    const paciente = obterPacienteSelecionado();

    if (!paciente) {
        lista.innerHTML = '<p>Nenhum paciente selecionado.</p>';
        return;
    }

    const busca = document.getElementById('busca-notas-psicologo')?.value.trim().toLowerCase() || '';
    const notas = bancoDeDiario
        .filter(nota => nota.pacienteId === paciente.email && nota.compartilhado)
        .filter(nota => !busca || `${nota.texto} ${nota.data}`.toLowerCase().includes(busca))
        .sort((a, b) => b.timestamp - a.timestamp);

    if (notas.length === 0) {
        lista.innerHTML = busca ? '<p>Nenhuma nota encontrada com essa busca.</p>' : '<p>Nenhuma nota compartilhada.</p>';
        return;
    }

    notas.forEach(nota => {
        const p = document.createElement('p');
        p.textContent = `${nota.data}: ${nota.texto}`;
        lista.appendChild(p);
    });
}

// Metas
function adicionarMeta() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const campo = document.getElementById('nova-meta-texto');
    const texto = campo.value.trim();
    if (!texto) return;

    bancoDeMetas.push({
        id: gerarId('meta'),
        pacienteId: usuarioAtual.email,
        texto,
        concluida: false
    });
    salvarDados();

    campo.value = '';
    renderizarMetas();
    renderizarResumoPaciente();
}

function alternarStatusMeta(idMeta) {
    const meta = bancoDeMetas.find(item =>
        item.id === idMeta && item.pacienteId === usuarioAtual?.email
    );

    if (!meta) return;
    meta.concluida = !meta.concluida;
    salvarDados();
    renderizarMetas();
    renderizarResumoPaciente();
    renderizarNotificacoesPaciente();
}

function editarMeta(idMeta) {
    const meta = bancoDeMetas.find(item =>
        item.id === idMeta && item.pacienteId === usuarioAtual?.email
    );

    if (!meta) return;

    const novoTexto = prompt('Edite a meta:', meta.texto);
    if (novoTexto === null) return;

    const texto = novoTexto.trim();
    if (!texto) return;

    meta.texto = texto.slice(0, 120);
    salvarDados();
    renderizarMetas();
}

function excluirMeta(idMeta) {
    const indice = bancoDeMetas.findIndex(item =>
        item.id === idMeta && item.pacienteId === usuarioAtual?.email
    );

    if (indice === -1) return;
    bancoDeMetas.splice(indice, 1);
    salvarDados();
    renderizarMetas();
    renderizarResumoPaciente();
}

function renderizarMetas() {
    const lista = document.getElementById('lista-metas-paciente');
    const progressoBox = document.getElementById('progresso-metas-paciente');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    lista.innerHTML = '';
    const metas = bancoDeMetas.filter(meta => meta.pacienteId === usuarioAtual.email);

    if (metas.length === 0) {
        lista.innerHTML = '<p>Nenhuma meta cadastrada.</p>';
        if (progressoBox) progressoBox.innerHTML = '';
        return;
    }

    const concluidas = metas.filter(meta => meta.concluida).length;
    const pct = Math.round((concluidas / metas.length) * 100);

    if (progressoBox) {
        progressoBox.innerHTML = `
            <div class="progresso-topo">
                <span>Progresso das metas</span>
                <strong>${concluidas}/${metas.length} concluídas</strong>
            </div>
            <div class="progresso-fundo">
                <div class="progresso-preenchido" style="width: ${pct}%;"></div>
            </div>
        `;
    }

    metas.forEach(meta => {
        const div = document.createElement('div');
        div.classList.add('meta-item');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = meta.concluida;
        checkbox.addEventListener('change', () => alternarStatusMeta(meta.id));

        const span = document.createElement('span');
        span.textContent = meta.texto;
        if (meta.concluida) span.classList.add('meta-concluida');

        const acoes = document.createElement('div');
        acoes.classList.add('meta-acoes');

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.classList.add('btn-meta-acao');
        editar.textContent = 'Editar';
        editar.addEventListener('click', () => editarMeta(meta.id));

        const excluir = document.createElement('button');
        excluir.type = 'button';
        excluir.classList.add('btn-meta-acao', 'btn-excluir-registro');
        excluir.textContent = 'Excluir';
        excluir.addEventListener('click', () => excluirMeta(meta.id));

        acoes.appendChild(editar);
        acoes.appendChild(excluir);
        div.appendChild(checkbox);
        div.appendChild(span);
        div.appendChild(acoes);
        lista.appendChild(div);
    });
}

// Agenda
function obterIdDoPsicologoDaAgenda() {
    if (!usuarioAtual) return null;
    const psicologo = usuarioAtual.perfil === 'psicologo' ? usuarioAtual : obterPsicologoDoPaciente();
    return psicologo?.email || null;
}

function criarGrupoAgenda(container, dataIso) {
    const grupo = document.createElement('div');
    grupo.classList.add('agenda-dia');

    const titulo = document.createElement('div');
    titulo.classList.add('agenda-dia-titulo');
    titulo.textContent = formatarData(dataIso);

    const horarios = document.createElement('div');
    horarios.classList.add('agenda-horarios');

    grupo.appendChild(titulo);
    grupo.appendChild(horarios);
    container.appendChild(grupo);
    return horarios;
}

function agruparHorarios(slots) {
    const grupos = {};
    slots.forEach(slot => {
        if (!grupos[slot.data]) grupos[slot.data] = [];
        grupos[slot.data].push(slot);
    });
    return grupos;
}

function possuiConsultaAtiva(pacienteId, psicologoId) {
    return bancoDeHorarios.some(slot =>
        slot.psicologoId === psicologoId &&
        slot.status === 'Agendado' &&
        slot.agendadoPor === pacienteId
    );
}

function adicionarNotificacao(destinatarioId, mensagem, urgente = false) {
    if (!destinatarioId || !mensagem) return;

    bancoDeNotificacoes.push({
        id: gerarId('notificacao'),
        destinatarioId,
        mensagem,
        urgente,
        timestamp: Date.now()
    });
    salvarDados();
}

function obterNotificacoesDoUsuario(usuarioId) {
    if (!usuarioId) return [];
    return bancoDeNotificacoes
        .filter(notificacao => notificacao.destinatarioId === usuarioId)
        .sort((a, b) => b.timestamp - a.timestamp);
}

function limparAcaoAgendaPaciente() {
    agendaPacientePendente = null;
}

function solicitarAgendamentoConsulta(slotId) {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const psicologo = obterPsicologoDoPaciente();
    const slot = bancoDeHorarios.find(item =>
        item.id === slotId &&
        item.psicologoId === psicologo?.email
    );

    if (!slot || slot.status !== 'Livre') return;

    if (possuiConsultaAtiva(usuarioAtual.email, slot.psicologoId)) {
        const statusBox = document.getElementById('status-agenda-paciente');
        if (statusBox) {
            statusBox.classList.remove('escondido');
            statusBox.classList.add('aviso');
            statusBox.textContent = 'Você já possui uma consulta agendada com este terapeuta. Cancele a atual antes de escolher outro horário.';
        }
        return;
    }

    agendaPacientePendente = { tipo: 'agendar', slotId: slot.id };
    renderizarAgendaPaciente();
}

function solicitarCancelamentoConsultaPaciente(slotId) {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const slot = bancoDeHorarios.find(item =>
        item.id === slotId &&
        item.status === 'Agendado' &&
        item.agendadoPor === usuarioAtual.email
    );

    if (!slot) return;
    agendaPacientePendente = { tipo: 'cancelar', slotId: slot.id };
    renderizarAgendaPaciente();
}

function confirmarAcaoAgendaPaciente() {
    if (!agendaPacientePendente || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const acao = agendaPacientePendente;
    const slot = bancoDeHorarios.find(item => item.id === acao.slotId);
    const psicologo = obterPsicologoDoPaciente();

    if (!slot || !psicologo || slot.psicologoId !== psicologo.email) {
        limparAcaoAgendaPaciente();
        renderizarAgendaPaciente();
        return;
    }

    if (acao.tipo === 'agendar') {
        if (slot.status !== 'Livre' || possuiConsultaAtiva(usuarioAtual.email, psicologo.email)) {
            limparAcaoAgendaPaciente();
            renderizarAgendaPaciente();
            return;
        }

        slot.status = 'Agendado';
        slot.agendadoPor = usuarioAtual.email;
        slot.agendadoEm = Date.now();
        adicionarNotificacao(
            psicologo.email,
            `📅 ${formatarNomeUsuario(usuarioAtual)} marcou uma consulta para ${formatarDataCurta(slot.data)} às ${slot.hora}.`
        );
    } else if (acao.tipo === 'cancelar') {
        if (slot.status !== 'Agendado' || slot.agendadoPor !== usuarioAtual.email) {
            limparAcaoAgendaPaciente();
            renderizarAgendaPaciente();
            return;
        }

        const dataConsulta = formatarDataCurta(slot.data);
        const horaConsulta = slot.hora;
        slot.status = 'Livre';
        slot.agendadoPor = null;
        slot.agendadoEm = null;

        adicionarNotificacao(
            psicologo.email,
            `↩️ ${formatarNomeUsuario(usuarioAtual)} desmarcou a consulta de ${dataConsulta} às ${horaConsulta}.`
        );
    }

    limparAcaoAgendaPaciente();
    salvarDados();
    renderizarAgendaPaciente();
    renderizarAgendaPsicologo();
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
    renderizarNotificacoesPaciente();
    renderizarNotificacoesPsicologo();
}

function cancelarAcaoAgendaPaciente() {
    limparAcaoAgendaPaciente();
    renderizarAgendaPaciente();
}

function renderizarAgendaPaciente() {
    const grid = document.getElementById('calendario-paciente');
    const statusBox = document.getElementById('status-agenda-paciente');
    if (!grid || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    grid.innerHTML = '';
    const psicologo = obterPsicologoDoPaciente();

    if (!psicologo) {
        grid.innerHTML = '<div class="slot-hora slot-indisponivel">Nenhum terapeuta vinculado</div>';
        if (statusBox) {
            statusBox.innerHTML = '';
            statusBox.classList.add('escondido');
        }
        limparAcaoAgendaPaciente();
        return;
    }

    garantirHorariosDoPsicologo(psicologo);
    const slots = bancoDeHorarios
        .filter(slot => slot.psicologoId === psicologo.email)
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));

    if (slots.length === 0) {
        grid.innerHTML = '<div class="slot-hora slot-indisponivel">Nenhum horário configurado.</div>';
        if (statusBox) {
            statusBox.innerHTML = '';
            statusBox.classList.add('escondido');
        }
        limparAcaoAgendaPaciente();
        return;
    }

    const grupos = agruparHorarios(slots);

    Object.keys(grupos).sort().forEach(dataIso => {
        const horariosContainer = criarGrupoAgenda(grid, dataIso);

        grupos[dataIso].forEach(slot => {
            const div = document.createElement('div');
            div.classList.add('slot-hora');

            const selecionado = agendaPacientePendente?.slotId === slot.id;
            if (selecionado) div.classList.add('slot-selecionado');

            if (slot.status === 'Livre') {
                div.classList.add('slot-livre');
                div.textContent = `${slot.hora} • Livre`;
                div.title = selecionado ? 'Horário selecionado' : 'Clique para selecionar este horário';
                div.addEventListener('click', () => solicitarAgendamentoConsulta(slot.id));
            } else if (slot.status === 'Agendado') {
                div.classList.add('slot-ocupado');

                if (slot.agendadoPor === usuarioAtual.email) {
                    div.textContent = `${slot.hora} • Sua consulta`;
                    div.title = selecionado ? 'Consulta selecionada' : 'Clique para selecionar o cancelamento';
                    div.addEventListener('click', () => solicitarCancelamentoConsultaPaciente(slot.id));
                } else {
                    div.textContent = `${slot.hora} • Ocupado`;
                    div.title = 'Horário já ocupado';
                }
            } else {
                div.classList.add('slot-indisponivel');
                div.textContent = `${slot.hora} • Indisponível`;
                div.title = 'Horário indisponível';
            }

            horariosContainer.appendChild(div);
        });
    });

    if (!statusBox) return;

    statusBox.classList.remove('aviso');
    statusBox.innerHTML = '';

    // Mostra a confirmação quando o paciente seleciona uma ação
    if (agendaPacientePendente) {
        const slot = bancoDeHorarios.find(item =>
            item.id === agendaPacientePendente.slotId && item.psicologoId === psicologo.email
        );

        if (!slot) {
            limparAcaoAgendaPaciente();
            statusBox.classList.add('escondido');
            return;
        }

        statusBox.classList.remove('escondido');

        const texto = document.createElement('div');
        texto.textContent = agendaPacientePendente.tipo === 'agendar'
            ? `Você selecionou ${formatarDataCurta(slot.data)} às ${slot.hora}. Confirme o agendamento.`
            : `Você selecionou a consulta de ${formatarDataCurta(slot.data)} às ${slot.hora}. Confirme o cancelamento.`;

        const acoes = document.createElement('div');
        acoes.classList.add('confirmacao-acoes');

        const confirmar = document.createElement('button');
        confirmar.type = 'button';
        confirmar.classList.add('btn-confirmar');
        confirmar.textContent = agendaPacientePendente.tipo === 'agendar' ? 'Confirmar agendamento' : 'Confirmar cancelamento';
        confirmar.addEventListener('click', confirmarAcaoAgendaPaciente);

        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.classList.add('btn-cancelar-acao');
        cancelar.textContent = 'Cancelar';
        cancelar.addEventListener('click', cancelarAcaoAgendaPaciente);

        acoes.appendChild(confirmar);
        acoes.appendChild(cancelar);
        statusBox.appendChild(texto);
        statusBox.appendChild(acoes);
        return;
    }

    const consulta = obterConsultaAtivaDoPaciente();
    if (consulta) {
        statusBox.classList.remove('escondido');
        const texto = document.createElement('div');
        texto.textContent = `Consulta agendada para ${formatarDataCurta(consulta.data)} às ${consulta.hora}. Se precisar cancelar, selecione o horário e confirme.`;
        statusBox.appendChild(texto);
    } else {
        statusBox.classList.add('escondido');
    }
}

function limparAcaoAgendaPsicologo() {
    agendaPsicologoPendente = null;
}

function solicitarAcaoHorarioPsicologo(slotId) {
    if (!usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    const slot = bancoDeHorarios.find(item =>
        item.id === slotId && item.psicologoId === usuarioAtual.email
    );

    if (!slot) return;

    if (slot.status === 'Livre') {
        agendaPsicologoPendente = { tipo: 'bloquear', slotId: slot.id };
    } else if (slot.status === 'Indisponível') {
        agendaPsicologoPendente = { tipo: 'liberar', slotId: slot.id };
    } else if (slot.status === 'Agendado') {
        agendaPsicologoPendente = { tipo: 'cancelar', slotId: slot.id };
    }

    renderizarAgendaPsicologo();
}

function confirmarAcaoAgendaPsicologo() {
    if (!agendaPsicologoPendente || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    const acao = agendaPsicologoPendente;
    const slot = bancoDeHorarios.find(item =>
        item.id === acao.slotId && item.psicologoId === usuarioAtual.email
    );

    if (!slot) {
        limparAcaoAgendaPsicologo();
        renderizarAgendaPsicologo();
        return;
    }

    if (acao.tipo === 'bloquear') {
        if (slot.status === 'Livre') slot.status = 'Indisponível';
    } else if (acao.tipo === 'liberar') {
        if (slot.status === 'Indisponível') slot.status = 'Livre';
    } else if (acao.tipo === 'cancelar') {
        if (slot.status === 'Agendado') {
            const paciente = bancoDeUsuarios.find(usuario =>
                usuario.email === slot.agendadoPor &&
                usuario.perfil === 'paciente' &&
                usuario.psicologoId === usuarioAtual.email
            );

            if (paciente) {
                adicionarNotificacao(
                    paciente.email,
                    `⚠️ Sua consulta de ${formatarDataCurta(slot.data)} às ${slot.hora} foi cancelada pelo psicólogo ${formatarNomeUsuario(usuarioAtual)}. Escolha outro horário disponível.`,
                    true
                );
            }

            slot.status = 'Livre';
            slot.agendadoPor = null;
            slot.agendadoEm = null;
        }
    }

    limparAcaoAgendaPsicologo();
    salvarDados();
    renderizarAgendaPsicologo();
    renderizarAgendaPaciente();
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
    renderizarNotificacoesPaciente();
    renderizarNotificacoesPsicologo();
}

function cancelarAcaoAgendaPsicologo() {
    limparAcaoAgendaPsicologo();
    renderizarAgendaPsicologo();
}

function renderizarAgendaPsicologo() {
    const grid = document.getElementById('calendario-psicologo');
    const statusBox = document.getElementById('status-agenda-psicologo');
    if (!grid || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    grid.innerHTML = '';
    garantirHorariosDoPsicologo(usuarioAtual);

    const slots = bancoDeHorarios
        .filter(slot => slot.psicologoId === usuarioAtual.email)
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));

    const grupos = agruparHorarios(slots);

    Object.keys(grupos).sort().forEach(dataIso => {
        const horariosContainer = criarGrupoAgenda(grid, dataIso);

        grupos[dataIso].forEach(slot => {
            const div = document.createElement('div');
            div.classList.add('slot-hora');

            const selecionado = agendaPsicologoPendente?.slotId === slot.id;
            if (selecionado) div.classList.add('slot-selecionado');

            if (slot.status === 'Livre') {
                div.classList.add('slot-livre');
                div.textContent = `${slot.hora} • Livre`;
                div.title = 'Clique para selecionar o bloqueio';
                div.addEventListener('click', () => solicitarAcaoHorarioPsicologo(slot.id));
            } else if (slot.status === 'Agendado') {
                div.classList.add('slot-ocupado');
                const paciente = bancoDeUsuarios.find(usuario =>
                    usuario.email === slot.agendadoPor &&
                    usuario.perfil === 'paciente' &&
                    usuario.psicologoId === usuarioAtual.email
                );
                div.textContent = `${slot.hora} • Agendado`;
                if (paciente) div.textContent += `: ${formatarNomeUsuario(paciente)}`;
                div.title = 'Clique para selecionar o cancelamento da consulta';
                div.addEventListener('click', () => solicitarAcaoHorarioPsicologo(slot.id));
            } else {
                div.classList.add('slot-indisponivel');
                div.textContent = `${slot.hora} • Indisponível`;
                div.title = 'Clique para selecionar a liberação';
                div.addEventListener('click', () => solicitarAcaoHorarioPsicologo(slot.id));
            }

            horariosContainer.appendChild(div);
        });
    });

    if (statusBox) {
        statusBox.classList.remove('aviso');
        statusBox.innerHTML = '';

        if (agendaPsicologoPendente) {
            const slot = bancoDeHorarios.find(item => item.id === agendaPsicologoPendente.slotId);
            if (slot) {
                const paciente = slot.agendadoPor
                    ? bancoDeUsuarios.find(usuario => usuario.email === slot.agendadoPor)
                    : null;

                const texto = document.createElement('div');
                if (agendaPsicologoPendente.tipo === 'bloquear') {
                    texto.textContent = `Você selecionou ${formatarDataCurta(slot.data)} às ${slot.hora}. Confirme o bloqueio do horário.`;
                } else if (agendaPsicologoPendente.tipo === 'liberar') {
                    texto.textContent = `Você selecionou ${formatarDataCurta(slot.data)} às ${slot.hora}. Confirme a liberação do horário.`;
                } else {
                    texto.textContent = `Você selecionou ${formatarDataCurta(slot.data)} às ${slot.hora}${paciente ? ` para ${formatarNomeUsuario(paciente)}` : ''}. Confirme o cancelamento da consulta.`;
                }

                const acoes = document.createElement('div');
                acoes.classList.add('confirmacao-acoes');

                const confirmar = document.createElement('button');
                confirmar.type = 'button';
                confirmar.classList.add('btn-confirmar');
                confirmar.textContent = agendaPsicologoPendente.tipo === 'cancelar'
                    ? 'Confirmar cancelamento'
                    : agendaPsicologoPendente.tipo === 'bloquear'
                        ? 'Confirmar bloqueio'
                        : 'Confirmar liberação';
                confirmar.addEventListener('click', confirmarAcaoAgendaPsicologo);

                const cancelar = document.createElement('button');
                cancelar.type = 'button';
                cancelar.classList.add('btn-cancelar-acao');
                cancelar.textContent = 'Cancelar';
                cancelar.addEventListener('click', cancelarAcaoAgendaPsicologo);

                if (agendaPsicologoPendente.tipo === 'cancelar') statusBox.classList.add('aviso');

                acoes.appendChild(confirmar);
                acoes.appendChild(cancelar);
                statusBox.appendChild(texto);
                statusBox.appendChild(acoes);
            }
        } else {
            const agendasOcupadas = slots.filter(slot => slot.status === 'Agendado').length;
            statusBox.textContent = `Horários ocupados atualmente: ${agendasOcupadas}. Selecione um horário e confirme antes de alterar sua agenda.`;
        }
    }
}

// Prontuário
function salvarProntuario() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    const txt = document.getElementById('prontuario-texto').value.trim();
    const paciente = obterPacienteSelecionado();
    const erro = document.getElementById('erro-prontuario');

    if (erro) {
        erro.classList.add('escondido');
        erro.textContent = '';
    }

    if (!txt) return;

    if (!paciente) {
        mostrarErro('erro-prontuario', 'Selecione um paciente antes de salvar uma evolução.');
        return;
    }

    const agora = new Date();
    const idProntuario = gerarId('prontuario');
    bancoDeProntuarios.push({
        id: idProntuario,
        psicologoId: usuarioAtual.email,
        pacienteId: paciente.email,
        texto: txt,
        data: agora.toLocaleDateString('pt-BR'),
        timestamp: agora.getTime()
    });
    salvarDados();

    document.getElementById('prontuario-texto').value = '';
    registrosRecentes.prontuario = idProntuario;
    renderizarProntuarios();
    registrosRecentes.prontuario = null;
    animarSalvamento('psicologo', 'prontuario');
    renderizarResumoPsicologo();
    renderizarNotificacoesPsicologo();
}

function renderizarProntuarios() {
    const lista = document.getElementById('lista-prontuarios');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    lista.innerHTML = '';
    const paciente = obterPacienteSelecionado();

    if (!paciente) {
        lista.innerHTML = '<p>Nenhum paciente selecionado.</p>';
        return;
    }

    const prontuarios = bancoDeProntuarios
        .filter(item => item.psicologoId === usuarioAtual.email && item.pacienteId === paciente.email)
        .sort((a, b) => b.timestamp - a.timestamp);

    if (prontuarios.length === 0) {
        lista.innerHTML = '<p>Nenhuma evolução registrada.</p>';
        return;
    }

    prontuarios.forEach(prontuario => {
        const div = document.createElement('p');
        if (prontuario.id === registrosRecentes.prontuario) div.classList.add('registro-animado');
        div.textContent = `[${prontuario.data}]: ${prontuario.texto}`;
        lista.appendChild(div);
    });
}

// Chat
function obterMensagensDaConversa() {
    if (!usuarioAtual) return [];

    const paciente = usuarioAtual.perfil === 'paciente' ? usuarioAtual : obterPacienteSelecionado();
    const psicologo = usuarioAtual.perfil === 'psicologo' ? usuarioAtual : obterPsicologoDoPaciente();

    if (!paciente || !psicologo) return [];

    return bancoDeMensagens
        .filter(msg => msg.pacienteId === paciente.email && msg.psicologoId === psicologo.email)
        .sort((a, b) => a.timestamp - b.timestamp);
}

function ajustarAlturaChat(input) {
    if (!input) return;

    input.style.height = 'auto';
    const altura = Math.min(input.scrollHeight, 140);
    input.style.height = `${altura}px`;
    input.style.overflowY = input.scrollHeight > 140 ? 'auto' : 'hidden';
}

function atualizarContadorTextarea(input, contadorId, limite) {
    const contador = document.getElementById(contadorId);
    if (!contador || !input) return;
    contador.textContent = `${input.value.length}/${limite}`;
}

function enviarMensagem(autor) {
    if (!usuarioAtual || usuarioAtual.perfil !== autor) return;

    const input = autor === 'paciente' ? inputChatPaciente : inputChatPsicologo;
    if (!input) return;

    const parceiro = autor === 'paciente' ? obterPsicologoDoPaciente() : obterPacienteSelecionado();
    if (!parceiro) return;

    const texto = input.value.replace(/\r\n/g, '\n').trim();
    if (!texto) return;

    const agora = new Date();
    const pacienteId = autor === 'paciente' ? usuarioAtual.email : parceiro.email;
    const psicologoId = autor === 'psicologo' ? usuarioAtual.email : parceiro.email;

    const idMensagem = gerarId('mensagem');
    bancoDeMensagens.push({
        id: idMensagem,
        pacienteId,
        psicologoId,
        autorId: usuarioAtual.email,
        autorPerfil: autor,
        texto: texto.slice(0, 2000),
        horario: agora.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        timestamp: agora.getTime()
    });
    salvarDados();

    input.value = '';
    ajustarAlturaChat(input);
    atualizarContadorTextarea(input, autor === 'paciente' ? 'chat-contador-paciente' : 'chat-contador-psicologo', 2000);
    registrosRecentes.mensagem = idMensagem;
    renderizarChat('paciente');
    renderizarChat('psicologo');
    registrosRecentes.mensagem = null;
    renderizarResumoPaciente();
    renderizarResumoPsicologo();
    renderizarNotificacoesPaciente();
    renderizarNotificacoesPsicologo();
}

function renderizarChat(perfilAtual) {
    const janelaId = perfilAtual === 'paciente' ? 'chat-janela-paciente' : 'chat-janela-psicologo';
    const statusId = perfilAtual === 'paciente' ? 'chat-status-paciente' : 'chat-status-psicologo';
    const janela = document.getElementById(janelaId);
    const status = document.getElementById(statusId);
    if (!janela) return;

    janela.innerHTML = '';

    if (!usuarioAtual) return;

    const paciente = perfilAtual === 'paciente' ? usuarioAtual : obterPacienteSelecionado();
    const psicologo = perfilAtual === 'psicologo' ? usuarioAtual : obterPsicologoDoPaciente();

    if (status) {
        status.textContent = paciente && psicologo
            ? `Conversa: ${formatarNomeUsuario(paciente)} ↔ ${formatarNomeUsuario(psicologo)}`
            : 'Conversa indisponível no momento.';
    }

    if (!paciente || !psicologo) {
        const vazio = document.createElement('p');
        vazio.classList.add('chat-vazio');
        vazio.textContent = perfilAtual === 'psicologo'
            ? 'Selecione um paciente para iniciar a conversa.'
            : 'Nenhum terapeuta vinculado para iniciar a conversa.';
        janela.appendChild(vazio);
        return;
    }

    const mensagens = obterMensagensDaConversa();

    if (mensagens.length === 0) {
        const vazio = document.createElement('p');
        vazio.classList.add('chat-vazio');
        vazio.textContent = 'Nenhuma mensagem ainda. Comece a conversa!';
        janela.appendChild(vazio);
        return;
    }

    mensagens.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add(
            'msg-linha',
            msg.autorPerfil === 'paciente' ? 'msg-paciente' : 'msg-psicologo',
            msg.autorId === usuarioAtual.email ? 'msg-enviada' : 'msg-recebida'
        );
        if (msg.id === registrosRecentes.mensagem && perfilAtual === usuarioAtual.perfil) {
            div.classList.add('mensagem-animada');
        }

        const texto = document.createElement('div');
        texto.classList.add('msg-texto');
        texto.textContent = msg.texto;

        const horario = document.createElement('span');
        horario.classList.add('msg-horario');
        horario.textContent = msg.horario;

        div.appendChild(texto);
        div.appendChild(horario);
        janela.appendChild(div);
    });

    janela.scrollTop = janela.scrollHeight;
}

function configurarEventosChat() {
    const entradas = [
        { input: inputChatPaciente, autor: 'paciente', contador: 'chat-contador-paciente' },
        { input: inputChatPsicologo, autor: 'psicologo', contador: 'chat-contador-psicologo' }
    ];

    entradas.forEach(({ input, autor, contador }) => {
        if (!input) return;

        input.addEventListener('keydown', evento => {
            if (evento.key !== 'Enter' || evento.shiftKey) return;
            evento.preventDefault();
            enviarMensagem(autor);
        });

        input.addEventListener('input', () => {
            ajustarAlturaChat(input);
            atualizarContadorTextarea(input, contador, 2000);
        });

        ajustarAlturaChat(input);
        atualizarContadorTextarea(input, contador, 2000);
    });
}

configurarEventosChat();

// Resumo do paciente
function obterConsultaAtivaDoPaciente() {
    if (!usuarioAtual || usuarioAtual.perfil !== 'paciente') return null;
    const psicologo = obterPsicologoDoPaciente();
    if (!psicologo) return null;

    return bancoDeHorarios
        .filter(slot =>
            slot.psicologoId === psicologo.email &&
            slot.status === 'Agendado' &&
            slot.agendadoPor === usuarioAtual.email
        )
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))[0] || null;
}

function renderizarResumoPaciente() {
    const container = document.getElementById('resumo-paciente');
    if (!container || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    const emocoesHoje = bancoDeEmocoes.filter(registro => {
        if (registro.pacienteId !== usuarioAtual.email) return false;
        const data = new Date(registro.timestamp);
        const hoje = new Date();
        return data.toDateString() === hoje.toDateString();
    });

    const metas = bancoDeMetas.filter(meta => meta.pacienteId === usuarioAtual.email);
    const concluidas = metas.filter(meta => meta.concluida).length;
    const consulta = obterConsultaAtivaDoPaciente();
    const notas = bancoDeDiario.filter(nota => nota.pacienteId === usuarioAtual.email).length;

    container.innerHTML = '';
    const itens = [
        { rotulo: 'Emoções hoje', valor: emocoesHoje.length, detalhe: emocoesHoje.length ? emocoesHoje[0].nome : 'Nenhum registro ainda' },
        { rotulo: 'Metas', valor: `${concluidas}/${metas.length}`, detalhe: 'concluídas' },
        { rotulo: 'Próxima consulta', valor: consulta ? consulta.hora : 'Nenhuma', detalhe: consulta ? formatarDataCurta(consulta.data) : 'Agende quando quiser' },
        { rotulo: 'Notas no diário', valor: notas, detalhe: 'registradas' }
    ];

    itens.forEach(item => {
        const box = document.createElement('div');
        box.classList.add('resumo-item');

        const rotulo = document.createElement('div');
        rotulo.classList.add('resumo-rotulo');
        rotulo.textContent = item.rotulo;

        const valor = document.createElement('div');
        valor.classList.add('resumo-valor');
        valor.textContent = item.valor;

        const detalhe = document.createElement('div');
        detalhe.classList.add('resumo-detalhe');
        detalhe.textContent = item.detalhe;

        box.appendChild(rotulo);
        box.appendChild(valor);
        box.appendChild(detalhe);
        container.appendChild(box);
    });
}

function renderizarNotificacoesPaciente() {
    const lista = document.getElementById('notificacoes-paciente');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'paciente') return;

    lista.innerHTML = '';
    const notificacoes = obterNotificacoesDoUsuario(usuarioAtual.email);
    const urgentes = notificacoes.filter(item => item.urgente);
    const comuns = notificacoes.filter(item => !item.urgente);

    const consulta = obterConsultaAtivaDoPaciente();
    const psicologo = obterPsicologoDoPaciente();
    const mensagens = obterMensagensDaConversa();
    const lembretes = [];

    if (!psicologo) {
        lembretes.push('Nenhum psicólogo está vinculado. Escolha um profissional para usar agenda e chat.');
    } else if (consulta) {
        lembretes.push(`Sua próxima consulta está marcada para ${formatarDataCurta(consulta.data)} às ${consulta.hora}.`);
    } else {
        lembretes.push('Você ainda não possui uma consulta agendada.');
    }

    if (mensagens.length > 0) {
        const ultima = mensagens[mensagens.length - 1];
        lembretes.push(`${ultima.autorId === usuarioAtual.email ? 'Sua última mensagem' : 'Última mensagem recebida'}: ${ultima.texto.slice(0, 120)}${ultima.texto.length > 120 ? '...' : ''}`);
    }

    const hoje = new Date();
    const temEmocaoHoje = bancoDeEmocoes.some(registro => {
        if (registro.pacienteId !== usuarioAtual.email) return false;
        return new Date(registro.timestamp).toDateString() === hoje.toDateString();
    });

    if (!temEmocaoHoje) lembretes.push('Você ainda não registrou uma emoção hoje.');

    const itens = [
        ...urgentes,
        ...comuns,
        ...lembretes.map(mensagem => ({ mensagem, urgente: false }))
    ].slice(0, 6);

    itens.forEach(notificacao => {
        const item = document.createElement('div');
        item.classList.add('notificacao-item');
        if (notificacao.urgente) item.classList.add('notificacao-urgente');
        item.textContent = notificacao.mensagem;
        lista.appendChild(item);
    });
}

// Resumo do psicólogo
function obterConsultaDoPacienteSelecionado() {
    const paciente = obterPacienteSelecionado();
    if (!paciente || !usuarioAtual) return null;

    return bancoDeHorarios
        .filter(slot =>
            slot.psicologoId === usuarioAtual.email &&
            slot.status === 'Agendado' &&
            slot.agendadoPor === paciente.email
        )
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))[0] || null;
}

function renderizarResumoPsicologo() {
    const container = document.getElementById('resumo-psicologo');
    if (!container || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    const pacientes = obterPacientesDoPsicologo();
    const paciente = obterPacienteSelecionado();

    if (!paciente) {
        container.innerHTML = '<div class="resumo-item"><div class="resumo-rotulo">Pacientes</div><div class="resumo-valor">0</div><div class="resumo-detalhe">Nenhum vinculado</div></div>';
        return;
    }

    const emocoes = obterEmocoesDoPaciente(paciente.email);
    const notas = bancoDeDiario.filter(nota => nota.pacienteId === paciente.email && nota.compartilhado).length;
    const consulta = obterConsultaDoPacienteSelecionado();
    const prontuarios = bancoDeProntuarios.filter(item => item.psicologoId === usuarioAtual.email && item.pacienteId === paciente.email).length;

    container.innerHTML = '';
    const itens = [
        { rotulo: 'Pacientes vinculados', valor: pacientes.length, detalhe: 'na sua lista' },
        { rotulo: 'Emoções registradas', valor: emocoes.length, detalhe: `de ${formatarNomeUsuario(paciente)}` },
        { rotulo: 'Notas compartilhadas', valor: notas, detalhe: 'disponíveis' },
        { rotulo: 'Prontuário', valor: prontuarios, detalhe: consulta ? `consulta ${formatarDataCurta(consulta.data)}` : 'sem consulta marcada' }
    ];

    itens.forEach(item => {
        const box = document.createElement('div');
        box.classList.add('resumo-item');

        const rotulo = document.createElement('div');
        rotulo.classList.add('resumo-rotulo');
        rotulo.textContent = item.rotulo;

        const valor = document.createElement('div');
        valor.classList.add('resumo-valor');
        valor.textContent = item.valor;

        const detalhe = document.createElement('div');
        detalhe.classList.add('resumo-detalhe');
        detalhe.textContent = item.detalhe;

        box.appendChild(rotulo);
        box.appendChild(valor);
        box.appendChild(detalhe);
        container.appendChild(box);
    });
}

function renderizarNotificacoesPsicologo() {
    const lista = document.getElementById('notificacoes-psicologo');
    if (!lista || !usuarioAtual || usuarioAtual.perfil !== 'psicologo') return;

    lista.innerHTML = '';
    const eventos = obterNotificacoesDoUsuario(usuarioAtual.email);
    const paciente = obterPacienteSelecionado();
    const lembretes = [];

    if (!paciente) {
        lembretes.push('Nenhum paciente selecionado.');
    } else {
        const consulta = obterConsultaDoPacienteSelecionado();
        const notas = bancoDeDiario.filter(nota => nota.pacienteId === paciente.email && nota.compartilhado).length;
        const mensagens = obterMensagensDaConversa();
        const emocoes = obterEmocoesDoPaciente(paciente.email);

        lembretes.push(`${formatarNomeUsuario(paciente)} possui ${emocoes.length} registro(s) de emoção.`);
        lembretes.push(`${notas} nota(s) estão compartilhadas com você.`);

        if (consulta) {
            lembretes.push(`Consulta com ${formatarNomeUsuario(paciente)} em ${formatarDataCurta(consulta.data)} às ${consulta.hora}.`);
        } else {
            lembretes.push('Este paciente não possui uma consulta agendada no momento.');
        }

        if (mensagens.length > 0) {
            const ultima = mensagens[mensagens.length - 1];
            lembretes.push(`${ultima.autorPerfil === 'paciente' ? 'Última mensagem do paciente' : 'Última mensagem na conversa'}: ${ultima.texto.slice(0, 120)}${ultima.texto.length > 120 ? '...' : ''}`);
        }
    }

    const itens = [
        ...eventos,
        ...lembretes.map(mensagem => ({ mensagem, urgente: false }))
    ].slice(0, 6);

    itens.forEach(notificacao => {
        const item = document.createElement('div');
        item.classList.add('notificacao-item');
        if (notificacao.urgente) item.classList.add('notificacao-urgente');
        item.textContent = notificacao.mensagem;
        lista.appendChild(item);
    });
}

// Contadores
if (descricaoEmocao) {
    descricaoEmocao.addEventListener('input', () => {
        atualizarContadorTextarea(descricaoEmocao, 'contador-emocao', 300);
    });
}

// Sair
function sair() {
    paginaAtual = 'inicio';
    document.querySelectorAll('.painel').forEach(painel => {
        painel.classList.remove('modo-paginas', 'pagina-inicio');
    });
    resetarTutoriais();
    usuarioAtual = null;
    pacienteSelecionadoId = null;
    agendaPacientePendente = null;
    agendaPsicologoPendente = null;
    resetarExercicioCrise();
    fecharJanelaSelecaoPsicologo();
    usuarioAguardandoSelecao = null;
    contextoSelecaoPsicologo = null;
    psicologoPendenteId = null;

    telaPaciente.classList.add('escondido');
    telaPsicologo.classList.add('escondido');
    telaAutenticacao.classList.add('escondido');
    telaEntrada.classList.remove('escondido');

    cancelarAvisoTrocaPsicologo();
    limparCamposTemporarios();
    document.getElementById('form-login').reset();
    document.getElementById('form-cadastro').reset();

    alternarAbas('login');
    limparErros();
}


// Aparência do site
const CHAVE_TEMA = 'safespace_tema_v1';
let paginaAtual = 'inicio';

function configurarTema() {
    let temaSalvo = 'claro';
    try {
        temaSalvo = window.localStorage.getItem(CHAVE_TEMA) || 'claro';
    } catch (erro) {
        temaSalvo = 'claro';
    }
    aplicarTema(temaSalvo === 'escuro', false);
}

function aplicarTema(escuro, persistir = true) {
    document.documentElement.classList.toggle('tema-escuro', escuro);
    const botao = document.getElementById('btn-tema');
    if (botao) {
        botao.textContent = escuro ? '☀️ Modo claro' : '🌙 Modo escuro';
        botao.setAttribute('aria-pressed', String(escuro));
        botao.setAttribute('aria-label', escuro ? 'Ativar modo claro' : 'Ativar modo escuro');
    }
    if (persistir) {
        try {
            window.localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
        } catch (erro) {
            console.warn('Não foi possível guardar a preferência de tema.', erro);
        }
    }
}

let temaEmTransicao = false;
function alternarTema() {
    if (temaEmTransicao) return;
    const escuro = !document.documentElement.classList.contains('tema-escuro');
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Troca a tela inteira ao mesmo tempo, inclusive a logo
    if (!reduzirMovimento && typeof document.startViewTransition === 'function') {
        temaEmTransicao = true;
        const transicao = document.startViewTransition(() => aplicarTema(escuro));
        transicao.finished.finally(() => { temaEmTransicao = false; });
        return;
    }

    const entradaVisivel = !telaEntrada.classList.contains('escondido');
    if (!reduzirMovimento && !entradaVisivel) {
        document.documentElement.classList.add('transicao-tema');
        aplicarTema(escuro);
        window.setTimeout(() => document.documentElement.classList.remove('transicao-tema'), 320);
    } else {
        aplicarTema(escuro);
    }
}

// Organização das funcionalidades
const paginasPorPerfil = {
    paciente: [
        { id: 'sos', titulo: 'S.O.S. / Emergência' },
        { id: 'emocoes', titulo: 'Jarro de emoções' },
        { id: 'diario', titulo: 'Diário de reflexão' },
        { id: 'metas', titulo: 'Metas' },
        { id: 'agenda', titulo: 'Agendamento' },
        { id: 'chat', titulo: 'Chat seguro' }
    ],
    psicologo: [
        { id: 'emocoes', titulo: 'Histórico de emoções' },
        { id: 'grafico', titulo: 'Dashboard analítico' },
        { id: 'notas', titulo: 'Notas compartilhadas' },
        { id: 'prontuario', titulo: 'Prontuário eletrônico' },
        { id: 'agenda', titulo: 'Gerenciamento de horários' },
        { id: 'chat', titulo: 'Chat seguro' }
    ]
};

function alterarModoNavegacao(modo) {
    if (!usuarioAtual || !['lista', 'paginas'].includes(modo)) return;
    usuarioAtual.modoNavegacao = modo;
    paginaAtual = 'inicio';
    salvarDados();
    aplicarModoNavegacao();
}

function abrirPagina(id) {
    if (!usuarioAtual) return;
    if (id !== 'inicio' && !paginasPorPerfil[usuarioAtual.perfil].some(pagina => pagina.id === id)) return;
    paginaAtual = id;
    aplicarModoNavegacao();
    if (id === 'grafico' && usuarioAtual.perfil === 'psicologo') {
        renderizarDashboard();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function criarBotaoPagina(pagina, ativo) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-pagina';
    botao.textContent = pagina.titulo;
    if (ativo) {
        botao.classList.add('ativo');
        botao.setAttribute('aria-current', 'page');
    }
    botao.addEventListener('click', () => abrirPagina(pagina.id));
    return botao;
}

function aplicarModoNavegacao() {
    if (!usuarioAtual) return;
    const painel = document.getElementById(`tela-${usuarioAtual.perfil}`);
    if (!painel) return;

    const paginas = paginasPorPerfil[usuarioAtual.perfil];
    const modoPaginas = usuarioAtual.modoNavegacao === 'paginas';
    if (paginaAtual !== 'inicio' && !paginas.some(pagina => pagina.id === paginaAtual)) paginaAtual = 'inicio';

    painel.classList.toggle('modo-paginas', modoPaginas);
    painel.classList.toggle('pagina-inicio', modoPaginas && paginaAtual === 'inicio');
    painel.querySelectorAll('.btn-modo-layout').forEach(botao => {
        const ativo = botao.dataset.layout === (modoPaginas ? 'paginas' : 'lista');
        botao.classList.toggle('ativo', ativo);
        botao.setAttribute('aria-pressed', String(ativo));
    });

    painel.querySelectorAll('[data-modulo]').forEach(modulo => {
        modulo.classList.toggle('pagina-selecionada', modoPaginas && modulo.dataset.modulo === paginaAtual);
    });

    const navegacao = painel.querySelector('.navegacao-paginas');
    if (navegacao) {
        navegacao.replaceChildren();
        const todas = [{ id: 'inicio', titulo: 'Início' }, ...paginas];
        todas.forEach(pagina => navegacao.appendChild(criarBotaoPagina(pagina, paginaAtual === pagina.id)));
    }
}

configurarTema();
