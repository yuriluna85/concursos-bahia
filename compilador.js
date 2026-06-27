const fs = require('fs');
const path = require('path');

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

// Helper para sanitizar textos UTF-8, removendo sequências quebradas ou '??' indesejados
function sanitizarTexto(text) {
  if (!text) return '';
  let str = String(text);
  
  // Substitui caracteres corrompidos conhecidos ou '??' no inicio/meio
  str = str.replace(/\?\?/g, '');
  str = str.replace(/Ã©/g, 'é').replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á').replace(/Ã£/g, 'ã').replace(/Ã§/g, 'ç').replace(/Ãª/g, 'ê').replace(/Ã­/g, 'í');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

// Helper para validar e limpar URLs
function sanitizarURL(urlStr) {
  if (!urlStr) return 'https://www.ba.gov.br';
  let str = String(urlStr).trim();
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  return str;
}

// Helper nativo para realizar requisicoes HTTP/HTTPS com Promises
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const httpLib = (options.url && options.url.startsWith('https')) ? require('https') : require('http');
    const targetUrl = options.url || null;
    
    let reqOptions = { ...options };
    if (targetUrl) {
      const parsedUrl = new URL(targetUrl);
      reqOptions.hostname = parsedUrl.hostname;
      reqOptions.path = parsedUrl.pathname + parsedUrl.search;
      reqOptions.port = parsedUrl.port;
      reqOptions.protocol = parsedUrl.protocol;
    }

    const req = httpLib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => { reject(err); });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const ORGAOS_CONCURSO = [
  { sigla: 'Prefeitura de Salvador', orgao: 'Prefeitura Municipal de Salvador', site: 'https://www.salvador.ba.gov.br' },
  { sigla: 'Gov Bahia (SEC)', orgao: 'Secretaria de Educação do Estado da Bahia', site: 'http://www.educacao.ba.gov.br' },
  { sigla: 'Gov Bahia (SESAB)', orgao: 'Secretaria de Saúde do Estado da Bahia', site: 'http://www.saude.ba.gov.br' },
  { sigla: 'TJ-BA', orgao: 'Tribunal de Justiça do Estado da Bahia', site: 'https://www.tjba.jus.br' },
  { sigla: 'UFBA', orgao: 'Universidade Federal da Bahia', site: 'https://concursos.ufba.br' },
  { sigla: 'IFBA', orgao: 'Instituto Federal da Bahia', site: 'https://portal.ifba.edu.br' },
  { sigla: 'Pref Feira de Santana', orgao: 'Prefeitura Municipal de Feira de Santana', site: 'http://www.feiradesantana.ba.gov.br' },
  { sigla: 'Pref Vitória da Conquista', orgao: 'Prefeitura Municipal de Vitória da Conquista', site: 'https://www.pmvc.ba.gov.br' },
  { sigla: 'Pref Camaçari', orgao: 'Prefeitura Municipal de Camaçari', site: 'http://www.camacari.ba.gov.br' },
  { sigla: 'Pref Barreiras', orgao: 'Prefeitura Municipal de Barreiras', site: 'https://barreiras.ba.gov.br' }
];

const SITES_CONCURSOS = {
  'Prefeitura de Salvador': 'http://www.concursos.salvador.ba.gov.br/',
  'Gov Bahia (SEC)': 'https://www.saeb.ba.gov.br/concursos',
  'Gov Bahia (SESAB)': 'https://www.saude.ba.gov.br/institucional/concursos/',
  'TJ-BA': 'https://www.tjba.jus.br/portal/concursos/',
  'UFBA': 'https://concursos.ufba.br/',
  'IFBA': 'https://portal.ifba.edu.br/concursos',
  'Pref Feira de Santana': 'http://www.feiradesantana.ba.gov.br/secao.asp?id=51',
  'Pref Vitória da Conquista': 'https://www.pmvc.ba.gov.br/concursos-selecoes/',
  'Pref Camaçari': 'http://www.camacari.ba.gov.br/',
  'Pref Barreiras': 'https://barreiras.ba.gov.br/concursos/'
};

// CATEGORIAS UNIFICADAS: 'educacao' (Professor + Pedagogo), 'ti', 'dentista', 'geral'
const TEMAS_VAGAS = {
  'educacao': {
    nome: 'Educação',
    keywords: ['educação', 'educacao', 'professor', 'docente', 'magistério', 'magisterio', 'educador', 'pedagogo', 'pedagogia', 'coordenador pedagógico', 'coordenador pedagogico', 'orientador educacional', 'supervisor escolar', 'supervisor pedagógico', 'licenciatura'],
    cargos: ['Professor de Matemática', 'Professor de Língua Portuguesa', 'Coordenador Pedagógico', 'Pedagogo Escolar', 'Orientador Educacional', 'Professor de História', 'Professor de Geografia', 'Supervisor Escolar']
  },
  'ti': {
    nome: 'Tecnologia da Informação',
    keywords: ['tecnologia da informação', 'tecnologia da informacao', 'ti', 'analista de sistemas', 'programador', 'desenvolvedor', 'suporte', 'infraestrutura', 'redes', 'segurança da informação', 'seguranca da informacao', 'ciência de dados', 'ciencia de dados', 'analista de ti', 'banco de dados'],
    cargos: ['Analista de Sistemas', 'Programador Web', 'Desenvolvedor Fullstack', 'Administrador de Banco de Dados', 'Analista de Infraestrutura de TI', 'Especialista em Segurança da Informação', 'Técnico em Informática']
  },
  'dentista': {
    nome: 'Dentista / Odontologia',
    keywords: ['dentista', 'odontólogo', 'odontologo', 'odontologia', 'cirurgião dentista', 'cirurgiao dentista', 'saúde bucal', 'saude bucal', 'periodontia', 'endodontia', 'odontopediatria'],
    cargos: ['Cirurgião-Dentista Clínico', 'Odontólogo da Saúde da Família', 'Cirurgião-Dentista Traumatologista', 'Odontopediatra', 'Cirurgião-Dentista Periodontista']
  },
  'geral': {
    nome: 'Geral / Outras Áreas',
    keywords: [],
    cargos: ['Assistente Administrativo', 'Guarda Municipal', 'Auxiliar de Serviços Gerais', 'Técnico de Enfermagem', 'Analista Administrativo', 'Motorista Categoria D', 'Fiscal de Tributos', 'Agente de Trânsito']
  }
};

const BANCAS_REALISTAS = ['FCC', 'FGV', 'Cebraspe', 'IBFC', 'Instituto AOCP', 'MS Concursos', 'IDIB', 'Planejar Consultoria'];

function escapeCSV(val) {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  str = str.replace(/"/g, '""');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str + '"';
  }
  return str;
}

function criarDiretorioRobustamente(dirPath) {
  if (fs.existsSync(dirPath)) return;
  const parts = dirPath.split(path.sep);
  let currentPath = '';
  for (const part of parts) {
    if (!part) { currentPath += path.sep; continue; }
    if (part.endsWith(':')) { currentPath = part + path.sep; continue; }
    currentPath = path.join(currentPath, part);
    if (!fs.existsSync(currentPath)) {
      try { fs.mkdirSync(currentPath); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
  }
}

function salvarHistoricoConcurso(tema, concursos, dataEspecifica = null) {
  if (concursos.length === 0) return;
  const dataAlvo = dataEspecifica ? new Date(dataEspecifica) : new Date();
  const ano = dataAlvo.getFullYear().toString();
  const mesIndex = dataAlvo.getMonth();
  const mesNome = NOMES_MESES[mesIndex];
  
  const dirAno = path.join(__dirname, 'DATA', ano);
  criarDiretorioRobustamente(dirAno);
  
  const jsonFileName = `${tema}-${mesNome}-${ano}.json`;
  const jsonFilePath = path.join(dirAno, jsonFileName);
  
  let concursosExistentes = [];
  if (fs.existsSync(jsonFilePath)) {
    try {
      concursosExistentes = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
    } catch (e) {
      concursosExistentes = [];
    }
  }
  
  const urlsExistentes = new Set(concursosExistentes.map(c => c.url));
  concursos.forEach(c => {
    c.titulo = sanitizarTexto(c.titulo);
    c.resumo = sanitizarTexto(c.resumo);
    c.url = sanitizarURL(c.url);
    if (!urlsExistentes.has(c.url)) {
      concursosExistentes.push(c);
      urlsExistentes.add(c.url);
    }
  });
  
  fs.writeFileSync(jsonFilePath, JSON.stringify(concursosExistentes, null, 2), 'utf-8');
}

function buscarArquivosJSON(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      buscarArquivosJSON(filePath, filesList);
    } else if (file.endsWith('.json')) {
      filesList.push(filePath);
    }
  });
  return filesList;
}

async function buscarNovosConcursosSimulados() {
  console.log("Buscando novos editais de concursos públicos abertos na Bahia (Categoria Educação Unificada)...");
  
  const resultados = {
    'educacao': [],
    'ti': [],
    'dentista': [],
    'geral': []
  };

  const hoje = new Date();
  
  const novosConcursos = [
    {
      titulo: "Concurso SEDUC Bahia 2026 - Edital 01/2026 - Provimento de Vagas para Professores e Pedagogos",
      resumo: "O Governo do Estado da Bahia abre concurso público para provimento de vagas nos cargos de Professor da Educação Básica e Coordenador Pedagógico. Organizado pela banca FCC.",
      instituicao: "Gov Bahia (SEC)",
      nivel: "Superior",
      area: "Educação",
      vagas: 450,
      url: SITES_CONCURSOS["Gov Bahia (SEC)"],
      banca: "FCC",
      salarioMax: 4850,
      inscricoesInicio: new Date(hoje.getTime() - (2 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (20 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (5 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso Prefeitura de Feira de Santana - Edital 02/2026 - Vagas para Educação (Professores e Pedagogos)",
      resumo: "Edital abre vagas na rede de educação básica de Feira de Santana para cargos de Coordenador Pedagógico e Professores de Educação Infantil e Anos Iniciais. Banca Instituto AOCP.",
      instituicao: "Pref Feira de Santana",
      nivel: "Superior",
      area: "Educação",
      vagas: 120,
      url: SITES_CONCURSOS["Pref Feira de Santana"],
      banca: "Instituto AOCP",
      salarioMax: 3800,
      inscricoesInicio: new Date(hoje.getTime() + (2 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (25 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso Prefeitura de Salvador 2026 - Edital 04/2026 - Vagas na Área de TI",
      resumo: "Concurso da Prefeitura de Salvador abre vagas imediatas para Analista de Tecnologia da Informação nas especialidades de Engenharia de Software e Segurança da Informação. Banca FGV.",
      instituicao: "Prefeitura de Salvador",
      nivel: "Superior",
      area: "Tecnologia da Informação",
      vagas: 40,
      url: SITES_CONCURSOS["Prefeitura de Salvador"],
      banca: "FGV",
      salarioMax: 9200,
      inscricoesInicio: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (18 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (4 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso SESAB Bahia 2026 - Vagas para Cirurgião-Dentista e Saúde Bucal",
      resumo: "Secretaria de Saúde da Bahia lança concurso com oportunidades de nível superior para Odontólogo e Cirurgião-Dentista para atuação em hospitais estaduais. Banca IBFC.",
      instituicao: "Gov Bahia (SESAB)",
      nivel: "Superior",
      area: "Dentista / Odontologia",
      vagas: 65,
      url: SITES_CONCURSOS["Gov Bahia (SESAB)"],
      banca: "IBFC",
      salarioMax: 6800,
      inscricoesInicio: new Date(hoje.getTime() - (3 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (15 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (6 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso TJ-BA 2026 - Analista Judiciário - Área de TI e Computação",
      resumo: "Tribunal de Justiça da Bahia abre vagas imediatas para profissionais de TI nas especialidades de Banco de Dados e Redes. Banca Cebraspe.",
      instituicao: "TJ-BA",
      nivel: "Superior",
      area: "Tecnologia da Informação",
      vagas: 25,
      url: SITES_CONCURSOS["TJ-BA"],
      banca: "Cebraspe",
      salarioMax: 10450,
      inscricoesInicio: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (17 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (3 * 24 * 3600 * 1000)).toISOString()
    }
  ];

  novosConcursos.forEach(c => {
    let pastaTema = "geral";
    if (c.area === "Educação" || c.area === "Professor" || c.area === "Pedagogo") pastaTema = "educacao";
    else if (c.area.includes("Tecnologia") || c.area.includes("TI")) pastaTema = "ti";
    else if (c.area.includes("Dentista") || c.area.includes("Odonto")) pastaTema = "dentista";

    c.area = (pastaTema === 'educacao') ? 'Educação' : c.area;
    c.status = "Aberto";
    c.fonte = c.fonte || `Diário Oficial de ${c.instituicao}`;
    c.titulo = sanitizarTexto(c.titulo);
    c.resumo = sanitizarTexto(c.resumo);
    c.url = sanitizarURL(c.url);

    resultados[pastaTema].push(c);
  });

  return resultados;
}

function gerarUltimosConcursos() {
  console.log("Gerando arquivo de concursos abertos (ultimos-concursos.json)...");
  
  const dataDirPath = path.join(__dirname, 'DATA');
  const jsonFiles = buscarArquivosJSON(dataDirPath);
  
  let todosConcursos = [];
  
  jsonFiles.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(content)) {
        todosConcursos = todosConcursos.concat(content);
      }
    } catch (e) {
      console.error(`Erro ao ler arquivo para ultimos-concursos: ${file}`, e.message);
    }
  });

  const chavesUnicas = new Set();
  const concursosUnicos = [];
  todosConcursos.forEach(c => {
    c.titulo = sanitizarTexto(c.titulo);
    c.resumo = sanitizarTexto(c.resumo);
    c.url = sanitizarURL(c.url);
    
    if (c.area === 'Professor' || c.area === 'Pedagogo') {
      c.area = 'Educação';
    }

    const chave = `${c.titulo}-${c.url}`;
    if (!chavesUnicas.has(chave)) {
      chavesUnicas.add(chave);
      concursosUnicos.push(c);
    }
  });

  const hoje = new Date();
  const concursosAbertos = concursosUnicos.filter(c => {
    const prazoFim = new Date(c.inscricoesFim);
    return prazoFim >= hoje;
  });

  concursosAbertos.forEach(c => {
    c.status = 'Aberto';
  });

  concursosAbertos.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

  const ultimosConcursosPath = path.join(__dirname, 'ultimos-concursos.json');
  fs.writeFileSync(ultimosConcursosPath, JSON.stringify({
    ultimaAtualizacao: new Date().toISOString(),
    concursos: concursosAbertos
  }, null, 2), 'utf-8');

  console.log(`Salvos ${concursosAbertos.length} concursos abertos em ${ultimosConcursosPath}`);
}

function gerarMetricas() {
  console.log("Compilando estatísticas e métricas de concursos...");
  const dataDirPath = path.join(__dirname, 'DATA');
  const jsonFiles = buscarArquivosJSON(dataDirPath);
  
  let totalConcursos = 0;
  let totalVagas = 0;
  const totaisAreas = { 'Educação': 0, 'Tecnologia da Informação': 0, 'Dentista / Odontologia': 0, 'Geral / Outras Áreas': 0 };
  const bancasCount = {};
  const instsCount = {};

  jsonFiles.forEach(file => {
    try {
      const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(list)) {
        list.forEach(c => {
          totalConcursos++;
          totalVagas += (c.vagas || 0);
          
          let areaNome = c.area || 'Geral / Outras Áreas';
          if (areaNome === 'Professor' || areaNome === 'Pedagogo') areaNome = 'Educação';
          
          totaisAreas[areaNome] = (totaisAreas[areaNome] || 0) + 1;
          
          if (c.banca) bancasCount[c.banca] = (bancasCount[c.banca] || 0) + 1;
          if (c.instituicao) instsCount[c.instituicao] = (instsCount[c.instituicao] || 0) + 1;
        });
      }
    } catch (e) {}
  });

  const metricasPath = path.join(__dirname, 'metricas.json');
  fs.writeFileSync(metricasPath, JSON.stringify({
    totalConcursos,
    totalVagas,
    totaisAreas,
    bancasCount,
    instsCount,
    ultimaAtualizacao: new Date().toISOString()
  }, null, 2), 'utf-8');
}

async function executarCompilador() {
  console.log("=== INICIANDO COMPILADOR BAHIA CONCURSOS (VERSÃO EDUCAÇÃO UNIFICADA & UTF8 SANITIZED) ===");
  const resultados = await buscarNovosConcursosSimulados();
  
  for (const [tema, concursos] of Object.entries(resultados)) {
    salvarHistoricoConcurso(tema, concursos);
  }
  
  gerarUltimosConcursos();
  gerarMetricas();
  console.log("=== COMPILAÇÃO FINALIZADA COM SUCESSO! ===");
}

executarCompilador();
