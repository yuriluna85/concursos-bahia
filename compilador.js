const fs = require('fs');
const path = require('path');

// Bancas organizadoras e siglas de órgãos para gerar feeds e mock data
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

const TEMAS_VAGAS = {
  'professor': {
    nome: 'Professor',
    keywords: ['professor', 'docente', 'magistério', 'magisterio', 'educador', 'professor da educação', 'ensino médio', 'ensino fundamental', 'licenciatura'],
    cargos: ['Professor de Matemática', 'Professor de Língua Portuguesa', 'Professor de História', 'Professor de Geografia', 'Professor de Ciências', 'Professor de Biologia', 'Professor de Educação Física', 'Professor de Inglês']
  },
  'pedagogo': {
    nome: 'Pedagogo',
    keywords: ['pedagogo', 'pedagogia', 'coordenador pedagógico', 'coordenador pedagogico', 'orientador educacional', 'supervisor escolar', 'supervisor pedagógico'],
    cargos: ['Pedagogo Escolar', 'Coordenador Pedagógico', 'Orientador Educacional', 'Analista em Pedagogia', 'Supervisor Pedagógico']
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

// Helper para escapar campos do CSV conforme RFC 4180
function escapeCSV(val) {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  str = str.replace(/"/g, '""');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

// Cria diretórios nível por nível robustamente
function criarDiretorioRobustamente(dirPath) {
  if (fs.existsSync(dirPath)) return;
  const parts = dirPath.split(path.sep);
  let currentPath = '';
  for (const part of parts) {
    if (!part) {
      currentPath += path.sep;
      continue;
    }
    if (part.endsWith(':')) {
      currentPath = part + path.sep;
      continue;
    }
    currentPath = path.join(currentPath, part);
    if (!fs.existsSync(currentPath)) {
      try {
        fs.mkdirSync(currentPath);
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
  }
}

// Salva concursos no formato estruturado DATA > ANO > MES > TEMA
function salvarHistoricoConcurso(tema, concursos, dataEspecifica = null) {
  if (concursos.length === 0) return;

  const refDate = dataEspecifica || new Date();
  const ano = refDate.getFullYear().toString();
  const mes = String(refDate.getMonth() + 1).padStart(2, '0');

  const dirPath = path.join(__dirname, 'DATA', ano, mes, tema);
  criarDiretorioRobustamente(dirPath);

  const csvPath = path.join(dirPath, `${tema}.csv`);
  const jsonPath = path.join(dirPath, `${tema}.json`);

  // 1. Gravar CSV
  let csvContent = '';
  if (!fs.existsSync(csvPath)) {
    csvContent = 'data_coleta,titulo,resumo,instituicao,nivel,area,vagas,inscricoes_inicio,inscricoes_fim,url,status,data_publicacao,fonte,banca,salario_max\n';
  }

  const dataColeta = refDate.toISOString();
  concursos.forEach(c => {
    csvContent += `${escapeCSV(dataColeta)},${escapeCSV(c.titulo)},${escapeCSV(c.resumo)},${escapeCSV(c.instituicao)},${escapeCSV(c.nivel)},${escapeCSV(c.area)},${escapeCSV(c.vagas)},${escapeCSV(c.inscricoesInicio)},${escapeCSV(c.inscricoesFim)},${escapeCSV(c.url)},${escapeCSV(c.status)},${escapeCSV(c.dataPublicacao)},${escapeCSV(c.fonte)},${escapeCSV(c.banca)},${escapeCSV(c.salarioMax)}\n`;
  });

  fs.appendFileSync(csvPath, csvContent, 'utf-8');

  // 2. Gravar/Atualizar JSON
  let historicoDia = [];
  if (fs.existsSync(jsonPath)) {
    try {
      historicoDia = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (err) {
      historicoDia = [];
    }
  }

  concursos.forEach(c => {
    if (!historicoDia.some(h => h.url === c.url && h.titulo === c.titulo)) {
      historicoDia.push({
        dataColeta,
        titulo: c.titulo,
        resumo: c.resumo,
        instituicao: c.instituicao,
        nivel: c.nivel,
        area: c.area,
        vagas: c.vagas,
        inscricoesInicio: c.inscricoesInicio,
        inscricoesFim: c.inscricoesFim,
        url: c.url,
        status: c.status,
        dataPublicacao: c.dataPublicacao,
        fonte: c.fonte,
        banca: c.banca,
        salarioMax: c.salarioMax
      });
    }
  });

  historicoDia.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));
  fs.writeFileSync(jsonPath, JSON.stringify(historicoDia, null, 2), 'utf-8');
}

// Salva de forma destrutiva/sobrescrevendo (usado no sementador retroativo)
function salvarHistoricoConcursoSobrescrevendo(tema, concursos, dataEspecifica) {
  if (concursos.length === 0) return;

  const ano = dataEspecifica.getFullYear().toString();
  const mes = String(dataEspecifica.getMonth() + 1).padStart(2, '0');

  const dirPath = path.join(__dirname, 'DATA', ano, mes, tema);
  criarDiretorioRobustamente(dirPath);

  const csvPath = path.join(dirPath, `${tema}.csv`);
  const jsonPath = path.join(dirPath, `${tema}.json`);

  // 1. Gravar CSV
  let csvContent = 'data_coleta,titulo,resumo,instituicao,nivel,area,vagas,inscricoes_inicio,inscricoes_fim,url,status,data_publicacao,fonte,banca,salario_max\n';
  const dataColeta = dataEspecifica.toISOString();
  concursos.forEach(c => {
    csvContent += `${escapeCSV(dataColeta)},${escapeCSV(c.titulo)},${escapeCSV(c.resumo)},${escapeCSV(c.instituicao)},${escapeCSV(c.nivel)},${escapeCSV(c.area)},${escapeCSV(c.vagas)},${escapeCSV(c.inscricoesInicio)},${escapeCSV(c.inscricoesFim)},${escapeCSV(c.url)},${escapeCSV(c.status)},${escapeCSV(c.dataPublicacao)},${escapeCSV(c.fonte)},${escapeCSV(c.banca)},${escapeCSV(c.salarioMax)}\n`;
  });
  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  // 2. Gravar JSON
  const historicoDia = concursos.map(c => ({
    dataColeta,
    titulo: c.titulo,
    resumo: c.resumo,
    instituicao: c.instituicao,
    nivel: c.nivel,
    area: c.area,
    vagas: c.vagas,
    inscricoesInicio: c.inscricoesInicio,
    inscricoesFim: c.inscricoesFim,
    url: c.url,
    status: c.status,
    dataPublicacao: c.dataPublicacao,
    fonte: c.fonte,
    banca: c.banca,
    salarioMax: c.salarioMax
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(historicoDia, null, 2), 'utf-8');
}

// Busca recursiva de arquivos JSON, ignorando os arquivos anuais unificados
function buscarArquivosJSON(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      const parentDir = path.basename(dir);
      const isYearDir = /^\d{4}$/.test(parentDir);
      if (isYearDir && !/^\d{2}$/.test(file)) {
        continue;
      }
      buscarArquivosJSON(name, filesList);
    } else if (file.endsWith('.json')) {
      const parentDir = path.basename(dir);
      const isYearDir = /^\d{4}$/.test(parentDir);
      if (isYearDir) {
        continue;
      }
      filesList.push(name);
    }
  }
  return filesList;
}

// Consolda arquivos de um determinado ano
function consolidarAno(ano) {
  const anoDir = path.join(__dirname, 'DATA', ano);
  if (!fs.existsSync(anoDir)) return;
  
  const meses = fs.readdirSync(anoDir).filter(m => /^\d{2}$/.test(m) && fs.statSync(path.join(anoDir, m)).isDirectory());
  
  for (const tema of ['professor', 'pedagogo', 'ti', 'dentista', 'geral']) {
    let todosTema = [];
    for (const mes of meses) {
      const jsonPath = path.join(anoDir, mes, tema, `${tema}.json`);
      if (fs.existsSync(jsonPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          if (Array.isArray(content)) {
            todosTema = todosTema.concat(content);
          }
        } catch (e) {
          console.error(`Erro ao ler arquivo ${jsonPath} para consolidação anual:`, e.message);
        }
      }
    }
    
    // Deduplicar e ordenar
    const chavesUnicas = new Set();
    const concursosUnicos = [];
    todosTema.forEach(c => {
      const chave = `${c.titulo}-${c.url}`;
      if (!chavesUnicas.has(chave)) {
        chavesUnicas.add(chave);
        
        // Atualizar status conforme data limite dinamicamente
        const hoje = new Date();
        const prazoFim = new Date(c.inscricoesFim);
        if (prazoFim < hoje) {
          c.status = 'Encerrado';
        } else {
          c.status = 'Aberto';
        }
        
        concursosUnicos.push(c);
      }
    });
    
    concursosUnicos.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));
    
    // Gravar JSON
    const outputJsonPath = path.join(anoDir, `${tema}.json`);
    fs.writeFileSync(outputJsonPath, JSON.stringify(concursosUnicos, null, 2), 'utf-8');
    
    // Gravar CSV
    const outputCsvPath = path.join(anoDir, `${tema}.csv`);
    let csvContent = 'data_coleta,titulo,resumo,instituicao,nivel,area,vagas,inscricoes_inicio,inscricoes_fim,url,status,data_publicacao,fonte,banca,salario_max\n';
    concursosUnicos.forEach(c => {
      csvContent += `${escapeCSV(c.dataColeta)},${escapeCSV(c.titulo)},${escapeCSV(c.resumo)},${escapeCSV(c.instituicao)},${escapeCSV(c.nivel)},${escapeCSV(c.area)},${escapeCSV(c.vagas)},${escapeCSV(c.inscricoesInicio)},${escapeCSV(c.inscricoesFim)},${escapeCSV(c.url)},${escapeCSV(c.status)},${escapeCSV(c.dataPublicacao)},${escapeCSV(c.fonte)},${escapeCSV(c.banca)},${escapeCSV(c.salarioMax)}\n`;
    });
    fs.writeFileSync(outputCsvPath, csvContent, 'utf-8');
  }
}

// Consolida todos os anos existentes na pasta DATA
function consolidarTodosAnos() {
  console.log("Consolidando arquivos históricos anuais...");
  const dataDir = path.join(__dirname, 'DATA');
  if (!fs.existsSync(dataDir)) return;
  const anos = fs.readdirSync(dataDir).filter(a => /^\d{4}$/.test(a) && fs.statSync(path.join(dataDir, a)).isDirectory());
  for (const ano of anos) {
    consolidarAno(ano);
  }
  console.log("Consolidação anual concluída!");
}

// Sementador histórico retroativo de 2 anos (Junho 2024 a Junho 2026)
function verificarEGerarHistoricoRetroativo() {
  const dataDirPath = path.join(__dirname, 'DATA');
  
  if (fs.existsSync(dataDirPath)) {
    const anosExistentes = fs.readdirSync(dataDirPath).filter(file => {
      const fullPath = path.join(dataDirPath, file);
      return fs.statSync(fullPath).isDirectory() && /^\d{4}$/.test(file);
    });
    if (anosExistentes.length >= 2) {
      console.log("Histórico retroativo de concursos já existe. Pulando geração...");
      return;
    }
  }

  console.log("Iniciando geração de dados históricos retroativos de concursos públicos (2024 a 2026)...");

  const periodos = [];
  for (let m = 6; m <= 12; m++) periodos.push({ ano: 2024, mes: m });
  for (let m = 1; m <= 12; m++) periodos.push({ ano: 2025, mes: m });
  for (let m = 1; m <= 5; m++) periodos.push({ ano: 2026, mes: m });

  for (const p of periodos) {
    const ano = p.ano;
    const mes = p.mes;

    const concursosAgrupados = {
      'professor': [],
      'pedagogo': [],
      'ti': [],
      'dentista': [],
      'geral': []
    };

    // Gera de 4 a 6 concursos por mês
    const totalConcursosMes = 4 + ((ano + mes) % 3);
    for (let i = 0; i < totalConcursosMes; i++) {
      const seedVal = ano + mes + i;
      const org = ORGAOS_CONCURSO[seedVal % ORGAOS_CONCURSO.length];
      const banca = BANCAS_REALISTAS[seedVal % BANCAS_REALISTAS.length];
      
      // Determina o tema do concurso
      let tema = 'geral';
      const temaSeed = seedVal % 5;
      if (temaSeed === 0) tema = 'professor';
      else if (temaSeed === 1) tema = 'pedagogo';
      else if (temaSeed === 2) tema = 'ti';
      else if (temaSeed === 3) tema = 'dentista';

      const metaTema = TEMAS_VAGAS[tema];
      const cargo = metaTema.cargos[seedVal % metaTema.cargos.length];
      const numEdital = `${String(1 + (seedVal % 15)).padStart(2, '0')}/${ano}`;
      
      let titulo = `Concurso Público ${org.sigla} - Edital ${numEdital} - Vagas para ${cargo}`;
      let resumo = `Estão abertas as inscrições para o concurso público da ${org.orgao} com oportunidades para o cargo de ${cargo}. A seleção é organizada pela banca ${banca}. Prova objetiva e avaliação de títulos serão realizadas conforme cronograma oficial.`;
      
      let nivel = 'Superior';
      let salarioMax = 3500 + (seedVal % 10) * 800;
      if (tema === 'ti') salarioMax += 1500;
      if (tema === 'dentista') salarioMax += 2000;
      if (tema === 'geral' && (seedVal % 3 === 0)) {
        nivel = 'Médio';
        salarioMax = 2000 + (seedVal % 5) * 300;
      }

      const diaInicio = 2 + (i % 3);
      const diaFim = diaInicio + 20 + (i % 5);
      
      const inscStart = new Date(ano, mes - 1, diaInicio, 9, 0, 0).toISOString();
      const inscEnd = new Date(ano, mes - 1, diaFim, 23, 59, 59).toISOString();
      const dataPub = new Date(ano, mes - 1, diaInicio - 4, 10, 0, 0).toISOString();

      concursosAgrupados[tema].push({
        titulo,
        resumo,
        instituicao: org.sigla,
        nivel,
        area: metaTema.nome,
        vagas: 5 + (seedVal % 25),
        inscricoesInicio: inscStart,
        inscricoesFim: inscEnd,
        url: `${org.site}/concurso-edital-${numEdital.replace('/', '-')}-${i}`,
        status: "Encerrado",
        dataPublicacao: dataPub,
        fonte: `Diário Oficial de ${org.sigla}`,
        banca,
        salarioMax
      });
    }

    // Grava no histórico
    const refDate = new Date(ano, mes - 1, 15);
    for (const tema of ['professor', 'pedagogo', 'ti', 'dentista', 'geral']) {
      if (concursosAgrupados[tema].length > 0) {
        salvarHistoricoConcursoSobrescrevendo(tema, concursosAgrupados[tema], refDate);
      }
    }
  }

  console.log("Histórico retroativo de concursos criado com sucesso!");
}

// Simula busca por novos editais de concurso no presente (Junho 2026)
async function buscarNovosConcursos() {
  console.log("Buscando novos editais de concursos públicos abertos na Bahia...");
  
  const resultados = {
    'professor': [],
    'pedagogo': [],
    'ti': [],
    'dentista': [],
    'geral': []
  };

  const hoje = new Date();
  
  // Concursos ativos e abertos no presente (Junho 2026)
  const novosConcursos = [
    {
      titulo: "Concurso SEDUC Bahia 2026 - Edital 01/2026 - Provimento de Vagas para Professor e Pedagogo",
      resumo: "O Governo do Estado da Bahia abre concurso público para provimento de vagas no cargo de Professor Padrão P - Grau III da Educação Básica e Pedagogo. Organizado pela banca FCC.",
      instituicao: "Gov Bahia (SEC)",
      nivel: "Superior",
      area: "Professor",
      vagas: 450,
      url: "http://www.educacao.ba.gov.br/concurso-professor-2026",
      banca: "FCC",
      salarioMax: 4850,
      inscricoesInicio: new Date(hoje.getTime() - (2 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (20 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (5 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso Prefeitura de Salvador 2026 - Edital 04/2026 - Vagas na área de TI",
      resumo: "Concurso da Prefeitura de Salvador abre vagas imediatas para Analista de Tecnologia da Informação nas especialidades de Engenharia de Software, Infraestrutura de Redes e Segurança. Banca FGV.",
      instituicao: "Prefeitura de Salvador",
      nivel: "Superior",
      area: "Tecnologia da Informação",
      vagas: 40,
      url: "https://www.salvador.ba.gov.br/concurso-ti-2026",
      banca: "FGV",
      salarioMax: 9200,
      inscricoesInicio: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (18 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (4 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso Prefeitura de Feira de Santana - Edital 02/2026 - Vagas para Pedagogos e Professores",
      resumo: "Edital abre vagas na rede de educação básica de Feira de Santana para cargos de Coordenador Pedagógico (Pedagogo) e Professores de Educação Infantil e Anos Iniciais. Banca Instituto AOCP.",
      instituicao: "Pref Feira de Santana",
      nivel: "Superior",
      area: "Pedagogo",
      vagas: 120,
      url: "http://www.feiradesantana.ba.gov.br/concursos-2026",
      banca: "Instituto AOCP",
      salarioMax: 3800,
      inscricoesInicio: new Date(hoje.getTime() + (2 * 24 * 3600 * 1000)).toISOString(), // Abre em breve
      inscricoesFim: new Date(hoje.getTime() + (25 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso SESAB Bahia 2026 - Vagas para Cirurgião-Dentista e Saúde Bucal",
      resumo: "Secretaria de Saúde da Bahia lança concurso com oportunidades de nível superior para Odontólogo e Cirurgião-Dentista Bucomaxilofacial para atuação em hospitais estaduais e policlínicas. Banca IBFC.",
      instituicao: "Gov Bahia (SESAB)",
      nivel: "Superior",
      area: "Dentista / Odontologia",
      vagas: 65,
      url: "http://www.saude.ba.gov.br/concurso-sesab-2026",
      banca: "IBFC",
      salarioMax: 6800,
      inscricoesInicio: new Date(hoje.getTime() - (3 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (15 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (6 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso Prefeitura de Lauro de Freitas - Vagas para Assistente e Guarda Municipal",
      resumo: "Processo seletivo de Lauro de Freitas para níveis médio e técnico em cargos de Assistente Administrativo e Guarda Municipal. Banca IDIB.",
      instituicao: "Prefeitura de Salvador", // Usando Salvador como mock correspondente nas stats
      nivel: "Médio",
      area: "Geral / Outras Áreas",
      vagas: 80,
      url: "https://www.laurodefreitas.ba.gov.br/concurso-2026",
      banca: "IDIB",
      salarioMax: 2400,
      inscricoesInicio: new Date(hoje.getTime() - (2 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (12 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (5 * 24 * 3600 * 1000)).toISOString()
    },
    {
      titulo: "Concurso TJ-BA 2026 - Analista Judiciário - Área de TI e Computação",
      resumo: "Tribunal de Justiça da Bahia abre vagas imediatas para profissionais de TI nas especialidades de Banco de Dados, Redes de Computadores e IA. Banca Cebraspe.",
      instituicao: "TJ-BA",
      nivel: "Superior",
      area: "Tecnologia e Informática", // Mapeado para TI
      vagas: 25,
      url: "https://www.tjba.jus.br/concurso-ti-2026",
      banca: "Cebraspe",
      salarioMax: 10450,
      inscricoesInicio: new Date(hoje.getTime() - (1 * 24 * 3600 * 1000)).toISOString(),
      inscricoesFim: new Date(hoje.getTime() + (17 * 24 * 3600 * 1000)).toISOString(),
      dataPublicacao: new Date(hoje.getTime() - (3 * 24 * 3600 * 1000)).toISOString()
    }
  ];

  novosConcursos.forEach(c => {
    let pastaTema = "geral";
    if (c.area === "Professor") pastaTema = "professor";
    else if (c.area === "Pedagogo") pastaTema = "pedagogo";
    else if (c.area.includes("Tecnologia")) pastaTema = "ti";
    else if (c.area.includes("Dentista")) pastaTema = "dentista";

    c.status = "Aberto";
    c.fonte = c.fonte || `Diário Oficial de ${c.instituicao}`;

    resultados[pastaTema].push(c);
  });

  return resultados;
}

// Gera o arquivo ultimos-concursos.json contendo apenas os editais que ainda estão abertos
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

  // Deduplicar
  const chavesUnicas = new Set();
  const concursosUnicos = [];
  todosConcursos.forEach(c => {
    const chave = `${c.titulo}-${c.url}`;
    if (!chavesUnicas.has(chave)) {
      chavesUnicas.add(chave);
      concursosUnicos.push(c);
    }
  });

  // Filtrar para conter apenas os abertos (inscrições no futuro ou em andamento)
  const hoje = new Date();
  const concursosAbertos = concursosUnicos.filter(c => {
    const prazoFim = new Date(c.inscricoesFim);
    return prazoFim >= hoje;
  });

  // Atualiza o status para Aberto de todos os que estão nessa lista
  concursosAbertos.forEach(c => {
    c.status = 'Aberto';
  });

  // Ordenar por data de publicação decrescente
  concursosAbertos.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

  // Escrever ultimos-concursos.json
  const ultimosConcursosPath = path.join(__dirname, 'ultimos-concursos.json');
  fs.writeFileSync(ultimosConcursosPath, JSON.stringify({
    ultimaAtualizacao: new Date().toISOString(),
    concursos: concursosAbertos
  }, null, 2), 'utf-8');

  console.log(`Salvos ${concursosAbertos.length} concursos abertos em ${ultimosConcursosPath}`);
}

// Gera o arquivo metricas.json consolidando dados históricos
function gerarMetricas() {
  console.log("Compilando estatísticas e métricas de concursos...");
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
      console.error(`Erro ao ler arquivo para métricas: ${file}`, e.message);
    }
  });

  const chavesUnicas = new Set();
  const concursosUnicos = [];
  todosConcursos.forEach(c => {
    const chave = `${c.titulo}-${c.url}`;
    if (!chavesUnicas.has(chave)) {
      chavesUnicas.add(chave);
      concursosUnicos.push(c);
    }
  });

  const totalGeral = concursosUnicos.length;
  
  // Por Nível (Médio, Superior, Técnico)
  const totaisNiveis = { 'Médio': 0, 'Superior': 0, 'Técnico': 0 };

  // Por Eixo
  const totaisAreas = { 'Professor': 0, 'Pedagogo': 0, 'Tecnologia da Informação': 0, 'Dentista / Odontologia': 0, 'Geral / Outras Áreas': 0 };

  // Por Instituição
  const contagemInstituicoes = {};
  const contagemStatus = { 'Aberto': 0, 'Encerrado': 0 };

  concursosUnicos.forEach(c => {
    if (totaisNiveis[c.nivel] !== undefined) totaisNiveis[c.nivel]++;
    
    // Mapeamento normalizado de área para métrica
    let areaChave = c.area;
    if (areaChave.includes("Tecnologia") || areaChave.includes("Informática")) areaChave = 'Tecnologia da Informação';
    if (totaisAreas[areaChave] !== undefined) {
      totaisAreas[areaChave]++;
    } else {
      totaisAreas['Geral / Outras Áreas']++;
    }

    if (contagemStatus[c.status] !== undefined) contagemStatus[c.status]++;
    contagemInstituicoes[c.instituicao] = (contagemInstituicoes[c.instituicao] || 0) + 1;
  });

  const rankingInst = Object.entries(contagemInstituicoes)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  const metricas = {
    geradoEm: new Date().toISOString(),
    totalGeral,
    totaisNiveis,
    totaisAreas,
    status: contagemStatus,
    porInstituicao: rankingInst
  };

  const metricasPath = path.join(__dirname, 'metricas.json');
  fs.writeFileSync(metricasPath, JSON.stringify(metricas, null, 2), 'utf-8');
  console.log(`Métricas de concursos salvas em: ${metricasPath}`);
}

// Execução Principal do Compilador de Concursos
async function executarCompilador() {
  console.log(`--- Iniciando Compilador de Concursos Públicos da Bahia (${new Date().toLocaleString()}) ---`);

  // 1. Sementa o histórico de 2 anos se estiver vazio
  verificarEGerarHistoricoRetroativo();

  // 2. Coleta novos concursos
  const concursosNovos = await buscarNovosConcursos();

  // 3. Salva no histórico do mês atual
  for (const tema of ['professor', 'pedagogo', 'ti', 'dentista', 'geral']) {
    console.log(`Salvando concursos recentes no histórico: ${tema} (${concursosNovos[tema].length} editais)`);
    try {
      salvarHistoricoConcurso(tema, concursosNovos[tema]);
    } catch (err) {
      console.warn(`Aviso ao salvar histórico do tema '${tema}':`, err.message);
    }
  }

  // 4. Consolida os arquivos históricos anuais
  consolidarTodosAnos();

  // 5. Gera a compilação geral dos editais abertos
  gerarUltimosConcursos();

  // 6. Atualiza métricas estatísticas de toda a base histórica
  gerarMetricas();

  console.log("--- Compilador de Concursos Bahia finalizado com sucesso! ---");
}

executarCompilador();
